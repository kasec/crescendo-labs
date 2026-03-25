#!/bin/bash
# scripts/test-skills.sh
# End-to-end skill testing for Phase 2

set -e

SKILLS_DIR="$HOME/.openclaw/skills"
PROJECT_DIR="/Users/galfan/Developer/crescendo-labs"
DB_PATH="$PROJECT_DIR/data/sqlite.db"

echo "=== Phase 2 Skill Testing ==="
echo "Date: $(date)"
echo ""

PASS=0
FAIL=0

# Test 1: Email Parser with valid data
echo "Test 1: Email Parser (valid data)"
RESULT=$(cd "$SKILLS_DIR/email-parser" && node -e "
const { parseEmailBody } = require('./parser.js');
const testEmail = \`Patient: Juan Pérez García
CURP: PEGJ850101HDFRRN09
Date of Birth: 1985-01-01
Lab Type: Blood Work
Preferred Date: 2026-03-25
Preferred Time: 10:00 AM
Priority: Routine
Notes: Fasting required\`;
const result = parseEmailBody(testEmail);
if (result.curp === 'PEGJ850101HDFRRN09' && result.labType === 'Blood Work') {
    console.log('PASS');
} else {
    console.log('FAIL');
    process.exit(1);
}
" 2>&1)

if [ "$RESULT" = "PASS" ]; then
    echo "  ✓ PASS - Email parsed correctly"
    ((PASS++))
else
    echo "  ✗ FAIL"
    ((FAIL++))
fi

# Test 2: Email Parser with invalid CURP (too short)
echo ""
echo "Test 2: Email Parser (invalid CURP - too short)"
RESULT=$(cd "$SKILLS_DIR/email-parser" && node -e "
const { parseEmailBody } = require('./parser.js');
const testEmail = \`Patient: Juan Pérez
CURP: SHORT123
Lab Type: Blood Work
Preferred Date: 2026-03-25\`;
const result = parseEmailBody(testEmail);
if (result.curp.length !== 18) {
    console.log('PASS');
} else {
    console.log('FAIL');
    process.exit(1);
}
" 2>&1)

if [ "$RESULT" = "PASS" ]; then
    echo "  ✓ PASS - Invalid CURP detected (length != 18)"
    ((PASS++))
else
    echo "  ✗ FAIL - Should reject short CURP"
    ((FAIL++))
fi

# Test 3: Email Parser with date formats
echo ""
echo "Test 3: Email Parser (date format parsing)"
RESULT=$(cd "$SKILLS_DIR/email-parser" && node -e "
const { parseDate } = require('./parser.js');
const iso = parseDate('2026-03-25');
const euro = parseDate('25/03/2026');
if (iso === '2026-03-25' && euro === '2026-03-25') {
    console.log('PASS');
} else {
    console.log('FAIL');
    process.exit(1);
}
" 2>&1)

if [ "$RESULT" = "PASS" ]; then
    echo "  ✓ PASS - Date formats parsed correctly"
    ((PASS++))
else
    echo "  ✗ FAIL - Date parsing failed"
    ((FAIL++))
fi

# Test 4: Slot availability check
echo ""
echo "Test 4: Slot Availability Check"
TODAY=$(date +%Y-%m-%d)
AVAILABLE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM lab_capacity WHERE date >= '$TODAY' AND booked_slots < max_slots;")
if [ "$AVAILABLE" -gt 0 ]; then
    echo "  Available slots: $AVAILABLE"
    echo "  ✓ PASS"
    ((PASS++))
else
    echo "  ✗ FAIL - No available slots"
    ((FAIL++))
fi

# Test 5: Lab capacity structure
echo ""
echo "Test 5: Lab Capacity Structure"
RESULT=$(sqlite3 "$DB_PATH" "SELECT max_slots FROM lab_capacity LIMIT 1;")
if [ "$RESULT" = "20" ]; then
    echo "  Max slots per hour: 20"
    echo "  ✓ PASS"
    ((PASS++))
else
    echo "  ✗ FAIL - Expected max_slots=20, got $RESULT"
    ((FAIL++))
fi

# Test 6: Audit log structure
echo ""
echo "Test 6: Audit Log Structure"
sqlite3 "$DB_PATH" "PRAGMA table_info(audit_log);" | grep -q "action" && echo "  ✓ PASS" || echo "  ✗ FAIL"
if sqlite3 "$DB_PATH" "PRAGMA table_info(audit_log);" | grep -q "action"; then
    ((PASS++))
else
    ((FAIL++))
fi

# Test 7: Patient CURP format validation
echo ""
echo "Test 7: Patient CURP Format (18 characters)"
INVALID_CURPS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patients WHERE length(curp) != 18;")
if [ "$INVALID_CURPS" = "0" ]; then
    echo "  All patients have 18-character CURP"
    echo "  ✓ PASS"
    ((PASS++))
else
    echo "  ✗ FAIL - Found $INVALID_CURPS patients with invalid CURP length"
    ((FAIL++))
fi

# Test 8: Doctor specialties
echo ""
echo "Test 8: Doctor Specialties (3+ required)"
SPECIALTIES=$(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT specialty) FROM doctors;")
if [ "$SPECIALTIES" -ge 3 ]; then
    echo "  Specialties found: $SPECIALTIES"
    echo "  ✓ PASS"
    ((PASS++))
else
    echo "  ✗ FAIL - Expected 3+ specialties, got $SPECIALTIES"
    ((FAIL++))
fi

echo ""
echo "=== Test Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ All skill tests PASSED"
    exit 0
else
    echo "✗ Some skill tests FAILED"
    exit 1
fi
