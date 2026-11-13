import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { getApiBase, getToken } from "../api/client";
import type { CadastreExtent, GeoJSONFeatureCollection } from "../api/types";

const FALLBACK_CENTER: [number, number] = [105.634, 10.457];
const INITIAL_ZOOM = 14;
const MIN_PARCEL_ZOOM = 11;

const RULE_LABEL: Record<string, string> = {
  SAI_MDSD: "Sai mục đích sử dụng đất",
  LAN_RANH: "Lấn ranh thửa",
  NHA_MOI: "Nhà mới so với địa chính",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Chờ duyệt",
  confirmed: "Đã xác nhận",
  rejected: "Bác bỏ",
};

const QGIS_FIELDS: [string, string][] = [
  ["SoTo", "Số tờ"],
  ["SoThua", "Số thửa"],
  ["KyHieuLoaiDat", "Ký hiệu loại đất"],
  ["MucDichSuDungDat", "Mục đích sử dụng đất"],
  ["DienTich", "Diện tích"],
  ["DienTichPhapLy", "Diện tích pháp lý"],
  ["DiaChi", "Địa chỉ"],
  ["SoNha", "Số nhà"],
  ["TenConDuong", "Tên con đường"],
  ["TenChuSoHuu", "Tên chủ sở hữu"],
  ["TenNha", "Tên nhà"],
  ["MaPhuongXa", "Mã phường xã"],
  ["KhuPho", "Khu phố"],
  ["Ap", "Ấp"],
  ["GhiChu", "Ghi chú"],
  ["thuaDatID", "Mã đối tượng"],
  ["SoThuaMoi", "Số thửa mới"],
  ["SoHieuToBanDoCu", "Tờ bản đồ cũ"],
  ["SoThuTuThuaCu", "Thửa cũ"],
];

const FIELD_FALLBACK: Record<string, string[]> = {
  SoTo: ["so_to"],
  SoThua: ["so_thua"],
  KyHieuLoaiDat: ["loai_dat"],
  DiaChi: ["dia_chi"],
  DienTich: ["dien_tich"],
  thuaDatID: ["id", "parcel_id"],
};

interface PlanningMapProps {
  className?: string;
  missionId?: string;
}

const EMPTY: GeoJSONFeatureCollection = { type: "FeatureCollection", features: [] };

const PARCEL_FILL = {
  "fill-color": "#d62828",
  "fill-opacity": 0.55,
};

const PARCEL_LINE = { "line-color": "#7f1010", "line-width": 0.7 };

async function fetchJson<T>(path: string): Promise<T | null> {
  const token = getToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

type BBox = [number, number, number, number];

function mapBbox(map: maplibregl.Map): BBox {
  const b = map.getBounds();
  const pad = 0.0004;
  return [b.getWest() - pad, b.getSouth() - pad, b.getEast() + pad, b.getNorth() + pad];
}

async function fetchParcelsCovering(map: maplibregl.Map): Promise<GeoJSONFeatureCollection> {
  const q = mapBbox(map).join(",");
  return (
    (await fetchJson<GeoJSONFeatureCollection>(
      `/planning/parcels?bbox=${encodeURIComponent(q)}&cover=true`,
    )) || EMPTY
  );
}

function addFillLine(
  map: maplibregl.Map,
  id: string,
  data: GeoJSONFeatureCollection,
  fill: Record<string, unknown>,
  line: Record<string, unknown>,
) {
  if (!map.getStyle()) return;
  if (map.getSource(id)) {
    (map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
    return;
  }
  map.addSource(id, { type: "geojson", data });
  map.addLayer({
    id: `${id}-fill`,
    type: "fill",
    source: id,
    paint: fill as maplibregl.FillLayerSpecification["paint"],
  });
  map.addLayer({
    id: `${id}-line`,
    type: "line",
    source: id,
    paint: line as maplibregl.LineLayerSpecification["paint"],
  });
}

function setLayerVisible(map: maplibregl.Map, ids: string[], visible: boolean) {
  const value = visible ? "visible" : "none";
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", value);
  }
}

function pickProp(props: Record<string, unknown>, key: string): unknown {
  const keys = [key, ...(FIELD_FALLBACK[key] || [])];
  for (const k of keys) {
    const val = props[k];
    if (val == null || val === "") continue;
    return val;
  }
  return null;
}

function formatValue(key: string, val: unknown): string {
  if (val == null || val === "") return "";
  if (typeof val === "number" && (key === "DienTich" || key === "DienTichPhapLy" || key === "dien_tich")) {
    return `${val.toLocaleString("vi-VN")} m²`;
  }
  return String(val);
}

function qgisRows(props: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const [key, label] of QGIS_FIELDS) {
    const formatted = formatValue(key, pickProp(props, key));
    if (formatted) rows.push({ label, value: formatted });
  }
  return rows;
}

