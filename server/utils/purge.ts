import fs from "fs";
import path from "path";
import type BetterSqlite3 from "better-sqlite3";
import defaultDb from "../../db.js";
import { PREVIEW_DIR as DEFAULT_PREVIEW_DIR, PROCESSED_DIR as DEFAULT_PROCESSED_DIR } from "../config.js";

export const PURGE_DAYS = 7;

type Dirs = { previewDir: string; processedDir: string };

export function deleteWorkflowAndFiles(
  workflowId: string,
  database: BetterSqlite3.Database = defaultDb,
  dirs: Dirs = { previewDir: DEFAULT_PREVIEW_DIR, processedDir: DEFAULT_PROCESSED_DIR }
): void {
  const images = database
    .prepare(
      "SELECT local_path, preview_path, processed_path FROM images WHERE workflow_id = ?"
    )
    .all(workflowId) as Array<{
    local_path: string | null;
    preview_path: string | null;
    processed_path: string | null;
  }>;

  database.transaction(() => {
    database.prepare("DELETE FROM images WHERE workflow_id = ?").run(workflowId);
    database.prepare("DELETE FROM workflows WHERE id = ?").run(workflowId);
  })();

  for (const img of images) {
    if (img.local_path && fs.existsSync(img.local_path)) fs.unlinkSync(img.local_path);
    if (img.preview_path && fs.existsSync(img.preview_path)) fs.unlinkSync(img.preview_path);
    if (img.processed_path && fs.existsSync(img.processed_path)) fs.unlinkSync(img.processed_path);
  }

  const previewSubdir = path.join(dirs.previewDir, workflowId);
  const processedSubdir = path.join(dirs.processedDir, workflowId);
  if (fs.existsSync(previewSubdir)) fs.rmSync(previewSubdir, { recursive: true, force: true });
  if (fs.existsSync(processedSubdir)) fs.rmSync(processedSubdir, { recursive: true, force: true });
}

export function purgeExpiredWorkflows(
  database: BetterSqlite3.Database = defaultDb,
  dirs?: Dirs
): { purged: number } {
  const rows = database
    .prepare(
      `SELECT id FROM workflows WHERE created_at < datetime('now', '-${PURGE_DAYS} days')`
    )
    .all() as Array<{ id: string }>;

  let purged = 0;
  for (const row of rows) {
    try {
      deleteWorkflowAndFiles(row.id, database, dirs);
      purged++;
    } catch (e: any) {
      console.error(`[purge] failed to delete workflow ${row.id}:`, e?.message ?? e);
    }
  }
  if (purged > 0) {
    console.log(`[purge] deleted ${purged} workflow(s) older than ${PURGE_DAYS} days`);
  }
  return { purged };
}
