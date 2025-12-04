import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@app/lib/db";
import { DocumentRow, transformRow } from "@app/lib/document-utils";

// GET /api/documents/[id]
export async function GET(
  request: NextRequest,
  context:{ params : Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Get googleId from query parameter if provided
    const googleId = request.nextUrl.searchParams.get("googleId");

    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error(
        "Database not available for /api/documents/[id], returning 404:",
        err
      );
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    
    // Join user_document_metadata if googleId is provided
    const query = `
      SELECT 
        d.id,
        d.source_id,
        d.file_url,
        d.content_hash,
        d.bytes_size,
        d.created_at,
        m.title,
        m.entity,
        m.jurisdiction,
        m.counties,
        m.meeting_date,
        m.doc_types,
        COALESCE(um.impact, m.impact) as impact,
        COALESCE(um.stage, m.stage) as stage,
        COALESCE(um.topics, m.topics) as topics,
        m.keyword_hits,
        m.extracted_text,
        m.pdf_preview,
        m.summary,
        m.full_text,
        m.attachments,
        m.updated_at
      FROM documents d
      LEFT JOIN document_metadata m ON d.id = m.document_id
      ${googleId ? "LEFT JOIN user_document_metadata um ON d.id = um.document_id AND um.user_google_id = ?" : ""}
      WHERE d.id = ?
    `;

    const row = googleId 
      ? db.prepare(query).get(googleId, id) as DocumentRow | undefined
      : db.prepare(query).get(id) as DocumentRow | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const document = transformRow(row);

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/documents/[id] - Update document metadata
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      googleId,
      impact,
      stage,
      topics,
    } = body;

    // Require googleId for user-specific metadata updates
    if (!googleId) {
      return NextResponse.json(
        { error: "googleId is required for metadata updates" },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error(
        "Database not available for /api/documents/[id] PATCH:",
        err
      );
      return NextResponse.json(
        { error: "Database unavailable" },
        { status: 500 }
      );
    }

    // Check if user metadata already exists to preserve values for fields not being updated
    const existing = db
      .prepare("SELECT impact, stage, topics FROM user_document_metadata WHERE user_google_id = ? AND document_id = ?")
      .get(googleId, id) as { impact: string | null; stage: string | null; topics: string | null } | undefined;

    // Use provided values, or keep existing values, or NULL for new records
    const finalImpact = impact !== undefined 
      ? (impact === null || impact === "" ? null : impact)
      : (existing?.impact ?? null);
    
    const finalStage = stage !== undefined
      ? (stage === null || stage === "" ? null : stage)
      : (existing?.stage ?? null);
    
    const finalTopics = topics !== undefined
      ? JSON.stringify(topics)
      : (existing?.topics ?? null);

    // Use INSERT OR REPLACE to handle both new and existing records
    const insertQuery = `
      INSERT OR REPLACE INTO user_document_metadata 
        (user_google_id, document_id, impact, stage, topics, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;

    db.prepare(insertQuery).run(googleId, id, finalImpact, finalStage, finalTopics);

    // Fetch and return updated document with user-specific metadata
    const selectQuery = `
      SELECT 
        d.id,
        d.source_id,
        d.file_url,
        d.content_hash,
        d.bytes_size,
        d.created_at,
        m.title,
        m.entity,
        m.jurisdiction,
        m.counties,
        m.meeting_date,
        m.doc_types,
        COALESCE(um.impact, m.impact) as impact,
        COALESCE(um.stage, m.stage) as stage,
        COALESCE(um.topics, m.topics) as topics,
        m.keyword_hits,
        m.extracted_text,
        m.pdf_preview,
        m.summary,
        m.full_text,
        m.attachments,
        m.updated_at
      FROM documents d
      LEFT JOIN document_metadata m ON d.id = m.document_id
      LEFT JOIN user_document_metadata um ON d.id = um.document_id AND um.user_google_id = ?
      WHERE d.id = ?
    `;

    const row = db.prepare(selectQuery).get(googleId, id) as DocumentRow | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Document not found after update" },
        { status: 404 }
      );
    }

    const document = transformRow(row);

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
