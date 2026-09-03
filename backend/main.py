"""
main.py - SIH26067 India EEZ Ocean Visualization Backend API

FastAPI REST API serving:
- Ocean model 2D/3D field slices (/api/field)
- Available variables, depth levels, and timesteps (/api/manifest)
- Argo float positions and depth profiles (/api/argo/positions, /api/argo/profile/{float_id})
- Glider tracks (/api/glider/tracks)
- System health (/api/health)

Features:
- Full OpenAPI / Swagger documentation at /docs
- In-memory LRU caching and indexed lookups for sub-millisecond responses
- GZip compression middleware and pre-compressed .gz support
- CORS enabled for Next.js frontend (http://localhost:3000)
"""

import functools
import gzip
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

# Load environment configuration
load_dotenv()

# Directories
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_PIPELINE_DIR = PROJECT_ROOT / "data-pipeline"
PROCESSED_DIR = DATA_PIPELINE_DIR / "processed"
TILES_DIR = PROCESSED_DIR / "tiles"
MANIFEST_FILE = TILES_DIR / "manifest.json"
ARGO_POSITIONS_FILE = PROCESSED_DIR / "argo_latest_positions.json"
ARGO_PROFILES_FILE = PROCESSED_DIR / "argo_profiles.json"
GLIDER_TRACKS_FILE = PROCESSED_DIR / "glider_tracks.json"

# In-memory index for Argo profiles (float_id -> list of profile dicts)
_ARGO_PROFILES_INDEX: Optional[Dict[str, List[Dict[str, Any]]]] = None


# ---------------------------------------------------------------------------
# Pydantic Response Models (for OpenAPI documentation)
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = Field(..., example="healthy")
    service: str = Field(..., example="sih26067-eez-ocean-backend")
    version: str = Field(..., example="0.1.0")
    timestamp: str = Field(..., example="2026-09-04T00:00:00Z")
    data_foundation: Dict[str, bool] = Field(
        ...,
        example={"manifest": True, "argo_positions": True, "argo_profiles": True, "glider_tracks": True},
    )


class BoundingBox(BaseModel):
    min_lon: float = Field(..., example=68.0)
    max_lon: float = Field(..., example=90.0)
    min_lat: float = Field(..., example=6.0)
    max_lat: float = Field(..., example=25.0)


class GridShape(BaseModel):
    lat_count: int = Field(..., example=77)
    lon_count: int = Field(..., example=89)


class VariableMeta(BaseModel):
    display_name: str = Field(..., example="Sea Water Temperature")
    units: str = Field(..., example="°C")
    palette: str = Field(..., example="thermal")
    min: float = Field(..., example=4.25)
    max: float = Field(..., example=30.03)


class ManifestResponse(BaseModel):
    title: str = Field(..., example="India EEZ Ocean Model Tiles (SIH26067)")
    bounding_box: BoundingBox
    grid_shape: GridShape
    lat_grid: List[float] = Field(..., description="Array of latitude coordinates")
    lon_grid: List[float] = Field(..., description="Array of longitude coordinates")
    depth_levels: List[float] = Field(..., description="Available depth levels in meters")
    timesteps: List[str] = Field(..., description="Available timesteps in ISO-8601 UTC")
    variables: Dict[str, VariableMeta] = Field(..., description="Metadata per ocean variable")


class FieldTileResponse(BaseModel):
    variable: str = Field(..., example="thetao")
    time_index: int = Field(..., example=0)
    time: str = Field(..., example="2026-09-01T00:00:00Z")
    depth_index: int = Field(..., example=0)
    depth: float = Field(..., example=0.5)
    lat_grid: List[float]
    lon_grid: List[float]
    values: List[List[Optional[float]]] = Field(
        ..., description="2D grid of values (rows=lat, cols=lon); land/masked values are null"
    )


class ArgoPositionItem(BaseModel):
    float_id: str = Field(..., example="1902289")
    latitude: float = Field(..., example=14.82)
    longitude: float = Field(..., example=71.55)
    timestamp: str = Field(..., example="2026-08-25T04:57:15Z")
    cycle_number: int = Field(..., example=68)
    min_depth: float = Field(..., example=4.7)
    max_depth: float = Field(..., example=1994.3)
    total_profile_levels: int = Field(..., example=996)
    total_historical_records: int = Field(..., example=996)
    is_demo_data: bool = Field(..., example=False)


