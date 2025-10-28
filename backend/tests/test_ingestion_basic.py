"""
Pytest suite for ingestion features.

Tests cover:
- Config validation
- Target date calculation
- Duplicate prevention
- Single-link scraper with mocked network
"""

import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class MockResponse:
    """Mock response object for urlopen."""
    
    def __init__(self, content_bytes: bytes, headers: dict):
        self.content_bytes = content_bytes
        self._headers = {}
        for key, value in headers.items():
            self._headers[key.lower()] = value
        self.headers = self
        self._position = 0  # Track position for chunked reading
    
    def __enter__(self):
        self._position = 0  # Reset position for each context manager entry
        return self
    
    def __exit__(self, *args):
        return None
    
    def read(self, size=-1):
        """Support both full and chunked reading."""
        if size == -1 or size is None:
            # Return all remaining data
            result = self.content_bytes[self._position:]
            self._position = len(self.content_bytes)
            return result
        else:
            # Return chunk
            start = self._position
            end = min(self._position + size, len(self.content_bytes))
            result = self.content_bytes[start:end]
            self._position = end
            return result
    
    def get(self, key, default=None):
        return self._headers.get(key.lower(), default)


@pytest.fixture
def mock_schema(tmp_path):
    """Ensure schema.json is accessible by making it relative to backend/."""
    schema_path = Path(__file__).parent.parent / "configs" / "schema.json"
    return schema_path


def test_config_validation_happy_path(mock_schema):
    """Test loading and validating a valid config file."""
    from ingestion.config_loader import load_config
    
    # Change to backend directory so relative paths work
    backend_dir = Path(__file__).parent.parent
    original_cwd = Path.cwd()
    
    try:
        import os
        os.chdir(backend_dir)
        config = load_config("configs/wichita_city_council.yaml")
        
        assert "id" in config
        assert "start_urls" in config
        assert "allowed_domains" in config
        assert "expected_formats" in config
        assert config["id"] == "wichita_city_council"
        assert isinstance(config["start_urls"], list)
        assert isinstance(config["allowed_domains"], list)
        assert isinstance(config["expected_formats"], list)
    finally:
        os.chdir(original_cwd)


def test_config_validation_failure(tmp_path):
    """Test validation failure with missing required field."""
    from ingestion.config_loader import load_config
    
    backend_dir = Path(__file__).parent.parent
    original_cwd = Path.cwd()
    
    try:
        import os
        os.chdir(backend_dir)
        
        # Create invalid YAML missing "id"
        invalid_config = tmp_path / "invalid.yaml"
        invalid_config.write_text("""allowed_domains:
  - test.gov
start_urls:
  - https://test.gov
expected_formats:
  - pdf
frequency:
  cron: "0 9 * * 2"
follow_links:
  within_domains: true
  max_depth: 2
date_selection:
  basis: nearest_tuesday
  offset_days: -14
  match_format: "MMMM d, yyyy"
selectors:
  listing_page: https://test.gov
  link_selector: a
  pdf_selector: a[href$='.pdf']
  link_text_regex: test
naming:
  filename_template: "{source_id}/{date}_{orig_name}"
flags:
  auth_required: false
  robots_respect: true
""")
        
        with pytest.raises(ValueError) as exc_info:
            load_config(str(invalid_config))
        
        assert "Missing required field: id" in str(exc_info.value) or "Missing required field" in str(exc_info.value)
    finally:
        os.chdir(original_cwd)


def test_target_date_calculation():
    """Test compute_target_date for specific dates."""
    from datetime import date
    from ingestion.config_loader import load_config, compute_target_date
    import os
    
    backend_dir = Path(__file__).parent.parent
    original_cwd = Path.cwd()
    
    try:
        os.chdir(backend_dir)
        config = load_config("configs/wichita_city_council.yaml")
        
        # October 28, 2025 is a Tuesday (weekday() == 1)
        # Offset is -14 days
        # So: Tuesday Oct 28 - 14 days = Tuesday Oct 14
        test_date = date(2025, 10, 28)
        result = compute_target_date(test_date, config)
        assert result == "October 14, 2025"
        
        # October 29, 2025 is a Wednesday
        # Should find Tuesday Oct 28, then -14 days = Oct 14
        test_date2 = date(2025, 10, 29)
        result2 = compute_target_date(test_date2, config)
        assert result2 == "October 14, 2025"
    finally:
        os.chdir(original_cwd)


