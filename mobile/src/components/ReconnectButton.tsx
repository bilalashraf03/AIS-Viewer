/**
 * ReconnectButton Component
 *
 * Displays a reconnect button when the WebSocket connection is lost.
 * - Positioned at the bottom center of the screen
 * - Styled with shadow and rounded corners
 * - Calls onReconnect callback when pressed
 */

import React from "react";
import { StyleSheet, TouchableOpacity, Text } from "react-native";
import type { ReconnectButtonProps } from "../types";

export default function ReconnectButton({ onReconnect }: ReconnectButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onReconnect}>
      <Text style={styles.text}>🔄 Reconnect</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
