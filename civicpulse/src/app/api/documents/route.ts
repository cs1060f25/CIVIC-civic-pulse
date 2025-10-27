import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

// Type definitions matching our schema
interface DocumentRow {
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
  attachments: string | null;
  updated_at: string | null;
}

interface FeedItem {
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
  impact: "Low" | "Medium" | "High";
  stage?: string;
  topics: string[];
  hits: Record<string, number>;
  extractedText?: string[];
  pdfPreview?: string[];
  attachments: any[];
  updatedAt: string;
}

// Helper to parse JSON fields safely
function parseJSON<T>(value: string | null, defaultValue: T): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

// Transform database row to FeedItem
function transformRow(row: DocumentRow): FeedItem {
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
    impact: (row.impact as "Low" | "Medium" | "High") || "Low",
    stage: row.stage || undefined,
    topics: parseJSON<string[]>(row.topics, []),
    hits: parseJSON<Record<string, number>>(row.keyword_hits, {}),
    extractedText: parseJSON<string[]>(row.extracted_text, []),
    pdfPreview: parseJSON<string[]>(row.pdf_preview, []),
    attachments: parseJSON<any[]>(row.attachments, []),
    updatedAt: row.updated_at || row.created_at,
  };
}

// GET /api/documents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const query = searchParams.get("query") || "";
    const docTypes = searchParams.get("docTypes")?.split(",").filter(Boolean) || [];
    const counties = searchParams.get("counties")?.split(",").filter(Boolean) || [];
    const impact = searchParams.get("impact")?.split(",").filter(Boolean) || [];
    const stage = searchParams.get("stage")?.split(",").filter(Boolean) || [];
    const topics = searchParams.get("topics")?.split(",").filter(Boolean) || [];
    
    // Date filtering
    const meetingDateFrom = searchParams.get("meetingDateFrom");
    const meetingDateTo = searchParams.get("meetingDateTo");
    const daysBack = searchParams.get("daysBack") ? parseInt(searchParams.get("daysBack")!) : null;
    
    // Pagination
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    
    // Sorting
    const sortBy = searchParams.get("sortBy") || "meetingDate";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    
    const db = getDb();
    
    // Build query
    let sql = `
      SELECT 
        d.id, d.source_id, d.file_url, d.content_hash, d.bytes_size, d.created_at,
        m.title, m.entity, m.jurisdiction, m.counties, m.meeting_date, m.doc_types,
        m.impact, m.stage, m.topics, m.keyword_hits, m.extracted_text, m.pdf_preview,
        m.attachments, m.updated_at
      FROM documents d
      LEFT JOIN document_metadata m ON d.id = m.document_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Text search
    if (query) {
      sql += ` AND (
        m.title LIKE ? OR 
        m.entity LIKE ? OR 
        m.topics LIKE ? OR
        m.extracted_text LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Document types filter
    if (docTypes.length > 0) {
      const docTypeConditions = docTypes.map(() => "m.doc_types LIKE ?").join(" OR ");
      sql += ` AND (${docTypeConditions})`;
      docTypes.forEach(dt => params.push(`%"${dt}"%`));
    }
    
    // Counties filter
    if (counties.length > 0) {
      const countyConditions = counties.map(() => "m.counties LIKE ?").join(" OR ");
      sql += ` AND (${countyConditions})`;
      counties.forEach(c => params.push(`%"${c}"%`));
    }
    
    // Impact filter
    if (impact.length > 0) {
      const impactPlaceholders = impact.map(() => "?").join(",");
      sql += ` AND m.impact IN (${impactPlaceholders})`;
      params.push(...impact);
    }
    
    // Stage filter
    if (stage.length > 0) {
      const stagePlaceholders = stage.map(() => "?").join(",");
      sql += ` AND m.stage IN (${stagePlaceholders})`;
      params.push(...stage);
    }
    
    // Topics filter
    if (topics.length > 0) {
      const topicConditions = topics.map(() => "m.topics LIKE ?").join(" OR ");
      sql += ` AND (${topicConditions})`;
      topics.forEach(t => params.push(`%"${t}"%`));
    }
    
    // Date filtering
    if (meetingDateFrom) {
      sql += ` AND m.meeting_date >= ?`;
      params.push(meetingDateFrom);
    }
    if (meetingDateTo) {
      sql += ` AND m.meeting_date <= ?`;
      params.push(meetingDateTo);
    }
    if (daysBack) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      sql += ` AND m.meeting_date >= ?`;
      params.push(cutoffDate.toISOString().split('T')[0]);
    }
    
    // Count total (before pagination)
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(*) as total FROM");
    const countResult = db.prepare(countSql).get(...params) as { total: number };
    const total = countResult?.total || 0;
    
    // Sorting
    const sortColumn = sortBy === "meetingDate" ? "m.meeting_date" :
                       sortBy === "createdAt" ? "d.created_at" :
                       sortBy === "impact" ? "m.impact" :
                       sortBy === "title" ? "m.title" : "m.meeting_date";
    const order = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";
    sql += ` ORDER BY ${sortColumn} ${order}`;
    
    // Pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    // Execute query
    const rows = db.prepare(sql).all(...params) as DocumentRow[];
    
    // Transform results
    const documents = rows.map(transformRow);
    
    return NextResponse.json({
      documents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
    
  } catch (error: any) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/documents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ["sourceId", "fileUrl", "contentHash", "bytesSize", "title", "entity", "jurisdiction"];
    const missing = requiredFields.filter(field => !body[field]);
    
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Missing required fields",
          fields: Object.fromEntries(missing.map(f => [f, "Required"])),
        },
        { status: 400 }
      );
    }
    
    const db = getDb();
    
    // Check for duplicate content_hash
    const existing = db.prepare("SELECT id FROM documents WHERE content_hash = ?").get(body.contentHash) as { id: string } | undefined;
    
    if (existing) {
      return NextResponse.json(
        {
          error: "DUPLICATE_DOCUMENT",
          message: "Document with this content hash already exists",
          existingDocumentId: existing.id,
          contentHash: body.contentHash,
        },
        { status: 409 }
      );
    }
    
    // Generate ID
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // Start transaction
    const insert = db.transaction(() => {
      // Insert into documents table
      db.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.sourceId,
        body.fileUrl,
        body.contentHash,
        body.bytesSize,
        now
      );
      
      // Insert into document_metadata table
      db.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, counties, meeting_date,
          doc_types, topics, impact, stage, keyword_hits, extracted_text,
          pdf_preview, attachments, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.title,
        body.entity,
        body.jurisdiction,
        JSON.stringify(body.counties || []),
        body.meetingDate || null,
        JSON.stringify(body.docTypes || []),
        JSON.stringify(body.topics || []),
        body.impact || "Low",
        body.stage || null,
        JSON.stringify(body.keywordHits || {}),
        JSON.stringify(body.extractedText || []),
        JSON.stringify(body.pdfPreview || []),
        JSON.stringify(body.attachments || []),
        now
      );
    });
    
    insert();
    
    // Fetch and return created document
    const row = db.prepare(`
      SELECT 
        d.id, d.source_id, d.file_url, d.content_hash, d.bytes_size, d.created_at,
        m.title, m.entity, m.jurisdiction, m.counties, m.meeting_date, m.doc_types,
        m.impact, m.stage, m.topics, m.keyword_hits, m.extracted_text, m.pdf_preview,
        m.attachments, m.updated_at
      FROM documents d
      JOIN document_metadata m ON d.id = m.document_id
      WHERE d.id = ?
    `).get(id) as DocumentRow;
    
    const document = transformRow(row);
    
    return NextResponse.json(document, { status: 201 });
    
  } catch (error: any) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
