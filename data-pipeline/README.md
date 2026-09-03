# Data Pipeline Guide & Copernicus Marine Setup

This directory manages the ingestion and preprocessing of ocean model fields and in-situ observational datasets for India's Exclusive Economic Zone (EEZ: 68°E–90°E, 6°N–25°N).

---

## 🔑 Getting Free Copernicus Marine Credentials

To download real ocean numerical model fields (`thetao`, `so`, `uo`, `vo`) from the European Copernicus Marine Service:

1. **Register for free** at [https://data.marine.copernicus.eu](https://data.marine.copernicus.eu).
2. Click **Register** (top right) and create an account. You will receive an activation email.
3. Once your account is active, your credentials are:
   - **Username**: Your Copernicus username (or registered email)
   - **Password**: Your chosen password
4. Add your credentials to `backend/.env` (or a root `.env`):
   ```env
   COPERNICUS_USERNAME=your_actual_username
   COPERNICUS_PASSWORD=your_actual_password
   ```

---

## 🚀 Running the Copernicus Fetch Script

With your virtual environment active:

```bash
# Run with default settings (NRT dataset, last 10 days, 0-1000m depth)
python data-pipeline/scripts/fetch_copernicus.py

# Optional: Specify parameters
python data-pipeline/scripts/fetch_copernicus.py --days 15 --max-depth 500

# Optional: Use multiyear reanalysis dataset
python data-pipeline/scripts/fetch_copernicus.py --dataset cmems_mod_glo_phy_my_0.083deg_P1D-m
```

The script will:
- Authenticate with the Copernicus Marine API
- Subset the India EEZ region (68°–90°E, 6°–25°N)
- Save the resulting NetCDF file directly to `data-pipeline/raw/copernicus_eez.nc`
- Print an `xarray` dataset summary showing dimensions, variables, and depth levels.
