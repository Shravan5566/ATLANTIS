"""
build_tiles.py
Reads raw NetCDF data from /data-pipeline/raw/copernicus_eez.nc and produces:
1. Sliced JSON tiles per variable, time_index, and depth_index
2. tiles/manifest.json containing bounding box, depth levels, timesteps, and min/max value ranges
"""


def main():
    print("Initializing tile generation pipeline...")


if __name__ == "__main__":
    main()
