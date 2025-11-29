import { NextResponse } from "next/server";
import { getDb } from "@app/lib/db";

/**
 * GET /api/counties
 * 
 * Returns a list of unique county names from the database.
 * Counties are stored as JSON arrays in document_metadata.counties field.
 */
export async function GET() {
  try {
    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error("Database not available for /api/counties:", err);
      return NextResponse.json({ counties: [] }, { status: 200 });
    }

    // Counties are stored as JSON arrays like '["Sedgwick County"]'
    // We need to extract unique values from all documents
    const rows = db.prepare(`
      SELECT DISTINCT counties FROM document_metadata
      WHERE counties IS NOT NULL AND counties != '[]'
    `).all() as { counties: string }[];

    // Parse JSON arrays and collect unique county names
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
        // Skip malformed JSON
        continue;
      }
    }

    // Sort alphabetically
    const counties = Array.from(countySet).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return NextResponse.json({ counties });
  } catch (error: unknown) {
    console.error("GET /api/counties error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", message: errorMessage },
      { status: 500 }
    );
  }
}

