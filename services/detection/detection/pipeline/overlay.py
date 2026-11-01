from __future__ import annotations

import json
import uuid
from typing import Any

from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

from detection.config import (
    AREA_CRS,
    LEGAL_LAND_CODES,
    MIN_VIOLATION_M2,
    NEGATIVE_BUFFER_M,
    POSTGIS_DSN,
    WEB_CRS,
)

RULE_SAI_MDSD = "SAI_MDSD"
RULE_LAN_RANH = "LAN_RANH"
RULE_NHA_MOI = "NHA_MOI"

GDB_COPY_FIELDS = (
    "SoTo",
    "SoThua",
    "KyHieuLoaiDat",
    "MucDichSuDungDat",
    "DiaChi",
    "DienTich",
    "DienTichPhapLy",
    "TenChuSoHuu",
    "TenNha",
    "SoNha",
    "TenConDuong",
    "thuaDatID",
    "MaPhuongXa",
    "KhuPho",
    "Ap",
    "GhiChu",
)

SEVERITY = {
    RULE_SAI_MDSD: "high",
    RULE_LAN_RANH: "medium",
    RULE_NHA_MOI: "low",
}

REASON = {
    RULE_SAI_MDSD: "Mái nhà nằm ngoài đất ở (ODT/ONT) — nghi xây sai mục đích sử dụng đất",
    RULE_LAN_RANH: "Mái nhà vượt ranh thửa — nghi lấn ranh",
    RULE_NHA_MOI: "Công trình mới so với lớp nhà địa chính",
}


def _to_crs(geom, src: str, dst: str):
    if src == dst:
        return geom
    from pyproj import Transformer

    transformer = Transformer.from_crs(src, dst, always_xy=True)
    return transform(transformer.transform, geom)


def _passes_filter(geom) -> bool:
    if geom is None or geom.is_empty:
        return False
    if geom.area < MIN_VIOLATION_M2:
        return False
    shrunk = geom.buffer(-NEGATIVE_BUFFER_M)
    return not shrunk.is_empty


def _anchor_on(geom):
    """A point that lies on the roof part inside the host parcel."""
    if geom is None or geom.is_empty:
        return None
    pt = geom.centroid
    if geom.geom_type in ("Polygon", "MultiPolygon", "GeometryCollection") and not geom.covers(pt):
        pt = geom.representative_point()
    return pt


def _record(
    rule_id: str,
    geom,
    src_crs: str,
    extra: dict[str, Any],
    point_geom=None,
) -> dict:
    geom_m = _to_crs(geom, src_crs, AREA_CRS) if src_crs != AREA_CRS else geom
    web = _to_crs(geom_m, AREA_CRS, WEB_CRS)
    anchor = point_geom if point_geom is not None else geom
    anchor_m = _to_crs(anchor, src_crs, AREA_CRS) if src_crs != AREA_CRS else anchor
    web_pt = _to_crs(anchor_m, AREA_CRS, WEB_CRS)
    point = _anchor_on(web_pt) or web.centroid
    return {
        "id": str(uuid.uuid4()),
        "rule_id": rule_id,
        "severity": SEVERITY[rule_id],
        "reason": REASON[rule_id],
        "area_m2": round(float(geom_m.area), 2),
        "geometry": mapping(web),
        "latitude": point.y,
        "longitude": point.x,
        **extra,
    }


