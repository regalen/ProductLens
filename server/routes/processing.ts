import { Router } from "express";
import path from "path";
import fs from "fs";
import sharp from "sharp";

/** Move a file, falling back to copy+delete when rename fails (cross-device). */
function moveFile(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}
import pLimit from "p-limit";
import db from "../../db.js";
import { PREVIEW_DIR, PROCESSED_DIR, WORKSPACE_DIR } from "../config.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// --- Image Processing Helper ---
export async function processImage(
  inputPath: string,
  outputPath: string,
  pipeline: any[],
  isPreview: boolean
) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  let processor = sharp(inputPath).rotate();
  if (isPreview) {
    processor = processor.resize(1600, 1600, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  console.log(
    `Processing image ${inputPath} with ${pipeline.length} steps (isPreview: ${isPreview})`
  );
  for (const step of pipeline) {
    console.log(`Applying step: ${step.type}`, step);
    const { data: encodedData, info: encodedInfo } = await processor.toBuffer({
      resolveWithObject: true,
    });

    let sampledBackground = { r: 255, g: 255, b: 255, alpha: 1 };
    if (encodedInfo.width > 0 && encodedInfo.height > 0) {
      try {
        const { data: pixelData, info: pixelInfo } = await sharp(encodedData)
          .extract({ left: 0, top: 0, width: 1, height: 1 })
          .raw()
          .toBuffer({ resolveWithObject: true });
        sampledBackground = {
          r: pixelData[0] ?? 255,
          g: pixelData[1] ?? 255,
          b: pixelData[2] ?? 255,
          alpha: pixelInfo.channels === 4 ? (pixelData[3] ?? 255) / 255 : 1,
        };
      } catch (e) {
        console.warn("Failed to sample background, defaulting to white");
      }
    }

    processor = sharp(encodedData);

    switch (step.type) {
      case "resize_canvas": {
        const size = Math.max(encodedInfo.width, encodedInfo.height);
        processor = processor
          .extend({
            left: Math.floor((size - encodedInfo.width) / 2),
            right:
              size -
              encodedInfo.width -
              Math.floor((size - encodedInfo.width) / 2),
            top: Math.floor((size - encodedInfo.height) / 2),
            bottom:
              size -
              encodedInfo.height -
              Math.floor((size - encodedInfo.height) / 2),
            background: sampledBackground,
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } });
        break;
      }
      case "scale_image":
        if (
          encodedInfo.width === encodedInfo.height &&
          encodedInfo.width > 500
        )
          processor = processor.resize(500, 500);
        break;
      case "crop_content":
        if (step.cropMode === "aspect_ratio" && step.aspectRatio) {
          const [rw, rh] = step.aspectRatio.split(":").map(Number);
          if (!isNaN(rw) && !isNaN(rh) && rw > 0 && rh > 0) {
            const currentRatio = encodedInfo.width / encodedInfo.height;
            const targetRatio = rw / rh;
            let extractRect;
            if (currentRatio > targetRatio) {
              // Image is wider than target
              const newWidth = Math.floor(encodedInfo.height * targetRatio);
              extractRect = {
                left: Math.floor((encodedInfo.width - newWidth) / 2),
                top: 0,
                width: newWidth,
                height: encodedInfo.height,
              };
            } else {
              // Image is taller than target
              const newHeight = Math.floor(encodedInfo.width / targetRatio);
              extractRect = {
                left: 0,
                top: Math.floor((encodedInfo.height - newHeight) / 2),
                width: encodedInfo.width,
                height: newHeight,
              };
            }
            processor = processor.extract(extractRect);
          }
        } else if (step.cropMode === "manual" && step.manualRect) {
          const { left, top, width, height } = step.manualRect;
          if (width > 0 && height > 0) {
            // Clamp values to image dimensions
            const safeLeft = Math.max(
              0,
              Math.min(left || 0, encodedInfo.width - 1)
            );
            const safeTop = Math.max(
              0,
              Math.min(top || 0, encodedInfo.height - 1)
            );
            const safeWidth = Math.min(width, encodedInfo.width - safeLeft);
            const safeHeight = Math.min(height, encodedInfo.height - safeTop);
            processor = processor.extract({
              left: safeLeft,
              top: safeTop,
              width: safeWidth,
              height: safeHeight,
            });
          }
        } else {
          // Default: crop to content
          processor = processor.trim({
            background: sampledBackground,
            threshold: step.threshold || 10,
          });
          if (step.padding)
            processor = processor.extend({
              top: step.padding,
              bottom: step.padding,
              left: step.padding,
              right: step.padding,
              background: { r: 255, g: 255, b: 255 },
            });
        }
        processor = processor.flatten({ background: { r: 255, g: 255, b: 255 } });
        break;
      case "convert":
        processor = processor.toFormat(step.format || "jpeg", {
          quality: step.quality || 90,
        });
        break;
      case "rename":
        // Handled in the route, no-op here
        break;
    }
  }
  await processor.toFile(outputPath);
  return await sharp(outputPath).metadata();
}

// --- Process Routes ---

