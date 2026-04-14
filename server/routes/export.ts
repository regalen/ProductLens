import { Router } from "express";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import db from "../../db.js";
import { BASE_URL } from "../config.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/workflows/:id/export/xlsx", authenticate, async (req, res) => {
  const workflowId = req.params.id;

  // Ownership check
  const workflow = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, req.user!.id);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const images = db
    .prepare(
      "SELECT * FROM images WHERE workflow_id = ? AND selected = 1"
    )
    .all(workflowId);
  if (images.some((img: any) => !img.type))
    return res
      .status(400)
      .json({ error: "All images must have a type assigned" });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Images");
  sheet.columns = [
    { header: "Image Type", key: "type" },
    { header: "URL", key: "url" },
  ];
  images.forEach((img: any) => {
    const filename = img.processed_path ? path.basename(img.processed_path) : img.id;
    sheet.addRow({
      type: img.type,
      url: `${BASE_URL}/images/${workflowId}/${filename}`,
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=export.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/workflows/:id/export/zip", authenticate, async (req, res) => {
  const workflowId = req.params.id;

  // Ownership check
  const workflow = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, req.user!.id);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const images = db
    .prepare(
      "SELECT * FROM images WHERE workflow_id = ? AND selected = 1 AND status = 'completed'"
    )
    .all(workflowId);
  const zip = new JSZip();
  images.forEach((img: any) => {
    if (img.processed_path) {
      const name = path.basename(img.processed_path);
      zip.file(name, fs.readFileSync(img.processed_path));
    }
  });
  const content = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=images.zip");
  res.send(content);
});

export default router;
