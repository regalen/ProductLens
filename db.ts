import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbPath = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// One-time migration for installs created before DATA_DIR was honored:
// if a DB exists at the legacy path inside the image layer but not yet at
// the persistent path, move it over so users don't lose data on upgrade.
const legacyDbPath = path.join(process.cwd(), 'data', 'database.sqlite');
if (legacyDbPath !== dbPath && !fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  console.log(`Migrating SQLite database from ${legacyDbPath} to ${dbPath}`);
  fs.copyFileSync(legacyDbPath, dbPath);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Helper to check if column exists
const columnExists = (table: string, column: string) => {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return info.some(col => col.name === column);
};

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    must_change_password BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    steps TEXT NOT NULL, -- JSON string
    user_id TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migrations for existing tables
if (!columnExists('users', 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
}
if (!columnExists('users', 'must_change_password')) {
  db.exec("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0");
}
if (!columnExists('pipelines', 'is_shared')) {
  db.exec("ALTER TABLE pipelines ADD COLUMN is_shared BOOLEAN DEFAULT 0");
}
if (!columnExists('pipelines', 'description')) {
  db.exec("ALTER TABLE pipelines ADD COLUMN description TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL, -- ingest, configure, preview, processing, completed
    user_id TEXT NOT NULL,
    pipeline_id TEXT,
    steps TEXT, -- JSON string for one-time (non-saved) pipeline steps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    original_url TEXT,
    local_path TEXT,
    preview_path TEXT,
    processed_path TEXT,
    status TEXT NOT NULL, -- pending, processing, completed, failed
    type TEXT,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    selected BOOLEAN DEFAULT 1,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
  );
`);

if (!columnExists('workflows', 'steps')) {
  db.exec("ALTER TABLE workflows ADD COLUMN steps TEXT");
}
if (!columnExists('images', 'preview_width')) {
  db.exec("ALTER TABLE images ADD COLUMN preview_width INTEGER");
}
if (!columnExists('images', 'preview_height')) {
  db.exec("ALTER TABLE images ADD COLUMN preview_height INTEGER");
}
if (!columnExists('users', 'last_login_at')) {
  db.exec("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
}
if (!columnExists('users', 'workflows_created_total')) {
  db.exec("ALTER TABLE users ADD COLUMN workflows_created_total INTEGER NOT NULL DEFAULT 0");
}
if (!columnExists('users', 'images_processed_total')) {
  db.exec("ALTER TABLE users ADD COLUMN images_processed_total INTEGER NOT NULL DEFAULT 0");
}

// Indexes for common query patterns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
  CREATE INDEX IF NOT EXISTS idx_images_workflow_id ON images(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
`);

// Seed default admin if it doesn't exist
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
if (!adminUser) {
  const adminId = uuidv4();
  const adminHash = bcrypt.hashSync('admin', 10);
  db.prepare("INSERT INTO users (id, username, display_name, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?)")
    .run(adminId, 'admin', 'Administrator', adminHash, 'admin', 1);
  console.log('Default admin user created (admin/admin)');
}

export default db;
