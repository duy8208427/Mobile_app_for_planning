"""Violation case workflow (16 steps, 4 phases) and the 5 focus violations.

Pure module: no database or FastAPI imports, so it can be unit tested.

Sources:
- Flow diagram "Phát hiện & Tiền kiểm → Thực địa & Biên bản → Quyết định & Xử lý
  → Hậu kiểm & Đóng hồ sơ" (16 steps).
- Nghị định 339/2026/NĐ-CP: Điều 25 (khoản 6, 7, 9, 10, 11, 12, 13, 14),
  Điều 4 khoản 4 (fines in the decree are for organisations; individuals pay half),
  Điều 79 (Chủ tịch UBND cấp xã: up to 500 million VND for organisations),
  Điều 85 (35/120 days to obtain a permit, 5-day check, 15-day demolition).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

MILLION = 1_000_000

# ---------------------------------------------------------------------------
# Catalog of the 5 focus violations (Điều 25, NĐ 339/2026)
# Fine ranges are for ORGANISATIONS, in million VND, per work type:
#   a = nhà ở riêng lẻ
#   b = nhà ở riêng lẻ trong khu vực bảo vệ di tích/di sản, hoặc công trình khác
#   c = công trình phải lập Báo cáo kinh tế - kỹ thuật
#   d = công trình phải lập Báo cáo nghiên cứu khả thi
# ---------------------------------------------------------------------------
WORK_TYPES = {
    "a": "Nhà ở riêng lẻ",
    "b": "Nhà ở riêng lẻ trong khu vực bảo vệ di tích, di sản hoặc công trình khác",
    "c": "Công trình phải lập Báo cáo kinh tế - kỹ thuật",
    "d": "Công trình phải lập Báo cáo nghiên cứu khả thi",
}

SUBJECT_TYPES = {"ca_nhan": "Cá nhân", "to_chuc": "Tổ chức"}

CONSTRUCTION_STATES = {
    "dang_thi_cong": "Đang thi công",
    "da_hoan_thanh": "Đã thi công xong",
}

VIOLATION_CATALOG: dict[str, dict] = {
    "KHONG_PHEP": {
        "code": "KHONG_PHEP",
        "order": 1,
        "name": "Xây dựng không có giấy phép xây dựng",
        "behavior": "Thi công công trình thuộc diện phải có giấy phép xây dựng nhưng chưa được cấp giấy phép.",
        "legal_basis": "Khoản 7 và khoản 14 Điều 25 Nghị định 339/2026/NĐ-CP",
        "fines": {"a": (60, 80), "b": (80, 100), "c": (120, 140), "d": (140, 160)},
        "remedy": "Đang thi công và đủ điều kiện: làm thủ tục cấp giấy phép (Điều 85). "
                  "Không đủ điều kiện hoặc đã thi công xong: buộc phá dỡ công trình, phần công trình vi phạm.",
        "permit_track": True,
    },
    "SAI_PHEP": {
        "code": "SAI_PHEP",
        "order": 2,
        "name": "Xây dựng sai nội dung giấy phép xây dựng",
        "behavior": "Thi công không đúng nội dung giấy phép xây dựng đã được cấp.",
        "legal_basis": "Khoản 6 và khoản 14 Điều 25 Nghị định 339/2026/NĐ-CP",
        "fines": {"a": (30, 40), "b": (50, 70), "c": (100, 120), "d": (120, 140)},
        "remedy": "Đang thi công và đủ điều kiện: làm thủ tục điều chỉnh giấy phép (Điều 85). "
                  "Không đủ điều kiện hoặc đã thi công xong: buộc phá dỡ phần công trình sai phép.",
        "permit_track": True,
    },
    "SAI_QUY_HOACH": {
        "code": "SAI_QUY_HOACH",
        "order": 3,
        "name": "Xây dựng không đúng quy hoạch được phê duyệt",
        "behavior": "Tổ chức thi công công trình không đúng quy hoạch đô thị và nông thôn đã được phê duyệt.",
        "legal_basis": "Khoản 9 và khoản 14 Điều 25 Nghị định 339/2026/NĐ-CP",
        "fines": {"a": (80, 100), "b": (100, 120), "c": (160, 180), "d": (180, 200)},
        "remedy": "Buộc phá dỡ công trình hoặc phần công trình vi phạm.",
        "permit_track": False,
    },
    "LAN_CHIEM": {
        "code": "LAN_CHIEM",
        "order": 4,
        "name": "Cơi nới, lấn chiếm diện tích hoặc không gian trái phép",
        "behavior": "Xây dựng cơi nới, lấn chiếm diện tích, không gian thuộc quyền quản lý, sử dụng hợp pháp "
                    "của người khác hoặc khu vực công cộng, khu vực sử dụng chung.",
        "legal_basis": "Khoản 10 và khoản 14 Điều 25 Nghị định 339/2026/NĐ-CP",
        "fines": {"a": (80, 100), "b": (100, 120), "c": (180, 200), "d": (200, 220)},
        "remedy": "Buộc phá dỡ phần công trình vi phạm.",
        "permit_track": False,
    },
    "TIEP_TUC_SAU_BIEN_BAN": {
        "code": "TIEP_TUC_SAU_BIEN_BAN",
        "order": 5,
        "name": "Tiếp tục xây dựng sau khi đã bị lập biên bản và yêu cầu chấm dứt",
        "behavior": "Tiếp tục thực hiện hành vi thuộc khoản 4, 6, 7, 8, 9 hoặc 10 sau khi đã bị lập biên bản "
                    "và yêu cầu chấm dứt hành vi vi phạm, trước khi ban hành quyết định xử phạt.",
        "legal_basis": "Khoản 11, khoản 13 và khoản 14 Điều 25 Nghị định 339/2026/NĐ-CP",
        "fines": {"a": (60, 80), "b": (80, 100), "c": (400, 500), "d": (500, 600)},
        # Khoản 12: tái phạm sau khi đã bị xử phạt (kể cả trong thời gian chờ cấp phép, Điều 85.2.e)
        "fines_k12": {"a": (80, 100), "b": (100, 120), "c": (400, 800), "d": (800, 1000)},
        "remedy": "Áp dụng biện pháp khắc phục của hành vi gốc.",
        "extra_penalties": "Tước quyền sử dụng giấy phép xây dựng từ 03 đến 12 tháng tuỳ loại công trình; "
                           "tịch thu tang vật, phương tiện vi phạm (khoản 13).",
        "permit_track": False,
    },
}

# AI detection rule -> suggested violation code (confirmed by the manager at pre-check)
AI_RULE_SUGGESTION = {
    "SAI_MDSD": "SAI_QUY_HOACH",
    "LAN_RANH": "LAN_CHIEM",
    "NHA_MOI": "KHONG_PHEP",  # becomes SAI_PHEP when a permit exists for the parcel
}

# Chủ tịch UBND cấp xã (Điều 79): max fine for organisations; individuals = half (Điều 4.6)
COMMUNE_CHAIR_LIMIT_ORG = 500 * MILLION

PERMIT_DAYS_HOUSE = 35       # nhà ở riêng lẻ (Điều 85.2.a)
PERMIT_DAYS_PROJECT = 120    # công trình phải lập BCKTKT / BCNCKT
PERMIT_CHECK_DAYS = 5        # kiểm tra hiện trạng sau khi có giấy phép (Điều 85.2.d)
DEMOLISH_DAYS = 15           # tự phá dỡ (Điều 85.2.d)

LEGAL_NOTE = ("Khung phạt là gợi ý theo Nghị định 339/2026/NĐ-CP. Người có thẩm quyền quyết định mức phạt cụ thể "
              "sau khi đối chiếu văn bản gốc và tình tiết vụ việc.")


class FlowError(Exception):
    """Invalid transition, wrong role or missing data. Message is user-facing Vietnamese."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def fine_range(code: str, work_type: str, subject_type: str, clause: str = "k11") -> tuple[int, int]:
    """Fine range in VND. Decree amounts are for organisations; individuals pay half (Điều 4.4.a)."""
    entry = VIOLATION_CATALOG.get(code)
    if not entry:
        raise FlowError("Mã hành vi vi phạm không hợp lệ.")
    table = entry["fines_k12"] if (clause == "k12" and "fines_k12" in entry) else entry["fines"]
    if work_type not in table:
        raise FlowError("Loại công trình không hợp lệ.")
    lo, hi = table[work_type]
    lo, hi = lo * MILLION, hi * MILLION
    if subject_type == "ca_nhan":
        lo, hi = lo // 2, hi // 2
    elif subject_type != "to_chuc":
        raise FlowError("Đối tượng vi phạm phải là cá nhân hoặc tổ chức.")
    return lo, hi


