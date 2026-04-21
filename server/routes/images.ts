import { Router } from "express";
import path from "path";
import fs from "fs";
import db from "../../db.js";
import { PROCESSED_DIR } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { looseLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.delete("/images/:id", authenticate, (req, res) => {
  const imageId = req.params.id;
  const userId = req.user!.id;

  // Check ownership via workflow
  const img = db
    .prepare(
      `SELECT i.* FROM images i
       JOIN workflows w ON i.workflow_id = w.id
       WHERE i.id = ? AND w.user_id = ?`
    )
    .get(imageId, userId) as any;

  if (!img) return res.status(404).json({ error: "Image not found" });

  if (img.local_path && fs.existsSync(img.local_path))
    fs.unlinkSync(img.local_path);
  if (img.preview_path && fs.existsSync(img.preview_path))
    fs.unlinkSync(img.preview_path);
  if (img.processed_path && fs.existsSync(img.processed_path))
    fs.unlinkSync(img.processed_path);

  db.prepare("DELETE FROM images WHERE id = ?").run(imageId);
  res.json({ success: true });
});

router.patch("/images/:id", authenticate, (req, res) => {
  const imageId = req.params.id;
  const userId = req.user!.id;

  // Ownership check via join
  const img = db
    .prepare(
      `SELECT i.* FROM images i
       JOIN workflows w ON i.workflow_id = w.id
       WHERE i.id = ? AND w.user_id = ?`
    )
    .get(imageId, userId) as any;

  if (!img) return res.status(404).json({ error: "Image not found" });

  const { selected, type } = req.body;
  if (selected !== undefined)
    db.prepare("UPDATE images SET selected = ? WHERE id = ?").run(
      selected ? 1 : 0,
      imageId
    );
  if (type !== undefined)
    db.prepare("UPDATE images SET type = ? WHERE id = ?").run(type, imageId);
  res.json({ success: true });
});

router.get("/assets/:id", authenticate, (req, res) => {
  const userId = req.user!.id;

  // Ownership check via join
  const img = db
    .prepare(
      `SELECT i.* FROM images i
       JOIN workflows w ON i.workflow_id = w.id
       WHERE i.id = ? AND w.user_id = ?`
    )
    .get(req.params.id, userId) as any;

  if (!img) return res.status(404).send("Not found");
  const filePath = img.processed_path || img.local_path;
  if (!filePath || !fs.existsSync(filePath))
    return res.status(404).send("File not found");

  // If no extension, try to detect or default to image/jpeg
  if (!path.extname(filePath)) {
    res.setHeader("Content-Type", "image/jpeg");
  }

  res.sendFile(filePath);
});

router.get("/previews/:id", authenticate, (req, res) => {
  const userId = req.user!.id;

  // Ownership check via join
  const img = db
    .prepare(
      `SELECT i.* FROM images i
       JOIN workflows w ON i.workflow_id = w.id
       WHERE i.id = ? AND w.user_id = ?`
    )
    .get(req.params.id, userId) as any;

  if (!img || !img.preview_path) return res.status(404).send("Not found");
  if (!path.extname(img.preview_path)) {
    res.setHeader("Content-Type", "image/webp");
  }
  res.sendFile(img.preview_path);
});

export default router;

// --- Public image serving (no authentication) ---
// Exported separately — must be mounted at "/" in index.ts, not under "/api"
export const publicImagesRouter = Router();
publicImagesRouter.get("/images/:workflowId/:filename", looseLimiter, (req, res) => {
  const workflowId = req.params.workflowId ?? "";
  const filename = req.params.filename ?? "";

  if (!/^[a-zA-Z0-9-]+$/.test(workflowId)) return res.status(400).send("Bad request");
  const safeFilename = path.basename(filename);
  if (safeFilename !== filename || safeFilename === "") return res.status(400).send("Bad request");

  const baseDir = path.resolve(PROCESSED_DIR);
  const filePath = path.resolve(baseDir, workflowId, safeFilename);
  if (!filePath.startsWith(baseDir + path.sep)) return res.status(400).send("Bad request");

  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
});
