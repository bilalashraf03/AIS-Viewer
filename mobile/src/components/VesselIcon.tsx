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
  return (
    <View style={[styles.container, { width, height }]}>
      {/* Arrow body */}
      <View
        style={[
          styles.arrowBody,
          { backgroundColor: color, height: height * 0.625, width: 3 },
        ]}
      />
      {/* Arrow head */}
      <View style={[styles.arrowHead, { borderBottomColor: color }]} />
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
    shadowRadius: 2,
    elevation: 3,
  },
  arrowBody: {
    borderRadius: 1.5,
    marginTop: 6,
  },
  arrowHead: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    position: "absolute",
    top: 0,
  },
});
