declare namespace GeoJSON {
  type Position = number[];
  interface Point {
    type: "Point";
    coordinates: Position;
  }
  interface Polygon {
    type: "Polygon";
    coordinates: Position[][];
  }
  interface MultiPolygon {
    type: "MultiPolygon";
    coordinates: Position[][][];
  }
  type Geometry = Point | Polygon | MultiPolygon | { type: string; coordinates: unknown };
  interface Feature<G = Geometry, P = Record<string, unknown>> {
    type: "Feature";
    geometry: G | null;
    properties: P;
  }
  interface FeatureCollection<G = Geometry, P = Record<string, unknown>> {
    type: "FeatureCollection";
    features: Feature<G, P>[];
  }
}
