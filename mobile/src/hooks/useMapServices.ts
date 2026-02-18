import { useEffect, useState } from "react";
import { Alert } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { initAPIService } from "../services/api";
import {
  initWebSocketService,
  getWebSocketService,
} from "../services/websocket";
import type { UseMapServicesReturn } from "../types";

interface UseMapServicesOptions {
  mapboxToken: string;
  apiBaseUrl: string;
  wsUrl: string;
  tileZoom: number;
  onConnectionChange?: (connected: boolean) => void;
}

export function useMapServices({
  mapboxToken,
  apiBaseUrl,
  wsUrl,
  tileZoom,
  onConnectionChange,
}: UseMapServicesOptions): UseMapServicesReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log("[useMapServices] Initializing services...");
    console.log(`[useMapServices] API URL: ${apiBaseUrl}`);
    console.log(`[useMapServices] WebSocket URL: ${wsUrl}`);
    console.log(`[useMapServices] Tile Zoom: ${tileZoom}`);

    // Set Mapbox token
    console.log(
      `[useMapServices] Setting Mapbox token: ${mapboxToken ? `${mapboxToken.substring(0, 10)}...` : "MISSING"}`,
    );
    MapboxGL.setAccessToken(mapboxToken);
    console.log("[useMapServices] ✅ Mapbox token set");

    // Initialize API service
    initAPIService(apiBaseUrl);

    // Initialize WebSocket service
    const wsService = initWebSocketService(wsUrl);

    // Connect WebSocket
    wsService
      .connect()
      .then(() => {
        console.log("[useMapServices] ✅ WebSocket connected successfully");
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error(
          "[useMapServices] ❌ WebSocket connection failed:",
          error,
        );
        Alert.alert(
          "Connection Error",
          "Failed to connect to vessel tracking server. Please check your backend configuration.",
          [
            {
              text: "Retry",
              onPress: () => {
                wsService.connect().catch((err) => {
                  console.error("[useMapServices] Retry failed:", err);
                });
              },
            },
            {
              text: "OK",
              onPress: () => setIsInitialized(true),
            },
          ],
        );
      });

    // Listen to connection changes
    const unsubConnection = wsService.onConnectionChange((connected) => {
      console.log("[useMapServices] Connection status changed:", connected);
      setIsConnected(connected);
      onConnectionChange?.(connected);
    });

    // Listen to errors
    const unsubError = wsService.onError((error) => {
      console.error("[useMapServices] WebSocket error:", error);
    });

    // Cleanup
    return () => {
      console.log("[useMapServices] Cleaning up...");
      unsubConnection();
      unsubError();
      wsService.disconnect();
    };
  }, [mapboxToken, apiBaseUrl, wsUrl, tileZoom, onConnectionChange]);

  return {
    isConnected,
    isInitialized,
  };
}
