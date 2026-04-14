import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../../db.js";
import { JWT_SECRET } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { validatePassword } from "../utils/validation.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as any;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET);
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
  });
});

router.post("/change-password", authenticate, async (req, res) => {
  const { newPassword } = req.body;
  const pwError = validatePassword(newPassword);
  if (pwError) {
    return res.status(400).json({ error: pwError });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?"
  ).run(hash, req.user!.id);
  res.json({ success: true });
});

router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

export default router;
