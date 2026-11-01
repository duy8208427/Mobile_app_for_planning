from __future__ import annotations

import json
import sys
import time
import traceback
from pathlib import Path

import typer

from detection.config import MODEL_PATH, POLL_SECONDS, WEB_CRS
from detection.pipeline.infer import mock_buildings_from_parcels, model_available, ortho_frame, run_onnx
from detection.pipeline.overlay import _to_crs, overlay_shapely
from detection.pipeline.postgis_io import (
    load_sample_parcels,
    postgis_available,
    seed_sample_parcels_postgis,
)
from detection.pipeline.regularize import regularize_feature
from detection.pipeline.sync_mongo import (
    load_parcels_mongo,
    mark_job,
    mongo_db,
    next_queued_job,
    write_violations,
)

app = typer.Typer(add_completion=False, no_args_is_help=True)


@app.command("inspect-gdb")
def inspect_gdb(
    gdb: Path = typer.Argument(
        Path(
            r"C:\Users\Administrator\Downloads\GIS_Gui Vu\Sở TNMT\BD_NenDiaChinh"
            r"\GeoDatabase\20250808_BanDoNenDiaChinh.gdb"
        )
    ),
):
    """Print FileGDB layer inventory (GDAL or catalog fallback)."""
    root = Path(__file__).resolve().parents[3]
    script = root / "scripts" / "inspect_gdb.py"
    sys.path.insert(0, str(script.parent))
    from inspect_gdb import inspect_catalog, inspect_with_ogr  # type: ignore

    report = {"gdb": str(gdb), "exists": gdb.exists(), "fallback": inspect_catalog(gdb)}
    ogr = inspect_with_ogr(gdb) if gdb.exists() else None
    if ogr:
        report["gdal"] = ogr
    typer.echo(json.dumps(report, ensure_ascii=False, indent=2))


@app.command("seed-parcels")
def seed_parcels():
    """Load sample Cao Lãnh parcels into PostGIS (and print count)."""
    if postgis_available():
        n = seed_sample_parcels_postgis()
        typer.echo(f"Seeded {n} sample parcels into PostGIS")
    else:
        typer.echo("PostGIS not reachable. Import GDB with scripts/import_cadastre_mongo.py")


def _to_web(features: list[dict], src_crs: str) -> list[dict]:
    from shapely.geometry import mapping, shape

    if not src_crs or src_crs.upper() in ("EPSG:4326", "WGS84"):
        return features
    out = []
    for feat in features:
        geom = _to_crs(shape(feat["geometry"]), src_crs, WEB_CRS)
        out.append({**feat, "geometry": mapping(geom)})
    return out


def _detect(cog_path: str | None, mock: bool) -> tuple[list[dict], list[dict]]:
    if mock:
        parcels = load_sample_parcels()
        return mock_buildings_from_parcels(parcels), parcels
    if not cog_path:
        raise RuntimeError("Chưa có ảnh trực giao. Dùng nút Import ảnh trực giao trên bản đồ.")
    path = Path(cog_path)
    if not path.exists():
        raise FileNotFoundError(f"Không thấy file ảnh: {path}")
    if not model_available():
        raise RuntimeError(
            f"Chưa có model ONNX tại {MODEL_PATH}. Không tạo điểm giả từ thửa."
        )
    bbox, src_crs = ortho_frame(path)
    buildings = _to_web([regularize_feature(f) for f in run_onnx(path)], src_crs)
    parcels = load_parcels_mongo(bbox)
    if not parcels:
        raise RuntimeError("Không có thửa địa chính trong khung ảnh này.")
    return buildings, parcels


def run_mission(mission: dict, mock: bool = False) -> int:
    mark_job(mission["id"], "running")
    buildings, parcels = _detect(mission.get("cog_path"), mock=mock)
    violations = overlay_shapely(buildings, parcels)
    count = write_violations(mission, violations, buildings)
    typer.echo(f"Mission {mission['id']}: {len(buildings)} buildings, {count} violations")
    return count


@app.command("run")
def run(
    mission_id: str = typer.Option(..., help="survey_jobs.id"),
    mock: bool = typer.Option(False, help="Skip YOLO; synthesize footprints from parcels"),
):
    db = mongo_db()
    job = db.survey_jobs.find_one({"id": mission_id}, {"_id": 0})
    if not job:
        raise typer.BadParameter(f"No survey_jobs document {mission_id}")
    try:
        run_mission(job, mock=mock)
    except Exception as exc:
        mark_job(mission_id, "error", error=str(exc))
        raise


@app.command("worker")
def worker(mock: bool = typer.Option(False)):
    """Poll Mongo survey_jobs with status=queued."""
    typer.echo("Detection worker polling survey_jobs…")
    while True:
        job = next_queued_job()
        if not job:
            time.sleep(POLL_SECONDS)
            continue
        try:
            if not job.get("cog_path"):
                raise RuntimeError("Đợt bay không có ảnh trực giao.")
            if mock:
                typer.echo("Bỏ qua --mock: ảnh trực giao không được đối chiếu bằng mái nhà giả.")
            run_mission(job, mock=False)
        except Exception as exc:
            traceback.print_exc()
            mark_job(job["id"], "error", error=str(exc))


@app.command("sample-overlay")
def sample_overlay():
    """Run mock detection against sample parcels without a Mongo job."""
    buildings = mock_buildings_from_parcels(load_sample_parcels())
    violations = overlay_shapely(buildings, load_sample_parcels())
    typer.echo(json.dumps({"buildings": len(buildings), "violations": violations}, default=str, indent=2)[:4000])
