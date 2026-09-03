# SIH26067 — India EEZ Ocean Visualization Platform

Interactive 3D ocean visualization platform rendering INCOIS/Copernicus numerical ocean model outputs (temperature, salinity, currents) together with in-situ observations (Argo floats, gliders) in a single browser environment across India's Exclusive Economic Zone (EEZ: 68°E–90°E, 6°N–25°N).

---

## 📁 Repository Structure

```
.
├── backend/                  # Python FastAPI API service
│   ├── main.py               # API endpoints, CORS, /health
│   ├── requirements.txt      # FastAPI, xarray, copernicusmarine, argopy, etc.
│   └── .env.example          # Sample environment variables
├── data-pipeline/            # Ocean data extraction & preprocessing
│   ├── scripts/
│   │   ├── fetch_copernicus.py   # Copernicus Marine Toolbox client
│   │   ├── fetch_argo.py         # Argo profile retrieval via argopy
│   │   ├── fetch_glider.py       # Glider data pipeline (Ifremer)
│   │   └── build_tiles.py        # NetCDF to JSON tile slicer
│   ├── raw/                  # Raw NetCDF files (gitignored)
│   └── processed/            # Generated JSON tiles and manifests
├── frontend/                 # Next.js (TypeScript, Tailwind CSS, Cesium, Resium)
│   ├── src/                  # App router pages and 3D globe components
│   └── package.json          # Dependencies: cesium, resium, recharts
├── docs/                     # Design specs and documentation
│   └── architecture.md       # Architecture diagram and system flow
└── README.md                 # Project guide (this file)
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**
- (Optional) Copernicus Marine Service free account ([register here](https://data.marine.copernicus.eu))

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Run FastAPI development server
uvicorn main:app --reload --port 8000
```

- Health check: [http://localhost:8000/health](http://localhost:8000/health)
- Interactive OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run Next.js development server
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000) to view the 3D Ocean Explorer in your browser.

---

### 3. Data Pipeline Workflow

Once backend and credentials are set up:

```bash
# 1. Fetch Copernicus model data for India's EEZ
python data-pipeline/scripts/fetch_copernicus.py

# 2. Fetch Argo float profiles in the EEZ bounding box
python data-pipeline/scripts/fetch_argo.py

# 3. Fetch glider tracks
python data-pipeline/scripts/fetch_glider.py

# 4. Generate compressed browser tiles & manifest
python data-pipeline/scripts/build_tiles.py
```

---

## 🌊 Core Features & Deliverables
- **3D Geospatial Globe**: CesiumJS-powered visualization constrained to India's EEZ.
- **Volumetric Depth Slices**: Vertical exaggeration controls to inspect the water column.
- **In-Situ Float Overlay**: Live Argo float markers and depth-resolved temperature/salinity profiles via Recharts.
- **Dynamic Colorbar**: Customizable palettes (Viridis, Thermal, Cool-Warm) and min/max controls.
- **Standards-Compliant API**: Documented REST API with OpenAPI specification.
