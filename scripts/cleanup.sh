#!/bin/bash
set -e

# IMSS Lab Appointment Scheduling POC - Cleanup Script
# Removes Docker resources, temporary logs, and local node_modules

echo "=== Starting Cleanup Process ==="

# 1. Stop and remove Docker containers and networks
if command -v docker-compose &> /dev/null; then
    echo "Stopping Docker containers..."
    docker-compose down --remove-orphans || true
fi

# 2. Remove Docker image
if [ "$(docker images -q openclaw-gateway:latest 2> /dev/null)" ]; then
    echo "Removing Docker image: openclaw-gateway:latest"
    docker rmi openclaw-gateway:latest || true
fi

# 3. Remove local node_modules and package-lock.json
if [ -d "node_modules" ]; then
    echo "Removing local node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo "Removing package-lock.json..."
    rm package-lock.json
fi

# 4. Remove temporary logs and artifacts
echo "Removing temporary logs and artifacts..."
rm -f gateway_startup.log
rm -f scripts/gateway_startup.log
rm -rf ~/.openclaw
rm -f data/sqlite.db-journal

# 5. Clean up Docker volumes (Optional - Use with caution)
# echo "Removing Docker volumes..."
# docker volume rm crescendo-labs_data crescendo-labs_.openclaw || true

echo "=== Cleanup Complete ==="
echo "Note: Database (data/sqlite.db) and configuration (config/, skills/) were preserved."
