# ATLANTIS — India EEZ Ocean Visualization Platform (Frontend)

Interactive 3D geospatial ocean exploration interface built with **Next.js (App Router, TypeScript)**, **Tailwind CSS**, **CesiumJS / Resium**, and **Recharts**.

---

## 🔑 Cesium ion Access Token Setup

To render Cesium 3D world terrain, global satellite basemaps, and geospatial layers:

> [!NOTE]
> Get a free Cesium ion access token at [https://ion.cesium.com](https://ion.cesium.com) (free tier), then set `NEXT_PUBLIC_CESIUM_ION_TOKEN` in `.env.local`.

Copy the template:
```bash
cp .env.local.example .env.local
```

And edit `.env.local`:
```env
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token_here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🚀 Running the Frontend Locally

```bash
# Install dependencies
npm install

# Run Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to explore the 3D globe.

---

## 🏛️ Modular Component Structure

```
src/
├── app/
│   ├── layout.tsx         # Oceanic dark layout + React Query Providers + ATLANTIS Favicon
│   ├── page.tsx           # Main application state and layout coordinator
│   └── globals.css        # Oceanic theme tokens, glassmorphic styling, Cesium widgets CSS
├── components/
│   ├── Navbar.tsx         # Top bar with ATLANTIS logo, EEZ scope, and API link
│   ├── Sidebar.tsx        # Left collapsible controls drawer
│   ├── VariableSelector.tsx # Parameter selection (Temperature, Salinity, Current Velocity)
│   ├── DepthSlider.tsx    # Depth layer stepping (0.5m to 1000m)
│   ├── TimeSlider.tsx     # Timestep selector and 4D animation loop
│   ├── Colorbar.tsx       # Top-right interactive gradient legend
│   ├── InfoBar.tsx        # Bottom inspection bar (Lat, Lon, Depth, and live values)
│   ├── Globe.tsx          # Full-screen 3D Cesium viewer centered on India EEZ
│   ├── GlobeWrapper.tsx   # SSR-safe dynamic wrapper
│   └── Providers.tsx      # React Query Provider setup
└── lib/
    └── api.ts             # Typed API client matching FastAPI backend models
```
