"""
fetch_argo.py - SIH26067 India EEZ Ocean Visualization Pipeline

Fetches in-situ Argo float profiles and surface markers within India's EEZ
Bounding Box: Longitude 68°E to 90°E, Latitude 6°N to 25°N for the last 90 days.

Outputs:
- /data-pipeline/processed/argo_profiles.json (full depth-resolved profiles)
- /data-pipeline/processed/argo_latest_positions.json (latest float positions for map markers)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import certifi
from dotenv import load_dotenv

# Set SSL Certificate paths for Windows Python environments
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

# Paths setup
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PIPELINE_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = DATA_PIPELINE_DIR.parent
PROCESSED_DIR = DATA_PIPELINE_DIR / "processed"
PROFILES_FILE = PROCESSED_DIR / "argo_profiles.json"
POSITIONS_FILE = PROCESSED_DIR / "argo_latest_positions.json"

# Load environment variables
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

# India EEZ bounding box
EEZ_BBOX = {
    "min_lon": 68.0,
    "max_lon": 90.0,
    "min_lat": 6.0,
    "max_lat": 25.0,
}

DEFAULT_DEPTH_MIN = 0.0
DEFAULT_DEPTH_MAX = 2000.0
DEFAULT_DAYS = 90
DEFAULT_SRC = os.getenv("ARGO_DATA_SOURCE", "erddap")


def fetch_from_argopy(src: str, start_date_str: str, end_date_str: str, mode: str = "standard"):
    """Queries argopy for the India EEZ bounding box."""
    import argopy
    from argopy import DataFetcher

    print(f"[*] Querying argopy (source: '{src}', mode: '{mode}')...")

    fetcher = DataFetcher(src=src, mode=mode).region([
        EEZ_BBOX["min_lon"],
        EEZ_BBOX["max_lon"],
        EEZ_BBOX["min_lat"],
        EEZ_BBOX["max_lat"],
        DEFAULT_DEPTH_MIN,
        DEFAULT_DEPTH_MAX,
        start_date_str,
        end_date_str,
    ])

    # Convert to xarray first, then to pandas DataFrame
    ds = fetcher.to_xarray()
    df = ds.to_dataframe().reset_index()
    return df


def generate_demonstration_argo_data():
    """Generates realistic demonstration Argo profiles in the Arabian Sea & Bay of Bengal

    if remote GDAC/ERDDAP is slow or temporarily unreachable.
    """
    import numpy as np
    import pandas as pd

    print("[!] Generating representative demonstration Argo data in the EEZ for offline fallback...")

    floats = [
        {"id": "2902210", "lat": 14.8, "lon": 71.5, "name": "Arabian Sea Float 1"},
        {"id": "2902211", "lat": 18.2, "lon": 69.8, "name": "NW Arabian Sea Float"},
        {"id": "2902212", "lat": 11.5, "lon": 74.2, "name": "Lakshadweep Basin Float"},
        {"id": "2903340", "lat": 13.1, "lon": 82.5, "name": "Chennai Offshore Float"},
        {"id": "2903341", "lat": 16.5, "lon": 85.0, "name": "Central Bay of Bengal Float"},
        {"id": "2903342", "lat": 19.8, "lon": 88.2, "name": "Northern BoB Float"},
    ]

    records = []
    base_time = datetime.now(timezone.utc)

    # Standard depth levels (m)
    depth_levels = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000]

    for f in floats:
        # Create 3 recent profiles per float (e.g. every 10 days)
        for profile_idx in range(3):
            prof_time = base_time - timedelta(days=profile_idx * 10)
            prof_time_str = prof_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            # Slight drift
            drift_lat = f["lat"] + (profile_idx * 0.15)
            drift_lon = f["lon"] + (profile_idx * 0.10)

            for d in depth_levels:
                # Realistic tropical Indian Ocean thermocline profile
                # Warm surface (~29°C), rapid drop in thermocline (100-300m), cold deep (~3°C at 2000m)
                temp = 29.0 - 26.0 * (1.0 - np.exp(-d / 280.0)) + np.random.normal(0, 0.15)
                # Salinity: ~35-36 PSU (higher in Arabian Sea, slightly lower in Bay of Bengal)
                is_bob = drift_lon > 80.0
                base_sal = 34.2 if is_bob else 36.1
                sal = base_sal + 0.8 * (1.0 - np.exp(-d / 200.0)) + np.random.normal(0, 0.08)

                records.append({
                    "float_id": str(f["id"]),
                    "cycle_number": 50 - profile_idx,
                    "timestamp": prof_time_str,
                    "latitude": round(drift_lat, 4),
                    "longitude": round(drift_lon, 4),
                    "depth": float(d),
                    "temperature": round(float(temp), 2),
                    "salinity": round(float(sal), 2),
                    "oxygen": round(float(220.0 * np.exp(-d / 400.0) + 20.0), 2) if profile_idx == 0 else None,
                    "chlorophyll": round(float(1.5 * np.exp(-((d - 40) ** 2) / (2 * 25 ** 2))), 3) if d <= 150 else None,
                    "is_demo_data": True,
                })

    return pd.DataFrame(records)


def process_argo_dataframe(df):
    """Normalizes columns, cleans missing values, and produces profiles & latest positions."""
    import pandas as pd
    import numpy as np

    if df.empty:
        return pd.DataFrame(), pd.DataFrame()

    # Standardize column names (lowercase)
    col_map = {c: c.lower() for c in df.columns}
    df = df.rename(columns=col_map)

    # Detect float identifier column
    id_col = None
    for cand in ["platform_number", "wmo", "float_id"]:
        if cand in df.columns:
            id_col = cand
            break

    # Detect coordinates
    lat_col = "latitude" if "latitude" in df.columns else "lat"
    lon_col = "longitude" if "longitude" in df.columns else "lon"
    time_col = "time" if "time" in df.columns else "timestamp"
    depth_col = "pres" if "pres" in df.columns else ("depth" if "depth" in df.columns else "pressure")
    temp_col = "temp" if "temp" in df.columns else ("temperature" if "temperature" in df.columns else None)
    psal_col = "psal" if "psal" in df.columns else ("salinity" if "salinity" in df.columns else None)

    if not (id_col and lat_col in df.columns and lon_col in df.columns and depth_col in df.columns):
        print(f"[-] Missing key columns in Argo dataframe: {list(df.columns)}")
        return pd.DataFrame(), pd.DataFrame()

    # Clean and standardize columns
    clean_df = pd.DataFrame()
    clean_df["float_id"] = df[id_col].astype(str).str.strip()
    clean_df["latitude"] = pd.to_numeric(df[lat_col], errors="coerce")
    clean_df["longitude"] = pd.to_numeric(df[lon_col], errors="coerce")
    clean_df["depth"] = pd.to_numeric(df[depth_col], errors="coerce")

    # Format timestamp
    clean_df["timestamp"] = pd.to_datetime(df[time_col], errors="coerce", utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    if "cycle_number" in df.columns:
        clean_df["cycle_number"] = pd.to_numeric(df["cycle_number"], errors="coerce").fillna(0).astype(int)
    else:
        clean_df["cycle_number"] = 0

    clean_df["temperature"] = pd.to_numeric(df[temp_col], errors="coerce") if temp_col else np.nan
    clean_df["salinity"] = pd.to_numeric(df[psal_col], errors="coerce") if psal_col else np.nan

    # Optional BGC fields
    for bgc_name in ["doxy", "oxygen"]:
        if bgc_name in df.columns:
            clean_df["oxygen"] = pd.to_numeric(df[bgc_name], errors="coerce")
            break
    if "oxygen" not in clean_df.columns:
        clean_df["oxygen"] = None

    for bgc_name in ["chla", "chlorophyll", "chlorophyll_a"]:
        if bgc_name in df.columns:
            clean_df["chlorophyll"] = pd.to_numeric(df[bgc_name], errors="coerce")
            break
    if "chlorophyll" not in clean_df.columns:
        clean_df["chlorophyll"] = None

    if "is_demo_data" in df.columns:
        clean_df["is_demo_data"] = df["is_demo_data"]
    else:
        clean_df["is_demo_data"] = False

    # Filter out NaNs in essential coordinates
    clean_df = clean_df.dropna(subset=["float_id", "latitude", "longitude", "depth", "timestamp"])

    # Keep rows that have at least temperature or salinity
    clean_df = clean_df[clean_df["temperature"].notna() | clean_df["salinity"].notna()]

    # Physical plausibility range filters — drop rows that are clearly fill-value artifacts
    # These values (e.g., 9.969e+36) sometimes survive NaN conversion in older Argo files.
    n_before = len(clean_df)
    if "temperature" in clean_df.columns:
        bad_temp = clean_df["temperature"].notna() & (
            (clean_df["temperature"] < -5.0) | (clean_df["temperature"] > 40.0)
        )
        clean_df.loc[bad_temp, "temperature"] = float("nan")
    if "salinity" in clean_df.columns:
        bad_sal = clean_df["salinity"].notna() & (
            (clean_df["salinity"] < 0.0) | (clean_df["salinity"] > 45.0)
        )
        clean_df.loc[bad_sal, "salinity"] = float("nan")
    if "depth" in clean_df.columns:
        bad_depth = clean_df["depth"].notna() & (
            (clean_df["depth"] < 0.0) | (clean_df["depth"] > 12000.0)
        )
        clean_df = clean_df[~bad_depth]
    # Drop rows that now have neither temperature nor salinity after masking
    clean_df = clean_df[clean_df["temperature"].notna() | clean_df["salinity"].notna()]
    n_after = len(clean_df)
    if n_before > n_after:
        print(f"  [!] Physical range filter removed {n_before - n_after} implausible rows from Argo data.")

    # Sort
    clean_df = clean_df.sort_values(by=["float_id", "timestamp", "depth"]).reset_index(drop=True)

    # Build positions DataFrame (latest position per float)
    latest_positions = []
    for float_id, group in clean_df.groupby("float_id"):
        # Latest timestamp in this float
        latest_time = group["timestamp"].max()
        latest_subset = group[group["timestamp"] == latest_time]
        first_row = latest_subset.iloc[0]

        latest_positions.append({
            "float_id": str(float_id),
            "latitude": round(float(first_row["latitude"]), 4),
            "longitude": round(float(first_row["longitude"]), 4),
            "timestamp": str(latest_time),
            "cycle_number": int(first_row["cycle_number"]),
            "min_depth": round(float(latest_subset["depth"].min()), 1),
            "max_depth": round(float(latest_subset["depth"].max()), 1),
            "total_profile_levels": len(latest_subset),
            "total_historical_records": len(group),
            "is_demo_data": bool(first_row.get("is_demo_data", False)),
        })

    positions_df = pd.DataFrame(latest_positions)
    return clean_df, positions_df


def save_json(data_records, output_path: Path):
    """Saves records as a formatted JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data_records, f, indent=2, default=str)
    size_kb = output_path.stat().st_size / 1024
    print(f"[+] Saved {len(data_records)} items to {output_path} ({size_kb:.1f} KB)")


