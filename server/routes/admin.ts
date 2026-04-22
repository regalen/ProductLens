import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../../db.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validatePassword, validateRole } from "../utils/validation.js";
import { deleteWorkflowAndFiles } from "../utils/purge.js";

const router = Router();

router.get("/users", authenticate, requireRole(["admin"]), (req, res) => {
  const users = db
    .prepare(
      "SELECT id, username, display_name as displayName, role, must_change_password as mustChangePassword, last_login_at as lastLoginAt, workflows_created_total as workflowsCreatedTotal, images_processed_total as imagesProcessedTotal FROM users ORDER BY created_at DESC"
    )
    .all() as Array<{ mustChangePassword: number } & Record<string, unknown>>;
  res.json(
    users.map((u) => ({ ...u, mustChangePassword: !!u.mustChangePassword }))
  );
});

router.post(
  "/users",
  authenticate,
  requireRole(["admin"]),
  async (req, res) => {
    const { username, displayName, password, role } = req.body;
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });
    if (!validateRole(role)) return res.status(400).json({ error: "Invalid role" });
    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    try {
      db.prepare(
        "INSERT INTO users (id, username, display_name, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, 1)"
      ).run(id, username, displayName, hash, role);
      res.json({ id, username, displayName, role });
    } catch (e: any) {
      res.status(400).json({ error: "Username already exists" });
    }
  }
);

router.patch(
  "/users/:id",
  authenticate,
  requireRole(["admin"]),
  async (req, res) => {
    const { displayName, role, password } = req.body;
    if (role && !validateRole(role))
      return res.status(400).json({ error: "Invalid role" });
    if (displayName)
      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(
        displayName,
        req.params.id
      );
    if (role)
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(
        role,
        req.params.id
      );
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      db.prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?"
      ).run(hash, req.params.id);
    }
    res.json({ success: true });
  }
);

router.delete(
  "/users/:id",
  authenticate,
  requireRole(["admin"]),
  (req, res) => {
    const userId = req.params.id!;
    if (userId === req.user!.id)
      return res.status(400).json({ error: "Cannot delete yourself" });

    const user = db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Delete all workflows (and their images/files) owned by this user
    const workflows = db
      .prepare("SELECT id FROM workflows WHERE user_id = ?")
      .all(userId) as Array<{ id: string }>;
    for (const wf of workflows) {
      deleteWorkflowAndFiles(wf.id);
    }

    // Nullify pipeline references before deleting pipelines
    const pipelines = db
      .prepare("SELECT id FROM pipelines WHERE user_id = ?")
      .all(userId) as Array<{ id: string }>;

    db.transaction(() => {
      for (const p of pipelines) {
        db.prepare("UPDATE workflows SET pipeline_id = NULL WHERE pipeline_id = ?").run(p.id);
      }
      db.prepare("DELETE FROM pipelines WHERE user_id = ?").run(userId);

      // Reassign report_files to the admin performing the deletion
      db.prepare("UPDATE report_files SET uploaded_by = ? WHERE uploaded_by = ?").run(
        req.user!.id,
        userId
      );

      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    })();

    res.json({ success: true });
  }
);

export default router;