def overlay_shapely(
    buildings: list[dict],
    parcels: list[dict],
    cadastral_buildings: list[dict] | None = None,
    src_crs: str = WEB_CRS,
) -> list[dict]:
    parcel_geoms = []
    legal = []
    for p in parcels:
        g = _to_crs(shape(p["geometry"]), src_crs, AREA_CRS)
        props = p.get("properties") or p
        loai = str(props.get("KyHieuLoaiDat") or props.get("loai_dat") or "").upper()
        rec = {
            "id": props.get("id") or props.get("thuaDatID"),
            "so_to": props.get("SoTo") or props.get("so_to"),
            "so_thua": props.get("SoThua") or props.get("so_thua"),
            "loai_dat": loai,
            "allow_build": bool(props.get("allow_build")) or loai in LEGAL_LAND_CODES,
            "geom": g,
        }
        for key in GDB_COPY_FIELDS:
            if props.get(key) not in (None, ""):
                rec[key] = props[key]
        parcel_geoms.append(rec)
        if rec["allow_build"]:
            legal.append(g)

    parcel_tree = STRtree([p["geom"] for p in parcel_geoms]) if parcel_geoms else None
    legal_union = unary_union(legal) if legal else None
    cad_union = None
    if cadastral_buildings:
        cad_union = unary_union(
            [_to_crs(shape(b["geometry"]), src_crs, AREA_CRS) for b in cadastral_buildings]
        )

    violations: list[dict] = []
    for b in buildings:
        props = b.get("properties") or {}
        geom = _to_crs(shape(b["geometry"]), src_crs, AREA_CRS)
        conf = float(props.get("confidence") or 0.7)
        extra_base = {"confidence": conf, "building_tag": props.get("tag")}

        host = _host_parcel(geom, parcel_geoms, parcel_tree)
        if host is None:
            continue
        inside = geom.intersection(host["geom"]).buffer(0)
        if inside.is_empty:
            continue
        anchor = _anchor_on(inside)
        extra = {
            **extra_base,
            "parcel_id": host["id"],
            "so_to": host["so_to"],
            "so_thua": host["so_thua"],
            "loai_dat": host["loai_dat"],
            **{k: host[k] for k in GDB_COPY_FIELDS if k in host},
        }

        if not host["allow_build"]:
            if legal_union is None or legal_union.is_empty:
                diff = geom
            else:
                diff = geom.difference(legal_union).buffer(0)
            if _passes_filter(diff):
                violations.append(_record(RULE_SAI_MDSD, diff, AREA_CRS, extra, anchor))

        overflow = geom.difference(host["geom"]).buffer(0)
        if _passes_filter(overflow):
            violations.append(_record(RULE_LAN_RANH, overflow, AREA_CRS, extra, anchor))

        if cad_union is not None and geom.disjoint(cad_union) and _passes_filter(geom):
            violations.append(_record(RULE_NHA_MOI, geom, AREA_CRS, extra, anchor))

    return violations


def _host_parcel(geom, parcels: list[dict], tree: STRtree | None) -> dict | None:
    if tree is None:
        return None
    best = None
    best_area = 0.0
    for idx in tree.query(geom):
        p = parcels[int(idx)]
        inter = geom.intersection(p["geom"])
        if inter.is_empty:
            continue
        if inter.area > best_area:
            best = p
            best_area = inter.area
    return best


