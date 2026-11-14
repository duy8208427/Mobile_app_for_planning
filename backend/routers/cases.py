"""Hồ sơ vụ việc: one case per violation, through the 16-step flow (see case_flow.py)."""
from __future__ import annotations

import re
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

import case_flow as flow

STAFF_ROLES = ("admin", "manager")
# Statuses a violator sees (from the decision on)
VIOLATOR_STATUSES = ("cho_cap_phep", "cho_khac_phuc", "da_bao_cao_khac_phuc", "cho_hau_kiem", "hau_kiem_dat", "da_dong")
LIST_PROJECTION = {
    "_id": 0,
    "inspection.photos": 0,
    "remediation.photos": 0,
    "remediation.receipt_photo": 0,
    "reinspection.photos": 0,
    "repeat.photos": 0,
    "permit_track.photos": 0,
    "photos": 0,
}


def _digits(phone: Optional[str]) -> str:
    return re.sub(r"\D", "", phone or "")


def _case_view(case: dict, user: dict, today) -> dict:
    """Shape a case for this viewer. Reporters and violators never see each other."""
    role = user.get("role")
    out = dict(case)
    out["status_label"] = flow.STATUSES[case["status"]].label
    out["citizen_status_label"] = flow.STATUSES[case["status"]].citizen_label
    out["phase_label"] = flow.PHASES.get(case.get("phase"), "")
    out["deadline"] = flow.deadline_of(case)
    out["overdue"] = flow.is_overdue(case, today)
    out["available_actions"] = flow.available_actions(user, case)
    if case.get("violation_code"):
        out["violation_name"] = flow.VIOLATION_CATALOG[case["violation_code"]]["name"]
    if role == "admin":
        return out
    if role == "manager":
        return out  # access already limited to the assigned officer
    if case.get("violator_user_id") == user.get("id"):
        for key in ("reporter_user_id", "reporter_name", "report_id", "precheck", "assignment"):
            out.pop(key, None)
        out["timeline"] = [
            {k: t.get(k) for k in ("step", "label", "status", "at")}
            for t in case.get("timeline", []) if t.get("step", 0) >= 10
        ]
        return out
    # Reporter: progress only
    keep = ("id", "code", "title", "address", "source", "status", "step", "phase", "created_at", "updated_at",
            "status_label", "citizen_status_label", "phase_label")
    slim = {k: out.get(k) for k in keep}
    slim["timeline"] = [
        {"step": t.get("step"), "label": flow.STATUSES[t["status"]].citizen_label, "at": t.get("at")}
        for t in case.get("timeline", []) if t.get("status") in flow.STATUSES
    ]
    slim["available_actions"] = []
    return slim


