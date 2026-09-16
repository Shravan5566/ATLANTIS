"""
build_tiles.py - SIH26067 India EEZ Ocean Visualization Pipeline

Processes raw NetCDF ocean model data from /data-pipeline/raw/copernicus_eez.nc
into browser-optimized JSON tiles and manifest for the 3D Cesium globe and FastAPI backend.

Outputs:
1. /data-pipeline/processed/tiles/{variable}/{time_index}/{depth_index}.json (and .json.gz)
   Contains: { lat_grid: [...], lon_grid: [...], values: [[...]] } (2D array, NaN as null)
2. /data-pipeline/processed/tiles/manifest.json
   Contains: variables metadata, depth levels, timesteps (ISO strings), bounding box, and min/max ranges.
"""

import argparse
import gzip
import json
import os
import sys
from pathlib import Path
import numpy as np

# Directory paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PIPELINE_DIR = SCRIPT_DIR.parent
RAW_DIR = DATA_PIPELINE_DIR / "raw"
PROCESSED_DIR = DATA_PIPELINE_DIR / "processed"
TILES_DIR = PROCESSED_DIR / "tiles"
DEFAULT_RAW_FILE = RAW_DIR / "copernicus_eez.nc"
MANIFEST_FILE = TILES_DIR / "manifest.json"

# Variable display metadata
VARIABLE_METADATA = {
    "thetao": {
        "display_name": "Sea Water Temperature",
        "units": "°C",
        "palette": "thermal",
    },
    "so": {
        "display_name": "Sea Water Salinity",
        "units": "PSU",
        "palette": "haline",
    },
    "uo": {
        "display_name": "Eastward Current Velocity",
        "units": "m/s",
        "palette": "coolwarm",
    },
    "vo": {
        "display_name": "Northward Current Velocity",
        "units": "m/s",
        "palette": "coolwarm",
    },
    "cur_speed": {
        "display_name": "Current Velocity Magnitude",
        "units": "m/s",
        "palette": "viridis",
    },
}

# Physical plausibility bounds for each variable.
# Values outside these ranges are treated as fill-value artifacts and masked to NaN
# so they become null in the output JSON rather than corrupt the frontend colorbar.
PHYSICAL_BOUNDS: dict = {
    "thetao": (-5.0, 40.0),     # Sea water temperature: -5°C to 40°C
    "so": (0.0, 45.0),          # Salinity: 0 to 45 PSU
    "uo": (-5.0, 5.0),          # Eastward velocity: ±5 m/s
    "vo": (-5.0, 5.0),          # Northward velocity: ±5 m/s
    "cur_speed": (0.0, 7.0),    # Current speed magnitude: 0 to 7 m/s
}


def apply_physical_bounds(values: np.ndarray, var: str) -> np.ndarray:
    """Masks values outside physical plausibility bounds to NaN.

    This catches fill-value artifacts (e.g., 9.969e+36 or 9999) that survived
    NaN conversion, ensuring they become null in the output JSON.
    Returns a copy so the original xarray dataset is not mutated.
    """
    bounds = PHYSICAL_BOUNDS.get(var)
    if bounds is None:
        return values  # Unknown variable — pass through unchanged

    lo, hi = bounds
    cleaned = values.copy()
    out_of_range_mask = (cleaned < lo) | (cleaned > hi)
    n_finite = np.sum(np.isfinite(cleaned))
    n_bad = int(np.sum(out_of_range_mask & np.isfinite(cleaned)))

    if n_bad > 0:
        pct = (n_bad / max(n_finite, 1)) * 100
        print(f"  [!] Physical range check '{var}': {n_bad} values ({pct:.1f}%) outside [{lo}, {hi}] — masking to NaN.")
        cleaned[out_of_range_mask] = np.nan

    return cleaned


