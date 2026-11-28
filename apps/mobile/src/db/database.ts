import * as SQLite from 'expo-sqlite';

const DB_NAME = 'salbar_resident.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY NOT NULL,
      incident_id_num INTEGER NOT NULL,
      category TEXT NOT NULL,
      urgency TEXT NOT NULL,
      victim_count INTEGER NOT NULL DEFAULT 1,
      raw_text TEXT NOT NULL,
      lat REAL NOT NULL DEFAULT 0.0,
      lng REAL NOT NULL DEFAULT 0.0,
      accuracy_m REAL NOT NULL DEFAULT 0.0,
      pos_age_s INTEGER NOT NULL DEFAULT 65535,
      created_at_utc INTEGER NOT NULL,
      sync_status TEXT NOT NULL,
      sync_path TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reports_sync_created
      ON reports (sync_status, created_at_utc DESC);
  `);
  return db;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}
