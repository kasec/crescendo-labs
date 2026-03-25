#!/bin/bash
set -e

# IMSS Lab Appointment Scheduling POC - Docker Build Script

TAG="openclaw-gateway:latest"

echo "=== Building OpenClaw Gateway Docker Image ==="
echo "Tag: $TAG"

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Check for package.json
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Creating a default one..."
    cat > package.json <<EOF
{
  "name": "crescendo-labs-poc",
  "version": "1.0.0",
  "dependencies": {
    "sqlite3": "^5.1.7"
  }
}
EOF
fi

# Build the image
docker build -t "$TAG" .

echo "=== Build Complete ==="
docker images "$TAG"
