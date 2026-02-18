import React from "react";
import { View, StyleSheet } from "react-native";

interface VesselIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function VesselIcon({
  width = 24,
  height = 24,
  color = "#22c55e",
}: VesselIconProps) {
  // Calculate proportional sizes based on 24x24 reference
  const scale = width / 24;
  const bodyWidth = 6 * scale; // Wider for better visibility
  const bodyHeight = 15 * scale; // From y=3 to y=18
  const arrowHeadSize = 3 * scale; // Arrow head width (left/right)
  const arrowHeadHeight = 6 * scale; // Arrow head height for visibility

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Arrow head (triangle) */}
      <View
        style={[
          styles.arrowHead,
          {
            borderLeftWidth: arrowHeadSize,
            borderRightWidth: arrowHeadSize,
            borderBottomWidth: arrowHeadHeight,
            borderBottomColor: color,
            top: 3 * scale,
          },
        ]}
      />

      {/* Arrow body (vertical line) */}
      <View
        style={[
          styles.arrowBody,
          {
            width: bodyWidth,
            height: bodyHeight,
            backgroundColor: color,
            top: (1 + arrowHeadHeight) * scale,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  arrowBody: {
    position: "absolute",
    borderRadius: 1.5,
  },
  arrowHead: {
    position: "absolute",
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
