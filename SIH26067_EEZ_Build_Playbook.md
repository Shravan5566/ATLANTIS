# SIH26067 – India EEZ Ocean Visualization Prototype
### Build playbook: stack, data, and copy-paste prompts for AI Studio (frontend) + Antigravity (backend)

Scope for this phase: **India's Exclusive Economic Zone (EEZ) only**, real live data, working demo for the college-level round. Full national-scope build comes after, in the 3-month window.

---

## 0. Why this stack (and why it should beat 500 teams doing the same thing)

Almost every team will read "WebGL/Three.js or Cesium.js" in the SIH doc and reach for raw Three.js because it's the more "known" name. That's a trap for a 2-3 person, AI-assisted team: raw Three.js means hand-building camera controls, a globe, terrain, coordinate projection, and picking — all from scratch.

**Recommended stack:**

| Layer | Choice | Why |
|---|---|---|
| 3D/geo frontend | **CesiumJS** (via `resium` if you want React bindings, or vanilla Cesium) | Globe, terrain, imagery basemaps, and lat/lon/depth camera work out of the box. This is *the* library built for exactly "geospatial data at depth/altitude," which is your whole problem statement. Far less code to vibe-code correctly than raw Three.js. |
| App framework | **Next.js (React)** | AI Studio and most LLMs have deep training on Next.js; huge ecosystem; easy Vercel deploy. |
| Charts (depth profiles) | **Recharts** or **Chart.js** | Simple, well-documented, good for the click-a-float → profile chart requirement. |
| Backend API | **Python + FastAPI** | Async, auto-generates OpenAPI docs (nice for judges: "we follow OGC/REST standards"), and Python is required anyway for the data science side. |
| Ocean model data access | **`copernicusmarine`** (official Copernicus Marine Toolbox) | Official Python client for `GLOBAL_MULTIYEAR_PHY_001_030` — handles auth, subsetting by bounding box/depth/time server-side, and returns NetCDF directly. Avoids hand-rolling OPeNDAP requests. |
| Argo data | **`argopy`** | Purpose-built Python library that wraps the Ifremer GDAC (the FTP you were given) and Argovis/Euro-Argo APIs. Fetching "all Argo floats in India's EEZ bounding box, last 90 days" is ~5 lines instead of parsing raw FTP NetCDF trees. |
| Glider data | Ifremer Glider ERDDAP (`https://www.ifremer.fr/erddap`) or direct FTP (`ftp://ftp.ifremer.fr/ifremer/glider/v2/`) parsed with `xarray` | ERDDAP lets you query by bounding box directly; fall back to FTP + xarray if a given glider isn't in ERDDAP. |
| NetCDF parsing | **`xarray` + `netCDF4`/`h5netcdf`** | Standard, and the SIH doc explicitly names xarray. |
| Data serving format | Pre-processed **JSON/compressed binary tiles** per (variable, depth, timestep), NOT raw NetCDF to the browser | Browsers can't read NetCDF; you convert once on the backend and cache. |
| Deployment | Frontend → **Vercel**; Backend → **Render or Fly.io** (needs a real Python process, not serverless, because NetCDF processing is heavier) | Free tiers work for a demo. |

This combination lets a near-beginner team lean on the AI tools heavily, because every one of these libraries has huge amounts of public documentation and example code for an LLM to draw on — which matters a lot for "vibe coding."

---

## 1. Repo & environment setup

