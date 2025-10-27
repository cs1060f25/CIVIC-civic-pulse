import sys, pathlib, pymupdf, os
import logging, io, csv
from PIL import Image
import pytesseract

pdf_dir = r"backend/processing/test_files"
output_dir = r"backend/processing/output"
log_dir = r"backend/processing/logs"
log_path = os.path.join(log_dir, "ocr.log")
summary_csv = os.path.join(log_dir, "summary.csv")

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)
logging.basicConfig(filename=log_path, level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
keywords_env = os.getenv("CIVICPULSE_KEYWORDS", "")
keywords = [k.strip() for k in keywords_env.split(",") if k.strip()]
summary_rows = []

for root, dirs, files in os.walk(pdf_dir):
    for file in files:
        if not file.lower().endswith(".pdf"):
            continue
        pdf_path = os.path.join(root, file)
        try:
            with pymupdf.open(pdf_path) as doc:  # open document
                page_texts = []
                text_pages = 0
                ocr_pages = 0
                for page in doc:
                    t = page.get_text("text", sort=True)
                    if t and t.strip():
                        page_texts.append(t)
                        text_pages += 1
                    else:
                        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
                        img_bytes = pix.tobytes(output="png")
                        img = Image.open(io.BytesIO(img_bytes))
                        t_ocr = pytesseract.image_to_string(img)
                        page_texts.append(t_ocr)
                        ocr_pages += 1
                text = chr(12).join(page_texts)
                text = "\n".join(line.lstrip() for line in text.splitlines())
        except Exception as e:
            logging.exception(f"Failed processing {pdf_path}")
            continue
        
        # print(text)
        
        # write as a binary file to support non-ASCII characters
        out_txt_path = os.path.join(output_dir, file.split(".")[0] + ".txt")
        try:
            pathlib.Path(out_txt_path).write_bytes(text.encode())
            logging.info(f"Wrote text for {pdf_path} to {out_txt_path}")
        except Exception:
            logging.exception(f"Failed writing text for {pdf_path}")
            continue
        
        total_chars = len(text)
        hits = {}
        if keywords:
            low = text.lower()
            for k in keywords:
                hits[k] = low.count(k.lower())
        summary_rows.append({
            "file": os.path.relpath(pdf_path, pdf_dir),
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
