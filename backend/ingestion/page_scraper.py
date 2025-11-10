#!/usr/bin/env python3
"""
Page scraper that downloads all Agenda and Minutes PDFs from an agenda center page.
Designed to work with CivicPlus agenda center pages and similar structures.
"""

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: BeautifulSoup4 is required. Install with: pip install beautifulsoup4")
    sys.exit(1)

# Import existing helpers
from ingestion.local_db import init_db, save_if_new, url_exists_in_db
from ingestion.single_link_scraper import download_url, is_allowed_domain, is_pdf_content

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required. Install with: pip install pyyaml")
    sys.exit(1)


def parse_date_from_text(date_text: str) -> tuple:
    """
    Parse date from text like "Nov 6, 2025" or "October 14, 2025" or "Nov6, 2025— AmendedOct30, 2025 4:32 PM".
    
    Returns:
        Tuple of (year, month, day) as integers, or None if parsing fails
    """
    # Clean the text - extract just the first date before em dash or other separators
    date_text = date_text.strip()
    
    # Remove em dash and everything after it to get just the main date
    if '—' in date_text:
        date_text = date_text.split('—')[0].strip()
    elif ' - ' in date_text:
        date_text = date_text.split(' - ')[0].strip()
    
    # Fix spacing issues like "Nov6" -> "Nov 6"
    date_text = re.sub(r'([A-Za-z]+)(\d+)', r'\1 \2', date_text)
    
    # Try common date formats
    formats = [
        "%b %d, %Y",      # Nov 6, 2025
        "%B %d, %Y",      # October 14, 2025
        "%m/%d/%Y",       # 11/06/2025
        "%Y-%m-%d",       # 2025-11-06
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_text, fmt)
            return (dt.year, dt.month, dt.day)
        except ValueError:
            continue
    
    # Try to extract from text with regex (handles variations)
    # Match patterns like "Nov 6, 2025" or "October 14, 2025"
    match = re.search(r'([A-Za-z]+)\s+(\d+),\s+(\d{4})', date_text)
    if match:
        month_name, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month_name} {day}, {year}", "%B %d, %Y")
            return (dt.year, dt.month, dt.day)
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_name} {day}, {year}", "%b %d, %Y")
                return (dt.year, dt.month, dt.day)
            except ValueError:
                pass
    
    # Try extracting just numbers if we see a pattern like "Nov6" or "Oct21"
    match = re.search(r'([A-Za-z]+)(\d+),\s*(\d{4})', date_text)
    if match:
        month_name, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month_name} {day}, {year}", "%b %d, %Y")
            return (dt.year, dt.month, dt.day)
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_name} {day}, {year}", "%B %d, %Y")
                return (dt.year, dt.month, dt.day)
            except ValueError:
                pass
    
    return None


def generate_filename(city_name: str, year: int, month: int, day: int, doc_type: str) -> str:
    """
    Generate filename like "Wichita_11-06-2025_Agenda.pdf" or "Wichita_10-14-2025_Minutes.pdf".
    """
    date_str = f"{month:02d}-{day:02d}-{year}"
    filename = f"{city_name}_{date_str}_{doc_type}.pdf"
    return filename


def fetch_page_html(url: str, timeout: int = 30) -> str:
    """
    Fetch HTML content from a URL.
    """
    req = Request(url)
    req.add_header("User-Agent", "CivicPulse/1.0")
    
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode('utf-8', errors='ignore')


