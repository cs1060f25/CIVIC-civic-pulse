"""
Pytest tests for HTML extraction functions from scrapers.

Tests cover:
- Extracting meeting rows from HTML tables (AgendaCenter, Legistar)
- Extracting document links from CivicWeb pages
- Extracting date links from CivicPlus pages
- Finding year links in CivicWeb pages
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from ingestion.agendacenter_scraper import extract_meeting_rows
from ingestion.legistar_scraper import extract_meeting_rows as extract_legistar_meetings
from ingestion.civicweb_scraper import find_year_href, iter_document_links, iter_meeting_folder_links
from ingestion.civicplus_scraper import extract_meeting_date_links


class TestAgendaCenterExtraction:
    """Test extract_meeting_rows() from agendacenter_scraper.py"""
    
    def test_extract_meetings_from_table(self):
        """Test extracting meetings from a simple AgendaCenter table."""
        html = """
        <table>
            <tbody>
                <tr>
                    <td>Nov 6, 2025</td>
                    <td><a href="/ViewFile/Minutes/_11062025-123">Minutes</a></td>
                    <td></td>
                    <td><a href="/ViewFile/Agenda/_11062025-123">Agenda</a></td>
                </tr>
                <tr>
                    <td>Oct 21, 2025</td>
                    <td><a href="/ViewFile/Minutes/_10212025-456">Minutes</a></td>
                    <td></td>
                    <td><a href="/ViewFile/Agenda/_10212025-456">Agenda</a></td>
                </tr>
            </tbody>
        </table>
        """
        
        selectors = {
            'meeting_row': 'table tbody tr',
            'date_selector': 'td:first-child',
            'agenda_link': 'td:nth-child(4) a[href*="ViewFile/Agenda"]',
            'minutes_link': 'td:nth-child(2) a[href*="ViewFile/Minutes"]'
        }
        
        meetings = extract_meeting_rows(html, selectors, "https://example.com")
        
        assert len(meetings) == 2
        assert meetings[0]['parsed_date'] == (2025, 11, 6)
        assert meetings[1]['parsed_date'] == (2025, 10, 21)
        assert meetings[0]['minutes_url'] is not None
        assert meetings[0]['agenda_url'] is not None
    
    def test_extract_meetings_no_minutes(self):
        """Test extracting meetings where some have no minutes."""
        html = """
        <table>
            <tbody>
                <tr>
                    <td>Nov 6, 2025</td>
                    <td></td>
                    <td></td>
                    <td><a href="/ViewFile/Agenda/_11062025-123">Agenda</a></td>
                </tr>
            </tbody>
        </table>
        """
        
        selectors = {
            'meeting_row': 'table tbody tr',
            'date_selector': 'td:first-child',
            'agenda_link': 'td:nth-child(4) a[href*="ViewFile/Agenda"]',
            'minutes_link': 'td:nth-child(2) a[href*="ViewFile/Minutes"]'
        }
        
        meetings = extract_meeting_rows(html, selectors, "https://example.com")
        
        assert len(meetings) == 1
        assert meetings[0]['minutes_url'] is None
        assert meetings[0]['agenda_url'] is not None


class TestLegistarExtraction:
    """Test extract_meeting_rows() from legistar_scraper.py"""
    
    def test_extract_meetings_from_legistar_table(self):
        """Test extracting meetings from a Legistar table."""
        html = """
        <table id="ctl00_ContentPlaceHolder1_gridCalendar_ctl00">
            <thead>
                <tr>
                    <th>Meeting Date</th>
                    <th>Name</th>
                    <th>Minutes</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>11/6/2025</td>
                    <td>City Council</td>
                    <td><a href="View.ashx?M=M&ID=123">Minutes</a></td>
                </tr>
                <tr>
                    <td>10/21/2025</td>
                    <td>City Council</td>
                    <td><a href="View.ashx?M=M&ID=456">Minutes</a></td>
                </tr>
            </tbody>
        </table>
        """
        
        config = {
            'default_meeting_name': 'City Council',
            'meeting_filter': []
        }
        
        meetings = extract_legistar_meetings(html, config, "https://example.com")
        
        assert len(meetings) >= 2
        # Check that we found meetings with dates
        dates = [m['parsed_date'] for m in meetings if m.get('parsed_date')]
        assert (2025, 11, 6) in dates or (2025, 10, 21) in dates


class TestCivicWebExtraction:
    """Test CivicWeb HTML extraction functions"""
    
    def test_find_year_href(self):
        """Test finding year link in CivicWeb page."""
        html = """
        <html>
            <body>
                <a href="/filepro/documents/123/">2024</a>
                <a href="/filepro/documents/456/">2025</a>
                <a href="/filepro/documents/789/">2026</a>
            </body>
        </html>
        """
        
        href = find_year_href(html, 2025)
        assert href == "/filepro/documents/456/"
    
    def test_find_year_href_not_found(self):
        """Test when year link is not found."""
        html = """
        <html>
            <body>
                <a href="/filepro/documents/123/">2024</a>
            </body>
        </html>
        """
        
        href = find_year_href(html, 2025)
        assert href is None
    
    def test_iter_document_links(self):
        """Test extracting document links from CivicWeb page."""
        html = """
        <html>
            <body>
                <a href="/filepro/documents/123/">Meeting 1</a>
                <a href="/filepro/document/456/Agenda.pdf">Agenda</a>
                <a href="/filepro/document/789/Minutes.pdf">Minutes</a>
                <a href="/document/101112">Meeting Packet</a>
            </body>
        </html>
        """
        
        links = list(iter_document_links(html))
        assert len(links) >= 2
        # Check that we found document links
        titles = [title for title, href in links]
        assert any('Agenda' in t or 'Minutes' in t or 'Packet' in t for t in titles)
    
    def test_iter_meeting_folder_links(self):
        """Test extracting meeting folder links (for nested structures)."""
        html = """
        <html>
            <body>
                <a href="/filepro/documents/folder1/">City Council Meeting 1</a>
                <a href="/filepro/documents/folder2/">City Council Meeting 2</a>
            </body>
        </html>
        """
        
        folders = list(iter_meeting_folder_links(html))
        assert len(folders) >= 2
        # Check that we found folder links
        assert any('Meeting' in title for title, href in folders)


class TestCivicPlusExtraction:
    """Test extract_meeting_date_links() from civicplus_scraper.py"""
    
    def test_extract_date_links_from_tab_panel(self):
        """Test extracting date links from CivicPlus tab panel."""
        html = """
        <div class="tabbedWidget cpTabPanel showing">
            <div class="cp-fieldWrapper">Tue, Nov 4, 2025</div>
            <div class="cp-fieldWrapper">City Council</div>
            <div class="cp-fieldWrapper">Regular Meeting</div>
            <div class="cp-fieldWrapper">Tue, Oct 21, 2025</div>
            <div class="cp-fieldWrapper">City Council</div>
        </div>
        """
        
        meetings = extract_meeting_date_links(html, 2025, "https://example.com")
        
        assert len(meetings) == 2
        assert meetings[0]['parsed_date'] == (2025, 11, 4)
        assert meetings[1]['parsed_date'] == (2025, 10, 21)
        assert meetings[0]['date_text'] == "Tue, Nov 4, 2025"
    
    def test_extract_only_target_year(self):
        """Test that only target year dates are extracted."""
        html = """
        <div class="tabbedWidget cpTabPanel showing">
            <div class="cp-fieldWrapper">Tue, Nov 4, 2025</div>
            <div class="cp-fieldWrapper">Tue, Dec 17, 2024</div>
            <div class="cp-fieldWrapper">Tue, Nov 4, 2026</div>
        </div>
        """
        
        meetings = extract_meeting_date_links(html, 2025, "https://example.com")
        
        assert len(meetings) == 1
        assert meetings[0]['parsed_date'] == (2025, 11, 4)
    
    def test_extract_no_meetings(self):
        """Test when no meetings are found."""
        html = """
        <div class="tabbedWidget cpTabPanel showing">
            <div class="cp-fieldWrapper">No dates here</div>
        </div>
        """
        
        meetings = extract_meeting_date_links(html, 2025, "https://example.com")
        
        assert len(meetings) == 0