def authority_limit(subject_type: str) -> int:
    return COMMUNE_CHAIR_LIMIT_ORG if subject_type == "to_chuc" else COMMUNE_CHAIR_LIMIT_ORG // 2


def exceeds_commune_authority(amount: int, subject_type: str) -> bool:
    return amount > authority_limit(subject_type)


def permit_days(work_type: str) -> int:
    return PERMIT_DAYS_PROJECT if work_type in ("c", "d") else PERMIT_DAYS_HOUSE


def suggest_code(ai_rule: Optional[str], has_permit: bool = False) -> Optional[str]:
    code = AI_RULE_SUGGESTION.get(ai_rule or "")
    if code == "KHONG_PHEP" and has_permit:
        return "SAI_PHEP"
    return code


# ---------------------------------------------------------------------------
# Statuses, steps and phases
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class StatusInfo:
    label: str
    step: int
    phase: int
    citizen_label: str
    final: bool = False


STATUSES: dict[str, StatusInfo] = {
    "tiep_nhan": StatusInfo("Tiếp nhận", 2, 1, "Đã tiếp nhận"),
    "da_tien_kiem": StatusInfo("Đã tiền kiểm", 3, 1, "Đã tiếp nhận"),
    "khong_vi_pham": StatusInfo("Không vi phạm - đã đóng", 4, 1, "Không phát hiện vi phạm", final=True),
    "da_giao_viec": StatusInfo("Đã giao việc", 5, 1, "Đang kiểm tra thực địa"),
    "dang_kiem_tra": StatusInfo("Đang kiểm tra thực địa", 7, 2, "Đang kiểm tra thực địa"),
    "cho_quyet_dinh": StatusInfo("Chờ ra quyết định", 9, 3, "Đang kiểm tra thực địa"),
    "cho_cap_phep": StatusInfo("Chờ cấp/điều chỉnh giấy phép", 11, 3, "Đang xử lý vi phạm"),
    "cho_khac_phuc": StatusInfo("Chờ khắc phục", 11, 3, "Đang xử lý vi phạm"),
    "da_bao_cao_khac_phuc": StatusInfo("Đã báo cáo khắc phục", 12, 3, "Đang xử lý vi phạm"),
    "cho_hau_kiem": StatusInfo("Chờ hậu kiểm", 14, 4, "Đang xử lý vi phạm"),
    "hau_kiem_dat": StatusInfo("Hậu kiểm đạt", 15, 4, "Đang xử lý vi phạm"),
    "da_dong": StatusInfo("Đã đóng hồ sơ", 16, 4, "Đã xử lý xong", final=True),
}