def extract_meeting_rows(html: str, selectors: dict, base_url: str) -> list:
    """
    Extract meeting rows from HTML using BeautifulSoup.
    
    Returns:
        List of dictionaries, each containing:
        - date_text: Raw date text from the page
        - agenda_url: URL to agenda PDF (or None)
        - minutes_url: URL to minutes PDF (or None)
        - parsed_date: Tuple (year, month, day) or None
    """
    soup = BeautifulSoup(html, 'html.parser')
    rows = soup.select(selectors['meeting_row'])
    
    meetings = []
    
    for row in rows:
        meeting = {
            'date_text': None,
            'agenda_url': None,
            'minutes_url': None,
            'parsed_date': None
        }
        
        # Extract date
        date_elem = row.select_one(selectors['date_selector'])
        if date_elem:
            date_text = date_elem.get_text(strip=True)
            meeting['date_text'] = date_text
            meeting['parsed_date'] = parse_date_from_text(date_text)
        
        # Extract agenda link - try multiple selectors in case structure varies
        agenda_elem = None
        if 'agenda_link' in selectors:
            agenda_elem = row.select_one(selectors['agenda_link'])
        
        # Fallback: look for any link containing "Agenda" in href
        if not agenda_elem:
            agenda_links = row.select('a[href*="Agenda"]')
            for link in agenda_links:
                # Skip if it's a "Previous Versions" or similar link
                href = link.get('href', '')
                text = link.get_text(strip=True).lower()
                if 'ViewFile/Agenda' in href and 'previous' not in text.lower():
                    agenda_elem = link
                    break
        
        if agenda_elem and agenda_elem.get('href'):
            href = agenda_elem.get('href')
            meeting['agenda_url'] = urljoin(base_url, href)
        
        # Extract minutes link
        minutes_elem = None
        if 'minutes_link' in selectors:
            minutes_elem = row.select_one(selectors['minutes_link'])
        
        # Fallback: look for any link containing "Minutes" in href
        if not minutes_elem:
            minutes_links = row.select('a[href*="Minutes"]')
            for link in minutes_links:
                href = link.get('href', '')
                text = link.get_text(strip=True).lower()
                if 'ViewFile/Minutes' in href:
                    minutes_elem = link
                    break
        
        if minutes_elem and minutes_elem.get('href'):
            href = minutes_elem.get('href')
            meeting['minutes_url'] = urljoin(base_url, href)
        
        # Only add meetings that have at least a date
        if meeting['date_text']:
            meetings.append(meeting)
    
    return meetings


