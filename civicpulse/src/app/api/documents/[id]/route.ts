import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DocumentRow, transformRow } from "@/lib/document-utils";

// GET /api/documents/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    
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
