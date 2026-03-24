# PLAN.md — Phase 3: Integration

**Phase:** 3 of 4
**Goal:** End-to-end booking flow working with error handling
**Duration:** Day 5
**Mode:** YOLO (auto-approve execution)

---

## Objective

Build and integrate the complete appointment booking flow:
1. Create Booking Engine Skill that coordinates the full flow
2. Create Email Sender Skill for confirmations and error replies
3. Implement comprehensive error handling for all edge cases
4. Test end-to-end flow with 5 test scenarios

This plan satisfies **13 requirements**: E2, E3, E4, B3, B4, B5, A4, A5, H1, H2, H3, H4, H5

---

## Execution Context

### Phase Requirements (from ROADMAP.md)

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **E2** | Template-based email parsing | Doctors follow template, system extracts patient data, invalid templates receive error reply | MEDIUM |
| **E3** | Confirmation emails sent | Email within 1 minute of booking, includes appointment details | MEDIUM |
| **E4** | Error reply emails | Email sent if booking fails with clear error reason | LOW |
| **B3** | Prevent double-booking | Database constraints, atomic booking, lane-based queue prevents race conditions | MEDIUM |
| **B4** | First-available slot assignment | Assigns first available slot, falls back to next date | LOW |
| **B5** | Appointment status tracking | Statuses: scheduled/completed/cancelled, audit log records changes | LOW |
| **A4** | Booking engine skill | Coordinates flow, atomic transaction, logs to audit_log, rollback on failure | HIGH |
| **A5** | Email sender skill | Sends confirmation/error emails, uses templates, tracks sent status | MEDIUM |
| **H1** | Handle "slot full" errors | Offer next available, error email if no slots in 7 days | LOW |
| **H2** | Handle invalid email format | Error reply with template example, highlights missing fields | LOW |
| **H3** | Handle database errors | Graceful failure, retry logic, alert on persistent failures | MEDIUM |
| **H4** | Handle OAuth token expiration | Daily token refresh, alert if refresh fails | MEDIUM |
| **H5** | Handle Gmail API failures | Retry with backoff, queue for later delivery, log failures | MEDIUM |

### Success Criteria (Observable Behaviors)

- [ ] End-to-end test case 1 passes (valid email → booking confirmed)
- [ ] End-to-end test case 2 passes (invalid CURP → error email)
- [ ] End-to-end test case 3 passes (slot full → next available offered)
- [ ] End-to-end test case 4 passes (no slots in 7 days → error email)
- [ ] End-to-end test case 5 passes (Gmail 429 → retry with backoff)
- [ ] Confirmation email received within 1 minute of booking
- [ ] Error email received with clear failure reason
- [ ] `audit_log` shows all actions for test bookings
- [ ] No double-booking under concurrent requests
- [ ] Booking Engine rolls back on failure

### Prerequisites (from Phase 1 & 2)

**Completed:**
- ✅ OpenClaw Gateway v2026.3.23 running on port 18789
- ✅ gogcli v0.12.0 installed
- ✅ SQLite database with 5 tables (patients, doctors, appointments, lab_capacity, audit_log)
- ✅ Mock data: 55 patients, 6 doctors, 7 days lab capacity
- ✅ Email Parser Skill (A2) working
- ✅ Slot Manager Skill (A3) working
- ✅ Lane-based command queue configured

**Pending (Manual):**
- ⚠️ Gmail OAuth setup (see `.planning/phases/01-foundation/SERVICE_ACCOUNT_SETUP.md`)

### Key Constraints

- **Atomic transactions** — Booking must be all-or-nothing (rollback on any failure)
- **Lane-based processing** — Prevents race conditions on slot booking
- **Template-based emails** — Consistent confirmation/error formats
- **Error handling** — Clear, actionable error messages for users
- **Audit logging** — All actions logged for compliance prep

### Research Context

From ARCHITECTURE.md:
- Booking Engine coordinates: Email Parser → Slot Manager → Appointment Create → Email Sender
- Atomic transaction with rollback on any failure
- Lane-based FIFO queue serializes email processing

From PITFALLS.md:
- H3: Database errors need graceful failure + retry logic
- H5: Gmail API 429 errors need exponential backoff (5s, 10s, 15s)
- B3: Race conditions prevented via lane-based queue, not just DB locks

---

## Tasks

### Task 1: Create Booking Engine Skill (A4)

**Goal:** Build the central coordination skill for the booking flow

**Checklist:**
- [ ] Create skill directory: `~/.openclaw/skills/booking-engine/`
- [ ] Create `skill.json` with metadata and dependencies
- [ ] Create `index.js` with main booking coordination logic
- [ ] Create `booking-service.js` with business logic
- [ ] Implement atomic transaction (begin → book → commit OR rollback)
- [ ] Log all actions to `audit_log` table
- [ ] Handle rollback on any failure (slot unavailable, DB error, email send failure)

