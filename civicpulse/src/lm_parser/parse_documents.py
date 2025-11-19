import os
import sys
import argparse
import json
import hashlib
import re
import csv
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
	str(get_backend_path() / "db" / "civicpulse.db"),
)
DEFAULT_MODEL = os.getenv("GENAI_MODEL", "gemini-2.5-flash")


def load_topics_from_csv(csv_path: Path) -> List[str]:
	"""Load topic labels from topics.csv file."""
	topics = []
	try:
		with open(csv_path, "r", encoding="utf-8") as f:
			reader = csv.DictReader(f)
			for row in reader:
				topic = row.get("topic", "").strip()
				if topic:
					topics.append(topic)
	except FileNotFoundError:
		print(f"Warning: Topics CSV not found at {csv_path}. Using default topics.", file=sys.stderr)
		# Return default topics if CSV not found
		return [
			"taxes_and_budget", "housing_and_zoning", "public_welfare", "transportation",
			"utilities", "public_safety", "emergency_services", "economic_development",
			"parks_and_green_spaces", "education", "sustainability", "equity_and_civil_rights",
			"digital_access", "oversight_and_transparency", "other"
		]
	return topics


# Load topics from CSV - try multiple possible paths
def get_topics_csv_path() -> Path:
	"""Get the path to topics.csv, trying multiple locations."""
	# Try Docker path first (when running in container)
	docker_path = Path("/app/backend/data/topics.csv")
	if docker_path.exists():
		return docker_path
	# Try the standard location (when running locally)
	backend_path = get_backend_path()
	csv_path = backend_path / "data" / "topics.csv"
	if csv_path.exists():
		return csv_path
	# Fall back to Docker path (will trigger warning if not found)
	return docker_path

TOPICS_CSV_PATH = get_topics_csv_path()
AVAILABLE_TOPICS = load_topics_from_csv(TOPICS_CSV_PATH)
# Separate the 14 standard topics from "other"
STANDARD_TOPICS = [t for t in AVAILABLE_TOPICS if t != "other"]


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
	keyword_hits: Dict[str, Dict[str, int]] = Field(default_factory=dict)  # {topic: {keyword: count}}
	extracted_text: List[str] = Field(default_factory=list)  # sample paragraphs
	pdf_preview: List[str] = Field(default_factory=list)  # optional page snippets
	summary: Optional[str] = None  # 1-3 sentence summary of the entire document
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
	
	@field_validator("topics")
	@classmethod
	def validate_topics(cls, v: List[str]) -> List[str]:
		"""Ensure topics are from the available list, default to 'other' if empty or invalid."""
		if not v:
			return ["other"]
		# Filter to only valid topics, default to "other" if none valid
		valid_topics = [t for t in v if t in AVAILABLE_TOPICS]
		if not valid_topics:
			return ["other"]
		return valid_topics


SYSTEM_INSTRUCTIONS = (
	"You analyze local government documents (agendas, minutes, etc.) from Kansas. "
	"Return a concise JSON object with metadata for search and UI. "
	"Use information from both the filename and document text."
)

HUMAN_TEMPLATE = (
	"Extract structured metadata from the following document text.\n\n"
	"Filename Information:\n"
	"- Filename: {filename}\n"
	"- The filename follows the pattern: {{City}}_{{Date}}_{{Type}}.txt\n"
	"- Date format in filename is MM-DD-YYYY or MM_DD_YYYY\n"
	"Available Topic Labels (use these exact labels):\n"
	"{available_topics}\n\n"
	"Return a JSON object strictly matching this schema: {format_instructions}\n\n"
	"Guidelines:\n"
	"- title: short human-readable title for the document (can use filename info).\n"
	"- entity: board/commission/department, e.g., \"Wichita City Council\" or \"Johnson County Planning Board\".\n"
	"- jurisdiction: city/county and state, e.g., \"Wichita, KS\" or \"Johnson County, KS\". Use filename city if available.\n"
	"- counties: list of county names. For Kansas cities, infer the county (e.g., Wichita is in Sedgwick County).\n"
	"- meeting_date: ISO date YYYY-MM-DD. Extract from filename date if present, or from document text.\n"
	"- doc_types: one or more of [Agenda, Minutes, Ordinance, Staff Memo, Packet, Resolution, Hearing Notice, Draft]. Use filename type if available.\n"
	"- topics: select one or more topic labels from the available topics list above. A document can have multiple topics. If no topics match, use [\"other\"]. Use the exact topic label names (e.g., \"housing_and_zoning\", \"taxes_and_budget\").\n"
	"- impact: one of Low, Medium, High based on policy significance.\n"
	"- stage: one of [Work Session, Hearing, Vote, Adopted, Draft] if indicated.\n"
	"- keyword_hits: map of topic labels (from the 14 standard topics, NOT \"other\") to related keywords and their counts. For each topic that applies to the document, identify relevant keywords/n-grams related to that topic and count their occurrences. Format: {{\"education\": {{\"curriculum\": 5, \"K-12\": 3, \"school district\": 2}}, \"housing_and_zoning\": {{\"zoning\": 4, \"residential\": 2}}}}. Only include topics that are in the document's topics list. Do not include \"other\" in keyword_hits.\n"
	"- extracted_text: 1-3 short representative sentences or paragraphs from the document.\n"
	"- summary: a 1-3 sentence summary of the entire document's main content and purpose.\n"
	"- pdf_preview, attachments: optional; include if inferrable.\n\n"
	"Document Text:\n"
	"----------------\n"
	"{context}\n"
	"----------------\n"
)


