# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProductLens is a full-stack tool for Ingram Micro's content/catalog teams. Two largely independent modules:

1. **Image Processing** (the original module) — multi-method ingestion (upload, URL fetch, web scraping), custom processing pipelines (crop, resize, scale, convert, bulk rename), real-time previews, bulk export (ZIP/XLSX).
2. **Reporting** — process Pimcore xlsx exports per country (AU/NZ): produce a cleansed version of the latest upload and a delta against the prior upload. See the Reporting module section below.

## Commands

- `npm run dev` — Start the dev server (Express + Vite, port configurable via `PORT` env, default 3000)
- `npm run build` — Production build via Vite
- `npm run lint` — Type-check with `tsc --noEmit` (strict mode enabled)
- `npm test` — Run all tests with Vitest
- `npm run test:watch` — Run tests in watch mode
- `npm run clean` — Remove dist directory
- `docker compose up --build` — Build and run in Docker (port 3446)

## Environment

Copy `.env.example` to `.env.local` and set `JWT_SECRET`. If `JWT_SECRET` is not set, a random secret is generated on each server start (sessions won't survive restarts).

Key env vars: `PORT` (default 3000, Docker default 3446), `BASE_URL` (external URL for public image links), `JWT_SECRET`, `CORS_ORIGIN` (default `*`), `DATA_DIR` (default `./data`, Docker `/data`), `WORKSPACE_DIR` (default `DATA_DIR/workspace`, Docker `/tmp/workspace`).

## Architecture

**Full-stack app** — Express backend (`server/`) serves the API and the Vite-bundled React frontend. No separate processes.

### Backend (`server/`, `db.ts`)

```
server/
  index.ts              — Express app setup, middleware, Vite integration, listen. Sets `app.set("trust proxy", 1)` so express-rate-limit reads the real client IP from X-Forwarded-For behind a single reverse-proxy hop.
  config.ts             — PORT, BASE_URL, DATA_DIR, UPLOAD_DIR, PREVIEW_DIR, PROCESSED_DIR, REPORTS_DIR, WORKSPACE_DIR, CORS_ORIGIN, JWT_SECRET
  types.ts              — DB row interfaces (UserRow, WorkflowRow, ImageRow, PipelineRow, ReportFileRow)
  middleware/
    auth.ts             — authenticate(), requireRole() middleware
    rateLimit.ts        — looseLimiter (300/min, applied globally to /api) and strictLimiter (10/min, applied inline to /api/auth/login and /api/scrape)
  routes/
    auth.ts             — login, logout, change-password, me
    admin.ts            — user CRUD (admin only)
    pipelines.ts        — pipeline CRUD (pipeline_editor + admin)
    workflows.ts        — workflow CRUD + reset (ownership enforced)
    ingest.ts           — file upload, URL fetch, web scraping (with SSRF protection)
    processing.ts       — processImage() helper, preview + process routes
    images.ts           — image delete/patch, asset/preview serving (auth + ownership), public /images/:workflowId/:filename (no auth)
    export.ts           — XLSX and ZIP export (ownership enforced)
    reports.ts          — Reporting module: list report types, per-country state, upload, download (original / cleansed / delta). Shared org-level — no per-user scoping.
    config.ts           — exposes runtime config to the frontend (currently `purgeDays`)
  utils/
    validation.ts       — validatePassword, validateRole, validateWorkflowName, validatePipelineSteps, validateCountryCode, validateReportType
    url.ts              — isPrivateUrl(), safeAxiosGet() for SSRF protection
    purge.ts            — deleteWorkflowAndFiles(), purgeExpiredWorkflows() — sweeps workflows older than 7 days; reports are NOT touched
    reports.ts          — Reporting helpers: validateUploadedWorkbook(), cleanseInMemory()/cleanseFile(), buildDelta()
```

- `db.ts` (project root) initializes SQLite via `better-sqlite3` at `data/database.sqlite`. Schema with migration guards. Seeds default admin (admin/admin). Indexes on foreign keys.
- All workflow-scoped routes enforce ownership (`WHERE user_id = ?`).
- Image uploads restricted to image MIME types, 50MB max per file.
- Image processing uses Sharp. Key operations: "Resize Canvas" squares with pure-white padding via `.extend()`; "Crop Content" uses `.trim()` with the sampled (top-left pixel) background, or manual extraction.
- Image dimensions are captured server-side at three points: on ingest (`images.width` / `images.height`, via `sharp().metadata()` after download/upload); on preview generation (`images.preview_width` / `images.preview_height`); on final processing, `width`/`height` are overwritten with the processed output's dimensions. Displayed on IngestStage and PreviewStage cards.
- Web scraping uses Axios + Cheerio with multi-agent retry strategy. SSRF protection blocks private IPs.
- Bulk Rename uses workflow name as prefix with iterating index (e.g., `Workflow_Name-1.jpg`).
- Processed files stored in `data/processed/{workflowId}/{filename}` subdirectories to prevent collisions.
- Public image URLs: `/images/{workflowId}/{filename}` — no auth, used in XLSX exports and "Copy Asset URL".
- Exports: JSZip for ZIP, ExcelJS for XLSX (uses `BASE_URL` for public image links).
- User activity tracking on the `users` table: `last_login_at` (UTC timestamp written by `POST /auth/login`; frontend displays in `Australia/Sydney` zone with an `AEST` label); lifetime counters `workflows_created_total` (incremented on workflow create) and `images_processed_total` (incremented once per batch after `Promise.all` in the `/process` route, not per image). These counters are **not** decremented by the 7-day purge — that's the point. Surfaced on the admin `/users` cards and in a hover tooltip over the header username.

### Reporting module (`/api/reports`)

- Independent from the image-processing domain: separate routes (`server/routes/reports.ts`), separate `report_files` table, no cross-references with workflows/pipelines/images.
- Today supports one report type — `data_missing_webvisible` (Pimcore "Data_Missing_Report_Webvisible" export) — for two countries: `AU` and `NZ`. Adding a report type means appending to `REPORT_DEFINITIONS` in `server/routes/reports.ts` and `SUPPORTED_REPORT_TYPES` in `server/utils/validation.ts`.
- Per (report, country) the system keeps **two slots** — `current` and `previous` — enforced by `UNIQUE (report_type, country, slot)` on `report_files`. On upload the old `previous` is deleted, `current` rotates into `previous`, and the new file becomes `current`. This is the minimum needed for the delta and keeps disk usage bounded.
- Files live under `data/reports/{report_type}/{country}/{slot}/{original.xlsx,cleansed.xlsx}`. Slot rotation is by directory rename, not file copy.
- **Shared org-level visibility** — every authenticated user (any role) sees the same `current`/`previous`. No per-user scoping. Reports are **not** subject to the 7-day workflow purge.
- Upload is **strictly validated**: the workbook's first sheet must have the canonical 18 Pimcore columns in the exact order, and every row's `Country` cell must match the route param. Mismatches return `400` with a clear diff. The xlsx mime check is loose (`.xlsx` extension); ExcelJS surfaces malformed files.
- **Cleansing rules** (applied to both Cleansed and Delta downloads): drop 10 junk columns (Country, Language, Vendor_Code, Rich Media, Marketing Text, Similar Products, Accessories, Warranty, Compatibility Data, WebVisible); filter rows where `Images === '-'` AND `Specification === '-'`; sort by IMSKU as a **string** (lexicographic — preserves cell type, intentionally not numeric); append an empty `Action` column to the right of `Specification` (Country is redundant because the country prefix is already in the filename; Action is left blank for users to fill in). Validation against the canonical 18-column upload schema still requires Country in column 0.
- **Delta**: rows in `current` whose IMSKU is not in `previous` (IMSKU is the row identity), then run through the same cleansing rules.
- Download filenames: `{COUNTRY}_Data_Missing_Report_Webvisible.xlsx` (cleansed), `{COUNTRY}_Delta_Data_Missing_Report_Webvisible.xlsx` (delta). Original is downloaded under the user's uploaded filename.
- Multer cap on report uploads is 100MB (vs 50MB on the image-ingest route) — Pimcore exports of ~85k rows weigh in around 8MB but headroom matters.

## Docker

- `Dockerfile` — Multi-stage build (node:20-slim) with native deps for sharp, better-sqlite3, canvas. Includes wget for healthcheck. Sets `DATA_DIR=/data` and `WORKSPACE_DIR=/tmp/workspace`.
- `docker-compose.yml` — Pulls from `ghcr.io/regalen/productlens:latest`. Port 3446. Two volumes: `app-data:/data` (persistent DB + images), `app-workspace:/tmp/workspace` (ephemeral processing). Healthcheck via wget against `/api/health`. Env vars: `PORT`, `BASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
- `.dockerignore` — Excludes node_modules, dist, data, .git, .env files.
- Image processing uses `WORKSPACE_DIR` for temp files during processing, then moves to final location. This keeps the workspace volume ephemeral and separate from persistent data.

## CI/CD

- `.github/workflows/build.yml` — On every push: lint, test, then build and push Docker image to GHCR. Tags: `sha-<commit>` on all branches, `latest` on default branch. Uses `docker/metadata-action` for tag management.

### Frontend (`src/`)

- React 19 + React Router DOM v7 + Tailwind CSS v4 + shadcn/ui (base-nova style).
- Path alias: `@/*` maps to the project root (not `src/`).
- State: AuthContext for auth, local component state elsewhere.
- `src/pages/` — Route-level components: Dashboard, Login, WorkflowView, PipelineManager, UserManagement, ChangePassword, Reporting (`/reporting`), ReportDetail (`/reporting/:reportType`).
- `src/components/` — Feature components including Layout, PipelineBuilder, WorkflowStages/.
- `components/` (root) — shadcn UI primitives.
- `src/types.ts` — Shared TypeScript interfaces for Pipeline, Workflow, WorkflowImage, User.
- PipelineBuilder uses `Reorder.Group` from Framer Motion for drag-and-drop step sequencing.
- Global Axios interceptor handles 401 redirects.
- Animations via `motion/react` (Framer Motion). Icons via Lucide React.

### Data Flow

Workflows progress through stages: **ingest** (upload/URL/scrape images) -> **configure** (select pipeline) -> **preview** (see processed previews) -> **processing** -> **completed** (download ZIP/XLSX). WorkflowView polls the backend at 3s intervals, stopping when status is "completed".

### Tests (`tests/`)

- Vitest with globals enabled, Node environment.
- `tests/utils/url.test.ts` — SSRF protection tests
- `tests/utils/validation.test.ts` — Input validation tests
- `tests/utils/purge.test.ts` — 7-day workflow purge sweep tests (in-memory SQLite + real fs)
- `tests/utils/reports.test.ts` — Cleanse + delta + upload-validation tests
- `tests/middleware/auth.test.ts` — Auth middleware tests (mocked DB + JWT)

## TypeScript

Strict mode is enabled (`strict: true`, `noUncheckedIndexedAccess: true`). DB row types are defined in `server/types.ts`. Express `Request` is augmented with `user` in `server/middleware/auth.ts`.

## Known Limitations

- SQLite is used for simplicity; not suited for high-concurrency production.
- WorkflowView uses 3s polling; no WebSocket support yet.
- Local filesystem storage only (no S3/GCS).
- Cheerio-based scraping cannot handle JavaScript-heavy sites.
- Workflows are hard-purged 7 days after `created_at` by an hourly in-process sweep (see `server/utils/purge.ts`). All associated images, previews, and processed outputs are deleted alongside the workflow row. Reports are exempt.
- Reporting keeps only the most recent two uploads per (report, country) — older uploads are not retained, no audit log of who uploaded what historically.
- `app.set("trust proxy", 1)` assumes exactly one reverse-proxy hop between clients and the app. Stacking two proxies would let clients spoof their IP for rate-limit purposes; bump that number if your topology changes.

## Design Tokens

- Primary blue: `#0077d4`
- Font: Inter (loaded via Google Fonts)
- App name is "ProductLens" (case-sensitive, no spaces)
- Header nav items: Image Processing, Reporting (live), Add Ons (placeholder), Taxonomy Mapping (placeholder)

## Release Management

- **Versioning standard: Semantic Versioning (SemVer)** — `MAJOR.MINOR.PATCH`.
  - **MAJOR** — incompatible / breaking changes.
  - **MINOR** — new backwards-compatible functionality.
  - **PATCH** — backwards-compatible bug fixes.
- **Commit message convention: Conventional Commits.** Every commit subject must start with one of:
  - `feat:` — new feature (implies a MINOR bump).
  - `fix:` — bug fix (implies a PATCH bump).
  - `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `style:`, `revert:` — no version bump on their own.
  - Append `!` (e.g. `feat!:`) or include `BREAKING CHANGE:` in the body to signal a MAJOR bump.
  - Optional scope is allowed: `feat(pipelines): …`, `fix(auth): …`.
- The single source of truth for the app version is the `version` field in [package.json](package.json). Bump it in the same commit as the release (or in a dedicated `chore(release): vX.Y.Z` commit), and tag the release with `vX.Y.Z`.
- **Current version: `0.5.2`** (released 2026-04-22). `1.0.0` is reserved for when the API contract is considered stable.

## Committing Guidelines

Before **every** commit, Claude must:

1. **Analyze the staged diff** and classify the change using Conventional Commits. Determine the implied next SemVer (MAJOR / MINOR / PATCH / none).
2. **Always ask the user**:
   > "Should I also create a new GitHub release for these changes? [Recommended] / [Not Recommended] — based on SemVer."
   Include a one-line reason explaining the recommendation, for example:
   - *"This contains a new feature (`feat:`) → MINOR bump recommended (0.0.0 → 0.1.0)."*
   - *"This contains only a `fix:` → PATCH bump recommended (0.1.0 → 0.1.1)."*
   - *"This is `chore:` / `docs:` only — no release recommended."*
   - *"This commit contains a `BREAKING CHANGE` → MAJOR bump recommended (0.x.y → 1.0.0)."*
3. If the user agrees:
   - Bump `version` in [package.json](package.json) to the proposed value.
   - Commit the bump with `chore(release): vX.Y.Z` (or fold the bump into the feature/fix commit — ask the user which style they prefer on the first release).
   - Use the `gh` CLI to create the tag and release:
     - `git tag -a vX.Y.Z -m "vX.Y.Z"`
     - `git push origin vX.Y.Z`
     - `gh release create vX.Y.Z --generate-notes --title "vX.Y.Z"`
   - Confirm the release URL back to the user.
4. If the user declines the release, commit normally without bumping `version`.
