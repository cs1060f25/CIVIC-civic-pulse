import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@app/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// GET /api/documents/[id]/pdf - Serve PDF file from database or filesystem
export async function GET(
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

    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error("Database not available for PDF serving:", err);
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      );
    }

    // First, try to get PDF from database (pdf_data column)
    const dbRow = db
      .prepare("SELECT pdf_data, file_url FROM documents WHERE id = ?")
      .get(id) as { pdf_data: Buffer | null; file_url: string } | undefined;

    if (!dbRow) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // If PDF is stored in database, serve it directly
    if (dbRow.pdf_data && dbRow.pdf_data.length > 0) {
      // Convert Buffer to Uint8Array for NextResponse
      const pdfBuffer = Buffer.isBuffer(dbRow.pdf_data) 
        ? new Uint8Array(dbRow.pdf_data) 
        : new Uint8Array(dbRow.pdf_data);
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="document-${id.substring(0, 12)}.pdf"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Fallback to filesystem if PDF not in database
    if (!dbRow.file_url) {
      return NextResponse.json(
        { error: "PDF not available (not stored in database and no file URL)" },
        { status: 404 }
      );
    }

    let filePath: string;

    // Handle different URL formats
    if (dbRow.file_url.startsWith("file:///")) {
      // Remove file:/// prefix and decode
      let decoded = decodeURIComponent(dbRow.file_url.replace(/^file:\/\/\//, ""));
      if (decoded.match(/^[A-Za-z]:/)) {
        filePath = decoded;
      } else {
        filePath = path.join(process.cwd(), "..", decoded);
      }
    } else if (dbRow.file_url.startsWith("local:")) {
      const relativePath = dbRow.file_url.replace(/^local:/, "");
      filePath = path.join(process.cwd(), "..", "backend", "data", relativePath);
    } else if (dbRow.file_url.startsWith("http://") || dbRow.file_url.startsWith("https://")) {
      return NextResponse.redirect(dbRow.file_url);
    } else {
      filePath = path.join(process.cwd(), "..", "backend", "data", dbRow.file_url);
    }

    filePath = path.normalize(filePath);

    if (!existsSync(filePath)) {
      console.error(`PDF file not found: ${filePath}`);
      return NextResponse.json(
        { error: "PDF file not found" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".pdf" ? "application/pdf" : "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

