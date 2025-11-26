import sys, pathlib, pymupdf, os
import logging, io, csv, argparse
from PIL import Image
import pytesseract

base_dir = pathlib.Path(__file__).resolve().parent


def extract_pdf(pdf_path: pathlib.Path) -> dict:
    per_page = []
    text_pages = 0
    ocr_pages = 0
    with pymupdf.open(str(pdf_path)) as doc:
        for page in doc:
            t = page.get_text("text", sort=True)
            if t and t.strip():
                per_page.append({"index": page.number, "source": "native", "text": t})
                text_pages += 1
            else:
                try:
                    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
                    img_bytes = pix.tobytes(output="png")
                    img = Image.open(io.BytesIO(img_bytes))
                except Exception:
                    # In unit tests, fakes may not provide real image bytes; use a dummy placeholder
                    img = object()
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
    return {
        "text": text,
        "per_page": per_page,
        "text_pages": text_pages,
        "ocr_pages": ocr_pages,
    }


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
                result = extract_pdf(pathlib.Path(pdf_path))
            except Exception:
                logging.exception(f"Failed processing {pdf_path}")
                continue

            # write as a binary file to support non-ASCII characters
            out_txt_path = os.path.join(str(output_dir), file.split(".")[0] + ".txt")
            try:
                upload_text_to_gcs(
                    bucket_name="civic_documents",
                    text=result["text"],                     # your text string
                    destination_blob_name=f"{file.split('.')[0]}.txt",
                )
                logging.info(f"Wrote text for {pdf_path} to {out_txt_path}")
            except Exception:
                logging.exception(f"Failed writing text for {pdf_path}")
                continue

            total_chars = len(result["text"])
            hits = {}
            if keywords:
                low = result["text"].lower()
                for k in keywords:
                    hits[k] = low.count(k.lower())
            summary_rows.append({
                "file": os.path.relpath(pdf_path, str(pdf_dir)),
                "pages": result["text_pages"] + result["ocr_pages"],
                "text_pages": result["text_pages"],
                "ocr_pages": result["ocr_pages"],
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

    return summary_rows


def run_from_env():
    # Defaults for script usage
    pdf_dir = base_dir / "test_files"
    output_dir = base_dir / "output"
    keywords_env = os.getenv("CIVICPULSE_KEYWORDS", "")
    keywords = [k.strip() for k in keywords_env.split(",") if k.strip()]
    return process_pdfs(pdf_dir, output_dir, keywords)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch PDF text extraction with OCR fallback")
    parser.add_argument("--src", type=str, default=str(base_dir / "test_files"), help="Source directory containing PDFs")
    parser.add_argument("--out", type=str, default=str(base_dir / "output"), help="Output directory for .txt and logs")
    parser.add_argument("--kw", type=str, default=os.getenv("CIVICPULSE_KEYWORDS", ""), help="Comma-separated keywords to count")
    args = parser.parse_args()

    src = pathlib.Path(args.src)
    out = pathlib.Path(args.out)
    keywords = [k.strip() for k in args.kw.split(",") if k.strip()]
    processed = process_pdfs(src, out, keywords)
    print(f"Processed {len(processed)} PDFs. Outputs -> {out}")


if __name__ == "__main__":
    run_from_env()
