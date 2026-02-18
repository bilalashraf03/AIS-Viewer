/**
 * VesselMarker Component
 *
 * Renders a single vessel marker on the map with:
 * - Color-coded marker (green for moving, red for stationary)
 * - Callout popup with vessel details
 * - MMSI, speed, course, heading, timestamp
 */

import React from "react";
import { StyleSheet, View, Text } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import type { VesselMarkerProps } from "../types";

export default function VesselMarker({ vessel }: VesselMarkerProps) {
  // Determine color based on speed (SOG > 0.5 knots = moving)
  const color = vessel.sog && vessel.sog > 0.5 ? "#22c55e" : "#ef4444";

  return (
    <MapboxGL.PointAnnotation
      key={vessel.id}
      id={vessel.id}
      coordinate={[vessel.lon, vessel.lat]}
    >
      <View style={[styles.marker, { backgroundColor: color }]} />
      <MapboxGL.Callout title={`Vessel ${vessel.mmsi}`}>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>MMSI: {vessel.mmsi}</Text>
          {vessel.sog !== null && (
            <Text style={styles.calloutText}>
              Speed: {vessel.sog.toFixed(1)} kn
            </Text>
          )}
          {vessel.cog !== null && (
            <Text style={styles.calloutText}>
              Course: {vessel.cog.toFixed(1)}°
            </Text>
          )}
          {vessel.heading !== null && (
            <Text style={styles.calloutText}>Heading: {vessel.heading}°</Text>
          )}
          <Text style={styles.calloutText}>
            {new Date(vessel.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </MapboxGL.Callout>
    </MapboxGL.PointAnnotation>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  callout: {
    padding: 10,
    backgroundColor: "white",
    borderRadius: 5,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1a1a2e",
  },
  calloutText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
});