router.post("/workflows/:id/preview", authenticate, async (req, res) => {
  const workflowId = req.params.id!;

  // Ownership check
  const ownerCheck = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, req.user!.id);
  if (!ownerCheck)
    return res.status(404).json({ error: "Workflow not found" });

  const workflow = db
    .prepare("SELECT pipeline_id, steps FROM workflows WHERE id = ?")
    .get(workflowId) as any;

  let steps = req.body.pipeline;
  if (!steps && workflow?.pipeline_id) {
    const pipeline = db
      .prepare("SELECT steps FROM pipelines WHERE id = ?")
      .get(workflow.pipeline_id) as any;
    if (pipeline) {
      try {
        steps = JSON.parse(pipeline.steps);
      } catch {
        return res.status(500).json({ error: "Corrupt pipeline data" });
      }
    }
  }
  if (!steps && workflow?.steps) {
    try {
      steps = JSON.parse(workflow.steps);
    } catch {
      return res.status(500).json({ error: "Corrupt workflow steps" });
    }
  }

  if (!steps) {
    return res
      .status(400)
      .json({ error: "No pipeline configured for this workflow" });
  }

  db.prepare(
    "UPDATE images SET status = 'processing' WHERE workflow_id = ? AND status != 'failed'"
  ).run(workflowId);

  const images = db
    .prepare(
      "SELECT * FROM images WHERE workflow_id = ? AND status != 'failed'"
    )
    .all(workflowId);

  res.status(202).json({ success: true });

  const limit = pLimit(3);
  await Promise.all(
    images.map((img: any) =>
      limit(async () => {
        const previewDir = path.join(PREVIEW_DIR, workflowId);
        if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
        const previewPath = path.join(previewDir, `${img.id}.webp`);
        const tempPath = path.join(WORKSPACE_DIR, `${img.id}-preview.webp`);
        try {
          await processImage(img.local_path, tempPath, steps, true);
          moveFile(tempPath, previewPath);
          db.prepare(
            "UPDATE images SET preview_path = ?, status = 'completed' WHERE id = ?"
          ).run(previewPath, img.id);
        } catch (e: any) {
          console.error(`Preview failed for ${img.id}:`, e);
          db.prepare(
            "UPDATE images SET status = 'failed', error_message = ? WHERE id = ?"
          ).run(e.message, img.id);
        }
      })
    )
  );
});

router.post("/workflows/:id/process", authenticate, async (req, res) => {
  const workflowId = req.params.id!;

  // Ownership check
  const ownerCheck = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, req.user!.id);
  if (!ownerCheck)
    return res.status(404).json({ error: "Workflow not found" });

  const workflow = db
    .prepare("SELECT pipeline_id, steps FROM workflows WHERE id = ?")
    .get(workflowId) as any;

  if (!workflow?.pipeline_id && !workflow?.steps) {
    return res
      .status(400)
      .json({ error: "No pipeline configured for this workflow" });
  }

  let steps;
  if (workflow.pipeline_id) {
    const pipeline = db
      .prepare("SELECT steps FROM pipelines WHERE id = ?")
      .get(workflow.pipeline_id) as any;
    if (!pipeline) {
      return res.status(400).json({ error: "Pipeline template not found" });
    }
    try {
      steps = JSON.parse(pipeline.steps);
    } catch {
      return res.status(500).json({ error: "Corrupt pipeline data" });
    }
  } else {
    try {
      steps = JSON.parse(workflow.steps);
    } catch {
      return res.status(500).json({ error: "Corrupt workflow steps" });
    }
  }
  const hasRename = steps.some((s: any) => s.type === "rename");
  const workflowData = db
    .prepare("SELECT name FROM workflows WHERE id = ?")
    .get(workflowId) as any;
  const sanitizedWorkflowName = workflowData.name.replace(/\s+/g, "_");

  db.prepare(
    "UPDATE images SET status = 'processing' WHERE workflow_id = ? AND selected = 1 AND status != 'failed'"
  ).run(workflowId);

  const images = db
    .prepare(
      "SELECT * FROM images WHERE workflow_id = ? AND selected = 1 AND status != 'failed' ORDER BY created_at ASC"
    )
    .all(workflowId);

  res.status(202).json({ success: true });

  const limit = pLimit(5);
  await Promise.all(
    images.map((img: any, index: number) =>
      limit(async () => {
        const format =
          steps.find((s: any) => s.type === "convert")?.format || "jpg";
        const ext = format === "jpeg" ? "jpg" : format;
        const filename = hasRename
          ? `${sanitizedWorkflowName}-${index + 1}.${ext}`
          : `${img.id}.${ext}`;
        const workflowDir = path.join(PROCESSED_DIR, workflowId);
        if (!fs.existsSync(workflowDir)) fs.mkdirSync(workflowDir, { recursive: true });
        const processedPath = path.join(workflowDir, filename);

        const tempPath = path.join(WORKSPACE_DIR, `${img.id}-processed.${ext}`);
        try {
          const meta = await processImage(
            img.local_path,
            tempPath,
            steps,
            false
          );
          moveFile(tempPath, processedPath);
          db.prepare(
            "UPDATE images SET processed_path = ?, status = 'completed', width = ?, height = ?, size = ? WHERE id = ?"
          ).run(
            processedPath,
            meta.width,
            meta.height,
            fs.statSync(processedPath).size,
            img.id
          );
        } catch (e: any) {
          console.error(`Processing failed for ${img.id}:`, e);
          db.prepare(
            "UPDATE images SET status = 'failed', error_message = ? WHERE id = ?"
          ).run(e.message, img.id);
        }
      })
    )
  );
  db.prepare("UPDATE workflows SET status = 'completed' WHERE id = ?").run(
    workflowId
  );
});

export default router;
