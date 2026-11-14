"""Planning zones, cadastral parcels, buildings, and violations API."""
import asyncio
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel


class ViolationReview(BaseModel):
    status: Literal["confirmed", "rejected"]
    review_note: Optional[str] = None


PARCEL_MAP_PROJ = {
    "_id": 0,
    "id": 1,
    "geometry": 1,
    "SoTo": 1,
    "SoThua": 1,
    "KyHieuLoaiDat": 1,
    "MucDichSuDungDat": 1,
    "DienTich": 1,
    "DienTichPhapLy": 1,
    "DiaChi": 1,
    "SoNha": 1,
    "TenConDuong": 1,
    "TenChuSoHuu": 1,
    "TenNha": 1,
    "MaPhuongXa": 1,
    "KhuPho": 1,
    "Ap": 1,
    "GhiChu": 1,
    "thuaDatID": 1,
    "SoThuaMoi": 1,
    "SoHieuToBanDoCu": 1,
    "SoThuTuThuaCu": 1,
    "so_to": 1,
    "so_thua": 1,
    "loai_dat": 1,
    "allow_build": 1,
}


LEAF_FETCH = 4000
MAX_COVER_DEPTH = 8
MAX_COVER_FEATURES = 100000
MIN_CELL_DEG = 0.008


def _stride(docs: list, keep: int) -> list:
    n = len(docs)
    if keep >= n:
        return docs
    if keep <= 0 or n <= 0:
        return []
    step = n / keep
    return [docs[min(n - 1, int(i * step))] for i in range(keep)]


def _allocate(counts: list, budget: int) -> list:
    total = sum(counts)
    if total <= budget:
        return list(counts)
    if budget <= 0 or total <= 0:
        return [0] * len(counts)
    raw = [c * budget / total for c in counts]
    base = [int(v) for v in raw]
    left = budget - sum(base)
    order = sorted(
        range(len(counts)),
        key=lambda i: (raw[i] - base[i], counts[i]),
        reverse=True,
    )
    for i in order:
        if left <= 0:
            break
        if counts[i] <= 0:
            continue
        base[i] += 1
        left -= 1
    return [min(counts[i], base[i]) for i in range(len(counts))]


def _simplify_geom(geom: dict | None) -> dict | None:
    if not geom:
        return geom

    def rnd_ring(ring):
        out = []
        prev = None
        for p in ring:
            xy = [round(float(p[0]), 5), round(float(p[1]), 5)]
            if xy != prev:
                out.append(xy)
                prev = xy
        if len(out) >= 3 and out[0] != out[-1]:
            out.append(list(out[0]))
        return out if len(out) >= 4 else ring

    kind = geom.get("type")
    coords = geom.get("coordinates") or []
    try:
        if kind == "Polygon" and coords:
            return {"type": "Polygon", "coordinates": [rnd_ring(coords[0])]}
        if kind == "MultiPolygon" and coords:
            polys = [[rnd_ring(p[0])] for p in coords if p]
            if len(polys) == 1:
                return {"type": "Polygon", "coordinates": polys[0]}
            return {"type": "MultiPolygon", "coordinates": polys}
    except Exception:
        return geom
    return geom


def _feature_collection(docs: List[dict], geometry_key: str = "geometry", simplify: bool = False) -> dict:
    features = []
    for d in docs:
        geom = d.get(geometry_key)
        if not geom:
            continue
        if simplify:
            geom = _simplify_geom(geom) or geom
        props = {k: v for k, v in d.items() if k not in (geometry_key, "_id", "cx", "cy")}
        features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features}


def _is_staff(user: dict) -> bool:
    return user.get("role") in ("admin", "manager")


STAFF_ONLY_PARCEL_FIELDS = ("TenChuSoHuu",)


def _strip_owner(fc: dict, user: dict) -> dict:
    """Owner names are personal data: only admin/manager accounts may see them."""
    if _is_staff(user):
        return fc
    for feat in fc.get("features") or []:
        props = feat.get("properties")
        if props:
            for key in STAFF_ONLY_PARCEL_FIELDS:
                props.pop(key, None)
    return fc


def _violation_proj(user: dict) -> dict:
    """Violations copy parcel fields, owner name included: staff only."""
    proj = {"_id": 0}
    if not _is_staff(user):
        for key in STAFF_ONLY_PARCEL_FIELDS:
            proj[key] = 0
    return proj