def parse_filename(filename: str) -> Dict[str, Optional[str]]:
	"""
	Parse filename in format: {City}_{Date}_{Type}.txt
	Date format: MM-DD-YYYY or MM_DD_YYYY (e.g., "01-07-2025" or "01_07_2025")
	Examples: "Wichita_01-07-2025_Minutes.txt", "Wichita_01_07_2025_Agenda.txt"
	Returns dict with city, date (YYYY-MM-DD), and doc_type
	"""
	result = {"city": None, "date": None, "doc_type": None}
	
	# Remove .txt extension
	base_name = filename.replace(".txt", "").strip()
	
	# Pattern: City_MM-DD-YYYY_Type or City_MM_DD_YYYY_Type
	# Match: Wichita_01-07-2025_Minutes or Wichita_01_07_2025_Agenda
	pattern = r"^([^_]+)_(\d{2})[-_](\d{2})[-_](\d{4})_([^_]+(?:_[^_]+)*)$"
	
	match = re.match(pattern, base_name)
	if match:
		city = match.group(1)
		month = match.group(2)
		day = match.group(3)
		year = match.group(4)
		doc_type = match.group(5).strip()
		
		result["city"] = city
		result["date"] = f"{year}-{month}-{day}"
		
		# Normalize doc_type - handle variations like "Final City Council Agenda"
		doc_type_lower = doc_type.lower()
		if "agenda" in doc_type_lower:
			result["doc_type"] = "Agenda"
		elif "minutes" in doc_type_lower:
			result["doc_type"] = "Minutes"
		else:
			result["doc_type"] = doc_type
	
	return result


def build_llm_chain(model_name: str):
	llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.2)
	parser = JsonOutputParser(pydantic_object=DocumentMetadataSchema)
	# Format available topics as a readable list
	topics_list = ", ".join([f'"{t}"' for t in AVAILABLE_TOPICS])
	prompt = ChatPromptTemplate.from_messages(
		[
			("system", SYSTEM_INSTRUCTIONS),
			("human", HUMAN_TEMPLATE),
		]
	).partial(
		format_instructions=parser.get_format_instructions(),
		available_topics=topics_list
	)
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


def read_txt_files(input_dir: Path) -> List[Tuple[Path, str]]:
	"""Read .txt files from the input directory and return (path, full_text) tuples."""
	results: List[Tuple[Path, str]] = []
	for root, _, files in os.walk(str(input_dir)):
		for f in files:
			if not f.lower().endswith(".txt"):
				continue
			p = Path(root) / f
			try:
				with open(p, "r", encoding="utf-8", errors="replace") as fh:
					full_text = fh.read()
				if full_text.strip():  # Only include non-empty files
					results.append((p, full_text))
			except Exception as e:
				print(f"Warning: Failed to read {p}: {e}", file=sys.stderr)
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


def build_context_from_txt(full_text: str, max_chars: int = 100000) -> str:
	"""Build context from full text file, using first portion for LLM analysis."""
	if len(full_text) > max_chars:
		return full_text[:max_chars]
	return full_text


