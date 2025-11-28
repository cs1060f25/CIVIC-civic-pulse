import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@app/lib/db";
import { DEFAULT_APP_STATE, normalizeAppState } from "@app/lib/appStateDefaults";
import type { AppState } from "@app/lib/types";

export async function GET(request: NextRequest) {
  const googleId = request.nextUrl.searchParams.get("googleId");
  if (!googleId) {
    return NextResponse.json(
      { error: "MISSING_GOOGLE_ID", message: "googleId query parameter is required." },
      { status: 400 }
    );
  }

  try {
    let db;
    try {
      db = getDb();
    } catch (err) {
      console.error(
        "Database not available for /api/user/state GET, returning default state:",
        err
      );
      return NextResponse.json({ state: normalizeAppState(DEFAULT_APP_STATE) });
    }

    const row = db
      .prepare("SELECT saved_state as savedState FROM users WHERE google_id = ?")
      .get(googleId) as { savedState?: string } | undefined;

    if (!row || !row.savedState) {
      return NextResponse.json({ state: normalizeAppState(DEFAULT_APP_STATE) });
    }

    try {
      const parsed = JSON.parse(row.savedState);
      return NextResponse.json({ state: normalizeAppState(parsed) });
    } catch (error) {
      console.error("Failed to parse saved state for user", googleId, error);
      return NextResponse.json({ state: normalizeAppState(DEFAULT_APP_STATE) });
    }
  } catch (error) {
    console.error("Error reading user state", error);
    return NextResponse.json({ state: normalizeAppState(DEFAULT_APP_STATE) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { googleId, state } = body as { googleId?: string; state?: Partial<AppState> };

    if (!googleId || !state) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "googleId and state are required." },
        { status: 400 }
      );
    }

    const normalized = normalizeAppState(state);

    try {
      const db = getDb();
      const now = new Date().toISOString();

      const result = db
        .prepare(
          `
          UPDATE users
          SET saved_state = ?, updated_at = ?
          WHERE google_id = ?
        `
        )
        .run(JSON.stringify(normalized), now, googleId);

      if (result.changes === 0) {
        return NextResponse.json(
          { error: "USER_NOT_FOUND", message: "User must authenticate before saving state." },
          { status: 404 }
        );
      }
    } catch (err) {
      console.error(
        "Database not available for /api/user/state POST, skipping persistence:",
        err
      );
      // Fall through and report ok: state is still stored locally on the client
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving user state", error);
    return NextResponse.json({ ok: false });
  }
}

