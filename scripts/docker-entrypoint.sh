#!/bin/bash
set -e

# IMSS Lab Appointment Scheduling POC - Docker Entrypoint
# Forces SQLite journal_mode=DELETE for Docker volume compatibility

DB_PATH="/home/node/app/data/sqlite.db"

echo "=== OpenClaw Gateway Docker Entrypoint ==="

# 1. Ensure data directory exists
mkdir -p /home/node/app/data

# 2. Check if database exists, if not create it from schema
if [ ! -f "$DB_PATH" ]; then
    echo "Database not found at $DB_PATH. Initializing from schema..."
    if [ -f "/home/node/app/scripts/create-schema.sql" ]; then
        sqlite3 "$DB_PATH" < /home/node/app/scripts/create-schema.sql
        echo "Database initialized."
    else
        echo "Warning: scripts/create-schema.sql not found. Database not initialized."
    fi
fi

# 3. Force DELETE journal mode for Docker volume compatibility
# WAL mode can cause issues with some network-attached storage and Docker volumes
if [ -f "$DB_PATH" ]; then
    echo "Setting SQLite journal_mode=DELETE for $DB_PATH..."
    sqlite3 "$DB_PATH" "PRAGMA journal_mode=DELETE;"
fi

# 4. Check for Gmail credentials and configuration
if [ ! -f "/home/node/.openclaw/credentials.json" ] && [ -n "$GMAIL_CREDENTIALS_JSON" ]; then
    echo "Writing credentials.json from environment variable..."
    echo "$GMAIL_CREDENTIALS_JSON" > /home/node/.openclaw/credentials.json
    chmod 600 /home/node/.openclaw/credentials.json
fi

if [ ! -f "/home/node/.openclaw/gateway.yaml" ]; then
    echo "Warning: gateway.yaml not found at /home/node/.openclaw/gateway.yaml"
fi

# 5. Start the OpenClaw gateway in foreground
echo "Starting OpenClaw gateway on port 18789..."
TOKEN_ARG=""
if [ -n "$OPENCLAW_GATEWAY_TOKEN" ]; then
    TOKEN_ARG="--token $OPENCLAW_GATEWAY_TOKEN"
fi

exec openclaw gateway run --port 18789 --bind lan $TOKEN_ARG
