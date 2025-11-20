"""
Pytest tests for scraper parsing functions (date parsing, filename generation).

Tests cover:
- Date parsing from various formats (AgendaCenter, Legistar, CivicWeb, CivicPlus)
- Filename generation
- Edge cases and error handling
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from ingestion.agendacenter_scraper import parse_date_from_text, generate_filename
from ingestion.legistar_scraper import parse_legistar_date
from ingestion.civicweb_nofolders_scraper import parse_meeting_date as parse_civicweb_date
from ingestion.civicplus_scraper import parse_meeting_date as parse_civicplus_date


class TestAgendaCenterDateParsing:
    """Test parse_date_from_text() from agendacenter_scraper.py"""
    
    def test_standard_format(self):
        """Test standard date formats."""
        assert parse_date_from_text("Nov 6, 2025") == (2025, 11, 6)
        assert parse_date_from_text("October 14, 2025") == (2025, 10, 14)
        assert parse_date_from_text("11/06/2025") == (2025, 11, 6)
        assert parse_date_from_text("2025-11-06") == (2025, 11, 6)
    
    def test_with_em_dash(self):
        """Test dates with em dash separator."""
        assert parse_date_from_text("Nov6, 2025— AmendedOct30, 2025 4:32 PM") == (2025, 11, 6)
        assert parse_date_from_text("Oct 21, 2025— PostedOct20, 2025 3:41 PM") == (2025, 10, 21)
    
    def test_spacing_issues(self):
        """Test dates with spacing issues like 'Nov6'."""
        assert parse_date_from_text("Nov6, 2025") == (2025, 11, 6)
        assert parse_date_from_text("Oct21, 2025") == (2025, 10, 21)
    
    def test_invalid_dates(self):
        """Test invalid date formats."""
        assert parse_date_from_text("Invalid date") is None
        assert parse_date_from_text("") is None
        assert parse_date_from_text("Not a date 123") is None
    
    def test_edge_cases(self):
        """Test edge cases."""
        assert parse_date_from_text("Jan 1, 2025") == (2025, 1, 1)
        assert parse_date_from_text("Dec 31, 2025") == (2025, 12, 31)


class TestLegistarDateParsing:
    """Test parse_legistar_date() from legistar_scraper.py"""
    
    def test_standard_format(self):
        """Test standard Legistar date formats."""
        assert parse_legistar_date("11/6/2025") == (2025, 11, 6)
        assert parse_legistar_date("1/7/2025") == (2025, 1, 7)
        assert parse_legistar_date("12/31/2025") == (2025, 12, 31)
    
    def test_with_whitespace(self):
        """Test dates with whitespace."""
        assert parse_legistar_date("  11/6/2025  ") == (2025, 11, 6)
    
    def test_invalid_dates(self):
        """Test invalid Legistar date formats."""
        assert parse_legistar_date("13/1/2025") is None  # Invalid month
        assert parse_legistar_date("11/32/2025") is None  # Invalid day
        assert parse_legistar_date("Invalid") is None
        assert parse_legistar_date("2025-11-06") is None  # Wrong format


class TestCivicWebDateParsing:
    """Test parse_meeting_date() from civicweb_nofolders_scraper.py"""
    
    def test_standard_format(self):
        """Test standard CivicWeb date formats."""
        assert parse_civicweb_date("14 OCT 2025") == (2025, 10, 14)
        assert parse_civicweb_date("12 Nov 2025") == (2025, 11, 12)
        assert parse_civicweb_date("1 JAN 2025") == (2025, 1, 1)
    
    def test_with_meeting_title(self):
        """Test dates embedded in meeting titles."""
        assert parse_civicweb_date("City Council - 12 Nov 2025") == (2025, 11, 12)
        assert parse_civicweb_date("14 OCT 2025 - Regular Meeting") == (2025, 10, 14)
    
    def test_invalid_dates(self):
        """Test invalid CivicWeb date formats."""
        assert parse_civicweb_date("Invalid date") is None
        assert parse_civicweb_date("") is None


class TestCivicPlusDateParsing:
    """Test parse_meeting_date() from civicplus_scraper.py"""
    
    def test_standard_format(self):
        """Test standard CivicPlus date formats."""
        assert parse_civicplus_date("Tue, Nov 4, 2025") == (2025, 11, 4)
        assert parse_civicplus_date("November 4, 2025") == (2025, 11, 4)
        assert parse_civicplus_date("Mon, Oct 21, 2025") == (2025, 10, 21)
    
    def test_without_day_of_week(self):
        """Test dates without day of week prefix."""
        assert parse_civicplus_date("Nov 4, 2025") == (2025, 11, 4)
        assert parse_civicplus_date("October 14, 2025") == (2025, 10, 14)
    
    def test_invalid_dates(self):
        """Test invalid CivicPlus date formats."""
        assert parse_civicplus_date("Invalid date") is None
        assert parse_civicplus_date("") is None


class TestFilenameGeneration:
    """Test generate_filename() from agendacenter_scraper.py"""
    
    def test_standard_format(self):
        """Test standard filename generation."""
        assert generate_filename("Wichita", 2025, 11, 6, "Agenda") == "Wichita_11-06-2025_Agenda.pdf"
        assert generate_filename("Wichita", 2025, 10, 14, "Minutes") == "Wichita_10-14-2025_Minutes.pdf"
    
    def test_single_digit_months_days(self):
        """Test single digit months and days (should be zero-padded)."""
        assert generate_filename("Hays", 2025, 1, 5, "Agenda") == "Hays_01-05-2025_Agenda.pdf"
        assert generate_filename("Hays", 2025, 9, 2, "Minutes") == "Hays_09-02-2025_Minutes.pdf"
    
    def test_different_cities(self):
        """Test with different city names."""
        assert generate_filename("Great Bend", 2025, 11, 3, "Minutes") == "Great Bend_11-03-2025_Minutes.pdf"
        assert generate_filename("Overland Park", 2025, 10, 21, "Agenda") == "Overland Park_10-21-2025_Agenda.pdf"