class ArgoProfileItem(BaseModel):
    float_id: str = Field(..., example="1902289")
    cycle_number: int = Field(..., example=68)
    timestamp: str = Field(..., example="2026-08-25T04:57:15Z")
    latitude: float = Field(..., example=14.82)
    longitude: float = Field(..., example=71.55)
    depth: float = Field(..., example=10.0)
    temperature: Optional[float] = Field(None, example=28.45)
    salinity: Optional[float] = Field(None, example=35.82)
    oxygen: Optional[float] = Field(None, example=215.3)
    chlorophyll: Optional[float] = Field(None, example=0.45)
    is_demo_data: Optional[bool] = Field(False)


class GliderPoint(BaseModel):
    lat: float = Field(..., example=8.00755)
    lon: float = Field(..., example=88.00525)
    time: str = Field(..., example="2016-07-02T04:56:47Z")
    depth: float = Field(..., example=1.1)
    temperature: Optional[float] = Field(None, example=28.38)
    salinity: Optional[float] = Field(None, example=34.5)


class GliderTrackItem(BaseModel):
    glider_id: str = Field(..., example="Bellatrix_368")
    demo_glider_outside_eez: bool = Field(..., example=False)
    total_raw_points: int = Field(..., example=193458)
    sampled_points: int = Field(..., example=599)
    time_start: Optional[str] = Field(None, example="2016-07-02T04:56:47Z")
    time_end: Optional[str] = Field(None, example="2016-07-16T04:53:56Z")
    points: List[GliderPoint]


# ---------------------------------------------------------------------------
# FastAPI Application & Middleware Initialization
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SIH26067 – India EEZ Ocean Visualization API",
    description=(
        "Production-ready REST API serving 3D ocean model fields (temperature, salinity, currents), "
        "Argo in-situ profiles, and glider tracks for India's Exclusive Economic Zone (68°–90°E, 6°–25°N)."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Automatic GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)


# ---------------------------------------------------------------------------
# Helper Caching Functions
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=1)
def load_manifest() -> Dict[str, Any]:
    """Loads and caches manifest.json in memory."""
    if not MANIFEST_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Manifest file not found. Please execute 'python data-pipeline/scripts/build_tiles.py' first.",
        )
    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@functools.lru_cache(maxsize=1)
def load_argo_positions() -> List[Dict[str, Any]]:
    """Loads and caches latest Argo float positions."""
    if not ARGO_POSITIONS_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Argo positions file not found. Please execute 'python data-pipeline/scripts/fetch_argo.py' first.",
        )
    with open(ARGO_POSITIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_argo_profiles_index() -> Dict[str, List[Dict[str, Any]]]:
    """Lazily loads and indexes argo_profiles.json by float_id for O(1) profile lookups."""
    global _ARGO_PROFILES_INDEX
    if _ARGO_PROFILES_INDEX is not None:
        return _ARGO_PROFILES_INDEX

    if not ARGO_PROFILES_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Argo profiles file not found. Please execute 'python data-pipeline/scripts/fetch_argo.py' first.",
        )

    print("[*] Building in-memory index for Argo depth profiles...")
    with open(ARGO_PROFILES_FILE, "r", encoding="utf-8") as f:
        profiles_list = json.load(f)

    index: Dict[str, List[Dict[str, Any]]] = {}
    for item in profiles_list:
        fid = str(item.get("float_id"))
        if fid not in index:
            index[fid] = []
        index[fid].append(item)

    _ARGO_PROFILES_INDEX = index
    print(f"[+] Argo profiles indexed: {len(index)} distinct floats.")
    return _ARGO_PROFILES_INDEX


