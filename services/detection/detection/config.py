from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
AREA_CRS = os.environ.get("AREA_CRS", "EPSG:3405")
WEB_CRS = "EPSG:4326"
LEGAL_LAND_CODES = tuple(
    c.strip().upper()
    for c in os.environ.get("LEGAL_LAND_CODES", "ODT,ONT").split(",")
    if c.strip()
)
MIN_VIOLATION_M2 = float(os.environ.get("MIN_VIOLATION_M2", "5"))
NEGATIVE_BUFFER_M = float(os.environ.get("NEGATIVE_BUFFER_M", "0.4"))
MIN_BUILDING_M2 = float(os.environ.get("MIN_BUILDING_M2", "12"))
TILE_SIZE = int(os.environ.get("TILE_SIZE", "640"))
TILE_OVERLAP = int(os.environ.get("TILE_OVERLAP", "64"))
CONF_THRESHOLD = float(os.environ.get("CONF_THRESHOLD", "0.35"))
MODEL_PATH = Path(os.environ.get("MODEL_PATH", str(ROOT / "models" / "yolo11-seg-buildings.onnx")))
COG_DIR = Path(os.environ.get("COG_DIR", str(ROOT.parents[1] / "data" / "cog")))
POSTGIS_DSN = os.environ.get(
    "POSTGIS_DSN",
    "postgresql://quyhoach:quyhoach@localhost:5432/quyhoach_gis",
)
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "quyhoach")
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "10"))
SAMPLE_PARCELS = ROOT / "data" / "sample_parcels.geojson"
