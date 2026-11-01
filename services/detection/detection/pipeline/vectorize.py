from __future__ import annotations

from typing import Iterable

import numpy as np
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from detection.config import MIN_BUILDING_M2
from detection.pipeline.regularize import regularize_polygon


def mask_to_polygons(mask: np.ndarray, transform, min_area: float = MIN_BUILDING_M2) -> list[dict]:
    """Convert a binary mask (row, col) to GeoJSON polygons in the raster CRS."""
    try:
        from rasterio import features as rio_features
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("rasterio is required to vectorize YOLO masks") from exc

    geoms: list[dict] = []
    for geom, value in rio_features.shapes(mask.astype(np.uint8), mask=mask.astype(bool), transform=transform):
        if int(value) == 0:
            continue
        poly = shape(geom).buffer(0)
        if poly.is_empty:
            continue
        poly = regularize_polygon(poly)
        if poly.area < min_area:
            continue
        geoms.append({"type": "Feature", "properties": {}, "geometry": mapping(poly)})
    return geoms


def merge_overlapping(features: Iterable[dict]) -> list[dict]:
    shapes = [shape(f["geometry"]) for f in features if f.get("geometry")]
    if not shapes:
        return []
    merged = unary_union(shapes)
    parts = list(merged.geoms) if merged.geom_type == "MultiPolygon" else [merged]
    return [
        {"type": "Feature", "properties": {}, "geometry": mapping(p)}
        for p in parts
        if not p.is_empty
    ]
