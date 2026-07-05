"""Planning zones, buildings, and violations API."""
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


class ViolationReview(BaseModel):
    status: Literal["confirmed", "rejected"]
    review_note: Optional[str] = None


def _feature_collection(docs: List[dict], geometry_key: str = "geometry") -> dict:
    features = []
    for d in docs:
        geom = d.get(geometry_key)
        if not geom:
            continue
        props = {k: v for k, v in d.items() if k not in (geometry_key, "_id")}
        features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features}


def create_planning_routers(db, get_current_user, require_admin, now_utc):
    planning_router = APIRouter(prefix="/planning", tags=["planning"])
    violations_router = APIRouter(prefix="/violations", tags=["violations"])

    @planning_router.get("/zones")
    async def list_planning_zones(user=Depends(get_current_user)):
        cursor = db.planning_zones.find({}, {"_id": 0})
        docs = await cursor.to_list(500)
        return _feature_collection(docs)

    @planning_router.get("/buildings")
    async def list_observed_buildings(user=Depends(get_current_user)):
        cursor = db.observed_buildings.find({}, {"_id": 0})
        docs = await cursor.to_list(1000)
        return _feature_collection(docs)

    @violations_router.get("")
    async def list_violations(
        status: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        q: dict = {}
        if status:
            q["status"] = status
        cursor = db.violations.find(q, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(500)

    @violations_router.patch("/{violation_id}/review")
    async def review_violation(
        violation_id: str,
        payload: ViolationReview,
        admin=Depends(require_admin),
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
                    "reviewed_by": admin["full_name"],
                    "updated_at": now_utc(),
                }
            },
        )
        return await db.violations.find_one({"id": violation_id}, {"_id": 0})

    async def seed_planning_data():
        if await db.planning_zones.count_documents({}) > 0:
            return

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

        await db.observed_buildings.insert_one(
            {
                "id": str(uuid.uuid4()),
                "confidence": 0.82,
                "source": "demo",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [105.640, 10.454],
                            [105.642, 10.454],
                            [105.642, 10.456],
                            [105.640, 10.456],
                            [105.640, 10.454],
                        ]
                    ],
                },
                "updated_at": now_utc(),
            }
        )

        violations = [
            {
                "id": str(uuid.uuid4()),
                "latitude": 10.455,
                "longitude": 105.641,
                "severity": "high",
                "rule_id": "rule_1",
                "reason": "Footprint nằm trong vùng giao thông (allow_build=false)",
                "confidence": 0.88,
                "status": "pending_review",
                "zone_code": "GT",
                "reviewed_by": None,
                "review_note": None,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            },
            {
                "id": str(uuid.uuid4()),
                "latitude": 10.458,
                "longitude": 105.632,
                "severity": "medium",
                "rule_id": "rule_3",
                "reason": "Công trình nghi nằm ngoài vùng quy hoạch hợp lệ",
                "confidence": 0.65,
                "status": "pending_review",
                "zone_code": None,
                "reviewed_by": None,
                "review_note": None,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            },
        ]
        await db.violations.insert_many(violations)

    return planning_router, violations_router, seed_planning_data
