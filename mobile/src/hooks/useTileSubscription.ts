import { useState, useRef, useCallback } from "react";
import { Alert } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { getWebSocketService } from "../services/websocket";
import { MIN_ZOOM_FOR_VESSELS } from "../config/env";
import {
  getTilesInBounds,
  tileToKey,
  visibleBoundsToBounds,
} from "../utils/tiles";
import type {
  Bounds,
  TileCoordinates,
  UseTileSubscriptionReturn,
} from "../types";

interface UseTileSubscriptionOptions {
  tileZoom: number;
  initialZoom: number;
  mapRef: React.RefObject<MapboxGL.MapView | null>;
  removeVesselsFromTiles: (tiles: string[]) => void;
  clearAllVessels: () => void;
}

export function useTileSubscription({
  tileZoom,
  initialZoom,
  mapRef,
  removeVesselsFromTiles,
  clearAllVessels,
}: UseTileSubscriptionOptions): UseTileSubscriptionReturn {
  const [subscribedTiles, setSubscribedTiles] = useState<Set<string>>(
    new Set(),
  );
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSubscribedTilesRef = useRef<Set<string>>(new Set());
  const currentZoomRef = useRef<number>(initialZoom);

  // Subscribe to viewport tiles
  const subscribeToViewportTiles = useCallback(
    async (zoomLevel?: number) => {
      if (!mapRef.current) return;

      try {
        // Get current zoom level
        let currentZoomLevel = zoomLevel;
        if (currentZoomLevel === undefined) {
          currentZoomLevel = await mapRef.current.getZoom();
        }
        const roundedZoom = Math.round(currentZoomLevel * 10) / 10;

        // Update state immediately
        setCurrentZoom(roundedZoom);
        currentZoomRef.current = roundedZoom;

        // If zoom < MIN_ZOOM_FOR_VESSELS, unsubscribe from all tiles and clear vessels
        if (roundedZoom < MIN_ZOOM_FOR_VESSELS) {
          const wsService = getWebSocketService();
          const currentTileKeys = Array.from(currentSubscribedTilesRef.current);

          if (currentTileKeys.length > 0) {
            console.log(
              `[useTileSubscription] 🔍 Zoom ${roundedZoom} < ${MIN_ZOOM_FOR_VESSELS}, unsubscribing from ${currentTileKeys.length} tiles`,
            );
            wsService.unsubscribe(currentTileKeys);
            currentSubscribedTilesRef.current.clear();
            setSubscribedTiles(new Set());
            clearAllVessels();
          }
          setIsLoading(false);
          return;
        }

        const visibleBounds = await mapRef.current.getVisibleBounds();

        if (!visibleBounds || visibleBounds.length !== 2) {
          console.warn("[useTileSubscription] Invalid visible bounds");
          return;
        }

        const bounds = visibleBoundsToBounds(visibleBounds);

        // Calculate visible tiles at configured zoom level
        const visibleTiles = getTilesInBounds(bounds, tileZoom);
        const visibleTileKeys = visibleTiles.map(tileToKey);
        const newTileSet = new Set(visibleTileKeys);

        console.log(
          `[useTileSubscription] 📍 ${visibleTiles.length} tiles visible at zoom ${tileZoom}`,
        );

        // Check tile limit
        if (visibleTiles.length > 1500) {
          console.error(
            `[useTileSubscription] ⚠️ Too many tiles: ${visibleTiles.length}. Please zoom in.`,
          );
          Alert.alert(
            "Too Many Tiles",
            `${visibleTiles.length} tiles required. Please zoom in closer.`,
            [{ text: "OK" }],
          );
          return;
        }

        // Calculate difference from current subscriptions
        const currentTileKeys = Array.from(currentSubscribedTilesRef.current);
        const tilesToSubscribe = visibleTileKeys.filter(
          (key) => !currentSubscribedTilesRef.current.has(key),
        );
        const tilesToUnsubscribe = currentTileKeys.filter(
          (key) => !newTileSet.has(key),
        );

        const wsService = getWebSocketService();

        // Unsubscribe from old tiles and remove their vessels
        if (tilesToUnsubscribe.length > 0) {
          console.log(
            `[useTileSubscription] 📍 Unsubscribing from ${tilesToUnsubscribe.length} tiles`,
          );
          wsService.unsubscribe(tilesToUnsubscribe);
          removeVesselsFromTiles(tilesToUnsubscribe);
          tilesToUnsubscribe.forEach((key) =>
            currentSubscribedTilesRef.current.delete(key),
          );
        }

        // Subscribe to new tiles
        if (tilesToSubscribe.length > 0) {
          console.log(
            `[useTileSubscription] 📍 Subscribing to ${tilesToSubscribe.length} new tiles`,
          );

          // Subscribe via WebSocket
          // Note: WebSocket server automatically sends initial vessel data
          // for subscribed tiles, followed by real-time updates
          wsService.subscribe(tilesToSubscribe);
          tilesToSubscribe.forEach((key) =>
            currentSubscribedTilesRef.current.add(key),
          );
        }

        setSubscribedTiles(new Set(currentSubscribedTilesRef.current));

        console.log(
          `[useTileSubscription] 📍 Total subscribed tiles: ${currentSubscribedTilesRef.current.size}`,
        );

        if (!isInitialLoadComplete && tilesToSubscribe.length > 0) {
          setIsInitialLoadComplete(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(
          "[useTileSubscription] Error subscribing to viewport tiles:",
          error,
        );
      }
    },
    [
      mapRef,
      tileZoom,
      isInitialLoadComplete,
      removeVesselsFromTiles,
      clearAllVessels,
    ],
  );

  // Handle region change (pan/zoom) with debouncing
  const handleRegionDidChange = useCallback(async () => {
    if (!mapRef.current) return;

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce to avoid too many updates (500ms)
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        // Get zoom and update tile subscriptions
        const zoom = await mapRef.current?.getZoom();
        if (zoom !== undefined) {
          await subscribeToViewportTiles(zoom);
        }
      } catch (error) {
        console.error(
          "[useTileSubscription] Error handling region change:",
          error,
        );
      }
    }, 500); // 500ms debounce
  }, [subscribeToViewportTiles]);

  // Handle camera changes (update zoom for display and threshold checking)
  const handleCameraChanged = useCallback(
    (state: any) => {
      if (state?.properties?.zoom !== undefined) {
        const roundedZoom = Math.round(state.properties.zoom * 10) / 10;
        setCurrentZoom(roundedZoom);
        currentZoomRef.current = roundedZoom;

        console.log(`[useTileSubscription] 🔍 Camera zoom ${roundedZoom}`);

        // If zoom drops below MIN_ZOOM_FOR_VESSELS, immediately unsubscribe and clear vessels
        if (roundedZoom < MIN_ZOOM_FOR_VESSELS) {
          console.log(
            `Unsubscribing because zoom is below ${MIN_ZOOM_FOR_VESSELS}`,
          );
          if (currentSubscribedTilesRef.current.size > 0) {
            console.log(
              `[useTileSubscription] 🔍 Camera zoom ${roundedZoom} < ${MIN_ZOOM_FOR_VESSELS}, clearing vessels`,
            );
            const wsService = getWebSocketService();
            const currentTileKeys = Array.from(
              currentSubscribedTilesRef.current,
            );
            wsService.unsubscribe(currentTileKeys);
            currentSubscribedTilesRef.current.clear();
            setSubscribedTiles(new Set());
            clearAllVessels();
            setIsLoading(false);
          }
          // Don't subscribe to tiles when zoom < MIN_ZOOM_FOR_VESSELS
          return;
        }
      }
    },
    [clearAllVessels],
  );

  // Initial map load
  const handleMapReady = useCallback(async () => {
    console.log("[useTileSubscription] 🗺️ Map ready, loading initial tiles");

    if (!mapRef.current) return;

    setIsLoading(true);

    // Trigger initial tile subscription after a short delay to ensure map is ready
    setTimeout(async () => {
      console.log("[useTileSubscription] 🗺️ Triggering initial subscription");
      try {
        const zoom = await mapRef.current?.getZoom();
        if (zoom !== undefined) {
          await subscribeToViewportTiles(zoom);
        }
        console.log("[useTileSubscription] 🗺️ Initial subscription complete");
      } catch (error) {
        console.error("[useTileSubscription] Error in initial load:", error);
      }
    }, 300);
  }, [subscribeToViewportTiles]);

  // Cleanup on unmount
  useRef(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  });

  return {
    subscribedTiles,
    subscribeToViewportTiles,
    handleRegionDidChange,
    handleCameraChanged,
    handleMapReady,
    currentZoom,
    isLoading,
  };
}
