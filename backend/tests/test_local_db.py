import os
import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path

# Ensure 'backend' directory is on sys.path so 'ingestion' can be imported when run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import target module
from ingestion.local_db import init_db, save_if_new, get_db_path


class TestLocalDB(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tmpdir.name) / "civicpulse_test.db")
        # Ensure schema exists by calling init_db with our custom path
        init_db(db_path=self.db_path)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _count_documents(self):
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM documents")
            (n,) = cur.fetchone()
            return n
        finally:
            conn.close()

    def test_get_db_path_creates_directory(self):
        custom_dir = Path(self.tmpdir.name) / "nested" / "dir"
        custom_db = custom_dir / "db.sqlite"
        resolved = get_db_path(str(custom_db))
        self.assertTrue(resolved.parent.exists(), "Expected parent directory to be created")

    def test_save_if_new_inserts_and_deduplicates(self):
        content = b"same-bytes-content"
        res1 = save_if_new(
            source_id="test_source",
            file_url="https://example.com/a.pdf",
            content_bytes=content,
            db_path=self.db_path,
        )
        self.assertEqual(res1["status"], "created")
        self.assertEqual(self._count_documents(), 1)

        # Duplicate insert with same content
        res2 = save_if_new(
            source_id="test_source",
            file_url="https://example.com/b.pdf",
            content_bytes=content,
            db_path=self.db_path,
        )
        self.assertEqual(res2["status"], "duplicate")
        self.assertEqual(self._count_documents(), 1)
        # Should return same document_id and hash
        self.assertEqual(res1["content_hash"], res2["content_hash"])
        self.assertEqual(res1["document_id"], res2["document_id"]) 

    def test_save_if_new_respects_custom_db_path(self):
        # Write to default DB path once to prove isolation
        # Ensure default DB schema exists
        init_db()
        default_result = save_if_new(
            source_id="default",
            file_url="https://example.com/default.pdf",
            content_bytes=b"default-content",
        )
        # Now insert into our temp DB and make sure it's independent
        res = save_if_new(
            source_id="isolated",
            file_url="https://example.com/iso.pdf",
            content_bytes=b"iso-content",
            db_path=self.db_path,
        )
        self.assertEqual(res["status"], "created")
        self.assertEqual(self._count_documents(), 1)

        # Clean up default DB file if it was created
        default_db = Path("data/civicpulse.db")
        if default_db.exists():
            try:
                default_db.unlink()
            except Exception:
                pass


if __name__ == "__main__":
    unittest.main()
