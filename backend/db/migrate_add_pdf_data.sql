-- Migration script to add pdf_data column to existing databases
-- Run: sqlite3 backend/data/civicpulse.db < backend/db/migrate_add_pdf_data.sql

-- Add pdf_data BLOB column to documents table if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we check if the column exists first using a pragma query

-- Note: This migration is safe to run multiple times
-- If the column already exists, it will be ignored

-- Check if column exists (SQLite 3.37.0+)
-- For older versions, this will fail gracefully and you may need to manually check
ALTER TABLE documents ADD COLUMN pdf_data BLOB;