def test_duplicate_prevention_roundtrip(tmp_path):
    """Test duplicate prevention with init_db and save_if_new."""
    from ingestion.local_db import init_db, save_if_new
    import os
    
    backend_dir = Path(__file__).parent.parent
    original_cwd = Path.cwd()
    
    try:
        os.chdir(backend_dir)
        
        # Use temp DB
        db_path = tmp_path / "test.db"
        
        # Initialize database with temp path
        init_db(str(db_path))
        
        # Verify it was created
        assert db_path.exists()
        
        # Override the default path since save_if_new uses get_db_path()
        from ingestion import local_db
        original_get_db = local_db.get_db_path
        local_db.get_db_path = lambda p=None: Path(str(db_path))
        
        try:
            # First save - should create
            PDF1 = b"%PDF-1.4\nA"
            result1 = save_if_new(
                "wichita_city_council",
                "https://example.com/a.pdf",
                PDF1
            )
            assert result1["status"] == "created"
            assert "document_id" in result1
            assert "content_hash" in result1
            document_id1 = result1["document_id"]
            
            # Second save with same bytes - should be duplicate
            result2 = save_if_new(
                "wichita_city_council",
                "https://example.com/a.pdf",
                PDF1
            )
            assert result2["status"] == "duplicate"
            assert result2["document_id"] == document_id1
            
            # Third save with different bytes - should create
            PDF2 = b"%PDF-1.4\nB"
            result3 = save_if_new(
                "wichita_city_council",
                "https://example.com/a.pdf",  # same URL but different content
                PDF2
            )
            assert result3["status"] == "created"
            assert result3["document_id"] != document_id1
        finally:
            local_db.get_db_path = original_get_db
    finally:
        os.chdir(original_cwd)


def test_single_link_scraper_mocked_network(tmp_path):
    """Test single-link scraper with mocked network for valid PDF."""
    from ingestion.single_link_scraper import download_url, is_pdf_content, is_allowed_domain
    from ingestion.config_loader import load_config
    import os
    
    backend_dir = Path(__file__).parent.parent
    original_cwd = Path.cwd()
    
    mock_content = b"%PDF-1.4\nHELLO"
    mock_headers = {"Content-Type": "application/pdf"}
    
    def mock_urlopen(req, timeout=None):
        return MockResponse(mock_content, mock_headers)
    
    try:
        os.chdir(backend_dir)
        
        # Mock the network call
        with patch('ingestion.single_link_scraper.urlopen', side_effect=mock_urlopen):
            # Test downloading the URL
            content_bytes, content_type = download_url("https://www.wichita.gov/test.pdf")
            
            # Verify PDF content detection
            assert is_pdf_content(content_type, content_bytes)
            
            # Verify domain validation
            config = load_config("configs/wichita_city_council.yaml")
            assert is_allowed_domain("www.wichita.gov", config["allowed_domains"])
            
            # Verify content was downloaded
            assert len(content_bytes) > 0
            assert content_bytes == mock_content
            
    finally:
        os.chdir(original_cwd)


def test_single_link_scraper_rejects_non_pdf(tmp_path):
    """Test single-link scraper rejects non-PDF content."""
    from ingestion.single_link_scraper import download_url, is_pdf_content
    import os
    
    backend_dir = Path(__file__).parent.parent
    original_cwd = Path.cwd()
    
    mock_content = b"<!doctype html><html></html>"
    mock_headers = {"Content-Type": "text/html"}
    
    def mock_urlopen(req, timeout=None):
        return MockResponse(mock_content, mock_headers)
    
    try:
        os.chdir(backend_dir)
        
        # Mock the network call
        with patch('ingestion.single_link_scraper.urlopen', side_effect=mock_urlopen):
            # Test downloading non-PDF content
            content_bytes, content_type = download_url("https://www.wichita.gov/page.html")
            
            # Verify it's detected as non-PDF
            is_pdf = is_pdf_content(content_type, content_bytes)
            assert not is_pdf, "HTML content should be rejected as non-PDF"
            
            # Verify HTML content was downloaded
            assert len(content_bytes) > 0
            assert content_bytes == mock_content
            
            # Verify content type
            assert "text/html" in content_type.lower()
            
    finally:
        os.chdir(original_cwd)


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main(["-q"]))

