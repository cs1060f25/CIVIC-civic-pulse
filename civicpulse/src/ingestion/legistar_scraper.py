#!/usr/bin/env python3
"""
Scraper for Legistar meeting calendars (supports multiple cities: Kansas City MO, Olathe KS).

Flow:
1) Load the Legistar calendar page
2) Parse the "All Meetings" table
3) Extract meeting rows, filtering for specific meeting types if configured
4) Extract Minutes column links (View.ashx?M=M&ID=...&GUID=...)
5) Download PDFs and persist via local_db.save_if_new(), writing files to
   backend/data/raw notes/<City>/<filename>.pdf

Usage (run from backend/):
  python ingestion/legistar_scraper.py --config configs/kansas_city_mo_legistar.yaml
  python ingestion/legistar_scraper.py --config configs/olathe_legistar.yaml
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


def parse_legistar_date(date_text: str) -> Optional[Tuple[int, int, int]]:
    """
    Parse date from Legistar format (e.g., "11/6/2025", "1/7/2025").
    
    Returns:
        Tuple of (year, month, day) as integers, or None if parsing fails
    """
    date_text = date_text.strip()
    
    # Try M/D/YYYY or MM/DD/YYYY format
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_text)
    if match:
        month, day, year = map(int, match.groups())
        try:
            # Validate date
            datetime(year, month, day)
            return (year, month, day)
        except ValueError:
            return None
    
    return None


def extract_meeting_rows(html: str, config: dict, base_url: str) -> list:
    """
    Extract meeting rows from Legistar HTML table.
    
    Returns:
        List of dictionaries, each containing:
        - name: Meeting name
        - date_text: Raw date text
        - parsed_date: Tuple (year, month, day) or None
        - minutes_url: URL to minutes PDF (or None)
    """
    soup = BeautifulSoup(html, 'lxml')
    
    # Find table with Minutes links
    minutes_links = soup.find_all('a', href=lambda x: x and 'View.ashx?M=M' in x)
    if not minutes_links:
        return []
    
    # Get parent table
    table = minutes_links[0].find_parent('table')
    if not table:
        return []
    
    rows = table.find_all('tr')
    if len(rows) < 2:
        return []
    
    # Parse header row to find column indices
    header_row = rows[0]
    headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
    
    # Find column indices (handle different header formats)
    name_idx = None
    date_idx = None
    minutes_idx = None
    
    for i, header in enumerate(headers):
        if 'Name' in header:
            name_idx = i
        if 'Meeting Date' in header or ('Date' in header and 'Meeting' not in header):
            date_idx = i
        if 'Minutes' in header:
            minutes_idx = i
    
    # Fallback: assume standard positions if not found
    # For Olathe, Date is first column (index 0), no Name column
    if date_idx is None:
        # Check if first column looks like a date
        if len(rows) > 1:
            first_data_cell = rows[1].find_all(['td', 'th'])[0].get_text(strip=True)
            if re.match(r'\d{1,2}/\d{1,2}/\d{4}', first_data_cell):
                date_idx = 0
            else:
                date_idx = 1
        else:
            date_idx = 1
    
    if name_idx is None:
        # If no Name column, use date as name (for Olathe-style pages)
        name_idx = date_idx
    
    if minutes_idx is None:
        minutes_idx = 8  # Default for most Legistar sites
    
    # Filter for meeting types if specified
    meeting_filter = config.get('meeting_filter', [])
    if isinstance(meeting_filter, str):
        meeting_filter = [meeting_filter]
    
    meetings = []
    
    # Process data rows
    for row in rows[1:]:
        cells = row.find_all(['td', 'th'])
        if len(cells) <= max(name_idx, date_idx, minutes_idx):
            continue
        
        # Extract meeting name
        name = cells[name_idx].get_text(strip=True) if name_idx < len(cells) else ""
        
        # If name is just a date (Olathe-style), use a default name
        if re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', name):
            name = config.get('default_meeting_name', 'City Council')
        
        # Apply filter if specified
        if meeting_filter:
            if not any(filter_term.lower() in name.lower() for filter_term in meeting_filter):
                continue
        
        # Extract date
        date_text = cells[date_idx].get_text(strip=True) if date_idx < len(cells) else ""
        parsed_date = parse_legistar_date(date_text)
        
        # Extract minutes link
        minutes_url = None
        minutes_cell = cells[minutes_idx] if minutes_idx < len(cells) else None
        if minutes_cell:
            minutes_link = minutes_cell.find('a', href=lambda x: x and 'View.ashx?M=M' in x)
            if minutes_link:
                href = minutes_link.get('href', '')
                minutes_url = urljoin(base_url, href)
        
        # Only include if we have a minutes URL
        if minutes_url:
            meetings.append({
                'name': name,
                'date_text': date_text,
                'parsed_date': parsed_date,
                'minutes_url': minutes_url
            })
    
    return meetings


def download_and_save(
    url: str,
    source_id: str,
    city_name: str,
    year: int,
    month: int,
    day: int,
    meeting_name: str,
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
        date_str = f"{month:02d}-{day:02d}-{year}"
        # Sanitize meeting name for filename
        safe_name = "".join(ch for ch in meeting_name if ch.isalnum() or ch in (" ", "_", "-", ".")).rstrip()
        safe_name = safe_name.replace(" ", "_")[:50]  # Limit length
        filename = f"{city_name}_{date_str}_{safe_name}_Minutes.pdf"
        
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
        description="Download meeting minutes from Legistar calendar pages"
    )
    parser.add_argument("--config", required=True, help="Path to config YAML")
    parser.add_argument("--outdir", help="Base output directory (overrides config)")
    parser.add_argument("--dry-run", action="store_true", help="Parse page but don't download")
    
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
    page_url = config["page_url"]
    city_name = config["city_name"]
    source_id = config.get("id", f"{city_name.lower().replace(' ', '_')}_legistar")
    allowed_domains = config.get("allowed_domains", [])
    base_url = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"
    
    print(f"Fetching: {page_url}", file=sys.stderr)
    
    # Fetch page - Legistar uses JavaScript pagination, so we need Selenium for full rendering
    use_selenium = config.get('use_selenium', True)
    
    try:
        if use_selenium:
            # Use Selenium to handle JavaScript-rendered content
            try:
                from selenium import webdriver
                from selenium.webdriver.common.by import By
                from selenium.webdriver.support.ui import WebDriverWait
                from selenium.webdriver.support import expected_conditions as EC
                from selenium.webdriver.chrome.options import Options
                from selenium.webdriver.support.ui import Select
            except ImportError:
                print("Warning: Selenium not installed. Install with: pip install selenium", file=sys.stderr)
                print("Falling back to requests (may miss paginated content)...", file=sys.stderr)
                use_selenium = False
        
        if use_selenium:
            # Set up Chrome in headless mode
            chrome_options = Options()
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
            
            driver = webdriver.Chrome(options=chrome_options)
            try:
                print("Loading page with Selenium (this may take a moment)...", file=sys.stderr)
                driver.get(page_url)
                
                # Wait for table to load
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.TAG_NAME, "table"))
                )
                time.sleep(2)  # Give it extra time to fully render
                
                # Step 1: Set filters (year and committee) before scraping
                try:
                    # Set year dropdown to target year
                    target_year = config.get('target_year')
                    if target_year:
                        year_combo_id = "ctl00_ContentPlaceHolder1_lstYears"
                        year_combo = WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.ID, year_combo_id))
                        )
                        # Click to open dropdown
                        driver.execute_script("arguments[0].click();", year_combo)
                        time.sleep(1)
                        # Find and click the year option
                        year_option = driver.find_element(By.XPATH, f"//li[contains(@class, 'rcbItem') and text()='{target_year}']")
                        driver.execute_script("arguments[0].click();", year_option)
                        print(f"Set year filter to {target_year}", file=sys.stderr)
                        time.sleep(3)  # Wait for table to update
                    
                    # Set committee dropdown based on meeting_filter
                    meeting_filter = config.get('meeting_filter', [])
                    if isinstance(meeting_filter, str):
                        meeting_filter = [meeting_filter]
                    # If meeting_filter is specified, try to select it from the dropdown
                    if meeting_filter:
                        # Use the first filter term (e.g., "Council" or "City Council")
                        filter_term = meeting_filter[0]
                        # Click the arrow anchor to open dropdown
                        arrow_id = "ctl00_ContentPlaceHolder1_lstBodies_Arrow"
                        arrow_button = WebDriverWait(driver, 10).until(
                            EC.element_to_be_clickable((By.ID, arrow_id))
                        )
                        driver.execute_script("arguments[0].click();", arrow_button)
                        
                        # Wait for dropdown panel to appear
                        dropdown_panel = WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.ID, "ctl00_ContentPlaceHolder1_lstBodies_DropDown"))
                        )
                        time.sleep(1)  # Brief wait for options to render
                        
                        # Find all option elements (li.rcbItem or elements with role="option")
                        all_options = dropdown_panel.find_elements(By.CSS_SELECTOR, "li.rcbItem, [role='option']")
                        
                        # Find the option with exact text matching the filter term
                        selected_option = None
                        for option in all_options:
                            option_text = option.text.strip()
                            if option_text == filter_term:
                                selected_option = option
                                break
                        
                        if selected_option:
                            driver.execute_script("arguments[0].click();", selected_option)
                            time.sleep(2)  # Wait for selection to register
                            
                            # Verify the input field now has the correct value
                            input_id = "ctl00_ContentPlaceHolder1_lstBodies_Input"
                            input_field = driver.find_element(By.ID, input_id)
                            input_value = input_field.get_attribute("value")
                            
                            if input_value == filter_term:
                                print(f"Set committee filter to {filter_term} (verified)", file=sys.stderr)
                                time.sleep(3)  # Wait for table to update via AJAX
                            else:
                                print(f"Warning: Committee filter may not have worked. Input value is '{input_value}', expected '{filter_term}'", file=sys.stderr)
                        else:
                            print(f"Warning: Could not find '{filter_term}' option in committee dropdown", file=sys.stderr)
                except Exception as e:
                    print(f"Warning: Could not set filters: {e}", file=sys.stderr)
                    # Continue anyway - might work without filters
                
                # Step 2: Try to increase page size or show all records (don't use year filter dropdown)
                try:
                    # Look for page size dropdown in RadGrid footer
                    page_size_selects = driver.find_elements(By.CSS_SELECTOR,
                        'select[class*="rgPager"], select[id*="PageSize"], select[title*="Page size"]')
                    if page_size_selects:
                        from selenium.webdriver.support.ui import Select
                        select = Select(page_size_selects[0])
                        options = [opt.text for opt in select.options]
                        # Try to select largest option or "All"
                        if 'All' in options:
                            select.select_by_visible_text('All')
                            print("Set page size to 'All'", file=sys.stderr)
                        elif '100' in options:
                            select.select_by_value('100')
                            print("Set page size to 100", file=sys.stderr)
                        elif '50' in options:
                            select.select_by_value('50')
                            print("Set page size to 50", file=sys.stderr)
                        time.sleep(3)  # Wait for table to reload
                except Exception as e:
                    print(f"Could not change page size: {e}", file=sys.stderr)
                
                # Step 2: Collect all meetings by paginating through pages
                # We'll extract ALL meetings and filter by date column later
                all_meetings = []
                page_count = 0
                max_pages = 50  # Safety limit
                target_year = config.get('target_year')
                
                while page_count < max_pages:
                    # Extract ALL meetings from current page (no year filtering yet)
                    current_html = driver.page_source
                    current_meetings = extract_meeting_rows(current_html, config, base_url)
                    
                    all_meetings.extend(current_meetings)
                    print(f"Page {page_count + 1}: Found {len(current_meetings)} total meetings with minutes (total so far: {len(all_meetings)})", file=sys.stderr)
                    
                    # Look for numbered page links (1, 2, 3, 4, etc.) instead of Next button
                    try:
                        # Find all pagination links - look for numbered links in the RadGrid
                        # These are typically in a tfoot or pager area
                        all_pager_links = driver.find_elements(By.XPATH,
                            '//div[contains(@class, "RadGrid")]//a[contains(@href, "__doPostBack") and contains(@href, "Page$")]')
                        
                        # Filter to get numbered page links (not ">" or "Next")
                        numbered_links = []
                        for link in all_pager_links:
                            link_text = link.text.strip()
                            # Check if it's a number (page number)
                            try:
                                page_num = int(link_text)
                                numbered_links.append((page_num, link))
                            except ValueError:
                                # Not a number, skip
                                pass
                        
                        # Sort by page number
                        numbered_links.sort(key=lambda x: x[0])
                        
                        if numbered_links:
                            # Find the next page number to click
                            next_page_num = page_count + 2  # We're on page_count + 1, so next is page_count + 2
                            
                            # Find the link for that page number
                            next_link = None
                            for page_num, link in numbered_links:
                                if page_num == next_page_num:
                                    next_link = link
                                    break
                            
                            if next_link:
                                print(f"Clicking page {next_page_num}...", file=sys.stderr)
                                driver.execute_script("arguments[0].scrollIntoView(true);", next_link)
                                time.sleep(0.5)
                                next_link.click()
                                time.sleep(4)  # Wait for AJAX update
                                page_count += 1
                            else:
                                print(f"Reached last page at page {page_count + 1} (no page {next_page_num} found)", file=sys.stderr)
                                break
                        else:
                            print(f"No numbered pagination found, using single page", file=sys.stderr)
                            break
                    except Exception as e:
                        print(f"Error during pagination (may have reached end): {e}", file=sys.stderr)
                        break
                
                html = driver.page_source
                
                # Filter to target year by checking the date column
                if target_year:
                    filtered_meetings = []
                    for m in all_meetings:
                        parsed_date = m.get('parsed_date')
                        if parsed_date and parsed_date[0] == target_year:
                            filtered_meetings.append(m)
                    all_meetings = filtered_meetings
                    print(f"Total meetings collected: {len(all_meetings)} (filtered to {target_year} by date column)", file=sys.stderr)
                else:
                    print(f"Total meetings collected across all pages: {len(all_meetings)}", file=sys.stderr)
                
            finally:
                driver.quit()
        else:
            # Fallback to requests (limited to first page)
            session = requests.Session()
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            })
            resp = session.get(page_url, timeout=30)
            resp.raise_for_status()
            html = resp.text
            print("Warning: Using requests (no Selenium). May only get first page of results.", file=sys.stderr)
        
    except Exception as e:
        print(json.dumps({"error": f"Failed to fetch page: {e}"}))
        sys.exit(1)
    
    # Extract meeting rows
    # If we collected meetings during pagination, use those; otherwise extract from HTML
    if 'all_meetings' in locals() and all_meetings:
        meetings = all_meetings
        # Remove duplicates based on meeting URL
        seen_urls = set()
        unique_meetings = []
        for m in meetings:
            url = m.get('minutes_url', '')
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_meetings.append(m)
        meetings = unique_meetings
    else:
        meetings = extract_meeting_rows(html, config, base_url)
        # Filter to target year if specified
        target_year = config.get('target_year')
        if target_year:
            meetings = [m for m in meetings 
                       if m.get('parsed_date') and m['parsed_date'][0] == target_year]
    
    print(f"Found {len(meetings)} meetings with minutes for year {config.get('target_year', 'all years')}", file=sys.stderr)
    
    # Results summary
    results = {
        "total_meetings": len(meetings),
        "minutes_downloaded": 0,
        "minutes_duplicates": 0,
        "minutes_errors": 0,
        "downloads": []
    }
    
    if args.dry_run:
        print("\n=== DRY RUN - Meetings found ===", file=sys.stderr)
        for meeting in meetings:
            print(f"Date: {meeting['date_text']} (parsed: {meeting['parsed_date']})", file=sys.stderr)
            print(f"  Name: {meeting['name']}", file=sys.stderr)
            print(f"  Minutes: {meeting['minutes_url']}", file=sys.stderr)
        print(json.dumps(results))
        return
    
    # Download PDFs
    for meeting in meetings:
        parsed_date = meeting['parsed_date']
        if not parsed_date:
            print(f"Skipping {meeting['name']} - could not parse date: {meeting['date_text']}", file=sys.stderr)
            continue
        
        year, month, day = parsed_date
        print(f"Downloading minutes for {meeting['name']} ({meeting['date_text']})...", file=sys.stderr)
        
        minutes_result = download_and_save(
            meeting['minutes_url'],
            source_id,
            city_name,
            year, month, day,
            meeting['name'],
            output_base,
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
        
        time.sleep(1.0)  # Be polite
    
    # Print summary
    print(f"\n=== Summary ===", file=sys.stderr)
    print(f"Minutes: {results['minutes_downloaded']} downloaded, {results['minutes_duplicates']} duplicates, {results['minutes_errors']} errors", file=sys.stderr)
    
    # Output JSON results
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

