/**
 * useTileSubscription Hook
 *
 * Manages tile subscription and viewport tracking:
 * - Calculates visible tiles in viewport
 * - Subscribes/unsubscribes to tiles via WebSocket
 * - Fetches initial vessel data for new tiles
 * - Handles map region changes with debouncing
 * - Manages zoom level tracking
 */

import { useState, useRef, useCallback } from "react";
import { Alert } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { getWebSocketService } from "../services/websocket";
import {
  getTilesInBounds,
  tileToKey,
  visibleBoundsToBounds,
  keysToTiles,
  haveBoundsChanged,
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
  loadInitialVesselsForTiles: (tiles: TileCoordinates[]) => Promise<void>;
}

export function useTileSubscription({
  tileZoom,
  initialZoom,
  mapRef,
  loadInitialVesselsForTiles,
}: UseTileSubscriptionOptions): UseTileSubscriptionReturn {
  const [subscribedTiles, setSubscribedTiles] = useState<Set<string>>(
    new Set(),
  );
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const lastBoundsRef = useRef<Bounds | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSubscribedTilesRef = useRef<Set<string>>(new Set());

  // Subscribe to viewport tiles
  const subscribeToViewportTiles = useCallback(async () => {
    if (!mapRef.current) return;

    try {
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

      // Unsubscribe from old tiles
      if (tilesToUnsubscribe.length > 0) {
        console.log(
          `[useTileSubscription] 📍 Unsubscribing from ${tilesToUnsubscribe.length} tiles`,
        );
        wsService.unsubscribe(tilesToUnsubscribe);
        tilesToUnsubscribe.forEach((key) =>
          currentSubscribedTilesRef.current.delete(key),
        );
      }

      // Subscribe to new tiles
      if (tilesToSubscribe.length > 0) {
        console.log(
          `[useTileSubscription] 📍 Subscribing to ${tilesToSubscribe.length} tiles`,
        );

        // Parse tile keys back to coordinates for initial fetch
        const newTileCoords = keysToTiles(tilesToSubscribe);

        // Fetch initial data via REST API
        await loadInitialVesselsForTiles(newTileCoords);

        // Subscribe via WebSocket for live updates
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
  }, [mapRef, tileZoom, loadInitialVesselsForTiles, isInitialLoadComplete]);

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
        const visibleBounds = await mapRef.current!.getVisibleBounds();

        if (!visibleBounds || visibleBounds.length !== 2) {
          console.warn("[useTileSubscription] Invalid visible bounds");
          return;
        }

        const bounds = visibleBoundsToBounds(visibleBounds);

        // Don't update if bounds haven't changed much
        if (
          lastBoundsRef.current &&
          !haveBoundsChanged(lastBoundsRef.current, bounds)
        ) {
          return;
        }

        lastBoundsRef.current = bounds;

        console.log(
          `[useTileSubscription] 🗺️ Viewport changed: N=${bounds.north.toFixed(2)}, S=${bounds.south.toFixed(2)}, E=${bounds.east.toFixed(2)}, W=${bounds.west.toFixed(2)}`,
        );

        // Update tile subscriptions
        await subscribeToViewportTiles();
      } catch (error) {
        console.error(
          "[useTileSubscription] Error handling region change:",
          error,
        );
      }
    }, 500); // 500ms debounce
  }, [subscribeToViewportTiles]);

  // Handle zoom change
  const handleRegionWillChange = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getZoom().then((zoom: number) => {
        setCurrentZoom(Math.round(zoom * 10) / 10);
      });
    }
  }, [mapRef]);

  // Initial map load
  const handleMapReady = useCallback(() => {
    console.log("[useTileSubscription] 🗺️ Map ready");
    setIsLoading(true);
  }, []);

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
    handleRegionWillChange,
    handleMapReady,
    currentZoom,
    isLoading,
  };
}