PHASES = {
    1: "Phát hiện và Tiền kiểm",
    2: "Kiểm tra thực địa và Lập biên bản",
    3: "Ban hành quyết định và Xử lý",
    4: "Hậu kiểm và Đóng hồ sơ",
}

STEPS = {
    1: "Người dân gửi phản ánh vi phạm",
    2: "Hệ thống AI gửi cảnh báo điểm nghi ngờ vi phạm",
    3: "Tiền kiểm online (đối chiếu bản đồ, giấy phép)",
    4: "Không vi phạm: đóng cảnh báo",
    5: "Lập phiếu giao việc, điều động thực địa",
    6: "Di chuyển đến hiện trường kiểm tra",
    7: "Thu thập bằng chứng, xác định vi phạm",
    8: "Lập biên bản hiện trường và gửi hồ sơ",
    9: "Rà soát hồ sơ, áp dụng mức phạt",
    10: "Ban hành quyết định xử phạt, yêu cầu khắc phục",
    11: "Nộp phạt và thực hiện khắc phục",
    12: "Báo cáo kết quả khắc phục lên hệ thống",
    13: "Yêu cầu xác minh hiện trạng sau khắc phục",
    14: "Hậu kiểm thực địa",
    15: "Trả kết quả xác nhận đã khắc phục",
    16: "Đóng hồ sơ lưu trữ",
}

