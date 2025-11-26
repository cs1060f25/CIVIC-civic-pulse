"""
Test to detect the Kansas City Legistar scraper bug.

This test verifies that the scraper finds all available meetings with minutes,
and detects when meetings are being missed due to filtering or pagination issues.
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

# Register custom marks to avoid warnings
pytest_plugins = []
import yaml
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Import the extraction function
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "civicpulse" / "src"))
from ingestion.legistar_scraper import extract_meeting_rows


def count_all_minutes_links(html: str) -> int:
    """
    Count all minutes links in the HTML, regardless of meeting name or filter.
    This gives us the ground truth of how many meetings with minutes exist.
    """
    soup = BeautifulSoup(html, 'lxml')
    minutes_links = soup.find_all('a', href=lambda x: x and 'View.ashx?M=M' in x)
    return len(minutes_links)


def count_minutes_links_for_year(html: str, target_year: int) -> int:
    """
    Count minutes links for meetings in a specific year by parsing dates.
    """
    soup = BeautifulSoup(html, 'lxml')
    minutes_links = soup.find_all('a', href=lambda x: x and 'View.ashx?M=M' in x)
    
    count = 0
    for link in minutes_links:
        # Find the parent row
        row = link.find_parent('tr')
        if not row:
            continue
        
        # Try to find date in the row
        cells = row.find_all(['td', 'th'])
        for cell in cells:
            text = cell.get_text(strip=True)
            # Look for date pattern M/D/YYYY
            import re
            match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
            if match:
                year = int(match.group(3))
                if year == target_year:
                    count += 1
                break
    
    return count


@pytest.mark.integration
def test_kansas_city_finds_all_meetings_with_minutes():
    """
    Test that detects the bug: scraper should find all meetings with minutes,
    not just those matching the filter.
    
    This test will FAIL if the bug exists (scraper finds fewer meetings than available).
    """
    # Load the Kansas City config
    config_path = Path(__file__).parent.parent.parent / "civicpulse" / "src" / "ingestion" / "configs" / "kansas_city_mo_legistar.yaml"
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    # For this test, we'll use a mock HTML or fetch real HTML
    # Since this is an integration test, we'll need Selenium or requests
    # For now, we'll create a test that can work with either
    
    # Check if we have the required dependencies
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        import time
        SELENIUM_AVAILABLE = True
    except ImportError:
        SELENIUM_AVAILABLE = False
        pytest.skip("Selenium not available for integration test")
    
    if not SELENIUM_AVAILABLE:
        pytest.skip("Selenium required for this integration test")
    
    # Fetch the actual page
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    try:
        page_url = config['page_url']
        driver.get(page_url)
        time.sleep(5)
        
        # Wait for table to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, 'table'))
        )
        time.sleep(2)
        
        html = driver.page_source
        base_url = f"{page_url.split('/')[0]}//{page_url.split('/')[2]}"
        
        # Count ALL minutes links on the page (ground truth)
        total_minutes_links = count_all_minutes_links(html)
        
        # Count minutes links for target year
        target_year = config.get('target_year', 2025)
        minutes_links_for_year = count_minutes_links_for_year(html, target_year)
        
        # Extract meetings using the scraper's extraction function
        extracted_meetings = extract_meeting_rows(html, config, base_url)
        
        # Filter to target year
        meetings_for_year = [m for m in extracted_meetings 
                           if m.get('parsed_date') and m['parsed_date'][0] == target_year]
        
        print(f"\n=== TEST RESULTS ===")
        print(f"Total minutes links on page: {total_minutes_links}")
        print(f"Minutes links for {target_year}: {minutes_links_for_year}")
        print(f"Meetings extracted (after filter): {len(extracted_meetings)}")
        print(f"Meetings for {target_year} (after filter): {len(meetings_for_year)}")
        
        # The bug: if we have a meeting_filter, we might be missing meetings
        meeting_filter = config.get('meeting_filter', [])
        if meeting_filter:
            print(f"Meeting filter active: {meeting_filter}")
            print(f"WARNING: Filter may be excluding {total_minutes_links - len(extracted_meetings)} meetings")
        
        # Assertion: We should find at least as many meetings as there are minutes links for the target year
        # (accounting for the filter)
        # If the filter is too restrictive, this will fail
        assert len(meetings_for_year) <= minutes_links_for_year, \
            f"Extracted more meetings ({len(meetings_for_year)}) than minutes links exist ({minutes_links_for_year}) - this shouldn't happen"
        
        # The actual bug detection: if filter is active and we're missing meetings
        if meeting_filter and len(meetings_for_year) < minutes_links_for_year:
            missing_count = minutes_links_for_year - len(meetings_for_year)
            pytest.fail(
                f"BUG DETECTED: Scraper is missing {missing_count} meeting(s) with minutes due to filter. "
                f"Found {len(meetings_for_year)} meetings but {minutes_links_for_year} meetings with minutes exist for {target_year}. "
                f"Filter '{meeting_filter}' is too restrictive."
            )
        
    finally:
        driver.quit()


@pytest.mark.integration
def test_kansas_city_pagination_detection():
    """
    Test that detects pagination issues - verifies that pagination controls are detected
    and that all pages are being processed.
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        import time
        SELENIUM_AVAILABLE = True
    except ImportError:
        SELENIUM_AVAILABLE = False
        pytest.skip("Selenium not available for integration test")
    
    # Load config
    config_path = Path(__file__).parent.parent.parent / "civicpulse" / "src" / "ingestion" / "configs" / "kansas_city_mo_legistar.yaml"
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    try:
        page_url = config['page_url']
        driver.get(page_url)
        time.sleep(5)
        
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, 'table'))
        )
        time.sleep(2)
        
        # Check for pagination controls
        # Look for numbered page links (what the scraper currently looks for)
        numbered_links = driver.find_elements(By.XPATH,
            '//div[contains(@class, "RadGrid")]//a[contains(@href, "__doPostBack") and contains(@href, "Page$")]')
        
        # Look for Next button (what the scraper should also check)
        next_buttons = driver.find_elements(By.CSS_SELECTOR, '.rcNext, a.rcNext, [class*="rcNext"]')
        
        # Look for page size dropdown
        page_size_selects = driver.find_elements(By.CSS_SELECTOR,
            'select[class*="rgPager"], select[id*="PageSize"], select[title*="Page size"]')
        
        print(f"\n=== PAGINATION DETECTION TEST ===")
        print(f"Numbered page links found: {len(numbered_links)}")
        print(f"Next buttons found: {len(next_buttons)}")
        print(f"Page size dropdowns found: {len(page_size_selects)}")
        
        # Count meetings on first page
        html_page1 = driver.page_source
        minutes_links_page1 = count_all_minutes_links(html_page1)
        print(f"Minutes links on page 1: {minutes_links_page1}")
        
        # Try to click Next if available
        if next_buttons:
            next_button = next_buttons[0]
            is_enabled = next_button.is_enabled()
            is_displayed = next_button.is_displayed()
            print(f"Next button enabled: {is_enabled}, displayed: {is_displayed}")
            
            if is_enabled and is_displayed:
                # Click Next
                driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                time.sleep(1)
                next_button.click()
                time.sleep(5)
                
                # Count meetings on page 2
                html_page2 = driver.page_source
                minutes_links_page2 = count_all_minutes_links(html_page2)
                print(f"Minutes links on page 2: {minutes_links_page2}")
                
                if minutes_links_page2 > 0:
                    pytest.fail(
                        f"BUG DETECTED: Pagination exists but scraper doesn't handle it. "
                        f"Found {minutes_links_page2} additional meetings on page 2, but scraper only processes page 1. "
                        f"Scraper needs to support Next button pagination (class 'rcNext')."
                    )
        
        # If no pagination found but we suspect there should be more
        if len(numbered_links) == 0 and len(next_buttons) == 0:
            # Check if there's a "records" indicator suggesting pagination
            records_text = driver.find_elements(By.XPATH, '//*[contains(text(), "records")]')
            if records_text:
                print(f"Found 'records' indicator: {records_text[0].text}")
                # This might indicate pagination exists but isn't being detected
        
    finally:
        driver.quit()

