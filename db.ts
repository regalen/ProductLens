import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
const uploadDir = path.join(process.cwd(), 'data', 'uploads');
const previewDir = path.join(process.cwd(), 'data', 'previews');
const processedDir = path.join(process.cwd(), 'data', 'processed');

// Ensure directories exist
[path.join(process.cwd(), 'data'), uploadDir, previewDir, processedDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

db.exec(`
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL, -- ingest, configure, preview, processing, completed
    user_id TEXT NOT NULL,
    pipeline_id TEXT,
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
