from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from shapely.geometry import Point, shape

from detection.pipeline.infer import mock_buildings_from_parcels
from detection.pipeline.overlay import overlay_shapely


def _parcels():
    return json.loads((ROOT / "data" / "sample_parcels.geojson").read_text(encoding="utf-8"))[
        "features"
    ]


def test_mock_overlay_finds_violations():
    parcels = _parcels()
    buildings = mock_buildings_from_parcels(parcels)
    violations = overlay_shapely(buildings, parcels)
    rules = {v["rule_id"] for v in violations}
    assert buildings, "expected mock footprints"
    assert "SAI_MDSD" in rules
    assert all(v["area_m2"] >= 0 for v in violations)
    hosts = [shape(p["geometry"]) for p in parcels]
    for v in violations:
        pt = Point(v["longitude"], v["latitude"])
        assert any(host.covers(pt) for host in hosts), v["rule_id"]


def test_roof_outside_cadastre_makes_no_point():
    parcels = _parcels()
    orphan = {
        "type": "Feature",
        "properties": {"confidence": 0.9, "tag": "city"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[105.70, 10.50], [105.701, 10.50], [105.701, 10.501], [105.70, 10.501], [105.70, 10.50]]],
        },
    }
    assert overlay_shapely([orphan], parcels) == []


if __name__ == "__main__":
    test_mock_overlay_finds_violations()
    test_roof_outside_cadastre_makes_no_point()
    print("ok")
