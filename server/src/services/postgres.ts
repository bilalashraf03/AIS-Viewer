import { Pool, PoolClient } from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

let pool: Pool | null = null;

export async function initPostgres(): Promise<Pool> {
  if (pool) {
    logger.warn("PostgreSQL pool already initialized");
    return pool;
  }

  try {
    pool = new Pool({
      host: config.postgresHost,
      port: config.postgresPort,
      database: config.postgresDb,
      user: config.postgresUser,
      password: config.postgresPassword,
      max: config.postgresMaxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();

    logger.info("PostgreSQL connection pool established successfully");

    pool.on("error", (err) => {
      logger.error({ error: err.message }, "PostgreSQL pool error");
    });

    return pool;
  } catch (error) {
    logger.error({ error }, "Failed to initialize PostgreSQL");
    throw error;
  }
}

export function getPostgres(): Pool {
  if (!pool) {
    throw new Error(
      "PostgreSQL pool not initialized. Call initPostgres() first.",
    );
  }
  return pool;
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    logger.info("Closing PostgreSQL connection pool...");
    await pool.end();
    pool = null;
    logger.info("PostgreSQL connection pool closed");
  }
}

export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const client = await getPostgres().connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPostgres().connect();
}

export async function isPostgresConnected(): Promise<boolean> {
  if (!pool) return false;

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (error) {
    return false;
  }
}
