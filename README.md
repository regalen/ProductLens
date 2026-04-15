# ProductLens

A self-hosted image processing platform for automating product image ingestion, transformation, and export. Built for content and catalog teams that need to process images in bulk with consistent, repeatable pipelines.

## Features

- **Multi-method ingestion** — Upload files directly, fetch from URLs, or scrape images from web pages
- **Custom processing pipelines** — Chain operations like crop, resize, scale, convert, and bulk rename in any order
- **Real-time previews** — See processed results before committing to a full batch run
- **Bulk export** — Download processed images as ZIP or generate XLSX manifests with public image URLs
- **Public image serving** — Processed images are available at `/images/{workflowId}/{filename}` without authentication
- **Role-based access** — Admin, pipeline editor, and operator roles with per-workflow ownership
- **Docker-ready** — Single container deployment with persistent storage and health checks

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

Workflows move through a five-stage pipeline:

1. **Ingest** — Add images via file upload, URL fetch, or web scraping
2. **Configure** — Select or build a processing pipeline (crop, resize, scale, convert, rename)
3. **Preview** — Generate and review processed previews
4. **Process** — Run the full pipeline on selected images
5. **Export** — Download as ZIP or XLSX with public image URLs

## Data Retention

Workflows (and all associated data — uploaded source images, generated previews, processed outputs, and database rows) are **automatically deleted 7 days after creation**, regardless of status. This keeps the SQLite database and `/data` volume lean.

**Export your results before the 7-day window closes.** Use the ZIP or XLSX export on the output stage to download everything you need. The purge runs hourly in the background and on server startup.

## Tech Stack

- **Frontend:** React 19, React Router v7, Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend:** Express, better-sqlite3, Sharp, Multer
- **Build:** Vite, TypeScript (strict mode), Vitest
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
