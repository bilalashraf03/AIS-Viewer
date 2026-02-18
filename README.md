# AIS Viewer

A real-time vessel tracking system using AIS (Automatic Identification System) data. This project consists of a Node.js backend that streams live vessel positions from AISStream.io and a React Native mobile application for visualizing vessels on an interactive map.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Features

### Backend
- **Real-time AIS Data Streaming**: Connects to AISStream.io WebSocket for live vessel updates
- **Tile-based Architecture**: Uses Slippy Map tiles (zoom level 12) for efficient spatial queries
- **Redis Caching**: In-memory caching for fast vessel lookups
- **PostgreSQL + PostGIS**: Persistent storage with spatial indexing
- **Batch Processing**: Efficient bulk updates every 5 seconds
- **WebSocket Server**: Real-time push notifications to connected clients
- **Health Monitoring**: Comprehensive health checks for all services
- **Docker Support**: Fully containerized with Docker Compose

### Mobile App
- **Interactive Map**: Mapbox-powered map with vessel markers
- **Real-time Updates**: WebSocket connection for live vessel movements
- **Tile Subscriptions**: Dynamic loading of vessels based on map viewport
- **Performance Optimized**: Efficient rendering of thousands of vessels
- **Connection Status**: Visual indicators for connectivity
- **Cross-platform**: Works on iOS and Android via React Native/Expo

👉 **See [Mobile README](./mobile/README.md) for detailed setup and documentation**

## 📋 Prerequisites

