import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { MIN_ZOOM_FOR_VESSELS } from "../config/env";
import type { InfoPanelProps } from "../types";

export default function InfoPanel({
  isConnected,
  vesselCount,
  lastUpdate,
  currentZoom,
  subscribedTiles,
  isLoading,
}: InfoPanelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            isConnected ? styles.online : styles.offline,
          ]}
        />
        <Text style={styles.statusText}>
          {`Vessels: ${vesselCount}, Tiles: ${subscribedTiles} 🔍 ${currentZoom.toFixed(1)}`}
        </Text>
      </View>
      <Text style={styles.infoText}>Last Update: {lastUpdate}</Text>

      {currentZoom < MIN_ZOOM_FOR_VESSELS && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ Zoom (to {MIN_ZOOM_FOR_VESSELS}) in to load vessels
          </Text>
        </View>
      )}

      {isLoading && currentZoom >= MIN_ZOOM_FOR_VESSELS && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading vessels...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 25,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    opacity: 0.9,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  online: {
    backgroundColor: "#22c55e",
  },
  offline: {
    backgroundColor: "#ef4444",
  },
  statusText: {
    fontSize: 13,
    color: "#333",
  },
  infoText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  infoHint: {
    fontSize: 11,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  warningContainer: {
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  warningText: {
    fontSize: 10,
    color: "#92400e",
    fontWeight: "600",
  },
});
