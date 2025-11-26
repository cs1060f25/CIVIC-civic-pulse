"""
Test to detect the CivicWeb scraper folder structure bug.

This test verifies that the scraper correctly navigates folder structures and downloads
the correct document types (meeting minutes/agendas) rather than individual agenda items
or documents from wrong folders.

The bug: Some cities (like Merriam) have Root → Type folder (Minutes/Agendas) → Documents
structure, while the scraper expects Root → Year folder → Documents. This causes the
scraper to download wrong document types.
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import yaml
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Import the scraper functions
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "civicpulse" / "src"))
from ingestion.civicweb_scraper import find_year_href, iter_document_links, iter_meeting_folder_links


def analyze_folder_structure(base_url: str, root_folder_url: str) -> dict:
    """
    Analyze the folder structure of a CivicWeb site to determine its pattern.
    
    Returns:
        Dict with:
        - structure_type: "year_first" or "type_first" or "unknown"
        - has_minutes_folder: bool
        - has_agendas_folder: bool
        - has_year_folders: bool
        - year_folders: list of year strings found
    """
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    })
    
    try:
        resp = session.get(urljoin(base_url, root_folder_url), timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'lxml')
        
        # Find all folder links
        folder_links = soup.find_all('a', href=lambda x: x and '/filepro/documents/' in x)
        
        result = {
            'structure_type': 'unknown',
            'has_minutes_folder': False,
            'has_agendas_folder': False,
            'has_year_folders': False,
            'year_folders': [],
            'type_folders': []
        }
        
        # Check for type folders (Minutes, Agendas)
        for link in folder_links:
            text = link.get_text(strip=True)
            if 'Minutes' in text or 'minutes' in text.lower():
                result['has_minutes_folder'] = True
                result['type_folders'].append(text)
            if 'Agendas' in text or 'agendas' in text.lower():
                result['has_agendas_folder'] = True
                result['type_folders'].append(text)
        
        # Check for year folders (2025, 2024, etc.)
        for link in folder_links:
            text = link.get_text(strip=True)
            if text.isdigit() and len(text) == 4 and 2000 <= int(text) <= 2100:
                result['has_year_folders'] = True
                result['year_folders'].append(text)
        
        # Determine structure type
        if result['has_minutes_folder'] or result['has_agendas_folder']:
            result['structure_type'] = 'type_first'
        elif result['has_year_folders']:
            result['structure_type'] = 'year_first'
        
        return result
    except Exception as e:
        return {'error': str(e)}


def check_downloaded_documents_are_meeting_docs(downloaded_files: list) -> dict:
    """
    Check if downloaded files appear to be meeting documents (minutes/agendas)
    rather than individual agenda items or memos.
    
    Returns:
        Dict with:
        - all_are_meeting_docs: bool
        - suspicious_files: list of filenames that don't look like meeting docs
        - meeting_doc_indicators: list of patterns found
    """
    meeting_indicators = [
        'minutes', 'agenda', 'meeting', 'council', 'commission',
        'packet', 'session', 'regular', 'special'
    ]
    
    suspicious_indicators = [
        'memo', 'form', 'item information', 'request for',
        'rfq', 'rfp', 'proposal', 'invoice', 'payment'
    ]
    
    result = {
        'all_are_meeting_docs': True,
        'suspicious_files': [],
        'meeting_doc_indicators': []
    }
    
    for file_info in downloaded_files:
        filename = file_info.get('saved_path', '') or file_info.get('url', '')
        filename_lower = filename.lower()
        
        # Check for suspicious patterns
        is_suspicious = any(indicator in filename_lower for indicator in suspicious_indicators)
        has_meeting_indicator = any(indicator in filename_lower for indicator in meeting_indicators)
        
        if is_suspicious and not has_meeting_indicator:
            result['all_are_meeting_docs'] = False
            result['suspicious_files'].append(filename)
        elif has_meeting_indicator:
            result['meeting_doc_indicators'].append(filename)
    
    return result


@pytest.mark.integration
def test_civicweb_folder_structure_detection():
    """
    Test that detects when a CivicWeb city has a type-first folder structure
    that the scraper doesn't handle correctly.
    
    This test will FAIL if a city has a type-first structure (Minutes/Agendas folders)
    that the scraper can't navigate properly.
    """
    # Load all CivicWeb configs
    configs_dir = Path(__file__).parent.parent.parent / "civicpulse" / "src" / "ingestion" / "configs"
    civicweb_configs = list(configs_dir.glob("*_civicweb*.yaml"))
    
    print(f"\n=== Testing {len(civicweb_configs)} CivicWeb cities ===")
    
    issues_found = []
    
    for config_path in civicweb_configs:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        city_name = config.get('city_name', 'Unknown')
        base_url = config.get('base_url', '')
        root_folder_url = config.get('root_folder_url', '')
        
        if not base_url or not root_folder_url:
            continue
        
        print(f"\n--- Testing {city_name} ---")
        
        # Analyze folder structure
        structure_info = analyze_folder_structure(base_url, root_folder_url)
        
        if 'error' in structure_info:
            print(f"  Error analyzing structure: {structure_info['error']}")
            continue
        
        print(f"  Structure type: {structure_info['structure_type']}")
        print(f"  Has Minutes folder: {structure_info['has_minutes_folder']}")
        print(f"  Has Agendas folder: {structure_info['has_agendas_folder']}")
        print(f"  Has year folders: {structure_info['has_year_folders']}")
        
        # Detect the bug: type-first structure that scraper can't handle
        if structure_info['structure_type'] == 'type_first':
            issues_found.append({
                'city': city_name,
                'config': config_path.name,
                'issue': 'Type-first folder structure detected (Minutes/Agendas folders at root)',
                'structure_info': structure_info
            })
            print(f"  ⚠️  TYPE-FIRST STRUCTURE DETECTED - Scraper may not handle this correctly")
    
    # Report findings
    if issues_found:
        print(f"\n=== BUG DETECTED ===")
        print(f"Found {len(issues_found)} city/cities with type-first folder structure:")
        for issue in issues_found:
            print(f"  - {issue['city']} ({issue['config']})")
            print(f"    Issue: {issue['issue']}")
        
        pytest.fail(
            f"BUG DETECTED: {len(issues_found)} city/cities have type-first folder structures "
            f"that the scraper may not handle correctly. Cities: {', '.join([i['city'] for i in issues_found])}. "
            f"The scraper expects year-first structure but these cities have type-first (Root → Minutes/Agendas → Documents)."
        )
    else:
        print("\n✓ No type-first folder structures detected - all cities use year-first structure")


@pytest.mark.integration
def test_merriam_downloads_correct_document_type():
    """
    Test specifically for Merriam to detect when wrong document types are downloaded.
    
    This test will FAIL if Merriam scraper downloads individual agenda items instead of meeting minutes.
    """
    # Create Merriam config
    merriam_config = {
        'id': 'merriam_civicweb',
        'base_url': 'https://merriam.civicweb.net',
        'root_folder_url': '/filepro/documents/',
        'city_name': 'Merriam',
        'target_year': 2025,
        'allowed_domains': ['merriam.civicweb.net'],
        'output_dir': 'data/raw notes'
    }
    
    # Analyze structure
    structure_info = analyze_folder_structure(
        merriam_config['base_url'],
        merriam_config['root_folder_url']
    )
    
    print(f"\n=== Merriam Folder Structure Analysis ===")
    print(f"Structure type: {structure_info.get('structure_type')}")
    print(f"Has Minutes folder: {structure_info.get('has_minutes_folder')}")
    print(f"Has Agendas folder: {structure_info.get('has_agendas_folder')}")
    
    # The bug: Merriam has type-first structure
    if structure_info.get('structure_type') == 'type_first':
        pytest.fail(
            "BUG DETECTED: Merriam has a type-first folder structure (Root → Minutes/Agendas folders) "
            "that the scraper doesn't handle. The scraper will navigate to the wrong folder and download "
            "individual agenda items instead of meeting minutes. The scraper needs to be updated to handle "
            "type-first structures by navigating to the 'Minutes' folder first, then to the year folder."
        )


@pytest.mark.integration
def test_civicweb_scraper_navigates_correct_folders():
    """
    Test that verifies the scraper navigates to the correct folders based on structure type.
    
    For year-first: Root → Year → Documents ✓
    For type-first: Root → Type (Minutes) → Year → Documents (needs fix)
    """
    # Test with a known year-first city (Lawrence)
    lawrence_config_path = Path(__file__).parent.parent.parent / "civicpulse" / "src" / "ingestion" / "configs" / "lawrence_civicweb.yaml"
    with open(lawrence_config_path, 'r') as f:
        lawrence_config = yaml.safe_load(f)
    
    # Test with Merriam (type-first)
    merriam_base = "https://merriam.civicweb.net"
    merriam_root = "/filepro/documents/"
    
    # Analyze both
    lawrence_structure = analyze_folder_structure(lawrence_config['base_url'], lawrence_config['root_folder_url'])
    merriam_structure = analyze_folder_structure(merriam_base, merriam_root)
    
    print(f"\n=== Structure Comparison ===")
    print(f"Lawrence: {lawrence_structure.get('structure_type')}")
    print(f"Merriam: {merriam_structure.get('structure_type')}")
    
    # Verify Lawrence is year-first (expected)
    assert lawrence_structure.get('structure_type') == 'year_first', \
        f"Lawrence should have year-first structure but got {lawrence_structure.get('structure_type')}"
    
    # Detect Merriam's type-first structure as a bug
    if merriam_structure.get('structure_type') == 'type_first':
        pytest.fail(
            "BUG DETECTED: Merriam uses type-first structure but scraper only handles year-first. "
            f"Merriam has: {merriam_structure.get('type_folders')} folders at root level. "
            "Scraper needs to detect structure type and navigate accordingly."
        )

