from __future__ import annotations

from shapely.geometry import Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry


def regularize_polygon(geom: BaseGeometry, simplify_m: float = 0.3) -> BaseGeometry:
    """Snap noisy YOLO outlines toward rectangular building footprints."""
    if geom is None or geom.is_empty:
        return geom
    g = geom.buffer(0)
    if g.is_empty:
        return geom
    g = g.simplify(simplify_m, preserve_topology=True)
    if g.area <= 0:
        return g
    try:
        mrr = g.minimum_rotated_rectangle
        if mrr.area > 0 and g.area / mrr.area >= 0.72:
            return mrr
    except Exception:
        pass
    return g


def regularize_feature(feature: dict) -> dict:
    geom = shape(feature["geometry"])
    clean = regularize_polygon(geom)
    out = dict(feature)
    if isinstance(clean, Polygon) or clean.geom_type in ("Polygon", "MultiPolygon"):
        out["geometry"] = mapping(clean)
    return out
