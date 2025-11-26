import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DEFAULT_APP_STATE, normalizeAppState } from "@/lib/appStateDefaults";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { googleId, email, name, picture } = body as {
      googleId?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!googleId || !email || !name) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "googleId, email, and name are required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    let db;
    try {
      db = getDb();

      // Ensure users table exists for local/dev environments
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          google_id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          picture TEXT,
          saved_state TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    } catch (err) {
      console.error(
        "Database not available during Google auth, proceeding without persistence:",
        err
      );

      // Fall back to non-persistent auth: return a user object so the UI can still log in
      return NextResponse.json({
        user: {
          googleId,
          email,
          name,
          picture: picture ?? null,
          createdAt: now,
          updatedAt: now,
          savedState: normalizeAppState(DEFAULT_APP_STATE),
        },
      });
    }

    const existing = db
      .prepare(
        `
        SELECT google_id as googleId, email, name, picture, saved_state as savedState, created_at as createdAt, updated_at as updatedAt
        FROM users
        WHERE google_id = ?
      `
      )
      .get(googleId) as
      | {
          googleId: string;
          email: string;
          name: string;
          picture?: string;
          savedState?: string;
          createdAt?: string;
          updatedAt?: string;
        }
      | undefined;

    if (existing) {
      db.prepare(
        `
          UPDATE users
          SET email = ?, name = ?, picture = ?, updated_at = ?
          WHERE google_id = ?
        `
      ).run(email, name, picture ?? null, now, googleId);

      let savedState = normalizeAppState(DEFAULT_APP_STATE);
      if (existing.savedState) {
        try {
          savedState = normalizeAppState(JSON.parse(existing.savedState));
        } catch {
          savedState = normalizeAppState(DEFAULT_APP_STATE);
        }
      }

      const responseUser = {
        googleId,
        email,
        name,
        picture: picture ?? existing.picture ?? null,
        createdAt: existing.createdAt,
        updatedAt: now,
        savedState,
      };

      return NextResponse.json({ user: responseUser });
    }

    db.prepare(
      `
        INSERT INTO users (google_id, email, name, picture, saved_state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    ).run(googleId, email, name, picture ?? null, JSON.stringify(DEFAULT_APP_STATE), now, now);

    return NextResponse.json({
      user: {
        googleId,
        email,
        name,
        picture: picture ?? null,
        createdAt: now,
        updatedAt: now,
        savedState: normalizeAppState(DEFAULT_APP_STATE),
      },
    });
  } catch (error) {
    console.error("Error handling Google auth:", error);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Unable to process authentication." },
      { status: 500 }
    );
  }
}

