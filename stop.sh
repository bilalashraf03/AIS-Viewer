#!/bin/bash

# AIS Viewer - Stop Script
# Gracefully stops all Docker containers

set -e

# Check for dev/prod mode
MODE="${1:-dev}"
if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ]; then
    echo "Usage: ./stop.sh [dev|prod]"
    echo "  dev  - Stop development containers (default)"
    echo "  prod - Stop production containers"
    exit 1
fi

# Set compose file and container suffix based on mode
if [ "$MODE" = "dev" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    MODE_NAME="Development"
    CONTAINER_SUFFIX="-dev"
else
    COMPOSE_FILE="docker-compose.yml"
    MODE_NAME="Production"
    CONTAINER_SUFFIX=""
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  AIS Viewer - Stopping Services (${MODE_NAME})${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Error: $COMPOSE_FILE not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if any containers are running
if ! docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}ℹ️  No running containers found${NC}"
    exit 0
fi

# Show current status
echo -e "${BLUE}📊 Current Status:${NC}"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# Stop backend first (graceful shutdown)
echo -e "${BLUE}🛑 Stopping backend service...${NC}"
if docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" stop backend
    echo -e "${GREEN}   ✓ Backend stopped${NC}"
else
    echo -e "${YELLOW}   ⚠️  Backend not running${NC}"
fi
echo ""

# Wait a moment for connections to close
sleep 2

# Stop database services
echo -e "${BLUE}🛑 Stopping database services...${NC}"
if docker compose -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" stop postgres
    echo -e "${GREEN}   ✓ PostgreSQL stopped${NC}"
else
    echo -e "${YELLOW}   ⚠️  PostgreSQL not running${NC}"
fi

if docker compose -f "$COMPOSE_FILE" ps -q redis 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" stop redis
    echo -e "${GREEN}   ✓ Redis stopped${NC}"
else
    echo -e "${YELLOW}   ⚠️  Redis not running${NC}"
fi
echo ""

# Remove containers (optional - keeps volumes)
echo -e "${BLUE}🧹 Cleaning up containers...${NC}"
docker compose -f "$COMPOSE_FILE" down
echo ""

# Show final status
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ All Services Stopped Successfully (${MODE_NAME})!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}💾 Data Preservation:${NC}"
if [ "$MODE" = "dev" ]; then
    echo "   • Docker volumes preserved (postgres-data-dev, redis-data-dev, backend-node-modules)"
    echo "   • To remove volumes: docker compose -f $COMPOSE_FILE down -v"
else
    echo "   • Docker volumes preserved (postgres-data, redis-data)"
    echo "   • To remove volumes: docker compose -f $COMPOSE_FILE down -v"
fi
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
if [ "$MODE" = "dev" ]; then
    echo "   Start services:       ./start.sh dev"
    echo "   View logs:            docker compose -f $COMPOSE_FILE logs"
    echo "   Remove all data:      docker compose -f $COMPOSE_FILE down -v"
    echo "   Switch to prod:       ./start.sh prod"
else
    echo "   Start services:       ./start.sh prod"
    echo "   View logs:            docker compose -f $COMPOSE_FILE logs"
    echo "   Remove all data:      docker compose -f $COMPOSE_FILE down -v"
    echo "   Switch to dev:        ./start.sh dev"
fi
echo ""