# Legacy report.status shown by older citizen screens
REPORT_STATUS_FOR = {
    "tiep_nhan": "received",
    "da_tien_kiem": "received",
    "khong_vi_pham": "rejected",
    "da_giao_viec": "assigned",
    "dang_kiem_tra": "assigned",
    "cho_quyet_dinh": "pending_approval",
    "cho_cap_phep": "assigned",
    "cho_khac_phuc": "assigned",
    "da_bao_cao_khac_phuc": "assigned",
    "cho_hau_kiem": "assigned",
    "hau_kiem_dat": "assigned",
    "da_dong": "resolved",
}

# Legacy report.status -> case status (migration)
CASE_STATUS_FROM_REPORT = {
    "received": "tiep_nhan",
    "assigned": "da_giao_viec",
    "processing": "da_giao_viec",
    "pending_approval": "cho_quyet_dinh",
    "resolved": "da_dong",
    "rejected": "khong_vi_pham",
}

# ---------------------------------------------------------------------------
# Actions
# who: "admin" = Cán bộ Quản lý, "officer" = Cán bộ Xử lý được giao,
#      "violator" = người vi phạm có tài khoản (or staff entering on their behalf)
# ---------------------------------------------------------------------------
ACTIONS: dict[str, dict] = {
    "precheck": {"from": {"tiep_nhan"}, "who": {"admin"}, "label": "Tiền kiểm online", "step": 3},
    "assign": {"from": {"da_tien_kiem"}, "who": {"admin"}, "label": "Lập phiếu giao việc", "step": 5},
    "accept": {"from": {"da_giao_viec"}, "who": {"officer"}, "label": "Nhận việc, đến hiện trường", "step": 6},
    "submit_record": {"from": {"dang_kiem_tra"}, "who": {"officer"},
                      "label": "Lập biên bản hiện trường, gửi hồ sơ", "step": 8},
    "return_record": {"from": {"cho_quyet_dinh"}, "who": {"admin"}, "label": "Trả lại bổ sung biên bản", "step": 9},
    "decide": {"from": {"cho_quyet_dinh"}, "who": {"admin"}, "label": "Ban hành quyết định xử phạt", "step": 10},
    "report_continuing": {"from": {"cho_quyet_dinh", "cho_cap_phep", "cho_khac_phuc"},
                          "who": {"admin", "officer"}, "label": "Ghi nhận vẫn tiếp tục thi công", "step": 7},
    "submit_permit": {"from": {"cho_cap_phep"}, "who": {"violator", "admin"},
                      "label": "Nộp giấy phép được cấp/điều chỉnh", "step": 11},
    "permit_expired": {"from": {"cho_cap_phep"}, "who": {"admin"},
                       "label": "Hết hạn/không được cấp phép: buộc phá dỡ", "step": 10},
    "report_remediation": {"from": {"cho_khac_phuc"}, "who": {"violator", "admin", "officer"},
                           "label": "Báo cáo kết quả khắc phục", "step": 12},
    "request_reinspection": {"from": {"da_bao_cao_khac_phuc"}, "who": {"admin"},
                             "label": "Yêu cầu hậu kiểm", "step": 13},
    "reinspect": {"from": {"cho_hau_kiem"}, "who": {"officer"}, "label": "Trả kết quả hậu kiểm", "step": 15},
    "close": {"from": {"hau_kiem_dat"}, "who": {"admin"}, "label": "Đóng hồ sơ lưu trữ", "step": 16},
}


def actor_kinds(user: dict, case: dict) -> set[str]:
    """Which action roles this user may play on this case."""
    kinds: set[str] = set()
    role = user.get("role")
    if role == "admin":
        kinds.add("admin")
    assigned = (case.get("assignment") or {}).get("officer_id")
    if role == "manager" and assigned and assigned == user.get("id"):
        kinds.add("officer")
    if case.get("violator_user_id") and case.get("violator_user_id") == user.get("id"):
        kinds.add("violator")
    return kinds


def available_actions(user: dict, case: dict) -> list[str]:
    kinds = actor_kinds(user, case)
    status = case.get("status")
    out = []
    for name, spec in ACTIONS.items():
        if status in spec["from"] and kinds & spec["who"]:
            if name == "report_continuing" and not (case.get("inspection") or {}).get("record_no"):
                continue
            out.append(name)
    return out


def _require(payload: dict, *keys: str) -> None:
    missing = [k for k in keys if payload.get(k) in (None, "", [])]
    if missing:
        raise FlowError("Thiếu thông tin bắt buộc: " + ", ".join(missing))


