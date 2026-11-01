"""Inspect a File Geodatabase without QGIS (GDAL if present, else catalog strings)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DEFAULT_GDB = Path(
    r"C:\Users\Administrator\Downloads\GIS_Gui Vu\Sở TNMT\BD_NenDiaChinh"
    r"\GeoDatabase\20250808_BanDoNenDiaChinh.gdb"
)

LIKELY_LAYER = re.compile(
    r"(THUA|NHA|CONGTRINH|MDSDD|RANH|PARCEL|BUILDING|DIA_CHINH|DLthua|DLnha)",
    re.IGNORECASE,
)
LIKELY_FIELD = re.compile(
    r"(LOAIDAT|MDSDD|SOTO|SOTHUA|DIENTICH|SOHIEUTO|KYHIEU|SHTHUA|LOAI_DAT)",
    re.IGNORECASE,
)


def _utf16_strings(data: bytes, min_len: int = 3) -> list[str]:
    out: list[str] = []
    try:
        text = data.decode("utf-16-le", errors="ignore")
    except Exception:
        return out
    buf: list[str] = []
    for ch in text:
        if ch.isprintable() and ch != "\x00":
            buf.append(ch)
        else:
            if len(buf) >= min_len:
                out.append("".join(buf))
            buf = []
    if len(buf) >= min_len:
        out.append("".join(buf))
    return out


def inspect_with_ogr(gdb: Path) -> dict | None:
    try:
        from osgeo import ogr, osr  # type: ignore
    except Exception:
        return None
    ds = ogr.Open(str(gdb))
    if ds is None:
        return {"error": f"GDAL opened but could not read {gdb}"}
    layers = []
    for i in range(ds.GetLayerCount()):
        layer = ds.GetLayerByIndex(i)
        defn = layer.GetLayerDefn()
        srs = layer.GetSpatialRef()
        wkt = srs.ExportToWkt() if srs else None
        epsg = None
        if srs:
            srs.AutoIdentifyEPSG()
            epsg = srs.GetAuthorityCode(None)
        fields = [
            {"name": defn.GetFieldDefn(j).GetName(), "type": defn.GetFieldDefn(j).GetTypeName()}
            for j in range(defn.GetFieldCount())
        ]
        extent = layer.GetExtent()
        layers.append(
            {
                "name": layer.GetName(),
                "geom_type": ogr.GeometryTypeToName(layer.GetGeomType()),
                "count": layer.GetFeatureCount(),
                "epsg": epsg,
                "srs_wkt": wkt,
                "extent": extent,
                "fields": fields,
            }
        )
    return {"engine": "gdal", "layers": layers}


def inspect_catalog(gdb: Path) -> dict:
    catalog = gdb / "a00000001.gdbtable"
    user_fc = sorted(gdb.glob("a0000002*.gdbtable"))
    strings: list[str] = []
    if catalog.exists():
        strings = _utf16_strings(catalog.read_bytes())
    hits = sorted({s for s in strings if LIKELY_LAYER.search(s) or LIKELY_FIELD.search(s)})
    return {
        "engine": "catalog-strings",
        "gdb": str(gdb),
        "exists": gdb.exists(),
        "system_and_user_tables": [p.name for p in sorted(gdb.glob("*.gdbtable"))],
        "user_feature_class_candidates": [p.name for p in user_fc],
        "note": (
            "a00000001–a00000007 are FileGDB system tables. "
            "First user feature class is typically a0000002a. "
            "BanDoNenDiaChinh GDB in this bundle has one user FC."
        ),
        "catalog_hits": hits[:80],
        "assumed_layer_names": ["THUA", "DLthua", "ThuaDat", "NenDiaChinh"],
        "assumed_fields": {
            "so_to": ["SOTO", "SOHIEUTO", "KyHieuTo", "SHTo"],
            "so_thua": ["SOTHUA", "SHTHUA", "SoThuTuThua"],
            "loai_dat": ["MDSDD", "LOAIDAT", "LoaiDat", "KYHIEUMDSDD"],
        },
        "assumed_crs": {
            "geographic": "EPSG:4756 (VN-2000)",
            "projected_dong_thap": "EPSG:3405 (VN-2000 / TM-3 zone 105)",
            "web": "EPSG:4326",
        },
    }


def main() -> int:
    gdb = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GDB
    report: dict = {"gdb": str(gdb), "exists": gdb.exists()}
    ogr_result = inspect_with_ogr(gdb) if gdb.exists() else None
    if ogr_result:
        report["gdal"] = ogr_result
    report["fallback"] = inspect_catalog(gdb)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if gdb.exists() else 1


if __name__ == "__main__":
    raise SystemExit(main())