**Skill Structure:**
```
~/.openclaw/skills/booking-engine/
├── skill.json        # Skill metadata, dependencies (email-parser, slot-manager)
├── index.js          # Main entry point, OpenClaw skill interface
├── booking-service.js # Core booking logic with transactions
├── templates.js      # Email templates for confirmations/errors
└── README.md         # Usage documentation
```

**Booking Flow:**
```
1. Receive email thread from OpenClaw
2. Call Email Parser Skill → extract patient data
3. If parsing fails → trigger Email Sender with error
4. Call Slot Manager Skill → find available slot
5. If no slot → trigger Email Sender with "no availability" error
6. Begin DB transaction
7. Create appointment record
8. Update lab_capacity (booked++)
9. Commit transaction
10. Log to audit_log
11. Trigger Email Sender with confirmation
12. Return success status
```

**Acceptance:** Booking Engine Skill files created, skill.json declares dependencies

---

### Task 2: Create Email Sender Skill (A5)

**Goal:** Build skill for sending confirmation and error emails

**Checklist:**
- [ ] Create skill directory: `~/.openclaw/skills/email-sender/`
- [ ] Create `skill.json` with metadata
- [ ] Create `index.js` with main email sending logic
- [ ] Create `email-templates.js` with confirmation/error templates
- [ ] Create `sender-service.js` with gogcli integration
- [ ] Implement email tracking (sent status in database)
- [ ] Handle Gmail API errors with retry logic

**Email Templates:**

**Confirmation Email:**
```
Asunto: ✅ Cita de Laboratorio Confirmada

Hola {doctor_name},

Su cita ha sido confirmada exitosamente:

Paciente: {patient_name}
CURP: {patient_curp}
Tipo de Estudio: {lab_type}
Fecha: {appointment_date}
Hora: {appointment_time}
Laboratorio: {lab_location}

Por favor llegue 15 minutos antes de su cita.

Saludos,
IMSS Lab Appointments
```

**Error Email (Invalid Data):**
```
Asunto: ❌ Error - Solicitud de Cita

Hola {doctor_name},

No pudimos procesar su solicitud:

Error: {error_message}

Campos requeridos:
- Patient: Nombre completo del paciente
- CURP: CURP de 18 caracteres
- Date of Birth: Fecha de nacimiento (YYYY-MM-DD o DD/MM/YYYY)
- Lab Type: Tipo de estudio (Blood Work, X-Ray, Urinalysis, etc.)
- Preferred Date: Fecha preferida (YYYY-MM-DD)
- Preferred Time: Hora preferida (HH:MM AM/PM)

Ejemplo de formato correcto:
[Paste email template example]

Saludos,
IMSS Lab Appointments
```

**Error Email (No Availability):**
```
Asunto: ⚠️ Sin Disponibilidad - Solicitud de Cita

Hola {doctor_name},

No hay slots disponibles en los próximos 7 días para: {lab_type}

Próxima disponibilidad: {next_available_date}

¿Le gustaría agendar para esta fecha? Responda este email.

Saludos,
IMSS Lab Appointments
```

**Acceptance:** Email Sender Skill files created, templates defined, gogcli integration working

---

### Task 3: Implement Error Handling (H1-H5)

**Goal:** Add comprehensive error handling for all edge cases

**Checklist:**
- [ ] H1: Slot full error handling (offer next available)
- [ ] H2: Invalid email format handling (reply with template)
- [ ] H3: Database error handling (graceful failure + retry)
- [ ] H4: OAuth token expiration handling (alert on refresh failure)
- [ ] H5: Gmail API failure handling (retry with backoff)

**Error Handler Module:** `~/.openclaw/skills/booking-engine/error-handler.js`

```javascript
const errorTypes = {
  SLOT_FULL: 'SLOT_FULL',
  NO_AVAILABILITY: 'NO_AVAILABILITY',
  INVALID_DATA: 'INVALID_DATA',
  DB_ERROR: 'DB_ERROR',
  OAUTH_EXPIRED: 'OAUTH_EXPIRED',
  GMAIL_API_ERROR: 'GMAIL_API_ERROR'
};

async function handleError(errorType, context) {
  switch (errorType) {
    case errorTypes.SLOT_FULL:
      // Offer next available slot
      return await handleSlotFull(context);
    case errorTypes.NO_AVAILABILITY:
      // Send error email with next available date
      return await handleNoAvailability(context);
    case errorTypes.INVALID_DATA:
      // Send error email with template example
      return await handleInvalidData(context);
    case errorTypes.DB_ERROR:
      // Retry logic (max 3 attempts)
      return await handleDatabaseError(context);
    case errorTypes.OAUTH_EXPIRED:
      // Alert admin, attempt token refresh
      return await handleOAuthExpired(context);
    case errorTypes.GMAIL_API_ERROR:
      // Exponential backoff retry
      return await handleGmailApiError(context);
  }
}
```

