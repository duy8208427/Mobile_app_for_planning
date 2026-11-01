#!/usr/bin/env bash
# Import FileGDB parcels into PostGIS cadastre.parcels.
# Usage:
#   ./scripts/import_cadastre.sh [GDB_PATH] [LAYER] [LOAI_DAT_FIELD] [SO_TO_FIELD] [SO_THUA_FIELD]
set -euo pipefail

GDB_PATH="${1:-/data/gdb/20250808_BanDoNenDiaChinh.gdb}"
LAYER="${2:-}"
LOAI_FIELD="${3:-MDSDD}"
SOTO_FIELD="${4:-SOTO}"
SOTHUA_FIELD="${5:-SOTHUA}"
PG="PG:host=${PGHOST:-localhost} user=${PGUSER:-quyhoach} password=${PGPASSWORD:-quyhoach} dbname=${PGDATABASE:-quyhoach_gis}"
TARGET_SRS="${TARGET_SRS:-EPSG:3405}"

if [[ -z "$LAYER" ]]; then
  echo "Listing layers in $GDB_PATH"
  ogrinfo -so "$GDB_PATH"
  echo
  echo "Pass the parcel layer name as argv2 (try THUA, DLthua, ThuaDat)."
  exit 1
fi

ogr2ogr -overwrite \
  -f PostgreSQL "$PG" \
  "$GDB_PATH" "$LAYER" \
  -nln cadastre.parcels_raw \
  -nlt PROMOTE_TO_MULTI \
  -t_srs "$TARGET_SRS" \
  -lco GEOMETRY_NAME=geom \
  -lco FID=ogc_fid \
  --config PG_USE_COPY YES

psql "$PG" <<SQL
INSERT INTO cadastre.parcels (id, so_to, so_thua, loai_dat, allow_build, dien_tich, source_layer, geom)
SELECT
  COALESCE(ogc_fid::text, md5(ST_AsBinary(geom))),
  NULLIF("${SOTO_FIELD}"::text, ''),
  NULLIF("${SOTHUA_FIELD}"::text, ''),
  upper(btrim(COALESCE("${LOAI_FIELD}"::text, ''))),
  upper(btrim(COALESCE("${LOAI_FIELD}"::text, ''))) IN ('ODT', 'ONT'),
  ST_Area(geom),
  '${LAYER}',
  ST_Multi(geom)
FROM cadastre.parcels_raw
ON CONFLICT (id) DO UPDATE SET
  so_to = EXCLUDED.so_to,
  so_thua = EXCLUDED.so_thua,
  loai_dat = EXCLUDED.loai_dat,
  allow_build = EXCLUDED.allow_build,
  dien_tich = EXCLUDED.dien_tich,
  geom = EXCLUDED.geom;
SQL

echo "Imported $LAYER into cadastre.parcels"