Run this in **Antigravity** first (it's a backend/infra task).

```
Prompt for Antigravity:

Set up a monorepo for a hackathon project called "sih26067-eez-ocean".
Structure:
- /backend  → Python FastAPI project
- /frontend → Next.js (TypeScript) project
- /data-pipeline → Python scripts for fetching and preprocessing ocean data
- /docs → markdown docs

For /backend:
- Use Python 3.11, FastAPI, uvicorn
- Add a virtual environment setup and requirements.txt with: fastapi, uvicorn[standard], xarray, netCDF4, h5netcdf, copernicusmarine, argopy, numpy, pandas, orjson, python-dotenv
- Add a basic FastAPI app with a /health endpoint and CORS enabled for the frontend origin
- Add a .env.example with placeholders for COPERNICUS_USERNAME and COPERNICUS_PASSWORD

For /data-pipeline:
- Same virtual environment as backend (or share requirements.txt)
- Add an empty scripts folder: fetch_copernicus.py, fetch_argo.py, fetch_glider.py, build_tiles.py

For /frontend:
- Initialize with `create-next-app` (TypeScript, App Router, Tailwind CSS)
- Add resium and cesium as dependencies
- Add recharts

Create a root README explaining the structure and how to run backend + frontend locally.
Initialize git and make the first commit.
```

---

## 2. Data pipeline

Define India's EEZ bounding box up front (rough box, good enough for a prototype — refine later with an actual EEZ polygon from marineregions.org if you want precision):

- Latitude: **6°N to 25°N**
- Longitude: **68°E to 90°E**
- (This covers the Arabian Sea + Bay of Bengal EEZ zones; you can tighten it with the actual EEZ polygon later using `geopandas` + the Flanders Marine Institute EEZ shapefile.)

### 2a. Copernicus Marine — ocean model fields

```
Prompt for Antigravity (in /data-pipeline/fetch_copernicus.py):

Write a Python script using the `copernicusmarine` package that:
1. Logs in using COPERNICUS_USERNAME and COPERNICUS_PASSWORD from environment variables (load via python-dotenv)
2. Subsets the dataset "GLOBAL_MULTIYEAR_PHY_001_030" (or the equivalent near-real-time analysis-forecast product if the multiyear one has too much lag — check both and use whichever has recent data) for:
   - Bounding box: longitude 68 to 90, latitude 6 to 25
   - Depth range: 0 to 1000 meters (or all available levels, subsampled to ~15-20 depth levels)
   - Time range: last 10 days
   - Variables: thetao (temperature), so (salinity), uo and vo (current vector components)
3. Saves the result as a NetCDF file to /data-pipeline/raw/copernicus_eez.nc
4. Prints a summary of the resulting xarray Dataset (dims, variables, time range) when done
5. Handle errors gracefully (auth failure, no data for date range) with clear error messages

Also write a short README.md note explaining how to get free Copernicus Marine credentials at https://data.marine.copernicus.eu (registration required) and how to set them in .env
```

### 2b. Argo floats in the EEZ

```
Prompt for Antigravity (in /data-pipeline/fetch_argo.py):

Write a Python script using the `argopy` library that:
1. Fetches all Argo float profiles within the bounding box longitude 68-90, latitude 6-25, for the last 90 days
2. Extracts, per profile: float ID (WMO number), latitude, longitude, timestamp, and depth-resolved temperature, salinity (and BGC variables like chlorophyll/oxygen if available for any floats — argopy's "bgc" data mode)
3. Converts the result to a clean pandas DataFrame with one row per (float_id, timestamp, depth) measurement
4. Also builds a second, smaller DataFrame with one row per float showing just its latest known position (for map markers)
5. Saves both as JSON files: /data-pipeline/processed/argo_profiles.json and /data-pipeline/processed/argo_latest_positions.json
6. Prints how many floats and how many total profile points were found

Handle the case where argopy's default data source (erddap) is slow or unavailable by allowing a fallback data source via a config variable.
```

### 2c. Glider data

```
Prompt for Antigravity (in /data-pipeline/fetch_glider.py):

Write a Python script that fetches glider data for the India EEZ region (longitude 68-90, latitude 6-25) from Ifremer.

Try this approach first:
1. Use Ifremer's Glider ERDDAP server (https://www.ifremer.fr/erddap) — search its datasets for any active/recent gliders whose track intersects the bounding box, using ERDDAP's search or table query API with lat/lon/time constraints, via simple HTTP requests (requests library) or the erddapy Python package.
2. For any matching datasets, download temperature/salinity/depth/time/lat/lon as CSV or NetCDF via ERDDAP's query URL, then load with xarray or pandas.

If no gliders are currently active in the EEZ box (this is realistic — glider coverage is sparse), fall back to:
3. Fetching ONE representative glider dataset from anywhere in the Ifremer glider FTP (ftp://ftp.ifremer.fr/ifremer/glider/v2/) as a demonstration of the data pipeline working end-to-end, and clearly label it in the output JSON as "demo_glider_outside_eez": true so the frontend can show it differently (e.g. a note: "shown for demonstration — no active gliders in EEZ at this time").

Output format: /data-pipeline/processed/glider_tracks.json — array of {glider_id, points: [{lat, lon, time, depth, temperature, salinity}], demo_glider_outside_eez}

Add comments explaining both code paths clearly, since this is a judged demo and you want to be able to explain honestly what's real vs. fallback.
```

### 2d. Build serving tiles

```
Prompt for Antigravity (in /data-pipeline/build_tiles.py):

Write a Python script that reads /data-pipeline/raw/copernicus_eez.nc (an xarray Dataset with dims time, depth, latitude, longitude and variables thetao, so, uo, vo) and converts it into browser-friendly output:

1. For each (variable, timestep, depth-level) combination, produce a compact JSON file:
   /data-pipeline/processed/tiles/{variable}/{time_index}/{depth_index}.json
   containing: {lat_grid: [...], lon_grid: [...], values: [[...]]} (2D array, NaN as null)
2. Also produce a single /data-pipeline/processed/tiles/manifest.json listing:
   - available variables and their display names/units
   - available depth levels (in meters)
   - available timesteps (as ISO date strings)
   - the lat/lon bounding box
   - min/max value range per variable (for default colorbar scaling)
3. Round numeric values to 3 decimal places and gzip the JSON files to keep them small
4. Print total output size and file count when done

Keep this script idempotent — safe to re-run after a fresh Copernicus fetch.
```

Run these four scripts once, check the outputs look sane, and you have your entire real-data foundation.

---

## 3. Backend API (FastAPI)

```
Prompt for Antigravity (in /backend):

Build FastAPI endpoints that serve the preprocessed data from /data-pipeline/processed/. Add:

1. GET /api/manifest → returns the contents of tiles/manifest.json (variables, depths, timesteps, bounding box, value ranges)

2. GET /api/field?variable={var}&time={time_index}&depth={depth_index}
   → returns the corresponding tile JSON (lat_grid, lon_grid, values) for that variable/time/depth

3. GET /api/argo/positions → returns argo_latest_positions.json (for map markers)

4. GET /api/argo/profile/{float_id} → returns the full depth-resolved profile history for one float, filtered from argo_profiles.json

5. GET /api/glider/tracks → returns glider_tracks.json

6. GET /api/health → simple health check

Serve everything as gzip-compressed JSON responses. Add CORS for the frontend's origin (read from an env var, default http://localhost:3000). Add basic in-memory caching (functools.lru_cache or similar) so repeated requests for the same tile don't re-read from disk every time.

Auto-generate OpenAPI docs at /docs (FastAPI does this by default — just make sure endpoint descriptions and response models are clear, using Pydantic models). This matters for the demo: judges can see you built a documented, standards-friendly API.
```

---

## 4. Frontend skeleton (build this in AI Studio)

```
Prompt for AI Studio:

Build a Next.js (TypeScript, App Router, Tailwind CSS) app called "EEZ Ocean Explorer" with the following layout:

- Full-screen 3D globe using CesiumJS (via the `resium` React wrapper), centered and constrained to India's EEZ bounding box (longitude 68-90, latitude 6-25), initial camera looking down at the region.
- A left sidebar panel (collapsible on mobile) with:
  - Variable selector (dropdown: Temperature, Salinity, Current Speed) — fetched from GET /api/manifest
  - Depth slider (values from manifest's depth levels, shown in meters)
  - Time slider with a play/pause animation button (steps through manifest's timesteps)
- A top-right colorbar/legend component that updates its gradient and min/max labels based on the selected variable and manifest's value range
- A bottom info bar showing the currently hovered lat/lon/depth/value on the globe

Set up an API client module (lib/api.ts) with typed fetch functions matching the backend endpoints (getManifest, getField, getArgoPositions, getArgoProfile, getGliderTracks). Read the backend base URL from an environment variable NEXT_PUBLIC_API_URL.

Use React Query (@tanstack/react-query) for data fetching and caching.

Keep components modular: Globe.tsx, Sidebar.tsx, Colorbar.tsx, InfoBar.tsx, VariableSelector.tsx, DepthSlider.tsx, TimeSlider.tsx.

For now, render a placeholder colored rectangle over the region on the globe — we'll wire in real field rendering next.
```

---

## 5. Feature-by-feature prompts (build in this order)

**5a. Render real field data on the globe**
```
Prompt for AI Studio:

In Globe.tsx, replace the placeholder rectangle with real rendering of ocean field data:
- When the user selects a variable/depth/time, fetch GET /api/field with those params
- Render the returned lat_grid/lon_grid/values as a Cesium ImageryLayer or a custom textured rectangle: convert the 2D values array into a canvas, color each cell using the variable's colorbar scale (min/max from manifest), and use that canvas as a Cesium SingleTileImageryProvider positioned over the bounding box
- Handle NaN/null values as transparent
- Add a loading spinner while the field is fetching, and smoothly cross-fade between old and new field textures when the user changes time/depth (for the animation feature)
```

**5b. Depth-slice "volumetric" feel**
```
Prompt for AI Studio:

Extend the globe to show a pseudo-3D volumetric effect: when the user is not viewing a single fixed depth but instead an "explore" mode, render 3-4 semi-transparent depth-slice layers stacked at different Cesium heights (using negative altitude scaled for visual effect, e.g. depth 0m → altitude 0, depth 500m → altitude -50000 exaggerated so it's visible), each showing the field at that depth with reduced opacity. Add a "vertical exaggeration" slider (as mentioned in the SIH problem doc) that scales this altitude offset. This gives a genuine sense of looking into the water column, which most competing teams (using flat 2D overlays) probably won't have.
```

**5c. Argo float markers + profile chart**
```
Prompt for AI Studio:

Add Argo float markers to the globe using GET /api/argo/positions (Cesium PointGraphics or billboard icons). On click, open a side panel showing:
- Float ID, last position, last update time
- A depth-vs-temperature and depth-vs-salinity chart (Recharts, depth on Y axis inverted so 0 is at top) built from GET /api/argo/profile/{float_id}
- A small dropdown to pick which of the float's recent profiles (timestamps) to show

Add glider tracks from GET /api/glider/tracks as polylines on the globe, with a distinct color, and if a track has demo_glider_outside_eez=true, show a small badge/tooltip noting "demo data — shown outside EEZ".
```

**5d. Colorbar editor**
```
Prompt for AI Studio:

Make the Colorbar component interactive: allow the user to choose a color palette (e.g. viridis, thermal, cool-warm — use a small hardcoded set of color stop arrays, no extra dependency needed), toggle between linear and log scale, and manually override the min/max range (defaulting to the manifest's suggested range). Changing these should immediately re-render the currently displayed field with the new coloring, without refetching data from the backend.
```

---

## 6. Differentiators (since 500 teams have the identical brief)

Everyone will build "a globe with sliders." To stand out, pick 2-3 of these to add in the 3-month phase (don't try all now):

- **AI insight panel**: a small LLM-generated plain-language summary of the current view ("Temperatures near the surface off the Kerala coast are ~2°C above the 10-day average, consistent with...") — genuinely matches the SIH doc's "science communication" ask and almost no one will build it.
- **Isosurface extraction**: actual 3D isosurfaces (e.g. thermocline boundary) using marching-cubes on the field data, rendered as a real 3D mesh rather than stacked flat slices — a stronger fulfillment of "isosurface extraction" than most teams will attempt.
- **OGC WMS/WCS compliance**: exposing your backend as an actual WMS endpoint (using a library like `owslib`-compatible responses) is literally called out in the SIH doc and is easy to claim, hard for most vibe-coded projects to actually deliver.
- **Offline/PWA mode** for use on research vessels with poor connectivity — ties directly to the "operational" framing in the problem statement.

---

## 7. Deployment

```
Prompt for Antigravity:

Prepare the backend for deployment on Render (or Fly.io):
- Add a Dockerfile for /backend that installs requirements.txt and runs uvicorn
- Add render.yaml (or fly.toml) config
- Make sure the processed data files in /data-pipeline/processed are either bundled into the image or fetched/generated at container start
- Add environment variable handling for CORS origin and any secrets

For the frontend, prepare for Vercel deployment: confirm NEXT_PUBLIC_API_URL is read correctly at build time and add a vercel.json if needed for any rewrites.

Write a DEPLOY.md with exact steps for both.
```

---

## 8. For the demo itself

- Lead with the globe already loaded and animating — visuals sell in the first 10 seconds.
- Click an Argo float live, on stage, to show it's real data, not a screenshot.
- Explicitly say the words "Copernicus Marine, Ifremer Argo GDAC, real NetCDF pipeline" — judges are specifically checking whether teams used real INCOIS-relevant data sources or faked it.
- Have the OpenAPI docs page (`/docs`) ready to flash as evidence of a real, documented backend.

---

Next practical step: run the Antigravity prompt in Section 1 first, then Section 2's four data scripts in order (a→d) — you need real data on disk before the frontend has anything to show.
