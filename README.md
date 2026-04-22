# ProductLens

A self-hosted toolkit for product content and catalog teams. Two independent modules:

1. **Image Processing** — bulk ingest, transform, and export product images through repeatable pipelines.
2. **Reporting** — process Pimcore xlsx exports per country (AU/NZ): produce cleansed versions and compute deltas between uploads.

## Features

### Image Processing
- **Multi-method ingestion** — Upload files directly, fetch from URLs, or scrape images from web pages
- **Custom processing pipelines** — Chain operations like crop, resize, scale, convert, and bulk rename in any order
- **Real-time previews** — See processed results before committing to a full batch run
- **Bulk export** — Download processed images as ZIP or generate XLSX manifests with public image URLs
- **Public image serving** — Processed images are available at `/images/{workflowId}/{filename}` without authentication

### Reporting
- **Pimcore export ingestion** — Upload xlsx exports per country (AU/NZ); strict header + country validation rejects malformed files at upload time
- **Cleansed downloads** — Drop nine junk columns, filter dash-only rows, sort by IMSKU
- **Delta downloads** — Identify rows whose IMSKU is new vs the previous upload, with the same cleansing rules applied
- **Shared org-level state** — Everyone sees the same "current" report per country; the most recent two uploads are retained for delta comparison

### Platform
- **Role-based access** — Admin, pipeline editor, and operator roles with per-workflow ownership
- **Docker-ready** — Single container deployment with persistent storage and health checks
- **Tiered rate limiting** — Loose limit on the API surface, strict limit on auth + scrape endpoints; works correctly behind a reverse proxy

## Quick Start

### Docker (recommended)

Pull and run the latest image from GHCR:

```yaml
# docker-compose.yml
services:
  productlens:
    image: ghcr.io/regalen/productlens:latest
    container_name: productlens
    ports:
      - "3446:3446"
    volumes:
      - app-data:/data
      - app-workspace:/tmp/workspace
    environment:
      - PORT=3446
      - BASE_URL=https://your-domain.com
      - JWT_SECRET=replace-with-a-strong-random-secret
      - CORS_ORIGIN=https://your-domain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3446/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 30s
      retries: 3

volumes:
  app-data:
  app-workspace:
```

```bash
# Generate a secure JWT secret
export JWT_SECRET=$(openssl rand -hex 32)

docker compose up -d
```

> **Behind a reverse proxy?** The app trusts one upstream hop and reads the real client IP from `X-Forwarded-For` so rate limiting works per-client. The typical nginx/Traefik/Caddy → container topology works out of the box; if you stack multiple proxies, adjust `app.set("trust proxy", N)` in [server/index.ts](server/index.ts).

### Local Development

**Prerequisites:** Node.js 20+

```bash
npm install
cp .env.example .env.local
# Edit .env.local and set JWT_SECRET
npm run dev
```

The app will be available at `http://localhost:3000`.

### Default Credentials

On first run, a default admin account is created:

- **Username:** `admin`
- **Password:** `admin`

Change this immediately after first login.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` (Docker: `3446`) | Server listen port |
| `JWT_SECRET` | Random (regenerated on restart) | Secret for signing JWT tokens |
| `BASE_URL` | `http://localhost:{PORT}` | Public URL for generated image links |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `DATA_DIR` | `./data` (Docker: `/data`) | Persistent storage directory |
| `WORKSPACE_DIR` | `{DATA_DIR}/workspace` (Docker: `/tmp/workspace`) | Temp directory for in-flight processing |

## How It Works

### Image Processing

Workflows move through a five-stage pipeline:

1. **Ingest** — Add images via file upload, URL fetch, or web scraping
2. **Configure** — Select or build a processing pipeline (crop, resize, scale, convert, rename)
3. **Preview** — Generate and review processed previews
4. **Process** — Run the full pipeline on selected images
5. **Export** — Download as ZIP or XLSX with public image URLs

### Reporting

1. Pick a report type from the **Reporting** tab (currently `Data_Missing_Report_Webvisible`)
2. Select the country (**AU** or **NZ**)
3. Upload the latest Pimcore xlsx export — it's strict-validated against the canonical 18-column schema and the country code in every row
4. Download:
   - **Original** — your raw upload, untouched
   - **Cleansed** — junk columns dropped, dash-only rows filtered, sorted by IMSKU
   - **Delta** — only the IMSKUs new since the previous upload, with cleansing applied (available once a second upload exists)

Every (report, country) keeps the most recent two uploads. The system is shared org-wide: any authenticated user sees the same current/previous and can replace it with a new upload.

## Data Retention

Image-processing workflows (and all associated data — uploaded source images, generated previews, processed outputs, and database rows) are **automatically deleted 7 days after creation**, regardless of status. This keeps the SQLite database and `/data` volume lean.

**Export your results before the 7-day window closes.** Use the ZIP or XLSX export on the output stage to download everything you need. The purge runs hourly in the background and on server startup.

**Reports are exempt from this purge.** Each (report, country) holds the most recent and previous upload indefinitely; uploading a new version evicts the old previous and rotates the slots.

## Tech Stack

- **Frontend:** React 19, React Router v7, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend:** Express, better-sqlite3, Sharp (image processing), ExcelJS (xlsx read/write), JSZip, Multer, Cheerio (web scraping)
- **Auth + safety:** JWT cookies (httpOnly, SameSite=lax, secure in prod), bcryptjs, express-rate-limit (tiered), SSRF protection on outbound fetches
- **Build:** Vite, TypeScript (strict mode, `noUncheckedIndexedAccess`), Vitest
- **Deploy:** Docker (node:20-slim), GitHub Actions CI/CD, GHCR

## Development

```bash
npm run dev          # Start dev server (Express + Vite HMR)
npm run lint         # Type-check with tsc --noEmit
npm test             # Run tests
npm run build        # Production build
```

## License

Released under the [MIT License](LICENSE).
