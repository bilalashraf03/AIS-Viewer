/**
 * WebSocket Service for Real-time Vessel Updates
 *
 * Features:
 * - Connect/disconnect to WebSocket server
 * - Subscribe/unsubscribe to tiles
 * - Receive vessel updates
 * - Automatic reconnection
 * - Event-based updates
 */

import type {
  VesselPosition,
  ConnectedMessage,
  SubscribedMessage,
  UnsubscribedMessage,
  VesselUpdateMessage,
  PongMessage,
  ServerMessage,
  VesselUpdateCallback,
  ConnectionCallback,
  ErrorCallback,
} from "../types";

// Re-export types for backwards compatibility
export type {
  VesselPosition,
  VesselUpdateCallback,
  ConnectionCallback,
  ErrorCallback,
} from "../types";

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private subscribedTiles: Set<string> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000; // 30 seconds
  private initialReconnectDelay: number = 1000; // 1 second
  private isIntentionalDisconnect: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;

  // Event handlers
  private vesselUpdateHandlers: Set<VesselUpdateCallback> = new Set();
  private connectionHandlers: Set<ConnectionCallback> = new Set();
  private errorHandlers: Set<ErrorCallback> = new Set();

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log("[WebSocket] Connecting to:", this.url);
        this.isIntentionalDisconnect = false;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("[WebSocket] Connected");
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          this.startPingInterval();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("[WebSocket] Error:", error);
          const err = new Error("WebSocket error");
          this.notifyErrorHandlers(err);
          reject(err);
        };

        this.ws.onclose = (event) => {
          console.log("[WebSocket] Closed:", event.code, event.reason);
          this.cleanup();
          this.notifyConnectionHandlers(false);

          // Attempt reconnection if not intentional disconnect
          if (!this.isIntentionalDisconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.error("[WebSocket] Connection failed:", error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log("[WebSocket] Disconnecting");
    this.isIntentionalDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.subscribedTiles.clear();
  }

  /**
   * Subscribe to specific tiles
   */
  subscribe(tiles: string[]): void {
    if (!this.isConnected()) {
      console.warn("[WebSocket] Not connected, cannot subscribe");
      return;
    }

    console.log("[WebSocket] Subscribing to tiles:", tiles);

    tiles.forEach((tile) => this.subscribedTiles.add(tile));

    this.send({
      type: "subscribe",
      tiles,
    });
  }

  /**
   * Unsubscribe from specific tiles
   */
  unsubscribe(tiles: string[]): void {
    if (!this.isConnected()) {
      console.warn("[WebSocket] Not connected, cannot unsubscribe");
      return;
    }

    console.log("[WebSocket] Unsubscribing from tiles:", tiles);

    tiles.forEach((tile) => this.subscribedTiles.delete(tile));

    this.send({
      type: "unsubscribe",
      tiles,
    });
  }

  /**
   * Get currently subscribed tiles
   */
  getSubscribedTiles(): string[] {
    return Array.from(this.subscribedTiles);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Add vessel update handler
   */
  onVesselUpdate(handler: VesselUpdateCallback): () => void {
    this.vesselUpdateHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.vesselUpdateHandlers.delete(handler);
    };
  }

  /**
   * Add connection status handler
   */
  onConnectionChange(handler: ConnectionCallback): () => void {
    this.connectionHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorCallback): () => void {
    this.errorHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ServerMessage;

      switch (message.type) {
        case "connected":
          console.log("[WebSocket] Server message:", message.message);
          break;

        case "subscribed":
          console.log(
            "[WebSocket] Subscribed to:",
            message.tiles.length,
            "tiles",
          );
          break;

        case "unsubscribed":
          console.log(
            "[WebSocket] Unsubscribed from:",
            message.tiles.length,
            "tiles",
          );
          break;

        case "vessel_update":
          this.notifyVesselUpdateHandlers(message.tile, message.vessels);
          break;

        case "pong":
          // Server responded to ping
          break;

        default:
          console.warn(
            "[WebSocket] Unknown message type:",
            (message as any).type,
          );
      }
    } catch (error) {
      console.error("[WebSocket] Failed to parse message:", error);
    }
  }

  /**
   * Send message to server
   */
  private send(message: any): void {
    if (!this.isConnected()) {
      console.warn("[WebSocket] Cannot send, not connected");
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Failed to send message:", error);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isIntentionalDisconnect) {
      return;
    }

    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempts++;

      this.connect()
        .then(() => {
          console.log("[WebSocket] Reconnected successfully");

          // Resubscribe to previously subscribed tiles
          if (this.subscribedTiles.size > 0) {
            const tiles = Array.from(this.subscribedTiles);
            console.log("[WebSocket] Resubscribing to", tiles.length, "tiles");
            this.subscribedTiles.clear(); // Clear before resubscribing
            this.subscribe(tiles);
          }
        })
        .catch((error) => {
          console.error("[WebSocket] Reconnection failed:", error);
        });
    }, delay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping" });
      }
    }, 25000); // Every 25 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopPingInterval();
    this.ws = null;
  }

  /**
   * Notify vessel update handlers
   */
  private notifyVesselUpdateHandlers(
    tile: string,
    vessels: VesselPosition[],
  ): void {
    this.vesselUpdateHandlers.forEach((handler) => {
      try {
        handler(tile, vessels);
      } catch (error) {
        console.error("[WebSocket] Handler error:", error);
      }
    });
  }

  /**
   * Notify connection handlers
   */
  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error("[WebSocket] Handler error:", error);
      }
    });
  }

  /**
   * Notify error handlers
   */
  private notifyErrorHandlers(error: Error): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (error) {
        console.error("[WebSocket] Handler error:", error);
      }
    });
  }
}

// Singleton instance
let wsService: WebSocketService | null = null;

/**
 * Initialize WebSocket service
 */
export function initWebSocketService(url: string): WebSocketService {
  if (wsService) {
    console.warn("[WebSocket] Service already initialized");
    return wsService;
  }

  wsService = new WebSocketService(url);
  return wsService;
}

/**
 * Get WebSocket service instance
 */
export function getWebSocketService(): WebSocketService {
  if (!wsService) {
    throw new Error("WebSocket service not initialized");
  }
  return wsService;
}
