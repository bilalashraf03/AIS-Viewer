import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";

// Redis Client Instance
let redisClient: Redis | null = null;

export async function initRedis(): Promise<Redis> {
  if (redisClient) {
    logger.warn("Redis client already initialized");
    return redisClient;
  }

  try {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        logger.warn({ attempt: times, delay }, "Retrying Redis connection");
        return delay;
      },
      reconnectOnError(err) {
        logger.error({ error: err.message }, "Redis connection error");
        return true;
      },
    });

    redisClient.on("connect", () => {
      logger.info("Redis client connecting...");
    });

    redisClient.on("ready", () => {
      logger.info("Redis client connected and ready");
    });

    redisClient.on("error", (err) => {
      logger.error({ error: err.message }, "Redis client error");
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
    });

    redisClient.on("reconnecting", () => {
      logger.info("Redis client reconnecting...");
    });

    await redisClient.ping();
    logger.info("Redis connection established successfully");

    return redisClient;
  } catch (error) {
    logger.error({ error }, "Failed to initialize Redis");
    throw error;
  }
}

export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call initRedis() first.");
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    logger.info("Closing Redis connection...");
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed");
  }
}

export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.status === "ready";
}
