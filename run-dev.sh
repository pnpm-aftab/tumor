#!/bin/bash

# Development script to run both backend and frontend for tumor

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting tumor development environment...${NC}"

# Load environment variables from backend/.env if it exists
if [ -f "backend/.env" ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

# Check if OPENROUTER_API_KEY or OPENAI_API_KEY is set
if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}Warning: Neither OPENROUTER_API_KEY nor OPENAI_API_KEY is set.${NC}"
    echo -e "${YELLOW}The backend will run in mock mode. Set one of these variables for full functionality.${NC}"
fi

# Start backend
echo -e "${GREEN}Starting backend server...${NC}"
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

# Start backend in background
node server.js &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID: $BACKEND_PID${NC}"

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}Backend is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Backend failed to start within expected time${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Go back to root directory
cd ..

# Start frontend
echo -e "${GREEN}Starting Swift frontend...${NC}"
swift run tumor &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend started with PID: $FRONTEND_PID${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    echo -e "${YELLOW}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${YELLOW}Stopping backend (PID: $BACKEND_PID)...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}Shutdown complete${NC}"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}Both services are running!${NC}"
echo -e "${GREEN}Backend: http://localhost:3000${NC}"
echo -e "${GREEN}Frontend: macOS menu bar app${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"

# Wait for both processes
wait
