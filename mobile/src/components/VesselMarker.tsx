import React from "react";
import { StyleSheet, View } from "react-native";
import { MarkerView } from "@rnmapbox/maps";
import type { VesselMarkerProps } from "../types";
import VesselIcon from "./VesselIcon";

// Helper function to validate heading/course values
const isValidAngle = (angle: number | null | undefined): angle is number => {
  return angle !== null && angle !== undefined && angle >= 0 && angle < 360;
};

export default function VesselMarker({ vessel }: VesselMarkerProps) {
  // Use heading if valid (0-359), otherwise use course over ground, default to 0
  // AIS heading 511 means "not available"
  const rotation = isValidAngle(vessel.heading)
    ? vessel.heading
    : isValidAngle(vessel.cog)
      ? vessel.cog
      : 0;

  return (
    <MarkerView
      id={vessel.id}
      coordinate={[vessel.lon, vessel.lat]}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap={true}
    >
      <View
        style={[
          styles.markerContainer,
          {
            transform: [{ rotate: `${rotation}deg` }],
          },
        ]}
      >
        <VesselIcon width={32} height={32} color="#22c55e" />
      </View>
    </MarkerView>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
