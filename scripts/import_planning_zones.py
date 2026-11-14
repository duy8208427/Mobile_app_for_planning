"""Import the land-use plan (quy hoạch sử dụng đất) of TP. Cao Lãnh into Mongo planning_zones.

Replaces the demo zones. Used by the pre-check step (Case 3 - xây dựng không đúng quy hoạch).
Needs GDAL, so run with QGIS Python:

  "C:\\Program Files\\QGIS 4.0.3\\bin\\python-qgis.bat" scripts\\import_planning_zones.py "<...>\\TPCaoLanh.gdb" [SuDungDat_TNMT_QH]

MONGO_URL / DB_NAME come from the environment or backend/.env.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD_CODES = {"ODT", "ONT"}  # housing may be built (đất ở đô thị / nông thôn)

# Land-use codes (Thông tư 08/2024/TT-BTNMT and earlier lists); unknown codes show as the code itself
LAND_USE = {
    "ODT": "Đất ở tại đô thị", "ONT": "Đất ở tại nông thôn",
    "LUA": "Đất trồng lúa", "LUC": "Đất chuyên trồng lúa", "LUK": "Đất trồng lúa còn lại",
    "HNK": "Đất trồng cây hằng năm khác", "CLN": "Đất trồng cây lâu năm", "NTS": "Đất nuôi trồng thủy sản",
    "RSX": "Đất rừng sản xuất", "RPH": "Đất rừng phòng hộ", "NKH": "Đất nông nghiệp khác",
    "TSC": "Đất xây dựng trụ sở cơ quan", "CQP": "Đất quốc phòng", "CAN": "Đất an ninh",
    "DGD": "Đất xây dựng cơ sở giáo dục", "DYT": "Đất xây dựng cơ sở y tế", "DVH": "Đất xây dựng cơ sở văn hóa",
    "DTT": "Đất xây dựng cơ sở thể dục thể thao", "DXH": "Đất xây dựng cơ sở dịch vụ xã hội",
    "TMD": "Đất thương mại, dịch vụ", "SKC": "Đất cơ sở sản xuất phi nông nghiệp", "SKK": "Đất khu công nghiệp",
    "SKN": "Đất cụm công nghiệp", "SKS": "Đất sử dụng cho hoạt động khoáng sản",
    "DGT": "Đất giao thông", "DTL": "Đất thủy lợi", "DNL": "Đất công trình năng lượng",
    "DBV": "Đất công trình bưu chính, viễn thông", "DKV": "Đất khu vui chơi, giải trí công cộng",
    "DCH": "Đất chợ", "DDT": "Đất có di tích lịch sử - văn hóa", "DRA": "Đất bãi thải, xử lý chất thải",
    "TON": "Đất cơ sở tôn giáo", "TIN": "Đất cơ sở tín ngưỡng", "NTD": "Đất nghĩa trang, nhà tang lễ",
    "SON": "Đất sông, ngòi, kênh, rạch, suối", "MNC": "Đất có mặt nước chuyên dùng",
    "DSH": "Đất sinh hoạt cộng đồng", "PNK": "Đất phi nông nghiệp khác", "CSD": "Đất chưa sử dụng",
}


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
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    gdb = Path(sys.argv[1])
    layer_name = sys.argv[2] if len(sys.argv) > 2 else "SuDungDat_TNMT_QH"
    from osgeo import ogr, osr
    from pymongo import GEOSPHERE, MongoClient

    ogr.UseExceptions()
    ds = ogr.Open(str(gdb))
    layer = ds.GetLayerByName(layer_name)
    if layer is None:
        print(f"Layer {layer_name} not found", file=sys.stderr)
        return 1
    dst = osr.SpatialReference()
    dst.ImportFromEPSG(4326)
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(layer.GetSpatialRef(), dst)

    db = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=30000, socketTimeoutMS=120000)[
        os.environ.get("DB_NAME", "quyhoach")]
    now = datetime.now(timezone.utc)
    docs, skipped = [], 0
    for feat in layer:
        geom = feat.GetGeometryRef()
        if geom is None or geom.IsEmpty():
            skipped += 1
            continue
        geom = geom.Clone()
        geom.Transform(transform)
        if not geom.IsValid():
            geom = geom.Buffer(0)
        data = json.loads(geom.ExportToJson())
        if data.get("type") not in ("Polygon", "MultiPolygon"):
            skipped += 1
            continue
        env = geom.GetEnvelope()
        if not (105.0 <= env[0] and env[1] <= 106.3 and 10.0 <= env[2] and env[3] <= 11.3):
            skipped += 1
            continue
        code = (feat.GetField("mucDichSuDungQH") or "").strip().upper() or None
        docs.append({
            "id": str(uuid.uuid4()),
            "zone_code": code,
            "zone_name": LAND_USE.get(code or "", code or "Chưa xác định"),
            "allow_build": code in BUILD_CODES,
            "plan_year": feat.GetField("namQuyHoach"),
            "area_name": feat.GetField("tenVungQuyHoach"),
            "source": f"{gdb.name}:{layer_name}",
            "geometry": data,
            "updated_at": now,
        })
    db.planning_zones.delete_many({})
    for i in range(0, len(docs), 500):
        db.planning_zones.insert_many(docs[i:i + 500], ordered=False)
    db.planning_zones.create_index([("geometry", GEOSPHERE)], name="zones_geometry_2dsphere")
    codes: dict[str, int] = {}
    for d in docs:
        codes[d["zone_code"] or "?"] = codes.get(d["zone_code"] or "?", 0) + 1
    print(json.dumps({"inserted": len(docs), "skipped": skipped,
                      "top_codes": sorted(codes.items(), key=lambda x: -x[1])[:12]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
