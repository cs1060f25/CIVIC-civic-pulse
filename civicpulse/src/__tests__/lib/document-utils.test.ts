/**
 * Tests for document utility functions
 * 
 * These tests verify the core data transformation and parsing logic
 * used across the application.
 */

import { parseJSON, transformRow, DocumentRow } from '@app/lib/document-utils';

describe('parseJSON', () => {
  it('should parse valid JSON string', () => {
    const result = parseJSON('["a", "b", "c"]', []);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should return default value for null input', () => {
    const result = parseJSON(null, ['default']);
    expect(result).toEqual(['default']);
  });

  it('should return default value for empty string', () => {
    const result = parseJSON('', { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it('should return default value for invalid JSON', () => {
    const result = parseJSON('not valid json {', []);
    expect(result).toEqual([]);
  });

  it('should parse nested objects correctly', () => {
    const input = '{"key": {"nested": [1, 2, 3]}}';
    const result = parseJSON<Record<string, unknown>>(input, {});
    expect(result).toEqual({ key: { nested: [1, 2, 3] } });
  });

  it('should handle empty arrays', () => {
    const result = parseJSON('[]', ['default']);
    expect(result).toEqual([]);
  });

  it('should handle empty objects', () => {
    const result = parseJSON('{}', { default: true });
    expect(result).toEqual({});
  });
});

describe('transformRow', () => {
  const createMockRow = (overrides: Partial<DocumentRow> = {}): DocumentRow => ({
    id: 'test-id-123',
    source_id: 'source-1',
    file_url: 'https://example.com/doc.pdf',
    content_hash: 'abc123hash',
    bytes_size: 1024,
    created_at: '2025-01-01T00:00:00Z',
    title: 'Test Document Title',
    entity: 'Test City Council',
    jurisdiction: 'Test City, KS',
    counties: '["Test County"]',
    meeting_date: '2025-01-15',
    doc_types: '["Agenda", "Minutes"]',
    impact: 'Medium',
    stage: 'Hearing',
    topics: '["housing", "zoning"]',
    keyword_hits: '{"zoning": 5, "housing": 3}',
    extracted_text: '["First paragraph", "Second paragraph"]',
    pdf_preview: '["preview_page_1.png"]',
    attachments: '[{"filename": "attachment.pdf"}]',
    updated_at: '2025-01-02T00:00:00Z',
    ...overrides,
  });

  it('should transform a complete row correctly', () => {
    const row = createMockRow();
    const result = transformRow(row);

    expect(result).toEqual({
      id: 'test-id-123',
      sourceId: 'source-1',
      fileUrl: 'https://example.com/doc.pdf',
      contentHash: 'abc123hash',
      bytesSize: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      title: 'Test Document Title',
      entity: 'Test City Council',
      jurisdiction: 'Test City, KS',
      counties: ['Test County'],
      meetingDate: '2025-01-15',
      docTypes: ['Agenda', 'Minutes'],
      impact: 'Medium',
      stage: 'Hearing',
      topics: ['housing', 'zoning'],
      hits: { zoning: 5, housing: 3 },
      extractedText: ['First paragraph', 'Second paragraph'],
      pdfPreview: ['preview_page_1.png'],
      attachments: [{ filename: 'attachment.pdf' }],
      updatedAt: '2025-01-02T00:00:00Z',
    });
  });

  it('should handle null title with default "Untitled"', () => {
    const row = createMockRow({ title: null });
    const result = transformRow(row);
    expect(result.title).toBe('Untitled');
  });

  it('should handle null entity with default "Unknown"', () => {
    const row = createMockRow({ entity: null });
    const result = transformRow(row);
    expect(result.entity).toBe('Unknown');
  });

  it('should handle null jurisdiction with default "Unknown"', () => {
    const row = createMockRow({ jurisdiction: null });
    const result = transformRow(row);
    expect(result.jurisdiction).toBe('Unknown');
  });

  it('should handle null counties with empty array', () => {
    const row = createMockRow({ counties: null });
    const result = transformRow(row);
    expect(result.counties).toEqual([]);
  });

  it('should handle null doc_types with empty array', () => {
    const row = createMockRow({ doc_types: null });
    const result = transformRow(row);
    expect(result.docTypes).toEqual([]);
  });

  it('should handle null impact with default "Low"', () => {
    const row = createMockRow({ impact: null });
    const result = transformRow(row);
    expect(result.impact).toBe('Low');
  });

  it('should handle null stage with undefined', () => {
    const row = createMockRow({ stage: null });
    const result = transformRow(row);
    expect(result.stage).toBeUndefined();
  });

  it('should handle null topics with empty array', () => {
    const row = createMockRow({ topics: null });
    const result = transformRow(row);
    expect(result.topics).toEqual([]);
  });

  it('should handle null keyword_hits with empty object', () => {
    const row = createMockRow({ keyword_hits: null });
    const result = transformRow(row);
    expect(result.hits).toEqual({});
  });

  it('should use created_at as updatedAt fallback when updated_at is null', () => {
    const row = createMockRow({ updated_at: null });
    const result = transformRow(row);
    expect(result.updatedAt).toBe(row.created_at);
  });

  it('should handle invalid JSON in counties gracefully', () => {
    const row = createMockRow({ counties: 'not valid json' });
    const result = transformRow(row);
    expect(result.counties).toEqual([]);
  });

  it('should handle all null optional fields', () => {
    const row = createMockRow({
      title: null,
      entity: null,
      jurisdiction: null,
      counties: null,
      meeting_date: null,
      doc_types: null,
      impact: null,
      stage: null,
      topics: null,
      keyword_hits: null,
      extracted_text: null,
      pdf_preview: null,
      attachments: null,
      updated_at: null,
    });

    const result = transformRow(row);

    expect(result.title).toBe('Untitled');
    expect(result.entity).toBe('Unknown');
    expect(result.jurisdiction).toBe('Unknown');
    expect(result.counties).toEqual([]);
    expect(result.meetingDate).toBeNull();
    expect(result.docTypes).toEqual([]);
    expect(result.impact).toBe('Low');
    expect(result.stage).toBeUndefined();
    expect(result.topics).toEqual([]);
    expect(result.hits).toEqual({});
    expect(result.extractedText).toEqual([]);
    expect(result.pdfPreview).toEqual([]);
    expect(result.attachments).toEqual([]);
    expect(result.updatedAt).toBe(row.created_at);
  });

  it('should preserve impact values High, Medium, Low', () => {
    expect(transformRow(createMockRow({ impact: 'High' })).impact).toBe('High');
    expect(transformRow(createMockRow({ impact: 'Medium' })).impact).toBe('Medium');
    expect(transformRow(createMockRow({ impact: 'Low' })).impact).toBe('Low');
  });
});

