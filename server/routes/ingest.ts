import { Router } from "express";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import pLimit from "p-limit";
import sizeOf from "image-size";
import db from "../../db.js";
import { UPLOAD_DIR } from "../config.js";
import { authenticate } from "../middleware/auth.js";
import { isPrivateUrl } from "../utils/url.js";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/gif",
];

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

const router = Router();

router.post(
  "/workflows/:id/upload",
  authenticate,
  upload.array("files"),
  async (req, res) => {
    const workflowId = req.params.id;

    // Ownership check
    const workflow = db
      .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
      .get(workflowId, req.user!.id);
    if (!workflow)
      return res.status(404).json({ error: "Workflow not found" });

    const files = req.files as any[];
    const stmt = db.prepare(
      "INSERT INTO images (id, workflow_id, local_path, status, selected) VALUES (?, ?, ?, 'completed', 1)"
    );
    for (const file of files) {
      const id = uuidv4();
      const ext = path.extname(file.originalname) || ".jpg";
      const newPath = `${file.path}${ext}`;
      fs.renameSync(file.path, newPath);
      stmt.run(id, workflowId, newPath);
    }
    res.json({ success: true });
  }
);

router.post("/workflows/:id/urls", authenticate, async (req, res) => {
  const { urls } = req.body;
  const workflowId = req.params.id;

  // Validate urls input
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls must be a non-empty array" });
  }
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return res
          .status(400)
          .json({ error: `Invalid URL (must be http or https): ${url}` });
      }
    } catch {
      return res.status(400).json({ error: `Invalid URL: ${url}` });
    }
  }

  // Ownership check
  const workflow = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, req.user!.id);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const limit = pLimit(3);
  const stmt = db.prepare(
    "INSERT INTO images (id, workflow_id, original_url, local_path, status, selected) VALUES (?, ?, ?, ?, 'completed', 1)"
  );

  const tasks = urls.map((url: string) =>
    limit(async () => {
      const id = uuidv4();

      // SSRF protection
      if (isPrivateUrl(url)) {
        db.prepare(
          "INSERT INTO images (id, workflow_id, original_url, status, error_message, selected) VALUES (?, ?, ?, 'failed', ?, 0)"
        ).run(id, workflowId, url, "URL points to a private/internal address");
        return;
      }

      const ext = path.extname(new URL(url).pathname) || ".jpg";
      const localPath = path.join(UPLOAD_DIR, `${id}${ext}`);
      try {
        const response = await axios.get(url, {
          responseType: "stream",
          timeout: 15000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        await new Promise<void>((resolve, reject) => {
          writer.on("finish", () => resolve());
          writer.on("error", reject);
        });
        stmt.run(id, workflowId, url, localPath);
      } catch (e: any) {
        db.prepare(
          "INSERT INTO images (id, workflow_id, original_url, status, error_message, selected) VALUES (?, ?, ?, 'failed', ?, 0)"
        ).run(id, workflowId, url, e.message);
      }
    })
  );

  await Promise.all(tasks);
  res.json({ success: true });
});

router.post("/scrape", authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  // SSRF protection
  if (isPrivateUrl(targetUrl)) {
    return res
      .status(400)
      .json({ error: "URL points to a private/internal address" });
  }

  const agents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", // Mobile first (often less protection)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  ];

  const domain = new URL(targetUrl).hostname;
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function tryScrape(agentIndex = 0): Promise<any> {
    try {
      if (agentIndex > 0) await delay(2000 + Math.random() * 2000);

      // Step 1: Try to get a session cookie from the home page or a common entry point
      let cookie = "";
      try {
        const cookieResponse = await axios.get(`https://${domain}/`, {
          headers: {
            "User-Agent": agents[agentIndex],
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            Host: domain,
          },
          timeout: 10000,
          validateStatus: () => true,
        });
        if (cookieResponse.headers["set-cookie"]) {
          cookie = cookieResponse.headers["set-cookie"]
            .map((c: string) => c.split(";")[0])
            .join("; ");
        }
      } catch (e) {
        console.warn(
          `Cookie fetch failed for ${domain}, proceeding without cookies.`
        );
      }

      // Step 2: Perform the actual scrape with the acquired cookie
      const response = await axios.get(targetUrl, {
        headers: {
          "User-Agent": agents[agentIndex],
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Referer:
            agentIndex === 0
              ? "https://www.google.com/"
              : `https://${domain}/`,
          Cookie: cookie,
          Host: domain,
          "Sec-Ch-Ua":
            agentIndex === 0
              ? ""
              : '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
          "Sec-Ch-Ua-Mobile": agentIndex === 0 ? "?1" : "?0",
          "Sec-Ch-Ua-Platform":
            agentIndex === 0
              ? '"iOS"'
              : agentIndex === 1
              ? '"Windows"'
              : '"macOS"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site":
            agentIndex === 0 ? "cross-site" : "same-origin",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
        timeout: 30000,
        maxRedirects: 5,
      });
      return response;
    } catch (e: any) {
      if (e.response?.status === 403 && agentIndex < agents.length - 1) {
        console.log(
          `403 detected for ${targetUrl}, retrying with agent ${agentIndex + 1}...`
        );
        return tryScrape(agentIndex + 1);
      }
      throw e;
    }
  }

  try {
    const response = await tryScrape();
    const $ = cheerio.load(response.data);

    // Check for common bot challenge indicators
    if (
      $("title").text().includes("Cloudflare") ||
      $("title").text().includes("Attention Required") ||
      response.data.includes("cf-challenge")
    ) {
      throw new Error(
        "This website is protected by Cloudflare or a similar service that requires a browser challenge. Please use the 'URLs' tab to manually add image links."
      );
    }

    const candidates: string[] = [];
    $(
      "img, [srcset], [data-src], meta[property='og:image']"
    ).each((i, el) => {
      let src =
        $(el).attr("src") ||
        $(el).attr("data-src") ||
        $(el).attr("content") ||
        $(el).attr("srcset")?.split(" ")[0];
      if (src) {
        try {
          if (!src.startsWith("http")) src = new URL(src, targetUrl).href;
          candidates.push(src);
        } catch (e) {
          console.warn(
            `Failed to resolve URL: ${src} with base ${targetUrl}`
          );
        }
      }
    });

    const uniqueCandidates = [...new Set(candidates)];
    const limit = pLimit(5);
    const results = await Promise.all(
      uniqueCandidates.map((src) =>
        limit(async () => {
          // SSRF protection for each discovered image URL
          if (isPrivateUrl(src)) return null;
          try {
            const head = await axios.get(src, {
              headers: {
                Range: "bytes=0-65535",
                "User-Agent": agents[0],
              },
              responseType: "arraybuffer",
              timeout: 5000,
            });
            const dimensions = sizeOf(Buffer.from(head.data));
            if (dimensions.width && dimensions.width >= 200) {
              return {
                url: src,
                width: dimensions.width,
                height: dimensions.height,
                size: head.headers["content-length"],
              };
            }
          } catch (e) {}
          return null;
        })
      )
    );

    const filtered = results
      .filter((r) => r !== null)
      .sort((a: any, b: any) => (b.size || 0) - (a.size || 0));
    res.json({ images: filtered });
  } catch (e: any) {
    const status = e.response?.status;
    let message = e.message;

    if (status === 403) {
      message =
        "Access Denied (403). This website is blocking automated scans. Try the 'URLs' tab to paste direct image links manually.";
    } else if (status === 404) {
      message = "Page not found (404). Please check the URL.";
    }

    console.error(`Scrape failed for ${targetUrl}:`, message);
    res.status(status || 500).json({ error: message });
  }
});

export default router;
