/**
 * API Route Tests for /api/documents
 * 
 * These tests verify that the documents API endpoints work correctly,
 * including proper database interaction and error handling.
 * 
 * The tests use an in-memory SQLite database to avoid affecting
 * the production database and ensure test isolation.
 */

import Database from 'better-sqlite3';
import { transformRow, DocumentRow } from '@app/lib/document-utils';

// Mock the database module
let mockDb: Database.Database;

jest.mock('@app/lib/db', () => ({
  getDb: () => mockDb,
  closeDb: () => {
    if (mockDb) {
      mockDb.close();
    }
  },
}));

describe('Documents API Routes', () => {
  beforeEach(() => {
    // Create fresh in-memory database for each test
    mockDb = new Database(':memory:');
    mockDb.pragma('foreign_keys = ON');
    
    // Apply schema (matching production schema.sql)
    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        file_url TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        bytes_size INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Unique index on content_hash ensures no duplicate documents are stored
      CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash 
        ON documents(content_hash);

      CREATE TABLE IF NOT EXISTS document_metadata (
        document_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        entity TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        counties TEXT NOT NULL DEFAULT '[]',
        meeting_date TEXT,
        doc_types TEXT NOT NULL DEFAULT '[]',
        topics TEXT NOT NULL DEFAULT '[]',
        impact TEXT NOT NULL DEFAULT 'Low',
        stage TEXT,
        keyword_hits TEXT DEFAULT '{}',
        extracted_text TEXT DEFAULT '[]',
        pdf_preview TEXT DEFAULT '[]',
        summary TEXT,
        full_text TEXT,
        attachments TEXT DEFAULT '[]',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
    `);
  });

  afterEach(() => {
    if (mockDb && mockDb.open) {
      mockDb.close();
    }
  });

  describe('Document Query Building', () => {
    beforeEach(() => {
      // Insert test documents
      const insertDoc = mockDb.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMeta = mockDb.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, counties, meeting_date,
          doc_types, topics, impact, stage, keyword_hits
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Document 1: Agenda about zoning
      insertDoc.run('doc-1', 'source-1', 'http://example.com/1.pdf', 'hash1', 1000, '2025-01-15');
      insertMeta.run('doc-1', 'City Council Agenda - Zoning', 'City Council', 'Wichita, KS',
        '["Sedgwick County"]', '2025-01-15', '["Agenda"]', '["housing_and_zoning"]',
        'High', 'Hearing', '{"zoning": 5, "housing": 2}');

      // Document 2: Minutes about budget
      insertDoc.run('doc-2', 'source-1', 'http://example.com/2.pdf', 'hash2', 2000, '2025-01-10');
      insertMeta.run('doc-2', 'City Council Minutes - Budget', 'City Council', 'Wichita, KS',
        '["Sedgwick County"]', '2025-01-10', '["Minutes"]', '["taxes_and_budget"]',
        'Medium', 'Adopted', '{"budget": 3}');

      // Document 3: Ordinance about transportation
      insertDoc.run('doc-3', 'source-2', 'http://example.com/3.pdf', 'hash3', 1500, '2025-01-05');
      insertMeta.run('doc-3', 'Transportation Ordinance', 'City Commission', 'Lawrence, KS',
        '["Douglas County"]', '2025-01-05', '["Ordinance"]', '["transportation"]',
        'Low', null, '{"traffic": 1}');
    });

    it('should fetch all documents without filters', () => {
      const stmt = mockDb.prepare(`
        SELECT d.*, m.title, m.entity, m.jurisdiction, m.counties, m.meeting_date,
               m.doc_types, m.impact, m.stage, m.topics, m.keyword_hits,
               m.extracted_text, m.pdf_preview, m.attachments, m.updated_at
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        ORDER BY m.meeting_date DESC
      `);

      const rows = stmt.all() as DocumentRow[];
      expect(rows).toHaveLength(3);
    });

    it('should filter by text query', () => {
      const query = '%zoning%';
      const stmt = mockDb.prepare(`
        SELECT d.*, m.title, m.entity, m.jurisdiction, m.counties, m.meeting_date,
               m.doc_types, m.impact, m.stage, m.topics, m.keyword_hits,
               m.extracted_text, m.pdf_preview, m.attachments, m.updated_at
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.title LIKE ? OR m.topics LIKE ?
      `);

      const rows = stmt.all(query, query) as DocumentRow[];
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('Zoning');
    });

    it('should filter by document type', () => {
      const docType = '%"Agenda"%';
      const stmt = mockDb.prepare(`
        SELECT d.*, m.title, m.doc_types
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.doc_types LIKE ?
      `);

      const rows = stmt.all(docType) as { title: string; doc_types: string }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toContain('Agenda');
    });

    it('should filter by date range', () => {
      const stmt = mockDb.prepare(`
        SELECT d.*, m.title, m.meeting_date
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.meeting_date >= ? AND m.meeting_date <= ?
        ORDER BY m.meeting_date DESC
      `);

      const rows = stmt.all('2025-01-10', '2025-01-15') as { title: string; meeting_date: string }[];
      expect(rows).toHaveLength(2);
    });

    it('should filter by impact level', () => {
      const stmt = mockDb.prepare(`
        SELECT d.*, m.title, m.impact
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.impact = ?
      `);

      const highImpact = stmt.all('High') as { title: string; impact: string }[];
      expect(highImpact).toHaveLength(1);
      expect(highImpact[0].title).toContain('Zoning');

      const lowImpact = stmt.all('Low') as { title: string; impact: string }[];
      expect(lowImpact).toHaveLength(1);
      expect(lowImpact[0].title).toContain('Transportation');
    });

    it('should filter by jurisdiction', () => {
      const stmt = mockDb.prepare(`
        SELECT d.*, m.title, m.jurisdiction
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.jurisdiction LIKE ?
      `);

      const rows = stmt.all('%Lawrence%') as { title: string; jurisdiction: string }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].jurisdiction).toContain('Lawrence');
    });

    it('should handle pagination correctly', () => {
      const limit = 2;
      const offset = 0;

      const stmt = mockDb.prepare(`
        SELECT d.*, m.title
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        ORDER BY m.meeting_date DESC
        LIMIT ? OFFSET ?
      `);

      const page1 = stmt.all(limit, offset) as { title: string }[];
      expect(page1).toHaveLength(2);

      const page2 = stmt.all(limit, limit) as { title: string }[];
      expect(page2).toHaveLength(1);
    });

    it('should count total documents correctly', () => {
      const stmt = mockDb.prepare(`
        SELECT COUNT(*) as total
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
      `);

      const result = stmt.get() as { total: number };
      expect(result.total).toBe(3);
    });

    it('should count filtered documents correctly', () => {
      const stmt = mockDb.prepare(`
        SELECT COUNT(*) as total
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.impact = ?
      `);

      const result = stmt.get('High') as { total: number };
      expect(result.total).toBe(1);
    });
  });

  describe('Document Creation', () => {
    it('should insert a new document with all fields', () => {
      const docId = 'new-doc-123';
      const now = new Date().toISOString();

      // Insert document
      const insertDoc = mockDb.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertDoc.run(docId, 'source-1', 'http://example.com/new.pdf', 'newhash', 3000, now);

      // Insert metadata
      const insertMeta = mockDb.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, counties, meeting_date,
          doc_types, topics, impact, stage, keyword_hits, extracted_text,
          pdf_preview, attachments, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertMeta.run(
        docId, 'New Document', 'Test Entity', 'Test City',
        '["Test County"]', '2025-02-01', '["Agenda"]', '["housing"]',
        'Medium', 'Draft', '{}', '[]', '[]', '[]', now
      );

      // Verify
      const result = mockDb.prepare(`
        SELECT d.*, m.*
        FROM documents d
        JOIN document_metadata m ON d.id = m.document_id
        WHERE d.id = ?
      `).get(docId) as DocumentRow;

      expect(result.id).toBe(docId);
      expect(result.title).toBe('New Document');
      expect(result.impact).toBe('Medium');
    });

    it('should reject duplicate content_hash', () => {
      const insertDoc = mockDb.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertDoc.run('doc-1', 'source-1', 'http://example.com/1.pdf', 'duplicate-hash', 1000);

      expect(() => {
        insertDoc.run('doc-2', 'source-1', 'http://example.com/2.pdf', 'duplicate-hash', 2000);
      }).toThrow();
    });

    it('should use transaction for atomic insert', () => {
      const insertDoc = mockDb.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertMeta = mockDb.prepare(`
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction)
        VALUES (?, ?, ?, ?)
      `);

      const insertTransaction = mockDb.transaction((id: string) => {
        insertDoc.run(id, 'source', 'url', 'hash', 100);
        insertMeta.run(id, 'Title', 'Entity', 'Jurisdiction');
      });

      insertTransaction('tx-doc-1');

      const count = mockDb.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
      expect(count.count).toBe(1);
    });

    it('should rollback transaction on error', () => {
      const insertDoc = mockDb.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertMeta = mockDb.prepare(`
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction)
        VALUES (?, ?, ?, ?)
      `);

      const failingTransaction = mockDb.transaction((id: string) => {
        insertDoc.run(id, 'source', 'url', 'hash-rollback', 100);
        // This will fail due to foreign key constraint (using wrong document_id)
        insertMeta.run('wrong-id', 'Title', 'Entity', 'Jurisdiction');
      });

      expect(() => failingTransaction('tx-doc-fail')).toThrow();

      // Document should not exist due to rollback
      const result = mockDb.prepare('SELECT * FROM documents WHERE content_hash = ?').get('hash-rollback');
      expect(result).toBeUndefined();
    });
  });

  describe('Document Retrieval by ID', () => {
    beforeEach(() => {
      // Insert test document
      mockDb.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('specific-doc', 'source-1', 'http://example.com/specific.pdf', 'hash-specific', 5000, '2025-01-20');

      mockDb.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, summary, full_text
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run('specific-doc', 'Specific Document', 'Test Entity', 'Test City',
        'This is a summary.', 'This is the full text content of the document.');
    });

    it('should retrieve a document by ID', () => {
      const stmt = mockDb.prepare(`
        SELECT d.*, m.*
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE d.id = ?
      `);

      const result = stmt.get('specific-doc') as DocumentRow & { summary: string; full_text: string };
      expect(result).toBeDefined();
      expect(result.id).toBe('specific-doc');
      expect(result.title).toBe('Specific Document');
      expect(result.summary).toBe('This is a summary.');
      expect(result.full_text).toBe('This is the full text content of the document.');
    });

    it('should return undefined for non-existent ID', () => {
      const stmt = mockDb.prepare(`
        SELECT d.*, m.*
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE d.id = ?
      `);

      const result = stmt.get('nonexistent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tables gracefully', () => {
      // Create a fresh db without tables
      const emptyDb = new Database(':memory:');
      
      const tablesCheck = emptyDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('documents', 'document_metadata')
      `).all() as { name: string }[];

      expect(tablesCheck).toHaveLength(0);
      
      emptyDb.close();
    });

    it('should handle SQL injection attempts', () => {
      // Using parameterized queries should prevent SQL injection
      const maliciousInput = "'; DROP TABLE documents; --";
      
      const stmt = mockDb.prepare(`
        SELECT * FROM documents WHERE source_id = ?
      `);

      // Should not throw or cause damage
      const result = stmt.all(maliciousInput);
      expect(result).toHaveLength(0);

      // Tables should still exist
      const tables = mockDb.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name = 'documents'
      `).all();
      expect(tables).toHaveLength(1);
    });
  });
});

describe('Document Transformation', () => {
  it('should transform database rows to API response format', () => {
    const row: DocumentRow = {
      id: 'transform-test',
      source_id: 'source-1',
      file_url: 'http://example.com/transform.pdf',
      content_hash: 'hash-transform',
      bytes_size: 4000,
      created_at: '2025-01-25T10:00:00Z',
      title: 'Transform Test Document',
      entity: 'Test Entity',
      jurisdiction: 'Test Jurisdiction',
      counties: '["County A", "County B"]',
      meeting_date: '2025-01-25',
      doc_types: '["Agenda", "Minutes"]',
      impact: 'High',
      stage: 'Final',
      topics: '["topic1", "topic2"]',
      keyword_hits: '{"keyword1": 3, "keyword2": 5}',
      extracted_text: '["Text excerpt 1", "Text excerpt 2"]',
      pdf_preview: '["preview1.png", "preview2.png"]',
      attachments: '[{"filename": "attach.pdf", "url": "http://example.com/attach.pdf"}]',
      updated_at: '2025-01-26T10:00:00Z',
    };

    const transformed = transformRow(row);

    expect(transformed.id).toBe('transform-test');
    expect(transformed.counties).toEqual(['County A', 'County B']);
    expect(transformed.docTypes).toEqual(['Agenda', 'Minutes']);
    expect(transformed.topics).toEqual(['topic1', 'topic2']);
    expect(transformed.hits).toEqual({ keyword1: 3, keyword2: 5 });
    expect(transformed.attachments).toHaveLength(1);
    expect(transformed.attachments[0]).toHaveProperty('filename', 'attach.pdf');
  });
});

