/**
 * Redis Lua scripts for atomic operations
 * These scripts run atomically on the Redis server
 */

/**
 * Atomic vessel update script
 *
 * This script atomically:
 * 1. Retrieves the old tile for a vessel (if exists)
 * 2. Updates the vessel hash with new data
 * 3. Removes vessel from old tile set (if changed)
 * 4. Adds vessel to new tile set
 * 5. Sets TTL on vessel hash and tile set
 * 6. Returns the old and new tile keys for dirty tile tracking
 *
 * KEYS[1] = vessel hash key (e.g., "cur:vessel:123456789")
 * KEYS[2] = new tile set key (e.g., "cur:tile:12/1234/5678")
 *
 * ARGV[1] = mmsi
 * ARGV[2] = lat
 * ARGV[3] = lon
 * ARGV[4] = cog (Course Over Ground)
 * ARGV[5] = sog (Speed Over Ground)
 * ARGV[6] = heading
 * ARGV[7] = timestamp (ISO string)
 * ARGV[8] = new tile key (e.g., "12/1234/5678")
 * ARGV[9] = ttl in seconds
 *
 * Returns: JSON string with { oldTile: string|null, newTile: string }
 */
export const UPDATE_VESSEL_SCRIPT = `
local vesselKey = KEYS[1]
local newTileKey = KEYS[2]

local mmsi = ARGV[1]
local lat = ARGV[2]
local lon = ARGV[3]
local cog = ARGV[4]
local sog = ARGV[5]
local heading = ARGV[6]
local timestamp = ARGV[7]
local newTile = ARGV[8]
local ttl = tonumber(ARGV[9])

-- Get old tile if vessel exists
local oldTile = redis.call('HGET', vesselKey, 'tile')

-- Update vessel hash with new data
redis.call('HSET', vesselKey,
  'mmsi', mmsi,
  'lat', lat,
  'lon', lon,
  'cog', cog,
  'sog', sog,
  'heading', heading,
  'timestamp', timestamp,
  'tile', newTile
)

-- Set TTL on vessel hash
redis.call('EXPIRE', vesselKey, ttl)

-- If tile changed, remove from old tile set
if oldTile and oldTile ~= newTile then
  local oldTileKey = 'cur:tile:' .. oldTile
  redis.call('SREM', oldTileKey, mmsi)

  -- Clean up old tile set if empty (optional, helps reduce memory)
  local count = redis.call('SCARD', oldTileKey)
  if count == 0 then
    redis.call('DEL', oldTileKey)
  end
end

-- Add to new tile set
redis.call('SADD', newTileKey, mmsi)

-- Set TTL on new tile set
redis.call('EXPIRE', newTileKey, ttl)

-- Return old and new tiles for dirty tile tracking
local result = {
  oldTile = oldTile or cjson.null,
  newTile = newTile
}

return cjson.encode(result)
`;
