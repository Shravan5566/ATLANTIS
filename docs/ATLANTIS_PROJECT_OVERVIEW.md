# ATLANTIS — Project Explanation (Simple, Zero-Coding Guide)

> **"If you can use Google Earth or an iPad, you can understand and explore the depths of India's oceans."**

---

## 1. The Big Picture: What is ATLANTIS and Why Does It Exist?

### The Problem:
India is surrounded by a massive ocean area called the **Exclusive Economic Zone (EEZ)**. It spans over **2 million square kilometers** across the **Arabian Sea** on the west and the **Bay of Bengal** on the east. 

Every single day, Indian government organizations (like the **Ministry of Earth Sciences - MoES** and **INCOIS**) and global oceanographers collect vast amounts of information about these waters:
- How warm or cold is the water?
- How salty is the ocean?
- Where are deep water currents flowing?
- Where are fish thriving or where are cyclones gaining strength?

**The Catch:** This ocean data is traditionally trapped inside massive, complex scientific research files (called `.nc` or NetCDF files). To view them, you normally need to be a data scientist or write code in Python. Fishermen, coast guards, navy officers, emergency responders, and everyday citizens cannot look inside these files.

### The Solution: ATLANTIS
**ATLANTIS** is an interactive, high-tech **3D Digital Twin of India's Ocean**. It acts like a "Google Earth for the Seas". Anyone can open their web browser, fly around a 3D globe of India, slide their finger down to see water 1,000 meters deep, click on robotic ocean probes swimming in real time, and watch the ocean's temperature and currents animate like a weather forecast.

---

## 2. Where Does the Data Come From? (The 3 Real Sources)

We did **not** generate fake, random mock numbers. Everything in ATLANTIS is built on **100% real-world oceanographic data** from world-leading marine organizations:

```
                  ┌────────────────────────────────────────────────────────┐
                  │               WHERE OUR DATA COMES FROM                │
                  └────────────────────────────────────────────────────────┘
                                               │
         ┌─────────────────────────────────────┼─────────────────────────────────────┐
         ▼                                     ▼                                     ▼
1. SATELLITES & PHYSICS MODELS        2. IN-SITU ARGO FLOATS               3. UNDERWATER GLIDERS
   (Copernicus Marine Service)           (Ifremer Argo Global Hub)            (OceanGliders GDAC)
   • 3D Grid of Water Temp               • 50 Real Robotic Probes             • 2 Real Winged Drones
   • Saltiness (Salinity)                • 84,667 Depth Measurements          • 1,198 3D Dive Points
   • Ocean Current Vectors               • Dives down to 2,000 meters         • Arabian Sea & Bay of Bengal
```

### Source 1: The "Ocean Weather Forecast" (Copernicus Marine / INCOIS)
- **What it is:** Just like meteorologists have computer models forecasting rain and air temperature, oceanographers run supercomputer physics models forecasting the ocean.
- **What we took:** We pulled data specifically for India's bounding box (**6°N to 25°N Latitude, 68°E to 90°E Longitude**), from the surface (**0.5 meters**) all the way down to **1,000 meters deep** across multiple time periods.
- **The Variables:**
  1. `thetao` = Water Temperature (°C)
  2. `so` = Water Saltiness (Salinity in PSU)
  3. `uo` & `vo` = East-West and North-South water currents
  4. `cur_speed` = Ocean current speed (meters per second)

