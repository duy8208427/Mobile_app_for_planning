"""Optional PostGIS access. Mongo remains the API source of truth for app records."""
from __future__ import annotations

import json
import os
from typing import Optional

POSTGIS_DSN = os.environ.get("POSTGIS_DSN", "")


def postgis_enabled() -> bool:
    return bool(POSTGIS_DSN)


def _connect():
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(POSTGIS_DSN, row_factory=dict_row, connect_timeout=5)


def parcels_geojson(bbox: Optional[tuple[float, float, float, float]] = None, limit: int = 2000) -> dict:
    if not postgis_enabled():
        return {"type": "FeatureCollection", "features": []}
    sql = """
      SELECT id, so_to, so_thua, loai_dat, allow_build, xa,
             ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry
      FROM cadastre.parcels
    """
    params: dict = {}
    if bbox:
        sql += """
          WHERE ST_Intersects(
            geom,
            ST_Transform(ST_MakeEnvelope(%(minx)s, %(miny)s, %(maxx)s, %(maxy)s, 4326), 3405)
          )
        """
        params = {"minx": bbox[0], "miny": bbox[1], "maxx": bbox[2], "maxy": bbox[3]}
    sql += " LIMIT %(limit)s"
    params["limit"] = limit
    features = []
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            for row in cur.fetchall():
                geom = json.loads(row["geometry"]) if row.get("geometry") else None
                if not geom:
                    continue
                props = {k: v for k, v in row.items() if k != "geometry"}
                features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features}


def buildings_geojson(mission_id: Optional[str] = None, limit: int = 5000) -> dict:
    if not postgis_enabled():
        return {"type": "FeatureCollection", "features": []}
    sql = """
      SELECT id, mission_id, confidence,
             ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry
      FROM survey.detected_buildings
    """
    params: dict = {"limit": limit}
    if mission_id:
        sql += " WHERE mission_id = %(mission_id)s"
        params["mission_id"] = mission_id
    sql += " LIMIT %(limit)s"
    features = []
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            for row in cur.fetchall():
                geom = json.loads(row["geometry"]) if row.get("geometry") else None
                if not geom:
                    continue
                props = {k: v for k, v in row.items() if k != "geometry"}
                features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features}