def _parse_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError as exc:
        raise FlowError("Ngày không hợp lệ (định dạng YYYY-MM-DD).") from exc


def _iso(d: date) -> str:
    return d.isoformat()


def apply_action(case: dict, action: str, payload: dict, user: dict, now: datetime) -> tuple[dict, dict]:
    """Validate and apply an action. Returns (set_fields, timeline_entry).

    Raises FlowError on a wrong role, wrong status or missing data. The caller
    persists set_fields, appends timeline_entry and sends notifications.
    """
    spec = ACTIONS.get(action)
    if not spec:
        raise FlowError("Thao tác không hợp lệ.", 404)
    status = case.get("status")
    if status not in spec["from"]:
        raise FlowError(f"Không thể '{spec['label']}' khi hồ sơ đang ở trạng thái "
                        f"'{STATUSES.get(status, StatusInfo(status or '?', 0, 0, '')).label}'.")
    if not (actor_kinds(user, case) & spec["who"]):
        raise FlowError("Bạn không có quyền thực hiện bước này.", 403)

    today = now.date()
    by = {"by_id": user.get("id"), "by_name": user.get("full_name"), "by_role": user.get("role"), "at": now}
    note = (payload.get("note") or "").strip() or None
    sets: dict = {}
    new_status = status
    step = spec["step"]

    if action == "precheck":
        result = payload.get("result")
        if result not in ("violation", "no_violation"):
            raise FlowError("Kết quả tiền kiểm phải là 'có vi phạm' hoặc 'không vi phạm'.")
        precheck = {"result": result, "notes": note, **by}
        if payload.get("violation_code"):
            if payload["violation_code"] not in VIOLATION_CATALOG:
                raise FlowError("Mã hành vi vi phạm không hợp lệ.")
            precheck["violation_code"] = payload["violation_code"]
            sets["violation_code"] = payload["violation_code"]
        for key in ("permit_checked", "zone_checked"):
            if key in payload:
                precheck[key] = payload[key]
        sets["precheck"] = precheck
        if result == "no_violation":
            new_status, step = "khong_vi_pham", 4
            sets["closed"] = {"reason": "Không vi phạm sau tiền kiểm", **by}
        else:
            new_status = "da_tien_kiem"

    elif action == "assign":
        _require(payload, "officer_id", "due_date")
        due = _parse_date(payload["due_date"])
        if due < today:
            raise FlowError("Hạn xử lý không được trước ngày hôm nay.")
        sets["assignment"] = {
            "officer_id": payload["officer_id"],
            "officer_name": payload.get("officer_name"),
            "due_date": _iso(due),
            "instructions": (payload.get("instructions") or "").strip() or None,
            **by,
        }
        new_status = "da_giao_viec"

    elif action == "accept":
        sets["inspection.started_at"] = now
        new_status = "dang_kiem_tra"

    elif action == "submit_record":
        _require(payload, "record_no", "description", "violation_code", "work_type",
                 "construction_state", "violator_name", "subject_type")
        if payload["violation_code"] not in VIOLATION_CATALOG:
            raise FlowError("Mã hành vi vi phạm không hợp lệ.")
        if payload["work_type"] not in WORK_TYPES:
            raise FlowError("Loại công trình không hợp lệ.")
        if payload["construction_state"] not in CONSTRUCTION_STATES:
            raise FlowError("Tình trạng thi công không hợp lệ.")
        if payload["subject_type"] not in SUBJECT_TYPES:
            raise FlowError("Đối tượng vi phạm phải là cá nhân hoặc tổ chức.")
        if not payload.get("stop_order"):
            raise FlowError("Biên bản phải kèm yêu cầu chấm dứt hành vi vi phạm (Điều 87).")
        photos = payload.get("photos") or []
        if not photos:
            raise FlowError("Cần ít nhất 1 ảnh bằng chứng hiện trường.")
        if len(photos) > 6:
            raise FlowError("Tối đa 6 ảnh bằng chứng.")
        sets.update({
            "violation_code": payload["violation_code"],
            "work_type": payload["work_type"],
            "construction_state": payload["construction_state"],
            "subject_type": payload["subject_type"],
            "violator": {
                "name": payload["violator_name"].strip(),
                "phone": (payload.get("violator_phone") or "").strip() or None,
                "address": (payload.get("violator_address") or "").strip() or None,
                "subject_type": payload["subject_type"],
            },
            "inspection": {
                "started_at": (case.get("inspection") or {}).get("started_at"),
                "record_no": payload["record_no"].strip(),
                "description": payload["description"].strip(),
                "area_m2": payload.get("area_m2"),
                "photos": photos,
                "stop_order": True,
                "submitted_at": now,
                **by,
            },
        })
        new_status = "cho_quyet_dinh"

    elif action == "return_record":
        if not note:
            raise FlowError("Cần ghi rõ nội dung cần bổ sung.")
        new_status = "dang_kiem_tra"

    elif action == "decide":
        _require(payload, "decision_no", "fine_amount")
        code = payload.get("violation_code") or case.get("violation_code")
        work_type = payload.get("work_type") or case.get("work_type")
        subject = payload.get("subject_type") or case.get("subject_type")
        state = payload.get("construction_state") or case.get("construction_state")
        if not (code and work_type and subject):
            raise FlowError("Thiếu hành vi, loại công trình hoặc đối tượng vi phạm.")
        clause = "k12" if (code == "TIEP_TUC_SAU_BIEN_BAN" and (case.get("repeat") or {}).get("clause") == "k12") else "k11"
        lo, hi = fine_range(code, work_type, subject, clause)
        try:
            amount = int(payload["fine_amount"])
        except (TypeError, ValueError) as exc:
            raise FlowError("Mức phạt phải là số tiền (đồng).") from exc
        if not lo <= amount <= hi:
            raise FlowError(f"Mức phạt phải trong khung {lo:,} – {hi:,} đồng.".replace(",", "."))
        entry = VIOLATION_CATALOG[code]
        use_permit = bool(entry.get("permit_track")) and state == "dang_thi_cong" and bool(payload.get("permit_track", True))
        decision = {
            "decision_no": str(payload["decision_no"]).strip(),
            "violation_code": code,
            "work_type": work_type,
            "subject_type": subject,
            "fine_amount": amount,
            "fine_min": lo,
            "fine_max": hi,
            "legal_basis": entry["legal_basis"],
            "remedy": (payload.get("remedy") or entry["remedy"]).strip(),
            "extra_penalties": payload.get("extra_penalties") or entry.get("extra_penalties"),
            "exceeds_commune_authority": exceeds_commune_authority(amount, subject),
            "issued_date": _iso(today),
            **by,
        }
        sets.update({"violation_code": code, "work_type": work_type, "subject_type": subject,
                     "construction_state": state, "decision": decision})
        if use_permit:
            days = permit_days(work_type)
            sets["permit_track"] = {"deadline": _iso(today + timedelta(days=days)), "days": days, "status": "waiting"}
            new_status = "cho_cap_phep"
        else:
            _require(payload, "remedy_deadline")
            deadline = _parse_date(payload["remedy_deadline"])
            if deadline < today:
                raise FlowError("Hạn khắc phục không được trước ngày hôm nay.")
            decision["remedy_deadline"] = _iso(deadline)
            new_status = "cho_khac_phuc"

    elif action == "report_continuing":
        clause = "k12" if status in ("cho_cap_phep", "cho_khac_phuc") else "k11"
        sets["repeat"] = {
            "clause": clause,
            "original_code": case.get("violation_code"),
            "note": note,
            "photos": payload.get("photos") or [],
            **by,
        }
        if status == "cho_quyet_dinh":
            # Before the decision: the case becomes khoản 11 and is decided at that level
            sets["violation_code"] = "TIEP_TUC_SAU_BIEN_BAN"
        # After a decision (k12) the case keeps its status; staff open a new decision outside this demo

    elif action == "submit_permit":
        _require(payload, "permit_no")
        track = dict(case.get("permit_track") or {})
        track.update({"status": "granted", "permit_no": str(payload["permit_no"]).strip(),
                      "submitted_at": now, "photos": payload.get("photos") or []})
        sets["permit_track"] = track
        sets["reinspection"] = {"kind": "permit_check",
                                "due_date": _iso(today + timedelta(days=PERMIT_CHECK_DAYS)),
                                "requested_at": now}
        new_status = "cho_hau_kiem"
        step = 13

    elif action == "permit_expired":
        track = dict(case.get("permit_track") or {})
        track.update({"status": "expired", "closed_at": now})
        sets["permit_track"] = track
        sets["decision.remedy"] = "Buộc phá dỡ công trình, phần công trình vi phạm (hết hạn hoặc không được cấp phép)."
        sets["decision.remedy_deadline"] = _iso(today + timedelta(days=DEMOLISH_DAYS))
        new_status = "cho_khac_phuc"

    elif action == "report_remediation":
        photos = payload.get("photos") or []
        if not photos:
            raise FlowError("Cần ít nhất 1 ảnh hiện trạng sau khắc phục.")
        sets["remediation"] = {
            "fine_paid": bool(payload.get("fine_paid")),
            "receipt_photo": payload.get("receipt_photo"),
            "photos": photos[:6],
            "notes": note,
            **by,
        }
        new_status = "da_bao_cao_khac_phuc"

    elif action == "request_reinspection":
        _require(payload, "due_date")
        due = _parse_date(payload["due_date"])
        officer_id = payload.get("officer_id") or (case.get("assignment") or {}).get("officer_id")
        if not officer_id:
            raise FlowError("Cần chọn cán bộ xử lý hậu kiểm.")
        sets["reinspection"] = {"kind": "post_remediation", "due_date": _iso(due), "requested_at": now, "note": note}
        if officer_id != (case.get("assignment") or {}).get("officer_id"):
            sets["assignment.officer_id"] = officer_id
            sets["assignment.officer_name"] = payload.get("officer_name")
        new_status = "cho_hau_kiem"

    elif action == "reinspect":
        result = payload.get("result")
        if result not in ("pass", "fail"):
            raise FlowError("Kết quả hậu kiểm phải là 'đạt' hoặc 'không đạt'.")
        photos = payload.get("photos") or []
        if not photos:
            raise FlowError("Cần ít nhất 1 ảnh hậu kiểm.")
        kind = (case.get("reinspection") or {}).get("kind", "post_remediation")
        sets["reinspection.result"] = result
        sets["reinspection.photos"] = photos[:6]
        sets["reinspection.notes"] = note
        sets["reinspection.done_at"] = now
        sets["reinspection.by_name"] = user.get("full_name")
        if result == "pass":
            new_status = "hau_kiem_dat"
        else:
            new_status = "cho_khac_phuc"
            if kind == "permit_check":
                sets["decision.remedy"] = ("Buộc phá dỡ phần công trình không phù hợp giấy phép "
                                           "(Điều 85.2.d Nghị định 339/2026/NĐ-CP).")
            sets["decision.remedy_deadline"] = _iso(today + timedelta(days=DEMOLISH_DAYS))

    elif action == "close":
        sets["closed"] = {"reason": note or "Đã khắc phục, đóng hồ sơ lưu trữ", **by}
        new_status = "da_dong"

    info = STATUSES[new_status]
    sets.update({"status": new_status, "step": info.step, "phase": info.phase, "updated_at": now})
    label = STEPS[4] if new_status == "khong_vi_pham" else spec["label"]
    timeline = {"step": step, "action": action, "label": label, "status": new_status, "note": note, **by}
    return sets, timeline