**Acceptance:** Error handler module created, all 5 error types handled

---

### Task 4: Configure Lane-Based Processing for Booking Flow

**Goal:** Ensure lane-based queue is configured for the booking flow

**Checklist:**
- [ ] Verify `gateway.yaml` has lane-based queue configured
- [ ] Configure lane for email processing (booking lane)
- [ ] Configure lane for email sending (notification lane)
- [ ] Test lane serialization (no concurrent booking on same slot)

**Configuration in `~/.openclaw/config/gateway.yaml`:**
```yaml
gateway:
  port: 18789
  host: 0.0.0.0

queue:
  mode: lane-based
  lanes:
    - name: booking
      concurrency: 1  # Serialized to prevent race conditions
      max_size: 100
    - name: notification
      concurrency: 3  # Can send multiple emails in parallel
      max_size: 500

skills:
  load_order:
    - email-parser
    - slot-manager
    - booking-engine
    - email-sender
```

**Acceptance:** Lane-based queue configured, booking lane serialized (concurrency: 1)

---

### Task 5: Create End-to-End Test Suite

**Goal:** Create comprehensive test suite for the booking flow

**Checklist:**
- [ ] Create test script: `scripts/test-booking-flow.sh`
- [ ] Test case 1: Valid email → booking confirmed
- [ ] Test case 2: Invalid CURP → error email
- [ ] Test case 3: Slot full → next available offered
- [ ] Test case 4: No slots in 7 days → error email
- [ ] Test case 5: Gmail API 429 → retry with backoff
- [ ] Test case 6: Concurrent bookings → no double-booking

**Test Script Structure:**
```bash
#!/bin/bash
# scripts/test-booking-flow.sh

echo "=== Booking Flow Test Suite ==="

# Test 1: Happy Path
echo "Test 1: Valid email → booking confirmed"
# Send test email, verify confirmation received, check DB for appointment

# Test 2: Invalid CURP
echo "Test 2: Invalid CURP → error email"
# Send email with invalid CURP, verify error email received

# Test 3: Slot Full
echo "Test 3: Slot full → next available offered"
# Fill all slots for date, request booking, verify next available offered

# Test 4: No Availability
echo "Test 4: No slots in 7 days → error email"
# Fill all 7 days, request booking, verify error email

# Test 5: Rate Limit Retry
echo "Test 5: Gmail 429 → retry with backoff"
# Mock 429 response, verify retry with exponential backoff

# Test 6: Concurrent Bookings
echo "Test 6: Concurrent bookings → no double-booking"
# Send 5 booking requests simultaneously, verify no overbooking

echo "=== Test Results ==="
echo "Passed: X/6"
echo "Failed: Y/6"
```

**Acceptance:** Test script created, all 6 test cases defined

---

### Task 6: Implement Audit Logging Integration

**Goal:** Ensure all booking actions are logged to audit_log table

**Checklist:**
- [ ] Create audit logger module: `~/.openclaw/skills/booking-engine/audit-logger.js`
- [ ] Log: booking initiated
- [ ] Log: slot reserved
- [ ] Log: appointment created
- [ ] Log: confirmation email sent
- [ ] Log: error occurred (with error type)
- [ ] Log: rollback performed

**Audit Log Schema:**
```sql
INSERT INTO audit_log (
  user_id,
  action,
  resource,
  resource_id,
  timestamp,
  details
) VALUES (
  :doctor_email,
  :action,  -- 'booking_initiated', 'slot_reserved', 'appointment_created', etc.
  'appointment',
  :appointment_id,
  datetime('now'),
  json_object('context', :context)
);
```

**Acceptance:** Audit logger module created, all actions logged

---

### Task 7: Integrate Skills with OpenClaw Gateway

**Goal:** Load and configure all skills in OpenClaw Gateway

**Checklist:**
- [ ] Register Booking Engine Skill in gateway
- [ ] Register Email Sender Skill in gateway
- [ ] Configure skill dependencies (email-parser → slot-manager → booking-engine → email-sender)
- [ ] Configure email polling interval (90 seconds)
- [ ] Configure email thread resolution (match by email thread ID)
- [ ] Restart Gateway and verify skills loaded

