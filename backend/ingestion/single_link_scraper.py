#!/usr/bin/env python3
"""
Single URL scraper that downloads, validates, and stores one PDF file.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import existing helpers
from ingestion.config_loader import load_config
from ingestion.local_db import init_db, save_if_new


def is_allowed_domain(host: str, allowed_domains: list) -> bool:
    """
    Check if a hostname matches an allowed domain (exact or subdomain).
    
    Args:
        host: The hostname to check (e.g., "www.wichita.gov")
        allowed_domains: List of allowed domains (e.g., ["wichita.gov"])
        
    Returns:
        True if host matches or is a subdomain of any allowed domain
    """
    host = host.lower()
    for allowed in allowed_domains:
        allowed = allowed.lower()
        if host == allowed or host.endswith("." + allowed):
            return True
    return False


def is_pdf_content(content_type: str, content_bytes: bytes) -> bool:
    """
    Check if the content is actually a PDF.
    
    Args:
        content_type: Content-Type header value
        content_bytes: First few bytes of the content
        
    Returns:
        True if content appears to be a PDF
    """
    # Check Content-Type header
    if content_type and "pdf" in content_type.lower():
        return True
    
    # Check PDF magic bytes
    if len(content_bytes) >= 5 and content_bytes[:5] == b"%PDF-":
        return True
    
    return False


def download_url(url: str, timeout: int = 20, max_size: int = 100 * 1024 * 1024) -> tuple:
    """
    Download content from a URL with size limit protection.
    
    Args:
        url: URL to download
        timeout: Timeout in seconds
        max_size: Maximum allowed file size in bytes (default 100MB)
        
    Returns:
        Tuple of (bytes, content_type_header_value)
        
    Raises:
        ValueError: If file size exceeds max_size
        Exception on network or download errors
    """
    req = Request(url)
    req.add_header("User-Agent", "CivicPulse/1.0")
    
    with urlopen(req, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "")
        
        # Read content in chunks to avoid memory exhaustion and enforce size limits
        chunks = []
        total_size = 0
        chunk_size = 8192  # 8KB chunks
        
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            
            total_size += len(chunk)
            
            # Check size limit before accumulating to prevent DoS
            if total_size > max_size:
                raise ValueError(
                    f"File size ({total_size} bytes) exceeds maximum allowed size ({max_size} bytes). "
                    f"This may be a denial-of-service attempt."
                )
            
            chunks.append(chunk)
        
        # Combine all chunks into single byte string
        content_bytes = b"".join(chunks)
        
    return content_bytes, content_type


def main():
    parser = argparse.ArgumentParser(
        description="Download and store a single PDF file"
    )
    parser.add_argument("--config", required=True, help="Path to config YAML")
    parser.add_argument("--source_id", required=True, help="Source identifier")
    parser.add_argument("--url", required=True, help="URL to download")
    parser.add_argument("--outdir", default="data/sandbox", help="Output directory")
    parser.add_argument("--filename", help="Optional filename override")
    
    args = parser.parse_args()
    
    result = {
        "status": "error",
        "document_id": None,
        "bytes": 0,
        "url": args.url,
        "saved_path": None,
        "reason": None
    }
    
    try:
        # Initialize database if needed
        db_path = Path("data/civicpulse.db")
        if not db_path.exists():
            init_db()
        
        # Load config
        config = load_config(args.config)
        
        # Validate domain
        parsed_url = urlparse(args.url)
        host = parsed_url.netloc
        if not is_allowed_domain(host, config["allowed_domains"]):
            result["reason"] = f"Domain '{host}' not in allowed domains: {config['allowed_domains']}"
            print(json.dumps(result))
            sys.exit(1)
        
        # Download
        content_bytes, content_type = download_url(args.url)
        
        # Check if PDF
        if not is_pdf_content(content_type, content_bytes):
            result["reason"] = "not a PDF"
            print(json.dumps(result))
            sys.exit(1)
        
        # Store in database
        db_result = save_if_new(
            source_id=args.source_id,
            file_url=args.url,
            content_bytes=content_bytes
        )
        
        result["status"] = db_result["status"]
        result["document_id"] = db_result["document_id"]
        result["bytes"] = len(content_bytes)
        
        # Save file if new
        if db_result["status"] == "created":
            # Determine filename
            if args.filename:
                filename = args.filename
            else:
                filename = Path(urlparse(args.url).path).name or "document.pdf"
            
            # Generate timestamped filename
            now = datetime.now(timezone.utc)
            timestamp = now.strftime("%Y-%m-%d_%H%M%S")
            timestamped_filename = f"{timestamp}_{filename}"
            
            # Create output directory
            outdir = Path(args.outdir) / args.source_id
            outdir.mkdir(parents=True, exist_ok=True)
            
            # Save file
            saved_path = outdir / timestamped_filename
            with open(saved_path, "wb") as f:
                f.write(content_bytes)
            
            result["saved_path"] = str(saved_path)
        
        # Print JSON result
        print(json.dumps(result))
        
        # Exit code: 0 for created/duplicate, 1 for error
        sys.exit(0)
    
    except Exception as e:
        result["reason"] = str(e)
        print(json.dumps(result))
        sys.exit(1)


if __name__ == "__main__":
    main()

