#!/bin/bash

# AIS Viewer - Start Script
# Gracefully starts all Docker containers

set -e

# Check for dev/prod mode
MODE="${1:-dev}"
if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ]; then
    echo "Usage: ./start.sh [dev|prod]"
    echo "  dev  - Development mode with hot-reloading (default)"
    echo "  prod - Production mode with optimized build"
    exit 1
fi

# Set compose file based on mode
if [ "$MODE" = "dev" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    MODE_NAME="Development"
else
    COMPOSE_FILE="docker-compose.yml"
    MODE_NAME="Production"
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  AIS Viewer - Starting Services (${MODE_NAME})${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Error: $COMPOSE_FILE not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if .env file exists and AISSTREAM_API_KEY is set
if [ -f ".env" ]; then
    source .env
    if [ -z "$AISSTREAM_API_KEY" ]; then
        echo -e "${YELLOW}⚠️  Warning: AISSTREAM_API_KEY is not set in .env file${NC}"
        echo "The system will start but won't receive vessel data"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "Create a .env file with AISSTREAM_API_KEY to receive vessel data"
    echo ""
fi

# Stop any existing containers
echo -e "${BLUE}🔄 Checking for existing containers...${NC}"
if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}📦 Stopping existing containers...${NC}"
    docker compose -f "$COMPOSE_FILE" down
    echo ""
fi

# Build backend if needed
echo -e "${BLUE}🔨 Building services...${NC}"
docker compose -f "$COMPOSE_FILE" build backend
echo ""

# Start database services first
echo -e "${BLUE}🗄️  Starting database services...${NC}"
docker compose -f "$COMPOSE_FILE" up -d postgres redis
echo ""

# Wait for databases to be healthy
echo -e "${BLUE}⏳ Waiting for databases to be ready...${NC}"
echo -n "   Postgres: "
for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U aisuser -d aisviewer > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Timeout${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done

echo -n "   Redis: "
for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Timeout${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done

echo ""

# Start backend service
echo -e "${BLUE}🚀 Starting backend service...${NC}"
docker compose -f "$COMPOSE_FILE" up -d backend
echo ""

# Wait for backend to be healthy
echo -e "${BLUE}⏳ Waiting for backend to be ready...${NC}"
echo -n "   Backend: "
for i in {1..30}; do
    if curl -s http://localhost:3002/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Backend may still be starting (timeout reached)${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""

# Show status
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ AIS Viewer Started Successfully (${MODE_NAME})!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# Check health endpoint
echo -e "${BLUE}🏥 Health Check:${NC}"
if curl -s http://localhost:3002/health/ready > /dev/null 2>&1; then
    curl -s http://localhost:3002/health/ready | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3002/health/ready
    echo ""
else
    echo -e "${YELLOW}   Health endpoint not yet available${NC}"
fi

echo ""
echo -e "${BLUE}📍 Endpoints:${NC}"
echo "   API:    http://localhost:3002"
echo "   Health: http://localhost:3002/health/ready"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
if [ "$MODE" = "dev" ]; then
    echo "   View logs:      docker logs -f ais-backend-dev"
    echo "   Stop services:  ./stop.sh dev"
    echo "   Restart:        ./stop.sh dev && ./start.sh dev"
    echo "   Switch to prod: ./stop.sh dev && ./start.sh prod"
    echo ""
    echo -e "${YELLOW}🔥 Hot-reload enabled - Edit src/ files and see changes instantly!${NC}"
else
    echo "   View logs:      docker logs -f ais-backend"
    echo "   Stop services:  ./stop.sh"
    echo "   Restart:        ./stop.sh && ./start.sh prod"
    echo "   Switch to dev:  ./stop.sh && ./start.sh dev"
fi
echo ""
echo -e "${GREEN}🎉 Ready to track vessels!${NC}"
