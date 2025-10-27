import Database from "better-sqlite3";
import path from "path";

// Database path - adjust based on environment
const DB_PATH = path.join(process.cwd(), "..", "backend", "data", "civicpulse.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: false });
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
