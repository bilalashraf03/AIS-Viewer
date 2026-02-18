/**
 * InfoPanel Component
 *
 * Displays real-time information about the vessel tracking system:
 * - Connection status
 * - Vessel count
 * - Last update timestamp
 * - Current zoom level
 * - Number of subscribed tiles
 * - Loading indicator
 */

import React from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
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
      <Text style={styles.title}>🚢 AIS Viewer</Text>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            isConnected ? styles.online : styles.offline,
          ]}
        />
        <Text style={styles.statusText}>
          {isConnected ? "Connected" : "Disconnected"}
        </Text>
      </View>

      <Text style={styles.infoText}>Vessels: {vesselCount}</Text>
      <Text style={styles.infoText}>Last Update: {lastUpdate}</Text>
      <Text style={styles.infoText}>Zoom: {currentZoom.toFixed(1)}</Text>
      <Text style={styles.infoTextSmall}>Tiles: {subscribedTiles}</Text>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading vessels...</Text>
        </View>
      )}

      <Text style={styles.infoHint}>💡 Real-time updates via WebSocket</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 15,
    borderRadius: 10,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 10,
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
  infoTextSmall: {
    fontSize: 11,
    color: "#999",
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
});
