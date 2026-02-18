import WebSocket from "ws";
import { EventEmitter } from "events";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getRedis } from "./redis";
import { UPDATE_VESSEL_SCRIPT } from "../scripts/redis-scripts";
import { latLonToTileKey, isValidCoordinates } from "../utils/tile";
import {
  AISPositionReport,
  VesselPosition,
  UpdateVesselResult,
  AISStreamSubscription,
} from "../types/ais";

interface AISStreamClientOptions {
  apiKey: string;
  boundingBox?: string;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectBackoff?: number;
}

export class AISStreamClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: Required<AISStreamClientOptions>;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private currentReconnectDelay: number;
  private isConnecting = false;
  private isClosing = false;
  private updateScriptSha: string | null = null;

  // Set to track dirty tiles for batch notifications
  private dirtyTiles = new Set<string>();
  private dirtyTileFlushInterval: NodeJS.Timeout | null = null;

  constructor(options: AISStreamClientOptions) {
    super();

    if (!options.apiKey) {
      throw new Error("AISStream API key is required");
    }

    this.options = {
      apiKey: options.apiKey,
      boundingBox: options.boundingBox || "",
      reconnectDelay: options.reconnectDelay || 1000,
      maxReconnectDelay: options.maxReconnectDelay || 30000,
      reconnectBackoff: options.reconnectBackoff || 1.5,
    };

    this.currentReconnectDelay = this.options.reconnectDelay;
  }

  async start(): Promise<void> {
    logger.info("Starting AISStream client...");

    // Load Lua script into Redis
    await this.loadRedisScripts();

    // Start dirty tile flush interval (every 1 second)
    this.dirtyTileFlushInterval = setInterval(() => {
      this.flushDirtyTiles();
    }, config.flushDirtyTilesSeconds * 1000);

    // Connect to AISStream
    await this.connect();
  }

  async stop(): Promise<void> {
    logger.info("Stopping AISStream client...");
    this.isClosing = true;

    if (this.dirtyTileFlushInterval) {
      clearInterval(this.dirtyTileFlushInterval);
      this.dirtyTileFlushInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info("AISStream client stopped");
  }

  private async connect(): Promise<void> {
    if (this.isConnecting || this.isClosing) {
      return;
    }

    this.isConnecting = true;

    try {
      logger.info("Connecting to AISStream WebSocket...");

      this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

      this.ws.on("open", () => {
        this.handleOpen();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("error", (error: Error) => {
        this.handleError(error);
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        logger.info(
          { code, reason: reason.toString() },
          "WebSocket close event",
        );
        this.handleClose(code, reason.toString());
      });

      this.ws.on("ping", () => {
        logger.debug("Received ping from server");
      });
    } catch (error) {
      logger.error({ error }, "Failed to create WebSocket connection");
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private handleOpen(): void {
    logger.info(
      {
        readyState: this.ws?.readyState,
        url: this.ws?.url,
      },
      "AISStream WebSocket connected",
    );
    this.currentReconnectDelay = this.options.reconnectDelay; // Reset backoff

    this.subscribe();

    this.emit("connected");

    logger.info("WebSocket setup complete, message handler attached");
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn("Cannot subscribe: WebSocket not open");
      return;
    }

    const subscription: AISStreamSubscription = {
      APIKey: this.options.apiKey,
      FilterMessageTypes: ["PositionReport"],
    };

    if (this.options.boundingBox) {
      subscription.BoundingBoxes = this.parseBoundingBoxes(
        this.options.boundingBox,
      );
    }

    const message = JSON.stringify(subscription);

    this.ws.send(message);

    logger.info("Subscription message sent, waiting for messages...");
  }

  // Parse bounding box string into array format to be used by the AIS stream client
  // INPUT: "lat1,lon1,lat2,lon2"  OUTPUT => [[[lat1, lon1], [lat2, lon2]], ...]
  private parseBoundingBoxes(
    bbox: string,
  ): Array<[[number, number], [number, number]]> | undefined {
    try {
      const boxes = bbox.split(";");
      const result: Array<[[number, number], [number, number]]> = [];

      for (const box of boxes) {
        const coordsArray = box.split(",").map((c) => parseFloat(c.trim()));
        if (coordsArray.length !== 4) {
          throw new Error(`Invalid bounding box format: ${box}`);
        }
        result.push([
          [coordsArray[0], coordsArray[1]],
          [coordsArray[2], coordsArray[3]],
        ]);
      }

      return result;
    } catch (error) {
      logger.error({ error, bbox }, "Failed to parse bounding box");
      return undefined;
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const dataStr = data.toString();
      const message = JSON.parse(dataStr) as AISPositionReport;

      // Process position report
      const vessel = this.parsePositionReport(message);

      if (vessel) {
        this.updateVesselPosition(vessel);
      }
    } catch (error) {
      logger.error(
        {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        "Failed to parse AIS message",
      );
    }
  }

  // Parse AISStream position report into our internal format
  // INPUT: AISPositionReport OUTPUT => VesselPosition | null
  private parsePositionReport(
    message: AISPositionReport,
  ): VesselPosition | null {
    try {
      const posReport = message.Message?.PositionReport;
      if (!posReport) {
        return null;
      }

      // Extract MMSI
      const mmsi = posReport.UserID || message.MetaData?.MMSI;
      if (!mmsi) {
        return null;
      }

      // Extract position
      const lat = posReport.Latitude ?? message.MetaData?.latitude;
      const lon = posReport.Longitude ?? message.MetaData?.longitude;

      if (lat === undefined || lon === undefined) {
        return null;
      }

      // Ignore if invalid coordinates
      if (!isValidCoordinates(lat, lon)) {
        logger.debug({ mmsi, lat, lon }, "Invalid coordinates");
        return null;
      }

      // Calculate tile
      const tile = latLonToTileKey(lat, lon, config.tileZoom);

      // Extract other fields (can be null/undefined)
      const cog = posReport.Cog !== undefined ? posReport.Cog : null;
      const sog = posReport.Sog !== undefined ? posReport.Sog : null;
      const heading =
        posReport.TrueHeading !== undefined ? posReport.TrueHeading : null;

      // Generate timestamp
      const timestamp = message.MetaData?.time_utc || new Date().toISOString();

      return {
        mmsi,
        lat,
        lon,
        cog,
        sog,
        heading,
        timestamp,
        tile,
      };
    } catch (error) {
      logger.debug({ error, message }, "Failed to parse position report");
      return null;
    }
  }

  // Update vessel position in Redis
  private async updateVesselPosition(vessel: VesselPosition): Promise<void> {
    try {
      const redis = getRedis();

      const vesselKey = `cur:vessel:${vessel.mmsi}`;
      const tileKey = `cur:tile:${vessel.tile}`;

      // Execute Lua script for atomic update
      const result = await redis.evalsha(
        this.updateScriptSha!,
        2, // Number of keys
        vesselKey,
        tileKey,
        vessel.mmsi.toString(),
        vessel.lat.toString(),
        vessel.lon.toString(),
        vessel.cog !== null ? vessel.cog.toString() : "null",
        vessel.sog !== null ? vessel.sog.toString() : "null",
        vessel.heading !== null ? vessel.heading.toString() : "null",
        vessel.timestamp,
        vessel.tile,
        config.vesselRedisTtlSeconds.toString(),
      );

      // Parse result
      const updateResult: UpdateVesselResult = JSON.parse(result as string);

      // Track dirty tiles
      if (updateResult.oldTile) {
        this.dirtyTiles.add(updateResult.oldTile);
      }
      this.dirtyTiles.add(updateResult.newTile);

      // Emit vessel update event
      this.emit("vesselUpdate", vessel);
    } catch (error) {
      logger.error(
        { error, vessel },
        "Failed to update vessel position in Redis",
      );
    }
  }

  // Flush dirty tiles to WebSocket clients
  private flushDirtyTiles(): void {
    if (this.dirtyTiles.size === 0) {
      return;
    }

    const tiles = Array.from(this.dirtyTiles);
    this.dirtyTiles.clear();

    // Emit dirty tiles event for WebSocket server to broadcast
    this.emit("dirtyTiles", tiles);
  }

  private handleError(error: Error): void {
    logger.error({ error: error.message }, "AISStream WebSocket error");
    this.emit("error", error);
  }

  private handleClose(code: number, reason: string): void {
    logger.warn({ code, reason }, "AISStream WebSocket closed");

    this.ws = null;

    this.emit("disconnected", { code, reason });

    // Attempt reconnection if not intentionally closing
    if (!this.isClosing) {
      this.scheduleReconnect();
    }
  }

  // reconnection with exponential backoff
  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isClosing) {
      return;
    }

    logger.info(
      { delay: this.currentReconnectDelay },
      "Scheduling reconnect to AISStream",
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.currentReconnectDelay);

    // Increase delay for next attempt
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * this.options.reconnectBackoff,
      this.options.maxReconnectDelay,
    );
  }

  // Load Redis Lua scripts
  private async loadRedisScripts(): Promise<void> {
    try {
      const redis = getRedis();

      // Load vessel update script
      this.updateScriptSha = (await redis.script(
        "LOAD",
        UPDATE_VESSEL_SCRIPT,
      )) as string;

      logger.info({ sha: this.updateScriptSha }, "Loaded Redis Lua scripts");
    } catch (error) {
      logger.error({ error }, "Failed to load Redis Lua scripts");
      throw error;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// instance
let aisstreamClient: AISStreamClient | null = null;

export async function initAISStreamClient(): Promise<AISStreamClient> {
  if (aisstreamClient) {
    logger.warn("AISStream client already initialized");
    return aisstreamClient;
  }

  if (!config.aisstreamApiKey) {
    throw new Error("AISStream API key not configured");
  }

  aisstreamClient = new AISStreamClient({
    apiKey: config.aisstreamApiKey,
    boundingBox: config.aisstreamBbox,
  });

  aisstreamClient.on("connected", () => {
    logger.info("AISStream client connected");
  });

  aisstreamClient.on("disconnected", ({ code, reason }) => {
    logger.warn({ code, reason }, "AISStream client disconnected");
  });

  aisstreamClient.on("error", (error) => {
    logger.error({ error }, "AISStream client error");
  });

  await aisstreamClient.start();

  return aisstreamClient;
}

export function getAISStreamClient(): AISStreamClient {
  if (!aisstreamClient) {
    throw new Error("AISStream client not initialized");
  }
  return aisstreamClient;
}

export async function stopAISStreamClient(): Promise<void> {
  if (aisstreamClient) {
    await aisstreamClient.stop();
    aisstreamClient = null;
  }
}