**Gateway Configuration:**
```yaml
skills:
  enabled:
    - email-parser
    - slot-manager
    - booking-engine
    - email-sender

email:
  polling_interval: 90  # seconds
  thread_resolution: true
  service_account: lab-bot-{yourdomain}@gmail.com
```

**Acceptance:** All skills loaded, Gateway restarted, skills responding

---

### Task 8: Run End-to-End Verification

**Goal:** Execute full test suite and verify all success criteria

**Checklist:**
- [ ] Run test suite: `scripts/test-booking-flow.sh`
- [ ] Verify all 6 test cases pass
- [ ] Check `audit_log` for complete action trail
- [ ] Verify no double-booking occurred
- [ ] Verify confirmation emails received
- [ ] Verify error emails received with correct messages
- [ ] Document any failures

**Verification Script:** `scripts/verify-phase-3.sh`
```bash
#!/bin/bash
# scripts/verify-phase-3.sh

echo "=== Phase 3 Verification ==="

# Run test suite
./scripts/test-booking-flow.sh

# Check audit log
echo "Checking audit_log..."
sqlite3 data/sqlite.db "SELECT action, COUNT(*) FROM audit_log GROUP BY action;"

# Check appointments created
echo "Checking appointments..."
sqlite3 data/sqlite.db "SELECT COUNT(*) FROM appointments WHERE status='scheduled';"

# Check emails sent
echo "Checking email tracking..."
sqlite3 data/sqlite.db "SELECT COUNT(*) FROM appointments WHERE email_sent=1;"

echo "=== Verification Complete ==="
```

**Acceptance:** All 10 success criteria verified

---

### Task 9: Create SUMMARY.md

**Goal:** Document Phase 3 completion

**Checklist:**
- [ ] Create `.planning/phases/03-integration/SUMMARY.md`
- [ ] List all completed tasks
- [ ] Document test results
- [ ] Note any deviations or issues
- [ ] Update `.planning/STATE.md` with phase progress

**Acceptance:** SUMMARY.md created with complete phase report

---

## Verification

### Phase 3 Completion Checklist

- [ ] Task 1: Booking Engine Skill created (A4)
- [ ] Task 2: Email Sender Skill created (A5)
- [ ] Task 3: Error handling implemented (H1-H5)
- [ ] Task 4: Lane-based processing configured
- [ ] Task 5: Test suite created
- [ ] Task 6: Audit logging integrated
- [ ] Task 7: Skills integrated with Gateway
- [ ] Task 8: End-to-end verification passed
- [ ] Task 9: SUMMARY.md created

### Requirements Satisfied

| Requirement | Status | Evidence |
|-------------|--------|----------|
| E2 (Email parsing) | ☐ | Email Parser Skill extracts data |
| E3 (Confirmation emails) | ☐ | Confirmation email sent within 1 min |
| E4 (Error emails) | ☐ | Error email sent on failures |
| B3 (No double-booking) | ☐ | Lane-based queue + atomic transactions |
| B4 (First-available slot) | ☐ | Booking engine assigns first available |
| B5 (Status tracking) | ☐ | Appointments table has status field |
| A4 (Booking engine) | ☐ | Skill coordinates full flow |
| A5 (Email sender) | ☐ | Skill sends confirmations/errors |
| H1 (Slot full) | ☐ | Next available offered |
| H2 (Invalid format) | ☐ | Error reply with template |
| H3 (DB errors) | ☐ | Graceful failure + retry |
| H4 (OAuth expired) | ☐ | Alert on refresh failure |
| H5 (Gmail failures) | ☐ | Retry with backoff |

---

## Output

### Files Created

**Skills:**
- `~/.openclaw/skills/booking-engine/` — Booking coordination skill
- `~/.openclaw/skills/email-sender/` — Email sending skill

**Scripts:**
- `scripts/test-booking-flow.sh` — End-to-end test suite
- `scripts/verify-phase-3.sh` — Phase verification script

**Documentation:**
- `.planning/phases/03-integration/SUMMARY.md` — Phase completion report

### Configuration Updates

- `~/.openclaw/config/gateway.yaml` — Skills registered, lanes configured

### State Updates

Update `.planning/STATE.md`:
```yaml
current_phase: 3
phase_status: completed
phase_progress: 3/4 phases complete
```

---

## Next Steps

After Phase 3 completion:

1. **Update STATE.md** — Mark Phase 3 as completed
2. **Commit changes** — Add skills, scripts, configuration
3. **Begin Phase 4** — Docker & Deployment (containerize + VPS guide)

**Command to start Phase 4:**
```
/gsd:plan-phase 4
```

---

*Plan created: March 24, 2026*
*Phase 3 of 4 — Integration*
