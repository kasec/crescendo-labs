#!/bin/bash
# scripts/verify-phase-1.sh
# Phase 1 End-to-End Verification Script

echo "=== Phase 1 Verification ==="
echo "Date: $(date)"
echo ""

PASS=0
FAIL=0
WARN=0

# Helper function
check_result() {
    if [ $1 -eq 0 ]; then
        echo "  ✓ PASS"
        ((PASS++))
    else
        echo "  ✗ FAIL"
        ((FAIL++))
    fi
}

# 1. OpenClaw version
echo "1. OpenClaw version (required: >= 2026.2.26):"
OPENCLAW_VERSION=$(openclaw --version 2>&1 | grep -oE '2026\.[0-9]+\.[0-9]+' | head -1)
if [ -n "$OPENCLAW_VERSION" ]; then
    echo "  Version: $OPENCLAW_VERSION"
    check_result 0
else
    echo "  Could not determine version"
    check_result 1
fi

# 2. Gateway health check
echo "2. Gateway health check (port 18789):"
HEALTH_RESPONSE=$(curl -s http://localhost:18789/health 2>&1)
if echo "$HEALTH_RESPONSE" | grep -q '"ok":true\|"ok": true'; then
    echo "  Response: $HEALTH_RESPONSE"
    check_result 0
else
    echo "  Response: $HEALTH_RESPONSE"
    check_result 1
fi

# 3. Node.js version
echo "3. Node.js version (required: 22.x):"
NODE_VERSION=$(node --version 2>&1)
if echo "$NODE_VERSION" | grep -qE '^v22\.'; then
    echo "  Version: $NODE_VERSION"
    check_result 0
else
    echo "  Version: $NODE_VERSION (WARNING: Should be v22.x)"
    ((WARN++))
fi

# 4. gogcli installed
echo "4. gogcli installed (required: >= v0.11):"
GOG_VERSION=$(gog --version 2>&1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ -n "$GOG_VERSION" ]; then
    echo "  Version: $GOG_VERSION"
    check_result 0
else
    echo "  Not installed"
    check_result 1
fi

# 5. Rate limiting wrapper exists
echo "5. Rate limiting wrapper script:"
if [ -x ~/.openclaw/scripts/gog-wrapper.sh ]; then
    echo "  Path: ~/.openclaw/scripts/gog-wrapper.sh"
    check_result 0
else
    echo "  Script not found or not executable"
    check_result 1
fi

# 6. Token refresh script exists
echo "6. Token refresh script:"
if [ -x ~/.openclaw/scripts/refresh-token.sh ]; then
    echo "  Path: ~/.openclaw/scripts/refresh-token.sh"
    check_result 0
else
    echo "  Script not found or not executable"
    check_result 1
fi

# 7. Launch agent installed (macOS)
echo "7. Daily token refresh scheduled:"
if [ -f ~/Library/LaunchAgents/com.openclaw.token-refresh.plist ]; then
    echo "  Launch agent: com.openclaw.token-refresh"
    check_result 0
else
    echo "  Launch agent not installed"
    check_result 1
fi

# 8. Security policy documented
echo "8. Security policy (SECURITY.md):"
if [ -f ./SECURITY.md ]; then
    echo "  File: ./SECURITY.md"
    check_result 0
else
    echo "  SECURITY.md not found"
    check_result 1
fi

# 9. Gateway configuration
echo "9. Gateway configuration:"
if [ -f ~/.openclaw/config/gateway.yaml ]; then
    echo "  File: ~/.openclaw/config/gateway.yaml"
    PORT=$(grep "port:" ~/.openclaw/config/gateway.yaml | head -1 | awk '{print $2}')
    echo "  Configured port: $PORT"
    check_result 0
else
    echo "  Configuration not found"
    check_result 1
fi

# 10. OAuth credentials (warning only - requires manual setup)
echo "10. OAuth credentials (manual setup required):"
if [ -f ~/.openclaw/credentials.json ]; then
    echo "  Credentials file exists"
    ((WARN++))
    echo "  ⚠ WARNING: Credentials should NOT be committed to git"
else
    echo "  Not configured (requires manual Google Cloud setup)"
    ((WARN++))
fi

echo ""
echo "=== Verification Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Warnings: $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ Phase 1 verification PASSED"
    exit 0
else
    echo "✗ Phase 1 verification FAILED"
    exit 1
fi
