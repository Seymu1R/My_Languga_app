#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping Language Learning App...${NC}"

MONGO_PORT=27018

# Stop MongoDB
MONGO_PID=$(pgrep -f "mongod.*$MONGO_PORT")

if [ ! -z "$MONGO_PID" ]; then
    echo -e "${YELLOW}🍃 Stopping MongoDB (PID: $MONGO_PID)...${NC}"
    mongosh --port $MONGO_PORT --eval "db.adminCommand({ shutdown: 1 })" 2>/dev/null
    
    # Wait a bit and check if it stopped
    sleep 1
    if pgrep -f "mongod.*$MONGO_PORT" > /dev/null; then
        echo -e "${YELLOW}⚠️  Force stopping MongoDB...${NC}"
        kill $MONGO_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}✅ MongoDB stopped${NC}"
else
    echo -e "${YELLOW}ℹ️  MongoDB is not running on port $MONGO_PORT${NC}"
fi

# Stop any running npm processes for this project
NPM_PIDS=$(pgrep -f "npm run dev")
if [ ! -z "$NPM_PIDS" ]; then
    echo -e "${YELLOW}🛑 Stopping npm processes...${NC}"
    echo "$NPM_PIDS" | xargs kill 2>/dev/null
    echo -e "${GREEN}✅ npm processes stopped${NC}"
fi

echo -e "${GREEN}✅ All services stopped${NC}"
