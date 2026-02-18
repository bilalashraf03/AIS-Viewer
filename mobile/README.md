# AIS Viewer Mobile App

A React Native mobile application for real-time vessel tracking using AIS (Automatic Identification System) data. Built with Expo and Mapbox GL, this app provides an interactive map interface for visualizing vessel movements in real-time.

## ✨ Features

- **Interactive Map**: Mapbox-powered map with smooth pan, zoom, and rotation
- **Real-time Vessel Tracking**: WebSocket connection for live vessel position updates
- **Tile-based Loading**: Efficient viewport-based vessel loading using Slippy Map tiles
- **Dynamic Subscriptions**: Automatically subscribes to visible map tiles
- **Performance Optimized**: Handles thousands of vessels with efficient rendering
- **Connection Status**: Visual indicators for WebSocket connectivity
- **Vessel Markers**: Color-coded markers showing vessel heading/course
- **Info Panel**: Real-time stats (vessel count, zoom level, subscribed tiles)
- **Auto-reconnect**: Automatic reconnection on network issues
- **Cross-platform**: Single codebase for iOS and Android

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**: Package manager
- **Expo CLI**: Will be installed with dependencies
- **Mapbox Access Token**: Get one at [mapbox.com](https://mapbox.com)
- **Backend Server**: The AIS Viewer backend must be running (see [main README](../README.md))
- **iOS Development** (optional):
  - macOS
  - Xcode 14+
  - iOS Simulator or physical device
- **Android Development** (optional):
  - Android Studio
  - Android SDK
  - Android Emulator or physical device

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Environment

Create a `.env` file in the `mobile` directory:

```bash
# Mapbox Configuration
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# Backend API Configuration (adjust for your setup)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3002
EXPO_PUBLIC_WS_URL=ws://localhost:3002/ws

# Map Configuration
EXPO_PUBLIC_TILE_ZOOM=12
EXPO_PUBLIC_MAP_CENTER_LON=114.1095
EXPO_PUBLIC_MAP_CENTER_LAT=22.3964
EXPO_PUBLIC_MAP_INITIAL_ZOOM=10
```

#### Configuration for Physical Devices

If running on a physical device, replace `localhost` with your computer's IP address:

```bash
# Find your IP address
# macOS/Linux: ifconfig | grep "inet "
# Windows: ipconfig

# Example configuration for physical device
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3002
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:3002/ws
```

### 3. Start the App

```bash
# Start Expo development server
npm start
```

This will open the Expo DevTools in your browser.

### 4. Run on Device/Simulator

From the Expo DevTools, you can:

- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app (iOS/Android)
- Press `w` to open in web browser (limited functionality)

## 📱 Development Options

### Option 1: Expo Go (Easiest)

1. Install Expo Go on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Start the development server:
   ```bash
   npm start
   ```

3. Scan the QR code with:
   - iOS: Camera app
   - Android: Expo Go app

**Note**: Ensure your phone and computer are on the same network.

### Option 2: Development Build (Recommended for Production)

```bash
# iOS
npm run ios

# Android
npm run android
```

This creates a development build with full native capabilities.

### Option 3: Web (Limited)

```bash
npx expo start --web
```

**Note**: Mapbox features may be limited in web mode.

## 🏗️ Project Structure

```
mobile/
├── src/
│   ├── components/          # React components
│   │   ├── VesselMapView.tsx      # Main map component
│   │   ├── VesselMarker.tsx       # Individual vessel marker
│   │   ├── VesselIcon.tsx         # Vessel SVG icon
│   │   ├── InfoPanel.tsx          # Status information panel
│   │   └── ReconnectButton.tsx    # Manual reconnect button
│   ├── hooks/               # Custom React hooks
│   │   ├── useMapServices.ts      # Service initialization
│   │   ├── useVesselData.ts       # Vessel state management
│   │   └── useTileSubscription.ts # Tile subscription logic
│   ├── services/            # Business logic
│   │   ├── api.ts                 # REST API client
│   │   ├── mapbox.ts              # Mapbox initialization
│   │   └── websocket.ts           # WebSocket client
│   ├── utils/               # Helper functions
│   │   └── tiles.ts               # Tile coordinate calculations
│   ├── config/              # Configuration
│   │   └── env.ts                 # Environment variables
│   └── types.d.ts           # TypeScript type definitions
├── App.tsx                  # Application entry point
├── app.json                 # Expo configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
└── .env                     # Environment variables (create this)
```

## 🔧 Architecture

### Component Hierarchy

```
App
└── VesselMapView (Main Container)
    ├── MapView (Mapbox)
    │   ├── Camera
    │   └── VesselMarker[] (Many)
    │       └── VesselIcon
    ├── InfoPanel
    └── ReconnectButton (conditional)
```

### Data Flow

```
┌─────────────────────────────────────────────┐
│         VesselMapView Component              │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │   useMapServices Hook                   │ │
│  │   - Initialize Mapbox                   │ │
│  │   - Initialize API Service              │ │
│  │   - Initialize WebSocket                │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │   useVesselData Hook                    │ │
│  │   - Manage vessel state (Map)           │ │
│  │   - Handle vessel updates               │ │
│  │   - Track vessel count                  │ │
│  └────────────────────────────────────────┘ │
│                    ▲                         │
│                    │ vessel_update           │
│  ┌────────────────┴──────────────────────┐ │
│  │   useTileSubscription Hook             │ │
│  │   - Track map viewport                 │ │
│  │   - Calculate visible tiles            │ │
│  │   - Subscribe/unsubscribe to tiles     │ │
│  └────────────────────────────────────────┘ │
│                                              │
└──────────────────┬───────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   WebSocket Service │
        │   - Connection mgmt │
        │   - Message handling│
        │   - Auto-reconnect  │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │   Backend Server    │
        │   ws://host:3002/ws │
        └─────────────────────┘
```

### Custom Hooks

#### useMapServices
Initializes and manages all services (Mapbox, API, WebSocket):
- Sets Mapbox access token
- Configures API base URL
- Establishes WebSocket connection
- Monitors connection status

#### useVesselData
Manages vessel state and updates:
- Stores vessels in a Map (keyed by MMSI)
- Handles WebSocket vessel updates
- Tracks vessel count and last update time
- Provides cleanup functions

#### useTileSubscription
Handles tile-based subscriptions:
- Calculates visible tiles from viewport
- Subscribes to tiles via WebSocket
- Unsubscribes from out-of-view tiles
- Manages zoom level changes

## 🎨 Key Features Explained

### Tile-Based Loading

The app uses Slippy Map tiles (zoom 12) to efficiently load vessels:

```
1. User pans/zooms map
2. useTileSubscription calculates visible tiles
3. New tiles → Subscribe via WebSocket
4. Old tiles (out of view) → Unsubscribe
5. Server pushes vessel updates for subscribed tiles
6. useVesselData updates vessel state
7. VesselMarker components re-render
```

### Vessel Rendering

Vessels are only rendered when zoom ≥ 12 (MIN_ZOOM_FOR_VESSELS):
- Below zoom 12: No vessels shown (performance optimization)
- At/above zoom 12: Vessels rendered with position and heading

### WebSocket Protocol

**Client → Server:**
```json
{
  "type": "subscribe",
  "tiles": ["12/3413/1789", "12/3414/1789"]
}
```

**Server → Client:**
```json
{
  "type": "vessel_update",
  "tile": "12/3413/1789",
  "vessels": [
    {
      "mmsi": 123456789,
      "lat": 22.3964,
      "lon": 114.1095,
      "cog": 45.5,
      "sog": 12.3,
      "heading": 50,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## 🔌 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox API token | `pk.eyJ1...` |
| `EXPO_PUBLIC_API_BASE_URL` | Backend REST API URL | `http://192.168.1.100:3002` |
| `EXPO_PUBLIC_WS_URL` | WebSocket server URL | `ws://192.168.1.100:3002/ws` |
| `EXPO_PUBLIC_TILE_ZOOM` | Tile zoom level | `12` |
| `EXPO_PUBLIC_MAP_CENTER_LON` | Initial map longitude | `114.1095` |
| `EXPO_PUBLIC_MAP_CENTER_LAT` | Initial map latitude | `22.3964` |
| `EXPO_PUBLIC_MAP_INITIAL_ZOOM` | Initial zoom level | `10` |

## 🛠️ Development Commands

```bash
# Start development server
npm start

# Start with cache cleared
npm start -- --clear

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Type checking
npx tsc --noEmit

# Format code (if prettier is configured)
npx prettier --write "src/**/*.{ts,tsx}"
```

## 🧪 Testing

```bash
# Install testing dependencies (if not already installed)
npm install --save-dev @testing-library/react-native jest

# Run tests (if configured)
npm test
```

## 📦 Building for Production

### iOS

```bash
# Build for iOS
eas build --platform ios

# Or local build
npx expo run:ios --configuration Release
```

### Android

```bash
# Build for Android
eas build --platform android

# Or local build
npx expo run:android --variant release
```

## 🐛 Troubleshooting

### MapView TypeScript Errors

If you see TypeScript errors about `MapView` not being a valid JSX component:

1. Ensure `tsconfig.json` has `skipLibCheck: true`
2. Restart TypeScript server in your IDE
3. Clear cache: `npm start -- --clear`

### Cannot Connect to Backend

- **Using Simulator**: Use `http://localhost:3002`
- **Using Physical Device**: Use your computer's IP (e.g., `http://192.168.1.100:3002`)
- Verify backend is running: `curl http://localhost:3002/health`
- Check firewall settings
- Ensure both devices are on same network

### No Vessels Appearing

1. Check zoom level (must be ≥ 12)
2. Verify WebSocket connection (green indicator in InfoPanel)
3. Check console for errors
4. Verify backend has vessel data
5. Try reconnecting (tap Reconnect button)

### Mapbox Not Loading

1. Verify `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is set correctly
2. Check Mapbox token is valid and not expired
3. Ensure token has appropriate scopes
4. Check network connectivity

### Performance Issues

1. Reduce `EXPO_PUBLIC_MAP_INITIAL_ZOOM` (show fewer vessels initially)
2. Ensure you're running a development build (not Expo Go for production)
3. Test on physical device (simulators can be slower)
4. Check vessel count in InfoPanel (too many vessels?)

### WebSocket Disconnects Frequently

1. Check network stability
2. Verify backend server is healthy
3. Check backend logs for errors
4. Try increasing WebSocket timeout settings

## 🎨 Customization

### Change Map Style

In `VesselMapView.tsx`:

```typescript
import { StyleURL } from "@rnmapbox/maps";

<MapView
  styleURL={StyleURL.Dark}  // or StyleURL.Light, StyleURL.Outdoors, etc.
  // ...
/>
```

### Change Vessel Icon

Edit `VesselIcon.tsx` to customize the vessel marker appearance:
- Change color
- Modify size
- Update SVG path

### Adjust Tile Zoom Level

In `.env`:
```bash
EXPO_PUBLIC_TILE_ZOOM=11  # Larger tiles (fewer vessels per tile)
# or
EXPO_PUBLIC_TILE_ZOOM=13  # Smaller tiles (more granular)
```

**Note**: Must match backend `TILE_ZOOM` setting.

## 📚 Technology Stack

- **Framework**: React Native (via Expo)
- **Language**: TypeScript
- **Map Rendering**: @rnmapbox/maps
- **HTTP Client**: Fetch API
- **WebSocket**: Native WebSocket
- **State Management**: React Hooks (useState, useEffect, useRef)
- **Build Tool**: Expo CLI

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use functional components with hooks
3. Keep components small and focused
4. Add types for all props and functions
5. Test on both iOS and Android
6. Update documentation for changes

## 📄 License

This project is licensed under the MIT License.

## 🔗 Related Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [@rnmapbox/maps Documentation](https://rnmapbox.github.io/maps/)
- [Slippy Map Tilenames](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
- [Main Project README](../README.md)

## 📞 Support

For issues:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review console logs in Expo DevTools
3. Check backend connectivity
4. Open an issue on GitHub

---

**Happy Vessel Tracking! 🚢📱**
