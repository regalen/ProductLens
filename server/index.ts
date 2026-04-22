import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import fs from "fs";

import { DATA_DIR, UPLOAD_DIR, PREVIEW_DIR, PROCESSED_DIR, REPORTS_DIR, WORKSPACE_DIR, PORT, CORS_ORIGIN } from "./config.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import pipelinesRouter from "./routes/pipelines.js";
import workflowsRouter from "./routes/workflows.js";
import ingestRouter from "./routes/ingest.js";
import processingRouter from "./routes/processing.js";
import imagesRouter, { publicImagesRouter } from "./routes/images.js";
import exportRouter from "./routes/export.js";
import reportsRouter from "./routes/reports.js";
import configRouter from "./routes/config.js";
import { purgeExpiredWorkflows } from "./utils/purge.js";
import { looseLimiter } from "./middleware/rateLimit.js";

// Ensure data directories exist
for (const dir of [DATA_DIR, UPLOAD_DIR, PREVIEW_DIR, PROCESSED_DIR, REPORTS_DIR, WORKSPACE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Auto-purge workflows older than 7 days: once on startup (deferred to let
// the server finish booting), then hourly. See server/utils/purge.ts.
const HOUR_MS = 60 * 60 * 1000;
setTimeout(() => {
  try { purgeExpiredWorkflows(); } catch (e) { console.error("[purge] startup sweep failed", e); }
}, 30_000);
setInterval(() => {
  try { purgeExpiredWorkflows(); } catch (e) { console.error("[purge] hourly sweep failed", e); }
}, HOUR_MS);

async function startServer() {
  const app = express();
  // PORT is imported from config.ts (defaults to 3000, configurable via PORT env var)

  // Trust one upstream reverse proxy hop so express-rate-limit reads the real
  // client IP from X-Forwarded-For instead of the proxy's IP. Without this
  // every proxied request shares a rate-limit bucket.
  app.set("trust proxy", 1);

  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  // --- Health check (unlimited, used by Docker healthcheck) ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Global rate limit for /api routes. Stricter limits on /auth/login
  // and /scrape are applied inline in their route handlers.
  app.use("/api", looseLimiter);

  // --- Route registration ---
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/pipelines", pipelinesRouter);
  app.use("/api/workflows", workflowsRouter);

  // Ingest routes are mounted at /api (they include full paths like /workflows/:id/upload and /scrape)
  app.use("/api", ingestRouter);

  // Processing routes are mounted at /api (they include full paths like /workflows/:id/preview)
  app.use("/api", processingRouter);

  // Image routes are mounted at /api (they include full paths like /images/:id, /assets/:id, /previews/:id)
  app.use("/api", imagesRouter);

  // Export routes are mounted at /api (they include full paths like /workflows/:id/export/xlsx)
  app.use("/api", exportRouter);

  app.use("/api/reports", reportsRouter);

  app.use("/api", configRouter);

  // Public image serving (must be before SPA catch-all)
  app.use(publicImagesRouter);

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", looseLimiter, (req, res) =>
      res.sendFile(path.join(distPath, "index.html"))
    );
  }

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Unhandled error:", err);
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error";
    res.status(500).json({ error: message });
  });

  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server running on http://localhost:${PORT}`)
  );
}

startServer();
