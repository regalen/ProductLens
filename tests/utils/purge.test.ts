import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deleteWorkflowAndFiles,
  purgeExpiredWorkflows,
} from '../../server/utils/purge.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      user_id TEXT NOT NULL,
      pipeline_id TEXT,
      steps TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE images (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      original_url TEXT,
      local_path TEXT,
      preview_path TEXT,
      processed_path TEXT,
      status TEXT NOT NULL,
      type TEXT,
      width INTEGER,
      height INTEGER,
      size INTEGER,
      selected BOOLEAN DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

describe('purge helpers', () => {
  let db: Database.Database;
  let tmpRoot: string;
  let previewDir: string;
  let processedDir: string;
  let uploadDir: string;

  beforeEach(() => {
    db = createTestDb();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'productlens-purge-'));
    previewDir = path.join(tmpRoot, 'previews');
    processedDir = path.join(tmpRoot, 'processed');
    uploadDir = path.join(tmpRoot, 'uploads');
    fs.mkdirSync(previewDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fs.mkdirSync(uploadDir, { recursive: true });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  // Insert a workflow + 1 image and plant real files on disk.
  function seedWorkflow(
    id: string,
    opts: { ageDays: number }
  ): { uploadPath: string; previewPath: string; processedPath: string } {
    const uploadPath = path.join(uploadDir, `${id}.jpg`);
    const previewWorkflowDir = path.join(previewDir, id);
    const processedWorkflowDir = path.join(processedDir, id);
    fs.mkdirSync(previewWorkflowDir, { recursive: true });
    fs.mkdirSync(processedWorkflowDir, { recursive: true });
    const previewPath = path.join(previewWorkflowDir, 'img.webp');
    const processedPath = path.join(processedWorkflowDir, 'img.jpg');
    fs.writeFileSync(uploadPath, 'upload');
    fs.writeFileSync(previewPath, 'preview');
    fs.writeFileSync(processedPath, 'processed');

    db.prepare(
      'INSERT INTO workflows (id, name, status, user_id) VALUES (?, ?, ?, ?)'
    ).run(id, `wf-${id}`, 'completed', 'user-1');
    db.prepare(
      "UPDATE workflows SET created_at = datetime('now', ?) WHERE id = ?"
    ).run(`-${opts.ageDays} days`, id);
    db.prepare(
      'INSERT INTO images (id, workflow_id, local_path, preview_path, processed_path, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(`img-${id}`, id, uploadPath, previewPath, processedPath, 'completed');

    return { uploadPath, previewPath, processedPath };
  }

  it('purges workflows older than 7 days and keeps newer ones', () => {
    const old = seedWorkflow('old', { ageDays: 8 });
    const fresh = seedWorkflow('new', { ageDays: 1 });

    const result = purgeExpiredWorkflows(db, { previewDir, processedDir });

    expect(result.purged).toBe(1);

    const oldRow = db.prepare('SELECT id FROM workflows WHERE id = ?').get('old');
    const newRow = db.prepare('SELECT id FROM workflows WHERE id = ?').get('new');
    expect(oldRow).toBeUndefined();
    expect(newRow).toBeDefined();

    const oldImgCount = db
      .prepare('SELECT COUNT(*) AS c FROM images WHERE workflow_id = ?')
      .get('old') as { c: number };
    expect(oldImgCount.c).toBe(0);

    expect(fs.existsSync(old.uploadPath)).toBe(false);
    expect(fs.existsSync(old.previewPath)).toBe(false);
    expect(fs.existsSync(old.processedPath)).toBe(false);
    expect(fs.existsSync(path.join(previewDir, 'old'))).toBe(false);
    expect(fs.existsSync(path.join(processedDir, 'old'))).toBe(false);

    expect(fs.existsSync(fresh.uploadPath)).toBe(true);
    expect(fs.existsSync(fresh.previewPath)).toBe(true);
    expect(fs.existsSync(fresh.processedPath)).toBe(true);
  });

  it('does not purge a workflow just under the 7-day threshold', () => {
    seedWorkflow('borderline', { ageDays: 6 });
    const result = purgeExpiredWorkflows(db, { previewDir, processedDir });
    expect(result.purged).toBe(0);
    expect(
      db.prepare('SELECT id FROM workflows WHERE id = ?').get('borderline')
    ).toBeDefined();
  });

  it('is a no-op when no workflows are expired', () => {
    seedWorkflow('wf1', { ageDays: 1 });
    seedWorkflow('wf2', { ageDays: 3 });
    const result = purgeExpiredWorkflows(db, { previewDir, processedDir });
    expect(result.purged).toBe(0);
  });

  it('deleteWorkflowAndFiles is idempotent on a second call', () => {
    seedWorkflow('wf', { ageDays: 0 });
    deleteWorkflowAndFiles('wf', db, { previewDir, processedDir });
    expect(() =>
      deleteWorkflowAndFiles('wf', db, { previewDir, processedDir })
    ).not.toThrow();
  });

  it('skips already-missing files gracefully', () => {
    seedWorkflow('wf', { ageDays: 0 });
    fs.unlinkSync(path.join(uploadDir, 'wf.jpg'));
    expect(() =>
      deleteWorkflowAndFiles('wf', db, { previewDir, processedDir })
    ).not.toThrow();
    expect(
      db.prepare('SELECT id FROM workflows WHERE id = ?').get('wf')
    ).toBeUndefined();
  });
});
