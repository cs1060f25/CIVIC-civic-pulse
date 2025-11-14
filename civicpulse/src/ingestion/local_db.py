"""
Local SQLite database utility for document storage and duplicate prevention.
"""

import hashlib
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


def get_backend_path() -> Path:
    """Get the backend directory path relative to this module."""
    # Try multiple possible locations:
    # 1. Docker environment: /app/backend (when running in Docker)
    # 2. Local development: civicpulse/src/ingestion/ -> ../../../backend
    
    current_dir = Path(__file__).resolve().parent
    
    # Check if we're in Docker (working directory is /app)
    docker_backend = current_dir.parent / "backend"
    if docker_backend.exists():
        return docker_backend
    
    # Check if we're in local development (civicpulse/src/ingestion/)
    local_backend = current_dir.parent.parent.parent / "backend"
    if local_backend.exists():
        return local_backend
    
    # Fallback: try relative to current working directory
    cwd_backend = Path.cwd() / "backend"
    if cwd_backend.exists():
        return cwd_backend
    
    # Last resort: assume we're in /app (Docker)
    return current_dir.parent / "backend"


DEFAULT_DB_PATH = "data/civicpulse.db"


def get_db_path(db_path: str = None) -> Path:
    """Get the database path and ensure the directory exists."""
    backend_path = get_backend_path()
    
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    
    # Resolve relative to backend directory
    if not Path(db_path).is_absolute():
        db_file = backend_path / db_path
    else:
        db_file = Path(db_path)
    
    db_file.parent.mkdir(parents=True, exist_ok=True)
    
    return db_file


def init_db(db_path: str = None) -> None:
    """
    Initialize the database by running the schema.sql file.
    
    Args:
        db_path: Optional path to the database file (defaults to data/civicpulse.db)
    """
    backend_path = get_backend_path()
    schema_path = backend_path / "db" / "schema.sql"
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


def url_exists_in_db(file_url: str, db_path: str = None) -> bool:
    """
    Check if a URL already exists in the database (fast check before download).
    
    Args:
        file_url: The URL to check
        db_path: Optional path to the database file
        
    Returns:
        True if URL exists, False otherwise
    """
    db_file = get_db_path(db_path)
    conn = sqlite3.connect(str(db_file))
    
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM documents WHERE file_url = ? LIMIT 1",
            (file_url,)
        )
        return cursor.fetchone() is not None
    finally:
        conn.close()


def save_if_new(source_id: str, file_url: str, content_bytes: bytes, db_path: str = None) -> dict:
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
    db_file = get_db_path(db_path)
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

