"""Import FileGDB ThuaDat into MongoDB parcels (WGS84). Run with QGIS Python if needed:

  "C:\\Program Files\\QGIS 3.44.15\\bin\\python-qgis-ltr.bat" scripts/import_cadastre_mongo.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GDB_DEFAULT = Path(
    r"C:\Users\Administrator\Downloads\GIS_Gui Vu\Sở TNMT\BD_NenDiaChinh"
    r"\GeoDatabase\20250808_BanDoNenDiaChinh.gdb"
)
LAYER_DEFAULT = "ThuaDat"
LEGAL_CODES = {"ODT", "ONT"}
SKIP_GDB_FIELDS = {"SHAPE", "geometry", "id"}
BATCH = 500


def _load_dotenv() -> None:
    env_path = ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip())


def _json_value(val):
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()
        except Exception:
            return str(val)
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    if isinstance(val, (str, int, float, bool)):
        if isinstance(val, str):
            text = val.strip()
            return text if text else None
        return val
    return str(val)


def _gdb_attrs(feat) -> dict:
    defn = feat.GetDefnRef()
    out: dict = {}
    for j in range(defn.GetFieldCount()):
        name = defn.GetFieldDefn(j).GetName()
        if name in SKIP_GDB_FIELDS:
            continue
        val = _json_value(feat.GetField(j))
        if val is not None:
            out[name] = val
    return out


def _first(attrs: dict, *names: str) -> str | None:
    for name in names:
        val = attrs.get(name)
        if val is None:
            continue
        text = str(val).strip()
        if text:
            return text
    return None


def _allow_build(loai: str | None) -> bool:
    if not loai:
        return False
    code = loai.upper().replace(" ", "")
    return any(code == c or code.startswith(c) for c in LEGAL_CODES)


def _geom_to_geojson(geom) -> dict | None:
    if geom is None or geom.IsEmpty():
        return None
    try:
        if not geom.IsValid():
            geom = geom.Buffer(0)
        if geom is None or geom.IsEmpty():
            return None
        raw = geom.ExportToJson()
        data = json.loads(raw)
        if data.get("type") not in ("Polygon", "MultiPolygon"):
            return None
        return data
    except Exception:
        return None


def _expand_extent(ext: list[float] | None, geom) -> list[float]:
    env = geom.GetEnvelope()  # minx, maxx, miny, maxy
    if ext is None:
        return [env[0], env[2], env[1], env[3]]
    ext[0] = min(ext[0], env[0])
    ext[1] = min(ext[1], env[2])
    ext[2] = max(ext[2], env[1])
    ext[3] = max(ext[3], env[3])
    return ext


def _insert_batch(coll, batch: list[dict], attempts: int = 6) -> None:
    """insert_many that survives a flaky link to Atlas.

    pymongo sets _id on each dict before sending, so a retry after a dropped
    connection re-sends the same _ids: rows that already landed come back as
    duplicate-key errors (11000), which are treated as done.
    """
    from pymongo.errors import BulkWriteError, ConnectionFailure

    for attempt in range(1, attempts + 1):
        try:
            coll.insert_many(batch, ordered=False)
            return
        except BulkWriteError as exc:
            errors = exc.details.get("writeErrors", [])
            if errors and all(e.get("code") == 11000 for e in errors) and not exc.details.get("writeConcernErrors"):
                return
            raise
        except ConnectionFailure as exc:
            if attempt == attempts:
                raise
            wait = 5 * attempt
            print(f"  network error ({type(exc).__name__}), retry {attempt}/{attempts - 1} in {wait}s…")
            time.sleep(wait)


def main() -> int:
    _load_dotenv()
    gdb = Path(sys.argv[1]) if len(sys.argv) > 1 else GDB_DEFAULT
    layer_name = sys.argv[2] if len(sys.argv) > 2 else LAYER_DEFAULT
    if not gdb.exists():
        print(f"GDB not found: {gdb}", file=sys.stderr)
        return 1

    try:
        from osgeo import ogr, osr
    except ImportError:
        print(
            "Need GDAL (osgeo). Run with:\n"
            r'  "C:\Program Files\QGIS 3.44.15\bin\python-qgis-ltr.bat" scripts\import_cadastre_mongo.py',
            file=sys.stderr,
        )
        return 1

    try:
        from pymongo import MongoClient, GEOSPHERE
    except ImportError:
        print("Installing pymongo into this Python…")
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "pymongo"])
        from pymongo import MongoClient, GEOSPHERE

    ogr.UseExceptions()
    ds = ogr.Open(str(gdb))
    if ds is None:
        print(f"Cannot open {gdb}", file=sys.stderr)
        return 1
    layer = ds.GetLayerByName(layer_name)
    if layer is None:
        names = [ds.GetLayer(i).GetName() for i in range(ds.GetLayerCount())]
        print(f"Layer {layer_name} not found. Available: {names}", file=sys.stderr)
        return 1

    src_srs = layer.GetSpatialRef()
    dst_srs = osr.SpatialReference()
    dst_srs.ImportFromEPSG(4326)
    dst_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(src_srs, dst_srs) if src_srs else None
    src_wkt = src_srs.ExportToWkt() if src_srs else None

    mongo_url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
    db_name = os.environ.get("DB_NAME", "quyhoach")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=30000, socketTimeoutMS=120000, retryWrites=True)
    db = client[db_name]
    print(f"Clearing Mongo.{db_name}.parcels and importing {layer.GetFeatureCount()} features from {layer_name}…")
    db.parcels.delete_many({})

    batch: list[dict] = []
    inserted = 0
    skipped = 0
    extent = None
    now = datetime.now(timezone.utc)
    layer.ResetReading()
    feat = layer.GetNextFeature()
    while feat is not None:
        geom = feat.GetGeometryRef()
        if geom is None:
            skipped += 1
            feat = layer.GetNextFeature()
            continue
        geom = geom.Clone()
        if transform is not None:
            try:
                geom.Transform(transform)
            except Exception:
                skipped += 1
                feat = layer.GetNextFeature()
                continue
        geojson = _geom_to_geojson(geom)
        if not geojson:
            skipped += 1
            feat = layer.GetNextFeature()
            continue
        attrs = _gdb_attrs(feat)
        fid = feat.GetFID()
        loai = _first(attrs, "KyHieuLoaiDat", "MucDichSuDungDat")
        loai_norm = (loai or "").upper().strip() or None
        thua_id = _first(attrs, "thuaDatID") or str(fid)
        cx = cy = None
        try:
            ring = geojson["coordinates"][0][0] if geojson["type"] == "MultiPolygon" else geojson["coordinates"][0]
            cx = sum(p[0] for p in ring) / len(ring)
            cy = sum(p[1] for p in ring) / len(ring)
        except Exception:
            pass
        doc = {
            **attrs,
            "id": str(thua_id),
            "cx": cx,
            "cy": cy,
            "OBJECTID": attrs.get("OBJECTID") if attrs.get("OBJECTID") is not None else fid,
            "so_to": _first(attrs, "SoTo", "SoHieuToBanDoCu"),
            "so_thua": _first(attrs, "SoThua", "SoThuaMoi", "SoThuTuThuaCu"),
            "loai_dat": loai_norm,
            "allow_build": _allow_build(loai_norm),
            "xa": _first(attrs, "MaPhuongXa", "Ap", "KhuPho"),
            "dia_chi": _first(attrs, "DiaChi", "TenConDuong"),
            "dien_tich": attrs.get("DienTich"),
            "source": "gdb",
            "source_layer": layer_name,
            "geometry": geojson,
            "updated_at": now,
        }
        extent = _expand_extent(extent, geom)
        batch.append(doc)
        if len(batch) >= BATCH:
            _insert_batch(db.parcels, batch)
            inserted += len(batch)
            batch = []
            if inserted % 5000 == 0:
                print(f"  inserted {inserted}…")
        feat = layer.GetNextFeature()

    if batch:
        _insert_batch(db.parcels, batch)
        inserted += len(batch)

    db.parcels.create_index([("geometry", GEOSPHERE)], name="parcels_geometry_2dsphere")
    db.parcels.create_index("loai_dat")
    db.parcels.create_index("KyHieuLoaiDat")
    db.parcels.create_index([("so_to", 1), ("so_thua", 1)])
    db.parcels.create_index([("SoTo", 1), ("SoThua", 1)])
    db.parcels.create_index([("cx", 1), ("cy", 1)], name="parcels_cx_cy")

    west, south, east, north = extent or [105.4, 10.2, 105.9, 10.9]
    meta = {
        "id": "current",
        "count": inserted,
        "skipped": skipped,
        "layer": layer_name,
        "gdb": str(gdb),
        "crs_src": src_wkt,
        "crs_web": "EPSG:4326",
        "west": west,
        "south": south,
        "east": east,
        "north": north,
        "imported_at": now,
        "fields": [
            layer.GetLayerDefn().GetFieldDefn(j).GetName()
            for j in range(layer.GetLayerDefn().GetFieldCount())
        ],
    }
    db.cadastre_meta.replace_one({"id": "current"}, meta, upsert=True)
    print(json.dumps({k: meta[k] for k in ("count", "skipped", "layer", "west", "south", "east", "north")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
