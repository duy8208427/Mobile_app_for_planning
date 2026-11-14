"""Unit tests for the 16-step case workflow and the NĐ 339/2026 fine rules."""
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import case_flow as flow  # noqa: E402

NOW = datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc)
TOMORROW = (NOW + timedelta(days=1)).date().isoformat()
ADMIN = {"id": "u-admin", "role": "admin", "full_name": "Cán bộ Quản lý"}
OFFICER = {"id": "u-officer", "role": "manager", "full_name": "Cán bộ Xử lý"}
OTHER_OFFICER = {"id": "u-other", "role": "manager", "full_name": "Cán bộ khác"}
VIOLATOR = {"id": "u-violator", "role": "citizen", "full_name": "Người vi phạm"}
REPORTER = {"id": "u-reporter", "role": "citizen", "full_name": "Người phản ánh"}

RECORD = {
    "record_no": "BB-01/2026",
    "description": "Nhà 3 tầng xây mới, chưa có giấy phép",
    "violation_code": "SAI_QUY_HOACH",
    "work_type": "a",
    "construction_state": "da_hoan_thanh",
    "violator_name": "Nguyễn Văn B",
    "violator_phone": "0903333444",
    "subject_type": "ca_nhan",
    "stop_order": True,
    "photos": ["data:image/jpeg;base64,AAAA"],
}


def run(case, action, payload, user):
    sets, entry = flow.apply_action(case, action, payload, user, NOW)
    merged = dict(case)
    for key, value in sets.items():
        if "." in key:
            head, tail = key.split(".", 1)
            merged[head] = {**(merged.get(head) or {}), tail: value}
        else:
            merged[key] = value
    merged["timeline"] = list(case.get("timeline", [])) + [entry]
    return merged


def new_case():
    return {"id": "c1", "status": "tiep_nhan", "step": 1, "phase": 1, "timeline": [],
            "reporter_user_id": REPORTER["id"]}


def through_record(payload=None):
    c = run(new_case(), "precheck", {"result": "violation"}, ADMIN)
    c = run(c, "assign", {"officer_id": OFFICER["id"], "due_date": TOMORROW}, ADMIN)
    c = run(c, "accept", {}, OFFICER)
    c = run(c, "submit_record", payload or RECORD, OFFICER)
    c["violator_user_id"] = VIOLATOR["id"]
    return c


