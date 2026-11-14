"""Create a Hồ sơ vụ việc (cases collection) for every citizen report that has none yet.

Safe to run more than once: reports that already have case_id are skipped.

    backend\\venv\\Scripts\\python scripts\\migrate_reports_to_cases.py
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import case_flow as flow  # noqa: E402


def load_env() -> None:
    env = ROOT / "backend" / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())


def main() -> int:
    load_env()
    from pymongo import MongoClient, ReturnDocument

    db = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=30000)[os.environ.get("DB_NAME", "quyhoach")]
    now = datetime.now(timezone.utc)
    created = 0
    for report in db.reports.find({"case_id": {"$exists": False}}, {"_id": 0}):
        status = flow.CASE_STATUS_FROM_REPORT.get(report.get("status") or "received", "tiep_nhan")
        info = flow.STATUSES[status]
        year = (report.get("created_at") or now).year
        seq = db.counters.find_one_and_update({"id": f"case-{year}"}, {"$inc": {"seq": 1}}, upsert=True,
                                              return_document=ReturnDocument.AFTER)["seq"]
        user = db.users.find_one({"id": report.get("user_id")}, {"_id": 0, "full_name": 1}) or {}
        case = {
            "id": str(uuid.uuid4()),
            "code": f"HS-{year}-{seq:04d}",
            "source": "citizen_report",
            "report_id": report["id"],
            "reporter_user_id": report.get("user_id"),
            "reporter_name": report.get("user_name") or user.get("full_name"),
            "title": report.get("title"),
            "description": report.get("description"),
            "address": report.get("address"),
            "latitude": report.get("latitude"),
            "longitude": report.get("longitude"),
            "report_category": report.get("violation_type"),
            "photos": [p for p in [report.get("image_base64")] if p],
            "status": status,
            "step": info.step,
            "phase": info.phase,
            "migrated_from_status": report.get("status"),
            "created_at": report.get("created_at") or now,
            "updated_at": now,
            "timeline": [
                {"step": 1, "action": "open", "label": flow.STEPS[1], "status": "tiep_nhan", "note": None,
                 "by_id": report.get("user_id"), "by_name": report.get("user_name"), "by_role": "citizen",
                 "at": report.get("created_at") or now},
                {"step": info.step, "action": "migrate", "label": "Chuyển từ báo cáo cũ", "status": status,
                 "note": report.get("admin_response") or report.get("implementer_notes"),
                 "by_id": None, "by_name": report.get("handled_by"), "by_role": "system", "at": now},
            ],
        }
        if status == "khong_vi_pham":
            case["closed"] = {"reason": report.get("admin_response") or "Từ chối (báo cáo cũ)", "at": now}
        db.cases.insert_one(case)
        db.reports.update_one({"id": report["id"]}, {"$set": {"case_id": case["id"]}})
        created += 1
        print(f"  {case['code']} <- report {report['id'][:8]} ({report.get('status')} -> {status})")
    print(f"Created {created} case(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