def create_case_router(db, get_current_user, require_staff, require_admin, now_utc):
    router = APIRouter(tags=["cases"])

    async def notify(user_ids, title: str, body: str, case: dict) -> None:
        ids = [u for u in dict.fromkeys(user_ids) if u]
        if not ids:
            return
        now = now_utc()
        await db.notifications.insert_many([
            {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "title": title,
                "body": body,
                "type": "case_status",
                "related_case_id": case["id"],
                "related_report_id": case.get("report_id"),
                "read": False,
                "created_at": now,
            }
            for uid in ids
        ])

    async def admin_ids() -> list[str]:
        rows = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(200)
        return [r["id"] for r in rows]

    async def next_code() -> str:
        year = now_utc().year
        counter = await db.counters.find_one_and_update(
            {"id": f"case-{year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True,
        )
        seq = (counter or {}).get("seq", 1)
        return f"HS-{year}-{seq:04d}"

    async def parcel_at(lon: Optional[float], lat: Optional[float]) -> Optional[dict]:
        if lon is None or lat is None:
            return None
        return await db.parcels.find_one(
            {"geometry": {"$geoIntersects": {"$geometry": {"type": "Point", "coordinates": [lon, lat]}}}},
            {"_id": 0, "id": 1, "SoTo": 1, "SoThua": 1, "so_to": 1, "so_thua": 1, "KyHieuLoaiDat": 1,
             "loai_dat": 1, "DienTich": 1, "DiaChi": 1, "allow_build": 1, "geometry": 1},
        )

    async def open_cases_on_parcel(so_to, so_thua, exclude_id=None) -> list[dict]:
        if not (so_to and so_thua):
            return []
        q = {"so_to": so_to, "so_thua": so_thua, "status": {"$nin": ["da_dong", "khong_vi_pham"]}}
        if exclude_id:
            q["id"] = {"$ne": exclude_id}
        return await db.cases.find(q, {"_id": 0, "id": 1, "code": 1, "status": 1, "source": 1}).to_list(20)

    async def insert_case(doc: dict, actor: dict, step: int, label: str) -> dict:
        now = now_utc()
        doc.update({
            "id": str(uuid.uuid4()),
            "code": await next_code(),
            "status": "tiep_nhan",
            "step": step,
            "phase": 1,
            "created_at": now,
            "updated_at": now,
            "timeline": [{
                "step": step, "action": "open", "label": label, "status": "tiep_nhan", "note": None,
                "by_id": actor.get("id"), "by_name": actor.get("full_name"), "by_role": actor.get("role"), "at": now,
            }],
        })
        parcel = await parcel_at(doc.get("longitude"), doc.get("latitude"))
        if parcel:
            doc.setdefault("so_to", parcel.get("so_to") or parcel.get("SoTo"))
            doc.setdefault("so_thua", parcel.get("so_thua") or parcel.get("SoThua"))
            doc.setdefault("loai_dat", parcel.get("loai_dat") or parcel.get("KyHieuLoaiDat"))
            doc.setdefault("parcel_id", parcel.get("id"))
        await db.cases.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def create_case_from_report(report: dict, reporter: dict) -> dict:
        photos = [p for p in ([report.get("image_base64")] + list(report.get("images") or [])) if p]
        case = await insert_case({
            "source": "citizen_report",
            "report_id": report["id"],
            "reporter_user_id": reporter["id"],
            "reporter_name": reporter.get("full_name"),
            "title": report["title"],
            "description": report["description"],
            "address": report.get("address"),
            "latitude": report.get("latitude"),
            "longitude": report.get("longitude"),
            "report_category": report.get("violation_type"),
            "photos": photos[:6],
        }, reporter, 1, flow.STEPS[1])
        await db.reports.update_one({"id": report["id"]}, {"$set": {"case_id": case["id"]}})
        await notify(await admin_ids(), "Phản ánh mới cần tiền kiểm",
                     f"{case['code']}: {case['title']}", case)
        return case

    router.create_case_from_report = create_case_from_report  # used by server.create_report

    async def load_case(case_id: str, user: dict) -> dict:
        case = await db.cases.find_one({"id": case_id}, {"_id": 0})
        if not case:
            raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ")
        role = user.get("role")
        if role == "admin":
            return case
        if role == "manager":
            if (case.get("assignment") or {}).get("officer_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Hồ sơ không được giao cho bạn")
            return case
        if case.get("violator_user_id") == user["id"] and case["status"] in VIOLATOR_STATUSES:
            return case
        if case.get("reporter_user_id") == user["id"]:
            return case
        raise HTTPException(status_code=403, detail="Không có quyền xem hồ sơ này")

    # ---------------- Catalog & reference ----------------
    @router.get("/violation-catalog")
    async def violation_catalog(user=Depends(get_current_user)):
        return {
            "violations": flow.catalog_public(),
            "work_types": flow.WORK_TYPES,
            "subject_types": flow.SUBJECT_TYPES,
            "construction_states": flow.CONSTRUCTION_STATES,
            "statuses": {k: {"label": v.label, "step": v.step, "phase": v.phase, "final": v.final}
                         for k, v in flow.STATUSES.items()},
            "phases": flow.PHASES,
            "steps": flow.STEPS,
            "actions": {k: {"label": v["label"], "step": v["step"]} for k, v in flow.ACTIONS.items()},
            "ai_rule_suggestion": flow.AI_RULE_SUGGESTION,
            "authority_limit": {"to_chuc": flow.authority_limit("to_chuc"), "ca_nhan": flow.authority_limit("ca_nhan")},
            "permit_days": {"house": flow.PERMIT_DAYS_HOUSE, "project": flow.PERMIT_DAYS_PROJECT,
                            "check": flow.PERMIT_CHECK_DAYS, "demolish": flow.DEMOLISH_DAYS},
            "legal_note": flow.LEGAL_NOTE,
        }

    @router.get("/permits")
    async def list_permits(
        so_to: Optional[str] = None, so_thua: Optional[str] = None, q: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        filt: dict = {}
        if so_to:
            filt["so_to"] = so_to
        if so_thua:
            filt["so_thua"] = so_thua
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"permit_no": rx}, {"owner_name": rx}, {"address": rx}]
        rows = await db.permits.find(filt, {"_id": 0}).limit(100).to_list(100)
        total = await db.permits.estimated_document_count()
        return {"items": rows, "total_in_db": total}

    @router.get("/cases/officers")
    async def list_officers(staff=Depends(require_admin)):
        rows = await db.users.find({"role": "manager"}, {"_id": 0, "id": 1, "full_name": 1, "phone": 1}).to_list(500)
        return rows

    # ---------------- Cases ----------------
    @router.get("/cases")
    async def list_cases(
        status: Optional[str] = None,
        phase: Optional[int] = None,
        violation_code: Optional[str] = None,
        overdue: bool = False,
        role_view: Optional[str] = Query(None, description="citizen: my reports | violator: decisions about me"),
        user=Depends(get_current_user),
    ):
        role = user.get("role")
        q: dict = {}
        if role == "admin":
            pass
        elif role == "manager":
            q["assignment.officer_id"] = user["id"]
        elif role_view == "violator":
            q["violator_user_id"] = user["id"]
            q["status"] = {"$in": list(VIOLATOR_STATUSES)}
        else:
            q["reporter_user_id"] = user["id"]
        if status:
            q["status"] = status
        if phase:
            q["phase"] = phase
        if violation_code:
            q["violation_code"] = violation_code
        rows = await db.cases.find(q, LIST_PROJECTION).sort("updated_at", -1).to_list(1000)
        today = now_utc().date()
        out = [_case_view(r, user, today) for r in rows]
        if overdue:
            out = [r for r in out if r.get("overdue")]
        if role in STAFF_ROLES:
            for r in out:
                r.pop("timeline", None)
        return out

    @router.get("/cases/stats")
    async def case_stats(staff=Depends(require_staff)):
        q = {} if staff["role"] == "admin" else {"assignment.officer_id": staff["id"]}
        rows = await db.cases.find(q, {"_id": 0, "status": 1, "phase": 1, "violation_code": 1, "assignment": 1,
                                      "decision": 1, "permit_track": 1, "reinspection": 1}).to_list(5000)
        today = now_utc().date()
        by_status: dict[str, int] = {}
        by_phase: dict[str, int] = {}
        by_code: dict[str, int] = {}
        overdue = 0
        for r in rows:
            by_status[r["status"]] = by_status.get(r["status"], 0) + 1
            by_phase[str(r.get("phase"))] = by_phase.get(str(r.get("phase")), 0) + 1
            if r.get("violation_code"):
                by_code[r["violation_code"]] = by_code.get(r["violation_code"], 0) + 1
            if flow.is_overdue(r, today):
                overdue += 1
        open_count = sum(n for s, n in by_status.items() if not flow.STATUSES[s].final)
        return {"total": len(rows), "open": open_count, "overdue": overdue,
                "by_status": by_status, "by_phase": by_phase, "by_code": by_code}

    @router.get("/cases/{case_id}")
    async def get_case(case_id: str, user=Depends(get_current_user)):
        case = await load_case(case_id, user)
        return _case_view(case, user, now_utc().date())

    @router.get("/cases/{case_id}/precheck-context")
    async def precheck_context(case_id: str, staff=Depends(require_staff)):
        case = await load_case(case_id, staff)
        parcel = await parcel_at(case.get("longitude"), case.get("latitude"))
        zone = None
        if case.get("longitude") is not None and case.get("latitude") is not None:
            zone = await db.planning_zones.find_one(
                {"geometry": {"$geoIntersects": {"$geometry": {
                    "type": "Point", "coordinates": [case["longitude"], case["latitude"]]}}}},
                {"_id": 0, "geometry": 0},
            )
        so_to = case.get("so_to") or (parcel or {}).get("so_to") or (parcel or {}).get("SoTo")
        so_thua = case.get("so_thua") or (parcel or {}).get("so_thua") or (parcel or {}).get("SoThua")
        permits = []
        if so_to and so_thua:
            permits = await db.permits.find({"so_to": str(so_to), "so_thua": str(so_thua)}, {"_id": 0}).to_list(20)
        permits_total = await db.permits.estimated_document_count()
        current_use = ((parcel or {}).get("loai_dat") or (parcel or {}).get("KyHieuLoaiDat") or "").upper() or None
        planned_use = (zone or {}).get("zone_code")
        plan_check = None
        if zone:
            plan_check = {
                "current_use": current_use,
                "planned_use": planned_use,
                "planned_name": zone.get("zone_name"),
                "plan_year": zone.get("plan_year"),
                "housing_allowed": bool(zone.get("allow_build")),
                "same_use": bool(current_use and planned_use and current_use == planned_use),
            }
        suggestion = case.get("violation_code")
        reason = None
        if not suggestion and case.get("ai_rule"):
            suggestion = flow.suggest_code(case["ai_rule"], has_permit=bool(permits))
            reason = "Theo luật phát hiện của AI"
        if not suggestion and plan_check:
            if not plan_check["housing_allowed"]:
                suggestion = "SAI_QUY_HOACH"
                reason = f"Vị trí thuộc quy hoạch {planned_use} ({zone.get('zone_name')}), không phải đất ở"
            elif permits:
                suggestion = "SAI_PHEP"
                reason = "Thửa đã có giấy phép: kiểm tra xây dựng sai nội dung giấy phép"
            else:
                suggestion = "KHONG_PHEP"
                reason = "Quy hoạch cho phép đất ở nhưng chưa tìm thấy giấy phép xây dựng cho thửa"
        return {
            "parcel": parcel,
            "zone": zone,
            "plan_check": plan_check,
            "suggestion_reason": reason,
            "permits": permits,
            "permits_loaded": permits_total > 0,
            "suggested_code": suggestion,
            "duplicates": await open_cases_on_parcel(so_to, so_thua, case["id"]),
        }

    @router.post("/cases/from-violation/{violation_id}")
    async def open_case_from_violation(violation_id: str, staff=Depends(require_admin)):
        v = await db.violations.find_one({"id": violation_id}, {"_id": 0})
        if not v:
            raise HTTPException(status_code=404, detail="Không tìm thấy nghi vấn")
        if v.get("case_id"):
            existing = await db.cases.find_one({"id": v["case_id"]}, {"_id": 0})
            if existing:
                return _case_view(existing, staff, now_utc().date())
        has_permit = False
        so_to = v.get("so_to") or v.get("SoTo")
        so_thua = v.get("so_thua") or v.get("SoThua")
        if so_to and so_thua:
            has_permit = await db.permits.count_documents({"so_to": str(so_to), "so_thua": str(so_thua)}) > 0
        case = await insert_case({
            "source": "ai_violation",
            "violation_id": violation_id,
            "mission_id": v.get("mission_id"),
            "ai_rule": v.get("rule_id"),
            "suggested_code": flow.suggest_code(v.get("rule_id"), has_permit),
            "title": v.get("reason") or "Nghi vấn từ ảnh flycam",
            "description": v.get("reason"),
            "address": v.get("DiaChi"),
            "latitude": v.get("latitude"),
            "longitude": v.get("longitude"),
            "so_to": str(so_to) if so_to else None,
            "so_thua": str(so_thua) if so_thua else None,
            "loai_dat": v.get("loai_dat") or v.get("KyHieuLoaiDat"),
            "area_m2": v.get("area_m2"),
            "geometry": v.get("geometry"),
            "photos": [v["thumbnail_url"]] if v.get("thumbnail_url") else [],
        }, staff, 2, flow.STEPS[2])
        await db.violations.update_one({"id": violation_id}, {"$set": {"case_id": case["id"], "updated_at": now_utc()}})
        return _case_view(case, staff, now_utc().date())

    @router.post("/cases/{case_id}/actions/{action}")
    async def run_action(case_id: str, action: str, payload: dict[str, Any] = Body(default={}),
                         user=Depends(get_current_user)):
        case = await load_case(case_id, user)
        if action == "assign" and payload.get("officer_id"):
            officer = await db.users.find_one({"id": payload["officer_id"], "role": "manager"}, {"_id": 0})
            if not officer:
                raise HTTPException(status_code=400, detail="Cán bộ xử lý không hợp lệ")
            payload["officer_name"] = officer["full_name"]
        if action == "request_reinspection" and payload.get("officer_id"):
            officer = await db.users.find_one({"id": payload["officer_id"], "role": "manager"}, {"_id": 0})
            if not officer:
                raise HTTPException(status_code=400, detail="Cán bộ xử lý không hợp lệ")
            payload["officer_name"] = officer["full_name"]
        try:
            sets, entry = flow.apply_action(case, action, payload, user, now_utc())
        except flow.FlowError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc))

        if action == "submit_record":
            phone = _digits((sets.get("violator") or {}).get("phone"))
            if phone:
                users = await db.users.find({"role": "citizen", "phone": {"$ne": None}},
                                            {"_id": 0, "id": 1, "phone": 1}).to_list(5000)
                match = next((u for u in users if _digits(u.get("phone")) == phone), None)
                sets["violator_user_id"] = match["id"] if match else None

        await db.cases.update_one({"id": case_id}, {"$set": sets, "$push": {"timeline": entry}})
        updated = await db.cases.find_one({"id": case_id}, {"_id": 0})

        if updated.get("report_id"):
            await db.reports.update_one({"id": updated["report_id"]}, {"$set": {
                "status": flow.REPORT_STATUS_FOR[updated["status"]],
                "handled_by": user.get("full_name"),
                "updated_at": now_utc(),
            }})
        if updated.get("violation_id") and action == "precheck":
            await db.violations.update_one({"id": updated["violation_id"]}, {"$set": {
                "status": "rejected" if updated["status"] == "khong_vi_pham" else "confirmed",
                "reviewed_by": user.get("full_name"), "updated_at": now_utc(),
            }})

        officer_id = (updated.get("assignment") or {}).get("officer_id")
        violator_id = updated.get("violator_user_id")
        reporter_id = updated.get("reporter_user_id")
        code = updated["code"]
        admins = await admin_ids()
        messages = {
            "precheck": ([reporter_id] if updated["status"] == "khong_vi_pham" else [],
                         "Kết quả tiền kiểm", f"{code}: không phát hiện vi phạm, hồ sơ đã đóng."),
            "assign": ([officer_id], "Bạn được giao kiểm tra thực địa",
                       f"{code}: hạn {(updated.get('assignment') or {}).get('due_date')}."),
            "accept": ([reporter_id], "Đang kiểm tra thực địa", f"{code}: cán bộ đã đến hiện trường."),
            "submit_record": (admins, "Biên bản hiện trường chờ ra quyết định", f"{code}: đã lập biên bản."),
            "return_record": ([officer_id], "Biên bản cần bổ sung", f"{code}: {entry.get('note') or ''}"),
            "decide": ([violator_id], "Quyết định xử phạt vi phạm hành chính",
                       f"{code}: số {(updated.get('decision') or {}).get('decision_no')}. Vui lòng xem chi tiết và thực hiện."),
            "report_continuing": (admins, "Phát hiện tiếp tục thi công sau biên bản", f"{code}: cần xử lý theo Case 5."),
            "submit_permit": ([officer_id] + admins, "Kiểm tra hiện trạng sau khi có giấy phép",
                              f"{code}: kiểm tra trong {flow.PERMIT_CHECK_DAYS} ngày."),
            "permit_expired": ([violator_id], "Buộc phá dỡ công trình vi phạm",
                               f"{code}: tự phá dỡ trong {flow.DEMOLISH_DAYS} ngày."),
            "report_remediation": (admins, "Có báo cáo khắc phục mới", f"{code}: chờ yêu cầu hậu kiểm."),
            "request_reinspection": ([officer_id], "Yêu cầu hậu kiểm thực địa",
                                     f"{code}: hạn {(updated.get('reinspection') or {}).get('due_date')}."),
            "reinspect": (admins + ([violator_id] if updated["status"] == "cho_khac_phuc" else []),
                          "Kết quả hậu kiểm",
                          f"{code}: {'đạt' if updated['status'] == 'hau_kiem_dat' else 'không đạt, cần tiếp tục khắc phục'}."),
            "close": ([reporter_id, violator_id], "Hồ sơ đã đóng", f"{code}: vụ việc đã xử lý xong."),
        }
        if action in messages:
            targets, title, body = messages[action]
            await notify([t for t in targets if t and t != user.get("id")], title, body, updated)
        if action == "decide" and reporter_id:
            await notify([reporter_id], "Phản ánh đang được xử lý", f"{code}: đã ban hành quyết định xử lý.", updated)

        return _case_view(updated, user, now_utc().date())

    return router
