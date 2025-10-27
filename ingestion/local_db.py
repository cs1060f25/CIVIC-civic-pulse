"""
Local SQLite database utility for document storage and duplicate prevention.
"""

import hashlib
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_DB_PATH = "data/civicpulse.db"


def get_db_path(db_path: str = None) -> Path:
    """Get the database path and ensure the directory exists."""
    if db_path is None:
        # Check environment variable first
        db_path = os.environ.get("CIVICPULSE_DB", DEFAULT_DB_PATH)
    
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    
    return db_file


def init_db(db_path: str = None) -> None:
    """
    Initialize the database by running the schema.sql file.
    
    Args:
        db_path: Optional path to the database file (defaults to data/civicpulse.db)
    """
    schema_path = Path("db/schema.sql")
    db_file = get_db_path(db_path)
    
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    
    # Read the schema SQL
    with open(schema_path, 'r') as f:
        schema_sql = f.read()
    
    # Execute the schema
    conn = sqlite3.connect(str(db_file))
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


def save_if_new(source_id: str, file_url: str, content_bytes: bytes) -> dict:
    """
    Save a document to the database if it doesn't already exist (based on content hash).
    
    Args:
        source_id: The source identifier (e.g., "wichita_city_council")
        file_url: The URL where the document was found
        content_bytes: The raw content of the document
        
    Returns:
        Dict with keys:
            - status: "created" if new document, "duplicate" if already exists
            - document_id: UUID4 string identifier
            - content_hash: SHA256 hash of the content
            - bytes_size: Size of the content in bytes
    """
    # Compute SHA256 hash
    content_hash = hashlib.sha256(content_bytes).hexdigest()
    
    # Generate unique ID
    document_id = str(uuid.uuid4())
    
    # Get UTC ISO timestamp
    created_at = datetime.now(timezone.utc).isoformat()
    
    # Get bytes size
    bytes_size = len(content_bytes)
    
    # Try to insert
    db_file = get_db_path()
    conn = sqlite3.connect(str(db_file))
    
    try:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (document_id, source_id, file_url, content_hash, bytes_size, created_at)
            )
            conn.commit()
            status = "created"
        except sqlite3.IntegrityError:
            # Duplicate content_hash detected
            conn.rollback()
            status = "duplicate"
            
            # Get the existing document's ID
            cursor.execute(
                "SELECT id FROM documents WHERE content_hash = ? LIMIT 1",
                (content_hash,)
            )
            result = cursor.fetchone()
            if result:
                document_id = result[0]
    
    finally:
        conn.close()
    
    return {
        "status": status,
        "document_id": document_id,
        "content_hash": content_hash,
        "bytes_size": bytes_size
    }


if __name__ == "__main__":
    # Example usage and test
    print("Initializing database...")
    init_db()
    print("✓ Database initialized")
    
    print("\nTesting save_if_new...")
    
    # Test with sample content
    test_content = b"Sample PDF content for testing"
    
    result1 = save_if_new(
        source_id="test_source",
        file_url="https://example.com/test.pdf",
        content_bytes=test_content
    )
    print(f"First save: {result1}")
    
    result2 = save_if_new(
        source_id="test_source",
        file_url="https://example.com/test.pdf",
        content_bytes=test_content
    )
    print(f"Second save (duplicate): {result2}")
    
    assert result1["status"] == "created"
    assert result2["status"] == "duplicate"
    assert result1["content_hash"] == result2["content_hash"]
    assert result1["document_id"] == result2["document_id"]
    
    print("\n✓ All tests passed")