@functools.lru_cache(maxsize=1)
def load_glider_tracks() -> List[Dict[str, Any]]:
    """Loads and caches glider tracks."""
    if not GLIDER_TRACKS_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Glider tracks file not found. Please execute 'python data-pipeline/scripts/fetch_glider.py' first.",
        )
    with open(GLIDER_TRACKS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@functools.lru_cache(maxsize=512)
def load_field_tile_bytes(variable: str, time_index: int, depth_index: int) -> bytes:
    """Reads and caches tile JSON bytes from disk."""
    gz_path = TILES_DIR / variable / str(time_index) / f"{depth_index}.json.gz"
    json_path = TILES_DIR / variable / str(time_index) / f"{depth_index}.json"

    if gz_path.exists():
        with gzip.open(gz_path, "rb") as gz:
            return gz.read()
    elif json_path.exists():
        with open(json_path, "rb") as jf:
            return jf.read()
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Field tile not found for variable='{variable}', time_index={time_index}, depth_index={depth_index}",
        )


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
async def root():
    """Root metadata and navigation links."""
    return {
        "project": "SIH26067 – India EEZ Ocean Visualization Platform",
        "description": "API serving ocean model fields, Argo floats, and glider tracks.",
        "status": "online",
        "endpoints": {
            "health": "/api/health",
            "manifest": "/api/manifest",
            "field": "/api/field?variable=thetao&time=0&depth=0",
            "argo_positions": "/api/argo/positions",
            "argo_profile": "/api/argo/profile/{float_id}",
            "glider_tracks": "/api/glider/tracks",
            "documentation": "/docs",
        },
    }


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check",
    description="Returns service status and validates presence of underlying processed ocean datasets.",
)
async def health():
    return {
        "status": "healthy",
        "service": "sih26067-eez-ocean-backend",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_foundation": {
            "manifest": MANIFEST_FILE.exists(),
            "argo_positions": ARGO_POSITIONS_FILE.exists(),
            "argo_profiles": ARGO_PROFILES_FILE.exists(),
            "glider_tracks": GLIDER_TRACKS_FILE.exists(),
        },
    }


@app.get(
    "/api/manifest",
    response_model=ManifestResponse,
    tags=["Ocean Model Fields"],
    summary="Get Ocean Tiles Manifest",
    description=(
        "Returns the global manifest describing available variables (display names, units, color palettes, min/max ranges), "
        "available depth levels (in meters), available ISO timesteps, and the India EEZ bounding box."
    ),
)
async def get_manifest():
    return load_manifest()


@app.get(
    "/api/field",
    response_model=FieldTileResponse,
    tags=["Ocean Model Fields"],
    summary="Get 2D/3D Ocean Field Tile",
    description=(
        "Returns the 2D grid slice (lat_grid, lon_grid, values matrix) for a specific variable, "
        "timestep index, and depth level index. Land and masked areas are null."
    ),
)
async def get_field(
    variable: str = Query(..., description="Variable key: thetao, so, uo, vo, or cur_speed"),
    time: int = Query(0, alias="time", ge=0, description="Timestep index (0 to N-1)"),
    depth: int = Query(0, alias="depth", ge=0, description="Depth level index (0 to N-1)"),
):
    # Verify variable exists in manifest
    manifest = load_manifest()
    if variable not in manifest["variables"]:
        valid_vars = list(manifest["variables"].keys())
        raise HTTPException(
            status_code=400,
            detail=f"Invalid variable '{variable}'. Available variables: {valid_vars}",
        )

    # Fetch cached JSON bytes
    tile_bytes = load_field_tile_bytes(variable, time, depth)
    return Response(content=tile_bytes, media_type="application/json")


@app.get(
    "/api/argo/positions",
    response_model=List[ArgoPositionItem],
    tags=["In-Situ Observations"],
    summary="Get Latest Argo Float Positions",
    description="Returns the latest coordinates, timestamp, and profile depth spans for all active Argo floats in India's EEZ.",
)
async def get_argo_positions():
    return load_argo_positions()


@app.get(
    "/api/argo/profile/{float_id}",
    response_model=List[ArgoProfileItem],
    tags=["In-Situ Observations"],
    summary="Get Float Depth Profile History",
    description="Returns the full depth-resolved temperature and salinity profile history for a specific Argo float WMO ID.",
)
async def get_argo_profile(float_id: str):
    index = get_argo_profiles_index()
    float_id_clean = str(float_id).strip()

    if float_id_clean not in index:
        available_sample = list(index.keys())[:5]
        raise HTTPException(
            status_code=404,
            detail=f"Argo float ID '{float_id_clean}' not found. Sample valid float IDs: {available_sample}",
        )

    return index[float_id_clean]


@app.get(
    "/api/glider/tracks",
    response_model=List[GliderTrackItem],
    tags=["In-Situ Observations"],
    summary="Get Ocean Glider Trajectories",
    description=(
        "Returns active and representative underwater ocean glider trajectories intersecting India's EEZ, "
        "including 3D depth, temperature, salinity, coordinates, and demonstration badges."
    ),
)
async def get_glider_tracks():
    return load_glider_tracks()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