def generate_sample_netcdf(output_file: Path):
    """Generates a realistic synthetic Copernicus NetCDF file for India EEZ

    if a live download has not yet been executed.
    """
    import xarray as xr
    import pandas as pd

    print(f"[*] Generating realistic sample NetCDF dataset for India EEZ at {output_file}...")
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Coordinates
    lats = np.arange(6.0, 25.1, 0.25)   # ~77 points
    lons = np.arange(68.0, 90.1, 0.25)  # ~89 points
    depths = np.array([0.5, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 150.0, 200.0, 300.0, 500.0, 750.0, 1000.0])
    times = pd.date_range(end=pd.Timestamp.now().floor("D"), periods=5, freq="D")

    # Meshgrid shapes: (time, depth, lat, lon)
    shape = (len(times), len(depths), len(lats), len(lons))

    # Base temperature: warm surface (~29-30°C in Arabian Sea/BoB), cooler at depth, cooler in north
    temp = np.zeros(shape, dtype=np.float32)
    sal = np.zeros(shape, dtype=np.float32)
    uo = np.zeros(shape, dtype=np.float32)
    vo = np.zeros(shape, dtype=np.float32)

    lat_2d, lon_2d = np.meshgrid(lats, lons, indexing="ij")

    # Ocean mask (rough India land mask between lat 8-22, lon 73-86)
    land_mask = (lat_2d > 8.5) & (lat_2d < 22.5) & (lon_2d > 73.0) & (lon_2d < 85.0)
    # Refine peninsula triangle
    tri_slope = (lat_2d - 8.5) / (22.5 - 8.5)
    in_triangle = (lon_2d > (77.0 - 5.0 * tri_slope)) & (lon_2d < (77.0 + 7.0 * tri_slope))
    land_mask = land_mask & in_triangle

    for t_idx in range(len(times)):
        for d_idx, d in enumerate(depths):
            # Thermal stratification: surface 29°C -> deep 4°C
            surface_temp = 29.5 - 0.15 * (lat_2d - 12.0) + 0.2 * np.sin(lon_2d / 4.0 + t_idx)
            t_slice = 4.0 + (surface_temp - 4.0) * np.exp(-d / 220.0)

            # Salinity: higher in Arabian Sea (>36), lower in Bay of Bengal (<34.5)
            s_slice = 35.8 - 1.2 * ((lon_2d - 68.0) / 22.0) + 0.4 * (1.0 - np.exp(-d / 150.0))

            # Currents: East India Coastal Current & Arabian Sea circulation
            u_slice = 0.4 * np.sin(lat_2d / 3.0 + t_idx) * np.exp(-d / 100.0)
            v_slice = 0.5 * np.cos(lon_2d / 4.0) * np.exp(-d / 100.0)

            # Apply land mask
            t_slice[land_mask] = np.nan
            s_slice[land_mask] = np.nan
            u_slice[land_mask] = np.nan
            v_slice[land_mask] = np.nan

            temp[t_idx, d_idx] = t_slice
            sal[t_idx, d_idx] = s_slice
            uo[t_idx, d_idx] = u_slice
            vo[t_idx, d_idx] = v_slice

    ds = xr.Dataset(
        data_vars={
            "thetao": (["time", "depth", "latitude", "longitude"], temp, {"units": "degrees_C", "long_name": "Potential temperature"}),
            "so": (["time", "depth", "latitude", "longitude"], sal, {"units": "1e-3", "long_name": "Salinity"}),
            "uo": (["time", "depth", "latitude", "longitude"], uo, {"units": "m s-1", "long_name": "Eastward velocity"}),
            "vo": (["time", "depth", "latitude", "longitude"], vo, {"units": "m s-1", "long_name": "Northward velocity"}),
        },
        coords={
            "time": times,
            "depth": depths,
            "latitude": lats,
            "longitude": lons,
        },
        attrs={
            "title": "Copernicus Marine Physics EEZ Demo Dataset",
            "source": "SIH26067 Mock NetCDF Generator",
        },
    )

    ds.to_netcdf(output_file)
    print(f"[+] Sample NetCDF generated ({output_file.stat().st_size / (1024*1024):.2f} MB)")
    return output_file


