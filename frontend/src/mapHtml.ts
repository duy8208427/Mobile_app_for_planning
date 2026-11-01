export function violationMapHtml(geojson: unknown, center: [number, number]): string {
  const data = JSON.stringify(geojson);
  const lng = center[0];
  const lat = center[1];
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css" rel="stylesheet"/>
<style>html,body,#map{margin:0;height:100%;}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<script>
const gj = ${data};
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  },
  center: [${lng}, ${lat}],
  zoom: 15
});
map.on('load', () => {
  map.addSource('v', { type: 'geojson', data: gj });
  map.addLayer({
    id: 'v-fill', type: 'fill', source: 'v',
    paint: {
      'fill-color': ['match', ['get', 'status'], 'confirmed', '#f97316', '#ef4444'],
      'fill-opacity': 0.55
    }
  });
  map.addLayer({
    id: 'v-line', type: 'line', source: 'v',
    paint: { 'line-color': '#7f1d1d', 'line-width': 1.5 }
  });
});
</script>
</body></html>`;
}
