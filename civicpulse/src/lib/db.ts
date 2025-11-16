import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database path - adjust based on environment
// Try multiple possible locations
const possiblePaths = [
  path.join(process.cwd(), "..", "backend", "data", "civicpulse.db"),  // Local dev from civicpulse/
  path.join(process.cwd(), "backend", "data", "civicpulse.db"),  // Docker/standalone
  path.join(process.cwd(), "..", "..", "..", "backend", "data", "civicpulse.db"),  // Local dev from src/app/
  path.join(process.cwd(), "..", "..", "..", "..", "backend", "data", "civicpulse.db"),  // Alternative
];

// Find the first path that exists, or use the first one as default
let DB_PATH = possiblePaths[0];
console.log("Looking for database in paths:", possiblePaths);
for (const dbPath of possiblePaths) {
  console.log(`Checking path: ${dbPath}, exists: ${fs.existsSync(dbPath)}`);
  if (fs.existsSync(dbPath)) {
    DB_PATH = dbPath;
    console.log(`Using database path: ${DB_PATH}`);
    break;
  }
}
console.log(`Final database path: ${DB_PATH}`);

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
