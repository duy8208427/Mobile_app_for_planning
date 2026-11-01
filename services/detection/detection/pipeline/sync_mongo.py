from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pymongo import MongoClient

from detection.config import DB_NAME, MONGO_URL


def now_utc():
    return datetime.now(timezone.utc)


def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


def notify_staff(db, mission: dict, count: int) -> None:
    staff = db.users.find({"role": {"$in": ["manager", "admin"]}}, {"id": 1, "full_name": 1})
    flight = mission.get("flight_date") or ""
    area = mission.get("area_name") or "khu vực bay"
    title = f"Đợt bay {flight}: {count} nghi vấn"
    body = (
        f"Hệ thống đã xử lý orthophoto khu {area}. "
        f"Có {count} công trình nghi xây sai so với bản đồ địa chính — cần cán bộ xác minh."
    )
    docs = []
    for u in staff:
        docs.append(
            {
                "id": str(uuid.uuid4()),
                "user_id": u["id"],
                "title": title,
                "body": body,
                "type": "violation_alert",
                "related_report_id": None,
                "related_violation_id": None,
                "related_mission_id": mission["id"],
                "read": False,
                "created_at": now_utc(),
            }
        )
    if docs:
        db.notifications.insert_many(docs)


def write_violations(mission: dict, violations: list[dict], buildings: list[dict]) -> int:
    db = mongo_db()
    mission_id = mission["id"]
    db.violations.delete_many({"mission_id": mission_id, "status": "pending_review"})
    db.observed_buildings.delete_many({"mission_id": mission_id})

    bdocs = []
    for feat in buildings:
        props = feat.get("properties") or {}
        geom = feat.get("geometry")
        if not geom:
            continue
        bdocs.append(
            {
                "id": str(uuid.uuid4()),
                "mission_id": mission_id,
                "confidence": float(props.get("confidence") or 0.7),
                "source": "yolo11-seg",
                "geometry": geom,
                "updated_at": now_utc(),
            }
        )
    if bdocs:
        db.observed_buildings.insert_many(bdocs)

    docs = []
    for v in violations:
        docs.append(
            {
                "id": v.get("id") or str(uuid.uuid4()),
                "mission_id": mission_id,
                "parcel_id": v.get("parcel_id"),
                "so_to": v.get("SoTo") or v.get("so_to"),
                "so_thua": v.get("SoThua") or v.get("so_thua"),
                "loai_dat": v.get("KyHieuLoaiDat") or v.get("loai_dat"),
                "SoTo": v.get("SoTo") or v.get("so_to"),
                "SoThua": v.get("SoThua") or v.get("so_thua"),
                "KyHieuLoaiDat": v.get("KyHieuLoaiDat") or v.get("loai_dat"),
                "MucDichSuDungDat": v.get("MucDichSuDungDat"),
                "DiaChi": v.get("DiaChi"),
                "DienTich": v.get("DienTich"),
                "DienTichPhapLy": v.get("DienTichPhapLy"),
                "TenChuSoHuu": v.get("TenChuSoHuu"),
                "TenNha": v.get("TenNha"),
                "SoNha": v.get("SoNha"),
                "TenConDuong": v.get("TenConDuong"),
                "thuaDatID": v.get("thuaDatID") or v.get("parcel_id"),
                "MaPhuongXa": v.get("MaPhuongXa"),
                "KhuPho": v.get("KhuPho"),
                "Ap": v.get("Ap"),
                "GhiChu": v.get("GhiChu"),
                "rule_id": v.get("rule_id"),
                "reason": v.get("reason"),
                "severity": v.get("severity", "medium"),
                "area_m2": v.get("area_m2"),
                "confidence": v.get("confidence", 0.7),
                "latitude": v.get("latitude"),
                "longitude": v.get("longitude"),
                "geometry": v.get("geometry"),
                "thumbnail_url": v.get("thumbnail_url"),
                "status": "pending_review",
                "reviewed_by": None,
                "review_note": None,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            }
        )
    if docs:
        db.violations.insert_many(docs)

    db.survey_jobs.update_one(
        {"id": mission_id},
        {
            "$set": {
                "status": "done",
                "building_count": len(bdocs),
                "violation_count": len(docs),
                "updated_at": now_utc(),
                "error": None,
            }
        },
    )
    notify_staff(db, mission, len(docs))
    return len(docs)


def load_parcels_mongo(bbox: tuple[float, float, float, float] | None = None) -> list[dict]:
    """Parcels intersecting a WGS84 box. Without a box, do not scan the whole cadastre."""
    db = mongo_db()
    if bbox is None:
        return []
    minx, miny, maxx, maxy = bbox
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
    docs = list(db.parcels.find(query, {"_id": 0}))
    feats = []
    for d in docs:
        geom = d.get("geometry")
        if not geom:
            continue
        feats.append({"type": "Feature", "properties": d, "geometry": geom})
    return feats


def mark_job(mission_id: str, status: str, error: str | None = None, extra: dict[str, Any] | None = None):
    db = mongo_db()
    fields: dict[str, Any] = {"status": status, "updated_at": now_utc()}
    if error is not None:
        fields["error"] = error
    if extra:
        fields.update(extra)
    db.survey_jobs.update_one({"id": mission_id}, {"$set": fields})


def next_queued_job() -> dict | None:
    db = mongo_db()
    job = db.survey_jobs.find_one_and_update(
        {"status": "queued"},
        {"$set": {"status": "running", "updated_at": now_utc()}},
    )
    if job:
        job.pop("_id", None)
    return job