function ringCentroid(ring: number[][]): [number, number] | null {
  if (!ring.length) return null;
  let x = 0;
  let y = 0;
  let n = 0;
  for (const pt of ring) {
    if (pt.length < 2) continue;
    x += pt[0];
    y += pt[1];
    n += 1;
  }
  return n ? [x / n, y / n] : null;
}

function violationPoints(fc: GeoJSONFeatureCollection): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    const p = (f.properties || {}) as Record<string, unknown>;
    let coords: [number, number] | null = null;
    const lon = Number(p.longitude);
    const lat = Number(p.latitude);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      coords = [lon, lat];
    } else if (f.geometry?.type === "Point") {
      const c = f.geometry.coordinates;
      coords = [c[0], c[1]];
    } else if (f.geometry?.type === "Polygon") {
      coords = ringCentroid(f.geometry.coordinates[0] || []);
    } else if (f.geometry?.type === "MultiPolygon") {
      coords = ringCentroid(f.geometry.coordinates[0]?.[0] || []);
    }
    if (!coords) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: p,
    });
  }
  return { type: "FeatureCollection", features };
}

function addViolationPoints(map: maplibregl.Map, data: GeoJSONFeatureCollection) {
  const points = violationPoints(data);
  if (map.getSource("violation-points")) {
    (map.getSource("violation-points") as maplibregl.GeoJSONSource).setData(points);
    return;
  }
  map.addSource("violation-points", { type: "geojson", data: points });
  map.addLayer({
    id: "violation-points",
    type: "circle",
    source: "violation-points",
    paint: {
      "circle-color": [
        "match",
        ["get", "rule_id"],
        "SAI_MDSD",
        "#ef4444",
        "LAN_RANH",
        "#f97316",
        "NHA_MOI",
        "#eab308",
        "#ef4444",
      ],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3.5, 14, 5, 17, 7, 19, 9],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export function PlanningMap({ className = "", missionId }: PlanningMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const reloadRef = useRef<(() => Promise<void>) | null>(null);
  const showCadastreRef = useRef(true);
  const showBuildingsRef = useRef(true);
  const [selectedProps, setSelectedProps] = useState<Record<string, unknown> | null>(null);
  const [selectedKind, setSelectedKind] = useState("");
  const [hint, setHint] = useState("Đang tải bản đồ địa chính…");
  const [parcelCount, setParcelCount] = useState(0);
  const [showCadastre, setShowCadastre] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showSatellite, setShowSatellite] = useState(true);
  const [pointerCount, setPointerCount] = useState(0);
  const [extentBounds, setExtentBounds] = useState<[[number, number], [number, number]] | null>(
    null,
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            // Esri's level 19 is a "Map data not yet available" tile in the city,
            // and level 20 is that tile everywhere. Scale the last real imagery.
            maxzoom: 18,
            attribution: "Esri, Maxar, Earthstar Geographics",
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
          { id: "satellite", type: "raster", source: "satellite" },
        ],
      },
      center: FALLBACK_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: 20,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    let ready = false;
    let debounce: number | undefined;
    const reloadParcels = async () => {
      if (!showCadastreRef.current) {
        setLayerVisible(map, ["parcels-fill", "parcels-line"], false);
        setHint("Đã tắt lớp thửa — chỉ còn ảnh vệ tinh (như tắt layer QGIS)");
        return;
      }
      if (map.getZoom() < MIN_PARCEL_ZOOM) {
        addFillLine(map, "parcels", EMPTY, PARCEL_FILL, PARCEL_LINE);
        setLayerVisible(map, ["parcels-fill", "parcels-line"], true);
        setHint("Phóng to (zoom ≥ 11) để vẽ thửa đỏ trên ảnh vệ tinh");
        return;
      }
      const data = await fetchParcelsCovering(map);
      addFillLine(map, "parcels", data, PARCEL_FILL, PARCEL_LINE);
      setLayerVisible(map, ["parcels-fill", "parcels-line"], true);
      const n = data.features.length;
      const truncated = data.properties?.truncated;
      setHint(
        truncated
          ? `${n} thửa đỏ trong khung (cắt limit — phóng to thêm)`
          : `${n} thửa địa chính (đỏ) trên ảnh vệ tinh`,
      );
    };
    reloadRef.current = reloadParcels;

    const pickLayers = ["violation-points", "violations-fill", "buildings-fill", "parcels-fill"];
    const kindForLayer = (layerId: string) => {
      if (layerId.startsWith("parcels")) return "Thửa đất";
      if (layerId.startsWith("buildings")) return "Mái nhà (YOLO)";
      return "Nghi vấn";
    };

    const loadLayers = async () => {
      const qs = missionId ? `?mission_id=${encodeURIComponent(missionId)}` : "";
      const [extent, buildings, violations] = await Promise.all([
        fetchJson<CadastreExtent>("/planning/extent"),
        fetchJson<GeoJSONFeatureCollection>(`/planning/buildings${qs}`),
        fetchJson<GeoJSONFeatureCollection>(`/violations/geojson${qs}`),
      ]);

      if (extent?.count) setParcelCount(extent.count);
      if (
        extent?.west != null &&
        extent.south != null &&
        extent.east != null &&
        extent.north != null
      ) {
        setExtentBounds([
          [extent.west, extent.south],
          [extent.east, extent.north],
        ]);
      }

      addFillLine(map, "parcels", EMPTY, PARCEL_FILL, PARCEL_LINE);
      addFillLine(
        map,
        "buildings",
        buildings || EMPTY,
        { "fill-color": "#f59e0b", "fill-opacity": 0.45 },
        { "line-color": "#b45309", "line-width": 1.2 },
      );
      addFillLine(
        map,
        "violations",
        violations || EMPTY,
        {
          "fill-color": [
            "match",
            ["get", "status"],
            "confirmed",
            "#f97316",
            "rejected",
            "#94a3b8",
            "#ef4444",
          ],
          "fill-opacity": 0.45,
        },
        { "line-color": "#7f1d1d", "line-width": 1.5 },
      );
      addViolationPoints(map, violations || EMPTY);
      setPointerCount(violationPoints(violations || EMPTY).features.length);
      setLayerVisible(map, ["buildings-fill", "buildings-line"], showBuildingsRef.current);

      for (const layer of pickLayers) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      map.on("click", (e) => {
        const layers = pickLayers.filter((id) => map.getLayer(id));
        const hits = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
        const feat = hits.find((hit) => hit.properties);
        if (!feat?.properties) {
          setSelectedProps(null);
          setSelectedKind("");
          return;
        }
        setSelectedKind(kindForLayer(feat.layer?.id || ""));
        setSelectedProps({ ...(feat.properties as Record<string, unknown>) });
      });

      ready = true;
      await reloadParcels();
    };

    // "load" waits for every basemap tile; if one tile host is slow or blocked
    // (e.g. OSM unreachable on some networks) the data layers never appear.
    // "style.load" only needs the style, which is all addSource/addLayer need.
    map.once("style.load", () => {
      void loadLayers();
    });
    map.on("moveend", () => {
      if (!ready) return;
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        void reloadParcels();
      }, 250);
    });

    return () => {
      window.clearTimeout(debounce);
      map.remove();
      mapRef.current = null;
    };
  }, [missionId]);

  const toggleCadastre = (on: boolean) => {
    showCadastreRef.current = on;
    setShowCadastre(on);
    const map = mapRef.current;
    if (map) setLayerVisible(map, ["parcels-fill", "parcels-line"], on);
    if (on) void reloadRef.current?.();
    else setHint("Đã tắt lớp thửa — chỉ còn ảnh vệ tinh (như tắt layer QGIS)");
  };

  const toggleBuildings = (on: boolean) => {
    showBuildingsRef.current = on;
    setShowBuildings(on);
    const map = mapRef.current;
    if (map) setLayerVisible(map, ["buildings-fill", "buildings-line"], on);
  };

  const toggleSatellite = (on: boolean) => {
    setShowSatellite(on);
    const map = mapRef.current;
    if (map && map.getLayer("satellite")) {
      map.setLayoutProperty("satellite", "visibility", on ? "visible" : "none");
    }
  };

  const qgis = selectedProps ? qgisRows(selectedProps) : [];
  const rule = selectedProps ? String(selectedProps.rule_id || "") : "";

  return (
    <div className={`relative flex flex-1 flex-col ${className}`}>
      <div ref={containerRef} className="h-full min-h-[400px] w-full flex-1" />
      <div className="absolute right-4 top-14 max-w-xs border border-border-subtle bg-surface-white/95 p-3 text-xs shadow-sm">
        <p className="font-semibold">Lớp bản đồ (như QGIS)</p>
        {parcelCount > 0 && (
          <p className="text-text-muted">{parcelCount.toLocaleString("vi-VN")} thửa (GDB)</p>
        )}
        <p className="mt-1">{hint}</p>
        <label className="mt-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showSatellite}
            onChange={(e) => toggleSatellite(e.target.checked)}
          />
          Ảnh vệ tinh
        </label>
        <label className="mt-1 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showCadastre}
            onChange={(e) => toggleCadastre(e.target.checked)}
          />
          Thửa địa chính (đỏ)
        </label>
        <label className="mt-1 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showBuildings}
            onChange={(e) => toggleBuildings(e.target.checked)}
          />
          Mái nhà YOLO
        </label>
        {extentBounds && (
          <button
            type="button"
            className="mt-2 text-xs text-primary underline"
            onClick={() => mapRef.current?.fitBounds(extentBounds, { padding: 32, duration: 400 })}
          >
            Xem toàn ranh GDB
          </button>
        )}
        <p className="mt-2 text-text-muted">
          {pointerCount} pointer nghi vấn · đỏ sai MDSD · cam lấn ranh · vàng nhà mới
        </p>
      </div>
      {selectedProps && (
        <div className="absolute bottom-4 left-4 max-h-[55%] max-w-sm overflow-auto border border-border-strong bg-surface-white p-4 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
            {selectedKind}
          </p>
          <p className="mt-1 font-semibold">
            {rule
              ? RULE_LABEL[rule] || rule
              : formatValue("KyHieuLoaiDat", pickProp(selectedProps, "KyHieuLoaiDat")) ||
                formatValue("DiaChi", pickProp(selectedProps, "DiaChi")) ||
                "Thửa đất"}
          </p>
          {selectedProps.reason != null && selectedProps.reason !== "" && (
            <p className="mt-1 text-sm">{String(selectedProps.reason)}</p>
          )}
          {selectedProps.area_m2 != null && (
            <p className="text-sm text-text-muted">Diện tích lệch: {String(selectedProps.area_m2)} m²</p>
          )}
          {selectedProps.confidence != null && (
            <p className="text-sm text-text-muted">
              Độ tin cậy: {Math.round(Number(selectedProps.confidence) * 100)}%
            </p>
          )}
          {selectedProps.status != null && (
            <p className="text-sm text-text-muted">
              Trạng thái: {STATUS_LABEL[String(selectedProps.status)] || String(selectedProps.status)}
            </p>
          )}
          <dl className="mt-2 space-y-1 text-sm">
            {qgis.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-text-muted">{row.label}</dt>
                <dd className="text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="mt-2 text-xs text-primary underline"
            onClick={() => setSelectedProps(null)}
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}
