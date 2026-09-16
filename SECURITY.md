# SECURITY.md — ATLANTIS Ocean Visualization Platform

> Last updated: September 2026 | Audit performed at pre-production deployment gate

---

## Overview

This document summarises the security posture of the ATLANTIS monorepo (ackend/, rontend/, data-pipeline/), findings from the pre-production security audit, and the controls that are currently in place.

---

## Deployment Architecture

ATLANTIS is deployed as a **single-process unified server** on Render.com:
- FastAPI (Python) serves both the REST API under /api/* and the pre-built Next.js static export under /.
- No database is used. All ocean model data lives on disk as pre-processed JSON/GZ tile files.
- All endpoints are read-only (GET). There are no authenticated routes, no POST/PUT/DELETE endpoints.

---

## Security Controls

### Secrets & Credentials

| Control | Status | Details |
|---|---|---|
| Copernicus credentials in git history | ✅ CLEAN | git log -S "COPERNICUS_PASSWORD" — zero hits |
| .env files in .gitignore | ✅ | ackend/.env and rontend/.env.local both listed |
| NEXT_PUBLIC_ vars — safe for browser | ✅ | Only NEXT_PUBLIC_CESIUM_ION_TOKEN is exposed; it is a client-side read-only key by Cesium Ion design |
| CI secret scanner | ✅ | GitHub Actions + gitleaks scans every push and PR (.github/workflows/secret-scan.yml) |
| CORS_ORIGINS in deployment config | ✅ FIXED | Removed "*" from ender.yaml; value must be set as a Render secret in the dashboard |

**Action required (manual):** Set CORS_ORIGINS to your production domain in the Render dashboard under *Environment → Secret Files*. Example value:
`
https://atlantis-ocean-platform.onrender.com
`

**Action required (manual):** Log in to [ion.cesium.com](https://ion.cesium.com), open your token, and restrict it to your production domain.

---

### Backend API Hardening

| Control | Status | Details |
|---|---|---|
| Rate limiting | ✅ ADDED | slowapi: /api/field → 30/min; all others → 60/min; manifest → 120/min |
| Path traversal guard on ariable | ✅ ADDED | Regex ^[a-z_]{1,32}$ applied before manifest check |
| Bounds check on 	ime/depth indices | ✅ ADDED | Compared against len(manifest.timesteps) and len(manifest.depth_levels) |
| Absolute path containment check | ✅ ADDED | gz_path.resolve().relative_to(TILES_DIR) asserts tile is inside TILES_DIR |
| loat_id validation | ✅ ADDED | Regex ^[a-zA-Z0-9]{1,12}$ — rejects path traversal strings |
| Global exception handler | ✅ ADDED | Logs full traceback server-side; returns {"error": "Internal server error"} to client |
| CORS wildcard guard | ✅ ADDED | If CORS_ORIGINS=* detected in production, overrides to safe default and logs CRITICAL |
| CORS methods restricted | ✅ FIXED | Changed from "*" to ["GET"] only |
| /docs in production | ✅ | Hidden (docs_url=None) when ENVIRONMENT=production |
| Structured logging | ✅ ADDED | Python logging module with timestamps and severity; captures to Render log stream |

---

### Frontend Hardening

| Control | Status | Details |
|---|---|---|
| Security response headers | ✅ ADDED | Injected by FastAPI middleware on every response (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection) |
| CSP for CesiumJS | ✅ | Allows lob: and 'unsafe-eval' required by Cesium WebGL workers; blocks all other untrusted sources |
| dangerouslySetInnerHTML in layout.tsx | ✅ SAFE | Injects static literal window.CESIUM_BASE_URL = "/cesium" — no user input involved; documented pattern from Cesium docs |
| Hardcoded localhost:8000 link | ✅ FIXED | Navbar API Docs link changed to relative /docs |
| 
pm audit result | ✅ CLEAN | ound 0 vulnerabilities (September 2026) |
| VLIZ/MarineRegions attribution | ✅ ADDED | Visible attribution in Navbar per Flanders Marine Institute license |

---

### Data Pipeline Safety

| Control | Status | Details |
|---|---|---|
| Physical range validation (uild_tiles.py) | ✅ ADDED | Masks values outside physical bounds to NaN before tile serialisation |
| Physical range filters (etch_argo.py) | ✅ ADDED | Drops rows with temperature outside [-5, 40]°C, salinity outside [0, 45] PSU, depth < 0 or > 12000 m |
| Credential masking in pipeline output | ✅ ADDED | erify_credentials() now masks username in log output; never prints password |
| Credentials sourced from env only | ✅ | os.getenv() used exclusively; .env never committed |

---

### Deployment & Infrastructure

| Control | Status | Details |
|---|---|---|
| Non-root Docker user | ✅ | Dockerfile creates and uses ppuser (UID 1000) |
| .env not copied into Docker image | ✅ | Confirmed: Dockerfile does not COPY any .env files |
| HTTPS enforcement | ✅ | Render.com enforces HTTPS with automatic TLS provisioning |
| ENVIRONMENT=production in ender.yaml | ✅ ADDED | Triggers production-mode guards in main.py |

---

## Known Accepted Risks

| Item | Risk Level | Rationale |
|---|---|---|
| /docs and /redoc hidden in production | Low | Disabled when ENVIRONMENT=production |
| Cesium 'unsafe-eval' in CSP | Low | Required by CesiumJS WebGL shader compilation; cannot be removed without breaking the 3D globe |
| Argo float profile 404 leaks float ID list | Informational | Error message includes a sample of valid float IDs for developer usability; not sensitive data |
| No auth on any endpoint | Accepted | Platform is a public scientific visualisation tool; no PII or sensitive data is served |

---

## Dependency Audit Summary

### Frontend (npm)
`
npm audit — September 2026
found 0 vulnerabilities
`

### Backend (pip)
Run pip install pip-audit && pip-audit -r backend/requirements.txt to generate a current report.

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by opening a **private** GitHub Security Advisory rather than a public issue. We aim to respond within 72 hours.

---

## Attribution

EEZ boundaries: © [Marineregions.org / VLIZ](https://www.marineregions.org/) (Flanders Marine Institute)
Ocean data: Copernicus Marine Service (CMEMS) / INCOIS
In-situ Argo data: Argo GDAC / Ifremer
Glider data: ERDDAP / IOOS Glider DAC