def sha256_str(s: str) -> str:
	return hashlib.sha256(s.encode("utf-8")).hexdigest()


def ensure_db(db_path: Path) -> None:
	"""Ensure database file exists and schema is initialized."""
	# Try multiple possible schema paths
	schema_paths = [
		db_path.parent / "schema.sql",  # Local: backend/db/civicpulse.db -> backend/db/schema.sql
		Path("/app/backend/db/schema.sql"),  # Docker: mounted path
		get_backend_path() / "db" / "schema.sql",  # Fallback
	]
	
	schema_path = None
	for path in schema_paths:
		if path.exists():
			schema_path = path
			break
	
	if not schema_path:
		raise FileNotFoundError(f"Schema file not found. Tried: {schema_paths}")
	
	# Ensure parent directory exists
	db_path.parent.mkdir(parents=True, exist_ok=True)
	
	if not db_path.exists():
		# Create database file and initialize schema
		conn = sqlite3.connect(str(db_path))
		try:
			with open(schema_path, "r", encoding="utf-8") as f:
				schema_sql = f.read()
			conn.executescript(schema_sql)
			conn.commit()
		finally:
			conn.close()
	else:
		# Verify schema exists
		conn = sqlite3.connect(str(db_path))
		try:
			cur = conn.cursor()
			cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'")
			if not cur.fetchone():
				# Schema not initialized, initialize it now
				with open(schema_path, "r", encoding="utf-8") as f:
					schema_sql = f.read()
				conn.executescript(schema_sql)
				conn.commit()
			cur.close()
		finally:
			conn.close()


