import io
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

# Ensure 'backend' directory is on sys.path so 'processing' can be imported when run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def install_fake_pymupdf_and_pytesseract():
    # Fake page objects
    class FakePage:
        def __init__(self, number, text=None, image_bytes=b"img"):
            self.number = number
            self._text = text
            self._image_bytes = image_bytes

        def get_text(self, mode, sort=False):
            return self._text or ""

        def get_pixmap(self, matrix=None):
            class Pix:
                def tobytes(self, output="png"):
                    return self._image_bytes
            return Pix()

    class FakeDoc:
        def __init__(self, pages):
            self._pages = pages
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc, tb):
            return False
        def __iter__(self):
            return iter(self._pages)

    # Fake pymupdf module (a.k.a. fitz)
    fake_pymupdf = types.ModuleType("pymupdf")
    # Provide a callable Matrix that accepts (a, b)
    def _fake_matrix(a, b):
        return (a, b)
    fake_pymupdf.Matrix = _fake_matrix

    def fake_open(path):
        # 2 pages: one with native text, one requiring OCR
        return FakeDoc([
            FakePage(0, text="Hello native text\nLine2"),
            FakePage(1, text=""),
        ])

    fake_pymupdf.open = fake_open

    # Fake PIL.Image
    fake_PIL = types.ModuleType("PIL")
    fake_Image_module = types.ModuleType("Image")

    def fake_image_open(b):
        return SimpleNamespace()

    fake_Image_module.open = fake_image_open
    fake_PIL.Image = fake_Image_module

    # Fake pytesseract
    fake_pytesseract = types.ModuleType("pytesseract")
    fake_pytesseract.Output = SimpleNamespace(DICT="dict")

    def fake_image_to_string(img):
        return "OCR TEXT"

    def fake_image_to_data(img, output=None):
        return {"conf": ["95", "-1", "88"]}

    fake_pytesseract.image_to_string = fake_image_to_string
    fake_pytesseract.image_to_data = fake_image_to_data

    # Install into sys.modules so importing tested module succeeds
    sys.modules.setdefault("pymupdf", fake_pymupdf)
    sys.modules.setdefault("PIL", fake_PIL)
    sys.modules.setdefault("PIL.Image", fake_Image_module)
    sys.modules.setdefault("pytesseract", fake_pytesseract)


class TestPdfProcessorUnit(unittest.TestCase):
    def setUp(self):
        install_fake_pymupdf_and_pytesseract()
        # Defer import until fakes are installed
        from processing import pdf_processor as pp
        self.pp = pp
        # Ensure no real image decoding occurs even if real PIL is present
        self.pp.Image.open = lambda *_args, **_kwargs: SimpleNamespace()
        self.tmpdir = tempfile.TemporaryDirectory()
        self.pdf_dir = Path(self.tmpdir.name) / "pdfs"
        self.out_dir = Path(self.tmpdir.name) / "out"
        self.pdf_dir.mkdir(parents=True, exist_ok=True)
        # Create a dummy .pdf file path (contents unused by our fakes)
        (self.pdf_dir / "sample.pdf").write_bytes(b"%PDF-1.4 ...")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_process_pdfs_writes_outputs_and_summary(self):
        rows = self.pp.process_pdfs(self.pdf_dir, self.out_dir, keywords=["hello", "ocr"])
        # Expect one file summarized
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["pages"], 2)
        self.assertEqual(row["text_pages"], 1)
        self.assertEqual(row["ocr_pages"], 1)
        self.assertIn("total_chars", row)

        # Validate output artefacts
        txt_path = self.out_dir / "sample.txt"
        json_path = self.out_dir / "sample.json"
        self.assertTrue(txt_path.exists(), "Expected text output to be written")
        self.assertTrue(json_path.exists(), "Expected json output to be written")

        payload = json.loads(json_path.read_text())
        self.assertEqual(payload["pages"], 2)
        self.assertEqual(len(payload["per_page"]), 2)

        # Summary CSV exists under logs
        summary_csv = self.out_dir / "logs" / "summary.csv"
        self.assertTrue(summary_csv.exists(), "Expected summary.csv to be created")


if __name__ == "__main__":
    unittest.main()
