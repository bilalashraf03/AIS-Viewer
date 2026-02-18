/**
 * Tile Utility Functions
 *
 * Provides utilities for calculating tile coordinates from lat/lon
 * and determining which tiles are visible in the current viewport.
 */

import type { TileCoordinates, Bounds } from "../types";

// Re-export types for backwards compatibility
export type { TileCoordinates, Bounds } from "../types";

/**
 * Convert MapboxGL visible bounds array to Bounds object
 * MapboxGL returns bounds as [[lon1, lat1], [lon2, lat2]]
 */
export function visibleBoundsToBounds(
  visibleBounds: Array<Array<number>>,
): Bounds {
  return {
    north: Math.max(visibleBounds[0][1], visibleBounds[1][1]),
    south: Math.min(visibleBounds[0][1], visibleBounds[1][1]),
    east: Math.max(visibleBounds[0][0], visibleBounds[1][0]),
    west: Math.min(visibleBounds[0][0], visibleBounds[1][0]),
  };
}

/**
 * Convert latitude/longitude to tile coordinates
 */
export function latLonToTile(
  lat: number,
  lon: number,
  zoom: number,
): TileCoordinates {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );

  return { z: zoom, x, y };
}

/**
 * Convert tile coordinates to latitude/longitude (top-left corner)
 */
export function tileToLatLon(tile: TileCoordinates): {
  lat: number;
  lon: number;
} {
  const n = Math.PI - (2 * Math.PI * tile.y) / Math.pow(2, tile.z);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const lon = (tile.x / Math.pow(2, tile.z)) * 360 - 180;

  return { lat, lon };
}

/**
 * Get all tiles that are visible in the given bounds
 */
export function getTilesInBounds(
  bounds: Bounds,
  zoom: number,
): TileCoordinates[] {
  const nw = latLonToTile(bounds.north, bounds.west, zoom);
  const se = latLonToTile(bounds.south, bounds.east, zoom);

  const tiles: TileCoordinates[] = [];

  // Handle date line crossing
  const minX = Math.min(nw.x, se.x);
  const maxX = Math.max(nw.x, se.x);
  const minY = Math.min(nw.y, se.y);
  const maxY = Math.max(nw.y, se.y);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }

  return tiles;
}

/**
 * Convert tile coordinates to a string key
 */
export function tileToKey(tile: TileCoordinates): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

/**
 * Parse a tile key back to coordinates
 */
export function keyToTile(key: string): TileCoordinates | null {
  const parts = key.split("/");
  if (parts.length !== 3) {
    return null;
  }

  const z = parseInt(parts[0], 10);
  const x = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);

  if (isNaN(z) || isNaN(x) || isNaN(y)) {
    return null;
  }

  return { z, x, y };
}

/**
 * Parse multiple tile keys to coordinates
 * Filters out invalid keys
 */
export function keysToTiles(keys: string[]): TileCoordinates[] {
  return keys
    .map((key) => {
      const parts = key.split("/");
      if (parts.length !== 3) {
        return null;
      }

      const z = parseInt(parts[0], 10);
      const x = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);

      if (isNaN(z) || isNaN(x) || isNaN(y)) {
        return null;
      }

      return { z, x, y };
    })
    .filter((tile): tile is TileCoordinates => tile !== null);
}

/**
 * Check if bounds have changed significantly
 * @param oldBounds Previous bounds
 * @param newBounds New bounds
 * @param threshold Minimum change in degrees to be considered significant (default: 0.01)
 * @returns true if bounds changed significantly, false otherwise
 */
export function haveBoundsChanged(
  oldBounds: Bounds,
  newBounds: Bounds,
  threshold: number = 0.01,
): boolean {
  const latDiff = Math.abs(newBounds.north - oldBounds.north);
  const lonDiff = Math.abs(newBounds.east - oldBounds.east);

  return latDiff >= threshold || lonDiff >= threshold;
}

/**
 * Calculate the difference between two tile sets
 * Returns tiles that are in newTiles but not in oldTiles
 */
export function getTileDifference(
  newTiles: TileCoordinates[],
  oldTiles: TileCoordinates[],
): { added: TileCoordinates[]; removed: TileCoordinates[] } {
  const newKeys = new Set(newTiles.map(tileToKey));
  const oldKeys = new Set(oldTiles.map(tileToKey));

  const added = newTiles.filter((tile) => !oldKeys.has(tileToKey(tile)));
  const removed = oldTiles.filter((tile) => !newKeys.has(tileToKey(tile)));

  return { added, removed };
}

/**
 * Get bounds from center point and radius (in degrees)
 */
export function getBoundsFromCenter(
  lat: number,
  lon: number,
  radiusDegrees: number,
): Bounds {
  return {
    north: Math.min(lat + radiusDegrees, 85), // Clamp to web mercator limits
    south: Math.max(lat - radiusDegrees, -85),
    east: lon + radiusDegrees,
    west: lon - radiusDegrees,
  };
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Normalize longitude to -180 to 180 range
 */
export function normalizeLongitude(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

/**
 * Calculate tile bounds (lat/lon of corners)
 */
export function getTileBounds(tile: TileCoordinates): Bounds {
  const nw = tileToLatLon(tile);
  const se = tileToLatLon({ z: tile.z, x: tile.x + 1, y: tile.y + 1 });

  return {
    north: nw.lat,
    south: se.lat,
    east: se.lon,
    west: nw.lon,
  };
}
