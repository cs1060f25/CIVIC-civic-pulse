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
        m.impact,
        m.stage,
        m.topics,
        m.keyword_hits,
        m.extracted_text,
        m.pdf_preview,
        m.summary,
        m.full_text,
        m.attachments,
        m.updated_at
      FROM documents d
      LEFT JOIN document_metadata m ON d.id = m.document_id
      WHERE d.id = ?
    `;

    const row = db.prepare(query).get(id) as DocumentRow | undefined;

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
      impact,
      stage,
      topics,
    } = body;

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

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];

    if (impact !== undefined) {
      updates.push("impact = ?");
      values.push(impact === null || impact === "" ? null : impact);
    }

    if (stage !== undefined) {
      updates.push("stage = ?");
      values.push(stage === null || stage === "" ? null : stage);
    }

    if (topics !== undefined) {
      updates.push("topics = ?");
      values.push(JSON.stringify(topics));
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    const updateQuery = `
      UPDATE document_metadata
      SET ${updates.join(", ")}
      WHERE document_id = ?
    `;

    db.prepare(updateQuery).run(...values);

    // Fetch and return updated document
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
        m.impact,
        m.stage,
        m.topics,
        m.keyword_hits,
        m.extracted_text,
        m.pdf_preview,
        m.summary,
        m.full_text,
        m.attachments,
        m.updated_at
      FROM documents d
      LEFT JOIN document_metadata m ON d.id = m.document_id
      WHERE d.id = ?
    `;

    const row = db.prepare(selectQuery).get(id) as DocumentRow | undefined;

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
