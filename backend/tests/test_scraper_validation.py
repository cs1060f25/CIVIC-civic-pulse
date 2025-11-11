"""
Pytest tests for validation functions (domain checking, URL validation).

Tests cover:
- Domain validation (is_allowed_domain, ensure_allowed_domain)
- URL parsing and validation
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from ingestion.civicweb_scraper import ensure_allowed_domain
from ingestion.single_link_scraper import is_allowed_domain


class TestDomainValidation:
    """Test domain validation functions"""
    
    def test_exact_match(self):
        """Test exact domain matches."""
        assert is_allowed_domain("wichita.gov", ["wichita.gov"])
        assert is_allowed_domain("lawrenceks.civicweb.net", ["lawrenceks.civicweb.net"])
    
    def test_subdomain_match(self):
        """Test subdomain matches."""
        assert is_allowed_domain("www.wichita.gov", ["wichita.gov"])
        assert is_allowed_domain("agenda.wichita.gov", ["wichita.gov"])
        assert is_allowed_domain("content.civicplus.com", ["civicplus.com"])
    
    def test_no_match(self):
        """Test domains that don't match."""
        assert not is_allowed_domain("evil.com", ["wichita.gov"])
        assert not is_allowed_domain("wichita.gov.evil.com", ["wichita.gov"])  # Should not match
        assert not is_allowed_domain("fake-wichita.gov", ["wichita.gov"])
    
    def test_multiple_allowed_domains(self):
        """Test with multiple allowed domains."""
        allowed = ["wichita.gov", "lawrenceks.civicweb.net"]
        assert is_allowed_domain("www.wichita.gov", allowed)
        assert is_allowed_domain("lawrenceks.civicweb.net", allowed)
        assert not is_allowed_domain("evil.com", allowed)
    
    def test_invalid_domains(self):
        """Test invalid domain inputs."""
        assert not is_allowed_domain("", ["wichita.gov"])
        assert not is_allowed_domain("not a domain", ["wichita.gov"])
    
    def test_ensure_allowed_domain(self):
        """Test ensure_allowed_domain() from civicweb_scraper.py"""
        assert ensure_allowed_domain("https://www.wichita.gov/page", ["wichita.gov"])
        assert ensure_allowed_domain("https://lawrenceks.civicweb.net/doc", ["lawrenceks.civicweb.net"])
        assert not ensure_allowed_domain("https://evil.com/page", ["wichita.gov"])
        assert not ensure_allowed_domain("not a url", ["wichita.gov"])

