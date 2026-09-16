# 🌊 ATLANTIS — 3D India EEZ Ocean Visualization Platform
> **SIH26067 — Ministry of Earth Sciences (MoES) / INCOIS**  
> *Next-Generation 4D Geospatial Digital Twin & In-Situ Ocean Intelligence Environment*

---

## 📌 Executive Summary (For Presentation Slides)

**ATLANTIS** is a production-grade, interactive 3D/4D ocean visualization platform designed to democratize oceanographic data across **India’s Exclusive Economic Zone (EEZ)** (68°E–90°E, 6°N–25°N). 

By unifying **INCOIS/Copernicus numerical ocean model simulations** (3D physics across the water column) with **real-time in-situ observational networks** (autonomous Argo profiling floats and deep-sea gliders) into a single 60 FPS GPU-accelerated CesiumJS digital twin, ATLANTIS transforms complex multi-gigabyte scientific NetCDF datasets into intuitive, actionable insights for researchers, policymakers, coastal defense, and the public.

---

## 🎯 Problem Statement & Mandate

- **Challenge Code**: SIH26067
- **Nodal Agency**: Ministry of Earth Sciences (MoES) / Indian National Centre for Ocean Information Services (INCOIS)
- **Objective**: Build an interactive web platform rendering numerical ocean models (temperature, salinity, currents) seamlessly combined with in-situ observational platforms (Argo floats, gliders) in a 3D water column to enable intuitive exploration for specialists and non-specialists alike.
- **Geospatial Scope**: India's Exclusive Economic Zone (Arabian Sea, Bay of Bengal, Andaman & Nicobar Sea) covering **2.37 million km²**.

---

## 🏆 Key Differentiators (Why ATLANTIS Stands Out)

| Feature | Standard Contestant Projects | ATLANTIS Platform (Our Differentiator) |
|---|---|---|
| **Dimensionality** | Flat 2D Leaflet/Mapbox maps | **True 3D Geospatial Digital Twin** (CesiumJS WGS84 ellipsoid) |
| **Water Column** | Only sea surface (SST 2D slices) | **Volumetric 3D Multi-Layer Stacking** (0m to 1,000m depth with 50x–400x vertical exaggeration) |
| **Ocean Currents** | Static scalar heatmaps | **Dynamic Directional Vector Field** ($u_o, v_o$ velocity arrows oriented with flow & scaled by knots) |
| **In-Situ Integration** | Static marker pins or mocked data | **Live Argo Floats & Ocean Gliders** with interactive depth-resolved CTD profile drawers (Recharts) |
| **EEZ Demarcation** | Arbitrary bounding boxes | **Official VLIZ MarineRegions v12** geopolitical maritime EEZ vector boundary |
| **UI / UX Experience** | Cluttered GIS interfaces | **Cinema-Mode Dual Collapsible Slidebars**, 3D Camera Deck presets (Oblique, Side Profile, Top-Down), glassmorphism |
| **Data Architecture** | Heavy NetCDF files crashed browsers | **Optimized Tile-Slicing Pipeline** (9 depth levels, compressed JSON tiles, sub-second latency) |

---

## 🏛️ System Architecture