def fetch_argo_pipeline(src: str = DEFAULT_SRC, days: int = DEFAULT_DAYS, fallback_to_demo: bool = True):
    """Runs the complete Argo retrieval and preprocessing pipeline."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days)
    start_str = start_dt.strftime("%Y-%m-%d")
    end_str = end_dt.strftime("%Y-%m-%d")

    print("\n" + "=" * 70)
    print("Initiating Argo Float Retrieval Pipeline")
    print(f"Data Source:       {src}")
    print(f"India EEZ Box:     Lon [{EEZ_BBOX['min_lon']}, {EEZ_BBOX['max_lon']}] | Lat [{EEZ_BBOX['min_lat']}, {EEZ_BBOX['max_lat']}]")
    print(f"Depth Range:       {DEFAULT_DEPTH_MIN}m to {DEFAULT_DEPTH_MAX}m")
    print(f"Date Range:        {start_str} to {end_str} ({days} days)")
    print("=" * 70)

    raw_df = None
    sources_to_try = [src]
    if src == "erddap":
        sources_to_try.append("argovis")
    elif src == "argovis":
        sources_to_try.append("erddap")

    for current_src in sources_to_try:
        try:
            # Try fetching standard physical data
            raw_df = fetch_from_argopy(current_src, start_str, end_str, mode="standard")
            if raw_df is not None and not raw_df.empty:
                print(f"[+] Successfully fetched {len(raw_df)} profile rows from '{current_src}'.")
                break
        except FileNotFoundError:
            print(f"[!] No profiles found on '{current_src}' for exact dates {start_str} to {end_str}.")
        except Exception as e:
            print(f"[!] Error fetching from '{current_src}': {e}")

    # If live fetch didn't return rows, fallback
    if raw_df is None or raw_df.empty:
        if fallback_to_demo:
            print("[*] Activating demonstration fallback to ensure frontend has live markers & depth profiles...")
            raw_df = generate_demonstration_argo_data()
        else:
            print("[-] No Argo profiles retrieved and demo fallback is disabled.")
            sys.exit(1)

    # Process and build clean dataframes
    profiles_df, positions_df = process_argo_dataframe(raw_df)

    if profiles_df.empty:
        print("[-] Processing failed: no valid profiles extracted.")
        sys.exit(1)

    # Round floats for compact JSON output
    profile_records = profiles_df.replace({float("nan"): None}).to_dict(orient="records")
    position_records = positions_df.replace({float("nan"): None}).to_dict(orient="records")

    # Save outputs
    save_json(profile_records, PROFILES_FILE)
    save_json(position_records, POSITIONS_FILE)

    # Print summary statistics
    unique_floats = positions_df["float_id"].nunique()
    total_points = len(profile_records)

    print("\n" + "=" * 70)
    print("Argo Float Pipeline Summary:")
    print(f"  Total Active Floats Found: {unique_floats}")
    print(f"  Total Profile Depth Points: {total_points}")
    print(f"  Profiles File:              {PROFILES_FILE}")
    print(f"  Latest Positions File:      {POSITIONS_FILE}")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Fetch Argo Float profiles for India EEZ")
    parser.add_argument("--src", default=DEFAULT_SRC, choices=["erddap", "argovis"], help="Primary argopy data source")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help="Number of past days (default: 90)")
    parser.add_argument("--no-demo-fallback", action="store_true", help="Disable demo fallback if remote API has 0 results")
    args = parser.parse_args()

    fetch_argo_pipeline(
        src=args.src,
        days=args.days,
        fallback_to_demo=not args.no_demo_fallback,
    )


if __name__ == "__main__":
    main()
