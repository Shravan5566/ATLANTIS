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

# Copernicus Marine 3D physics datasets (Operational NRT 0.083° daily):
DATASETS_NRT_3D = {
    "thetao": "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
    "so": "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
    "cur": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
}
DATASET_MULTIYEAR = "cmems_mod_glo_phy_my_0.083deg_P1D-m"


def verify_credentials() -> tuple[str, str]:
    """Retrieves Copernicus credentials from environment variables.

    SECURITY: Credentials come only from environment variables — never from
    hardcoded values, command-line arguments, or config files checked into git.

    WARNING: Do NOT set LOG_LEVEL=DEBUG when running in CI/CD environments.
    The copernicusmarine library may log credentials at DEBUG level if the
    underlying requests session is instrumented. Always use INFO or WARNING
    in automated pipelines.
    """
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
        print("   COPERNICUS_PASSWORD=<set in environment, never printed>")
        print("=" * 70 + "\n")
        sys.exit(1)

    # Confirm credentials were found without echoing the actual password
    masked = f"{username[:3]}***" if len(username) > 3 else "***"
    print(f"[+] Copernicus credentials loaded for user: {masked}")

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

            time_coord = next((c for c in ["time", "valid_time"] if c in ds.coords), None)
            depth_coord = next((c for c in ["depth", "lev"] if c in ds.coords), None)

            if time_coord:
                times = ds[time_coord].values
                print(f"  Time Range: {times[0]} to {times[-1]} ({len(times)} timesteps)")
            if depth_coord:
                depths = ds[depth_coord].values
                print(f"  Depth Levels: {len(depths)} levels from {depths[0]:.1f}m to {depths[-1]:.1f}m")
            if "latitude" in ds.coords and "longitude" in ds.coords:
                print(f"  Latitude: {ds.latitude.values.min():.2f}°N to {ds.latitude.values.max():.2f}°N")
                print(f"  Longitude: {ds.longitude.values.min():.2f}°E to {ds.longitude.values.max():.2f}°E")

            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            print(f"  File size on disk: {file_size_mb:.2f} MB")
        print("=" * 70 + "\n")

    except Exception as e:
        print(f"[!] Warning reading dataset summary: {e}")


def fetch_copernicus_data(
    days: int = 5,
    min_depth: float = 0.5,
    max_depth: float = 500.0,
    dataset: str = "nrt",
):
    """Downloads Copernicus Marine 3D physics data for India's EEZ."""
    username, password = verify_credentials()

    try:
        import copernicusmarine
        import xarray as xr
    except ImportError:
        print("[-] ERROR: 'copernicusmarine' or 'xarray' package is not installed.")
        sys.exit(1)

    RAW_DIR.mkdir(parents=True, exist_ok=True)

    # Time range: past N days
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days)
    start_str = start_dt.strftime("%Y-%m-%dT00:00:00")
    end_str = end_dt.strftime("%Y-%m-%dT00:00:00")

    print("\n" + "=" * 70)
    print("Initiating Copernicus Marine 3D Physics Subset Download")
    print(f"India EEZ Box: Lon [{EEZ_BBOX['min_lon']}, {EEZ_BBOX['max_lon']}] | Lat [{EEZ_BBOX['min_lat']}, {EEZ_BBOX['max_lat']}]")
    print(f"Depth Range:   {min_depth}m to {max_depth}m")
    print(f"Time Range:    {start_str} -> {end_str} ({days} days)")
    print(f"Output File:   {OUTPUT_FILE}")
    print("=" * 70)

    try:
        print("[*] Authenticating with Copernicus Marine Service...")
        copernicusmarine.login(username=username, password=password)

        if dataset.lower() == "multiyear":
            print(f"[*] Downloading multiyear dataset: {DATASET_MULTIYEAR}...")
            copernicusmarine.subset(
                dataset_id=DATASET_MULTIYEAR,
                variables=["thetao", "so", "uo", "vo"],
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
                overwrite=True,
            )
        else:
            # Download 3D NRT variables and merge
            temp_files = []
            queries = [
                ("thetao", DATASETS_NRT_3D["thetao"], ["thetao"]),
                ("so", DATASETS_NRT_3D["so"], ["so"]),
                ("cur", DATASETS_NRT_3D["cur"], ["uo", "vo"]),
            ]

            for label, ds_id, vars_to_fetch in queries:
                out_name = f"temp_{label}.nc"
                print(f"[*] Fetching 3D {label.upper()} ({', '.join(vars_to_fetch)}) from {ds_id}...")
                copernicusmarine.subset(
                    dataset_id=ds_id,
                    variables=vars_to_fetch,
                    minimum_longitude=EEZ_BBOX["min_lon"],
                    maximum_longitude=EEZ_BBOX["max_lon"],
                    minimum_latitude=EEZ_BBOX["min_lat"],
                    maximum_latitude=EEZ_BBOX["max_lat"],
                    start_datetime=start_str,
                    end_datetime=end_str,
                    minimum_depth=min_depth,
                    maximum_depth=max_depth,
                    output_filename=out_name,
                    output_directory=str(RAW_DIR),
                    username=username,
                    password=password,
                    overwrite=True,
                )
                temp_files.append(RAW_DIR / out_name)

            print("[*] Merging downloaded 3D physical fields into unified NetCDF...")
            datasets = [xr.open_dataset(f) for f in temp_files]
            merged_ds = xr.merge(datasets)
            merged_ds.to_netcdf(OUTPUT_FILE)

            # Close and clean temporary files
            for ds in datasets:
                ds.close()
            for f in temp_files:
                try:
                    f.unlink()
                except Exception:
                    pass

        if OUTPUT_FILE.exists() and OUTPUT_FILE.stat().st_size > 0:
            summarize_dataset(OUTPUT_FILE)
        else:
            print(f"[-] Output file was not found at {OUTPUT_FILE}")

    except Exception as err:
        print(f"\n[-] Copernicus Marine error occurred: {err}")
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
