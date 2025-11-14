import os
import sys
import argparse
import json
import hashlib
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI


# Defaults aligned with project layout
def get_backend_path() -> Path:
	# file is at civicpulse/src/lm_parser/
	return Path(__file__).resolve().parent.parent.parent.parent / "backend"


DEFAULT_INPUT_DIR = os.getenv(
	"CIVICPULSE_PROCESSING_OUTPUT_DIR",
	str(get_backend_path() / "processing" / "output"),
)
DEFAULT_DB_PATH = os.getenv(
	"CIVICPULSE_DB_PATH",
	str(get_backend_path() / "data" / "civicpulse.db"),
)
DEFAULT_MODEL = os.getenv("GENAI_MODEL", "gemini-2.5-flash")


# Pydantic schema mirroring document_metadata table
class DocumentMetadataSchema(BaseModel):
	title: str
	entity: str
	jurisdiction: str
	counties: List[str] = Field(default_factory=list)
	meeting_date: Optional[str] = None  # YYYY-MM-DD
	doc_types: List[str] = Field(default_factory=list)
	topics: List[str] = Field(default_factory=list)
	impact: str = "Low"  # Low | Medium | High
	stage: Optional[str] = None  # Work Session | Hearing | Vote | Adopted | Draft
	keyword_hits: Dict[str, int] = Field(default_factory=dict)
	extracted_text: List[str] = Field(default_factory=list)  # sample paragraphs
	pdf_preview: List[str] = Field(default_factory=list)  # optional page snippets
	attachments: List[Dict[str, Any]] = Field(default_factory=list)

	@field_validator("meeting_date")
	@classmethod
	def validate_meeting_date(cls, v: Optional[str]) -> Optional[str]:
		if v is None or v == "":
			return None
		try:
			# accept YYYY-MM-DD (or coerce common formats)
			if len(v) == 10 and v[4] == "-" and v[7] == "-":
				datetime.strptime(v, "%Y-%m-%d")
				return v
		except Exception:
			pass
		return None

	@field_validator("impact")
	@classmethod
	def validate_impact(cls, v: str) -> str:
		allowed = {"Low", "Medium", "High"}
		if v not in allowed:
			return "Low"
		return v


SYSTEM_INSTRUCTIONS = (
	"You analyze local government PDFs (agendas, minutes, ordinances, staff reports). "
	"Return a concise JSON object with metadata for search and UI. "
	"Only use information present in the provided text. If unknown, omit or leave null."
)

HUMAN_TEMPLATE = (
	"Extract structured metadata from the following document text.\n\n"
	"Return a JSON object strictly matching this schema: {format_instructions}\n\n"
	"Guidelines:\n"
	"- title: short human-readable title for the document.\n"
	"- entity: board/commission/department, e.g., \"Johnson County Planning Board\".\n"
	"- jurisdiction: county and state, e.g., \"Johnson County, KS\".\n"
	"- counties: list of county names mentioned or implied by jurisdiction.\n"
	"- meeting_date: ISO date YYYY-MM-DD, if present.\n"
	"- doc_types: one or more of [Agenda, Minutes, Ordinance, Staff Memo, Packet, Resolution, Hearing Notice, Draft].\n"
	"- topics: relevant themes like [zoning, solar, land use, tax, budget].\n"
	"- impact: one of Low, Medium, High based on policy significance.\n"
	"- stage: one of [Work Session, Hearing, Vote, Adopted, Draft] if indicated.\n"
	"- keyword_hits: map of salient terms to approximate counts (e.g., {{\"solar\": 3}}).\n"
	"- extracted_text: 1-3 short representative paragraphs or bullet points.\n"
	"- pdf_preview, attachments: optional; include if inferrable.\n\n"
	"Document Text:\n"
	"----------------\n"
	"{context}\n"
	"----------------\n"
)


def build_llm_chain(model_name: str):
	llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.2)
	parser = JsonOutputParser(pydantic_object=DocumentMetadataSchema)
	prompt = ChatPromptTemplate.from_messages(
		[
			("system", SYSTEM_INSTRUCTIONS),
			("human", HUMAN_TEMPLATE),
		]
	).partial(format_instructions=parser.get_format_instructions())
	return prompt | llm | parser


def read_processing_jsons(input_dir: Path) -> List[Tuple[Path, Dict[str, Any]]]:
	results: List[Tuple[Path, Dict[str, Any]]] = []
	for root, _, files in os.walk(str(input_dir)):
		for f in files:
			if not f.lower().endswith(".json"):
				continue
			p = Path(root) / f
			try:
				with open(p, "r", encoding="utf-8") as fh:
					obj = json.load(fh)
				results.append((p, obj))
			except Exception:
				continue
	return results


def build_context_from_processing(obj: Dict[str, Any], max_chars: int = 100000) -> str:
	# Prefer a concatenation of first few pages or representative segments
	per_page = obj.get("per_page") or []
	texts: List[str] = []
	for page in per_page[:5]:
		t = str(page.get("text") or "").strip()
		if t:
			texts.append(f"Page {page.get('index', 0)+1}:\n{t}")
	context = "\n\n".join(texts) if texts else ""
	if len(context) > max_chars:
		return context[:max_chars]
	return context


