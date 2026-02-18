import React from "react";
import { StyleSheet, StatusBar, SafeAreaView } from "react-native";
import VesselMapView from "./src/components/VesselMapView";
import { config } from "./src/config/env";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <VesselMapView
        mapboxToken={config.mapbox.accessToken}
        apiBaseUrl={config.api.baseUrl}
        wsUrl={config.api.wsUrl}
        tileZoom={config.map.tileZoom}
        initialCenter={[config.map.center.lon, config.map.center.lat]}
        initialZoom={config.map.initialZoom}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
