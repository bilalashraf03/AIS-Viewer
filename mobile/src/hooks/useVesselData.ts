import { useState, useCallback, useEffect } from "react";
import { getWebSocketService } from "../services/websocket";
import type {
  VesselMarker,
  VesselPosition,
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

  // Track which vessels belong to which tiles
  // vesselToTiles: mmsi -> Set of tile keys
  // tileToVessels: tile key -> Set of mmsi
  const [vesselToTiles] = useState<Map<number, Set<string>>>(new Map());
  const [tileToVessels] = useState<Map<string, Set<number>>>(new Map());

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
        `[useVesselData] 📡 Received ${updatedVessels.length} vessels for tile ${tile}`,
      );

      // Update vessels inline to avoid callback dependency issues
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

          // Track vessel-tile relationship
          if (!vesselToTiles.has(vessel.mmsi)) {
            vesselToTiles.set(vessel.mmsi, new Set());
          }
          vesselToTiles.get(vessel.mmsi)!.add(tile);

          if (!tileToVessels.has(tile)) {
            tileToVessels.set(tile, new Set());
          }
          tileToVessels.get(tile)!.add(vessel.mmsi);

          if (existedBefore) {
            updateCount++;
          } else {
            newCount++;
          }
        });

        const totalVessels = newVessels.size;

        if (newCount > 0 || updateCount > 0) {
          console.log(
            `[useVesselData] ✨ ${newCount} new, 🔄 ${updateCount} updated | Total: ${totalVessels}`,
          );
          setVesselCount(totalVessels);
          setLastUpdate(new Date().toLocaleTimeString());
        }

        return newVessels;
      });
    });

    return () => {
      unsubVessels();
    };
  }, [vesselToTiles, tileToVessels]);

  // Remove vessels from specific tiles
  const removeVesselsFromTiles = useCallback(
    (tilesToRemove: string[]) => {
      if (tilesToRemove.length === 0) return;

      console.log(
        `[useVesselData] 🗑️ Removing vessels from ${tilesToRemove.length} tiles: ${tilesToRemove.join(", ")}`,
      );

      setVessels((prevVessels) => {
        const newVessels = new Map(prevVessels);
        const vesselsToRemove = new Set<number>();
        let totalVesselsInTiles = 0;

        tilesToRemove.forEach((tile) => {
          const vesselIds = tileToVessels.get(tile);
          console.log(
            `[useVesselData] 🗑️ Tile ${tile} has ${vesselIds?.size || 0} vessels`,
          );

          if (vesselIds) {
            totalVesselsInTiles += vesselIds.size;
            vesselIds.forEach((mmsi) => {
              // Remove tile from vessel's tile set
              const vesselTiles = vesselToTiles.get(mmsi);
              if (vesselTiles) {
                vesselTiles.delete(tile);

                // If vessel is not in any other tiles, mark for removal
                if (vesselTiles.size === 0) {
                  vesselsToRemove.add(mmsi);
                  vesselToTiles.delete(mmsi);
                } else {
                  console.log(
                    `[useVesselData] 🗑️ Vessel ${mmsi} still in ${vesselTiles.size} other tiles`,
                  );
                }
              }
            });
            tileToVessels.delete(tile);
          }
        });

        // Remove vessels that are no longer in any subscribed tiles
        vesselsToRemove.forEach((mmsi) => {
          newVessels.delete(mmsi);
        });

        const remainingVessels = newVessels.size;

        console.log(
          `[useVesselData] 🗑️ Processed ${totalVesselsInTiles} vessels in tiles, removed ${vesselsToRemove.size} vessels | Remaining: ${remainingVessels}`,
        );

        if (vesselsToRemove.size > 0 || totalVesselsInTiles > 0) {
          setVesselCount(remainingVessels);
          setLastUpdate(new Date().toLocaleTimeString());
        }

        return newVessels;
      });
    },
    [vesselToTiles, tileToVessels],
  );

  // Clear all vessels
  const clearAllVessels = useCallback(() => {
    console.log(
      `[useVesselData] 🗑️ Clearing all vessels - Current count: ${vessels.size}, Tracking: ${vesselToTiles.size} vessels, ${tileToVessels.size} tiles`,
    );
    setVessels(new Map());
    vesselToTiles.clear();
    tileToVessels.clear();
    setVesselCount(0);
    setLastUpdate("Never");
    console.log("[useVesselData] ✅ All vessels cleared");
  }, [vesselToTiles, tileToVessels, vessels.size]);

  return {
    vessels,
    vesselCount,
    lastUpdate,
    isLoading,
    removeVesselsFromTiles,
    clearAllVessels,
  };
}
