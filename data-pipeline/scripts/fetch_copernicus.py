"""
fetch_copernicus.py - SIH26067 India EEZ Ocean Visualization Pipeline

Subsets and downloads Copernicus Marine ocean model fields:
- Bounding Box: Longitude 68°E to 90°E, Latitude 6°N to 25°N (India EEZ: Arabian Sea + Bay of Bengal)
- Depth Range: 0 to 1000 meters
- Variables: thetao (sea water potential temperature, °C), so (sea water salinity, psu),
             uo (eastward sea water velocity, m/s), vo (northward sea water velocity, m/s)
- Output: /data-pipeline/raw/copernicus_eez.nc
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

# Find project root directory and load .env from backend or root
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PIPELINE_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = DATA_PIPELINE_DIR.parent
RAW_DIR = DATA_PIPELINE_DIR / "raw"
OUTPUT_FILE = RAW_DIR / "copernicus_eez.nc"

# Load environment variables (check both backend/.env and root .env)
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

# Bounding box for India's Exclusive Economic Zone (EEZ)
EEZ_BBOX = {
    "min_lon": 68.0,
    "max_lon": 90.0,
    "min_lat": 6.0,
    "max_lat": 25.0,
}

# Default candidate datasets:
# NRT Analysis/Forecast (near-real-time, covers last 10 days up to present):
DATASET_NRT = "cmems_mod_glo_phy_anfc_0.083deg_P1D-m"
# Multiyear Reanalysis (climatological / historic):
DATASET_MULTIYEAR = "cmems_mod_glo_phy_my_0.083deg_P1D-m"
DATASET_LEGACY = "GLOBAL_MULTIYEAR_PHY_001_030"

VARIABLES = ["thetao", "so", "uo", "vo"]


def verify_credentials() -> tuple[str, str]:
    """Retrieves Copernicus credentials from environment variables."""
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")

    if not username or not password or "your_" in username:
        print("\n" + "=" * 70)
        print("[-] ERROR: Missing or placeholder Copernicus Marine credentials!")
        print("=" * 70)
        print("To fetch live ocean model fields from Copernicus Marine Service:")
        print("1. Register a free account at: https://data.marine.copernicus.eu")
        print("2. Set your credentials in backend/.env or root .env:")
        print("   COPERNICUS_USERNAME=your_actual_username")
        print("   COPERNICUS_PASSWORD=your_actual_password")
        print("=" * 70 + "\n")
        sys.exit(1)

    return username, password


def summarize_dataset(file_path: Path):
    """Opens and prints summary of downloaded NetCDF file using xarray."""
    try:
        import xarray as xr

        print("\n" + "=" * 70)
        print(f"[+] Successfully saved NetCDF to: {file_path}")
        print("=" * 70)

        with xr.open_dataset(file_path) as ds:
            print("\nDataset Summary:")
            print(f"  Dimensions: {dict(ds.dims)}")
            print(f"  Coordinates: {list(ds.coords.keys())}")
            print(f"  Variables: {list(ds.data_vars.keys())}")

            if "time" in ds.coords:
                times = ds["time"].values
                print(f"  Time Range: {times[0]} to {times[-1]} ({len(times)} timesteps)")
            if "depth" in ds.coords:
                depths = ds["depth"].values
                print(f"  Depth Levels: {len(depths)} levels from {depths[0]:.1f}m to {depths[-1]:.1f}m")
            if "latitude" in ds.coords and "longitude" in ds.coords:
                print(f"  Latitude: {ds.latitude.values.min():.2f}°N to {ds.latitude.values.max():.2f}°N")
                print(f"  Longitude: {ds.longitude.values.min():.2f}°E to {ds.longitude.values.max():.2f}°E")

            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            print(f"  File size on disk: {file_size_mb:.2f} MB")
        print("=" * 70 + "\n")

    except ImportError:
        print(f"[!] xarray not installed. File saved ({file_path.stat().st_size / 1024:.1f} KB).")
    except Exception as e:
        print(f"[!] Warning reading dataset summary: {e}")


def fetch_copernicus_data(
    dataset_id: str = DATASET_NRT,
    days: int = 10,
    min_depth: float = 0.0,
    max_depth: float = 1000.0,
):
    """Downloads a subset of Copernicus Marine ocean physics data."""
    username, password = verify_credentials()

    try:
        import copernicusmarine
    except ImportError:
        print("[-] ERROR: 'copernicusmarine' package is not installed.")
        print("    Install it via: pip install copernicusmarine")
        sys.exit(1)

    RAW_DIR.mkdir(parents=True, exist_ok=True)

    # Time range: past N days up to yesterday/today
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days)
    start_str = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

    print("\n" + "-" * 70)
    print("Initiating Copernicus Marine Subset Download")
    print(f"Dataset ID:       {dataset_id}")
    print(f"India EEZ Box:    Lon [{EEZ_BBOX['min_lon']}, {EEZ_BBOX['max_lon']}] | Lat [{EEZ_BBOX['min_lat']}, {EEZ_BBOX['max_lat']}]")
    print(f"Depth Range:      {min_depth}m to {max_depth}m")
    print(f"Time Range:       {start_str} -> {end_str} ({days} days)")
    print(f"Variables:        {', '.join(VARIABLES)}")
    print(f"Target file:      {OUTPUT_FILE}")
    print("-" * 70)

    try:
        # Check login / authentication
        print("[*] Authenticating with Copernicus Marine Service...")
        copernicusmarine.login(
            username=username,
            password=password,
            skip_if_user_already_logged=True,
        )

        print("[*] Requesting subset from Copernicus Marine API...")
        # Subset and write to raw/copernicus_eez.nc
        copernicusmarine.subset(
            dataset_id=dataset_id,
            variables=VARIABLES,
            minimum_longitude=EEZ_BBOX["min_lon"],
            maximum_longitude=EEZ_BBOX["max_lon"],
            minimum_latitude=EEZ_BBOX["min_lat"],
            maximum_latitude=EEZ_BBOX["max_lat"],
            start_datetime=start_str,
            end_datetime=end_str,
            minimum_depth=min_depth,
            maximum_depth=max_depth,
            output_filename="copernicus_eez.nc",
            output_directory=str(RAW_DIR),
            username=username,
            password=password,
            overwrite_output_data=True,
        )

        if OUTPUT_FILE.exists() and OUTPUT_FILE.stat().st_size > 0:
            summarize_dataset(OUTPUT_FILE)
        else:
            print(f"[-] Download finished, but output file was not found at {OUTPUT_FILE}")

    except Exception as err:
        err_msg = str(err)
        print(f"\n[-] Copernicus Marine error occurred: {err_msg}")

        # Check for common issues and provide clear guidance
        if "401" in err_msg or "Unauthorized" in err_msg or "credential" in err_msg.lower():
            print("[!] Authentication failed: Please verify your Copernicus username and password in .env")
        elif "No data found" in err_msg or "empty" in err_msg.lower() or "coordinates" in err_msg.lower():
            print(f"[!] No data found for dataset '{dataset_id}' in the requested time range ({start_str} to {end_str}).")
            if dataset_id == DATASET_NRT:
                print(f"[!] Tip: Try multiyear dataset '{DATASET_MULTIYEAR}' for historical dates, or check available dates.")
        else:
            print("[!] Tip: Verify network connection and dataset availability on data.marine.copernicus.eu")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Fetch Copernicus Marine ocean model data for India EEZ")
    parser.add_argument("--dataset", default=DATASET_NRT, help=f"Copernicus dataset ID (default: {DATASET_NRT})")
    parser.add_argument("--days", type=int, default=10, help="Number of recent days to subset (default: 10)")
    parser.add_argument("--min-depth", type=float, default=0.0, help="Minimum depth in meters (default: 0)")
    parser.add_argument("--max-depth", type=float, default=1000.0, help="Maximum depth in meters (default: 1000)")
    args = parser.parse_args()

    fetch_copernicus_data(
        dataset_id=args.dataset,
        days=args.days,
        min_depth=args.min_depth,
        max_depth=args.max_depth,
    )


if __name__ == "__main__":
    main()