def sha256_str(s: str) -> str:
	return hashlib.sha256(s.encode("utf-8")).hexdigest()


def ensure_db(db_path: Path) -> None:
	if not db_path.exists():
		raise FileNotFoundError(f"Database not found at {db_path}. Initialize it from backend/db/schema.sql.")


def insert_document_records(
	conn: sqlite3.Connection,
	doc_id: str,
	source_id: str,
	file_url: str,
	content_hash: str,
	bytes_size: int,
	meta: DocumentMetadataSchema,
) -> None:
	cur = conn.cursor()
	cur.execute(
		"""
		INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
		VALUES (?, ?, ?, ?, ?)
		""",
		(doc_id, source_id, file_url, content_hash, bytes_size),
	)
	cur.execute(
		"""
		INSERT INTO document_metadata (
		  document_id, title, entity, jurisdiction, counties, meeting_date,
		  doc_types, topics, impact, stage, keyword_hits, extracted_text,
		  pdf_preview, attachments
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		""",
		(
			doc_id,
			meta.title,
			meta.entity,
			meta.jurisdiction,
			json.dumps(meta.counties, ensure_ascii=False),
			meta.meeting_date,
			json.dumps(meta.doc_types, ensure_ascii=False),
			json.dumps(meta.topics, ensure_ascii=False),
			meta.impact,
			meta.stage,
			json.dumps(meta.keyword_hits, ensure_ascii=False),
			json.dumps(meta.extracted_text, ensure_ascii=False),
			json.dumps(meta.pdf_preview, ensure_ascii=False),
			json.dumps(meta.attachments, ensure_ascii=False),
		),
	)
	conn.commit()


def resolve_bytes_for_pdf(processing_json_path: Path, processing_obj: Dict[str, Any], input_dir: Path) -> int:
	rel_pdf = processing_obj.get("file")
	if not rel_pdf:
		return 0
	pdf_path = (input_dir / rel_pdf).resolve()
	try:
		return pdf_path.stat().st_size
	except Exception:
		return 0


def main() -> None:
	parser = argparse.ArgumentParser(description="Parse local government documents into structured metadata and write to SQLite.")
	parser.add_argument("--input_dir", default=DEFAULT_INPUT_DIR, help="Directory containing processing JSON outputs")
	parser.add_argument("--db_path", default=DEFAULT_DB_PATH, help="Path to SQLite database file")
	parser.add_argument("--model", default=DEFAULT_MODEL, help="Google GenAI model name, e.g., gemini-2.5-flash")
	parser.add_argument("--source_id", default="local_processing", help="Source ID to attribute documents to")
	parser.add_argument("--url_prefix", default="local:", help="Prefix to attach to file paths for file_url")
	parser.add_argument("--limit", type=int, default=0, help="Optional limit on number of files to process")
	args = parser.parse_args()

	# API key (use GOOGLE_API_KEY only)
	api_key = os.getenv("GOOGLE_API_KEY")
	if not api_key:
		raise RuntimeError("Missing Google GenAI API key. Set GOOGLE_API_KEY or provide GOOGLE_API_KEY_PATH to the container.")
	os.environ["GOOGLE_API_KEY"] = api_key.strip()

	input_dir = Path(args.input_dir)
	db_path = Path(args.db_path)
	ensure_db(db_path)

	items = read_processing_jsons(input_dir)
	if args.limit and args.limit > 0:
		items = items[: args.limit]
	if not items:
		print(f"No processing JSON files found in {input_dir}", flush=True)
		return

	chain = build_llm_chain(args.model)

	conn = sqlite3.connect(str(db_path))
	try:
		for idx, (p, obj) in enumerate(items, 1):
			context = build_context_from_processing(obj)
			if not context:
				print(f"[{idx}/{len(items)}] Skip (empty context): {p.name}", flush=True)
				continue

			print(f"[{idx}/{len(items)}] Parsing: {p.name}", flush=True)
			meta: DocumentMetadataSchema = chain.invoke({"context": context})

			# Build core document record data
			content_hash = sha256_str(context)
			bytes_size = resolve_bytes_for_pdf(p, obj, input_dir)

			# Use deterministic ID by hash for idempotency
			doc_id = content_hash
			file_rel = obj.get("file") or p.with_suffix(".pdf").name
			file_url = f"{args.url_prefix}{file_rel}"

			try:
				insert_document_records(
					conn=conn,
					doc_id=doc_id,
					source_id=args.source_id,
					file_url=file_url,
					content_hash=content_hash,
					bytes_size=bytes_size,
					meta=meta,
				)
				print(f"  -> inserted document {doc_id[:12]}...", flush=True)
			except sqlite3.IntegrityError as e:
				# Likely duplicate by content_hash or existing metadata; skip
				print(f"  -> skipped (duplicate or constraint): {e}", flush=True)
	except Exception as e:
		print(f"Error: {e}", file=sys.stderr)
		raise
	finally:
		try:
			conn.close()
		except Exception:
			pass


if __name__ == "__main__":
	main()


