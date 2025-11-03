import sys, pathlib, pymupdf, os
import logging, io, csv, json
from PIL import Image
import pytesseract

base_dir = pathlib.Path(__file__).resolve().parent


def get_backend_path() -> pathlib.Path:
    """Get the backend directory path relative to this module."""
    # This file is in civicpulse/src/processing/
    # Backend is at ../../../backend (up to civicpulse, then up to CIVIC-civic-pulse, then to backend)
    return pathlib.Path(__file__).resolve().parent.parent.parent.parent / "backend"


def process_pdfs(pdf_dir: pathlib.Path, output_dir: pathlib.Path, keywords: list[str]) -> list[dict]:
    log_dir = output_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = str(log_dir / "ocr.log")
    summary_csv = str(log_dir / "summary.csv")

    # Configure logging once
    if not logging.getLogger().handlers:
        logging.basicConfig(filename=log_path, level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

    summary_rows: list[dict] = []

    for root, dirs, files in os.walk(str(pdf_dir)):
        for file in files:
            if not file.lower().endswith(".pdf"):
                continue
            pdf_path = os.path.join(root, file)
            try:
                with pymupdf.open(pdf_path) as doc:  # open document
                    per_page = []
                    text_pages = 0
                    ocr_pages = 0
                    for page in doc:
                        t = page.get_text("text", sort=True)
                        if t and t.strip():
                            per_page.append({"index": page.number, "source": "native", "text": t})
                            text_pages += 1
                        else:
                            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
                            img_bytes = pix.tobytes(output="png")
                            img = Image.open(io.BytesIO(img_bytes))
                            t_ocr = pytesseract.image_to_string(img)
                            try:
                                data = pytesseract.image_to_data(img, output=pytesseract.Output.DICT)
                                confs = [int(c) for c in data.get("conf", []) if c.isdigit() and int(c) >= 0]
                                avg_conf = (sum(confs) / len(confs)) if confs else None
                            except Exception:
                                avg_conf = None
                            per_page.append({"index": page.number, "source": "ocr", "text": t_ocr, "ocr_avg_conf": avg_conf})
                            ocr_pages += 1
                    text = chr(12).join(p["text"] for p in per_page)
                    text = "\n".join(line.lstrip() for line in text.splitlines())
            except Exception as e:
                logging.exception(f"Failed processing {pdf_path}")
                continue

            # write as a binary file to support non-ASCII characters
            out_txt_path = os.path.join(str(output_dir), file.split(".")[0] + ".txt")
            try:
                pathlib.Path(out_txt_path).write_bytes(text.encode())
                logging.info(f"Wrote text for {pdf_path} to {out_txt_path}")
            except Exception:
                logging.exception(f"Failed writing text for {pdf_path}")
                continue

            # write structured JSON alongside text
            out_json_path = os.path.join(str(output_dir), file.split(".")[0] + ".json")
            try:
                json_payload = {
                    "file": os.path.relpath(pdf_path, str(pdf_dir)),
                    "pages": text_pages + ocr_pages,
                    "text_pages": text_pages,
                    "ocr_pages": ocr_pages,
                    "per_page": per_page,
                }
                with open(out_json_path, "w", encoding="utf-8") as jf:
                    json.dump(json_payload, jf, ensure_ascii=False, indent=2)
                logging.info(f"Wrote JSON for {pdf_path} to {out_json_path}")
            except Exception:
                logging.exception(f"Failed writing JSON for {pdf_path}")
                continue

            total_chars = len(text)
            hits = {}
            if keywords:
                low = text.lower()
                for k in keywords:
                    hits[k] = low.count(k.lower())
            summary_rows.append({
                "file": os.path.relpath(pdf_path, str(pdf_dir)),
                "pages": text_pages + ocr_pages,
                "text_pages": text_pages,
                "ocr_pages": ocr_pages,
                "total_chars": total_chars,
                **{f"kw:{k}": v for k, v in hits.items()}
            })

    if summary_rows:
        fieldnames = ["file", "pages", "text_pages", "ocr_pages", "total_chars"]
        extra = sorted({k for row in summary_rows for k in row.keys()} - set(fieldnames))
        with open(summary_csv, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames + extra)
            writer.writeheader()
            for row in summary_rows:
                writer.writerow(row)

    return summary_rows


def run_from_env():
    # Defaults for script usage - use backend/processing/test_files
    backend_path = get_backend_path()
    pdf_dir = backend_path / "processing" / "test_files"
    output_dir = backend_path / "processing" / "output"
    keywords_env = os.getenv("CIVICPULSE_KEYWORDS", "")
    keywords = [k.strip() for k in keywords_env.split(",") if k.strip()]
    return process_pdfs(pdf_dir, output_dir, keywords)


if __name__ == "__main__":
    run_from_env()

