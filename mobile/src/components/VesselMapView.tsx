import React, { useRef, useCallback } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { MapView, Camera, StyleURL } from "@rnmapbox/maps";
import { getWebSocketService } from "../services/websocket";
import { MIN_ZOOM_FOR_VESSELS } from "../config/env";
import { useMapServices } from "../hooks/useMapServices";
import { useVesselData } from "../hooks/useVesselData";
import { useTileSubscription } from "../hooks/useTileSubscription";
import InfoPanel from "./InfoPanel";
import ReconnectButton from "./ReconnectButton";
import VesselMarker from "./VesselMarker";
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
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);

  // Initialize services (Mapbox, API, WebSocket)
  const { isConnected } = useMapServices({
    mapboxToken,
    apiBaseUrl,
    wsUrl,
    tileZoom,
    onConnectionChange,
  });

  // Manage vessel data
  const {
    vessels,
    vesselCount,
    lastUpdate,
    removeVesselsFromTiles,
    clearAllVessels,
  } = useVesselData({
    onVesselCountChange,
    onLastUpdateChange,
  });

  // Manage tile subscriptions and map interactions
  const {
    subscribedTiles,
    handleRegionDidChange,
    handleCameraChanged,
    handleMapReady,
    currentZoom,
    isLoading,
  } = useTileSubscription({
    tileZoom,
    initialZoom,
    mapRef,
    removeVesselsFromTiles,
    clearAllVessels,
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

  // Render vessel markers
  const renderVessels = () => {
    // Don't render vessels if zoom level is below MIN_ZOOM_FOR_VESSELS
    if (currentZoom < MIN_ZOOM_FOR_VESSELS) {
      return null;
    }

    const vesselArray = Array.from(vessels.values());
    const validVessels = vesselArray.filter((v) => v && v.lat && v.lon);

    return validVessels.map((vessel) => (
      <VesselMarker key={vessel.id} vessel={vessel} />
    ));
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL={StyleURL.Dark}
        onRegionDidChange={handleRegionDidChange}
        onDidFinishLoadingMap={handleMapReady}
        onMapLoadingError={() => {
          console.error("[VesselMapView] ❌ Map failed to load");
        }}
        onCameraChanged={handleCameraChanged}
        compassEnabled={true}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={initialZoom}
          centerCoordinate={initialCenter}
          animationDuration={0}
        />

        {/* Render individual vessel markers */}
        {renderVessels()}
      </MapView>

      {/* Info Panel */}
      <InfoPanel
        isConnected={isConnected}
        vesselCount={vesselCount}
        lastUpdate={lastUpdate}
        currentZoom={currentZoom}
        subscribedTiles={subscribedTiles.size}
        isLoading={isLoading}
      />

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
