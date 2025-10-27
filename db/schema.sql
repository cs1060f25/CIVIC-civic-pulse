-- SQLite schema for local ingestion database
-- This file initializes the local ingestion database for document storage
-- and duplicate prevention based on content hashes.
--
-- Usage:
--   sqlite3 ingestion.db < schema.sql

-- Documents table stores scraped files with metadata for tracking and deduplication
CREATE TABLE IF NOT EXISTS documents (
    -- Unique identifier for this document (typically URL-derived or generated)
    id TEXT PRIMARY KEY,
    
    -- Source identifier matching config files (e.g., "wichita_city_council")
    source_id TEXT NOT NULL,
    
    -- Original URL where the document was found
    file_url TEXT NOT NULL,
    
    -- SHA-256 or similar hash of file content for duplicate detection
    content_hash TEXT NOT NULL,
    
    -- Size of the document in bytes
    bytes_size INTEGER NOT NULL,
    
    -- ISO 8601 timestamp of when the document was first processed
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Unique index on content_hash ensures no duplicate documents are stored
-- Different sources may link to the same PDF, so we deduplicate globally
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash 
    ON documents(content_hash);