# ---------------- Fines (Điều 4, Điều 25) ----------------
@pytest.mark.parametrize("code,wt,org", [
    ("KHONG_PHEP", "a", (60, 80)), ("KHONG_PHEP", "d", (140, 160)),
    ("SAI_PHEP", "a", (30, 40)), ("SAI_PHEP", "b", (50, 70)),
    ("SAI_QUY_HOACH", "c", (160, 180)), ("LAN_CHIEM", "d", (200, 220)),
    ("TIEP_TUC_SAU_BIEN_BAN", "c", (400, 500)),
])
def test_fine_org_and_individual_half(code, wt, org):
    m = flow.MILLION
    assert flow.fine_range(code, wt, "to_chuc") == (org[0] * m, org[1] * m)
    assert flow.fine_range(code, wt, "ca_nhan") == (org[0] * m // 2, org[1] * m // 2)


def test_case1_house_individual_is_30_to_40_million():
    assert flow.fine_range("KHONG_PHEP", "a", "ca_nhan") == (30_000_000, 40_000_000)


def test_k12_repeat_range():
    assert flow.fine_range("TIEP_TUC_SAU_BIEN_BAN", "d", "to_chuc", "k12") == (800_000_000, 1_000_000_000)


def test_commune_authority_limit():
    assert not flow.exceeds_commune_authority(500_000_000, "to_chuc")
    assert flow.exceeds_commune_authority(500_000_001, "to_chuc")
    assert flow.exceeds_commune_authority(260_000_000, "ca_nhan")


def test_ai_suggestions():
    assert flow.suggest_code("LAN_RANH") == "LAN_CHIEM"
    assert flow.suggest_code("SAI_MDSD") == "SAI_QUY_HOACH"
    assert flow.suggest_code("NHA_MOI") == "KHONG_PHEP"
    assert flow.suggest_code("NHA_MOI", has_permit=True) == "SAI_PHEP"


# ---------------- Full flow: 16 steps, Case 3 ----------------
def test_full_flow_with_failed_reinspection():
    c = through_record()
    assert c["status"] == "cho_quyet_dinh" and c["phase"] == 3
    c = run(c, "decide", {"decision_no": "QĐ-01", "fine_amount": 45_000_000, "remedy_deadline": TOMORROW}, ADMIN)
    assert c["status"] == "cho_khac_phuc"
    assert c["decision"]["fine_min"] == 40_000_000 and c["decision"]["fine_max"] == 50_000_000
    c = run(c, "report_remediation", {"fine_paid": True, "photos": ["p"]}, VIOLATOR)
    c = run(c, "request_reinspection", {"due_date": TOMORROW}, ADMIN)
    c = run(c, "reinspect", {"result": "fail", "photos": ["p"], "note": "Chưa tháo dỡ hết"}, OFFICER)
    assert c["status"] == "cho_khac_phuc"
    c = run(c, "report_remediation", {"fine_paid": True, "photos": ["p2"]}, VIOLATOR)
    c = run(c, "request_reinspection", {"due_date": TOMORROW}, ADMIN)
    c = run(c, "reinspect", {"result": "pass", "photos": ["p3"]}, OFFICER)
    c = run(c, "close", {}, ADMIN)
    assert c["status"] == "da_dong" and c["step"] == 16 and c["phase"] == 4
    steps = [t["step"] for t in c["timeline"]]
    assert steps[:4] == [3, 5, 6, 8] and steps[-1] == 16


def test_no_violation_closes_at_step_4():
    c = run(new_case(), "precheck", {"result": "no_violation", "note": "Đã có giấy phép"}, ADMIN)
    assert c["status"] == "khong_vi_pham" and c["step"] == 4
    assert c["timeline"][-1]["label"] == flow.STEPS[4]


def test_return_record_loop():
    c = through_record()
    with pytest.raises(flow.FlowError):
        run(c, "return_record", {}, ADMIN)  # note required
    c = run(c, "return_record", {"note": "Bổ sung ảnh"}, ADMIN)
    assert c["status"] == "dang_kiem_tra"
    c = run(c, "submit_record", RECORD, OFFICER)
    assert c["status"] == "cho_quyet_dinh"


# ---------------- Điều 85 branch (Case 1/2 đang thi công) ----------------
def permit_case():
    return through_record({**RECORD, "violation_code": "KHONG_PHEP", "construction_state": "dang_thi_cong"})


def test_permit_branch_granted_then_check():
    c = run(permit_case(), "decide", {"decision_no": "QĐ-02", "fine_amount": 35_000_000}, ADMIN)
    assert c["status"] == "cho_cap_phep"
    assert c["permit_track"]["days"] == 35
    assert c["permit_track"]["deadline"] == (NOW.date() + timedelta(days=35)).isoformat()
    c = run(c, "submit_permit", {"permit_no": "GPXD-123"}, VIOLATOR)
    assert c["status"] == "cho_hau_kiem" and c["reinspection"]["kind"] == "permit_check"
    assert c["reinspection"]["due_date"] == (NOW.date() + timedelta(days=5)).isoformat()
    c = run(c, "reinspect", {"result": "pass", "photos": ["p"]}, OFFICER)
    assert c["status"] == "hau_kiem_dat"


def test_permit_branch_expired_means_demolish_in_15_days():
    c = run(permit_case(), "decide", {"decision_no": "QĐ-03", "fine_amount": 35_000_000}, ADMIN)
    c = run(c, "permit_expired", {}, ADMIN)
    assert c["status"] == "cho_khac_phuc"
    assert c["decision"]["remedy_deadline"] == (NOW.date() + timedelta(days=15)).isoformat()


def test_project_gets_120_days():
    c = through_record({**RECORD, "violation_code": "SAI_PHEP", "construction_state": "dang_thi_cong",
                        "work_type": "c", "subject_type": "to_chuc"})
    c = run(c, "decide", {"decision_no": "QĐ-04", "fine_amount": 110_000_000}, ADMIN)
    assert c["permit_track"]["days"] == 120


# ---------------- Case 5 ----------------
def test_continuing_before_decision_becomes_case5_k11():
    c = through_record({**RECORD, "violation_code": "KHONG_PHEP", "construction_state": "dang_thi_cong"})
    c = run(c, "report_continuing", {"note": "Vẫn đổ bê tông"}, OFFICER)
    assert c["violation_code"] == "TIEP_TUC_SAU_BIEN_BAN" and c["repeat"]["clause"] == "k11"
    with pytest.raises(flow.FlowError):
        run(c, "decide", {"decision_no": "QĐ-05", "fine_amount": 20_000_000, "remedy_deadline": TOMORROW}, ADMIN)
    c = run(c, "decide", {"decision_no": "QĐ-05", "fine_amount": 35_000_000, "remedy_deadline": TOMORROW}, ADMIN)
    assert c["decision"]["violation_code"] == "TIEP_TUC_SAU_BIEN_BAN"
    assert "Tước quyền" in c["decision"]["extra_penalties"]


# ---------------- Validation & permissions ----------------
def test_fine_outside_range_rejected():
    c = through_record()
    with pytest.raises(flow.FlowError):
        run(c, "decide", {"decision_no": "QĐ", "fine_amount": 90_000_000, "remedy_deadline": TOMORROW}, ADMIN)


def test_record_requires_stop_order_and_photo():
    c = run(new_case(), "precheck", {"result": "violation"}, ADMIN)
    c = run(c, "assign", {"officer_id": OFFICER["id"], "due_date": TOMORROW}, ADMIN)
    c = run(c, "accept", {}, OFFICER)
    with pytest.raises(flow.FlowError):
        run(c, "submit_record", {**RECORD, "stop_order": False}, OFFICER)
    with pytest.raises(flow.FlowError):
        run(c, "submit_record", {**RECORD, "photos": []}, OFFICER)


@pytest.mark.parametrize("action,user", [
    ("precheck", OFFICER), ("precheck", REPORTER),
])
def test_wrong_role_rejected(action, user):
    with pytest.raises(flow.FlowError) as err:
        run(new_case(), action, {"result": "violation"}, user)
    assert err.value.status_code == 403


def test_only_assigned_officer_can_accept():
    c = run(new_case(), "precheck", {"result": "violation"}, ADMIN)
    c = run(c, "assign", {"officer_id": OFFICER["id"], "due_date": TOMORROW}, ADMIN)
    with pytest.raises(flow.FlowError):
        run(c, "accept", {}, OTHER_OFFICER)
    assert "accept" in flow.available_actions(OFFICER, c)
    assert flow.available_actions(OTHER_OFFICER, c) == []


def test_wrong_status_rejected():
    with pytest.raises(flow.FlowError):
        run(new_case(), "close", {}, ADMIN)


def test_overdue():
    c = run(new_case(), "precheck", {"result": "violation"}, ADMIN)
    c = run(c, "assign", {"officer_id": OFFICER["id"], "due_date": TOMORROW}, ADMIN)
    assert not flow.is_overdue(c, NOW.date())
    assert flow.is_overdue(c, NOW.date() + timedelta(days=2))
