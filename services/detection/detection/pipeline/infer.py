from __future__ import annotations

from pathlib import Path

import numpy as np

from detection.config import CONF_THRESHOLD, MODEL_PATH, TILE_OVERLAP, TILE_SIZE


def model_available() -> bool:
    return MODEL_PATH.exists()


def ortho_frame(cog_path: Path) -> tuple[tuple[float, float, float, float], str]:
    """WGS84 bounds of an orthophoto, plus the raster CRS string."""
    import rasterio
    from rasterio.warp import transform_bounds

    with rasterio.open(cog_path) as src:
        crs = src.crs
        epsg = crs.to_epsg() if crs is not None else 4326
        src_crs = f"EPSG:{epsg}" if epsg else (crs.to_wkt() if crs is not None else "EPSG:4326")
        if crs is None or epsg == 4326:
            west, south, east, north = src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top
        else:
            west, south, east, north = transform_bounds(crs, "EPSG:4326", *src.bounds, densify_pts=21)
    pad = 0.001
    return (west - pad, south - pad, east + pad, north + pad), src_crs


def _tiles(height: int, width: int, size: int, overlap: int):
    step = max(size - overlap, size // 2)
    for y in range(0, height, step):
        for x in range(0, width, step):
            y2 = min(y + size, height)
            x2 = min(x + size, width)
            yield x, y, x2, y2


def run_onnx(cog_path: Path, conf: float = CONF_THRESHOLD) -> list[dict]:
    import rasterio
    import onnxruntime as ort
    from PIL import Image

    from detection.pipeline.vectorize import mask_to_polygons, merge_overlapping

    features: list[dict] = []
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    # YOLO-seg ONNX layouts vary; use 640 square if dynamic.
    net_h = int(input_shape[2]) if isinstance(input_shape[2], int) and input_shape[2] > 0 else TILE_SIZE
    net_w = int(input_shape[3]) if isinstance(input_shape[3], int) and input_shape[3] > 0 else TILE_SIZE

    with rasterio.open(cog_path) as src:
        height, width = src.height, src.width
        for x0, y0, x1, y1 in _tiles(height, width, TILE_SIZE, TILE_OVERLAP):
            window = rasterio.windows.Window(x0, y0, x1 - x0, y1 - y0)
            arr = src.read(window=window)
            if arr.shape[0] >= 3:
                rgb = np.transpose(arr[:3], (1, 2, 0))
            else:
                band = arr[0]
                rgb = np.stack([band, band, band], axis=-1)
            rgb = np.clip(rgb, 0, 255).astype(np.uint8)
            img = Image.fromarray(rgb).resize((net_w, net_h))
            blob = np.asarray(img).astype(np.float32) / 255.0
            blob = np.transpose(blob, (2, 0, 1))[None, ...]
            outputs = session.run(None, {input_name: blob})
            mask = _extract_mask(outputs, (y1 - y0, x1 - x0), conf)
            if mask is None:
                continue
            transform = src.window_transform(window)
            tile_feats = mask_to_polygons(mask, transform)
            for f in tile_feats:
                f["properties"]["confidence"] = conf
            features.extend(tile_feats)
    return merge_overlapping(features)


def _extract_mask(outputs, hw: tuple[int, int], conf: float):
    """Best-effort parse of YOLO-seg ONNX outputs into a binary mask."""
    h, w = hw
    for out in outputs:
        arr = np.array(out)
        if arr.ndim == 4 and arr.shape[-1] in (h, w) or (arr.ndim == 4 and min(arr.shape[1:]) >= 8):
            proto = arr[0]
            if proto.ndim == 3:
                if proto.shape[0] <= 32:
                    heat = proto.max(axis=0)
                else:
                    heat = proto[0]
                heat = _resize(heat, (h, w))
                return (heat > conf).astype(np.uint8)
        if arr.ndim == 3 and arr.shape[0] == 1:
            heat = _resize(arr[0], (h, w))
            return (heat > conf).astype(np.uint8)
    return None


def _resize(mask: np.ndarray, hw: tuple[int, int]) -> np.ndarray:
    from PIL import Image

    img = Image.fromarray(mask.astype(np.float32), mode="F")
    return np.array(img.resize((hw[1], hw[0])))


def mock_buildings_from_parcels(parcels: list[dict]) -> list[dict]:
    """Synthetic footprints for overlay tests when no ONNX / GeoTIFF is present."""
    from shapely.affinity import scale, translate
    from shapely.geometry import mapping, shape

    feats = []
    for i, parcel in enumerate(parcels):
        geom = shape(parcel["geometry"])
        props = parcel.get("properties") or parcel
        loai = str(props.get("loai_dat") or "").upper()
        if loai in ("ODT", "ONT") and i == 0:
            inner = scale(geom, xfact=0.35, yfact=0.35, origin="centroid")
            feats.append(_feat(inner, 0.91, "legal-in-odt"))
        elif loai == "LUA":
            overflow = scale(geom, xfact=0.4, yfact=0.25, origin="centroid")
            overflow = translate(overflow, xoff=0.0015, yoff=0.0)
            feats.append(_feat(overflow, 0.84, "on-lua"))
        elif loai == "DGT":
            blob = scale(geom, xfact=0.2, yfact=0.15, origin="centroid")
            feats.append(_feat(blob, 0.78, "on-road"))
        elif loai == "ONT":
            # Cross the ONT/LUA boundary (LAN_RANH + SAI_MDSD)
            blob = scale(geom, xfact=0.5, yfact=0.8, origin="centroid")
            blob = translate(blob, xoff=0.0, yoff=0.003)
            feats.append(_feat(blob, 0.8, "cross-boundary"))
    return feats


def _feat(geom, confidence: float, tag: str) -> dict:
    from shapely.geometry import mapping

    return {
        "type": "Feature",
        "properties": {"confidence": confidence, "tag": tag},
        "geometry": mapping(geom),
    }
