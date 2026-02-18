import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MarkerView } from "@rnmapbox/maps";
import type { VesselMarkerProps } from "../types";
import VesselIcon from "./VesselIcon";

// Helper function to validate heading/course values
const isValidAngle = (angle: number | null | undefined): angle is number => {
  return angle !== null && angle !== undefined && angle >= 0 && angle < 360;
};

// Calculate distance between two coordinates in degrees
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  return Math.sqrt(dLat * dLat + dLon * dLon);
};

// Ease-out cubic easing (1 - (1 - x)³)
const easeOutCubic = (progress: number): number => {
  return 1 - Math.pow(1 - progress, 3);
};

export default function VesselMarker({
  vessel,
  mapBearing,
}: VesselMarkerProps) {
  // Store current interpolated position
  const [currentPosition, setCurrentPosition] = useState({
    lat: vessel.lat,
    lon: vessel.lon,
  });

  // Store previous position and animation state
  const prevPositionRef = useRef<{ lat: number; lon: number }>({
    lat: vessel.lat,
    lon: vessel.lon,
  });
  const animationRef = useRef<number | null>(null);
  const animationStateRef = useRef<{
    startTime: number;
    startLat: number;
    startLon: number;
    targetLat: number;
    targetLon: number;
    duration: number;
  } | null>(null);

  // Determine vessel heading: prefer heading, fallback to COG (AIS heading 511 = not available)
  const vesselHeading = isValidAngle(vessel.heading)
    ? vessel.heading
    : isValidAngle(vessel.cog)
      ? vessel.cog
      : 0;

  // Counter-rotate to maintain absolute heading when map rotates
  const rotation = vesselHeading - (mapBearing || 0);

  // Color: green if moving (SOG > 0.5 knots), red if stationary
  const color = vessel.sog != null && vessel.sog > 0.5 ? "#22c55e" : "#ef4444";

  // Animate position changes using requestAnimationFrame (like HTML version)
  useEffect(() => {
    const newLat = vessel.lat;
    const newLon = vessel.lon;
    const prevLat = prevPositionRef.current.lat;
    const prevLon = prevPositionRef.current.lon;

    const distance = calculateDistance(prevLat, prevLon, newLat, newLon);

    // Animate smooth movements (< 0.01 degrees ≈ 1km), skip large jumps (likely errors)
    if (distance > 0 && distance < 0.01) {
      // Cancel ongoing animation if any
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }

      const startTime = performance.now();
      animationStateRef.current = {
        startTime,
        startLat: currentPosition.lat,
        startLon: currentPosition.lon,
        targetLat: newLat,
        targetLon: newLon,
        duration: 3000,
      };

      // Animation loop
      const animate = (currentTime: number) => {
        if (!animationStateRef.current) return;

        const {
          startTime,
          startLat,
          startLon,
          targetLat,
          targetLon,
          duration,
        } = animationStateRef.current;

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        const deltaLat = targetLat - startLat;
        const deltaLon = targetLon - startLon;
        setCurrentPosition({
          lat: startLat + deltaLat * eased,
          lon: startLon + deltaLon * eased,
        });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          animationRef.current = null;
          animationStateRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    } else if (distance >= 0.01) {
      // Large jump - instant update, no animation
      setCurrentPosition({ lat: newLat, lon: newLon });
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        animationStateRef.current = null;
      }
    }

    prevPositionRef.current = { lat: newLat, lon: newLon };

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [vessel.lat, vessel.lon]);

  return (
    <MarkerView
      id={vessel.id}
      coordinate={[currentPosition.lon, currentPosition.lat]}
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
        <VesselIcon width={32} height={32} color={color} />
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
