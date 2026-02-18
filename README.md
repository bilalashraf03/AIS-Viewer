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

The following diagram shows the complete data flow from AISStream.io to the mobile client, with typical latency measurements for each stage:

```
[AISStream Provider]
        |
        |  (1) Network delivery -> Backend (variable; e.g. 10-200 ms)
        v
[AISStreamClient (ws)]
  - handleMessage()
  - parsePositionReport()  <-- tile calc (latLonToTileKey)
        |
        |  (2) Parse + tile calc: ~<1 ms
        v
  updateVesselPosition()
  - redis.evalsha(UPDATE_VESSEL_SCRIPT)
        |
        |  (3) Redis write (atomic Lua): ~1-5 ms
        v
  mark dirty tiles in local set
  (dirtyTiles maintained per AISStreamClient)
        |
        |  (4) AISStreamClient batching interval:
        |      configured = 1000 ms => avg wait ~500 ms
        v
  emit("dirtyTiles", tiles) ---------------------------
        |                                              |
        v                                              |
[WebSocket Server] <-----------------------------------/
  - receives vesselUpdate events (also listens to dirtyTiles)
  - dirtyTiles.add(tile)
  - flushDirtyTiles() runs periodically (500 ms)
        |
        |  (5) WS flush interval: configured = 500 ms
        |      avg wait ~250 ms
        v
  For each dirty tile:
    - redis.smembers(cur:tile:{tile})         (~1-5 ms)
    - pipeline.hgetall for each mmsi          (~1-N*ms, depends on vessels)
        |
        |  (6) Redis reads + pipeline: ~2-20+ ms (tile size dependent)
        v
  send JSON over WebSocket to subscribed clients
        |
        |  (7) WS send -> client network: ~5-100+ ms (client dependent)
        v
[Client receives vessel_update]
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

### Project Structure

```
server/
├── src/
│   ├── config/          # Configuration management
│   ├── routes/          # Express routes
│   ├── services/        # Core business logic
│   │   ├── aisstream-client.ts    # AISStream WebSocket client
│   │   ├── batch-sync.ts          # Redis → PostgreSQL sync
│   │   ├── postgres.ts            # Database operations
│   │   ├── redis.ts               # Cache operations
│   │   └── websocket-server.ts   # Client WebSocket server
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Helper functions
│   └── index.ts         # Application entry point
├── Dockerfile           # Production Docker image
├── Dockerfile.dev       # Development Docker image
└── package.json
```

### Key Services

#### AISStream Client
Connects to AISStream.io and receives real-time vessel positions:
- Filters vessels by bounding box (optional)
- Calculates tile coordinates (zoom 12)
- Updates Redis cache with vessel data

#### Batch Sync Service
Periodically syncs Redis cache to PostgreSQL:
- Runs every 5 seconds (configurable)
- Bulk inserts/updates for efficiency
- Uses PostGIS for spatial indexing

#### WebSocket Server
Pushes real-time updates to connected clients:
- Tile-based subscriptions
- Client connection management
- Automatic cleanup on disconnect

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

The backend exposes health check endpoints for monitoring:

#### GET /
Root endpoint with API information

#### GET /health
Basic health check

#### GET /health/ready
Comprehensive readiness check (includes database connectivity)

#### GET /health/live
Liveness probe for container orchestration

**Note**: The system uses WebSocket exclusively for real-time vessel data delivery. There are no REST endpoints for vessel data retrieval.

### Docker Commands

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

### Local Development (Without Docker)

```bash
cd server

# Install dependencies
npm install

# Create .env file with required variables
cp .env.example .env

# Start PostgreSQL and Redis (or use Docker for just these)
docker compose up -d postgres redis

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📊 Database Schema

### vessels_current Table

| Column | Type | Description |
|--------|------|-------------|
| mmsi | BIGINT | Vessel identifier (Primary Key) |
| geom | geometry(Point, 4326) | PostGIS point geometry |
| tile_z12 | INT | Tile coordinate at zoom 12 |
| lon | DOUBLE PRECISION | Longitude |
| lat | DOUBLE PRECISION | Latitude |
| cog | DOUBLE PRECISION | Course over ground |
| sog | DOUBLE PRECISION | Speed over ground |
| heading | INT | Vessel heading (0-359) |
| updated_at | TIMESTAMPTZ | Last update timestamp |
| created_at | TIMESTAMPTZ | First seen timestamp |

**Indexes:**
- `idx_vessels_current_tile_fresh`: Composite index on (tile_z12, updated_at)
- `idx_vessels_current_geom`: GIST spatial index on geometry

## 🔧 Troubleshooting

### Backend won't start
- Ensure Docker is running
- Check if ports 5432, 6379, 3002 are available
- Verify AISSTREAM_API_KEY is set in .env

### No vessel data appearing
- Verify AISStream.io API key is valid
- Check backend logs: `docker logs -f ais-backend-dev`
- Ensure vessels are in your bounding box (if set)

### Database connection issues
- Check PostgreSQL is healthy: `docker ps`
- Verify credentials in docker-compose.yml match config
- Check logs: `docker logs ais-postgres`

### Redis connection issues
- Verify Redis is running: `docker ps`
- Check Redis logs: `docker logs ais-redis`
- Test connection: `docker exec -it ais-redis redis-cli ping`

## 📝 Scripts

- `./start.sh [dev|prod]` - Start all services
- `./stop.sh [dev|prod]` - Stop all services

## 🧪 Testing

```bash
cd server

# Run all tests
npm test

# Test AISStream connection
npm run test:aisstream

# Test batch sync parameters
npm run test:batch-params
```

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
