#!/bin/bash
set -e

# IMSS Lab Appointment Scheduling POC - Docker Up Script

# Ensure we're in the project root
cd "$(dirname "$0")/.."

echo "=== Starting OpenClaw Gateway Service ==="

# Check for .env file
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Creating a placeholder..."
    cat > .env <<EOF
# IMSS Lab Appointment Scheduling POC - Docker Environment
GMAIL_SERVICE_ACCOUNT=lab-bot-placeholder@gmail.com
GMAIL_CREDENTIALS_JSON='{}'
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 24)
EOF
fi

# Start the service
docker compose up -d

# Wait for health check
echo "Waiting for health check (max 60s)..."
MAX_RETRIES=12
COUNT=0
HEALTHY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:18789/health | grep -q '"ok":true'; then
        echo "Service is HEALTHY."
        HEALTHY=true
        break
    fi
    echo "Waiting... ($((COUNT + 1))/$MAX_RETRIES)"
    sleep 5
    COUNT=$((COUNT + 1))
done

if [ "$HEALTHY" = false ]; then
    echo "Error: Service failed health check."
    docker compose logs
    exit 1
fi

echo "=== Service Started Successfully ==="
docker compose ps
