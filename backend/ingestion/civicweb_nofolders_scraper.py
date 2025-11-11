#!/usr/bin/env python3
"""
Scraper for CivicWeb Portal-based meeting pages (Andover, KS).

Flow (requires Selenium):
1) Load the Portal MeetingInformation page
2) Extract all meeting square links from the grid
3) For each meeting:
   - Click the meeting square to open meeting detail page
   - Click "MINUTES" button
   - Click "Minutes Packet" link to download PDF
4) Download PDFs and persist via local_db.save_if_new(), writing files to
   backend/data/raw notes/<City>/<filename>.pdf

Usage (run from backend/):
  python ingestion/civicweb_nofolders_scraper.py --config configs/andover_civicweb_nofolders.yaml
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Make sure we can import ingestion utilities when running from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))
from ingestion.local_db import init_db, save_if_new  # noqa: E402
from ingestion.single_link_scraper import download_url, is_allowed_domain, is_pdf_content  # noqa: E402


def read_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        print("Error: PyYAML is required. Install with: pip install pyyaml", file=sys.stderr)
        sys.exit(1)
    with open(path, "r") as f:
        return yaml.safe_load(f)


def parse_meeting_date(date_text: str) -> Optional[Tuple[int, int, int]]:
    """
    Parse date from meeting square text (e.g., "14 OCT 2025", "12 Nov 2025", "City Council - 12 Nov 2025").
    
    Returns:
        Tuple of (year, month, day) as integers, or None if parsing fails
    """
    date_text = date_text.strip()
    
    # Try formats like "14 OCT 2025", "12 Nov 2025", or "City Council - 12 Nov 2025"
    month_map = {
        'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
        'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
        'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4, 'JUNE': 6,
        'JULY': 7, 'AUGUST': 8, 'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12
    }
    
    # Pattern: DD MMM YYYY (case insensitive)
    # Also handle "City Council - 12 Nov 2025" format
    match = re.search(r'(\d{1,2})\s+([A-Z]{3,9})\s+(\d{4})', date_text.upper())
    if match:
        day, month_str, year = match.groups()
        if month_str in month_map:
            month = month_map[month_str]
            try:
                # Validate date
                datetime(int(year), month, int(day))
                return (int(year), month, int(day))
            except ValueError:
                return None
    
    return None


def extract_meeting_squares(html: str, target_year: int, base_url: str) -> list:
    """
    Extract meeting square links from the Portal page.
    
    Returns:
        List of dictionaries, each containing:
        - date_text: Raw date text from square
        - parsed_date: Tuple (year, month, day) or None
        - meeting_url: URL to meeting detail page
        - meeting_title: Meeting title/description
    """
    soup = BeautifulSoup(html, 'lxml')
    meetings = []
    
    # Look for links that contain date patterns and "City Council" or similar
    # Format is typically "City Council - 12 Nov 2025"
    all_links = soup.find_all('a', href=True)
    for link in all_links:
        link_text = link.get_text(strip=True)
        href = link.get('href', '')
        
        # Check if link text contains a date pattern and meeting-related text
        # Look for patterns like "City Council - 12 Nov 2025" or "12 Nov 2025"
        if str(target_year) in link_text:
            # Try to parse date from the link text
            parsed_date = parse_meeting_date(link_text)
            if parsed_date and parsed_date[0] == target_year:
                # Construct full URL if relative
                if href.startswith('/'):
                    meeting_url = urljoin(base_url, href)
                elif href.startswith('http'):
                    meeting_url = href
                else:
                    continue
                
                meetings.append({
                    'date_text': link_text,
                    'parsed_date': parsed_date,
                    'meeting_url': meeting_url,
                    'meeting_title': link_text
                })
    
    return meetings


def navigate_to_minutes_packet(driver, meeting_url: str, base_url: str) -> Optional[str]:
    """
    Navigate through: meeting page → MINUTES button → Minutes Packet link.
    
    Returns:
        URL to the Minutes Packet PDF, or None if not found
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    
    try:
        # Navigate to meeting detail page
        driver.get(meeting_url)
        time.sleep(5)  # Wait for page to fully load (SPA may need time)
        
        # Find MINUTES button by ID (most reliable)
        minutes_button = None
        try:
            minutes_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "ctl00_MainContent_MinutesDocument"))
            )
        except:
            # Fallback: try by text if ID doesn't work
            try:
                minutes_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'MINUTES')]"))
                )
            except:
                pass
        
        if not minutes_button:
            print(f"  Could not find MINUTES button on {meeting_url}", file=sys.stderr)
            return None
        
        # Click the MINUTES button
        driver.execute_script("arguments[0].scrollIntoView(true);", minutes_button)
        time.sleep(0.5)
        minutes_button.click()
        time.sleep(5)  # Wait for page to update (SPA navigation)
        
        # Find "Minutes Packet" link by ID (most reliable)
        packet_url = None
        try:
            packet_link = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "ctl00_MainContent_DocumentPrintVersion"))
            )
            packet_url = packet_link.get_attribute('href')
        except:
            # Fallback: try by text and aria-label
            try:
                packet_link = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//a[@aria-label='Download minutes package PDF link' or contains(text(), 'Minutes Packet')]"))
                )
                packet_url = packet_link.get_attribute('href')
            except:
                pass
        
        if packet_url:
            # Construct full URL if relative
            if packet_url.startswith('/'):
                packet_url = urljoin(base_url, packet_url)
            return packet_url
        else:
            print(f"  Could not find Minutes Packet link after clicking MINUTES", file=sys.stderr)
            return None
        
    except Exception as e:
        print(f"Error navigating to minutes packet for {meeting_url}: {e}", file=sys.stderr)
        return None


