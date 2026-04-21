import { Router, type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import db from "../../db.js";
import { REPORTS_DIR, UPLOAD_DIR } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import {
  validateCountryCode,
  validateReportType,
} from "../utils/validation.js";
import {
  buildDelta,
  cleanseInMemory,
  loadWorkbook,
  validateUploadedWorkbook,
} from "../utils/reports.js";
import type { ReportFileRow } from "../types.js";

const router = Router();

const REPORT_DEFINITIONS = [
  {
    id: "data_missing_webvisible",
    label: "Data_Missing_Report_Webvisible",
    description:
      "Pimcore export listing web-visible products with missing critical attributes.",
    countries: ["AU", "NZ"] as const,
  },
];

const REPORT_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  REPORT_DEFINITIONS.map((r) => [r.id, r.label]),
);

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      return cb(new Error("Only .xlsx files are accepted"));
    }
    cb(null, true);
  },
});

// Wrap multer to convert its errors into 400s instead of bubbling to the
// global 500 handler in server/index.ts.
function uploadSingleXlsx(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = (err as Error)?.message || "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}

function slotDir(
  reportType: string,
  country: string,
  slot: "current" | "previous",
): string {
  return path.join(REPORTS_DIR, reportType, country, slot);
}
function originalFilePath(
  reportType: string,
  country: string,
  slot: "current" | "previous",
): string {
  return path.join(slotDir(reportType, country, slot), "original.xlsx");
}
function cleansedFilePath(
  reportType: string,
  country: string,
  slot: "current" | "previous",
): string {
  return path.join(slotDir(reportType, country, slot), "cleansed.xlsx");
}

function safeUnlink(p: string | null | undefined) {
  if (!p) return;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}
function safeRmDir(p: string) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function getReportRow(
  reportType: string,
  country: string,
  slot: "current" | "previous",
): ReportFileRow | undefined {
  return db
    .prepare(
      "SELECT * FROM report_files WHERE report_type = ? AND country = ? AND slot = ?",
    )
    .get(reportType, country, slot) as ReportFileRow | undefined;
}

interface ReportSummary {
  uploadedBy: string;
  uploadedByDisplayName: string;
  uploadedAt: string;
  rowCount: number | null;
  originalFilename: string;
}

type ReportRowWithDisplay = ReportFileRow & { uploaded_by_display_name: string };

function rowToSummary(row: ReportRowWithDisplay): ReportSummary {
  return {
    uploadedBy: row.uploaded_by,
    uploadedByDisplayName: row.uploaded_by_display_name,
    uploadedAt: row.uploaded_at,
    rowCount: row.row_count,
    originalFilename: row.original_filename,
  };
}

function getStateForCountry(reportType: string, country: string) {
  const rows = db
    .prepare(
      `SELECT rf.*, u.display_name AS uploaded_by_display_name
       FROM report_files rf
       JOIN users u ON u.id = rf.uploaded_by
       WHERE rf.report_type = ? AND rf.country = ?`,
    )
    .all(reportType, country) as ReportRowWithDisplay[];
  const current = rows.find((r) => r.slot === "current");
  const previous = rows.find((r) => r.slot === "previous");
  return {
    current: current ? rowToSummary(current) : null,
    previous: previous ? rowToSummary(previous) : null,
    hasDelta: !!current && !!previous,
  };
}

router.get("/", authenticate, (_req, res) => {
  res.json(REPORT_DEFINITIONS);
});

router.get("/:reportType/:country", authenticate, (req, res) => {
  const { reportType, country } = req.params;
  if (!validateReportType(reportType))
    return res.status(400).json({ error: "Unknown report type" });
  if (!validateCountryCode(country))
    return res.status(400).json({ error: "Unsupported country" });
  res.json(getStateForCountry(reportType, country));
});

router.post(
  "/:reportType/:country/upload",
  authenticate,
  uploadSingleXlsx,
  async (req, res) => {
    const { reportType, country } = req.params;
    if (!validateReportType(reportType))
      return res.status(400).json({ error: "Unknown report type" });
    if (!validateCountryCode(country))
      return res.status(400).json({ error: "Unsupported country" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const wb = await loadWorkbook(file.path);
      const result = validateUploadedWorkbook(wb, country);
      if (!result.ok) {
        safeUnlink(file.path);
        return res.status(400).json({ error: result.error ?? "Invalid file" });
      }

      const curRow = getReportRow(reportType, country, "current");
      const prevRow = getReportRow(reportType, country, "previous");
      const prevDir = slotDir(reportType, country, "previous");
      const curDir = slotDir(reportType, country, "current");

      if (prevRow) {
        db.prepare("DELETE FROM report_files WHERE id = ?").run(prevRow.id);
      }
      safeRmDir(prevDir);

      if (curRow) {
        if (fs.existsSync(curDir)) {
          fs.mkdirSync(path.dirname(prevDir), { recursive: true });
          fs.renameSync(curDir, prevDir);
          db.prepare(
            "UPDATE report_files SET slot = 'previous', original_path = ?, cleansed_path = ? WHERE id = ?",
          ).run(
            originalFilePath(reportType, country, "previous"),
            cleansedFilePath(reportType, country, "previous"),
            curRow.id,
          );
        } else {
          db.prepare("DELETE FROM report_files WHERE id = ?").run(curRow.id);
        }
      }

      fs.mkdirSync(curDir, { recursive: true });
      const newOriginal = originalFilePath(reportType, country, "current");
      const newCleansed = cleansedFilePath(reportType, country, "current");
      fs.renameSync(file.path, newOriginal);
      const cleansedWb = cleanseInMemory(wb);
      await cleansedWb.xlsx.writeFile(newCleansed);

      db.prepare(
        `INSERT INTO report_files (id, report_type, country, slot, original_filename, original_path, cleansed_path, uploaded_by, row_count)
         VALUES (?, ?, ?, 'current', ?, ?, ?, ?, ?)`,
      ).run(
        uuidv4(),
        reportType,
        country,
        file.originalname,
        newOriginal,
        newCleansed,
        req.user!.id,
        result.rowCount,
      );

      res.json(getStateForCountry(reportType, country));
    } catch (e: unknown) {
      safeUnlink(file.path);
      console.error("[reports] upload failed:", e);
      const msg = (e as Error)?.message ?? "Upload failed";
      res.status(500).json({ error: msg });
    }
  },
);

router.get(
  "/:reportType/:country/download/:variant",
  authenticate,
  async (req, res) => {
    const { reportType, country, variant } = req.params;
    if (!validateReportType(reportType))
      return res.status(400).json({ error: "Unknown report type" });
    if (!validateCountryCode(country))
      return res.status(400).json({ error: "Unsupported country" });
    const label = REPORT_LABEL_BY_ID[reportType];
    if (!label) return res.status(400).json({ error: "Unknown report type" });

    const cur = getReportRow(reportType, country, "current");
    if (!cur) return res.status(404).json({ error: "No report uploaded yet" });

    if (variant === "original") {
      const p = originalFilePath(reportType, country, "current");
      if (!fs.existsSync(p))
        return res.status(404).json({ error: "File missing on disk" });
      return res.download(p, cur.original_filename);
    }
    if (variant === "cleansed") {
      const p = cleansedFilePath(reportType, country, "current");
      if (!fs.existsSync(p))
        return res.status(404).json({ error: "Cleansed file missing on disk" });
      return res.download(p, `${country}_${label}.xlsx`);
    }
    if (variant === "delta" || variant === "cleansed_delta") {
      const prev = getReportRow(reportType, country, "previous");
      if (!prev)
        return res
          .status(404)
          .json({ error: "No previous upload to compare against" });
      const curPath = originalFilePath(reportType, country, "current");
      const prevPath = originalFilePath(reportType, country, "previous");
      try {
        let wb = await buildDelta(curPath, prevPath);
        if (variant === "cleansed_delta") wb = cleanseInMemory(wb);
        const filename =
          variant === "delta"
            ? `${country}_Delta_${label}.xlsx`
            : `${country}_Cleansed_Delta_${label}.xlsx`;
        res.setHeader("Content-Type", XLSX_MIME);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        await wb.xlsx.write(res);
        res.end();
      } catch (e: unknown) {
        console.error("[reports] delta build failed:", e);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: (e as Error)?.message ?? "Delta build failed" });
        }
      }
      return;
    }

    return res.status(400).json({ error: "Unknown variant" });
  },
);

export default router;
