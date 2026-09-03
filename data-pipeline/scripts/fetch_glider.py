"""
fetch_glider.py - SIH26067 India EEZ Ocean Visualization Pipeline

Fetches ocean glider track data for the India EEZ region (68°–90°E, 6°–25°N) from Ifremer.

Architecture & Paths:
1. Primary Path (Real In-EEZ Data):
   - Queries Ifremer's Glider ERDDAP server (https://erddap.ifremer.fr/erddap)
   - Dataset: OceanGlidersGDACTrajectories
   - Identifies active/archived glider missions whose trajectories intersect India's EEZ.
   - Downloads depth-resolved lat, lon, time, depth (PRES), temperature (TEMP), and salinity (PSAL).
   - Subsamples points to maintain high visual fidelity and 60 FPS browser rendering.
   - Labels track with "demo_glider_outside_eez": false.

2. Fallback Path (Demonstration Outside EEZ):
   - If no gliders are found in the EEZ or remote servers are temporarily unreachable,
     fetches/generates a representative glider mission to verify the end-to-end pipeline.
   - Labels track with "demo_glider_outside_eez": true so the frontend can display a clear badge:
     "Shown for demonstration — no active gliders in EEZ at this time".

Output:
- /data-pipeline/processed/glider_tracks.json
  Array of { glider_id, demo_glider_outside_eez, points: [{ lat, lon, time, depth, temperature, salinity }] }
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import certifi
import numpy as np
import pandas as pd
import requests

# Set SSL Certificate paths for Windows Python environments
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

# Paths setup
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PIPELINE_DIR = SCRIPT_DIR.parent
PROCESSED_DIR = DATA_PIPELINE_DIR / "processed"
OUTPUT_FILE = PROCESSED_DIR / "glider_tracks.json"

# ERDDAP Configuration
ERDDAP_BASE = "https://erddap.ifremer.fr/erddap"
DATASET_ID = "OceanGlidersGDACTrajectories"

# India EEZ bounding box (Arabian Sea & Bay of Bengal)
EEZ_BBOX = {
    "min_lon": 68.0,
    "max_lon": 90.0,
    "min_lat": 6.0,
    "max_lat": 25.0,
}

MAX_POINTS_PER_TRACK = 600  # Optimal for 3D Cesium polylines & depth profiles


def search_eez_gliders(timeout: int = 30) -> list[str]:
    """Queries Ifremer ERDDAP for distinct glider deployments in the India EEZ box."""
    print(f"[*] Searching Ifremer ERDDAP ({DATASET_ID}) for gliders in India's EEZ...")
    url = (
        f"{ERDDAP_BASE}/tabledap/{DATASET_ID}.json"
        f"?platform_deployment"
        f"&longitude>={EEZ_BBOX['min_lon']}&longitude<={EEZ_BBOX['max_lon']}"
        f"&latitude>={EEZ_BBOX['min_lat']}&latitude<={EEZ_BBOX['max_lat']}"
        f"&distinct()"
    )

    try:
        resp = requests.get(url, verify=certifi.where(), timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            rows = data.get("table", {}).get("rows", [])
            glider_ids = [row[0] for row in rows if row and row[0]]
            return glider_ids
        elif resp.status_code == 404:
            print("[!] No gliders found within the exact EEZ bounding box.")
            return []
        else:
            print(f"[!] ERDDAP search returned status code {resp.status_code}: {resp.text[:150]}")
            return []
    except Exception as exc:
        print(f"[!] Could not query Ifremer ERDDAP: {exc}")
        return []


def fetch_glider_track_erddap(glider_id: str, timeout: int = 45) -> dict | None:
    """Downloads track coordinates and physical properties for a specific glider."""
    print(f"[*] Downloading trajectory data for glider: '{glider_id}'...")
    url = (
        f"{ERDDAP_BASE}/tabledap/{DATASET_ID}.json"
        f"?platform_deployment,time,latitude,longitude,PRES,TEMP,PSAL"
        f"&platform_deployment=%22{glider_id}%22"
    )

    try:
        resp = requests.get(url, verify=certifi.where(), timeout=timeout)
        if resp.status_code != 200:
            print(f"[!] Failed to fetch glider '{glider_id}' (Status {resp.status_code})")
            return None

        data = resp.json().get("table", {})
        rows = data.get("rows", [])
        if not rows:
            return None

        # Columns: [platform_deployment, time, latitude, longitude, PRES, TEMP, PSAL]
        df = pd.DataFrame(rows, columns=["id", "time", "lat", "lon", "pres", "temp", "psal"])

        # Filter invalid positions
        df = df.dropna(subset=["lat", "lon", "time"])
        df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
        df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
        df["pres"] = pd.to_numeric(df["pres"], errors="coerce")
        df["temp"] = pd.to_numeric(df["temp"], errors="coerce")
        df["psal"] = pd.to_numeric(df["psal"], errors="coerce")

        total_points = len(df)
        if total_points == 0:
            return None

        # Subsample to keep Cesium rendering smooth and file sizes compact
        if total_points > MAX_POINTS_PER_TRACK:
            step = int(np.ceil(total_points / MAX_POINTS_PER_TRACK))
            df_sampled = df.iloc[::step].copy()
        else:
            df_sampled = df.copy()

        points = []
        for _, row in df_sampled.iterrows():
            points.append({
                "lat": round(float(row["lat"]), 5),
                "lon": round(float(row["lon"]), 5),
                "time": str(row["time"]),
                "depth": round(float(row["pres"]), 1) if pd.notna(row["pres"]) else 0.0,
                "temperature": round(float(row["temp"]), 2) if pd.notna(row["temp"]) else None,
                "salinity": round(float(row["psal"]), 2) if pd.notna(row["psal"]) else None,
            })

        return {
            "glider_id": str(glider_id),
            "demo_glider_outside_eez": False,
            "total_raw_points": total_points,
            "sampled_points": len(points),
            "time_start": points[0]["time"] if points else None,
            "time_end": points[-1]["time"] if points else None,
            "points": points,
        }

    except Exception as exc:
        print(f"[!] Error fetching track for '{glider_id}': {exc}")
        return None


def fetch_fallback_glider() -> dict:
    """Fallback: Generates a representative glider mission clearly labeled

    as outside EEZ for end-to-end frontend pipeline demonstration.
    """
    print("[*] Generating representative demonstration glider dataset (tagged 'demo_glider_outside_eez': true)...")
    base_time = datetime(2025, 4, 15, 6, 0, tzinfo=timezone.utc)
    glider_id = "Demo_Glider_Coriolis_01"

    # Representative track in the Equatorial Indian Ocean
    lats = np.linspace(3.5, 5.8, 120)
    lons = np.linspace(76.2, 79.5, 120)

    points = []
    for i, (lat, lon) in enumerate(zip(lats, lons)):
        t = base_time + np.timedelta64(i * 3, "h")
        # Sawtooth yo-yo diving profile (0 to 600m)
        cycle_phase = (i % 20) / 20.0
        depth = 600.0 * (2.0 * cycle_phase if cycle_phase <= 0.5 else 2.0 * (1.0 - cycle_phase))
        temp = 28.5 - 24.0 * (1.0 - np.exp(-depth / 250.0)) + float(np.random.normal(0, 0.1))
        sal = 35.1 + 0.6 * (1.0 - np.exp(-depth / 180.0))

        points.append({
            "lat": round(float(lat), 5),
            "lon": round(float(lon), 5),
            "time": pd.to_datetime(t).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "depth": round(float(depth), 1),
            "temperature": round(float(temp), 2),
            "salinity": round(float(sal), 2),
        })

    return {
        "glider_id": glider_id,
        "demo_glider_outside_eez": True,
        "total_raw_points": len(points),
        "sampled_points": len(points),
        "time_start": points[0]["time"],
        "time_end": points[-1]["time"],
        "points": points,
    }


def run_glider_pipeline(limit_gliders: int = 3, force_demo: bool = False):
    """Executes the complete glider data pipeline."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    print("\n" + "=" * 70)
    print("Initiating Glider Data Ingestion Pipeline")
    print(f"Bounding Box:     Lon [{EEZ_BBOX['min_lon']}, {EEZ_BBOX['max_lon']}] | Lat [{EEZ_BBOX['min_lat']}, {EEZ_BBOX['max_lat']}]")
    print(f"Max Points/Track: {MAX_POINTS_PER_TRACK}")
    print(f"Output File:      {OUTPUT_FILE}")
    print("=" * 70)

    glider_tracks = []

    if not force_demo:
        # Step 1: Search for gliders in India's EEZ
        matching_ids = search_eez_gliders()
        print(f"[+] Found {len(matching_ids)} gliders in India EEZ: {matching_ids}")

        # Step 2: Fetch tracks for matching gliders (up to limit)
        for gid in matching_ids[:limit_gliders]:
            track_data = fetch_glider_track_erddap(gid)
            if track_data and track_data.get("points"):
                glider_tracks.append(track_data)

    # Step 3: Fallback if no tracks were obtained
    if not glider_tracks:
        print("[!] Activating fallback path: Fetching representative demonstration glider...")
        fallback_track = fetch_fallback_glider()
        glider_tracks.append(fallback_track)

    # Save to JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(glider_tracks, f, indent=2)

    file_size_kb = OUTPUT_FILE.stat().st_size / 1024
    total_points = sum(len(t["points"]) for t in glider_tracks)

    print("\n" + "=" * 70)
    print("Glider Ingestion Summary:")
    print(f"  Total Glider Missions Saved: {len(glider_tracks)}")
    print(f"  Total Trajectory Points:     {total_points}")
    print(f"  Demo Fallback Flag:          {any(t.get('demo_glider_outside_eez') for t in glider_tracks)}")
    print(f"  Output File:                 {OUTPUT_FILE} ({file_size_kb:.1f} KB)")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Fetch glider track data for India EEZ")
    parser.add_argument("--limit", type=int, default=3, help="Max number of gliders to download (default: 3)")
    parser.add_argument("--force-demo", action="store_true", help="Force demo fallback mode for testing")
    args = parser.parse_args()

    run_glider_pipeline(limit_gliders=args.limit, force_demo=args.force_demo)


if __name__ == "__main__":
    main()
