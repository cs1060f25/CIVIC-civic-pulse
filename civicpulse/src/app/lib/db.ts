import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database path - adjust based on environment
// Try multiple possible locations
// process.cwd() is now src/ (where package.json is)
const possiblePaths = [
  path.join(process.cwd(), "..", "backend", "db", "civicpulse.db"),  // From src/ to backend/db/
  path.join(process.cwd(), "backend", "db", "civicpulse.db"),  // Docker/standalone
  path.join(process.cwd(), "..", "..", "backend", "db", "civicpulse.db"),  // Alternative
];

// Find the first path that exists, or use the first one as default
let DB_PATH = possiblePaths[0];
for (const dbPath of possiblePaths) {
  if (fs.existsSync(dbPath)) {
    DB_PATH = dbPath;
    break;
  }
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Log the path being used for debugging
    console.log("Attempting to connect to database at:", DB_PATH);
    console.log("Current working directory:", process.cwd());
    
    if (!fs.existsSync(DB_PATH)) {
      console.error("Database file not found at:", DB_PATH);
      console.log("Tried paths:", possiblePaths);
      throw new Error(`Database not found at ${DB_PATH}. Please ensure the database exists.`);
    }
    
    try {
      db = new Database(DB_PATH, { readonly: false });
      db.pragma("foreign_keys = ON");
      console.log("Successfully connected to database");
    } catch (error) {
      console.error("Error connecting to database:", error);
      throw error;
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
