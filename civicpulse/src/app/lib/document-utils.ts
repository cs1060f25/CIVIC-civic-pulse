// Shared utilities for document API routes

// Type definitions matching our schema
export interface DocumentRow {
  id: string;
  source_id: string;
  file_url: string;
  content_hash: string;
  bytes_size: number;
  created_at: string;
  title: string | null;
  entity: string | null;
  jurisdiction: string | null;
  counties: string | null;
  meeting_date: string | null;
  doc_types: string | null;
  impact: string | null;
  stage: string | null;
  topics: string | null;
  keyword_hits: string | null;
  extracted_text: string | null;
  pdf_preview: string | null;
  summary: string | null;
  full_text: string | null;
  attachments: string | null;
  updated_at: string | null;
}

export interface FeedItem {
  id: string;
  sourceId: string;
  fileUrl: string;
  contentHash: string;
  bytesSize: number;
  createdAt: string;
  title: string;
  entity: string;
  jurisdiction: string;
  counties: string[];
  meetingDate: string | null;
  docTypes: string[];
  impact: "Low" | "Medium" | "High" | null;
  stage?: string;
  topics: string[];
  hits: Record<string, number>;
  extractedText?: string[];
  pdfPreview?: string[];
  summary?: string;
  fullText?: string;
  attachments: Record<string, unknown>[];
  updatedAt: string;
}

// Helper to parse JSON fields safely
export function parseJSON<T>(value: string | null, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

// Transform database row to FeedItem
export function transformRow(row: DocumentRow): FeedItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    fileUrl: row.file_url,
    contentHash: row.content_hash,
    bytesSize: row.bytes_size,
    createdAt: row.created_at,
    title: row.title || "Untitled",
    entity: row.entity || "Unknown",
    jurisdiction: row.jurisdiction || "Unknown",
    counties: parseJSON<string[]>(row.counties, []),
    meetingDate: row.meeting_date,
    docTypes: parseJSON<string[]>(row.doc_types, []),
    impact: (row.impact as "Low" | "Medium" | "High" | null) || null,
    stage: row.stage || undefined,
    topics: parseJSON<string[]>(row.topics, []),
    hits: parseJSON<Record<string, number>>(row.keyword_hits, {}),
    extractedText: parseJSON<string[]>(row.extracted_text, []),
    pdfPreview: parseJSON<string[]>(row.pdf_preview, []),
    summary: row.summary || undefined,
    fullText: row.full_text || undefined,
    attachments: parseJSON<Record<string, unknown>[]>(row.attachments, []),
    updatedAt: row.updated_at || row.created_at,
  };
}
