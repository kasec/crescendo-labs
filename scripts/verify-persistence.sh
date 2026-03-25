#!/bin/bash
set -e

# IMSS Lab Appointment Scheduling POC - Persistence Verification Script

# Ensure we're in the project root
cd "$(dirname "$0")/.."

DB_PATH="./data/sqlite.db"
TEST_VALUE="persistence-test-$(date +%s)"

echo "=== Verifying Data Persistence ==="

# 1. Ensure the service is running
if ! docker compose ps | grep -q "Up"; then
    echo "Service is not running. Starting it..."
    ./scripts/docker-up.sh
fi

# 2. Insert test data into the container's database
echo "Inserting test data: $TEST_VALUE"
docker exec openclaw-gateway sqlite3 /home/node/app/data/sqlite.db "INSERT INTO audit_log (action, resource) VALUES ('test-persistence', '$TEST_VALUE');"

# 3. Restart the container
echo "Restarting container..."
docker compose restart openclaw-gateway

# 4. Wait for it to be healthy again
echo "Waiting for health check..."
./scripts/docker-up.sh

# 5. Verify data is still there
echo "Verifying data integrity..."
RESULT=$(docker exec openclaw-gateway sqlite3 /home/node/app/data/sqlite.db "SELECT resource FROM audit_log WHERE action = 'test-persistence' AND resource = '$TEST_VALUE';")

if [ "$RESULT" = "$TEST_VALUE" ]; then
    echo "SUCCESS: Data persisted across container restart."
else
    echo "FAILURE: Data lost after container restart."
    echo "Expected: $TEST_VALUE"
    echo "Actual: $RESULT"
    exit 1
fi

echo "=== Persistence Verification PASSED ==="
