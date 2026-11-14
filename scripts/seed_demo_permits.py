"""Seed DEMO building permits (giấy phép xây dựng mẫu) on real residential parcels in TP. Cao Lãnh.

Every permit has is_demo=True. Real permit data replaces them later
(delete with: db.permits.deleteMany({is_demo: true})).

    backend\\venv\\Scripts\\python scripts\\seed_demo_permits.py [count]
"""
from __future__ import annotations

import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Huỳnh", "Võ", "Phan", "Đặng", "Bùi", "Đỗ"]
MIDDLE = ["Văn", "Thị", "Minh", "Hoàng", "Thanh", "Ngọc", "Hữu", "Quốc"]
GIVEN = ["An", "Bình", "Cường", "Dũng", "Hà", "Hạnh", "Khoa", "Lan", "Long", "Mai", "Nam", "Phúc", "Tâm", "Thảo", "Vy"]
# Inner city first, then the dense outer area where the map opens
AREAS = [((105.628, 10.452), (105.642, 10.466)), ((105.605, 10.468), (105.635, 10.49))]


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
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    from pymongo import MongoClient

    db = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=30000)[os.environ.get("DB_NAME", "quyhoach")]
    rng = random.Random(339)
    picked: list[dict] = []
    for (w, s), (e, n) in AREAS:
        rows = list(db.parcels.find(
            {"cx": {"$gte": w, "$lte": e}, "cy": {"$gte": s, "$lte": n},
             "loai_dat": {"$in": ["ODT", "ONT"]}, "so_to": {"$ne": None}, "so_thua": {"$ne": None}},
            {"_id": 0, "so_to": 1, "so_thua": 1, "DienTich": 1, "DiaChi": 1, "cx": 1, "cy": 1, "MaPhuongXa": 1},
        ).limit(3000))
        rng.shuffle(rows)
        picked += rows[: count // len(AREAS)]
    db.permits.delete_many({"is_demo": True})
    now = datetime.now(timezone.utc)
    docs = []
    for i, p in enumerate(picked, start=1):
        land = float(p.get("DienTich") or 100)
        issued = date(2024, 1, 1) + timedelta(days=rng.randint(0, 600))
        docs.append({
            "id": str(uuid.uuid4()),
            "permit_no": f"GPXD-MAU-{issued.year}-{i:03d}",
            "so_to": str(p["so_to"]),
            "so_thua": str(p["so_thua"]),
            "ma_phuong_xa": p.get("MaPhuongXa"),
            "owner_name": f"{rng.choice(FAMILY)} {rng.choice(MIDDLE)} {rng.choice(GIVEN)}",
            "address": p.get("DiaChi") or "TP. Cao Lãnh, Đồng Tháp",
            "work_type": "a",
            "floors": rng.choice([1, 2, 2, 3, 3, 4]),
            "area_m2": round(min(land * 0.8, 200.0), 1),
            "issued_date": issued.isoformat(),
            "issuer": "UBND phường (dữ liệu mẫu)",
            "longitude": p.get("cx"),
            "latitude": p.get("cy"),
            "is_demo": True,
            "created_at": now,
        })
    if docs:
        db.permits.insert_many(docs)
    db.permits.create_index([("so_to", 1), ("so_thua", 1)])
    print(f"Seeded {len(docs)} demo permits, e.g. tờ {docs[0]['so_to']} thửa {docs[0]['so_thua']} "
          f"({docs[0]['longitude']:.5f}, {docs[0]['latitude']:.5f})" if docs else "No parcels found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
