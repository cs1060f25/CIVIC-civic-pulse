import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

declare global {
  // eslint-disable-next-line no-var
  var __civicpulseDb: Database.Database | null | undefined;
  // eslint-disable-next-line no-var
  var __civicpulseDbPath: string | undefined;
}

const globalCache = globalThis as typeof globalThis & {
  __civicpulseDb: Database.Database | null | undefined;
  __civicpulseDbPath: string | undefined;
};

const DEFAULT_POSSIBLE_PATHS = [
  path.join(process.cwd(), "..", "backend", "db", "civicpulse.db"),
  path.join(process.cwd(), "backend", "db", "civicpulse.db"),
  path.join(process.cwd(), "..", "..", "backend", "db", "civicpulse.db"),
];

const shouldSkipDb = process.env.CIVICPULSE_SKIP_DB?.toLowerCase() === "true";

function resolveDbPath(): string {
  if (globalCache.__civicpulseDbPath) {
    return globalCache.__civicpulseDbPath;
  }

  const envPath =
    process.env.CIVICPULSE_DB_PATH ??
    process.env.DATABASE_PATH ??
    process.env.DB_PATH;

  const candidatePaths = envPath
    ? [path.resolve(envPath), ...DEFAULT_POSSIBLE_PATHS]
    : DEFAULT_POSSIBLE_PATHS;

  for (const dbPath of candidatePaths) {
    if (fs.existsSync(dbPath)) {
      globalCache.__civicpulseDbPath = dbPath;
      return dbPath;
    }
  }

  // fall back to first candidate even if it does not yet exist
  const fallback = candidatePaths[0]!;
  globalCache.__civicpulseDbPath = fallback;
  return fallback;
}

function initDb(): Database.Database {
  if (globalCache.__civicpulseDb) {
    return globalCache.__civicpulseDb;
  }

  if (shouldSkipDb) {
    console.warn(
      "[civicpulse] CIVICPULSE_SKIP_DB=true – using in-memory database during build."
    );
    globalCache.__civicpulseDb = new Database(":memory:");
    return globalCache.__civicpulseDb;
  }

  const dbPath = resolveDbPath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database not found at ${dbPath}. Set CIVICPULSE_DB_PATH or run backend/db/schema.sql.`
    );
  }

  const connection = new Database(dbPath);
  connection.pragma("foreign_keys = ON");
  globalCache.__civicpulseDb = connection;
  console.info("[civicpulse] Connected to database:", dbPath);
  return connection;
}

export function getDb(): Database.Database {
  return initDb();
}

export function closeDb(): void {
  if (globalCache.__civicpulseDb) {
    globalCache.__civicpulseDb.close();
    globalCache.__civicpulseDb = null;
    globalCache.__civicpulseDbPath = undefined;
  }
}

