/**
 * API Service for Fetching Vessel Data
 *
 * Features:
 * - Fetch vessels from specific tiles
 * - Batch fetch multiple tiles
 * - Error handling and retries
 * - Type-safe responses
 */

import type {
  VesselData,
  TileCoordinates,
  FetchVesselsOptions,
} from "../types";

// Re-export types for backwards compatibility
export type {
  VesselData,
  TileCoordinates,
  FetchVesselsOptions,
} from "../types";

export class APIService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Fetch vessels from a specific tile
   */
  async fetchTileVessels(
    tile: TileCoordinates,
    options: FetchVesselsOptions = {},
  ): Promise<VesselData[]> {
    const { timeout = 10000, retries = 3 } = options;
    const url = `${this.baseUrl}/tiles/${tile.z}/${tile.x}/${tile.y}.json`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(
          `[API] Fetching tile ${tile.z}/${tile.x}/${tile.y} (attempt ${attempt + 1}/${retries})`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            // No vessels in this tile
            console.log(
              `[API] No vessels in tile ${tile.z}/${tile.x}/${tile.y}`,
            );
            return [];
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const vessels = await response.json();

        if (!Array.isArray(vessels)) {
          throw new Error("Invalid response format: expected array");
        }

        console.log(
          `[API] Fetched ${vessels.length} vessels from tile ${tile.z}/${tile.x}/${tile.y}`,
        );

        return vessels;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `[API] Failed to fetch tile ${tile.z}/${tile.x}/${tile.y}:`,
          error,
        );

        // Don't retry on abort (timeout)
        if (error instanceof Error && error.name === "AbortError") {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`[API] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Failed to fetch tile vessels");
  }

  /**
   * Fetch vessels from multiple tiles in parallel
   */
  async fetchMultipleTiles(
    tiles: TileCoordinates[],
    options: FetchVesselsOptions = {},
  ): Promise<Map<string, VesselData[]>> {
    console.log(`[API] Fetching ${tiles.length} tiles in parallel`);

    const results = new Map<string, VesselData[]>();

    // Fetch all tiles in parallel
    const promises = tiles.map(async (tile) => {
      const tileKey = `${tile.z}/${tile.x}/${tile.y}`;
      try {
        const vessels = await this.fetchTileVessels(tile, options);
        return { tileKey, vessels };
      } catch (error) {
        console.error(`[API] Failed to fetch tile ${tileKey}:`, error);
        return { tileKey, vessels: [] };
      }
    });

    const responses = await Promise.all(promises);

    // Build result map
    responses.forEach(({ tileKey, vessels }) => {
      results.set(tileKey, vessels);
    });

    const totalVessels = Array.from(results.values()).reduce(
      (sum, vessels) => sum + vessels.length,
      0,
    );

    console.log(
      `[API] Fetched ${totalVessels} total vessels from ${tiles.length} tiles`,
    );

    return results;
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health/ready`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === "healthy";
    } catch (error) {
      console.error("[API] Health check failed:", error);
      return false;
    }
  }
}

// Singleton instance
let apiService: APIService | null = null;

/**
 * Initialize API service
 */
export function initAPIService(baseUrl: string): APIService {
  if (apiService) {
    console.warn("[API] Service already initialized");
    return apiService;
  }

  apiService = new APIService(baseUrl);
  return apiService;
}

/**
 * Get API service instance
 */
export function getAPIService(): APIService {
  if (!apiService) {
    throw new Error("API service not initialized");
  }
  return apiService;
}