def build_tiles(raw_file: Path = DEFAULT_RAW_FILE):
    """Slices NetCDF into compressed JSON tiles and builds manifest.json."""
    import xarray as xr
    import pandas as pd

    if not raw_file.exists() or raw_file.stat().st_size == 0:
        print(f"[!] Target NetCDF file not found at {raw_file}")
        print("[*] Generating representative Copernicus EEZ NetCDF to build operational tiles...")
        generate_sample_netcdf(raw_file)

    print("\n" + "=" * 70)
    print("Initiating Tile Generation Pipeline")
    print(f"Source NetCDF: {raw_file}")
    print(f"Target Dir:    {TILES_DIR}")
    print("=" * 70)

    # Open xarray dataset
    with xr.open_dataset(raw_file) as ds:
        # Resolve coordinate names
        time_coord = next((c for c in ["time", "valid_time"] if c in ds.coords), None)
        depth_coord = next((c for c in ["depth", "depth_level", "lev"] if c in ds.coords), None)
        lat_coord = next((c for c in ["latitude", "lat"] if c in ds.coords), None)
        lon_coord = next((c for c in ["longitude", "lon"] if c in ds.coords), None)

        if not (time_coord and depth_coord and lat_coord and lon_coord):
            print(f"[-] Missing standard coordinates in NetCDF: {list(ds.coords.keys())}")
            sys.exit(1)

        # Coordinate arrays
        lat_grid = [round(float(x), 4) for x in ds[lat_coord].values]
        lon_grid = [round(float(x), 4) for x in ds[lon_coord].values]
        depth_levels = [round(float(x), 2) for x in ds[depth_coord].values]
        timesteps = [pd.to_datetime(t).strftime("%Y-%m-%dT%H:%M:%SZ") for t in ds[time_coord].values]

        # Identify candidate variables
        variables = [v for v in ["thetao", "so", "uo", "vo"] if v in ds.data_vars]
        has_current_vectors = ("uo" in variables and "vo" in variables)

        # Calculate current magnitude if vector components exist
        if has_current_vectors and "cur_speed" not in variables:
            print("[*] Computing combined current speed variable: sqrt(uo^2 + vo^2)...")
            ds["cur_speed"] = np.sqrt(ds["uo"] ** 2 + ds["vo"] ** 2)
            variables.append("cur_speed")

        print(f"  Dimensions: time={len(timesteps)}, depth={len(depth_levels)}, lat={len(lat_grid)}, lon={len(lon_grid)}")
        print(f"  Variables to tile: {variables}")

        # Compute min/max value ranges across dataset for colorbar scaling
        manifest_variables = {}
        for var in variables:
            data_vals = ds[var].values
            valid_vals = data_vals[np.isfinite(data_vals)]
            if len(valid_vals) > 0:
                min_val = round(float(np.nanpercentile(valid_vals, 1)), 2)
                max_val = round(float(np.nanpercentile(valid_vals, 99)), 2)
            else:
                min_val, max_val = 0.0, 1.0

            meta = VARIABLE_METADATA.get(var, {
                "display_name": str(ds[var].attrs.get("long_name", var)),
                "units": str(ds[var].attrs.get("units", "")),
                "palette": "viridis",
            })

            manifest_variables[var] = {
                "display_name": meta["display_name"],
                "units": meta["units"],
                "palette": meta["palette"],
                "min": min_val,
                "max": max_val,
            }

        # Build and write manifest.json
        manifest = {
            "title": "India EEZ Ocean Model Tiles (SIH26067)",
            "bounding_box": {
                "min_lon": min(lon_grid),
                "max_lon": max(lon_grid),
                "min_lat": min(lat_grid),
                "max_lat": max(lat_grid),
            },
            "grid_shape": {
                "lat_count": len(lat_grid),
                "lon_count": len(lon_grid),
            },
            "lat_grid": lat_grid,
            "lon_grid": lon_grid,
            "depth_levels": depth_levels,
            "timesteps": timesteps,
            "variables": manifest_variables,
        }

        TILES_DIR.mkdir(parents=True, exist_ok=True)
        with open(MANIFEST_FILE, "w", encoding="utf-8") as mf:
            json.dump(manifest, mf, indent=2)
        print(f"[+] Saved manifest: {MANIFEST_FILE}")

        # Slicing tiles per (variable, timestep, depth)
        tile_count = 0
        print("[*] Slicing and compressing tiles...")

        for var in variables:
            var_dir = TILES_DIR / var
            raw_var_data = ds[var].values  # shape: (time, depth, lat, lon)

            # Apply physical plausibility bounds — mask fill-value artifacts to NaN
            var_data = apply_physical_bounds(raw_var_data, var)

            for t_idx in range(len(timesteps)):
                time_dir = var_dir / str(t_idx)
                time_dir.mkdir(parents=True, exist_ok=True)

                for d_idx in range(len(depth_levels)):
                    slice_2d = var_data[t_idx, d_idx]

                    # Round to 3 decimal places and convert NaN to None
                    clean_values = [
                        [
                            round(float(val), 3) if np.isfinite(val) else None
                            for val in row
                        ]
                        for row in slice_2d
                    ]

                    tile_payload = {
                        "variable": var,
                        "time_index": t_idx,
                        "time": timesteps[t_idx],
                        "depth_index": d_idx,
                        "depth": depth_levels[d_idx],
                        "lat_grid": lat_grid,
                        "lon_grid": lon_grid,
                        "values": clean_values,
                    }

                    # 1. Save standard JSON
                    json_path = time_dir / f"{d_idx}.json"
                    json_bytes = json.dumps(tile_payload, separators=(",", ":")).encode("utf-8")
                    with open(json_path, "wb") as f_json:
                        f_json.write(json_bytes)

                    # 2. Save gzip compressed JSON
                    gz_path = time_dir / f"{d_idx}.json.gz"
                    with gzip.open(gz_path, "wb") as f_gz:
                        f_gz.write(json_bytes)

                    tile_count += 1

        # Calculate directory size
        total_size_bytes = sum(f.stat().st_size for f in TILES_DIR.rglob("*") if f.is_file())
        total_size_mb = total_size_bytes / (1024 * 1024)
        total_files = len(list(TILES_DIR.rglob("*.*")))

        print("\n" + "=" * 70)
        print("Tile Generation Completed Successfully:")
        print(f"  Total Slice Combinations: {tile_count}")
        print(f"  Total Files Generated:    {total_files} (includes .json and .json.gz)")
        print(f"  Total Tiles Directory Size: {total_size_mb:.2f} MB")
        print(f"  Manifest File:            {MANIFEST_FILE}")
        print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Generate browser-friendly tiles from Copernicus NetCDF")
    parser.add_argument("--input", default=str(DEFAULT_RAW_FILE), help="Path to input NetCDF file")
    parser.add_argument("--force-sample", action="store_true", help="Force sample dataset generation")
    args = parser.parse_args()

    input_path = Path(args.input)
    if args.force_sample:
        generate_sample_netcdf(input_path)

    build_tiles(input_path)


if __name__ == "__main__":
    main()
