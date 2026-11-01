"""Distinguish roofs on Esri satellite imagery from cadastral parcels.

Only roofs that intersect a real ThuaDat parcel are kept. The downtown hole
with no parcels produces no points.
"""
from __future__ import annotations

import math
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

import cv2
import numpy as np
from PIL import Image
from pymongo import MongoClient
from shapely.geometry import Polygon, mapping

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "detection"))

from detection.pipeline.overlay import overlay_shapely  # noqa: E402
from detection.pipeline.sync_mongo import now_utc, write_violations  # noqa: E402

# Cadastral zone around the default Cao Lanh view. The city core east of this
# has no ThuaDat, so houses there are not marked.
WEST, SOUTH, EAST, NORTH = 105.575, 10.425, 105.665, 10.485
ZOOM = 18
MIN_AREA_M2 = 40.0
TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


def _tile_xy(lon: float, lat: float, z: int) -> tuple[float, float]:
    n = 2**z
    x = (lon + 180.0) / 360.0 * n
    lat_rad = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return x, y


def _lonlat_of_pixel(col: float, row: float, x0: int, y0: int, z: int) -> tuple[float, float]:
    n = 2**z
    gx = x0 + col / 256.0
    gy = y0 + row / 256.0
    lon = gx / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * gy / n))))
    return lon, lat


def _tile_range(bbox: tuple[float, float, float, float], z: int) -> tuple[int, int, int, int]:
    minx, miny, maxx, maxy = bbox
    x1, y_north = _tile_xy(minx, maxy, z)
    x2, y_south = _tile_xy(maxx, miny, z)
    return int(math.floor(x1)), int(math.floor(x2)), int(math.floor(y_north)), int(math.floor(y_south))


def _download_tile(z: int, tx: int, ty: int, cache: Path) -> None:
    path = cache / f"{z}_{tx}_{ty}.jpg"
    if path.exists() and path.stat().st_size > 0:
        return
    url = TILE.format(z=z, y=ty, x=tx)
    req = Request(url, headers={"User-Agent": "QuyHoachAI/1.0"})
    try:
        with urlopen(req, timeout=40) as resp:
            data = resp.read()
    except Exception as exc:
        print("tile fail", z, tx, ty, exc)
        return
    path.write_bytes(data)


def fetch_mosaic(
    bbox: tuple[float, float, float, float], z: int, cache: Path
) -> tuple[np.ndarray, int, int]:
    tx0, tx1, ty0, ty1 = _tile_range(bbox, z)
    cols = tx1 - tx0 + 1
    rows = ty1 - ty0 + 1
    mosaic = np.zeros((rows * 256, cols * 256, 3), dtype=np.uint8)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            path = cache / f"{z}_{tx}_{ty}.jpg"
            if not path.exists() or path.stat().st_size < 4000:
                continue
            tile = np.asarray(Image.open(path).convert("RGB"))
            if tile.shape[0] < 256 or tile.shape[1] < 256:
                continue
            r = (ty - ty0) * 256
            c = (tx - tx0) * 256
            mosaic[r : r + 256, c : c + 256] = tile[:256, :256]
    return mosaic, tx0, ty0


def iter_windows() -> list[tuple[float, float, float, float]]:
    step = 0.016
    overlap = 0.0012
    windows = []
    x = WEST
    while x < EAST - 1e-9:
        y = SOUTH
        while y < NORTH - 1e-9:
            windows.append((x, y, min(x + step + overlap, EAST), min(y + step + overlap, NORTH)))
            y += step
        x += step
    return windows


def roof_mask(rgb: np.ndarray) -> np.ndarray:
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    bright = np.maximum(np.maximum(red, green), blue)
    dark = np.minimum(np.minimum(red, green), blue)
    vegetation = (green > red + 12) & (green > blue + 8)
    grey_roof = (bright > 145) & (bright - dark < 40) & ~vegetation
    red_roof = (red > 155) & (red > green + 28) & (red > blue + 28) & (green > 70)
    blue_roof = (blue > 130) & (blue > red + 18) & (blue > green + 12) & (red > 80)
    mask = (grey_roof | red_roof | blue_roof).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask


