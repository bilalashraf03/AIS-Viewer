export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

// Convert latitude/longitude to a tile key string "z/x/y" at given zoom.
// clamps latitude to Web Mercator limits
// normalizes longitude into [-180, 180]
export function latLonToTileKey(
  lat: number,
  lon: number,
  zoom: number,
): string {
  // Clamp latitude to Web Mercator limits
  const clampedLat = Math.max(
    -85.0511287798066,
    Math.min(85.0511287798066, lat),
  );

  // Normalize longitude to [-180, 180]
  const lonNorm = ((((lon + 180) % 360) + 360) % 360) - 180;

  const n = Math.pow(2, zoom);
  const x = Math.floor(((lonNorm + 180) / 360) * n);

  const latRad = (clampedLat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );

  return `${zoom}/${x}/${y}`;
}
