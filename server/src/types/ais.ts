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