def roofs_from_mask(mask: np.ndarray, x0: int, y0: int, z: int) -> list[dict]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    m_per_px = 156543.03392 * math.cos(math.radians(10.46)) / (2**z)
    min_px = 20 / (m_per_px * m_per_px)
    max_px = 2500 / (m_per_px * m_per_px)
    feats = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_px or area > max_px:
            continue
        hull = cv2.convexHull(contour)
        hull_area = cv2.contourArea(hull)
        if hull_area <= 0 or area / hull_area < 0.55:
            continue
        rect = cv2.minAreaRect(contour)
        w, h = rect[1]
        short, long = sorted((max(w, 1.0), max(h, 1.0)))
        if short / long < 0.28:
            continue
        epsilon = 1.5
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) < 3:
            continue
        ring = []
        for pt in approx[:, 0, :]:
            lon, lat = _lonlat_of_pixel(float(pt[0]), float(pt[1]), x0, y0, z)
            ring.append([lon, lat])
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        poly = Polygon(ring).buffer(0)
        if poly.is_empty or poly.geom_type != "Polygon":
            continue
        feats.append(
            {
                "type": "Feature",
                "properties": {"confidence": 0.62, "source": "satellite-rgb", "tag": "roof"},
                "geometry": mapping(poly),
            }
        )
    return feats


def parcels_in(bbox: tuple[float, float, float, float]) -> list[dict]:
    minx, miny, maxx, maxy = bbox
    db = MongoClient("mongodb://127.0.0.1:27017").quyhoach
    query = {
        "geometry": {
            "$geoIntersects": {
                "$geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [minx, miny],
                        [maxx, miny],
                        [maxx, maxy],
                        [minx, maxy],
                        [minx, miny],
                    ]],
                }
            }
        }
    }
    feats = []
    for doc in db.parcels.find(query, {"_id": 0}):
        if not doc.get("geometry"):
            continue
        feats.append({"type": "Feature", "properties": doc, "geometry": doc["geometry"]})
    return feats


def main() -> None:
    from shapely.geometry import Point, shape

    region = (WEST, SOUTH, EAST, NORTH)
    cache = ROOT / "scripts" / "_sat_cache"
    cache.mkdir(parents=True, exist_ok=True)
    tx0, tx1, ty0, ty1 = _tile_range(region, ZOOM)
    tiles = [(ZOOM, tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    print("tiles", len(tiles), "windows", len(iter_windows()))
    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(lambda item: _download_tile(*item, cache), tiles))

    kept = []
    seen = set()
    roofs_for_save = []
    for index, bbox in enumerate(iter_windows(), start=1):
        parcels = parcels_in(bbox)
        if not parcels:
            print("window", index, "no parcels", bbox)
            continue
        image, x0, y0 = fetch_mosaic(bbox, ZOOM, cache)
        roofs = roofs_from_mask(roof_mask(image), x0, y0, ZOOM)
        violations = overlay_shapely(roofs, parcels)
        fresh = []
        for violation in violations:
            if violation.get("rule_id") != "SAI_MDSD":
                continue
            if float(violation.get("area_m2") or 0) < MIN_AREA_M2:
                continue
            key = (
                round(float(violation["longitude"]), 4),
                round(float(violation["latitude"]), 4),
                str(violation.get("parcel_id")),
            )
            if key in seen:
                continue
            seen.add(key)
            kept.append(violation)
            fresh.append(violation)
        if fresh:
            for roof in roofs:
                poly = shape(roof["geometry"])
                if any(poly.covers(Point(v["longitude"], v["latitude"])) for v in fresh):
                    roofs_for_save.append(roof)
        print("window", index, "parcels", len(parcels), "roofs", len(roofs), "kept", len(fresh), "total", len(kept))

    mission = {
        "id": str(uuid.uuid4()),
        "flight_date": "2026-11-01",
        "area_name": "Ảnh vệ tinh Esri — vùng địa chính Cao Lãnh",
        "status": "done",
    }
    db = MongoClient("mongodb://127.0.0.1:27017").quyhoach
    old_ids = [job["id"] for job in db.survey_jobs.find({"created_by": "satellite-compare"}, {"id": 1})]
    if old_ids:
        db.violations.delete_many({"mission_id": {"$in": old_ids}})
        db.observed_buildings.delete_many({"mission_id": {"$in": old_ids}})
    db.survey_jobs.insert_one(
        {
            **mission,
            "crs": "EPSG:4326",
            "cog_path": None,
            "building_count": len(roofs_for_save),
            "violation_count": len(kept),
            "error": None,
            "created_by": "satellite-compare",
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
    )
    count = write_violations(mission, kept, roofs_for_save)
    print("saved", count, "mission", mission["id"])


if __name__ == "__main__":
    main()
