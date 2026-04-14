import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import fs from "fs";

import { DATA_DIR, UPLOAD_DIR, PREVIEW_DIR, PROCESSED_DIR, WORKSPACE_DIR, PORT, CORS_ORIGIN } from "./config.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import pipelinesRouter from "./routes/pipelines.js";
import workflowsRouter from "./routes/workflows.js";
import ingestRouter from "./routes/ingest.js";
import processingRouter from "./routes/processing.js";
import imagesRouter, { publicImagesRouter } from "./routes/images.js";
import exportRouter from "./routes/export.js";

// Ensure data directories exist
for (const dir of [DATA_DIR, UPLOAD_DIR, PREVIEW_DIR, PROCESSED_DIR, WORKSPACE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function startServer() {
  const app = express();
  // PORT is imported from config.ts (defaults to 3000, configurable via PORT env var)

  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  // --- Health check ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

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
    app.get("*", (req, res) =>
      res.sendFile(path.join(distPath, "index.html"))
    );
  }

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server running on http://localhost:${PORT}`)
  );
}

startServer();
