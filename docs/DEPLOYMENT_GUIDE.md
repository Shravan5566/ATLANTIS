# 🚀 Free Cloud Deployment Guide for Project ATLANTIS

This guide explains how to deploy Project ATLANTIS (3D India EEZ Ocean Visualization Platform) to a **100% free hosting platform** while guaranteeing **60 FPS** fluid globe motion.

---

## 🏆 Recommended Free Hosts Comparison

| Platform | Free Specs | Sleep / Spin-down? | Setup Difficulty | Best For |
|---|---|---|---|---|
| **Hugging Face Spaces** ⭐ *(Recommended)* | **16 GB RAM, 2 vCPUs**, 50 GB Storage | **No sleep** (Keeps running) | Extremely Easy (Git push) | Oceanographic 3D Models & 60 FPS globe |
| **Render.com** | 512 MB RAM, 0.1 CPU | Sleeps after 15m idle (takes ~45s to wake) | Easy (Connect GitHub) | Simple hobby deployments |
| **Koyeb** | 512 MB RAM, 0.1 CPU | Active free tier | Easy (Docker / GitHub) | Fast global edge routing |

---

## Option 1: Deploy on Hugging Face Spaces (Recommended — 100% Free & Fast)

Hugging Face Spaces provides a free **Docker Space** with 16 GB of RAM, which is ideal for geospatial NetCDF/JSON data delivery.

### Step 1: Create a Space
1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) and log in (or create a free account).
2. Click **Create new Space**.
3. Name your space (e.g. `atlantis-ocean-viz`).
4. Under **Space SDK**, select **Docker** -> **Blank**.
5. Set Space hardware to **Free CPU basic (2 vCPU · 16 GB RAM)**.
6. Set visibility to **Public** and click **Create Space**.

### Step 2: Push Repository to your Space
In your terminal, connect the repository to your Hugging Face Space:

```bash
# Add Hugging Face remote (replace USERNAME and SPACE_NAME with yours)
git remote add hf https://huggingface.co/spaces/USERNAME/SPACE_NAME

# Push code to Hugging Face
git add -A
git commit -m "Deploy ATLANTIS unified production container"
git push hf main --force
```

*Hugging Face will automatically build the `Dockerfile` and give you a live HTTPS link (e.g. `https://USERNAME-SPACE_NAME.hf.space`) where your 3D globe runs at 60 FPS.*

---

## Option 2: Deploy on Render (Free Web Service)

Render automatically builds and runs the `Dockerfile` directly from your GitHub repository.

### Step 1: Push Code to GitHub
```bash
git add -A
git commit -m "Setup unified Docker deployment for Render"
git push origin main
```

### Step 2: Create Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) and log in.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Render will auto-detect the `Dockerfile` (or use the included `render.yaml`).
5. Choose the **Free** instance type.
6. Click **Deploy Web Service**.

*Once build finishes (~3 minutes), your app will be accessible at `https://your-service-name.onrender.com`.*

---

## ⚡ How 60 FPS Performance is Guaranteed

1. **Hardware Acceleration**: CesiumJS uses WebGL directly on the client's GPU.
2. **Unified Single-Origin**: Frontend and backend run on the same origin, eliminating CORS preflight delays.
3. **Static Caching**: Assets (`/cesium/*`, GeoJSON boundaries, and Next.js chunks) are served with `Cache-Control: public, max-age=31536000, immutable`.
4. **Tile Slicing**: 2D/3D depth fields are served as compact, pre-computed JSON tiles with in-memory caching and gzip compression.
