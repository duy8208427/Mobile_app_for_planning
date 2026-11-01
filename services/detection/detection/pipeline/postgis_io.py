from __future__ import annotations

import json
import uuid
from pathlib import Path

from detection.config import AREA_CRS, POSTGIS_DSN, SAMPLE_PARCELS


def postgis_available() -> bool:
    try:
        import psycopg

        with psycopg.connect(POSTGIS_DSN, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False


def upsert_mission(mission: dict) -> None:
    import psycopg

    bbox = mission.get("bbox")
    bbox_json = None
    if isinstance(bbox, dict) and "minx" in bbox:
        bbox_json = json.dumps(
            {
                "type": "Polygon",
                "coordinates": [
                    [
                        [bbox["minx"], bbox["miny"]],
                        [bbox["maxx"], bbox["miny"]],
                        [bbox["maxx"], bbox["maxy"]],
                        [bbox["minx"], bbox["maxy"]],
                        [bbox["minx"], bbox["miny"]],
                    ]
                ],
            }
        )
    elif isinstance(bbox, dict) and bbox.get("type") == "Polygon":
        bbox_json = json.dumps(bbox)
    with psycopg.connect(POSTGIS_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO survey.missions (id, flight_date, area_name, crs, gsd_cm, cog_path, bbox, status)
                VALUES (%s, %s, %s, %s, %s, %s,
                        CASE WHEN %s IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326) END,
                        %s)
                ON CONFLICT (id) DO UPDATE SET
                  cog_path = EXCLUDED.cog_path,
                  status = EXCLUDED.status,
                  updated_at = now()
                """,
                (
                    mission["id"],
                    str(mission.get("flight_date") or "")[:10],
                    mission.get("area_name"),
                    mission.get("crs") or AREA_CRS,
                    mission.get("gsd_cm"),
                    mission.get("cog_path"),
                    bbox_json,
                    bbox_json,
                    mission.get("status") or "running",
                ),
            )
        conn.commit()


def replace_detected_buildings(mission_id: str, features: list[dict]) -> None:
    import psycopg

    with psycopg.connect(POSTGIS_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM survey.detected_buildings WHERE mission_id = %s", (mission_id,))
            for feat in features:
                geom = feat.get("geometry")
                if not geom:
                    continue
                props = feat.get("properties") or {}
                cur.execute(
                    """
                    INSERT INTO survey.detected_buildings (id, mission_id, confidence, geom)
                    VALUES (%s, %s, %s,
                      ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), 3405)))
                    """,
                    (
                        str(uuid.uuid4()),
                        mission_id,
                        float(props.get("confidence") or 0.7),
                        json.dumps(geom),
                    ),
                )
        conn.commit()


def load_parcels_postgis() -> list[dict]:
    import psycopg
    from psycopg.rows import dict_row

    with psycopg.connect(POSTGIS_DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, so_to, so_thua, loai_dat, allow_build, xa,
                       ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry
                FROM cadastre.parcels
                """
            )
            rows = cur.fetchall()
    feats = []
    for r in rows:
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": r["id"],
                    "so_to": r["so_to"],
                    "so_thua": r["so_thua"],
                    "loai_dat": r["loai_dat"],
                    "allow_build": r["allow_build"],
                    "xa": r["xa"],
                },
                "geometry": json.loads(r["geometry"]),
            }
        )
    return feats


def load_sample_parcels() -> list[dict]:
    data = json.loads(Path(SAMPLE_PARCELS).read_text(encoding="utf-8"))
    return data["features"]


def seed_sample_parcels_postgis() -> int:
    import psycopg

    feats = load_sample_parcels()
    with psycopg.connect(POSTGIS_DSN) as conn:
        with conn.cursor() as cur:
            for f in feats:
                p = f["properties"]
                cur.execute(
                    """
                    INSERT INTO cadastre.parcels
                      (id, so_to, so_thua, loai_dat, allow_build, xa, source_layer, geom)
                    VALUES (%s,%s,%s,%s,%s,%s,'sample',
                      ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), 3405)))
                    ON CONFLICT (id) DO UPDATE SET geom = EXCLUDED.geom, loai_dat = EXCLUDED.loai_dat,
                      allow_build = EXCLUDED.allow_build
                    """,
                    (
                        p["id"],
                        p.get("so_to"),
                        p.get("so_thua"),
                        p.get("loai_dat"),
                        bool(p.get("allow_build")),
                        p.get("xa"),
                        json.dumps(f["geometry"]),
                    ),
                )
        conn.commit()
    return len(feats)
