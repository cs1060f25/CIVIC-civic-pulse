"""
Basic pytest suite for ingestion features.
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.config_loader import load_config, compute_target_date
from ingestion.local_db import init_db, save_if_new


def test_config_validation_happy_path():
    """Test that a valid config loads and contains required keys."""
    config = load_config("configs/wichita_city_council.yaml")
    
    # Assert required keys exist
    assert "id" in config
    assert "start_urls" in config
    assert "allowed_domains" in config
    assert "expected_formats" in config
    
    # Check values
    assert config["id"] == "wichita_city_council"
    assert isinstance(config["start_urls"], list)
    assert len(config["start_urls"]) > 0


def test_config_validation_failure(tmp_path):
    """Test that missing required field raises an error."""
    # Create invalid YAML (missing 'id')
    invalid_yaml = tmp_path / "invalid.yaml"
    invalid_yaml.write_text("""start_urls:
  - "https://example.com"
allowed_domains:
  - "example.com"
""")
    
    with pytest.raises(ValueError, match="Missing required field.*id"):
        load_config(str(invalid_yaml))


def test_target_date_calculation():
    """Test target date computation for nearest Tuesday logic."""
    from datetime import date
    
    config = load_config("configs/wichita_city_council.yaml")
    
    # Test with 2025-10-28 (Tuesday)
    target_date = compute_target_date(date(2025, 10, 28), config)
    assert target_date == "October 14, 2025"
    
    # Test with 2025-10-29 (Wednesday) - should still find Tuesday October 28
    # So nearest Tuesday is Oct 28, minus 14 days = Oct 14
    target_date = compute_target_date(date(2025, 10, 29), config)
    assert target_date == "October 14, 2025"


def test_duplicate_prevention_round_trip(tmp_path, monkeypatch):
    """Test duplicate prevention with temp database."""
    # Set temp database path
    test_db = tmp_path / "test.db"
    monkeypatch.setenv("CIVICPULSE_DB", str(test_db))
    
    # Initialize database
    init_db(str(test_db))
    
    # Test with PDF1 using unique URL to avoid cross-test contamination
    pdf1 = b"%PDF-1.4\nTEST_A_" + str(tmp_path).encode()
    result1 = save_if_new("test_source", "https://example.com/test_a.pdf", pdf1)
    assert result1["status"] == "created"
    assert "document_id" in result1
    document_id_1 = result1["document_id"]
    
    # Save same content again - should be duplicate
    result2 = save_if_new("test_source", "https://example.com/test_a.pdf", pdf1)
    assert result2["status"] == "duplicate"
    assert result2["document_id"] == document_id_1
    
    # Save different content - should be new
    pdf2 = b"%PDF-1.4\nTEST_B_" + str(tmp_path).encode()
    result3 = save_if_new("test_source", "https://example.com/test_a.pdf", pdf2)
    assert result3["status"] == "created"
    assert result3["document_id"] != document_id_1


def test_single_link_scraper_mocked_network(tmp_path, monkeypatch):
    """Test single-link scraper with mocked network."""
    # Set temp database
    test_db = tmp_path / "test.db"
    monkeypatch.setenv("CIVICPULSE_DB", str(test_db))
    
    # Initialize database
    init_db(str(test_db))
    
    # Mock response
    mock_response = Mock()
    mock_response.read.return_value = b"%PDF-1.4\nHELLO"
    mock_response.headers = {"Content-Type": "application/pdf"}
    mock_response.__enter__ = Mock(return_value=mock_response)
    mock_response.__exit__ = Mock(return_value=None)
    
    mock_urlopen = Mock(return_value=mock_response)
    
    # Import after setting up mock
    from ingestion.single_link_scraper import scrape_single_link
    
    # First run - should create
    result1 = scrape_single_link(
        config_path="configs/wichita_city_council.yaml",
        source_id="wichita_city_council",
        url="https://www.wichita.gov/test.pdf",
        outdir=str(tmp_path),
        _urlopen_fn=mock_urlopen
    )
    
    assert result1["status"] == "created"
    assert "document_id" in result1
    assert result1["saved_path"] is not None
    
    # Check file exists
    saved_file = Path(result1["saved_path"])
    assert saved_file.exists()
    
    # Second run - should be duplicate
    result2 = scrape_single_link(
        config_path="configs/wichita_city_council.yaml",
        source_id="wichita_city_council",
        url="https://www.wichita.gov/test.pdf",
        outdir=str(tmp_path),
        _urlopen_fn=mock_urlopen
    )
    
    assert result2["status"] == "duplicate"
    assert result2["document_id"] == result1["document_id"]
    assert result2["saved_path"] is None


def test_single_link_scraper_rejects_non_pdf(tmp_path, monkeypatch):
    """Test that scraper rejects non-PDF content."""
    # Set temp database
    test_db = tmp_path / "test.db"
    monkeypatch.setenv("CIVICPULSE_DB", str(test_db))
    
    init_db(str(test_db))
    
    # Mock response with HTML content
    mock_response = Mock()
    mock_response.read.return_value = b"<!doctype html><html></html>"
    mock_response.headers = {"Content-Type": "text/html"}
    mock_response.__enter__ = Mock(return_value=mock_response)
    mock_response.__exit__ = Mock(return_value=None)
    
    mock_urlopen = Mock(return_value=mock_response)
    
    from ingestion.single_link_scraper import scrape_single_link
    
    result = scrape_single_link(
        config_path="configs/wichita_city_council.yaml",
        source_id="wichita_city_council",
        url="https://www.wichita.gov/test.html",
        outdir=str(tmp_path),
        _urlopen_fn=mock_urlopen
    )
    
    assert result["status"] == "error"
    assert "not a pdf" in result["reason"].lower()


def test_single_link_scraper_rejects_wrong_domain(tmp_path, monkeypatch):
    """Test that scraper rejects URLs from non-allowed domains."""
    # Set temp database
    test_db = tmp_path / "test.db"
    monkeypatch.setenv("CIVICPULSE_DB", str(test_db))
    
    init_db(str(test_db))
    
    # Mock response
    mock_response = Mock()
    mock_response.read.return_value = b"%PDF-1.4\nHELLO"
    mock_response.headers = {"Content-Type": "application/pdf"}
    mock_response.__enter__ = Mock(return_value=mock_response)
    mock_response.__exit__ = Mock(return_value=None)
    
    mock_urlopen = Mock(return_value=mock_response)
    
    from ingestion.single_link_scraper import scrape_single_link
    
    result = scrape_single_link(
        config_path="configs/wichita_city_council.yaml",
        source_id="wichita_city_council",
        url="https://example.com/test.pdf",
        outdir=str(tmp_path),
        _urlopen_fn=mock_urlopen
    )
    
    assert result["status"] == "error"
    assert "not in allowed domains" in result["reason"]


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main(["-q"]))

