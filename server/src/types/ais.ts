export interface AISPositionReport {
  MessageID: string;
  Message: {
    PositionReport?: {
      Cog?: number;
      Latitude?: number;
      Longitude?: number;
      MessageID?: number;
      Sog?: number;
      TrueHeading?: number;
      UserID?: number;
      Timestamp?: number;
    };
  };
  MetaData?: {
    MMSI?: number;
    MMSI_String?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
  };
}

export interface VesselPosition {
  mmsi: number;
  lat: number;
  lon: number;
  cog: number | null;
  sog: number | null;
  heading: number | null;
  timestamp: string;
  tile: string; // Tile key at configured zoom, e.g. "12/x/y"
}

// Return type Redis Lua update script
export interface UpdateVesselResult {
  oldTile: string | null;
  newTile: string;
}

// AISStream subscription message (sent to AISStream provider)
export interface AISStreamSubscription {
  APIKey: string;
  BoundingBoxes?: Array<[[number, number], [number, number]]>;
  FilterMessageTypes?: string[];
}

// Vessel data used for batch sync (Redis -> Postgres)
export interface BatchSyncVesselData {
  mmsi: string;
  lat: string;
  lon: string;
  cog: string;
  sog: string;
  heading: string;
  timestamp: string;
  tile: string;
}

export interface SyncStats {
  vesselsScanned: number;
  vesselsUpserted: number;
  errors: number;
  duration: number; // milliseconds
}