def download_and_save(
    url: str,
    source_id: str,
    city_name: str,
    year: int,
    month: int,
    day: int,
    output_base: Path,
    allowed_domains: list
) -> dict:
    """
    Download a PDF, check for duplicates, and save it.
    
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
        
        # Download
        content_bytes, content_type = download_url(url)
        
        # Check if PDF
        if not is_pdf_content(content_type, content_bytes):
            result["reason"] = f"Not a PDF: {content_type}"
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
        
        # Always save file to disk if it doesn't exist
        date_str = f"{year:04d}-{month:02d}-{day:02d}"
        filename = f"{city_name}_{date_str}_City_Council_Minutes.pdf"
        
        # Create output directory
        dest_dir = output_base / city_name
        dest_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file if it doesn't exist
        saved_path = dest_dir / filename
        if not saved_path.exists():
            with open(saved_path, "wb") as f:
                f.write(content_bytes)
        
        result["saved_path"] = str(saved_path)
        
        return result
    
    except Exception as e:
        result["reason"] = str(e)
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Download meeting minutes from CivicWeb Portal pages"
    )
    parser.add_argument("--config", required=True, help="Path to config YAML")
    parser.add_argument("--outdir", help="Base output directory (overrides config)")
    parser.add_argument("--limit", type=int, default=None, help="Max files to download")
    
    args = parser.parse_args()
    
    # Resolve config path relative to backend/ if needed
    backend_dir = Path(__file__).resolve().parent.parent
    cfg_path = Path(args.config)
    if not cfg_path.is_absolute():
        cfg_path = backend_dir / ("configs/" + cfg_path.name if "/" not in args.config else args.config)
    config = read_yaml(cfg_path)
    
    # Initialize DB if missing
    db_path = backend_dir / "data" / "civicpulse.db"
    if not db_path.exists():
        init_db()
    
    # Determine output directory
    output_base = Path(args.outdir) if args.outdir else backend_dir / config.get("output_dir", "data/raw notes")
    
    # Get config values
    portal_url = config["portal_url"]
    city_name = config["city_name"]
    target_year = config.get("target_year", 2025)
    allowed_domains = config.get("allowed_domains", [])
    base_url = f"{urlparse(portal_url).scheme}://{urlparse(portal_url).netloc}"
    source_id = config.get("id", "andover_civicweb_nofolders")
    
    print(f"Fetching: {portal_url}", file=sys.stderr)
    
    # Use Selenium to handle JavaScript-rendered content
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.chrome.options import Options
    except ImportError:
        print("Error: Selenium is required. Install with: pip install selenium", file=sys.stderr)
        sys.exit(1)
    
    # Set up Chrome in headless mode
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
    
    driver = webdriver.Chrome(options=chrome_options)
    try:
        print("Loading Portal page with Selenium...", file=sys.stderr)
        driver.get(portal_url)
        
        # Wait for page to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        time.sleep(2)  # Give it extra time to fully render
        
        # Extract all meeting squares from the page (all meetings are loaded on single page)
        html = driver.page_source
        meetings = extract_meeting_squares(html, target_year, base_url)
        print(f"Found {len(meetings)} meetings for year {target_year}", file=sys.stderr)
        
        # Results summary
        results = {
            "total_meetings": len(meetings),
            "minutes_downloaded": 0,
            "minutes_duplicates": 0,
            "minutes_errors": 0,
            "downloads": []
        }
        
        # Process each meeting
        for i, meeting in enumerate(meetings):
            if args.limit and results["minutes_downloaded"] + results["minutes_duplicates"] >= args.limit:
                break
            
            print(f"Processing meeting {i+1}/{len(meetings)}: {meeting['date_text']}", file=sys.stderr)
            
            # Navigate to minutes packet URL
            packet_url = navigate_to_minutes_packet(driver, meeting['meeting_url'], base_url)
            
            if not packet_url:
                print(f"  Could not find minutes packet for {meeting['date_text']}", file=sys.stderr)
                results["minutes_errors"] += 1
                continue
            
            # Download and save
            parsed_date = meeting['parsed_date']
            res = download_and_save(
                url=packet_url,
                source_id=source_id,
                city_name=city_name,
                year=parsed_date[0],
                month=parsed_date[1],
                day=parsed_date[2],
                output_base=output_base,
                allowed_domains=allowed_domains
            )
            
            results["downloads"].append(res)
            if res["status"] == "created":
                results["minutes_downloaded"] += 1
            elif res["status"] == "duplicate":
                results["minutes_duplicates"] += 1
            else:
                results["minutes_errors"] += 1
            
            time.sleep(1.0)  # Be polite between downloads
        
    finally:
        driver.quit()
    
    print(json.dumps(results))


if __name__ == "__main__":
    main()

