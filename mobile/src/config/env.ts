import type { AppConfig } from "../types";

// Mapbox Configuration
export const MAPBOX_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

// Backend API Configuration
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3002";
export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:3002/ws";

// Map Configuration
export const TILE_ZOOM = parseInt(
  process.env.EXPO_PUBLIC_TILE_ZOOM || "12",
  10,
);

// Minimum zoom level to load vessels
export const MIN_ZOOM_FOR_VESSELS = 12;

// Default Map Center
export const MAP_CENTER_LON = parseFloat(
  process.env.EXPO_PUBLIC_MAP_CENTER_LON || "114.1095",
);
export const MAP_CENTER_LAT = parseFloat(
  process.env.EXPO_PUBLIC_MAP_CENTER_LAT || "22.3964",
);
export const MAP_INITIAL_ZOOM = parseFloat(
  process.env.EXPO_PUBLIC_MAP_INITIAL_ZOOM || "10",
);

// Validate required environment variables
const validateConfig = () => {
  const errors: string[] = [];

  if (!MAPBOX_ACCESS_TOKEN) {
    errors.push("EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is required");
  }

  if (!API_BASE_URL) {
    errors.push("EXPO_PUBLIC_API_BASE_URL is required");
  }

  if (!WS_URL) {
    errors.push("EXPO_PUBLIC_WS_URL is required");
  }

  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error(
      "\nMake sure you have a .env file with all required variables.",
    );
  }

  return errors.length === 0;
};

// Run validation
validateConfig();

// Export configuration object
export const config: AppConfig = {
  mapbox: {
    accessToken: MAPBOX_ACCESS_TOKEN,
  },
  api: {
    baseUrl: API_BASE_URL,
    wsUrl: WS_URL,
  },
  map: {
    tileZoom: TILE_ZOOM,
    minZoomForVessels: MIN_ZOOM_FOR_VESSELS,
    center: {
      lon: MAP_CENTER_LON,
      lat: MAP_CENTER_LAT,
    },
    initialZoom: MAP_INITIAL_ZOOM,
  },
};
