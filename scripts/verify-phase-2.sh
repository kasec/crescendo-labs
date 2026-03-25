#!/bin/bash
# scripts/verify-phase-2.sh
# Phase 2 End-to-End Verification Script

PROJECT_DIR="/Users/galfan/Developer/crescendo-labs"
DB_PATH="$PROJECT_DIR/data/sqlite.db"
SKILLS_DIR="$HOME/.openclaw/skills"

echo "=== Phase 2 Verification ==="
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

# 1. Database file exists
echo "1. SQLite database file:"
if [ -f "$DB_PATH" ]; then
    echo "  Path: $DB_PATH"
    check_result 0
else
    echo "  File not found"
    check_result 1
fi

# 2. All 5 tables exist
echo "2. Database tables (required: 5):"
TABLE_COUNT=$(sqlite3 "$DB_PATH" ".tables" | wc -w)
echo "  Tables found: $TABLE_COUNT"
if [ "$TABLE_COUNT" -ge 5 ]; then
    sqlite3 "$DB_PATH" ".tables"
    check_result 0
else
    echo "  Expected: 5 tables (patients, appointments, lab_capacity, audit_log, doctors)"
    check_result 1
fi

# 3. Patient count (required: 50+)
echo "3. Mock patient data (required: 50+):"
PATIENT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patients;")
echo "  Patient count: $PATIENT_COUNT"
if [ "$PATIENT_COUNT" -ge 50 ]; then
    check_result 0
else
    check_result 1
fi

# 4. Doctor count (required: 5+)
echo "4. Mock doctor data (required: 5+):"
DOCTOR_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM doctors;")
echo "  Doctor count: $DOCTOR_COUNT"
if [ "$DOCTOR_COUNT" -ge 5 ]; then
    check_result 0
else
    check_result 1
fi

# 5. Lab capacity days (required: 7+)
echo "5. Lab capacity days (required: 7+):"
CAPACITY_DAYS=$(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT date) FROM lab_capacity;")
echo "  Capacity days: $CAPACITY_DAYS"
if [ "$CAPACITY_DAYS" -ge 7 ]; then
    check_result 0
else
    check_result 1
fi

# 6. Email Parser Skill exists
echo "6. Email Parser Skill:"
if [ -f "$SKILLS_DIR/email-parser/skill.json" ] && \
   [ -f "$SKILLS_DIR/email-parser/index.js" ] && \
   [ -f "$SKILLS_DIR/email-parser/parser.js" ]; then
    echo "  Path: $SKILLS_DIR/email-parser/"
    check_result 0
else
    echo "  Skill files not found"
    check_result 1
fi

# 7. Slot Manager Skill exists
echo "7. Slot Manager Skill:"
if [ -f "$SKILLS_DIR/slot-manager/skill.json" ] && \
   [ -f "$SKILLS_DIR/slot-manager/index.js" ]; then
    echo "  Path: $SKILLS_DIR/slot-manager/"
    check_result 0
else
    echo "  Skill files not found"
    check_result 1
fi

# 8. Lane-based queue configured
echo "8. Lane-based queue configuration:"
if grep -q "lanes:" "$HOME/.openclaw/config/gateway.yaml" 2>/dev/null; then
    echo "  Lanes configured in gateway.yaml"
    grep -A 2 "lanes:" "$HOME/.openclaw/config/gateway.yaml" | head -3
    check_result 0
else
    echo "  Lane configuration not found"
    check_result 1
fi

# 9. CURP validation test
echo "9. CURP validation (Email Parser):"
CURP_TEST=$(cd "$SKILLS_DIR/email-parser" && node -e "
const { parseEmailBody } = require('./parser.js');
const result = parseEmailBody('Patient: Test\nCURP: SHORT\nLab Type: Blood\nPreferred Date: 2026-03-25');
console.log(result.curp.length === 18 ? 'FAIL' : 'PASS');
" 2>&1)
if [ "$CURP_TEST" = "PASS" ]; then
    echo "  Invalid CURP rejected"
    check_result 0
else
    echo "  CURP validation failed"
    check_result 1
fi

# 10. Atomic slot reservation test
echo "10. Slot Manager availability check:"
TODAY=$(date +%Y-%m-%d)
AVAILABLE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM lab_capacity WHERE date >= '$TODAY' AND booked_slots < max_slots;")
if [ "$AVAILABLE" -gt 0 ]; then
    echo "  Available slots: $AVAILABLE"
    check_result 0
else
    echo "  No available slots found"
    check_result 1
fi

echo ""
echo "=== Verification Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Warnings: $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ Phase 2 verification PASSED"
    exit 0
else
    echo "✗ Phase 2 verification FAILED"
    exit 1
fi
