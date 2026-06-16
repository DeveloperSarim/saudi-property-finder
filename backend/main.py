"""
Saudi Property Aggregator — FastAPI backend
Entry point: creates app, wires CORS, includes property and broker routers.
"""
from __future__ import annotations
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from property_scraper import router as property_router
from broker_scraper import router as broker_router

app = FastAPI(title="Saudi Property Aggregator", version="2.0.0")

# Allow frontend origin (set CORS_ORIGINS env var in Railway dashboard)
# e.g. CORS_ORIGINS=https://your-app.vercel.app
_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in _origins_env.split(",")] if _origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(property_router)
app.include_router(broker_router)

# ── Mangum handler (only needed if deploying to AWS Lambda / Vercel) ──────────
# Uncomment below ONLY if deploying to a Lambda-based platform:
# try:
#     from mangum import Mangum
#     handler = Mangum(app, lifespan="off")
# except ImportError:
#     handler = app