- **Docker & Docker Compose**: For running backend services
- **Node.js**: v18.0.0 or higher (for local development)
- **AISStream.io API Key**: Get one at [aisstream.io](https://aisstream.io)
- **Mapbox Access Token**: Get one at [mapbox.com](https://mapbox.com)

## 🏗️ Architecture

```
┌─────────────────┐
│  AISStream.io   │  (WebSocket)
└────────┬────────┘
         │ Live AIS Data
         ▼
┌─────────────────────────────────────────────┐
│              Backend Server                  │
│  ┌──────────────────────────────────────┐  │
│  │   AISStream Client (WebSocket)       │  │
│  └──────────┬───────────────────────────┘  │
│             │                                │
│  ┌──────────▼──────────┐  ┌──────────────┐ │
│  │  Redis Cache        │  │  PostgreSQL   │ │
│  │  (In-memory KV)     │  │  + PostGIS    │ │
│  └──────────┬──────────┘  └──────┬───────┘ │
│             │                     │          │
│  ┌──────────▼─────────────────────▼───────┐ │
│  │      Batch Sync Service (5s)           │ │
│  └──────────┬─────────────────────────────┘ │
│             │                                │
│  ┌──────────▼─────────────────────────────┐ │
│  │        WebSocket Server                │ │
│  │        (Express + ws)                  │ │
│  └──────────┬─────────────────────────────┘ │
└─────────────┼───────────────────────────────┘
              │ WebSocket
              ▼
┌─────────────────────────────┐
│   Mobile App (React Native)  │
│  - Mapbox GL JS              │
│  - WebSocket Client          │
│  - Tile-based Loading        │
└─────────────────────────────┘
```

## 🔄 End-to-End Data Flow

```
[AISStream.io] 
    ↓ (1) Network delivery (10-200ms)
[AISStream Client]
    ↓ (2) Parse + tile calc (<1ms)
    ↓ (3) Redis write (1-5ms)
    ↓ (4) Batching wait (~500ms avg)
[WebSocket Server]
    ↓ (5) Flush interval (~250ms avg)
    ↓ (6) Redis read pipeline (2-20ms)
    ↓ (7) Send to client (5-100ms)
[Mobile Client]
```
**Typical End-to-End Latency**: ~770ms - 1.4s from AISStream to client display

**Latency Breakdown:**
- **Step 1**: Network from AISStream (10-200 ms) - variable based on internet
- **Step 2**: Parse and tile calculation (<1 ms) - negligible CPU time
- **Step 3**: Redis atomic write (1-5 ms) - fast in-memory operation
- **Step 4**: AISStream batching wait (~500 ms avg) - configurable interval
- **Step 5**: WebSocket flush interval (~250 ms avg) - configurable interval
- **Step 6**: Redis read pipeline (2-20+ ms) - depends on vessels per tile
- **Step 7**: Client network delivery (5-100+ ms) - variable based on client connection

**Performance Notes:**
- Most latency comes from batching intervals (Steps 4 & 5), which are tuned for efficiency
- Redis operations (Steps 3 & 6) are extremely fast due to in-memory storage
- Network latency (Steps 1 & 7) varies based on connection quality
- Total latency is well within acceptable limits for real-time vessel tracking

## 🚦 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/bilalashraf03/AIS-Viewer.git
cd AIS-Viewer
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# AISStream.io Configuration
AISSTREAM_API_KEY=your_aisstream_api_key_here

# Optional: Bounding box for filtering vessels (format: [[lat1,lon1],[lat2,lon2]])
# Default: Hong Kong area
AISSTREAM_BBOX=[[22.15,113.83],[22.58,114.41]]
```

### 3. Start Backend Services

```bash
# Start in development mode (with hot-reload)
./start.sh dev

# Or start in production mode
./start.sh prod
```

This will start:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Backend API (port 3002)
- WebSocket server (port 3002/ws)

### 4. Verify Backend is Running

```bash
# Check health
curl http://localhost:3002/health/ready

# Check root endpoint
curl http://localhost:3002
```

### 5. Setup Mobile App

See the [Mobile README](./mobile/README.md) for detailed setup instructions.

## 🛠️ Backend Development

### Key Components

- **AISStream Client**: Receives live vessel positions, calculates tile coordinates, updates Redis
- **Batch Sync Service**: Syncs Redis → PostgreSQL every 5 seconds with bulk operations
- **WebSocket Server**: Manages client connections and tile-based subscriptions

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AISSTREAM_API_KEY` | AISStream.io API key | Required |
| `AISSTREAM_BBOX` | Geographic bounding box filter | Optional |
| `PORT` | HTTP server port | 3000 |
| `WS_PORT` | WebSocket server port | 3001 |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `POSTGRES_URL` | PostgreSQL connection URL | postgresql://... |
| `TILE_ZOOM` | Tile zoom level | 12 |
| `VESSEL_TTL_SECONDS` | Vessel TTL in Redis | 120 |
| `BATCH_SYNC_INTERVAL_MS` | Batch sync interval | 5000 |
| `BATCH_SYNC_SIZE` | Max vessels per batch | 1000 |
| `LOG_LEVEL` | Logging level | info |

### Health Check Endpoints

- `GET /` - Root endpoint with API info
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes database connectivity)
- `GET /health/live` - Liveness probe for orchestration

**Note**: Vessel data is delivered exclusively via WebSocket. No REST endpoints for vessel retrieval.

### Useful Commands

```bash
# View logs
docker logs -f ais-backend-dev     # Development
docker logs -f ais-backend          # Production

# Stop services
./stop.sh dev                       # Development
./stop.sh                           # Production

# Restart services
./stop.sh && ./start.sh prod

# Access database
docker exec -it ais-postgres psql -U aisuser -d aisviewer

# Access Redis
docker exec -it ais-redis redis-cli
```

## 🔧 Troubleshooting

- **Backend won't start**: Ensure Docker is running, ports 5432/6379/3002 are available, AISSTREAM_API_KEY is set
- **No vessel data**: Verify AISStream.io API key is valid, check backend logs: `docker logs -f ais-backend-dev`
- **Connection issues**: Check service health with `docker ps`, view logs with `docker logs <container-name>`

## 📦 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15 + PostGIS 3.3
- **Cache**: Redis 7
- **WebSocket**: ws library
- **Logging**: Pino
- **Container**: Docker + Docker Compose

### Mobile
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Mapping**: @rnmapbox/maps
- **State Management**: React Hooks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [AISStream.io](https://aisstream.io) - Real-time AIS data provider
- [Mapbox](https://mapbox.com) - Map rendering service
- [PostGIS](https://postgis.net) - Spatial database extension
- [Slippy Map Tiles](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames) - Tile system documentation

## 📞 Support

For issues and questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review backend logs: `docker logs -f ais-backend-dev`
3. Open an issue on GitHub

---

**Happy Vessel Tracking! 🚢⚓**
