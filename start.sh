#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Language Learning App...${NC}"

# MongoDB data directory
MONGO_DATA_DIR=~/mongodb_data
MONGO_LOG=~/mongodb.log
MONGO_PORT=27018

# Create MongoDB data directory if it doesn't exist
if [ ! -d "$MONGO_DATA_DIR" ]; then
    echo -e "${YELLOW}📁 Creating MongoDB data directory...${NC}"
    mkdir -p "$MONGO_DATA_DIR"
fi

# Start MongoDB
echo -e "${GREEN}🍃 Starting MongoDB on port $MONGO_PORT...${NC}"
mongod --port $MONGO_PORT --dbpath "$MONGO_DATA_DIR" --fork --logpath "$MONGO_LOG"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MongoDB started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start MongoDB${NC}"
fi

# Store MongoDB PID for cleanup
MONGO_PID=$(pgrep -f "mongod.*$MONGO_PORT")

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping services...${NC}"
    
    # Stop MongoDB
    if [ ! -z "$MONGO_PID" ]; then
        echo -e "${YELLOW}🍃 Stopping MongoDB...${NC}"
        mongosh --port $MONGO_PORT --eval "db.adminCommand({ shutdown: 1 })" 2>/dev/null || kill $MONGO_PID 2>/dev/null
        echo -e "${GREEN}✅ MongoDB stopped${NC}"
    fi
    
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start the application
echo -e "${GREEN}🎯 Starting application...${NC}"
npm run dev

# If npm run dev exits, cleanup
cleanup
