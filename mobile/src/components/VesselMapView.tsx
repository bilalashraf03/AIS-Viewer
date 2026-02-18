/**
 * VesselMapView Component
 *
 * Main map component that orchestrates:
 * - Service initialization via useMapServices hook
 * - Vessel data management via useVesselData hook
 * - Tile subscription via useTileSubscription hook
 * - Map rendering with vessel markers
 * - UI overlays (InfoPanel, Legend, ReconnectButton)
 */

import React, { useRef } from "react";
import { StyleSheet, View, Alert } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { getWebSocketService } from "../services/websocket";
import { useMapServices } from "../hooks/useMapServices";
import { useVesselData } from "../hooks/useVesselData";
import { useTileSubscription } from "../hooks/useTileSubscription";
import InfoPanel from "./InfoPanel";
import Legend from "./Legend";
import VesselMarker from "./VesselMarker";
import ReconnectButton from "./ReconnectButton";
import type { VesselMapViewProps } from "../types";

export default function VesselMapView({
  mapboxToken,
  apiBaseUrl,
  wsUrl,
  tileZoom,
  initialCenter,
  initialZoom,
  onVesselCountChange,
  onConnectionChange,
  onLastUpdateChange,
}: VesselMapViewProps) {
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Initialize services (Mapbox, API, WebSocket)
  const { isConnected } = useMapServices({
    mapboxToken,
    apiBaseUrl,
    wsUrl,
    tileZoom,
    onConnectionChange,
  });

  // Manage vessel data
  const { vessels, vesselCount, lastUpdate, loadInitialVesselsForTiles } =
    useVesselData({
      onVesselCountChange,
      onLastUpdateChange,
    });

  // Manage tile subscriptions and map interactions
  const {
    subscribedTiles,
    handleRegionDidChange,
    handleRegionWillChange,
    handleMapReady,
    currentZoom,
    isLoading,
  } = useTileSubscription({
    tileZoom,
    initialZoom,
    mapRef,
    loadInitialVesselsForTiles,
  });

  // Handle reconnect button press
  const handleReconnect = () => {
    const wsService = getWebSocketService();
    wsService.connect().catch((error) => {
      Alert.alert("Connection Error", "Failed to reconnect to server", [
        { text: "OK" },
      ]);
    });
  };

  // Render all vessel markers
  const renderVessels = () => {
    return Array.from(vessels.values()).map((vessel) => (
      <VesselMarker key={vessel.id} vessel={vessel} />
    ));
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        onRegionDidChange={handleRegionDidChange}
        onRegionWillChange={handleRegionWillChange}
        onDidFinishLoadingMap={handleMapReady}
        compassEnabled={true}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={initialZoom}
          centerCoordinate={initialCenter}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {renderVessels()}
      </MapboxGL.MapView>

      {/* Info Panel */}
      <InfoPanel
        isConnected={isConnected}
        vesselCount={vesselCount}
        lastUpdate={lastUpdate}
        currentZoom={currentZoom}
        subscribedTiles={subscribedTiles.size}
        isLoading={isLoading}
      />

      {/* Legend */}
      <Legend />

      {/* Reconnect Button (shown when disconnected) */}
      {!isConnected && !isLoading && (
        <ReconnectButton onReconnect={handleReconnect} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  map: {
    flex: 1,
  },
});
