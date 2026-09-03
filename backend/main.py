"""
SIH26067 - India EEZ Ocean Visualization Backend API
FastAPI service to serve ocean model fields, Argo float profiles, and glider tracks.
"""

import os
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="SIH26067 – India EEZ Ocean Visualization API",
    description="Backend API serving 3D ocean model fields, Argo in-situ profiles, and glider tracks for India's EEZ.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for frontend origin
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins: List[str] = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
async def root():
    return {
        "project": "SIH26067 – India EEZ Ocean Visualization Platform",
        "status": "online",
        "documentation": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "service": "sih26067-eez-ocean-backend",
        "version": "0.1.0",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
