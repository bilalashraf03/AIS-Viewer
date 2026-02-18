import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MarkerView } from "@rnmapbox/maps";
import type { VesselMarkerProps } from "../types";
import VesselIcon from "./VesselIcon";

// Helper function to validate heading/course values
const isValidAngle = (angle: number | null | undefined): angle is number => {
  return angle !== null && angle !== undefined && angle >= 0 && angle < 360;
};

// Calculate distance between two coordinates (rough approximation)
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

// Ease-out cubic easing function (same as HTML version)
const easeOutCubic = (progress: number): number => {
  return 1 - Math.pow(1 - progress, 3);
};

export default function VesselMarker({ vessel }: VesselMarkerProps) {
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

  // Use heading if valid (0-359), otherwise use course over ground, default to 0
  // AIS heading 511 means "not available"
  const rotation = isValidAngle(vessel.heading)
    ? vessel.heading
    : isValidAngle(vessel.cog)
      ? vessel.cog
      : 0;

  // Determine color based on speed (like HTML version)
  // Green for moving (SOG > 0.5 knots), red for stationary
  const color = vessel.sog != null && vessel.sog > 0.5 ? "#22c55e" : "#ef4444";

  // Animate position changes using requestAnimationFrame (like HTML version)
  useEffect(() => {
    const newLat = vessel.lat;
    const newLon = vessel.lon;
    const prevLat = prevPositionRef.current.lat;
    const prevLon = prevPositionRef.current.lon;

    // Calculate distance to determine if we should animate
    const distance = calculateDistance(prevLat, prevLon, newLat, newLon);

    // Only animate if:
    // 1. Position actually changed (distance > 0)
    // 2. Distance is reasonable (< 0.01 degrees, roughly 1km)
    //    Larger jumps are likely errors or initial positioning
    if (distance > 0 && distance < 0.01) {
      // Cancel any ongoing animation
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Setup animation state
      const startTime = performance.now();
      animationStateRef.current = {
        startTime,
        startLat: currentPosition.lat,
        startLon: currentPosition.lon,
        targetLat: newLat,
        targetLon: newLon,
        duration: 3000,
      };

      // Animation loop using requestAnimationFrame
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

        // Apply easing function (ease-out cubic)
        const eased = easeOutCubic(progress);

        // Calculate interpolated position
        const deltaLat = targetLat - startLat;
        const deltaLon = targetLon - startLon;
        const lat = startLat + deltaLat * eased;
        const lon = startLon + deltaLon * eased;

        // Update current position
        setCurrentPosition({ lat, lon });

        // Continue animation if not complete
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          animationRef.current = null;
          animationStateRef.current = null;
        }
      };

      // Start animation
      animationRef.current = requestAnimationFrame(animate);
    } else if (distance >= 0.01) {
      // Large jump - no animation, instant update
      setCurrentPosition({ lat: newLat, lon: newLon });

      // Cancel any ongoing animation
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        animationStateRef.current = null;
      }
    }
    // If distance === 0, no change needed

    // Update previous position
    prevPositionRef.current = { lat: newLat, lon: newLon };

    // Cleanup function to stop animation if component unmounts
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