def deadline_of(case: dict) -> Optional[str]:
    """The deadline that matters for the current status (ISO date), if any."""
    status = case.get("status")
    if status in ("da_giao_viec", "dang_kiem_tra"):
        return (case.get("assignment") or {}).get("due_date")
    if status == "cho_cap_phep":
        return (case.get("permit_track") or {}).get("deadline")
    if status == "cho_khac_phuc":
        return (case.get("decision") or {}).get("remedy_deadline")
    if status == "cho_hau_kiem":
        return (case.get("reinspection") or {}).get("due_date")
    return None


def is_overdue(case: dict, today: date) -> bool:
    d = deadline_of(case)
    return bool(d) and _parse_date(d) < today and not STATUSES[case["status"]].final


def catalog_public() -> list[dict]:
    out = []
    for entry in sorted(VIOLATION_CATALOG.values(), key=lambda e: e["order"]):
        row = {k: v for k, v in entry.items() if k not in ("fines", "fines_k12")}
        row["fines_org"] = {wt: {"min": lo * MILLION, "max": hi * MILLION} for wt, (lo, hi) in entry["fines"].items()}
        row["fines_individual"] = {wt: {"min": lo * MILLION // 2, "max": hi * MILLION // 2}
                                   for wt, (lo, hi) in entry["fines"].items()}
        out.append(row)
    return out
