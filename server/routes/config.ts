import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { PURGE_DAYS } from "../utils/purge.js";

const router = Router();

router.get("/config", authenticate, (_req, res) => {
  res.json({ purgeDays: PURGE_DAYS });
});

export default router;
