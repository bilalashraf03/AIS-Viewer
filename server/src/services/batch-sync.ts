import { getRedis } from "./redis";
import { getPostgres } from "./postgres";
import { logger } from "../utils/logger";
import { config } from "../config";
import type { BatchSyncVesselData, SyncStats } from "../types/ais";

export class BatchSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly intervalMs: number;
  private readonly batchSize: number;

  constructor(intervalMs?: number, batchSize?: number) {
    this.intervalMs = intervalMs ?? config.batchSyncIntervalMs;
    this.batchSize = batchSize ?? config.batchSyncSize;
  }

  /**
   * Parse tile key "12/x/y" to numeric tile_z12 value
   * Formula: x * 4096 + y (for zoom 12, max 4096x4096 tiles)
   */
  private parseTileKey(tileKey: string): number {
    const parts = tileKey.split("/");
    if (parts.length !== 3) return 0;

    const x = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);

    if (isNaN(x) || isNaN(y)) return 0;

    return x * 4096 + y;
  }

  private async syncVessels(): Promise<SyncStats> {
    const startTime = Date.now();
    const stats: SyncStats = {
      vesselsScanned: 0,
      vesselsUpserted: 0,
      errors: 0,
      duration: 0,
    };

    try {
      const redis = getRedis();
      const pg = getPostgres();

      // Scan for all vessel keys
      const vesselKeys: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          "cur:vessel:*",
          "COUNT",
          this.batchSize,
        );
        cursor = nextCursor;
        vesselKeys.push(...keys);

        // Process in batches to avoid overwhelming the system
        if (vesselKeys.length >= this.batchSize) {
          break;
        }
      } while (cursor !== "0" && vesselKeys.length < this.batchSize);

      stats.vesselsScanned = vesselKeys.length;

      if (vesselKeys.length === 0) {
        stats.duration = Date.now() - startTime;
        return stats;
      }

      // Fetch vessel data from Redis
      const pipeline = redis.pipeline();
      vesselKeys.forEach((key) => {
        pipeline.hgetall(key);
      });

      const results = await pipeline.exec();
      if (!results) {
        throw new Error("Pipeline execution failed");
      }

      // Build upsert query
      const vessels: BatchSyncVesselData[] = [];
      for (const [err, data] of results) {
        if (err || !data || typeof data !== "object") {
          stats.errors++;
          continue;
        }

        const vessel = data as BatchSyncVesselData;
        if (vessel.mmsi && vessel.lat && vessel.lon) {
          vessels.push(vessel);
        }
      }

      if (vessels.length === 0) {
        stats.duration = Date.now() - startTime;
        return stats;
      }

      // Prepare batch upsert using PostgreSQL's INSERT ... ON CONFLICT
      const values: any[] = [];
      const valuePlaceholders: string[] = [];

      vessels.forEach((vessel, index) => {
        const baseIndex = index * 9;
        const mmsi = parseInt(vessel.mmsi, 10);
        const lat = parseFloat(vessel.lat);
        const lon = parseFloat(vessel.lon);
        const cog = vessel.cog !== "null" ? parseFloat(vessel.cog) : null;
        const sog = vessel.sog !== "null" ? parseFloat(vessel.sog) : null;
        const heading =
          vessel.heading !== "null" ? parseInt(vessel.heading, 10) : null;
        const tileZ12 = this.parseTileKey(vessel.tile);

        valuePlaceholders.push(
          `($${baseIndex + 1}, ST_SetSRID(ST_MakePoint($${baseIndex + 2}, $${baseIndex + 3}), 4326), $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, NOW())`,
        );

        values.push(mmsi, lon, lat, tileZ12, lon, lat, cog, sog, heading);
      });

      const upsertQuery = `
        INSERT INTO vessels_current (
          mmsi, geom, tile_z12, lon, lat, cog, sog, heading, updated_at
        )
        VALUES ${valuePlaceholders.join(", ")}
        ON CONFLICT (mmsi)
        DO UPDATE SET
          geom = EXCLUDED.geom,
          lon = EXCLUDED.lon,
          lat = EXCLUDED.lat,
          tile_z12 = EXCLUDED.tile_z12,
          cog = EXCLUDED.cog,
          sog = EXCLUDED.sog,
          heading = EXCLUDED.heading,
          updated_at = EXCLUDED.updated_at
      `;

      await pg.query(upsertQuery, values);
      stats.vesselsUpserted = vessels.length;

      stats.duration = Date.now() - startTime;
      return stats;
    } catch (error) {
      stats.errors++;
      stats.duration = Date.now() - startTime;
      logger.error({ error }, "Batch sync failed");
      throw error;
    }
  }

  private async runSyncLoop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.syncVessels();
    } catch (error) {
      logger.error({ error }, "Sync loop error");
    }
  }

  public async start(): Promise<void> {
    if (this.syncInterval) {
      return;
    }

    this.isRunning = true;
    logger.info(
      { intervalMs: this.intervalMs, batchSize: this.batchSize },
      "Starting batch sync service",
    );

    // Run initial sync
    await this.runSyncLoop();

    // Schedule periodic sync
    this.syncInterval = setInterval(() => {
      this.runSyncLoop();
    }, this.intervalMs);
  }

  public async stop(): Promise<void> {
    if (!this.syncInterval) {
      logger.warn("Batch sync service not running");
      return;
    }

    this.isRunning = false;

    clearInterval(this.syncInterval);
    this.syncInterval = null;

    logger.info("Batch sync service stopped");
  }

  public isActive(): boolean {
    return this.isRunning && this.syncInterval !== null;
  }

  public getConfig(): { intervalMs: number; batchSize: number } {
    return {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    };
  }
}

// Singleton
let batchSyncService: BatchSyncService | null = null;

export async function startBatchSync(): Promise<void> {
  if (batchSyncService) {
    logger.warn("Batch sync service already initialized");
    return;
  }

  batchSyncService = new BatchSyncService();
  await batchSyncService.start();
}

export async function stopBatchSync(): Promise<void> {
  if (batchSyncService) {
    await batchSyncService.stop();
    batchSyncService = null;
  }
}

export function isBatchSyncRunning(): boolean {
  return batchSyncService?.isActive() ?? false;
}

export function getBatchSyncService(): BatchSyncService | null {
  return batchSyncService;
}
