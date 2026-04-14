import crypto from "crypto";
import path from "path";

export const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET not set. Using random secret — sessions will not survive restarts."
  );
}

export const PORT = parseInt(process.env.PORT || "3000", 10);
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const PREVIEW_DIR = path.join(DATA_DIR, "previews");
export const PROCESSED_DIR = path.join(DATA_DIR, "processed");
export const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(DATA_DIR, "workspace");
