param(
  [string]$GdbPath = "C:\Users\Administrator\Downloads\GIS_Gui Vu\Sở TNMT\BD_NenDiaChinh\GeoDatabase\20250808_BanDoNenDiaChinh.gdb",
  [string]$Layer = "",
  [string]$LoaiField = "MDSDD",
  [string]$SoToField = "SOTO",
  [string]$SoThuaField = "SOTHUA",
  [string]$PgHost = "localhost",
  [string]$TargetSrs = "EPSG:3405"
)

$ErrorActionPreference = "Stop"
Write-Host "Inspecting $GdbPath"
if (-not (Test-Path $GdbPath)) { throw "GDB not found: $GdbPath" }

python "$PSScriptRoot\inspect_gdb.py" $GdbPath

if (-not $Layer) {
  Write-Host "Set -Layer to the parcel feature class (THUA / DLthua / ThuaDat) then re-run."
  Write-Host "If ogr2ogr is installed:"
  Write-Host "  ogrinfo -so `"$GdbPath`""
  exit 0
}

$env:PGPASSWORD = "quyhoach"
$pg = "PG:host=$PgHost user=quyhoach password=quyhoach dbname=quyhoach_gis"
ogr2ogr -overwrite -f PostgreSQL $pg $GdbPath $Layer `
  -nln cadastre.parcels_raw -nlt PROMOTE_TO_MULTI -t_srs $TargetSrs `
  -lco GEOMETRY_NAME=geom -lco FID=ogc_fid

Write-Host "Raw layer loaded. Mapping fields $LoaiField / $SoToField / $SoThuaField — run docker/postgis mapping SQL next or detection import-cadastre."