```
                                    DATA SOURCES
  ┌───────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────────┐
  │  Copernicus Marine /      │  │      Argo GDAC /          │  │     OceanGliders GDAC /  │
  │  INCOIS Numerical Model   │  │        argopy             │  │       Ifremer ERDDAP     │
  └─────────────┬─────────────┘  └─────────────┬─────────────┘  └────────────┬─────────────┘
                │ NetCDF4                      │ JSON Profiles               │ ERDDAP tabledap
                ▼                              ▼                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                           AUTOMATED DATA INGESTION PIPELINE                            │
  │  • fetch_copernicus.py  → 3D Hydrodynamic fields (thetao, so, uo, vo)                 │
  │  • fetch_argo.py        → Real-time float positions & CTD profiles                     │
  │  • fetch_glider.py      → Subsampled yo-yo trajectory waypoints (Bellatrix_368)         │
  │  • build_tiles.py       → Slices NetCDF into optimized depth-level JSON tiles          │
  └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ Generated manifest.json & compressed tiles
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                               FASTAPI BACKEND SERVICE                                  │
  │  • GET /manifest            → Dynamic variables, standard depths, bounds, units        │
  │  • GET /tiles/{var}/{depth} → Compact raster slice grid for GPU texture mapping        │
  │  • GET /api/argo/positions  → Real-time active float locations in EEZ                  │
  │  • GET /api/argo/profile    → Depth-resolved CTD data (Temp/Salinity vs Depth)         │
  │  • GET /api/glider/tracks   → 3D autonomous glider trajectories                        │
  └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ High-speed REST APIs
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │                         NEXT.JS 15 + CESIUMJS CLIENT ENGINE                            │
  │  • WebGL 3D Globe           → Hardware-accelerated CesiumJS with custom shaders        │
  │  • Volumetric Renderer      → Multi-layer depth stack with vertical exaggeration       │
  │  • Vector Particle Engine   → Directional velocity arrows for ocean currents           │
  │  • In-Situ Inspection       → Interactive Argo & Glider CTD Profile Drawers            │
  │  • Cinema UI Experience     → Dual-side smooth slidebars (Hide / View globe)           │
  │  • Camera Deck              → 3D Oblique, Side Profile, South Front, Top-Down presets  │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Oceanographic Data Sources

### 1. Numerical Ocean Model Data (3D Hydrodynamics)
- **Source**: Copernicus Marine Service / INCOIS Model Outputs (`GLOBAL_ANALYSISFORECAST_PHY_001_024`)
- **Spatial Resolution**: 0.083° regular grid ($\sim 9\text{ km}$) across **68°E–90°E, 6°N–25°N**
- **Temporal Resolution**: Daily assimilation cycles
- **Target Parameters**:
  - **Sea Water Potential Temperature (`thetao`)**: Unit: `°C` (Surface to Abyssal)
  - **Sea Water Salinity (`so`)**: Unit: `PSU` (Practical Salinity Units)
  - **Eastward Sea Water Velocity (`uo`)**: Unit: `m/s` (Zonal current)
  - **Northward Sea Water Velocity (`vo`)**: Unit: `m/s` (Meridional current)
  - **Current Velocity Magnitude (`cur_speed`)**: Derived: $\sqrt{u_o^2 + v_o^2}$
- **Depth Levels (9 Standard Vertical Slices)**:
  - Surface ($0.5\text{ m}$), Epipelagic ($5\text{ m}, 10\text{ m}, 20\text{ m}, 50\text{ m}$), Mesopelagic ($100\text{ m}, 200\text{ m}, 500\text{ m}$), Bathypelagic ($1,000\text{ m}$)

### 2. In-Situ Argo Profiling Floats
- **Source**: Argo Global Data Assembly Center (GDAC) via `argopy`
- **Active Platforms**: 25+ real-time floats deployed across the Arabian Sea & Bay of Bengal
- **Data Extracted**: Float WMO ID, surface coordinates, cycle number, and high-resolution vertical CTD profiles ($T(z)$ and $S(z)$ down to $2,000\text{ m}$).

### 3. In-Situ Autonomous Ocean Gliders
- **Source**: OceanGliders GDAC hosted by **Ifremer** (France)
- **Protocol**: Ifremer ERDDAP Server (`OceanGlidersGDACTrajectories` dataset)
- **Active Deployment**: Mission **`Bellatrix_368`** in the Bay of Bengal / Andaman corridor
- **Data Extracted**: 3D yo-yo diving waypoints, GPS navigation, pressure/depth, in-situ temperature, and salinity.

### 4. Geopolitical Maritime Boundary
- **Source**: Flanders Marine Institute (**VLIZ MarineRegions v12**)
- **Data**: Accurate High-Precision GeoJSON polygon for India's Exclusive Economic Zone.

---

## ⚡ Key Modules & Feature Highlights

### 1. Volumetric 3D Water Column Mode
- Allows users to switch from a standard 2D depth slice to **3D Volumetric Mode**.
- Renders **4 simultaneous depth planes** (Surface $0.5\text{ m}$, Mixed Layer $50\text{ m}$, Thermocline $200\text{ m}$, Abyssal $1,000\text{ m}$) suspended in 3D space.
- Includes a **Vertical Exaggeration Slider** ($50\times$ to $400\times$) so ocean depth can be visually explored despite the earth's massive horizontal-to-vertical aspect ratio.
- Features **Layer Isolator Toggles** and an **Opacity Controller** to inspect sub-surface thermal inversions.

### 2. Directional Vector Currents Field
- Renders ocean current velocity arrows computed dynamically from $u_o$ and $v_o$ vector components.
- Arrows rotate to represent true current heading ($0^\circ–360^\circ$) and scale/color by velocity magnitude ($0\text{ to } 1.5+\text{ m/s}$).

### 3. In-Situ Platform Drawers (CTD Profiling)
- Clicking any **Argo Float** or **Glider** opens a slide-out glassmorphic drawer.
- Renders depth-resolved physical profiles using **Recharts**:
  - Temperature vs Depth curve ($^\circ\text{C}$ vs $\text{m}$)
  - Salinity vs Depth curve ($\text{PSU}$ vs $\text{m}$)
  - Metadata: WMO ID, latest telemetry timestamp, coordinates, maximum dive depth.

### 4. Interactive Oceanographic Colorbar
- 6 curated palettes: **Thermal (SST)**, **Turbo**, **Haline (Salinity)**, **Cool-Warm**, **Viridis**, **Plasma**.
- **Auto-Clamp to Slice**: Instantly adapts color gradient to active slice min/max to reveal fine-scale eddies.
- Supports both **linear** and **logarithmic** color scales.

### 5. Dual Cinema Slidebars & 3D Camera Deck
- **Left Slide Tab**: Hides/restores Ocean Controls with a smooth 300ms GPU-accelerated transition.
- **Right Slide Tab**: Hides/restores Colorbars and Camera HUD for an unobstructed cinema globe view.
- **Camera Presets**: 3D Oblique angle, Side Profile, South Front, and Top-Down nadir view.

---

## 🛠️ Technology Stack

| Tier | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | **Next.js 15 (App Router)** | Modern React 19 architecture, SSR & client optimization |
| **3D Geospatial Engine** | **CesiumJS 1.127 + Resium** | Hardware-accelerated 3D WGS84 virtual globe |
| **Styling & Design** | **Tailwind CSS v4 + Vanilla CSS** | Custom glassmorphism (`backdrop-filter`), ocean neon themes |
| **Data Charting** | **Recharts** | Interactive SVG CTD depth profiles |
| **State & Data Cache** | **TanStack React Query v5** | Stale-while-revalidate client caching |
| **Backend Framework** | **Python FastAPI** | High-performance asynchronous REST API service |
| **Scientific Data Libs** | **xarray, netCDF4, numpy, pandas** | Multidimensional ocean dataset slicing and subsetting |
| **Ocean Ingestion APIs** | **copernicusmarine, argopy, requests** | Real-time fetching from Copernicus, Argo GDAC, Ifremer |
| **Deployment & Containers** | **Docker, Render, Hugging Face Spaces** | Cloud-native multi-stage containerized deployment |

---

## 📂 Project Structure

```
ATLANTIS/
├── backend/
│   ├── main.py                     # FastAPI REST server & CORS
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile                  # Container definition
├── data-pipeline/
│   ├── scripts/
│   │   ├── fetch_copernicus.py     # Copernicus ocean model ingestion
│   │   ├── fetch_argo.py           # Argo float profile ingestion
│   │   ├── fetch_glider.py         # Ifremer glider track ingestion
│   │   └── build_tiles.py          # NetCDF to JSON tile slicer
│   ├── raw/                        # Downloaded raw NetCDF models
│   └── processed/
│       ├── manifest.json           # Variable & depth metadata catalog
│       ├── argo_positions.json     # Active Argo coordinates in EEZ
│       ├── argo_profiles.json      # Depth-resolved CTD curves
│       ├── glider_tracks.json      # Glider trajectories & profiles
│       ├── india_eez.geojson       # VLIZ MarineRegions EEZ border
│       └── tiles/                  # Sliced raster grid files
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Main application layout & slidebars
│   │   │   └── globals.css         # Glassmorphism & Cesium styles
│   │   ├── components/
│   │   │   ├── Globe.tsx           # CesiumJS 3D engine & vector renderer
│   │   │   ├── GlobeWrapper.tsx    # Dynamic client chunk loader
│   │   │   ├── Sidebar.tsx         # Ocean variable & mode selector
│   │   │   ├── Colorbar.tsx        # Palette & scale editor
│   │   │   ├── ArgoProfileDrawer.tsx # Recharts Argo CTD drawer
│   │   │   ├── GliderProfileDrawer.tsx # Glider track & stats drawer
│   │   │   └── Navbar.tsx          # Branding & live status indicator
│   │   └── lib/api.ts              # Typed API client
│   └── package.json
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Clone & Setup Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 2. Setup & Run Frontend
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:3000`

### 3. Running Data Pipeline (If Regenerating Data)
```bash
python data-pipeline/scripts/fetch_copernicus.py
python data-pipeline/scripts/fetch_argo.py
python data-pipeline/scripts/fetch_glider.py
python data-pipeline/scripts/build_tiles.py
```

---

## 📑 Slide-by-Slide Presentation Guide

Use this outline directly to structure your **Hackathon Presentation Pitch Deck (8–10 Slides)**:

- **Slide 1: Title & Vision**: ATLANTIS — 3D Ocean Intelligence Environment for India's EEZ (MoES / INCOIS Problem Statement SIH26067).
- **Slide 2: The Problem**: 2.37M km² of maritime territory, complex multi-dimensional NetCDF data locked in specialized tools, lack of unified model + in-situ visualization.
- **Slide 3: Our Solution (ATLANTIS)**: A browser-based 4D Digital Twin combining Copernicus/INCOIS numerical models with live Argo floats and deep-sea gliders.
- **Slide 4: System Architecture**: Data Pipeline $\rightarrow$ NetCDF Slicing $\rightarrow$ FastAPI $\rightarrow$ Next.js + CesiumJS WebGL Engine.
- **Slide 5: Key Differentiator #1 — Volumetric 3D Water Column**: 4-layer stacked visualization from surface to 1,000m with 50x–400x vertical exaggeration.
- **Slide 6: Key Differentiator #2 — Vector Current Field**: Dynamic directional velocity vectors ($u_o, v_o$) illustrating physical transport in real time.
- **Slide 7: Key Differentiator #3 — Real In-Situ Platforms**: Argo GDAC floats + Ifremer `Bellatrix_368` Glider with depth-resolved CTD profile graphs.
- **Slide 8: UI/UX & Operator Tools**: Cinema-mode dual slidebars, 3D Camera Deck presets, dynamic colormap adaptation, and VLIZ v12 EEZ boundary.
- **Slide 9: Impact & Use Cases**: Fisheries management, cyclone thermal potential tracking, maritime navigation, naval operations, and marine education.
- **Slide 10: Live Demo / Q&A**: Hands-on walkthrough on `localhost:3000`.
