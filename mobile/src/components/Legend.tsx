/**
 * Legend Component
 *
 * Displays the map legend showing vessel status indicators:
 * - Green dot: Moving vessels (SOG > 0.5 knots)
 * - Red dot: Stationary vessels
 */

import React from "react";
import { StyleSheet, View, Text } from "react-native";
import type { LegendProps } from "../types";

export default function Legend({}: LegendProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Legend</Text>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: "#22c55e" }]} />
        <Text style={styles.text}>Moving (SOG &gt; 0.5 kn)</Text>
      </View>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
        <Text style={styles.text}>Stationary</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 40,
    left: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    color: "#666",
  },
});
