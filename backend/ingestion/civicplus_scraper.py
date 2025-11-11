#!/usr/bin/env python3
"""
Scraper for CivicPlus meeting pages (Hutchinson, KS and similar cities).

Flow (requires Selenium):
1) Load the CivicPlus agendas page
2) Wait for 2025 tab to be active/loaded
3) Extract all meeting entries from the 2025 tab panel
4) For each meeting, find the "Minutes:" link
5) Download PDFs and persist via local_db.save_if_new(), writing files to
   backend/data/raw notes/<City>/<filename>.pdf

Usage (run from backend/):
  python ingestion/civicplus_scraper.py --config configs/hutchinson_civicplus.yaml
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

# Selenium imports
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except ImportError:
    print("Error: Selenium is required. Install with: pip install selenium", file=sys.stderr)
    sys.exit(1)

# Make sure we can import ingestion utilities when running from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))
from ingestion.local_db import init_db, save_if_new  # noqa: E402
from ingestion.single_link_scraper import download_url, is_allowed_domain, is_pdf_content  # noqa: E402


def read_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        print("Error: PyYAML is required. Install with: pip install yaml", file=sys.stderr)
        sys.exit(1)
    with open(path, "r") as f:
        return yaml.safe_load(f)


def parse_meeting_date(date_text: str) -> Optional[Tuple[int, int, int]]:
    """
    Parse date from meeting text (e.g., "Tue, Nov 4, 2025", "November 4, 2025").
    
    Returns:
        Tuple of (year, month, day) as integers, or None if parsing fails
    """
    date_text = date_text.strip()
    
    # Remove day of week prefix if present (e.g., "Tue, " or "Tuesday, ")
    date_text = re.sub(r'^[A-Za-z]+,\s*', '', date_text)
    
    # Try common date formats
    formats = [
        "%b %d, %Y",      # Nov 4, 2025
        "%B %d, %Y",      # November 4, 2025
        "%m/%d/%Y",       # 11/04/2025
        "%Y-%m-%d",       # 2025-11-04
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_text, fmt)
            return (dt.year, dt.month, dt.day)
        except ValueError:
            continue
    
    # Try regex patterns for variations
    # Pattern: "Nov 4, 2025" or "November 4, 2025"
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
    
    return None


def extract_meeting_date_links(html: str, target_year: int, base_url: str) -> list:
    """
    Extract meeting date links from the 2025 tab panel HTML.
    Dates are in div.cp-fieldWrapper elements inside div.cp-formatField--stacked containers.
    These containers are clickable and navigate to meeting detail pages.
    
    Returns:
        List of dictionaries, each containing:
        - date_text: Raw date text from meeting (e.g., "Tue, Nov 4, 2025")
        - parsed_date: Tuple (year, month, day) or None
        - date_selector: XPath selector to find and click this date element with Selenium
        - meeting_title: Meeting title/description
    """
    soup = BeautifulSoup(html, 'lxml')
    meetings = []
    
    # Find the active/shown tab panel (should be 2025)
    tab_panel = soup.find('div', class_=lambda x: x and 'showing' in str(x) and 'tab' in str(x).lower())
    if not tab_panel:
        tab_panel = soup.find('div', class_=lambda x: x and 'tab' in str(x).lower())
    
    if not tab_panel:
        print("Warning: Could not find tab panel", file=sys.stderr)
        return meetings
    
    # Date pattern to match: "Tue, Nov 4, 2025"
    date_pattern = re.compile(r'(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+([A-Za-z]+)\s+(\d+),\s+(\d{4})')
    
    # Find all field wrappers (these contain the dates)
    field_wrappers = tab_panel.find_all('div', class_='cp-fieldWrapper')
    
    for wrapper in field_wrappers:
        # Get the text content
        text = wrapper.get_text(strip=True)
        
        # Check if this wrapper contains a date
        match = date_pattern.search(text)
        if match:
            day_of_week, month_name, day, year = match.groups()
            date_text = match.group(0)  # Full match like "Tue, Nov 4, 2025"
            
            # Parse the date
            parsed_date = parse_meeting_date(date_text)
            if not parsed_date or parsed_date[0] != target_year:
                continue
            
            # Find the clickable parent container (cp-formatField--stacked)
            # This is the element we need to click
            parent = wrapper.parent
            clickable_container = None
            
            # Walk up the tree to find cp-formatField--stacked
            for _ in range(5):
                if parent and 'cp-formatField' in str(parent.get('class', [])):
                    clickable_container = parent
                    break
                if parent:
                    parent = parent.parent
                else:
                    break
            
            # Create XPath selector to find this date element
            # We'll use the date text to find it uniquely
            date_selector = f"//div[contains(@class, 'cp-fieldWrapper') and contains(text(), '{date_text}')]"
            
            # Extract meeting title from surrounding elements
            meeting_title = date_text
            # Look for "City Council" in nearby field wrappers
            if clickable_container:
                all_wrappers = clickable_container.find_all('div', class_='cp-fieldWrapper')
                for w in all_wrappers:
                    wrapper_text = w.get_text(strip=True)
                    if 'City Council' in wrapper_text or 'Regular Meeting' in wrapper_text or 'Strategic' in wrapper_text:
                        meeting_title = date_text + " " + wrapper_text
                        break
            
            meetings.append({
                'date_text': date_text,
                'parsed_date': parsed_date,
                'meeting_title': meeting_title
            })
    
    return meetings


def click_date_and_get_minutes(driver, date_text: str, base_url: str) -> Optional[str]:
    """
    Find and click a date element by text, navigate to detail page, then find Minutes link.
    We find the element fresh each time rather than using a stored selector.
    
    Args:
        driver: Selenium WebDriver instance
        date_text: The date text to find (e.g., "Tue, Nov 4, 2025")
        base_url: Base URL for constructing relative URLs
    
    Returns:
        URL to the Minutes PDF, or None if not found
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    
    try:
        # Wait a moment for page to be ready
        time.sleep(1)
        
        # Find the date element by text content (more reliable than XPath with classes)
        date_elem = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, f"//div[contains(@class, 'cp-fieldWrapper') and normalize-space(text())='{date_text}']"))
        )
        
        # Find the parent cp-formatField container - walk up the DOM
        parent = date_elem
        clickable_container = None
        for _ in range(5):
            try:
                parent = parent.find_element(By.XPATH, "./..")
                classes = parent.get_attribute('class') or ''
                if 'cp-formatField' in classes:
                    clickable_container = parent
                    break
            except:
                break
        
        if not clickable_container:
            # Fallback: just click the parent of the date element
            try:
                clickable_container = date_elem.find_element(By.XPATH, "./..")
            except:
                clickable_container = date_elem
        
        # Click using JavaScript (more reliable)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", clickable_container)
        time.sleep(0.5)
        
        # Store current URL to verify navigation
        current_url_before = driver.current_url
        
        driver.execute_script("arguments[0].click();", clickable_container)
        time.sleep(4)  # Wait for navigation
        
        # Verify URL changed (or check if overlay/modal opened)
        current_url_after = driver.current_url
        if current_url_before == current_url_after:
            # URL didn't change - might be an overlay/modal, wait a bit more
            time.sleep(2)
        
        # Find Minutes link on detail page
        # Look for link with text like "Minutes for 10-7-2025" or just "Minutes"
        minutes_url = None
        try:
            # First try to find link with specific date pattern in text
            # Extract date parts from date_text for matching
            date_parts = date_text.split(',')
            if len(date_parts) >= 2:
                month_day = date_parts[1].strip()  # e.g., "Nov 4"
                # Try to find link containing both "Minutes" and the date
                minutes_link = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, f"//a[contains(text(), 'Minutes') and (contains(text(), '{month_day}') or contains(@title, 'Minutes'))]"))
                )
                minutes_url = minutes_link.get_attribute('href')
            else:
                # Fallback: just find first Minutes link
                minutes_link = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//a[contains(text(), 'Minutes')]"))
                )
                minutes_url = minutes_link.get_attribute('href')
        except:
            # Final fallback: try any link with "Minutes" in text or title
            try:
                minutes_links = driver.find_elements(By.XPATH, "//a[contains(text(), 'Minutes') or contains(@title, 'Minutes')]")
                if minutes_links:
                    minutes_url = minutes_links[0].get_attribute('href')
            except:
                pass
        
        if minutes_url:
            # Construct full URL if relative
            if minutes_url.startswith('/'):
                minutes_url = urljoin(base_url, minutes_url)
            elif not minutes_url.startswith('http'):
                minutes_url = urljoin(base_url, minutes_url)
            return minutes_url
        else:
            return None
        
    except Exception as e:
        print(f"  Error: {str(e)[:100]}", file=sys.stderr)
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
        
        # Always save file to disk if it doesn't exist (even if duplicate in DB)
        date_str = f"{month:02d}-{day:02d}-{year}"
        filename = f"{city_name}_{date_str}_Minutes.pdf"
        
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
        description="Download meeting minutes from CivicPlus pages"
    )
    parser.add_argument("--config", required=True, help="Path to YAML config")
    parser.add_argument("--dry-run", action="store_true", help="Parse page but don't download")
    parser.add_argument("--outdir", help="Override output directory (relative to backend/)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of PDFs to download (for testing)")
    args = parser.parse_args()
    
    # Load config
    backend_dir = Path(__file__).resolve().parent.parent
    cfg_path = Path(args.config)
    if not cfg_path.is_absolute():
        cfg_path = backend_dir / ("configs/" + cfg_path.name if "/" not in args.config else args.config)
    config = read_yaml(cfg_path)
    
    page_url = config["page_url"]
    city_name = config["city_name"]
    target_year = int(config.get("target_year", 2025))
    allowed_domains = config.get("allowed_domains", [])
    
    # Determine output directory
    output_base = Path(args.outdir) if args.outdir else backend_dir / config.get("output_dir", "data/raw notes")
    
    # Initialize DB if missing
    db_path = backend_dir / "data" / "civicpulse.db"
    if not db_path.exists():
        init_db()
    
    source_id = config.get("id", "hutchinson_civicplus")
    
    # Setup Selenium
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
    
    driver = None
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.get(page_url)
        
        # Wait for page to load
        time.sleep(3)
        
        # Wait for page to load and click the 2025 tab
        # Find all tabs and click the first one (which should be 2025)
        try:
            tabs = WebDriverWait(driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "li.tabbedWidget--tab"))
            )
            if tabs:
                # Click the first tab (2025) using JavaScript
                driver.execute_script("arguments[0].scrollIntoView(true);", tabs[0])
                time.sleep(0.5)
                driver.execute_script("arguments[0].click();", tabs[0])
                print("Clicked 2025 tab", file=sys.stderr)
                time.sleep(5)  # Wait for tab content to load via AJAX
        except Exception as e:
            print(f"Warning: Could not click tab: {e}", file=sys.stderr)
        
        # Wait for meeting content to appear
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Nov') or contains(text(), 'October')]"))
            )
            print("Meeting content loaded", file=sys.stderr)
        except:
            print("Warning: Meeting content may not have loaded", file=sys.stderr)
        
        # Get the HTML of the active tab panel
        html = driver.page_source
        
        # Extract meeting date links from the 2025 tab
        meetings = extract_meeting_date_links(html, target_year, page_url)
        
        # Filter to only 2025 meetings (double-check)
        meetings_2025 = [m for m in meetings if m.get('parsed_date') and m['parsed_date'][0] == target_year]
        
        print(f"Found {len(meetings_2025)} meetings for year {target_year}", file=sys.stderr)
        
        if args.dry_run:
            print("\n=== DRY RUN - Meetings found ===", file=sys.stderr)
            for meeting in meetings_2025:
                print(f"Date: {meeting['date_text']} (parsed: {meeting['parsed_date']})", file=sys.stderr)
            print(json.dumps({"meetings_found": len(meetings_2025)}))
            return
        
        # Download minutes PDFs by navigating to each meeting detail page
        results = {
            "downloads": [],
            "attempted": 0,
            "saved": 0,
            "duplicates": 0,
            "errors": 0
        }
        
        for meeting in meetings_2025:
            parsed_date = meeting['parsed_date']
            if not parsed_date:
                print(f"Warning: Could not parse date: {meeting['date_text']}", file=sys.stderr)
                continue
            
            year, month, day = parsed_date
            
            results["attempted"] += 1
            print(f"Processing {meeting['date_text']}...", file=sys.stderr)
            
            try:
                # Click on the date element to navigate to meeting detail page and find minutes link
                minutes_url = click_date_and_get_minutes(driver, meeting['date_text'], page_url)
                
                if not minutes_url:
                    print(f"  Warning: No minutes link found for {meeting['date_text']}", file=sys.stderr)
                    results["errors"] += 1
                    # Navigate back to main page and reload
                    driver.get(page_url)
                    time.sleep(3)
                    tabs = driver.find_elements(By.CSS_SELECTOR, "li.tabbedWidget--tab")
                    if tabs:
                        driver.execute_script("arguments[0].click();", tabs[0])
                        time.sleep(5)  # Wait longer for AJAX content to load
                    # Wait for content to be ready
                    WebDriverWait(driver, 15).until(
                        EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'cp-fieldWrapper')]"))
                    )
                    continue
                
                print(f"  Found minutes URL: {minutes_url}", file=sys.stderr)
                
                # Download the PDF
                result = download_and_save(
                    url=minutes_url,
                    source_id=source_id,
                    city_name=city_name,
                    year=year,
                    month=month,
                    day=day,
                    output_base=output_base,
                    allowed_domains=allowed_domains
                )
                
                results["downloads"].append(result)
                
                if result["status"] == "created":
                    results["saved"] += 1
                    print(f"  ✓ Downloaded: {result.get('saved_path', 'N/A')}", file=sys.stderr)
                elif result["status"] == "duplicate":
                    results["duplicates"] += 1
                    print(f"  ⊘ Duplicate: {result.get('saved_path', 'N/A')}", file=sys.stderr)
                else:
                    results["errors"] += 1
                    print(f"  ✗ Error: {result.get('reason', 'Unknown error')}", file=sys.stderr)
                
                # Check if we've hit the limit
                if args.limit and (results["saved"] + results["duplicates"]) >= args.limit:
                    print(f"Reached limit of {args.limit} downloads", file=sys.stderr)
                    break
                
                # Navigate back to main page and reload
                driver.get(page_url)
                time.sleep(3)
                tabs = driver.find_elements(By.CSS_SELECTOR, "li.tabbedWidget--tab")
                if tabs:
                    driver.execute_script("arguments[0].click();", tabs[0])
                    time.sleep(5)  # Wait longer for AJAX content to load
                # Wait for content to be ready
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'cp-fieldWrapper')]"))
                )
                
            except Exception as e:
                results["errors"] += 1
                results["downloads"].append({"status": "error", "reason": str(e), "url": meeting.get('meeting_url', 'N/A')})
                print(f"  ✗ Exception: {e}", file=sys.stderr)
                # Try to navigate back to main page on error
                try:
                    driver.get(page_url)
                    time.sleep(3)
                    tabs = driver.find_elements(By.CSS_SELECTOR, "li.tabbedWidget--tab")
                    if tabs:
                        driver.execute_script("arguments[0].click();", tabs[0])
                        time.sleep(5)
                    WebDriverWait(driver, 15).until(
                        EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'cp-fieldWrapper')]"))
                    )
                except:
                    pass
            
            time.sleep(1.0)  # Be polite
        
        print(f"\nSummary: {results['saved']} saved, {results['duplicates']} duplicates, {results['errors']} errors", file=sys.stderr)
        print(json.dumps(results))
        
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    main()

