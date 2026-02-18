-- AIS Viewer Database Initialization Script
-- This script sets up PostGIS extension and creates the vessels_current table

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create vessels_current table for storing latest vessel positions
CREATE TABLE IF NOT EXISTS vessels_current (
    mmsi BIGINT PRIMARY KEY,
    geom geometry(Point, 4326) NOT NULL,
    tile_z12 INT NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    cog DOUBLE PRECISION,
    sog DOUBLE PRECISION,
    heading INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create optimized composite index for tile queries with freshness filter
-- This is the most important index for MVT tile generation
CREATE INDEX IF NOT EXISTS idx_vessels_current_tile_fresh
    ON vessels_current(tile_z12, updated_at DESC);

-- Create GIST spatial index for ST_TileEnvelope spatial queries
-- Required for efficient PostGIS MVT generation
CREATE INDEX IF NOT EXISTS idx_vessels_current_geom
    ON vessels_current USING GIST(geom);

-- Create index on updated_at for "recent vessels" queries
CREATE INDEX IF NOT EXISTS idx_vessels_current_updated_at
    ON vessels_current(updated_at DESC);

-- Create index on mmsi for fast lookups
CREATE INDEX IF NOT EXISTS idx_vessels_current_mmsi
    ON vessels_current(mmsi);

-- Add comments for documentation
COMMENT ON TABLE vessels_current IS 'Stores the current (latest) position and state for each vessel';
COMMENT ON COLUMN vessels_current.mmsi IS 'Maritime Mobile Service Identity - unique vessel identifier';
COMMENT ON COLUMN vessels_current.geom IS 'PostGIS point geometry (SRID 4326 - WGS84)';
COMMENT ON COLUMN vessels_current.tile_z12 IS 'Pre-calculated tile key at zoom level 12 (x * 4096 + y)';
COMMENT ON COLUMN vessels_current.lon IS 'Longitude in decimal degrees (-180 to 180)';
COMMENT ON COLUMN vessels_current.lat IS 'Latitude in decimal degrees (-90 to 90)';
COMMENT ON COLUMN vessels_current.cog IS 'Course over ground in degrees (0-360)';
COMMENT ON COLUMN vessels_current.sog IS 'Speed over ground in knots';
COMMENT ON COLUMN vessels_current.heading IS 'True heading in degrees (0-359)';
COMMENT ON COLUMN vessels_current.updated_at IS 'Timestamp of last position update';
COMMENT ON COLUMN vessels_current.created_at IS 'Timestamp when vessel was first seen';

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON vessels_current TO aisuser;

-- Create function to clean up old vessels (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_vessels(age_seconds INT DEFAULT 300)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM vessels_current
    WHERE updated_at < now() - (age_seconds || ' seconds')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_vessels IS 'Removes vessels that have not been updated in the specified time (default: 5 minutes)';

-- Create a view for recent active vessels (optional convenience)
CREATE OR REPLACE VIEW vessels_active AS
SELECT
    mmsi,
    lon,
    lat,
    cog,
    sog,
    heading,
    tile_z12,
    updated_at,
    EXTRACT(EPOCH FROM (now() - updated_at)) AS age_seconds,
    ST_AsGeoJSON(geom)::json AS geojson
FROM vessels_current
WHERE updated_at >= now() - INTERVAL '2 minutes';

COMMENT ON VIEW vessels_active IS 'View of vessels active in the last 2 minutes with GeoJSON geometry';

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'AIS Viewer database initialization completed successfully';
    RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
END $$;
