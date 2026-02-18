/**
 * Type Definitions
 *
 * Centralized type definitions for the AIS Viewer mobile app.
 * Following React Native convention, all types are defined here.
 */

// ============================================================================
// Vessel Types
// ============================================================================

/**
 * Vessel data from API
 */
export interface VesselData {
  mmsi: number;
  lat: number;
  lon: number;
  cog: number | null;
  sog: number | null;
  heading: number | null;
  timestamp: string;
}

/**
 * Vessel position from WebSocket
 */
export interface VesselPosition {
  mmsi: number;
  lat: number;
  lon: number;
  cog: number | null;
  sog: number | null;
  heading: number | null;
  timestamp: string;
  tile: string;
}

/**
 * Vessel marker for map display
 */
export interface VesselMarker extends VesselData {
  id: string;
}

// ============================================================================
// Map & Tile Types
// ============================================================================

/**
 * Map tile coordinates
 */
export interface TileCoordinates {
  z: number;
  x: number;
  y: number;
}

/**
 * Geographic bounds
 */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Options for fetching vessel data
 */
export interface FetchVesselsOptions {
  timeout?: number;
  retries?: number;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

/**
 * WebSocket connected message
 */
export interface ConnectedMessage {
  type: "connected";
  clientId: string;
  message: string;
}

/**
 * WebSocket subscribed message
 */
export interface SubscribedMessage {
  type: "subscribed";
  tiles: string[];
  message: string;
}

/**
 * WebSocket unsubscribed message
 */
export interface UnsubscribedMessage {
  type: "unsubscribed";
  tiles: string[];
  message: string;
}

/**
 * WebSocket vessel update message
 */
export interface VesselUpdateMessage {
  type: "vessel_update";
  tile: string;
  vessels: VesselPosition[];
}

/**
 * WebSocket pong message
 */
export interface PongMessage {
  type: "pong";
}

/**
 * All possible server message types
 */
export type ServerMessage =
  | ConnectedMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | VesselUpdateMessage
  | PongMessage;

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Callback for vessel updates
 */
export type VesselUpdateCallback = (
  tile: string,
  vessels: VesselPosition[],
) => void;

/**
 * Callback for connection state changes
 */
export type ConnectionCallback = (connected: boolean) => void;

/**
 * Callback for errors
 */
export type ErrorCallback = (error: Error) => void;

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for VesselMapView component
 */
export interface VesselMapViewProps {
  mapboxToken: string;
  apiBaseUrl: string;
  wsUrl: string;
  tileZoom: number;
  initialCenter: [number, number];
  initialZoom: number;
  onVesselCountChange?: (count: number) => void;
  onConnectionChange?: (connected: boolean) => void;
  onLastUpdateChange?: (timestamp: string) => void;
}

/**
 * Props for InfoPanel component
 */
export interface InfoPanelProps {
  isConnected: boolean;
  vesselCount: number;
  lastUpdate: string;
  currentZoom: number;
  subscribedTiles: number;
  isLoading: boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Application configuration object
 */
export interface AppConfig {
  mapbox: {
    accessToken: string;
  };
  api: {
    baseUrl: string;
    wsUrl: string;
  };
  map: {
    tileZoom: number;
    minZoomForVessels: number;
    center: {
      lon: number;
      lat: number;
    };
    initialZoom: number;
  };
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useMapServices hook
 */
export interface UseMapServicesReturn {
  isConnected: boolean;
  isInitialized: boolean;
}

/**
 * Return type for useVesselData hook
 */
export interface UseVesselDataReturn {
  vessels: Map<number, VesselMarker>;
  vesselCount: number;
  lastUpdate: string;
  isLoading: boolean;
  removeVesselsFromTiles: (tiles: string[]) => void;
  clearAllVessels: () => void;
}

/**
 * Return type for useTileSubscription hook
 */
export interface UseTileSubscriptionReturn {
  subscribedTiles: Set<string>;
  subscribeToViewportTiles: () => Promise<void>;
  handleRegionDidChange: () => Promise<void>;
  handleCameraChanged: (state: any) => void;
  handleMapReady: () => void;
  currentZoom: number;
  isLoading: boolean;
}

/**
 * Props for VesselMarker component
 */
export interface VesselMarkerProps {
  vessel: VesselMarker;
  mapBearing?: number;
}

/**
 * Props for ReconnectButton component
 */
export interface ReconnectButtonProps {
  onReconnect: () => void;
}
