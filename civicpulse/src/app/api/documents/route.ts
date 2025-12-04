import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@app/lib/db";
import { randomUUID } from "crypto";
import { DocumentRow, transformRow } from "@app/lib/document-utils";

// GET /api/documents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const googleId = searchParams.get("googleId");
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
    
    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error(
        "Database not available for /api/documents, returning empty result set:",
        err
      );
      return NextResponse.json(
        {
          documents: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
        },
        { status: 200 }
      );
    }
    
    // Check if tables exist
    const tablesCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('documents', 'document_metadata')").all() as { name: string }[];
    if (tablesCheck.length < 2) {
      console.error("Database tables missing. Found tables:", tablesCheck.map(t => t.name));
      return NextResponse.json(
        { error: "Database tables not found. Please initialize the database." },
        { status: 500 }
      );
    }
    
    // Build query with user-specific metadata join if googleId is provided
    let sql = `
      SELECT 
        d.id, d.source_id, d.file_url, d.content_hash, d.bytes_size, d.created_at,
        m.title, m.entity, m.jurisdiction, m.counties, m.meeting_date, m.doc_types,
        COALESCE(um.impact, m.impact) as impact,
        COALESCE(um.stage, m.stage) as stage,
        COALESCE(um.topics, m.topics) as topics,
        m.keyword_hits, m.extracted_text, m.pdf_preview,
        m.summary, m.full_text, m.attachments, m.updated_at
      FROM documents d
      LEFT JOIN document_metadata m ON d.id = m.document_id
      ${googleId ? "LEFT JOIN user_document_metadata um ON d.id = um.document_id AND um.user_google_id = ?" : ""}
      WHERE 1=1
    `;
    
    const params: (string | number)[] = [];
    
    // Add googleId to params if provided (must be first for the LEFT JOIN)
    if (googleId) {
      params.push(googleId);
    }
    
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
    
    // Impact filter (use COALESCE to check both user and global metadata)
    if (impact.length > 0) {
      const impactPlaceholders = impact.map(() => "?").join(",");
      sql += ` AND COALESCE(um.impact, m.impact) IN (${impactPlaceholders})`;
      params.push(...impact);
    }
    
    // Stage filter (use COALESCE to check both user and global metadata)
    if (stage.length > 0) {
      const stagePlaceholders = stage.map(() => "?").join(",");
      sql += ` AND COALESCE(um.stage, m.stage) IN (${stagePlaceholders})`;
      params.push(...stage);
    }
    
    // Topics filter (use COALESCE to check both user and global metadata)
    if (topics.length > 0) {
      const topicConditions = topics.map(() => "COALESCE(um.topics, m.topics) LIKE ?").join(" OR ");
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
    // Remove ORDER BY, LIMIT, and OFFSET from count query
    const countSql = sql.replace(/ORDER BY[\s\S]*$/, "").replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(*) as total FROM");
    const countResult = db.prepare(countSql).get(...params.slice(0, params.length - 2)) as { total: number };
    const total = countResult?.total || 0;
    
    // Sorting (use COALESCE for impact to sort by user-specific value if available)
    const sortColumn = sortBy === "meetingDate" ? "m.meeting_date" :
                       sortBy === "createdAt" ? "d.created_at" :
                       sortBy === "impact" ? "COALESCE(um.impact, m.impact)" :
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
    
  } catch (error: unknown) {
    console.error("GET /api/documents error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
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
    const duplicateStmt = db.prepare("SELECT id FROM documents WHERE content_hash = ?");
    const existing = duplicateStmt.get(body.contentHash) as { id: string } | undefined;
    
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
      const insertDocStmt = db.prepare(`
        INSERT INTO documents (id, source_id, file_url, content_hash, bytes_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertDocStmt.run(
        id,
        body.sourceId,
        body.fileUrl,
        body.contentHash,
        body.bytesSize,
        now
      );
      
      // Insert into document_metadata table
      const insertMetaStmt = db.prepare(`
        INSERT INTO document_metadata (
          document_id, title, entity, jurisdiction, counties, meeting_date,
          doc_types, topics, impact, stage, keyword_hits, extracted_text,
          pdf_preview, attachments, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertMetaStmt.run(
        id,
        body.title,
        body.entity,
        body.jurisdiction,
        JSON.stringify(body.counties || []),
        body.meetingDate || null,
        JSON.stringify(body.docTypes || []),
        JSON.stringify(body.topics || []),
        body.impact || null,
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
    const selectStmt = db.prepare(`
      SELECT 
        d.id, d.source_id, d.file_url, d.content_hash, d.bytes_size, d.created_at,
        m.title, m.entity, m.jurisdiction, m.counties, m.meeting_date, m.doc_types,
        m.impact, m.stage, m.topics, m.keyword_hits, m.extracted_text, m.pdf_preview,
        m.attachments, m.updated_at
      FROM documents d
      JOIN document_metadata m ON d.id = m.document_id
      WHERE d.id = ?
    `);
    const row = selectStmt.get(id) as DocumentRow;
    
    const document = transformRow(row);
    
    return NextResponse.json(document, { status: 201 });
    
  } catch (error: unknown) {
    console.error("POST /api/documents error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
      { status: 500 }
    );
  }
}
