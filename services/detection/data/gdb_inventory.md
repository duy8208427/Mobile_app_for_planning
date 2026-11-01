# FileGDB inventory — Bản đồ nền địa chính

Path: `C:\Users\Administrator\Downloads\GIS_Gui Vu\Sở TNMT\BD_NenDiaChinh\GeoDatabase\20250808_BanDoNenDiaChinh.gdb`

## What is in the GDB

FileGDB system tables occupy `a00000001`–`a00000007`. The only user feature class file is `a0000002a.*`, so this geodatabase has **one feature class** — typical for *bản đồ nền địa chính* (parcel polygons).

Run:

```
python scripts/inspect_gdb.py
ogrinfo -so "<path>.gdb"
```

If GDAL is present, use the printed layer name. Common ViLIS/ELIS names to try:

| Role | Candidate names |
|------|-----------------|
| Thửa đất | `THUA`, `DLthua`, `ThuaDat`, `NenDiaChinh` |
| Nhà (optional) | `NHA`, `DLnha` |

## Fields to map

| Canonical | Candidates |
|-----------|------------|
| `loai_dat` | `MDSDD`, `LOAIDAT`, `LoaiDat`, `KYHIEUMDSDD` |
| `so_to` | `SOTO`, `SOHIEUTO`, `KyHieuTo` |
| `so_thua` | `SOTHUA`, `SHTHUA`, `SoThuTuThua` |

`allow_build = true` when `loai_dat` is `ODT` or `ONT`.

## CRS

Dong Thap / Cao Lãnh uses **VN-2000 / TM-3 zone 105** = `EPSG:3405` for area (m²). Web maps use `EPSG:4326`. Do not use UTM WGS84 `EPSG:32648`.

## Import

```
docker compose up -d postgis
./scripts/import_cadastre.sh "<gdb>" THUA MDSDD SOTO SOTHUA
```

Until the GDB is imported, the API seeds a 1-commune demo around Cao Lãnh (`105.63, 10.45`) so overlay and UI can run.
