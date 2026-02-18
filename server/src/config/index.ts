import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface Config {
  // Application
  nodeEnv: string;
  port: number;
  wsPort: number;
  logLevel: string;

  // AISStream
  aisstreamApiKey: string;
  aisstreamBbox?: string;

  // Redis
  redisUrl: string;
  redisMaxMemory: string;

  // PostgreSQL
  postgresUrl: string;
  postgresHost: string;
  postgresPort: number;
  postgresDb: string;
  postgresUser: string;
  postgresPassword: string;
  postgresMaxConnections: number;

  // Application Settings
  tileZoom: number;
  freshnessSeconds: number;
  vesselTtlSeconds: number;

  // Batch Sync
  batchSyncIntervalMs: number;
  batchSyncSize: number;

  // Monitoring
  enableMetrics: boolean;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getEnvVarNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${key}: ${value}`);
  }
  return parsed;
};

const getEnvVarBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
};

export const config: Config = {
  // Application
  nodeEnv: getEnvVar("NODE_ENV", "development"),
  port: getEnvVarNumber("PORT", 3000),
  wsPort: getEnvVarNumber("WS_PORT", 3001),
  logLevel: getEnvVar("LOG_LEVEL", "info"),

  // AISStream
  aisstreamApiKey: getEnvVar("AISSTREAM_API_KEY", ""),
  aisstreamBbox: process.env.AISSTREAM_BBOX,

  // Redis
  redisUrl: getEnvVar("REDIS_URL", "redis://localhost:6379"),
  redisMaxMemory: getEnvVar("REDIS_MAX_MEMORY", "512mb"),

  // PostgreSQL
  postgresUrl: getEnvVar(
    "POSTGRES_URL",
    "postgresql://aisuser:aispass@localhost:5432/aisviewer",
  ),
  postgresHost: getEnvVar("POSTGRES_HOST", "localhost"),
  postgresPort: getEnvVarNumber("POSTGRES_PORT", 5432),
  postgresDb: getEnvVar("POSTGRES_DB", "aisviewer"),
  postgresUser: getEnvVar("POSTGRES_USER", "aisuser"),
  postgresPassword: getEnvVar("POSTGRES_PASSWORD", "aispass"),
  postgresMaxConnections: getEnvVarNumber("POSTGRES_MAX_CONNECTIONS", 20),

  // Application Settings
  tileZoom: getEnvVarNumber("TILE_ZOOM", 12),
  freshnessSeconds: getEnvVarNumber("FRESHNESS_SECONDS", 120),
  vesselTtlSeconds: getEnvVarNumber("VESSEL_TTL_SECONDS", 120),

  // Batch Sync
  batchSyncIntervalMs: getEnvVarNumber("BATCH_SYNC_INTERVAL_MS", 5000),
  batchSyncSize: getEnvVarNumber("BATCH_SYNC_SIZE", 1000),

  // Monitoring
  enableMetrics: getEnvVarBoolean("ENABLE_METRICS", true),
};

export default config;