def insert_document_records(
	conn: sqlite3.Connection,
	doc_id: str,
	source_id: str,
	file_url: str,
	content_hash: str,
	bytes_size: int,
	meta: DocumentMetadataSchema,
	full_text: Optional[str] = None,
) -> None:
	cur = conn.cursor()
	try:
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
			  pdf_preview, summary, attachments, full_text
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			""",
			(
				doc_id,
				meta.title,
				meta.entity,
				meta.jurisdiction,
				json.dumps(meta.counties, ensure_ascii=False),
				meta.meeting_date,  # SQLite stores dates as TEXT
				json.dumps(meta.doc_types, ensure_ascii=False),
				json.dumps(meta.topics, ensure_ascii=False),
				meta.impact,
				meta.stage,
				json.dumps(meta.keyword_hits, ensure_ascii=False),
				json.dumps(meta.extracted_text, ensure_ascii=False),
				json.dumps(meta.pdf_preview, ensure_ascii=False),
				meta.summary,  # Document summary
				json.dumps(meta.attachments, ensure_ascii=False),
				full_text,  # Store full text content
			),
		)
		conn.commit()
	except sqlite3.IntegrityError:
		conn.rollback()
		raise
	finally:
		cur.close()


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
	parser.add_argument("--input_dir", default=DEFAULT_INPUT_DIR, help="Directory containing processing JSON outputs or .txt files")
	parser.add_argument("--db_path", default=DEFAULT_DB_PATH, help="Path to SQLite database file")
	parser.add_argument("--model", default=DEFAULT_MODEL, help="Google GenAI model name, e.g., gemini-2.5-flash")
	parser.add_argument("--source_id", default="local_processing", help="Source ID to attribute documents to")
	parser.add_argument("--url_prefix", default="local:", help="Prefix to attach to file paths for file_url")
	parser.add_argument("--limit", type=int, default=0, help="Optional limit on number of files to process")
	parser.add_argument("--mode", choices=["json", "txt", "auto"], default="auto", help="Processing mode: json (JSON files), txt (.txt files), or auto (both)")
	args = parser.parse_args()

	# API key (use GOOGLE_API_KEY only)
	api_key = os.getenv("GOOGLE_API_KEY")
	if not api_key:
		raise RuntimeError("Missing Google GenAI API key. Set GOOGLE_API_KEY or provide GOOGLE_API_KEY_PATH to the container.")
	os.environ["GOOGLE_API_KEY"] = api_key.strip()

	input_dir = Path(args.input_dir)
	db_path = Path(args.db_path)
	
	# Ensure database exists and schema is initialized
	ensure_db(db_path)
	
	# Connect to SQLite
	conn = sqlite3.connect(str(db_path))

	chain = build_llm_chain(args.model)

	# Process JSON files if mode is json or auto
	json_items = []
	if args.mode in ["json", "auto"]:
		json_items = read_processing_jsons(input_dir)
		if args.limit and args.limit > 0:
			json_items = json_items[: args.limit]

	# Process .txt files if mode is txt or auto
	txt_items = []
	if args.mode in ["txt", "auto"]:
		txt_items = read_txt_files(input_dir)
		if args.limit and args.limit > 0:
			txt_items = txt_items[: args.limit]

	if not json_items and not txt_items:
		print(f"No processing JSON or .txt files found in {input_dir}", flush=True)
		return

	try:
		# Process JSON files
		for idx, (p, obj) in enumerate(json_items, 1):
			context = build_context_from_processing(obj)
			if not context:
				print(f"[JSON {idx}/{len(json_items)}] Skip (empty context): {p.name}", flush=True)
				continue

			print(f"[JSON {idx}/{len(json_items)}] Parsing: {p.name}", flush=True)
			# Parse filename for additional context
			filename_info = parse_filename(p.name)
			meta_result = chain.invoke({
				"context": context,
				"filename": p.name
			})
			# Ensure we have a DocumentMetadataSchema object
			if isinstance(meta_result, dict):
				meta = DocumentMetadataSchema(**meta_result)
			else:
				meta = meta_result
			
			# Ensure keyword_hits only contains standard topics (not "other") and only topics that are in the document's topics
			# Filter to only include topics that are both in STANDARD_TOPICS and in meta.topics
			meta.keyword_hits = {
				k: v for k, v in meta.keyword_hits.items() 
				if k in STANDARD_TOPICS and k in meta.topics
			}

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
					full_text=None,  # JSON mode doesn't have full text
				)
				print(f"  -> inserted document {doc_id[:12]}...", flush=True)
			except sqlite3.IntegrityError as e:
				# Likely duplicate by content_hash or existing metadata; skip
				print(f"  -> skipped (duplicate or constraint): {e}", flush=True)

		# Process .txt files
		for idx, (p, full_text) in enumerate(txt_items, 1):
			context = build_context_from_txt(full_text)
			if not context:
				print(f"[TXT {idx}/{len(txt_items)}] Skip (empty context): {p.name}", flush=True)
				continue

			print(f"[TXT {idx}/{len(txt_items)}] Parsing: {p.name}", flush=True)
			# Parse filename for additional context
			filename_info = parse_filename(p.name)
			meta_result = chain.invoke({
				"context": context,
				"filename": p.name
			})
			# Ensure we have a DocumentMetadataSchema object
			if isinstance(meta_result, dict):
				meta = DocumentMetadataSchema(**meta_result)
			else:
				meta = meta_result
			
			# Ensure keyword_hits only contains standard topics (not "other") and only topics that are in the document's topics
			# Filter to only include topics that are both in STANDARD_TOPICS and in meta.topics
			meta.keyword_hits = {
				k: v for k, v in meta.keyword_hits.items() 
				if k in STANDARD_TOPICS and k in meta.topics
			}

			# Build core document record data
			content_hash = sha256_str(full_text)
			bytes_size = len(full_text.encode("utf-8"))

			# Use deterministic ID by hash for idempotency
			doc_id = content_hash
			try:
				file_rel = str(p.relative_to(input_dir))
			except ValueError:
				# Path is not relative to input_dir, use just the filename
				file_rel = p.name
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
					full_text=full_text,  # Store full text content
				)
				print(f"  -> inserted document {doc_id[:12]}... with full text ({len(full_text)} chars)", flush=True)
			except sqlite3.IntegrityError as e:
				# Likely duplicate by content_hash; try to update full_text if missing
				try:
					cur = conn.cursor()
					cur.execute("SELECT full_text FROM document_metadata WHERE document_id = ?", (doc_id,))
					existing = cur.fetchone()
					if existing and existing[0] is None:
						# Update existing record with full text
						cur.execute("UPDATE document_metadata SET full_text = ? WHERE document_id = ?", (full_text, doc_id))
						conn.commit()
						print(f"  -> updated existing document {doc_id[:12]}... with full text ({len(full_text)} chars)", flush=True)
					else:
						print(f"  -> skipped (duplicate): {e}", flush=True)
					cur.close()
				except Exception as update_err:
					print(f"  -> skipped (duplicate or update failed): {update_err}", flush=True)
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


