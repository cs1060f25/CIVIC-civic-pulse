-- SQLite schema for CivicPulse document storage
-- This file initializes the database for document storage with rich metadata
-- and duplicate prevention based on content hashes.
--
-- Usage:
--   sqlite3 civicpulse.db < schema.sql

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

-- Index on file_url for fast URL-based duplicate checking before download
CREATE INDEX IF NOT EXISTS idx_documents_file_url 
    ON documents(file_url);

-- Extended metadata table for rich document information
CREATE TABLE IF NOT EXISTS document_metadata (
    document_id TEXT PRIMARY KEY,
    
    -- Display information
    title TEXT NOT NULL,
    entity TEXT NOT NULL,                -- e.g., "Johnson County Planning Board"
    jurisdiction TEXT NOT NULL,          -- e.g., "Johnson County, KS"
    
    -- Geographic data (JSON array of strings)
    counties TEXT NOT NULL DEFAULT '[]', -- e.g., '["Johnson", "Sedgwick"]'
    
    -- Temporal data
    meeting_date TEXT,                   -- ISO 8601 date (nullable if unknown)
    
    -- Classification (JSON arrays)
    doc_types TEXT NOT NULL DEFAULT '[]',     -- e.g., '["Agenda", "Minutes"]'
    topics TEXT NOT NULL DEFAULT '[]',        -- e.g., '["zoning", "solar"]'
    
    -- Impact and stage
    impact TEXT NOT NULL DEFAULT 'Low',       -- "Low" | "Medium" | "High"
    stage TEXT,                               -- "Work Session" | "Hearing" | "Vote" | "Adopted" | "Draft"
    
    -- Search relevance (JSON object)
    keyword_hits TEXT DEFAULT '{}',           -- e.g., '{"solar zoning": 3, "setback": 2}'
    
    -- Preview data (JSON arrays)
    extracted_text TEXT DEFAULT '[]',         -- Sample paragraphs from document
    pdf_preview TEXT DEFAULT '[]',            -- Page preview snippets
    
    -- Full document text (complete extracted text from PDF)
    full_text TEXT,                           -- Full text content of the document
    
    -- Attachments (JSON array of objects)
    attachments TEXT DEFAULT '[]',            -- e.g., '[{"id":"a1","title":"Agenda","type":"Agenda","pageCount":15}]'
    
    -- Timestamps
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metadata_meeting_date ON document_metadata(meeting_date);
CREATE INDEX IF NOT EXISTS idx_metadata_impact ON document_metadata(impact);
CREATE INDEX IF NOT EXISTS idx_metadata_entity ON document_metadata(entity);
CREATE INDEX IF NOT EXISTS idx_metadata_jurisdiction ON document_metadata(jurisdiction);
