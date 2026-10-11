# MediShelf AI — Deployment Guide & Staging Operations

This document provides verified, production-grade instructions for deploying **MediShelf AI** to local staging and cloud hosting environments.

---

## 1. System Architecture & Hosting Topology

MediShelf AI consists of two complementary services:

```text
               [ Public Web Client (Browser) ]
                             |
             +---------------+---------------+
             |                               |
             v                               v
   [ Frontend Service ]            [ Backend Service ]
   - TanStack Start / React 19     - FastAPI (Python 3.11)
   - Nitro / Cloudflare target     - PyTorch 2.6 (CPU MobileNetV3)
   - Client bundle + SSR           - EasyOCR 1.7.2 (CRAFT + CRNN)
   - Talks via VITE_API_BASE_URL   - scikit-learn GradientBoosting
                                   - Master Knowledge Base (27,326 records)
                                   - App Transactional DB (SQLite / Postgres)
```

> [!IMPORTANT]
> Because the inference backend requires PyTorch, EasyOCR, and scikit-learn with bundled binary model checkpoints and SQLite indexes, it cannot execute on pure edge serverless runtimes (like Cloudflare Workers). It must be hosted on a containerized or VM platform (Docker, Render, Railway, Fly.io, or AWS/GCP).

---

## 2. Environment Variables Specification

### Frontend Environment (`.env` or Cloudflare / Vercel Settings)

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `VITE_API_BASE_URL` | String | `http://127.0.0.1:8000` | Absolute base URL of the FastAPI backend. Used cross-origin in staging/production. |
| `NODE_ENV` | String | `production` | Node.js execution environment. |
| `PORT` | Integer | `8080` | Port for local Nitro preview or Docker container. |

### Backend Environment (`backend/.env` or Container Environment)

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `ENVIRONMENT` | String | `development` | Deployment environment name (`development`, `staging`, `production`). |
| `PROJECT_NAME` | String | `MediShelf AI` | API title surfaced on `/docs` and `/api/health`. |
| `VERSION` | String | `0.1.0` | API semantic version. |
| `DEBUG` | Boolean | `False` | When `False`, SQLAlchemy echo is disabled and internal error tracebacks are suppressed. |
| `DATABASE_URL` | String | `sqlite:///./medishelf.db` | SQLAlchemy connection string. Supports `sqlite:///./medishelf.db` or PostgreSQL. |
| `CORS_ORIGINS` | String | `None` | Comma-separated list of allowed frontend origins (e.g. `https://medishelf.pages.dev`). |
| `ALLOWED_ORIGINS` | String | `localhost:3000...` | Fallback allowed origins list if `CORS_ORIGINS` is unset. |
| `HOST` | String | `127.0.0.1` | Network interface to bind (`0.0.0.0` in Docker). |
| `PORT` | Integer | `8000` | Port for the Uvicorn web server. |

---

## 3. Deployment Option A — Docker Compose (Recommended for Staging & Local Demo)

The repository provides [`Dockerfile`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/Dockerfile), [`Dockerfile.frontend`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/Dockerfile.frontend), and [`docker-compose.yml`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/docker-compose.yml).

### Execution

```bash
# Build and start both services in the background
docker compose up --build -d

# Check health and status
docker compose ps
docker compose logs -f backend
```

- **Frontend Access**: `http://localhost:8080`
- **Backend API Access**: `http://localhost:8000/api/health`
- **API Documentation**: `http://localhost:8000/docs`

---

## 4. Deployment Option B — Cloud Staging (Render Blueprint)

The repository includes [`render.yaml`](file:///c:/Users/Admin/Desktop/Krish/Projects/MediShelf_AI/render.yaml) for 1-click infrastructure deployment:

1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Blueprint** and select `render.yaml`.
3. Render creates:
   - `medishelf-api`: Docker web service with pre-downloaded EasyOCR and master catalogue.
   - `medishelf-web`: Node.js web service running the Nitro production build with `VITE_API_BASE_URL` automatically wired to `medishelf-api`.
4. Update `CORS_ORIGINS` on the backend service to match your allocated frontend domain.

---

## 5. Deployment Option C — Split Cloudflare & Container

If deploying the frontend to **Cloudflare Pages / Workers**:

1. Build the frontend for Cloudflare:
   ```bash
   npm run build
   ```
2. Deploy `.output/public` to Cloudflare Pages.
3. In the Cloudflare Pages dashboard, set:
   ```text
   VITE_API_BASE_URL = https://your-backend-api.railway.app
   ```
4. Deploy the backend Dockerfile to Railway, Fly.io, or Render.
5. In the backend environment, set:
   ```text
   CORS_ORIGINS = https://your-frontend.pages.dev
   ```

---

## 6. Pre-Flight Verification & Health Auditing

Run the following checks against any deployed staging target:

### 1. Health & Database Connectivity
```bash
curl -f https://your-api-domain.com/api/health
```
Expected output:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "database": "connected",
  "environment": "staging"
}
```

### 2. Large Catalogue Pagination & Search
```bash
# Verify 27,326 catalogue retrieval
curl -s "https://your-api-domain.com/api/medicines?page=1&page_size=5" | jq '.total'
# Expected: 27326

# Verify search resolution
curl -s "https://your-api-domain.com/api/medicines/search?q=amoxicillin&limit=3" | jq '.[0].medicine_name'
```

### 3. Model Insights Artifact Verification
```bash
curl -s "https://your-api-domain.com/api/models" | jq '.vision.available, .storage_risk.available'
# Expected: true, true
```

### 4. Upload Size Protection Check
```bash
# Submit an empty file (Must return HTTP 400)
curl -X POST "https://your-api-domain.com/api/scan" -F "file=@/dev/null"
```

---

## 7. Storage Persistence & Knowledge Base Integrity

- **Master Knowledge Base** (`data/medicines/medicine_knowledge.db`):
  - Read-only, indexed SQLite file containing 27,326 authentic RxNorm/DailyMed concepts.
  - Bundled directly into the backend image.
- **Application Transactional DB** (`medishelf.db`):
  - Created automatically and seeded with 25 curated monographs on initial startup.
  - In Docker, mounted under `backend-data` volume so user monograph changes persist across restarts.
  - In cloud staging, can be pointed to managed PostgreSQL via `DATABASE_URL`.
