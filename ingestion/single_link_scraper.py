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


def download_url(url: str, timeout: int = 20, _urlopen_fn=None) -> tuple:
    """
    Download content from a URL.
    
    Args:
        url: URL to download
        timeout: Timeout in seconds
        _urlopen_fn: Optional urlopen function (for testing)
        
    Returns:
        Tuple of (bytes, content_type_header_value)
        
    Raises:
        Exception on network or download errors
    """
    if _urlopen_fn is None:
        _urlopen_fn = urlopen
    
    req = Request(url)
    req.add_header("User-Agent", "CivicPulse/1.0")
    
    with _urlopen_fn(req, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "")
        content_bytes = response.read()
        
    return content_bytes, content_type


def scrape_single_link(config_path: str, source_id: str, url: str, 
                      outdir: str = "data/sandbox", filename: str = None,
                      _urlopen_fn=None):
    """
    Core scraping logic (separated for testing).
    
    Returns:
        Result dictionary
    """
    result = {
        "status": "error",
        "document_id": None,
        "bytes": 0,
        "url": url,
        "saved_path": None,
        "reason": None
    }
    
    try:
        # Initialize database if needed
        db_path = Path("data/civicpulse.db")
        if not db_path.exists():
            init_db()
        
        # Load config
        config = load_config(config_path)
        
        # Validate domain
        parsed_url = urlparse(url)
        host = parsed_url.netloc
        if not is_allowed_domain(host, config["allowed_domains"]):
            result["reason"] = f"Domain '{host}' not in allowed domains: {config['allowed_domains']}"
            return result
        
        # Download
        content_bytes, content_type = download_url(url, _urlopen_fn=_urlopen_fn)
        
        # Check if PDF
        if not is_pdf_content(content_type, content_bytes):
            result["reason"] = f"Content-Type '{content_type}' is not a PDF"
            return result
        
        # Store in database
        db_result = save_if_new(
            source_id=source_id,
            file_url=url,
            content_bytes=content_bytes
        )
        
        result["status"] = db_result["status"]
        result["document_id"] = db_result["document_id"]
        result["bytes"] = len(content_bytes)
        
        # Save file if new
        if db_result["status"] == "created":
            # Determine filename
            if filename:
                target_filename = filename
            else:
                target_filename = Path(urlparse(url).path).name or "document.pdf"
            
            # Generate timestamped filename
            now = datetime.now(timezone.utc)
            timestamp = now.strftime("%Y-%m-%d_%H%M%S")
            timestamped_filename = f"{timestamp}_{target_filename}"
            
            # Create output directory
            output_dir = Path(outdir) / source_id
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Save file
            saved_path = output_dir / timestamped_filename
            with open(saved_path, "wb") as f:
                f.write(content_bytes)
            
            result["saved_path"] = str(saved_path)
        
        return result
    
    except Exception as e:
        result["reason"] = str(e)
        return result


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
    
    result = scrape_single_link(
        config_path=args.config,
        source_id=args.source_id,
        url=args.url,
        outdir=args.outdir,
        filename=args.filename
    )
    
    # Print JSON result
    print(json.dumps(result))
    
    # Exit code: 0 for created/duplicate, 1 for error
    is_error = result["status"] == "error"
    sys.exit(1 if is_error else 0)


if __name__ == "__main__":
    main()

