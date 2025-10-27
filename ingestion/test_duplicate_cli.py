#!/usr/bin/env python3
"""
Command-line test for duplicate prevention helper.
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.local_db import init_db, save_if_new


def main():
    parser = argparse.ArgumentParser(
        description="Test duplicate prevention by saving a document"
    )
    parser.add_argument("--source_id", required=True, help="Source identifier")
    parser.add_argument("--file_url", required=True, help="URL where file was found")
    parser.add_argument("--file_path", required=True, help="Path to local file")
    
    args = parser.parse_args()
    
    # Check if database exists, if not initialize it
    db_path = Path("data/civicpulse.db")
    if not db_path.exists():
        print("Database not found. Initializing...")
        init_db()
        print("✓ Database initialized")
    
    # Read the file as bytes
    file_path = Path(args.file_path)
    if not file_path.exists():
        print(f"Error: File not found: {args.file_path}")
        exit(1)
    
    with open(file_path, 'rb') as f:
        content_bytes = f.read()
    
    file_size = len(content_bytes)
    print(f"Read {file_size} bytes from {args.file_path}")
    
    # Save the document
    result = save_if_new(
        source_id=args.source_id,
        file_url=args.file_url,
        content_bytes=content_bytes
    )
    
    # Print the result
    print("\nResult:")
    print(f"  Status: {result['status']}")
    print(f"  Document ID: {result['document_id']}")
    print(f"  Content Hash: {result['content_hash']}")
    print(f"  Bytes Size: {result['bytes_size']}")


if __name__ == "__main__":
    main()

