/**
 * useVesselData Hook
 *
 * Manages vessel data state:
 * - Vessel storage and updates
 * - WebSocket vessel updates
 * - REST API vessel loading
 * - Vessel count tracking
 * - Last update timestamp
 */

import { useState, useCallback, useEffect } from "react";
import { getAPIService } from "../services/api";
import { getWebSocketService } from "../services/websocket";
import type {
  VesselMarker,
  VesselPosition,
  TileCoordinates,
  UseVesselDataReturn,
} from "../types";

interface UseVesselDataOptions {
  onVesselCountChange?: (count: number) => void;
  onLastUpdateChange?: (timestamp: string) => void;
}

export function useVesselData({
  onVesselCountChange,
  onLastUpdateChange,
}: UseVesselDataOptions = {}): UseVesselDataReturn {
  const [vessels, setVessels] = useState<Map<number, VesselMarker>>(new Map());
  const [vesselCount, setVesselCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>("Never");
  const [isLoading, setIsLoading] = useState(true);

  // Update parent components when vessel count changes
  useEffect(() => {
    onVesselCountChange?.(vesselCount);
  }, [vesselCount, onVesselCountChange]);

  // Update parent components when last update changes
  useEffect(() => {
    onLastUpdateChange?.(lastUpdate);
  }, [lastUpdate, onLastUpdateChange]);

  // Listen to WebSocket vessel updates
  useEffect(() => {
    const wsService = getWebSocketService();

    const unsubVessels = wsService.onVesselUpdate((tile, updatedVessels) => {
      console.log(
        `[useVesselData] Received ${updatedVessels.length} vessels for tile ${tile}`,
      );
      updateVesselsFromWebSocket(updatedVessels);
    });

    return () => {
      unsubVessels();
    };
  }, []);

  // Update vessels from WebSocket
  const updateVesselsFromWebSocket = useCallback(
    (updatedVessels: VesselPosition[]) => {
      setVessels((prevVessels) => {
        const newVessels = new Map(prevVessels);
        let newCount = 0;
        let updateCount = 0;

        updatedVessels.forEach((vessel) => {
          const existedBefore = newVessels.has(vessel.mmsi);
          newVessels.set(vessel.mmsi, {
            ...vessel,
            id: `vessel-${vessel.mmsi}`,
          });

          if (existedBefore) {
            updateCount++;
          } else {
            newCount++;
          }
        });

        if (newCount > 0 || updateCount > 0) {
          console.log(
            `[useVesselData] ✨ ${newCount} new, 🔄 ${updateCount} updated | Total: ${newVessels.size}`,
          );
        }

        setVesselCount(newVessels.size);
        setLastUpdate(new Date().toLocaleTimeString());

        return newVessels;
      });
    },
    [],
  );

  // Load initial vessels via REST API
  const loadInitialVesselsForTiles = useCallback(
    async (tiles: TileCoordinates[]) => {
      if (tiles.length === 0) return;

      try {
        console.log(
          `[useVesselData] 📦 Fetching initial vessels for ${tiles.length} new tiles via REST API...`,
        );

        const apiService = getAPIService();
        const tileData = await apiService.fetchMultipleTiles(tiles);

        let totalFetched = 0;

        setVessels((prevVessels) => {
          const newVessels = new Map(prevVessels);

          tileData.forEach((tileVessels, tileKey) => {
            totalFetched += tileVessels.length;
            tileVessels.forEach((vessel) => {
              newVessels.set(vessel.mmsi, {
                ...vessel,
                id: `vessel-${vessel.mmsi}`,
              });
            });
          });

          return newVessels;
        });

        console.log(
          `[useVesselData] 📦 Loaded ${totalFetched} vessels from REST API | Total: ${vessels.size + totalFetched}`,
        );

        setVesselCount((prev) => prev + totalFetched);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (error) {
        console.error("[useVesselData] Error loading initial vessels:", error);
      }
    },
    [vessels.size],
  );

  return {
    vessels,
    vesselCount,
    lastUpdate,
    isLoading,
    updateVesselsFromWebSocket,
    loadInitialVesselsForTiles,
  };
}
