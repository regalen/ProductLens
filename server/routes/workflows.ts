import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import db from "../../db.js";
import { authenticate } from "../middleware/auth.js";
import { validateWorkflowName } from "../utils/validation.js";

const router = Router();

router.get("/", authenticate, (req, res) => {
  const workflows = db
    .prepare(
      "SELECT id, name, status, user_id as userId, pipeline_id as pipelineId, created_at as createdAt FROM workflows WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(req.user!.id);
  res.json(workflows);
});

router.post("/", authenticate, (req, res) => {
  const { name } = req.body;
  const nameError = validateWorkflowName(name);
  if (nameError) return res.status(400).json({ error: nameError });
  const id = uuidv4();
  db.prepare(
    "INSERT INTO workflows (id, name, status, user_id) VALUES (?, ?, 'ingest', ?)"
  ).run(id, name, req.user!.id);
  res.json({ id, name, status: "ingest" });
});

router.get("/:id", authenticate, (req, res) => {
  const workflow = db
    .prepare(
      "SELECT id, name, status, user_id as userId, pipeline_id as pipelineId, created_at as createdAt FROM workflows WHERE id = ? AND user_id = ?"
    )
    .get(req.params.id, req.user!.id) as any;
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  let pipeline = null;
  if (workflow.pipelineId) {
    pipeline = db
      .prepare("SELECT id, name, steps FROM pipelines WHERE id = ?")
      .get(workflow.pipelineId) as any;
    if (pipeline) {
      try {
        pipeline.steps = JSON.parse(pipeline.steps);
      } catch {
        return res.status(500).json({ error: "Corrupt pipeline data" });
      }
    }
  }

  const images = db
    .prepare(
      "SELECT id, workflow_id as workflowId, original_url as originalUrl, local_path as localPath, preview_path as previewPath, processed_path as processedPath, status, type, width, height, size, selected, error_message as errorMessage, created_at as createdAt FROM images WHERE workflow_id = ? ORDER BY created_at ASC"
    )
    .all(req.params.id);
  res.json({ ...workflow, pipeline, images });
});

router.patch("/:id", authenticate, (req, res) => {
  const { status, pipeline_id, name } = req.body;
  if (status)
    db.prepare(
      "UPDATE workflows SET status = ? WHERE id = ? AND user_id = ?"
    ).run(status, req.params.id, req.user!.id);
  if (pipeline_id)
    db.prepare(
      "UPDATE workflows SET pipeline_id = ? WHERE id = ? AND user_id = ?"
    ).run(pipeline_id, req.params.id, req.user!.id);
  if (name)
    db.prepare(
      "UPDATE workflows SET name = ? WHERE id = ? AND user_id = ?"
    ).run(name, req.params.id, req.user!.id);
  res.json({ success: true });
});

router.delete("/:id", authenticate, (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user!.id;

  // Check ownership
  const workflow = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, userId);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const images = db
    .prepare("SELECT * FROM images WHERE workflow_id = ?")
    .all(workflowId) as any[];

  // Wrap DB deletes in a transaction; do file cleanup only after success
  db.transaction(() => {
    db.prepare("DELETE FROM images WHERE workflow_id = ?").run(workflowId);
    db.prepare("DELETE FROM workflows WHERE id = ?").run(workflowId);
  })();

  for (const img of images) {
    if (img.local_path && fs.existsSync(img.local_path))
      fs.unlinkSync(img.local_path);
    if (img.preview_path && fs.existsSync(img.preview_path))
      fs.unlinkSync(img.preview_path);
    if (img.processed_path && fs.existsSync(img.processed_path))
      fs.unlinkSync(img.processed_path);
  }

  res.json({ success: true });
});

router.delete("/:id/reset", authenticate, (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user!.id;

  const workflow = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, userId);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const images = db
    .prepare("SELECT * FROM images WHERE workflow_id = ?")
    .all(workflowId) as any[];

  // Wrap DB operations in a transaction; do file cleanup only after success
  db.transaction(() => {
    db.prepare("DELETE FROM images WHERE workflow_id = ?").run(workflowId);
    db.prepare(
      "UPDATE workflows SET status = 'ingest', pipeline_id = NULL WHERE id = ?"
    ).run(workflowId);
  })();

  for (const img of images) {
    if (img.local_path && fs.existsSync(img.local_path))
      fs.unlinkSync(img.local_path);
    if (img.preview_path && fs.existsSync(img.preview_path))
      fs.unlinkSync(img.preview_path);
    if (img.processed_path && fs.existsSync(img.processed_path))
      fs.unlinkSync(img.processed_path);
  }

  res.json({ success: true });
});

export default router;
