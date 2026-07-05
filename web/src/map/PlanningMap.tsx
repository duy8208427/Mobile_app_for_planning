import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Violation } from "../api/types";

const DEMO_CENTER: [number, number] = [105.634, 10.457];

const ZONE_COLORS: Record<string, string> = {
  ODT: "#0A4ABF",
  GT: "#64748B",
  TMD: "#FF9500",
  CTCC: "#34C759",
};

interface PlanningMapProps {
  violations?: Violation[];
  onSelectViolation?: (v: Violation) => void;
  className?: string;
}

export function PlanningMap({
  violations = [],
  onSelectViolation,
  className = "",
}: PlanningMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selectedProps, setSelectedProps] = useState<Record<string, unknown> | null>(
    null
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const zonesUrl =
      import.meta.env.VITE_GIS_ZONES_URL || "/data/planning_zones_demo.geojson";

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
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: DEMO_CENTER,
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      fetch(zonesUrl)
        .then((r) => r.json())
        .then((geojson) => {
          if (!map.getSource("zones")) {
            map.addSource("zones", { type: "geojson", data: geojson });
            map.addLayer({
              id: "zones-fill",
              type: "fill",
              source: "zones",
              paint: {
                "fill-color": [
                  "match",
                  ["get", "zone_code"],
                  "ODT",
                  ZONE_COLORS.ODT,
                  "GT",
                  ZONE_COLORS.GT,
                  "TMD",
                  ZONE_COLORS.TMD,
                  "CTCC",
                  ZONE_COLORS.CTCC,
                  "#94a3b8",
                ],
                "fill-opacity": 0.35,
              },
            });
            map.addLayer({
              id: "zones-line",
              type: "line",
              source: "zones",
              paint: {
                "line-color": "#09090B",
                "line-width": 1,
              },
            });
          }
        })
        .catch(console.error);
    });

    map.on("click", "zones-fill", (e) => {
      if (!e.features?.[0]?.properties) return;
      setSelectedProps(e.features[0].properties as Record<string, unknown>);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const syncViolations = () => {
      const fc = {
        type: "FeatureCollection" as const,
        features: violations.map((v) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [v.longitude, v.latitude],
          },
          properties: {
            id: v.id,
            severity: v.severity,
            reason: v.reason,
            status: v.status,
          },
        })),
      };

      if (map.getSource("violations")) {
        (map.getSource("violations") as maplibregl.GeoJSONSource).setData(fc);
      } else {
        map.addSource("violations", { type: "geojson", data: fc });
        map.addLayer({
          id: "violations-circle",
          type: "circle",
          source: "violations",
          paint: {
            "circle-radius": 8,
            "circle-color": [
              "match",
              ["get", "severity"],
              "high",
              "#FF3B30",
              "medium",
              "#FF9500",
              "#0A4ABF",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
      }
    };

    if (map.loaded()) syncViolations();
    else map.once("load", syncViolations);

    const onViolationClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (!id || !onSelectViolation) return;
      const v = violations.find((x) => x.id === id);
      if (v) onSelectViolation(v);
    };

    map.on("click", "violations-circle", onViolationClick);
    return () => {
      map.off("click", "violations-circle", onViolationClick);
    };
  }, [violations, onSelectViolation]);

  return (
    <div className={`relative flex flex-1 flex-col ${className}`}>
      <div ref={containerRef} className="h-full min-h-[400px] w-full flex-1" />
      {selectedProps && (
        <div className="absolute bottom-4 left-4 max-w-sm border border-border-strong bg-surface-white p-4 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
            Vùng quy hoạch
          </p>
          <p className="mt-1 font-semibold">
            {String(selectedProps.zone_name || selectedProps.zone_code)}
          </p>
          <p className="text-sm text-text-muted">
            Mã: {String(selectedProps.zone_code)} · Xây dựng:{" "}
            {selectedProps.allow_build ? "Có" : "Không"}
          </p>
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