def create_planning_routers(db, get_current_user, require_admin, now_utc, require_staff=None):
    planning_router = APIRouter(prefix="/planning", tags=["planning"])
    violations_router = APIRouter(prefix="/violations", tags=["violations"])
    staff_dep = require_staff or require_admin

    @planning_router.get("/zones")
    async def list_planning_zones(user=Depends(get_current_user)):
        cursor = db.planning_zones.find({}, {"_id": 0})
        docs = await cursor.to_list(500)
        return _feature_collection(docs)

    @planning_router.get("/extent")
    async def cadastre_extent(user=Depends(get_current_user)):
        meta = await db.cadastre_meta.find_one({"id": "current"}, {"_id": 0})
        if not meta:
            return {
                "count": 0,
                "west": None,
                "south": None,
                "east": None,
                "north": None,
                "layer": None,
                "source": None,
            }
        return {
            "count": meta.get("count") or 0,
            "west": meta.get("west"),
            "south": meta.get("south"),
            "east": meta.get("east"),
            "north": meta.get("north"),
            "layer": meta.get("layer"),
            "source": meta.get("gdb") or meta.get("source"),
            "imported_at": meta.get("imported_at"),
        }

    def _violation_point(doc: dict):
        lon, lat = doc.get("longitude"), doc.get("latitude")
        if lon is not None and lat is not None:
            return [float(lon), float(lat)]
        geom = doc.get("geometry") or {}
        coords = geom.get("coordinates")
        if geom.get("type") == "Point" and coords:
            return [float(coords[0]), float(coords[1])]
        ring = None
        if geom.get("type") == "Polygon" and coords:
            ring = coords[0]
        elif geom.get("type") == "MultiPolygon" and coords and coords[0]:
            ring = coords[0][0]
        if not ring:
            return None
        return [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]

    async def _point_on_parcel(pt) -> bool:
        if not pt:
            return False
        hit = await db.parcels.find_one(
            {
                "geometry": {
                    "$geoIntersects": {
                        "$geometry": {"type": "Point", "coordinates": pt},
                    }
                }
            },
            {"_id": 1},
        )
        return hit is not None

    def _xy_query(minx: float, miny: float, maxx: float, maxy: float) -> dict:
        return {
            "cx": {"$gte": minx, "$lte": maxx},
            "cy": {"$gte": miny, "$lte": maxy},
        }

    cover_sem = asyncio.Semaphore(12)

    async def _leaves(minx: float, miny: float, maxx: float, maxy: float, depth: int) -> list:
        q = _xy_query(minx, miny, maxx, maxy)
        async with cover_sem:
            n = await db.parcels.count_documents(q)
        if n <= 0:
            return []
        span = max(maxx - minx, maxy - miny)
        if n <= LEAF_FETCH or depth >= MAX_COVER_DEPTH or span <= MIN_CELL_DEG:
            return [((minx, miny, maxx, maxy), n)]
        mx = (minx + maxx) / 2.0
        my = (miny + maxy) / 2.0
        parts = await asyncio.gather(
            _leaves(minx, miny, mx, my, depth + 1),
            _leaves(mx, miny, maxx, my, depth + 1),
            _leaves(minx, my, mx, maxy, depth + 1),
            _leaves(mx, my, maxx, maxy, depth + 1),
        )
        out = []
        for part in parts:
            out.extend(part)
        return out

    async def _fetch_leaf(box: tuple, have: int, keep: int) -> list:
        if keep <= 0 or have <= 0:
            return []
        q = _xy_query(*box)
        async with cover_sem:
            if keep >= have:
                return await db.parcels.find(q, PARCEL_MAP_PROJ).limit(have).to_list(have)
            docs = await (
                db.parcels.find(q, PARCEL_MAP_PROJ)
                .sort([("cx", 1), ("cy", 1)])
                .limit(have)
                .to_list(have)
            )
        return _stride(docs, keep)

    async def _cover_view(minx: float, miny: float, maxx: float, maxy: float) -> tuple:
        leaves = await _leaves(minx, miny, maxx, maxy, 0)
        if not leaves:
            return [], 0
        counts = [n for _, n in leaves]
        total = sum(counts)
        alloc = _allocate(counts, MAX_COVER_FEATURES)
        fetched = await asyncio.gather(
            *[
                _fetch_leaf(box, have, keep)
                for (box, have), keep in zip(leaves, alloc)
                if keep > 0
            ]
        )
        out = []
        seen = set()
        for docs in fetched:
            for d in docs:
                key = d.get("id") or d.get("thuaDatID")
                if key is not None and key in seen:
                    continue
                if key is not None:
                    seen.add(key)
                out.append(d)
        return out, total

    @planning_router.get("/parcels")
    async def list_parcels(
        bbox: Optional[str] = Query(None, description="minx,miny,maxx,maxy WGS84"),
        limit: int = Query(5000, ge=1, le=12000),
        cover: bool = Query(True, description="Chia ô để phủ đều khung nhìn"),
        user=Depends(get_current_user),
    ):
        from gis import parcels_geojson, postgis_enabled

        parsed = None
        if bbox:
            try:
                parts = [float(x) for x in bbox.split(",")]
                if len(parts) != 4:
                    raise ValueError("need 4 numbers")
                parsed = (parts[0], parts[1], parts[2], parts[3])
            except Exception:
                raise HTTPException(status_code=400, detail="bbox không hợp lệ")

        if postgis_enabled() and parsed and not cover:
            try:
                fc = parcels_geojson(parsed, limit=limit)
                if fc.get("features"):
                    return _strip_owner(fc, user)
            except Exception:
                pass

        if not parsed:
            return {
                "type": "FeatureCollection",
                "features": [],
                "properties": {"truncated": False, "reason": "bbox_required"},
            }

        minx, miny, maxx, maxy = parsed
        sample_xy = await db.parcels.find_one({}, {"_id": 0, "cx": 1})
        has_xy = sample_xy is not None and sample_xy.get("cx") is not None
        if cover and has_xy:
            acc, total = await _cover_view(minx, miny, maxx, maxy)
            fc = _feature_collection(acc, simplify=True)
            fc["properties"] = {
                "truncated": total > MAX_COVER_FEATURES,
                "returned": len(acc),
                "matched": total,
            }
            return _strip_owner(fc, user)

        q = _xy_query(minx, miny, maxx, maxy) if has_xy else {
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
        cursor = db.parcels.find(q, PARCEL_MAP_PROJ).limit(limit)
        docs = await cursor.to_list(limit)
        fc = _feature_collection(docs, simplify=True)
        fc["properties"] = {"truncated": len(docs) >= limit, "returned": len(docs)}
        return _strip_owner(fc, user)

    @planning_router.get("/buildings")
    async def list_observed_buildings(
        mission_id: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        from gis import buildings_geojson, postgis_enabled

        if postgis_enabled():
            try:
                fc = buildings_geojson(mission_id)
                if fc.get("features"):
                    return fc
            except Exception:
                pass
        q: dict = {}
        if mission_id:
            q["mission_id"] = mission_id
        cursor = db.observed_buildings.find(q, {"_id": 0})
        docs = await cursor.to_list(5000)
        return _feature_collection(docs)

    @violations_router.get("")
    async def list_violations(
        status: Optional[str] = None,
        mission_id: Optional[str] = None,
        rule_id: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        q: dict = {}
        if not _is_staff(user):
            q["status"] = "confirmed"
        elif status:
            q["status"] = status
        if mission_id:
            q["mission_id"] = mission_id
        if rule_id:
            q["rule_id"] = rule_id
        cursor = db.violations.find(q, _violation_proj(user)).sort("created_at", -1)
        return await cursor.to_list(1000)

    @violations_router.get("/stats")
    async def violation_stats(user=Depends(get_current_user)):
        if not _is_staff(user):
            raise HTTPException(status_code=403, detail="Chỉ cán bộ")
        pending = await db.violations.count_documents({"status": "pending_review"})
        confirmed = await db.violations.count_documents({"status": "confirmed"})
        rejected = await db.violations.count_documents({"status": "rejected"})
        latest = await db.survey_jobs.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
        latest_pending = 0
        if latest:
            latest_pending = await db.violations.count_documents(
                {"mission_id": latest["id"], "status": "pending_review"}
            )
        return {
            "pending_review": pending,
            "confirmed": confirmed,
            "rejected": rejected,
            "latest_mission": latest,
            "latest_pending": latest_pending,
        }

    @violations_router.get("/geojson")
    async def violations_geojson(
        status: Optional[str] = None,
        mission_id: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        q: dict = {}
        if not _is_staff(user):
            q["status"] = "confirmed"
        elif status:
            q["status"] = status
        if mission_id:
            q["mission_id"] = mission_id
        docs = await db.violations.find(q, _violation_proj(user)).to_list(8000)
        gate = asyncio.Semaphore(24)

        async def _keep(doc: dict):
            async with gate:
                if await _point_on_parcel(_violation_point(doc)):
                    return doc
            return None

        checked = await asyncio.gather(*(_keep(doc) for doc in docs))
        on_parcel = [doc for doc in checked if doc is not None]
        return _feature_collection(on_parcel)

    @violations_router.get("/{violation_id}")
    async def get_violation(violation_id: str, user=Depends(get_current_user)):
        v = await db.violations.find_one({"id": violation_id}, _violation_proj(user))
        if not v:
            raise HTTPException(status_code=404, detail="Không tìm thấy vi phạm")
        if not _is_staff(user) and v.get("status") != "confirmed":
            raise HTTPException(status_code=403, detail="Chưa công bố")
        return v

    @violations_router.patch("/{violation_id}/review")
    async def review_violation(
        violation_id: str,
        payload: ViolationReview,
        staff=Depends(staff_dep),
    ):
        v = await db.violations.find_one({"id": violation_id})
        if not v:
            raise HTTPException(status_code=404, detail="Không tìm thấy vi phạm")
        await db.violations.update_one(
            {"id": violation_id},
            {
                "$set": {
                    "status": payload.status,
                    "review_note": payload.review_note,
                    "reviewed_by": staff["full_name"],
                    "updated_at": now_utc(),
                }
            },
        )
        updated = await db.violations.find_one({"id": violation_id}, {"_id": 0})
        if payload.status == "confirmed":
            await db.notifications.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "user_id": staff["id"],
                    "title": "Đã xác nhận vi phạm xây dựng",
                    "body": updated.get("reason") or "Nghi vấn đã được xác nhận.",
                    "type": "violation_alert",
                    "related_report_id": None,
                    "related_violation_id": violation_id,
                    "related_mission_id": updated.get("mission_id"),
                    "read": False,
                    "created_at": now_utc(),
                }
            )
        return updated

    async def seed_planning_data():
        if await db.planning_zones.count_documents({}) == 0:
            zones = [
                {
                    "id": str(uuid.uuid4()),
                    "zone_code": "ODT",
                    "zone_name": "Đất ở đô thị",
                    "allow_build": True,
                    "max_floor": 5,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [105.628, 10.452],
                                [105.638, 10.452],
                                [105.638, 10.462],
                                [105.628, 10.462],
                                [105.628, 10.452],
                            ]
                        ],
                    },
                    "updated_at": now_utc(),
                },
                {
                    "id": str(uuid.uuid4()),
                    "zone_code": "GT",
                    "zone_name": "Giao thông",
                    "allow_build": False,
                    "max_floor": 0,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [105.638, 10.452],
                                [105.645, 10.452],
                                [105.645, 10.458],
                                [105.638, 10.458],
                                [105.638, 10.452],
                            ]
                        ],
                    },
                    "updated_at": now_utc(),
                },
            ]
            await db.planning_zones.insert_many(zones)

        if await db.survey_jobs.count_documents({}) == 0:
            mission_id = str(uuid.uuid4())
            await db.survey_jobs.insert_one(
                {
                    "id": mission_id,
                    "flight_date": "2026-10-15",
                    "area_name": "Xã thí điểm Hòa Thuận — Cao Lãnh",
                    "crs": "EPSG:3405",
                    "gsd_cm": 4.0,
                    "cog_path": None,
                    "status": "done",
                    "building_count": 3,
                    "violation_count": 2,
                    "error": None,
                    "created_by": "seed",
                    "created_at": now_utc(),
                    "updated_at": now_utc(),
                }
            )
        if await db.notifications.count_documents({"type": "violation_alert"}) == 0:
            staff = await db.users.find(
                {"role": {"$in": ["manager", "admin"]}}, {"id": 1}
            ).to_list(20)
            latest = await db.survey_jobs.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
            pending = await db.violations.count_documents({"status": "pending_review"})
            if staff and latest:
                # One alert per officer and mission, keyed so concurrent cold starts cannot duplicate it
                for u in staff:
                    await db.notifications.update_one(
                        {"id": f"flight-{latest.get('id')}-{u['id']}"},
                        {"$setOnInsert": {
                            "id": f"flight-{latest.get('id')}-{u['id']}",
                            "user_id": u["id"],
                            "title": f"Đợt bay {latest.get('flight_date')}: {pending} nghi vấn",
                            "body": (
                                f"Orthophoto khu {latest.get('area_name')} đã đối chiếu địa chính. "
                                "Mở danh sách nghi vấn để xác minh trước khi công bố."
                            ),
                            "type": "violation_alert",
                            "related_report_id": None,
                            "related_violation_id": None,
                            "related_mission_id": latest.get("id"),
                            "read": False,
                            "created_at": now_utc(),
                        }},
                        upsert=True,
                    )

    return planning_router, violations_router, seed_planning_data
