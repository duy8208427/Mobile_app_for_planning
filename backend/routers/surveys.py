"""Monthly flycam survey missions."""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

COG_DIR = Path(__file__).resolve().parents[2] / "data" / "cog"


class SurveyCreate(BaseModel):
    flight_date: str
    area_name: str
    crs: str = "EPSG:3405"
    gsd_cm: Optional[float] = 5.0
    cog_path: Optional[str] = None
    bbox: Optional[dict] = None
    notes: Optional[str] = None
    run_mock: bool = Field(
        default=False,
        description="Queue job even without a GeoTIFF (worker uses synthetic footprints)",
    )


def create_survey_router(db, get_current_user, require_staff, now_utc):
    router = APIRouter(prefix="/surveys", tags=["surveys"])

    def _public(doc: dict) -> dict:
        out = dict(doc)
        out.pop("_id", None)
        return out

    @router.get("")
    async def list_surveys(user=Depends(get_current_user)):
        if user.get("role") not in ("admin", "manager"):
            raise HTTPException(status_code=403, detail="Chỉ cán bộ mới xem đợt bay")
        cursor = db.survey_jobs.find({}, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(200)

    @router.get("/{mission_id}")
    async def get_survey(mission_id: str, user=Depends(get_current_user)):
        if user.get("role") not in ("admin", "manager"):
            raise HTTPException(status_code=403, detail="Chỉ cán bộ mới xem đợt bay")
        job = await db.survey_jobs.find_one({"id": mission_id}, {"_id": 0})
        if not job:
            raise HTTPException(status_code=404, detail="Không tìm thấy đợt bay")
        return job

    @router.post("", status_code=201)
    async def create_survey(payload: SurveyCreate, staff=Depends(require_staff)):
        COG_DIR.mkdir(parents=True, exist_ok=True)
        mission_id = str(uuid.uuid4())
        status = "queued" if payload.cog_path or payload.run_mock else "draft"
        doc = {
            "id": mission_id,
            "flight_date": payload.flight_date,
            "area_name": payload.area_name,
            "crs": payload.crs,
            "gsd_cm": payload.gsd_cm,
            "cog_path": payload.cog_path,
            "bbox": payload.bbox,
            "notes": payload.notes,
            "status": status,
            "building_count": 0,
            "violation_count": 0,
            "error": None,
            "created_by": staff["full_name"],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.survey_jobs.insert_one(doc)
        return _public(doc)

    @router.post("/{mission_id}/file")
    async def upload_cog(
        mission_id: str,
        file: UploadFile = File(...),
        staff=Depends(require_staff),
    ):
        job = await db.survey_jobs.find_one({"id": mission_id})
        if not job:
            raise HTTPException(status_code=404, detail="Không tìm thấy đợt bay")
        name = file.filename or "ortho.tif"
        if not name.lower().endswith((".tif", ".tiff", ".cog")):
            raise HTTPException(status_code=400, detail="Chỉ nhận GeoTIFF/COG (.tif)")
        COG_DIR.mkdir(parents=True, exist_ok=True)
        dest = COG_DIR / f"{mission_id}.tif"
        with dest.open("wb") as out:
            shutil.copyfileobj(file.file, out)
        await db.survey_jobs.update_one(
            {"id": mission_id},
            {
                "$set": {
                    "cog_path": str(dest),
                    "status": "queued",
                    "updated_at": now_utc(),
                    "uploaded_by": staff["full_name"],
                }
            },
        )
        return await db.survey_jobs.find_one({"id": mission_id}, {"_id": 0})

    @router.post("/{mission_id}/run")
    async def queue_run(mission_id: str, staff=Depends(require_staff)):
        job = await db.survey_jobs.find_one({"id": mission_id})
        if not job:
            raise HTTPException(status_code=404, detail="Không tìm thấy đợt bay")
        await db.survey_jobs.update_one(
            {"id": mission_id},
            {"$set": {"status": "queued", "error": None, "updated_at": now_utc()}},
        )
        return await db.survey_jobs.find_one({"id": mission_id}, {"_id": 0})

    return router
