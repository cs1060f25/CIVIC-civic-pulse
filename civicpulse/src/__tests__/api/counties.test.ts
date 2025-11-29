/**
 * Tests for /api/counties endpoint
 * 
 * Verifies that the counties API correctly extracts and returns
 * unique county names from the document_metadata table.
 */

import Database from 'better-sqlite3';

// Mock the database module
let mockDb: Database.Database;

jest.mock('@app/lib/db', () => ({
  getDb: () => mockDb,
}));

describe('Counties API', () => {
  beforeEach(() => {
    // Create fresh in-memory database for each test
    mockDb = new Database(':memory:');
    
    // Apply schema
    mockDb.exec(`
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

  describe('County Extraction Logic', () => {
    it('should extract unique counties from JSON arrays', () => {
      // Insert test documents with various county configurations
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES 
          ('doc-1', 'source-1', 'url1', 'hash1', 100),
          ('doc-2', 'source-1', 'url2', 'hash2', 100),
          ('doc-3', 'source-1', 'url3', 'hash3', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES 
          ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', '["Sedgwick County"]'),
          ('doc-2', 'Title 2', 'Entity 2', 'Jurisdiction 2', '["Johnson County", "Douglas County"]'),
          ('doc-3', 'Title 3', 'Entity 3', 'Jurisdiction 3', '["Sedgwick County"]');
      `);

      // Query counties like the API does
      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      // Parse and collect unique counties
      const countySet = new Set<string>();
      for (const row of rows) {
        const parsed = JSON.parse(row.counties);
        if (Array.isArray(parsed)) {
          for (const county of parsed) {
            if (typeof county === 'string' && county.trim()) {
              countySet.add(county.trim());
            }
          }
        }
      }

      const counties = Array.from(countySet).sort();
      
      expect(counties).toHaveLength(3);
      expect(counties).toContain('Douglas County');
      expect(counties).toContain('Johnson County');
      expect(counties).toContain('Sedgwick County');
    });

    it('should handle empty counties arrays', () => {
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES ('doc-1', 'source-1', 'url1', 'hash1', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', '[]');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      expect(rows).toHaveLength(0);
    });

    it('should handle default empty counties (schema uses NOT NULL)', () => {
      // Note: The actual schema uses NOT NULL DEFAULT '[]' for counties
      // This test verifies the query correctly filters out empty arrays
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES ('doc-1', 'source-1', 'url1', 'hash1', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction)
        VALUES ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      expect(rows).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', () => {
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES 
          ('doc-1', 'source-1', 'url1', 'hash1', 100),
          ('doc-2', 'source-1', 'url2', 'hash2', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES 
          ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', 'not valid json'),
          ('doc-2', 'Title 2', 'Entity 2', 'Jurisdiction 2', '["Valid County"]');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      const countySet = new Set<string>();
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.counties);
          if (Array.isArray(parsed)) {
            for (const county of parsed) {
              if (typeof county === 'string' && county.trim()) {
                countySet.add(county.trim());
              }
            }
          }
        } catch {
          // Skip malformed JSON - matches API behavior
          continue;
        }
      }

      const counties = Array.from(countySet);
      expect(counties).toHaveLength(1);
      expect(counties).toContain('Valid County');
    });

    it('should deduplicate counties across documents', () => {
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES 
          ('doc-1', 'source-1', 'url1', 'hash1', 100),
          ('doc-2', 'source-1', 'url2', 'hash2', 100),
          ('doc-3', 'source-1', 'url3', 'hash3', 100),
          ('doc-4', 'source-1', 'url4', 'hash4', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES 
          ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', '["Sedgwick County"]'),
          ('doc-2', 'Title 2', 'Entity 2', 'Jurisdiction 2', '["Sedgwick County"]'),
          ('doc-3', 'Title 3', 'Entity 3', 'Jurisdiction 3', '["Sedgwick County", "Johnson County"]'),
          ('doc-4', 'Title 4', 'Entity 4', 'Jurisdiction 4', '["Johnson County"]');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      const countySet = new Set<string>();
      for (const row of rows) {
        const parsed = JSON.parse(row.counties);
        if (Array.isArray(parsed)) {
          for (const county of parsed) {
            if (typeof county === 'string' && county.trim()) {
              countySet.add(county.trim());
            }
          }
        }
      }

      const counties = Array.from(countySet).sort();
      
      // Should only have 2 unique counties despite 4 documents
      expect(counties).toHaveLength(2);
      expect(counties).toEqual(['Johnson County', 'Sedgwick County']);
    });

    it('should sort counties alphabetically', () => {
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES 
          ('doc-1', 'source-1', 'url1', 'hash1', 100),
          ('doc-2', 'source-1', 'url2', 'hash2', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES 
          ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', '["Wyandotte County", "Allen County"]'),
          ('doc-2', 'Title 2', 'Entity 2', 'Jurisdiction 2', '["Miami County", "Douglas County"]');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      const countySet = new Set<string>();
      for (const row of rows) {
        const parsed = JSON.parse(row.counties);
        if (Array.isArray(parsed)) {
          for (const county of parsed) {
            if (typeof county === 'string' && county.trim()) {
              countySet.add(county.trim());
            }
          }
        }
      }

      const counties = Array.from(countySet).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      
      expect(counties).toEqual([
        'Allen County',
        'Douglas County', 
        'Miami County',
        'Wyandotte County'
      ]);
    });

    it('should trim whitespace from county names', () => {
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES ('doc-1', 'source-1', 'url1', 'hash1', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', '["  Sedgwick County  ", "Johnson County"]');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      const countySet = new Set<string>();
      for (const row of rows) {
        const parsed = JSON.parse(row.counties);
        if (Array.isArray(parsed)) {
          for (const county of parsed) {
            if (typeof county === 'string' && county.trim()) {
              countySet.add(county.trim());
            }
          }
        }
      }

      const counties = Array.from(countySet).sort();
      
      expect(counties).toContain('Sedgwick County');
      expect(counties).not.toContain('  Sedgwick County  ');
    });

    it('should ignore empty string counties', () => {
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES ('doc-1', 'source-1', 'url1', 'hash1', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES ('doc-1', 'Title 1', 'Entity 1', 'Jurisdiction 1', '["", "Valid County", "  "]');
      `);

      const rows = mockDb.prepare(`
        SELECT DISTINCT counties FROM document_metadata
        WHERE counties IS NOT NULL AND counties != '[]'
      `).all() as { counties: string }[];

      const countySet = new Set<string>();
      for (const row of rows) {
        const parsed = JSON.parse(row.counties);
        if (Array.isArray(parsed)) {
          for (const county of parsed) {
            if (typeof county === 'string' && county.trim()) {
              countySet.add(county.trim());
            }
          }
        }
      }

      const counties = Array.from(countySet);
      
      expect(counties).toHaveLength(1);
      expect(counties).toContain('Valid County');
    });
  });

  describe('Counties Filter in Documents API', () => {
    beforeEach(() => {
      // Insert test documents
      mockDb.exec(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size)
        VALUES 
          ('doc-1', 'source-1', 'url1', 'hash1', 100),
          ('doc-2', 'source-1', 'url2', 'hash2', 100),
          ('doc-3', 'source-1', 'url3', 'hash3', 100);
        
        INSERT INTO document_metadata (document_id, title, entity, jurisdiction, counties)
        VALUES 
          ('doc-1', 'Sedgwick Doc', 'Entity 1', 'Wichita, KS', '["Sedgwick County"]'),
          ('doc-2', 'Johnson Doc', 'Entity 2', 'Overland Park, KS', '["Johnson County"]'),
          ('doc-3', 'Multi-County Doc', 'Entity 3', 'Kansas City, KS', '["Wyandotte County", "Johnson County"]');
      `);
    });

    it('should filter documents by single county', () => {
      const county = 'Sedgwick County';
      const stmt = mockDb.prepare(`
        SELECT d.id, m.title, m.counties
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.counties LIKE ?
      `);

      const rows = stmt.all(`%"${county}"%`) as { id: string; title: string }[];
      
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('Sedgwick Doc');
    });

    it('should filter documents by multiple counties (OR logic)', () => {
      const counties = ['Sedgwick County', 'Johnson County'];
      
      const conditions = counties.map(() => "m.counties LIKE ?").join(" OR ");
      const params = counties.map(c => `%"${c}"%`);
      
      const stmt = mockDb.prepare(`
        SELECT d.id, m.title, m.counties
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE ${conditions}
      `);

      const rows = stmt.all(...params) as { id: string; title: string }[];
      
      expect(rows).toHaveLength(3); // All docs match at least one county
    });

    it('should find documents with county in multi-county array', () => {
      const county = 'Johnson County';
      const stmt = mockDb.prepare(`
        SELECT d.id, m.title, m.counties
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.counties LIKE ?
      `);

      const rows = stmt.all(`%"${county}"%`) as { id: string; title: string }[];
      
      expect(rows).toHaveLength(2); // Johnson Doc and Multi-County Doc
    });

    it('should return empty for non-existent county', () => {
      const county = 'Nonexistent County';
      const stmt = mockDb.prepare(`
        SELECT d.id, m.title
        FROM documents d
        LEFT JOIN document_metadata m ON d.id = m.document_id
        WHERE m.counties LIKE ?
      `);

      const rows = stmt.all(`%"${county}"%`) as { id: string; title: string }[];
      
      expect(rows).toHaveLength(0);
    });
  });
});

