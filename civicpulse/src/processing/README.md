# Processing Module

This module contains utilities for extracting text from PDFs (native text or via OCR) and producing per-file text outputs and a summary CSV.

## Overview

The processing module handles:
- **Text Extraction**: Extracts embedded text from PDFs
- **OCR Processing**: Uses Tesseract OCR for scanned documents
- **Batch Processing**: Processes multiple PDFs in a directory
- **Summary Generation**: Creates CSV summaries of processed documents

## Module Structure

```
src/processing/
├── pdf_processor.py         # Main PDF processing script
├── tests/                   # Unit tests
├── requirements.txt         # Python dependencies
├── Dockerfile               # Docker configuration
└── README.md               # This file
```

## Components

- `pdf_processor.py`
  - Batch processor. Recursively scans `backend/processing/test_files` for PDFs.
  - For each page: extracts embedded text; if none, renders the page and runs Tesseract OCR.
  - Writes a `.txt` file per PDF under `backend/processing/output`.
  - Logs activity to `backend/processing/logs/ocr.log` and writes a summary CSV to `backend/processing/logs/summary.csv`.
  - Counts keyword occurrences if `CIVICPULSE_KEYWORDS` env var is set.

## Prerequisites

- Python 3.10+
- Python packages (install into your venv):
  - `pip install pymupdf pillow pytesseract`
- System dependency: Tesseract OCR binary must be installed and on PATH.
  - macOS (Homebrew): `brew install tesseract`
  - Verify: `tesseract --version`

## Directory Layout

- Input PDFs for batch run: `backend/processing/test_files/` (recursively scanned)
- Outputs:
  - Extracted text files: `backend/processing/output/<name>.txt`
  - Logs: `backend/processing/logs/ocr.log`
  - Summary CSV: `backend/processing/logs/summary.csv`

These folders are auto-created if missing.

## Environment Variables

- `CIVICPULSE_KEYWORDS` (optional): comma-separated list of keywords to count in extracted text.
  - Example: `export CIVICPULSE_KEYWORDS="agenda,minutes,budget"`

## Usage

### 1) Batch process all PDFs in test_files

From the module directory, run the script with Python:

```bash
# From civicpulse/src/processing/
python pdf_processor.py
```

Behavior:
- Walks `backend/processing/test_files` and processes all `*.pdf`.
- For each PDF, writes `<basename>.txt` to `backend/processing/output`.
- Appends per-file stats to an in-memory list; at end, writes `logs/summary.csv` with columns:
  - `file, pages, text_pages, ocr_pages, total_chars` plus `kw:<keyword>` columns if keywords are set.

## Notes on OCR

- The processor tries native text first. If a page has no extractable text, it rasterizes at 2x scale and sends the image to Tesseract.
- OCR quality depends on PDF scan quality, language packs, and Tesseract configuration.

## Troubleshooting

- `ModuleNotFoundError: No module named 'pymupdf'`:
  - Install deps in your venv: `pip install pymupdf pillow pytesseract`
- `pytesseract.pytesseract.TesseractNotFoundError`:
  - Install Tesseract (`brew install tesseract`) and ensure `tesseract` is on PATH.
- Output directories missing:
  - They are auto-created. Ensure the process has write permissions to `backend/processing/output` and `backend/processing/logs`.
- Garbled/non‑ASCII text in outputs:
  - `pdf_processor.py` writes bytes with UTF‑8; ensure your viewer expects UTF‑8. OCR quality may vary.
- Keywords not counted:
  - Set `CIVICPULSE_KEYWORDS` before running, e.g., `export CIVICPULSE_KEYWORDS="agenda,minutes"`.

## Docker Deployment

### Build Docker Image

```bash
docker build -t civicpulse-processing .
```

### Run Container

```bash
docker run -e CIVICPULSE_KEYWORDS="agenda,minutes,budget" \
  -v ../../backend/processing:/app/backend/processing \
  -v ../../backend/data:/app/backend/data \
  -v ../../backend/db:/app/backend/db:ro \
  civicpulse-processing
```

Or use Docker Compose (see `../../docker-compose.yml`).

## Testing

### Run Unit Tests

```bash
# Install pytest
pip install pytest

# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_pdf_processor_unit.py
```

## Extending

- Adjust rasterization scale or Tesseract options to tune OCR speed/accuracy.
- Add language packs for Tesseract (e.g., `brew install tesseract-lang`).
- Consider chunked JSON outputs or database writes for large batch runs.

