import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  validatePipelineDescription,
  validatePipelineSteps,
} from "../utils/validation.js";

const router = Router();

router.get("/", authenticate, (req, res) => {
  const pipelines = db
    .prepare(
      "SELECT id, name, steps, user_id as userId, is_shared as isShared, description, created_at as createdAt FROM pipelines WHERE user_id = ? OR is_shared = 1 ORDER BY created_at DESC"
    )
    .all(req.user!.id);
  res.json(
    pipelines.map((p: any) => {
      let steps;
      try {
        steps = JSON.parse(p.steps);
      } catch {
        return res.status(500).json({ error: "Corrupt pipeline data" });
      }
      return { ...p, steps, isShared: !!p.isShared };
    })
  );
});

router.post(
  "/",
  authenticate,
  requireRole(["pipeline_editor", "admin"]),
  (req, res) => {
    const { name, steps, isShared, description } = req.body;
    const stepsError = validatePipelineSteps(steps);
    if (stepsError) return res.status(400).json({ error: stepsError });
    const descError = validatePipelineDescription(description);
    if (descError) return res.status(400).json({ error: descError });
    const normalizedDesc =
      typeof description === "string" && description.length > 0
        ? description
        : null;
    const id = uuidv4();
    db.prepare(
      "INSERT INTO pipelines (id, name, steps, user_id, is_shared, description) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      name,
      JSON.stringify(steps),
      req.user!.id,
      isShared ? 1 : 0,
      normalizedDesc
    );
    res.json({ id, name, steps, isShared, description: normalizedDesc });
  }
);

router.patch(
  "/:id",
  authenticate,
  requireRole(["pipeline_editor", "admin"]),
  (req, res) => {
    const { name, steps, isShared, description } = req.body;
    // Only owner or admin can edit
    const pipeline = db
      .prepare("SELECT user_id FROM pipelines WHERE id = ?")
      .get(req.params.id) as any;
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });
    if (pipeline.user_id !== req.user!.id && req.user!.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: You don't own this pipeline" });
    }

    if (steps) {
      const stepsError = validatePipelineSteps(steps);
      if (stepsError) return res.status(400).json({ error: stepsError });
    }
    if (description !== undefined) {
      const descError = validatePipelineDescription(description);
      if (descError) return res.status(400).json({ error: descError });
    }
    if (name)
      db.prepare("UPDATE pipelines SET name = ? WHERE id = ?").run(
        name,
        req.params.id
      );
    if (steps)
      db.prepare("UPDATE pipelines SET steps = ? WHERE id = ?").run(
        JSON.stringify(steps),
        req.params.id
      );
    if (isShared !== undefined)
      db.prepare("UPDATE pipelines SET is_shared = ? WHERE id = ?").run(
        isShared ? 1 : 0,
        req.params.id
      );
    if (description !== undefined) {
      const normalizedDesc =
        typeof description === "string" && description.length > 0
          ? description
          : null;
      db.prepare("UPDATE pipelines SET description = ? WHERE id = ?").run(
        normalizedDesc,
        req.params.id
      );
    }
    res.json({ success: true });
  }
);

router.delete(
  "/:id",
  authenticate,
  requireRole(["pipeline_editor", "admin"]),
  (req, res) => {
    const pipeline = db
      .prepare("SELECT user_id FROM pipelines WHERE id = ?")
      .get(req.params.id) as any;
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });
    if (pipeline.user_id !== req.user!.id && req.user!.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Forbidden: You don't own this pipeline" });
    }
    const deletePipeline = db.transaction((id: string) => {
      db.prepare("UPDATE workflows SET pipeline_id = NULL WHERE pipeline_id = ?").run(id);
      db.prepare("DELETE FROM pipelines WHERE id = ?").run(id);
    });
    deletePipeline(req.params.id!);
    res.json({ success: true });
  }
);

export default router;
