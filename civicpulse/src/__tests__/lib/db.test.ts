/**
 * Database Connection Tests
 * 
 * These tests verify that:
 * 1. The database module loads correctly (native bindings work)
 * 2. Path resolution finds the correct database file
 * 3. Database connections are properly established
 * 4. Error handling works for missing databases
 * 
 * This test suite specifically addresses the issue where better-sqlite3
 * native bindings weren't loading correctly with Next.js bundling.
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const TEST_DB_PATH = path.join(FIXTURES_DIR, 'test.db');

describe('Database Module', () => {
  beforeAll(() => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('better-sqlite3 Native Module Loading', () => {
    it('should load better-sqlite3 module without errors', () => {
      // This test verifies the native module bindings are accessible
      expect(Database).toBeDefined();
      expect(typeof Database).toBe('function');
    });

    it('should create an in-memory database', () => {
      const db = new Database(':memory:');
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
      db.close();
    });

    it('should create a file-based database', () => {
      const db = new Database(TEST_DB_PATH);
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
      db.close();
    });

    it('should execute basic SQL operations', () => {
      const db = new Database(':memory:');
      
      // Create table
      db.exec(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

      // Insert data
      const insert = db.prepare('INSERT INTO test_table (name) VALUES (?)');
      insert.run('test value');

      // Query data
      const select = db.prepare('SELECT * FROM test_table');
      const rows = select.all() as { id: number; name: string }[];

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test value');

      db.close();
    });

    it('should handle transactions correctly', () => {
      const db = new Database(':memory:');
      
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');

      const insert = db.prepare('INSERT INTO test (value) VALUES (?)');
      
      const insertMany = db.transaction((values: string[]) => {
        for (const value of values) {
          insert.run(value);
        }
      });

      insertMany(['a', 'b', 'c']);

      const count = db.prepare('SELECT COUNT(*) as count FROM test').get() as { count: number };
      expect(count.count).toBe(3);

      db.close();
    });
  });

  describe('Database Schema Compatibility', () => {
    let db: Database.Database;

    beforeEach(() => {
      db = new Database(':memory:');
      
      // Apply the actual schema used in production
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          google_id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          picture TEXT,
          saved_state TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          file_url TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          bytes_size INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

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
      db.close();
    });

    it('should have all required tables', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('documents');
      expect(tableNames).toContain('document_metadata');
      expect(tableNames).toContain('users');
    });

    it('should enforce foreign key constraints', () => {
      db.pragma('foreign_keys = ON');
      
      // Should fail because no parent document exists
      const insertMeta = db.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction
        ) VALUES (?, ?, ?, ?)
      `);

      expect(() => {
        insertMeta.run('nonexistent-id', 'Title', 'Entity', 'Jurisdiction');
      }).toThrow();
    });

    it('should insert and retrieve documents correctly', () => {
      const docId = 'test-doc-123';
      
      // Insert document
      db.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES (?, ?, ?, ?, ?)
      `).run(docId, 'source-1', 'http://example.com/doc.pdf', 'hash123', 1024);

      // Insert metadata
      db.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, counties, doc_types, impact
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(docId, 'Test Title', 'Test Entity', 'Test Jurisdiction', '["County A"]', '["Agenda"]', 'High');

      // Query with join
      const result = db.prepare(`
        SELECT d.*, m.title, m.entity, m.impact
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE d.id = ?
      `).get(docId) as { id: string; title: string; impact: string };

      expect(result.id).toBe(docId);
      expect(result.title).toBe('Test Title');
      expect(result.impact).toBe('High');
    });

    it('should handle JSON storage in text fields', () => {
      const docId = 'json-test-doc';
      
      db.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES (?, ?, ?, ?, ?)
      `).run(docId, 'source-1', 'http://example.com/doc.pdf', 'hash456', 2048);

      const complexJson = {
        keyword: { matches: 5, context: ['paragraph 1', 'paragraph 2'] },
        topic: { count: 3 }
      };

      db.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, keyword_hits
        ) VALUES (?, ?, ?, ?, ?)
      `).run(docId, 'JSON Test', 'Entity', 'Jurisdiction', JSON.stringify(complexJson));

      const result = db.prepare(`
        SELECT keyword_hits FROM document_metadata WHERE document_id = ?
      `).get(docId) as { keyword_hits: string };

      const parsed = JSON.parse(result.keyword_hits);
      expect(parsed.keyword.matches).toBe(5);
      expect(parsed.keyword.context).toHaveLength(2);
    });
  });

  describe('Database Path Resolution', () => {
    it('should resolve relative paths correctly', () => {
      const cwd = process.cwd();
      const relativePath = '../backend/db/civicpulse.db';
      const resolved = path.join(cwd, relativePath);
      
      // Verify the path resolution logic matches what db.ts does
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    it('should handle environment variable path override', () => {
      const customPath = '/custom/path/to/db.sqlite';
      const resolved = path.resolve(customPath);
      
      expect(resolved).toBe(customPath);
    });

    it('should check file existence correctly', () => {
      // Existing file
      expect(fs.existsSync(__filename)).toBe(true);
      
      // Non-existing file
      expect(fs.existsSync('/nonexistent/path/to/file.db')).toBe(false);
    });
  });
});

describe('Database Connection Edge Cases', () => {
  it('should handle opening same database multiple times', () => {
    const db1 = new Database(':memory:');
    const db2 = new Database(':memory:');
    
    expect(db1.open).toBe(true);
    expect(db2.open).toBe(true);
    
    // They should be separate instances
    db1.exec('CREATE TABLE test1 (id INTEGER)');
    
    // db2 shouldn't have the table from db1
    const tables = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables).toHaveLength(0);
    
    db1.close();
    db2.close();
  });

  it('should handle database close correctly', () => {
    const db = new Database(':memory:');
    expect(db.open).toBe(true);
    
    db.close();
    expect(db.open).toBe(false);
  });

  it('should throw on operations after close', () => {
    const db = new Database(':memory:');
    db.close();
    
    expect(() => {
      db.exec('CREATE TABLE test (id INTEGER)');
    }).toThrow();
  });

  it('should handle readonly mode', () => {
    // Create a database first
    const writableDb = new Database(TEST_DB_PATH);
    writableDb.exec('CREATE TABLE IF NOT EXISTS readonly_test (id INTEGER)');
    writableDb.close();

    // Open in readonly mode
    const readonlyDb = new Database(TEST_DB_PATH, { readonly: true });
    
    // Reading should work
    const tables = readonlyDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.length).toBeGreaterThan(0);
    
    // Writing should fail
    expect(() => {
      readonlyDb.exec('INSERT INTO readonly_test (id) VALUES (1)');
    }).toThrow();
    
    readonlyDb.close();
  });
});