def download_and_save_pdf(
    url: str,
    source_id: str,
    city_name: str,
    year: int,
    month: int,
    day: int,
    doc_type: str,
    output_base: Path,
    allowed_domains: list
) -> dict:
    """
    Download a PDF, check for duplicates, and save it with proper naming.
    
    Returns:
        Dict with status, document_id, bytes, saved_path, reason
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
        # Validate domain
        parsed_url = urlparse(url)
        host = parsed_url.netloc
        if not is_allowed_domain(host, allowed_domains):
            result["reason"] = f"Domain '{host}' not in allowed domains: {allowed_domains}"
            return result
        
        # Fast URL pre-check: skip download if URL already exists in database
        db_path = Path("data/civicpulse.db")
        if url_exists_in_db(url, str(db_path)):
            result["status"] = "duplicate"
            result["reason"] = "URL already exists in database (skipped download)"
            # Get existing document ID for consistency
            conn = sqlite3.connect(str(db_path))
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM documents WHERE file_url = ? LIMIT 1", (url,))
                row = cursor.fetchone()
                if row:
                    result["document_id"] = row[0]
            finally:
                conn.close()
            return result
        
        # Download (only if URL is new)
        content_bytes, content_type = download_url(url)
        
        # Check if PDF
        if not is_pdf_content(content_type, content_bytes):
            result["reason"] = "not a PDF"
            return result
        
        # Store in database (duplicate detection)
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
            # Generate filename
            filename = generate_filename(city_name, year, month, day, doc_type)
            
            # Create output directory
            output_base.mkdir(parents=True, exist_ok=True)
            
            # Save file
            saved_path = output_base / filename
            with open(saved_path, "wb") as f:
                f.write(content_bytes)
            
            result["saved_path"] = str(saved_path)
        
        return result
    
    except Exception as e:
        result["reason"] = str(e)
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Download all Agenda and Minutes PDFs from an agenda center page"
    )
    parser.add_argument("--config", required=True, help="Path to config YAML")
    parser.add_argument("--outdir", help="Base output directory (overrides config)")
    parser.add_argument("--dry-run", action="store_true", help="Parse page but don't download")
    
    args = parser.parse_args()
    
    # Load config (simplified loader for page scraper configs)
    try:
        config_path = Path(args.config)
        if not config_path.is_absolute():
            # If relative, assume it's relative to backend/configs/
            backend_dir = Path(__file__).parent.parent
            config_path = backend_dir / "configs" / config_path.name if not "/" in str(args.config) else backend_dir / args.config
        
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Validate required fields
        required_fields = ['id', 'page_url', 'city_name', 'allowed_domains', 'selectors']
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field in config: {field}")
    except Exception as e:
        print(json.dumps({"error": f"Failed to load config: {e}"}))
        sys.exit(1)
    
    # Initialize database if needed
    db_path = Path("data/civicpulse.db")
    if not db_path.exists():
        init_db()
    
    # Determine output directory
    output_base_dir = args.outdir if args.outdir else config.get('output_dir', 'data/raw notes')
    
    # Create timestamped output directory
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y-%m-%d_%H%M%S")
    output_dir = Path(output_base_dir) / config['city_name'] / timestamp
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Output directory: {output_dir}", file=sys.stderr)
    
    # Extract base URL for resolving relative links
    page_url = config['page_url']
    base_url = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"
    
    print(f"Fetching: {page_url}", file=sys.stderr)
    
    try:
        html = fetch_page_html(page_url)
    except Exception as e:
        print(json.dumps({"error": f"Failed to fetch page: {e}"}))
        sys.exit(1)
    
    # Extract meeting rows
    selectors = config['selectors']
    meetings = extract_meeting_rows(html, selectors, base_url)
    
    print(f"Found {len(meetings)} meetings", file=sys.stderr)
    
    # Results summary
    results = {
        "total_meetings": len(meetings),
        "agendas_downloaded": 0,
        "agendas_duplicates": 0,
        "agendas_errors": 0,
        "minutes_downloaded": 0,
        "minutes_duplicates": 0,
        "minutes_errors": 0,
        "downloads": []
    }
    
    if args.dry_run:
        print("\n=== DRY RUN - Meetings found ===", file=sys.stderr)
        for meeting in meetings:
            print(f"Date: {meeting['date_text']} (parsed: {meeting['parsed_date']})", file=sys.stderr)
            if meeting['agenda_url']:
                print(f"  Agenda: {meeting['agenda_url']}", file=sys.stderr)
            if meeting['minutes_url']:
                print(f"  Minutes: {meeting['minutes_url']}", file=sys.stderr)
        print(json.dumps(results))
        return
    
    # Download PDFs
    source_id = config['id']
    city_name = config['city_name']
    allowed_domains = config['allowed_domains']
    
    for meeting in meetings:
        parsed_date = meeting['parsed_date']
        if not parsed_date:
            print(f"Warning: Could not parse date: {meeting['date_text']}", file=sys.stderr)
            continue
        
        year, month, day = parsed_date
        
        # Download Agenda
        if meeting['agenda_url']:
            print(f"Downloading agenda for {meeting['date_text']}...", file=sys.stderr)
            agenda_result = download_and_save_pdf(
                meeting['agenda_url'],
                source_id,
                city_name,
                year, month, day,
                "Agenda",
                output_dir,
                allowed_domains
            )
            
            results["downloads"].append(agenda_result)
            
            if agenda_result["status"] == "created":
                results["agendas_downloaded"] += 1
                print(f"  ✓ Downloaded: {agenda_result.get('saved_path', 'N/A')}", file=sys.stderr)
            elif agenda_result["status"] == "duplicate":
                results["agendas_duplicates"] += 1
                print(f"  ⊙ Duplicate (skipped)", file=sys.stderr)
            else:
                results["agendas_errors"] += 1
                print(f"  ✗ Error: {agenda_result['reason']}", file=sys.stderr)
        
        # Download Minutes
        if meeting['minutes_url']:
            print(f"Downloading minutes for {meeting['date_text']}...", file=sys.stderr)
            minutes_result = download_and_save_pdf(
                meeting['minutes_url'],
                source_id,
                city_name,
                year, month, day,
                "Minutes",
                output_dir,
                allowed_domains
            )
            
            results["downloads"].append(minutes_result)
            
            if minutes_result["status"] == "created":
                results["minutes_downloaded"] += 1
                print(f"  ✓ Downloaded: {minutes_result.get('saved_path', 'N/A')}", file=sys.stderr)
            elif minutes_result["status"] == "duplicate":
                results["minutes_duplicates"] += 1
                print(f"  ⊙ Duplicate (skipped)", file=sys.stderr)
            else:
                results["minutes_errors"] += 1
                print(f"  ✗ Error: {minutes_result['reason']}", file=sys.stderr)
    
    # Print summary
    print(f"\n=== Summary ===", file=sys.stderr)
    print(f"Agendas: {results['agendas_downloaded']} downloaded, {results['agendas_duplicates']} duplicates, {results['agendas_errors']} errors", file=sys.stderr)
    print(f"Minutes: {results['minutes_downloaded']} downloaded, {results['minutes_duplicates']} duplicates, {results['minutes_errors']} errors", file=sys.stderr)
    
    # Output JSON results
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

