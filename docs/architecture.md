# SIH26067 Architecture & Design

## System Architecture

```
+-----------------------------------------------------------+
|              Next.js Frontend (CesiumJS + Resium)         |
|  - 3D Globe focused on India EEZ (68°-90°E, 6°-25°N)     |
|  - Depth slice volumetric layers & exaggeration slider    |
|  - Argo Float markers & profile charts (Recharts)         |
|  - Dynamic Colorbar palette selector                      |
+-----------------------------+-----------------------------+
                              | HTTP / JSON
                              v
+-----------------------------------------------------------+
|                  FastAPI Backend Service                  |
|  - GET /api/manifest                                      |
|  - GET /api/field?variable=...&time=...&depth=...        |
|  - GET /api/argo/positions                                |
|  - GET /api/argo/profile/{float_id}                       |
|  - GET /api/glider/tracks                                 |
|  - GET /api/health                                        |
+-----------------------------+-----------------------------+
                              | Reads pre-processed tiles
                              v
+-----------------------------------------------------------+
|                      Data Pipeline                        |
|  - fetch_copernicus.py  -> Copernicus Marine Toolbox     |
|  - fetch_argo.py        -> argopy (Ifremer / Argovis)    |
|  - fetch_glider.py      -> Ifremer Glider ERDDAP          |
|  - build_tiles.py       -> Slices NetCDF to JSON tiles   |
+-----------------------------------------------------------+
```

## Data Flow
1. **Fetch**: Model and in-situ data are downloaded into `data-pipeline/raw/`.
2. **Tile & Optimize**: Data is normalized, sliced by variable/time/depth, compressed, and saved into `data-pipeline/processed/tiles/`.
3. **Serve**: FastAPI serves tiles and manifests with caching and gzip compression.
4. **Render**: CesiumJS displays the 3D surface/depth field alongside real-time Argo positions and glider tracks.