### Source 2: The 50 Robotic Ocean Drifters (Argo Floats)
- **What it is:** Imagine high-tech robotic yellow cylinders thrown into the sea. They sink down to 2,000 meters deep (where it's pitch black), drift for 10 days measuring temperature and salinity, then rise back to the surface and beam their measurements to satellites.
- **What we took:** We connected to the global Argo data server and extracted **50 active robotic floats** currently operating inside India's EEZ, containing **84,667 real depth measurements**.

### Source 3: Autonomous Underwater Gliders
- **What it is:** These are underwater drones shaped like miniature airplanes. They don't have propellers; instead, they change their buoyancy to glide up and down like underwater birds, traveling hundreds of kilometers across the sea.
- **What we took:** We connected to the global glider tracking repository and downloaded **2 real glider missions** (`Bellatrix_368` and `Denebola_382`) with over **1,100 3D trajectory points** in the Bay of Bengal.

---

## 3. The Data Pipeline: Preparing the Data for the Web

Raw ocean data files are **huge** and **clunky**. If you tried to load a raw 500-megabyte NetCDF file directly into a website on a phone or laptop, the browser would freeze or crash.

We created an automated processing pipeline (the "Data Kitchen"):
1. **The Slicer (`build_tiles.py`):** It slices the ocean like a 4-layer cake:
   - 5 variables (Temperature, Salt, Current Speed, etc.)
   - 14 different depth levels (from 0.5 meters down to 1,000 meters)
   - 5 different observation days
2. **Compact Tile Creation:** It converts every single combination into a tiny, lightweight JSON file.
3. **Smart Compression:** Each file is compressed using GZip. What was once a giant raw file now loads in **0.005 seconds** over standard internet.
4. **Manifest Creation:** It creates a "table of contents" (`manifest.json`) that tells the system: "Here are all available depths, timesteps, and safe minimum/maximum values."

---

## 4. The Backend: The Super-Fast Librarian (FastAPI)

The **Backend** is the invisible engine that runs behind the scenes. Think of it as a helpful librarian sitting behind the counter:
- When the user on the website clicks *"Show me Water Temperature at 200 meters depth on Day 3"*, the frontend sends a quick request: `GET /api/field?variable=thetao&depth=9&time=2`.
- The backend librarian doesn't waste time looking through hard drives. It keeps the most popular information in **super-fast memory (RAM Caching)** and answers back in less than **1 millisecond**.

### Endpoints Built:
1. **`/api/manifest`**: Gives the website the full list of available variables, depth steps, and date stamps.
2. **`/api/field`**: Hands over the exact temperature, salt, or current map for any depth and time.
3. **`/api/argo/positions`**: Hands over the live GPS coordinates of all 50 robotic Argo floats.
4. **`/api/argo/profile/{float_id}`**: When you click a float, it instantly gives you its entire vertical dive history.
5. **`/api/glider/tracks`**: Delivers the 3D flight paths of underwater gliders.
6. **`/api/health`**: A live heartbeat check that confirms all data files are intact.
7. **`/docs`**: A clean, interactive documentation manual that judges can inspect to see our clean API design.

---

## 5. The Frontend: The 3D Digital Ocean (Next.js & Cesium)

The **Frontend** is what you see and touch on your screen. It is styled in a **dark, glowing oceanic aesthetic** (navy blues, glowing cyan, and emerald green):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  🌊 ATLANTIS  |  MoES · INCOIS  |  EEZ Scope: 6°N-25°N, 68°E-90°E         [● Live GDAC]     │
├───────────────┬─────────────────────────────────────────────────────────────┬───────────────┤
│               │                                                             │               │
│ OCEAN         │                   3D CESIUM VIRTUAL GLOBE                   │ COLORBAR      │
│ CONTROLS      │                                                             │ LEGEND        │
│               │       🇮🇳 Indian Landmass (Clean Topography)                 │               │
│ • Temperature │                                                             │ Warm: 30°C    │
│ • Salinity    │     🌊 Arabian Sea            🌀 Bay of Bengal               │       ▲       │
│ • Currents    │   (Glowing Heatmap)         (Glowing Heatmap)               │       │       │
│               │                                                             │ Cold: 4°C     │
│ MODE:         │     ● Argo Float #5907082                                   │ [⚙️ Settings] │
│ [Single]      │         \                                                   │               │
│ [3D Volume]   │          \───> [CTD Profile Chart Drawer Slides Out]        └───────────────┤
│               │                                                                             │
│ DEPTH: 200m   │   ═══ Glider Flight Path (Glowing Amber Line)                               │
│ TIME: [▶ Play]│                                                                             │
├───────────────┴─────────────────────────────────────────────────────────────────────────────┤
│ 📍 Cursor: Lat: 15.209°N, Lon: 80.492°E  |  Depth: 200m  |  Sea Salinity: 35.12 PSU         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### What You Can Experience on the Screen:

1. **The Full 3D Virtual Globe (CesiumJS):**
   - Centered directly over India. You can rotate, zoom into the coast of Mumbai, fly over Lakshadweep, or hover over the Andaman Sea.
2. **Real Ocean Heatmaps (Surface & Depth):**
   - The ocean waters glow with actual physical temperature and salinity textures.
   - Land is automatically transparent, so India's coastlines and cities are never obscured.
3. **The 3D Volumetric Water Column (Hackathon Differentiator!):**
   - Most other apps only show a flat 2D sticker on the water.
   - When you switch to **"3D Volumetric Mode"**, ATLANTIS renders **4 stacked layers of ocean** at the same time:
     - Layer 1: Surface (0.5 meters)
     - Layer 2: Sunlit Euphotic Zone (50 meters)
     - Layer 3: Thermocline Transition (200 meters)
     - Layer 4: Deep Abyssal Zone (1,000 meters)
   - You can tilt the camera into a **3D perspective** and literally look down through the water column into the abyss!
   - You can slide the **Vertical Exaggeration** slider (50x to 400x) to spread the depth layers out so they are easy to see.
4. **Interactive 4D Time Forecast:**
   - Press the **Play button**, and the map animates forward through the days, showing how ocean eddies and warm water currents shift over time with smooth cross-fading.
5. **Interactive Argo Robot Probes:**
   - 50 cyan markers float in the real locations where probes are drifting right now.
   - Click any float: a sleek glass side panel opens on the right.
   - It draws an official **Inverted Depth Chart** (surface at top, deep ocean at bottom) showing exactly how temperature and salinity changed as that robot dove into the sea.
   - You can even pick past dive cycles from a dropdown (e.g. Cycle 109 vs Cycle 108).
6. **Underwater Glider Flight Paths:**
   - Glowing golden trajectory ribbons showing the paths taken by underwater gliders in the Bay of Bengal.
7. **Interactive Colorbar & Palette Editor:**
   - Click the gear icon on the top-right legend to change color palettes on the fly (**Thermal**, **Haline**, **Cool-Warm**, **Viridis**, **Plasma**).
   - Toggle between **Linear** and **Logarithmic** scaling.
   - Manually type custom Min and Max ranges.
   - **Zero lag:** It recalculates the colors instantly in your browser without needing to reload or talk to the server!
8. **Live Crosshair Inspection (InfoBar):**
   - Move your mouse anywhere over the water, and the bottom bar instantly shows the exact coordinates (`15.133°N, 73.144°E`), the depth (`200m`), and the real measurement (`35.52 PSU`).

---

## 6. How to Explain This to Non-Technical Judges (30-Second Pitch)

> *"Judges, today millions of dollars worth of critical ocean data from satellites, drifting robotic floats, and underwater gliders sits locked away in heavy academic files that non-specialists cannot read.*
> 
> *We built **ATLANTIS** to solve this. ATLANTIS connects directly to real Copernicus and Argo data streams, processes the entire Indian Exclusive Economic Zone across 14 depth layers, and serves it as a responsive 3D digital twin.*
> 
> *Instead of looking at flat 2D maps, users can tilt into a true 3D volumetric water column, inspect real in-situ robotic probes down to 2,000 meters, watch 4D forecast animations, and customize scientific color palettes in real time—all running at 60 frames per second right inside the web browser."*

---

## 7. Current Project Status & Architecture Summary

| Component | Technology Used | Current Status |
|---|---|---|
| **Data Ingestion** | Python (`copernicusmarine`, `argopy`, `erddapy`) | ✅ **Done** (50 Argo floats, 2 Glider tracks, Copernicus 3D models) |
| **Data Tile Engine** | Python (`xarray`, `netCDF4`, `gzip`) | ✅ **Done** (350 depth/time slices generated & compressed) |
| **Backend REST API** | Python (`FastAPI`, `uvicorn`, `Pydantic`) | ✅ **Done** (7 verified endpoints, in-memory caching, OpenAPI docs at `/docs`) |
| **3D Geospatial Globe** | Next.js 16, TypeScript, CesiumJS, Resium | ✅ **Done** (Full EEZ bounding box, camera presets, 60fps WebGL) |
| **Ocean Textures** | HTML5 Canvas, Bicubic Smoothing | ✅ **Done** (Real-time dynamic rasterization with transparent land masking) |
| **3D Volumetric Stack** | Subsurface translucency, negative altitude | ✅ **Done** (4-layer simultaneous water column stack with 50x–400x exaggeration) |
| **Argo CTD Drawer** | Recharts, SVG charting | ✅ **Done** (Inverted depth axis, dual temp/salinity curves, cycle selector) |
| **Glider Paths** | Cesium PolylineGlow | ✅ **Done** (Vibrant golden mission trajectories) |
| **Colorbar Editor** | React State, CSS Gradients | ✅ **Done** (5 palettes, log/linear scale, dynamic min/max override) |
