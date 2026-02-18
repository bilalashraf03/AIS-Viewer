import WebSocket, { WebSocketServer } from "ws";
import { Server as HTTPServer } from "http";
import { EventEmitter } from "events";
import { logger } from "../utils/logger";
import { getRedis } from "./redis";
import { getAISStreamClient } from "./aisstream-client";
import { VesselPosition } from "../types/ais";

interface WSClient {
  ws: WebSocket;
  id: string;
  subscribedTiles: Set<string>;
  isAlive: boolean;
}

interface SubscribeMessage {
  type: "subscribe";
  tiles: string[];
}

interface UnsubscribeMessage {
  type: "unsubscribe";
  tiles: string[];
}

interface PingMessage {
  type: "ping";
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

interface VesselUpdateMessage {
  type: "vessel_update";
  tile: string;
  vessels: VesselPosition[];
}

export class VesselWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private tileSubscriptions: Map<string, Set<string>> = new Map(); // tile -> Set<clientId>
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private dirtyTileFlushInterval: NodeJS.Timeout | null = null;
  private dirtyTiles: Set<string> = new Set();

  constructor() {
    super();
  }

  async start(server: HTTPServer, path: string = "/ws"): Promise<void> {
    logger.info({ path }, "Starting WebSocket server");

    this.wss = new WebSocketServer({
      server,
      path,
      perMessageDeflate: false, // Disable compression
    });

    this.wss.on("connection", (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    this.setupAISStreamListener();

    // Start heartbeat interval (30 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000);

    // Start dirty tile flush interval (500ms)
    this.dirtyTileFlushInterval = setInterval(() => {
      this.flushDirtyTiles();
    }, 500);

    logger.info(
      {
        path,
        heartbeatInterval: "30s",
        flushInterval: "500ms",
      },
      "WebSocket server started",
    );
  }

  async stop(): Promise<void> {
    logger.info("Stopping WebSocket server");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.dirtyTileFlushInterval) {
      clearInterval(this.dirtyTileFlushInterval);
      this.dirtyTileFlushInterval = null;
    }

    this.clients.forEach((client) => {
      client.ws.close(1001, "Server shutting down");
    });

    this.clients.clear();
    this.tileSubscriptions.clear();

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          logger.info("WebSocket server stopped");
          resolve();
        });
      });
      this.wss = null;
    }
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress;

    logger.info({ clientId, ip: clientIp }, "New WebSocket connection");

    const client: WSClient = {
      ws,
      id: clientId,
      subscribedTiles: new Set(),
      isAlive: true,
    };

    this.clients.set(clientId, client);

    this.sendToClient(client, {
      type: "connected",
      clientId,
      message: "Connected to AIS Vessel WebSocket",
    });

    ws.on("message", (data: WebSocket.Data) => {
      this.handleMessage(client, data);
    });

    ws.on("pong", () => {
      client.isAlive = true;
    });

    ws.on("close", (code: number, reason: Buffer) => {
      this.handleDisconnect(client, code, reason.toString());
    });

    ws.on("error", (error: Error) => {
      logger.error(
        { clientId, error: error.message },
        "WebSocket client error",
      );
    });

    this.emit("clientConnected", clientId);
  }

  private handleMessage(client: WSClient, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(client, message.tiles);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(client, message.tiles);
          break;

        case "ping":
          this.sendToClient(client, { type: "pong" });
          break;

        default:
          logger.warn(
            { clientId: client.id, messageType: (message as any).type },
            "Unknown message type",
          );
      }
    } catch (error) {
      logger.error(
        { clientId: client.id, error },
        "Failed to parse client message",
      );
    }
  }

  private handleSubscribe(client: WSClient, tiles: string[]): void {
    logger.debug({ clientId: client.id, tiles }, "Client subscribing to tiles");

    tiles.forEach((tile) => {
      // Add tile to client's subscriptions
      client.subscribedTiles.add(tile);

      // Add client to tile's subscribers
      if (!this.tileSubscriptions.has(tile)) {
        this.tileSubscriptions.set(tile, new Set());
      }
      this.tileSubscriptions.get(tile)!.add(client.id);
    });

    this.sendToClient(client, {
      type: "subscribed",
      tiles,
      message: `Subscribed to ${tiles.length} tile(s)`,
    });

    // Send initial data for subscribed tiles
    // This is important because now i am not using REST Api for initial data
    this.sendInitialTileData(client, tiles);
  }

  private handleUnsubscribe(client: WSClient, tiles: string[]): void {
    logger.debug(
      { clientId: client.id, tiles },
      "Client unsubscribing from tiles",
    );

    tiles.forEach((tile) => {
      // Remove tile from client's subscriptions
      client.subscribedTiles.delete(tile);

      // Remove client from tile's subscribers
      const subscribers = this.tileSubscriptions.get(tile);
      if (subscribers) {
        subscribers.delete(client.id);
        if (subscribers.size === 0) {
          this.tileSubscriptions.delete(tile);
        }
      }
    });

    this.sendToClient(client, {
      type: "unsubscribed",
      tiles,
      message: `Unsubscribed from ${tiles.length} tile(s)`,
    });
  }

  private async sendInitialTileData(
    client: WSClient,
    tiles: string[],
  ): Promise<void> {
    try {
      const redis = getRedis();

      for (const tile of tiles) {
        const tileKey = `cur:tile:${tile}`;
        const mmsiList = await redis.smembers(tileKey);

        if (mmsiList.length === 0) {
          continue;
        }

        const vessels: VesselPosition[] = [];
        const pipeline = redis.pipeline();

        mmsiList.forEach((mmsi) => {
          pipeline.hgetall(`cur:vessel:${mmsi}`);
        });

        const results = await pipeline.exec();

        if (results) {
          results.forEach(([err, data]) => {
            if (!err && data && typeof data === "object") {
              const vesselData = data as any;
              vessels.push({
                mmsi: parseInt(vesselData.mmsi, 10),
                lat: parseFloat(vesselData.lat),
                lon: parseFloat(vesselData.lon),
                cog:
                  vesselData.cog !== "null" ? parseFloat(vesselData.cog) : null,
                sog:
                  vesselData.sog !== "null" ? parseFloat(vesselData.sog) : null,
                heading:
                  vesselData.heading !== "null"
                    ? parseInt(vesselData.heading, 10)
                    : null,
                timestamp: vesselData.timestamp,
                tile: vesselData.tile,
              });
            }
          });
        }

        // Send vessels for this tile
        if (vessels.length > 0) {
          this.sendToClient(client, {
            type: "vessel_update",
            tile,
            vessels,
          });
        }
      }

      logger.debug(
        { clientId: client.id, tileCount: tiles.length },
        "Sent initial tile data",
      );
    } catch (error) {
      logger.error(
        { clientId: client.id, error },
        "Failed to send initial tile data",
      );
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(
    client: WSClient,
    code: number,
    reason: string,
  ): void {
    logger.info(
      { clientId: client.id, code, reason },
      "WebSocket client disconnected",
    );

    // Remove client from all tile subscriptions
    client.subscribedTiles.forEach((tile) => {
      const subscribers = this.tileSubscriptions.get(tile);
      if (subscribers) {
        subscribers.delete(client.id);
        if (subscribers.size === 0) {
          this.tileSubscriptions.delete(tile);
        }
      }
    });

    // Remove client
    this.clients.delete(client.id);

    this.emit("clientDisconnected", client.id);
  }

  /**
   * Setup listener for AISStream vessel updates
   */
  private setupAISStreamListener(): void {
    try {
      const aisstreamClient = getAISStreamClient();

      aisstreamClient.on("vesselUpdate", (vessel: VesselPosition) => {
        // Mark tile as dirty
        this.dirtyTiles.add(vessel.tile);
      });

      aisstreamClient.on("dirtyTiles", (tiles: string[]) => {
        tiles.forEach((tile) => this.dirtyTiles.add(tile));
      });

      logger.info("WebSocket server listening to AISStream updates");
    } catch (error) {
      logger.warn(
        { error },
        "AISStream client not available, WebSocket will not receive updates",
      );
    }
  }

  /**
   * Flush dirty tiles to subscribers
   */
  private async flushDirtyTiles(): Promise<void> {
    if (this.dirtyTiles.size === 0) {
      return;
    }

    const tiles = Array.from(this.dirtyTiles);
    this.dirtyTiles.clear();

    try {
      const redis = getRedis();

      for (const tile of tiles) {
        const subscribers = this.tileSubscriptions.get(tile);
        if (!subscribers || subscribers.size === 0) {
          continue;
        }

        // Fetch updated vessels for this tile
        const tileKey = `cur:tile:${tile}`;
        const mmsiList = await redis.smembers(tileKey);

        if (mmsiList.length === 0) {
          // Send empty update
          const message: VesselUpdateMessage = {
            type: "vessel_update",
            tile,
            vessels: [],
          };

          subscribers.forEach((clientId) => {
            const client = this.clients.get(clientId);
            if (client) {
              this.sendToClient(client, message);
            }
          });
          continue;
        }

        // Fetch vessel data
        const vessels: VesselPosition[] = [];
        const pipeline = redis.pipeline();

        mmsiList.forEach((mmsi) => {
          pipeline.hgetall(`cur:vessel:${mmsi}`);
        });

        const results = await pipeline.exec();

        if (results) {
          results.forEach(([err, data]) => {
            if (!err && data && typeof data === "object") {
              const vesselData = data as any;
              vessels.push({
                mmsi: parseInt(vesselData.mmsi, 10),
                lat: parseFloat(vesselData.lat),
                lon: parseFloat(vesselData.lon),
                cog:
                  vesselData.cog !== "null" ? parseFloat(vesselData.cog) : null,
                sog:
                  vesselData.sog !== "null" ? parseFloat(vesselData.sog) : null,
                heading:
                  vesselData.heading !== "null"
                    ? parseInt(vesselData.heading, 10)
                    : null,
                timestamp: vesselData.timestamp,
                tile: vesselData.tile,
              });
            }
          });
        }

        // Send update to all subscribers of this tile
        const message: VesselUpdateMessage = {
          type: "vessel_update",
          tile,
          vessels,
        };

        subscribers.forEach((clientId) => {
          const client = this.clients.get(clientId);
          if (client) {
            this.sendToClient(client, message);
          }
        });
      }
    } catch (error) {
      logger.error({ error }, "Failed to flush dirty tiles");
    }
  }

  private heartbeat(): void {
    const deadClients: string[] = [];

    this.clients.forEach((client) => {
      if (!client.isAlive) {
        // Client didn't respond to ping, terminate
        deadClients.push(client.id);
        client.ws.terminate();
        return;
      }

      // Mark as dead and send ping
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (error) {
        logger.error(
          { clientId: client.id, error },
          "Failed to send ping to client",
        );
        deadClients.push(client.id);
        client.ws.terminate();
      }
    });

    // Clean up dead clients
    deadClients.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        this.handleDisconnect(client, 1006, "Heartbeat timeout");
      }
    });

    if (deadClients.length > 0) {
      logger.info(
        { count: deadClients.length },
        "Removed dead WebSocket clients",
      );
    }
  }

  private sendToClient(client: WSClient, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error(
          { clientId: client.id, error },
          "Failed to send message to client",
        );
      }
    }
  }

  broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error(
            { clientId: client.id, error },
            "Failed to broadcast to client",
          );
        }
      }
    });

    logger.debug({ clients: sentCount }, "Broadcast message sent");
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): {
    clients: number;
    subscriptions: number;
    tiles: number;
  } {
    return {
      clients: this.clients.size,
      subscriptions: Array.from(this.clients.values()).reduce(
        (sum, client) => sum + client.subscribedTiles.size,
        0,
      ),
      tiles: this.tileSubscriptions.size,
    };
  }
}

// Singleton instance
let wsServer: VesselWebSocketServer | null = null;

export async function initWebSocketServer(
  server: HTTPServer,
  path?: string,
): Promise<VesselWebSocketServer> {
  if (wsServer) {
    logger.warn("WebSocket server already initialized");
    return wsServer;
  }

  wsServer = new VesselWebSocketServer();
  await wsServer.start(server, path);

  return wsServer;
}

export function getWebSocketServer(): VesselWebSocketServer {
  if (!wsServer) {
    throw new Error("WebSocket server not initialized");
  }
  return wsServer;
}

export async function stopWebSocketServer(): Promise<void> {
  if (wsServer) {
    await wsServer.stop();
    wsServer = null;
  }
}