def overlay_postgis(mission_id: str) -> list[dict]:
    try:
        import psycopg
        from psycopg.rows import dict_row
    except Exception as exc:
        raise RuntimeError("psycopg is required for PostGIS overlay") from exc

    sql = """
    WITH legal AS (
      SELECT ST_Union(geom) AS geom FROM cadastre.parcels WHERE allow_build
    ),
    bldg AS (
      SELECT * FROM survey.detected_buildings WHERE mission_id = %(mission_id)s
    ),
    host AS (
      SELECT b.id AS building_id, p.id AS parcel_id, p.so_to, p.so_thua, p.loai_dat, p.geom AS parcel_geom
      FROM bldg b
      JOIN LATERAL (
        SELECT p.* FROM cadastre.parcels p
        ORDER BY ST_Area(ST_Intersection(p.geom, b.geom)) DESC
        LIMIT 1
      ) p ON ST_Intersects(p.geom, b.geom)
    ),
    sai AS (
      SELECT b.id AS building_id, h.parcel_id, h.so_to, h.so_thua, h.loai_dat, b.confidence,
             'SAI_MDSD'::text AS rule_id,
             ST_Multi(ST_CollectionExtract(ST_Difference(b.geom, l.geom), 3)) AS geom
      FROM bldg b CROSS JOIN legal l
      LEFT JOIN host h ON h.building_id = b.id
    ),
    lan AS (
      SELECT b.id AS building_id, h.parcel_id, h.so_to, h.so_thua, h.loai_dat, b.confidence,
             'LAN_RANH'::text AS rule_id,
             ST_Multi(ST_CollectionExtract(ST_Difference(b.geom, h.parcel_geom), 3)) AS geom
      FROM bldg b
      JOIN host h ON h.building_id = b.id
    ),
    moi AS (
      SELECT b.id AS building_id, h.parcel_id, h.so_to, h.so_thua, h.loai_dat, b.confidence,
             'NHA_MOI'::text AS rule_id,
             ST_Multi(b.geom) AS geom
      FROM bldg b
      LEFT JOIN host h ON h.building_id = b.id
      WHERE EXISTS (SELECT 1 FROM cadastre.buildings)
        AND NOT EXISTS (
          SELECT 1 FROM cadastre.buildings c WHERE ST_Intersects(c.geom, b.geom)
        )
    ),
    allv AS (
      SELECT * FROM sai UNION ALL SELECT * FROM lan UNION ALL SELECT * FROM moi
    )
    SELECT
      gen_random_uuid()::text AS id,
      building_id, parcel_id, so_to, so_thua, loai_dat, confidence, rule_id,
      ST_Area(geom) AS area_m2,
      ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry,
      ST_Y(ST_Centroid(ST_Transform(geom, 4326))) AS latitude,
      ST_X(ST_Centroid(ST_Transform(geom, 4326))) AS longitude
    FROM allv
    WHERE geom IS NOT NULL
      AND NOT ST_IsEmpty(geom)
      AND ST_Area(geom) > %(min_area)s
      AND NOT ST_IsEmpty(ST_Buffer(geom, -%(neg_buf)s));
    """
    rows: list[dict] = []
    with psycopg.connect(POSTGIS_DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                {
                    "mission_id": mission_id,
                    "min_area": MIN_VIOLATION_M2,
                    "neg_buf": NEGATIVE_BUFFER_M,
                },
            )
            for row in cur.fetchall():
                geom = json.loads(row["geometry"]) if row.get("geometry") else None
                rule_id = row["rule_id"]
                rows.append(
                    {
                        "id": row["id"],
                        "rule_id": rule_id,
                        "severity": SEVERITY.get(rule_id, "medium"),
                        "reason": REASON.get(rule_id, rule_id),
                        "area_m2": round(float(row["area_m2"] or 0), 2),
                        "geometry": geom,
                        "latitude": row["latitude"],
                        "longitude": row["longitude"],
                        "parcel_id": row.get("parcel_id"),
                        "so_to": row.get("so_to"),
                        "so_thua": row.get("so_thua"),
                        "loai_dat": row.get("loai_dat"),
                        "confidence": float(row.get("confidence") or 0.7),
                        "building_id": row.get("building_id"),
                    }
                )
            cur.execute(
                "DELETE FROM survey.violation_geoms WHERE mission_id = %s",
                (mission_id,),
            )
            for v in rows:
                cur.execute(
                    """
                    INSERT INTO survey.violation_geoms
                      (id, mission_id, building_id, parcel_id, so_to, so_thua, loai_dat,
                       rule_id, area_m2, confidence, geom)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), 3405)))
                    """,
                    (
                        v["id"],
                        mission_id,
                        v.get("building_id"),
                        v.get("parcel_id"),
                        v.get("so_to"),
                        v.get("so_thua"),
                        v.get("loai_dat"),
                        v["rule_id"],
                        v["area_m2"],
                        v.get("confidence"),
                        json.dumps(v["geometry"]),
                    ),
                )
        conn.commit()
    return rows
