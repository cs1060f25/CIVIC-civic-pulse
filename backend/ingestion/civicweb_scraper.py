#!/usr/bin/env python3
"""
Scraper for CivicWeb filepro directories (supports multiple cities: Lawrence, Overland Park, Shawnee, Leawood, Derby).

Flow (no browser automation required):
1) Load the root folder page (config.root_folder_url)
2) Find the target year link (e.g., "2025") and follow it
3) On the year page, extract meeting PDF links (`/document/<id>/<name>.pdf`)
4) Download the PDF bytes and persist via local_db.save_if_new(), writing the file to
   backend/data/raw notes/<City>/<filename>.pdf

Usage (run from backend/):
  python ingestion/civicweb_scraper.py --config configs/lawrence_civicweb.yaml
  python ingestion/civicweb_scraper.py --config configs/overland_park_civicweb.yaml
  python ingestion/civicweb_scraper.py --config configs/shawnee_civicweb.yaml
  python ingestion/civicweb_scraper.py --config configs/leawood_civicweb.yaml
  python ingestion/civicweb_scraper.py --config configs/derby_civicweb.yaml
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Make sure we can import ingestion utilities when running from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))
from ingestion.local_db import init_db, save_if_new  # noqa: E402


def read_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        print("Error: PyYAML is required. Install with: pip install pyyaml", file=sys.stderr)
        sys.exit(1)
    with open(path, "r") as f:
        return yaml.safe_load(f)


def fetch(session: requests.Session, base_url: str, href: str, timeout: int = 20) -> requests.Response:
    url = urljoin(base_url, href)
    resp = session.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp


def ensure_allowed_domain(url: str, allowed_domains: list) -> bool:
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return False
    return any(host.endswith(d) for d in allowed_domains)


def find_year_href(html: str, target_year: int) -> Optional[str]:
    """
    Parse the root folder page and return the href to the specific year folder (e.g., "2025").
    """
    soup = BeautifulSoup(html, "lxml")
    year_text = str(target_year)
    # Strategy 1: direct anchor text match
    for a in soup.select("a[href^='/filepro/documents/']"):
        label = a.get_text(strip=True)
        if label == year_text:
            return a.get("href")
    # Strategy 2: row text contains the year; pick the first /documents/ link in that row
    for tr in soup.select("table tbody tr"):
        row_text = tr.get_text(separator=" ", strip=True)
        if year_text in row_text:
            a = tr.select_one("a[href^='/filepro/documents/']")
            if a:
                return a.get("href")
    # Strategy 3: any link that looks like a child folder and ends with /<year>/ (some sites)
    for a in soup.select("a[href^='/filepro/documents/']"):
        href = a.get("href", "")
        if href.rstrip("/").endswith("/" + year_text):
            return href
    return None


def iter_meeting_folder_links(year_page_html: str):
    """
    Yield (title, href) for meeting folder links on the year page.
    Used for cities like Leawood that have nested structure: Year -> Meeting Folders -> PDFs
    """
    soup = BeautifulSoup(year_page_html, "lxml")
    # Look for folder links (typically /filepro/documents/...)
    # Exclude direct PDF links and the year folder itself
    for a in soup.select("a[href^='/filepro/documents/']"):
        href = a.get("href", "")
        title = a.get_text(strip=True)
        # Skip if it's a PDF link
        if href.lower().endswith(".pdf") or "/document/" in href:
            continue
        # Skip if it's just a number (likely the year folder itself)
        if title.strip().isdigit():
            continue
        # This looks like a meeting folder
        yield title, href


def iter_document_links(year_page_html: str):
    """
    Yield (title, href) for rows that link to documents.
    Supports two patterns:
      1) Direct PDF links: /filepro/document/<id>/<name>.pdf
      2) Item links:       /document/<id>  (construct PDF URL using the title)
    """
    soup = BeautifulSoup(year_page_html, "lxml")
    # Pattern 1: already a direct PDF link
    for a in soup.select("a[href^='/filepro/document/']"):
        href = a.get("href", "")
        title = a.get_text(strip=True) or Path(href).name
        if href.lower().endswith(".pdf"):
            yield title, href
    # Pattern 2: item page links, construct the full PDF URL
    for a in soup.select("a[href^='/document/']"):
        href = a.get("href", "")
        title = a.get_text(strip=True)
        # Expect href like /document/450247
        parts = href.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "document" and title:
            doc_id = parts[1]
            constructed = f"/document/{doc_id}/{title}.pdf"
            yield title, constructed


def download_and_save(
    session: requests.Session,
    base_url: str,
    allowed_domains: list,
    city_name: str,
    source_id: str,
    doc_title: str,
    href: str,
    output_base: Path,
) -> dict:
    url = urljoin(base_url, href)
    if not ensure_allowed_domain(url, allowed_domains):
        return {"status": "error", "reason": f"Domain not allowed for url: {url}", "url": url}

    # Download bytes
    r = session.get(url, timeout=60)
    r.raise_for_status()
    content_type = r.headers.get("Content-Type", "")
    if "pdf" not in content_type.lower() and not r.content.startswith(b"%PDF"):
        return {"status": "error", "reason": f"Not a PDF: {content_type}", "url": url}

    # Save to DB via existing ingestion util
    db_result = save_if_new(source_id=source_id, file_url=url, content_bytes=r.content)

    # Always persist file to disk if it doesn't exist (even if duplicate in DB)
    # Sanitize filename
    safe_title = "".join(ch for ch in doc_title if ch.isalnum() or ch in (" ", "_", "-", ".")).rstrip()
    filename = f"{safe_title}.pdf"
    dest_dir = output_base / city_name
    dest_dir.mkdir(parents=True, exist_ok=True)
    out_path = dest_dir / filename
    
    # Only write if file doesn't exist
    if not out_path.exists():
        with open(out_path, "wb") as f:
            f.write(r.content)

    return {
        "status": db_result["status"],
        "document_id": db_result["document_id"],
        "content_hash": db_result["content_hash"],
        "bytes_size": db_result["bytes_size"],
        "url": url,
        "saved_path": str(out_path) if out_path else None,
    }


def main():
    parser = argparse.ArgumentParser(description="Scrape CivicWeb year folder and download PDFs")
    parser.add_argument("--config", required=True, help="Path to YAML config (relative to backend/configs/ allowed)")
    parser.add_argument("--limit", type=int, default=None, help="Max files to download")
    parser.add_argument("--outdir", default=None, help="Override output directory (relative to backend/)")
    args = parser.parse_args()

    # Resolve config path relative to backend/ if needed
    backend_dir = Path(__file__).resolve().parent.parent
    cfg_path = Path(args.config)
    if not cfg_path.is_absolute():
        cfg_path = backend_dir / ("configs/" + cfg_path.name if "/" not in args.config else args.config)
    config = read_yaml(cfg_path)

    base_url = config["base_url"].rstrip("/")
    root_folder_url = config["root_folder_url"]
    city_name = config["city_name"]
    allowed_domains = config.get("allowed_domains", [])
    target_year = int(config.get("target_year", 2025))
    # If --limit is provided, use it; otherwise use config value if present, else None (no limit)
    download_limit = args.limit if args.limit is not None else config.get("download_limit")

    # Initialize DB if missing
    db_path = backend_dir / "data" / "civicpulse.db"
    if not db_path.exists():
        init_db()

    # Determine output directory
    output_base = Path(args.outdir) if args.outdir else backend_dir / config.get("output_dir", "data/raw notes")

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }
    )

    # 1) Load root folder
    root_resp = fetch(session, base_url, root_folder_url)
    year_href = find_year_href(root_resp.text, target_year)
    if year_href:
        year_resp = fetch(session, base_url, year_href)
    else:
        # Some CivicWeb folders show the current year directly on the root page.
        year_resp = root_resp

    # 3) Check if this city uses nested folders (Year -> Meeting Folders -> PDFs)
    # Detect by checking if year page has folder links vs direct PDF links
    meeting_folders = list(iter_meeting_folder_links(year_resp.text))
    has_nested_folders = len(meeting_folders) > 0
    
    source_id = config.get("id", "lawrence_civicweb")
    results = {"downloads": [], "attempted": 0, "saved": 0, "duplicates": 0, "errors": 0}

    if has_nested_folders:
        # Nested structure: iterate through meeting folders, then extract PDFs from each
        for meeting_title, meeting_href in meeting_folders:
            # Fetch the meeting folder page
            meeting_resp = fetch(session, base_url, meeting_href)
            # Extract PDFs from this meeting folder
            for doc_title, doc_href in iter_document_links(meeting_resp.text):
                results["attempted"] += 1
                try:
                    # Include meeting title in filename for context
                    full_title = f"{meeting_title}_{doc_title}" if doc_title else meeting_title
                    res = download_and_save(
                        session=session,
                        base_url=base_url,
                        allowed_domains=allowed_domains,
                        city_name=city_name,
                        source_id=source_id,
                        doc_title=full_title,
                        href=doc_href,
                        output_base=output_base,
                    )
                    results["downloads"].append(res)
                    if res["status"] == "created":
                        results["saved"] += 1
                    elif res["status"] == "duplicate":
                        results["duplicates"] += 1
                    else:
                        results["errors"] += 1
                except Exception as e:
                    results["errors"] += 1
                    results["downloads"].append({"status": "error", "reason": str(e), "href": doc_href})

                # Respect limit for initial test
                if download_limit and (results["saved"] + results["duplicates"]) >= download_limit:
                    break

                time.sleep(1.0)  # be polite
            
            if download_limit and (results["saved"] + results["duplicates"]) >= download_limit:
                break
            
            time.sleep(0.5)  # Brief pause between meeting folders
    else:
        # Flat structure: PDFs directly on year page
        for title, href in iter_document_links(year_resp.text):
            results["attempted"] += 1
            try:
                res = download_and_save(
                    session=session,
                    base_url=base_url,
                    allowed_domains=allowed_domains,
                    city_name=city_name,
                    source_id=source_id,
                    doc_title=title,
                    href=href,
                    output_base=output_base,
                )
                results["downloads"].append(res)
                if res["status"] == "created":
                    results["saved"] += 1
                elif res["status"] == "duplicate":
                    results["duplicates"] += 1
                else:
                    results["errors"] += 1
            except Exception as e:
                results["errors"] += 1
                results["downloads"].append({"status": "error", "reason": str(e), "href": href})

            # Respect limit for initial test
            if download_limit and (results["saved"] + results["duplicates"]) >= download_limit:
                break

            time.sleep(1.0)  # be polite

    print(json.dumps(results))


if __name__ == "__main__":
    main()


