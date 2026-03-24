# Requirements: IMSS Lab Appointment Scheduling POC

**Version:** 1.0 (POC)
**Date:** March 23, 2026
**Status:** Active hypotheses — validate through implementation

---

## Overview

This document defines **checkable requirements** for the IMSS Lab Appointment Scheduling POC. Each requirement is scoped to v1 (POC build), v2 (post-POC enhancements), or excluded (out of scope).

**Source:** Research from FEATURES.md + user scoping decisions

---

## v1 Requirements (POC Scope)

**Definition:** Must-have features for the working demo. These are hypotheses to validate through implementation.

### Category 1: Email Communication

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **E1** | System reads doctor emails via Gmail API | - gogcli v0.11 installed in Docker container<br>- OAuth configured with minimal scopes (gmail.readonly, gmail.send)<br>- Emails polled every 90 seconds with exponential backoff | MEDIUM |
| **E2** | Template-based email parsing | - Doctors follow provided email template<br>- System extracts: patient name, CURP, DOB, lab type, preferred date/time<br>- Invalid templates receive error reply | MEDIUM |
| **E3** | Confirmation emails sent to doctors | - Email sent within 1 minute of successful booking<br>- Includes: patient name, appointment date/time, lab type, location<br>- Sent via Gmail API (gogcli) | MEDIUM |
| **E4** | Error reply emails for failed bookings | - Email sent if booking fails (slot full, invalid data, no availability)<br>- Includes clear error reason and next steps | LOW |
| **E5** | Rate limiting on email operations | - Exponential backoff on Gmail API 429 errors<br>- Max 3 retries with 5s, 10s, 15s delays<br>- Daily token refresh cron job | MEDIUM |

---

### Category 2: Appointment Booking

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **B1** | Fixed slot capacity management | - Lab capacity: 20 slots/hour (configurable)<br>- Operating hours: Mon-Fri 9:00-17:00 (configurable)<br>- 15-minute default slot duration | LOW |
| **B2** | Real-time slot availability tracking | - SQLite `lab_capacity` table tracks booked vs max per hour<br>- Availability checked atomically before booking | LOW |
| **B3** | Prevent double-booking | - Database constraints + transaction locking<br>- Atomic booking operation (all-or-nothing)<br>- Race condition prevention via lane-based queue | MEDIUM |
| **B4** | First-available slot assignment | - System assigns first available slot on preferred date<br>- Falls back to next available date if preferred is full<br>- No smart recommendations (simple algorithm) | LOW |
| **B5** | Appointment status tracking | - Statuses: `scheduled`, `completed`, `cancelled`<br>- Status stored in `appointments` table<br>- Audit log records status changes | LOW |

---

### Category 3: Data Management

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **D1** | SQLite database with schema | - Tables: `patients`, `appointments`, `lab_capacity`, `audit_log`, `doctors`<br>- SQLite 3.40+ with DELETE journal mode (not WAL)<br>- Database file persisted in Docker volume | MEDIUM |
| **D2** | Mock patient data (50+ records) | - Synthetic patients with: name, CURP, DOB, contact info<br>- Data generator script creates 50+ realistic Mexican names<br>- No real patient data used in POC | LOW |
| **D3** | Mock doctor data (5+ records) | - Synthetic doctors with: name, specialty, email<br>- At least 3 different lab types represented<br>- Emails used for demo testing | LOW |
| **D4** | Appointment history tracking | - All appointments stored with full details<br>- Queryable by patient, date, status<br>- History retained indefinitely (no auto-archive in v1) | LOW |
| **D5** | Basic audit logging | - `audit_log` table records: user_id, action, resource, timestamp, details<br>- Logs: booking created, booking cancelled, email sent, error occurred<br>- HIPAA-prep structure (not certified) | LOW |

---

### Category 4: OpenClaw Agent

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **A1** | OpenClaw Gateway running in Docker | - Node.js 22.12.0+ runtime<br>- OpenClaw 2026.2.26+ installed<br>- Gateway listening on port 18789<br>- Health check endpoint responding | MEDIUM |
| **A2** | Email parser skill | - Custom skill parses incoming doctor emails<br>- Extracts structured data from template<br>- Validates required fields (CURP format, date format)<br>- Returns error if parsing fails | MEDIUM |
| **A3** | Slot manager skill | - Custom skill checks `lab_capacity` table<br>- Returns available slots for given date<br>- Reserves slot atomically<br>- Handles "no availability" gracefully | MEDIUM |
| **A4** | Booking engine skill | - Custom skill coordinates booking flow<br>- Calls slot manager, creates appointment record, triggers confirmation email<br>- Atomic transaction (rollback on failure)<br>- Logs all actions to audit_log | HIGH |
| **A5** | Email sender skill | - Custom skill sends confirmation/error emails<br>- Uses email templates for consistency<br>- Tracks sent status in database | MEDIUM |
| **A6** | Lane-based command queue | - Email processing serialized per lane<br>- Prevents race conditions on slot booking<br>- Configured in OpenClaw gateway.yaml | MEDIUM |

---

### Category 5: Docker & Deployment

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **C1** | Dockerfile with security hardening | - Node.js 22 base image<br>- Non-root user (node)<br>- Read-only filesystem where possible<br>- Dropped capabilities (CAP_NET_BIND_SERVICE only)<br>- No unnecessary packages | MEDIUM |
| **C2** | docker-compose.yml configuration | - Service: `openclaw-gateway`<br>- Volume mounts: `~/.openclaw`, `./data/sqlite.db`<br>- Port mapping: 18789:18789<br>- Environment variables for OAuth tokens | MEDIUM |
| **C3** | Data persistence | - SQLite database persists across container restarts<br>- OpenClaw config (`openclaw.json`) persisted<br>- OAuth tokens persisted in volume | MEDIUM |
| **C4** | VPS deployment guide | - Step-by-step instructions for deploying to Hetzner/GCP/AWS<br>- Prerequisites: Docker, domain, SSL certificate<br>- Post-deployment checklist | LOW |
| **C5** | Build and launch scripts | - `docker compose build` produces working image<br>- `docker compose up -d openclaw-gateway` starts service<br>- Verification commands in README | LOW |

---

### Category 6: Security

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **S1** | Minimal OAuth scopes | - Only `gmail.readonly` and `gmail.send` requested<br>- No `gmail.modify` unless absolutely required<br>- Scopes documented in setup guide | LOW |
| **S2** | Dedicated service account | - Bot email: `lab-bot@yourdomain.com` (not personal Gmail)<br>- Separate Google Cloud project for OAuth<br>- Service account credentials secured | LOW |
| **S3** | Docker security hardening | - Container runs as non-root user<br>- Read-only root filesystem<br>- Dropped Linux capabilities<br>- No privileged mode | MEDIUM |
| **S4** | Rate limiting wrapper | - Bash wrapper script around gogcli calls<br>- Exponential backoff on 429 errors<br>- Max 3 retries before failing | MEDIUM |
| **S5** | Skill auditing | - All custom skills forked and audited before use<br>- NO skills installed from ClawHub (10.8% malicious)<br>- Skills reviewed for data exfiltration risks | LOW |

---

### Category 7: Error Handling

| ID | Requirement | Acceptance Criteria | Complexity |
|----|-------------|---------------------|------------|
| **H1** | Handle "slot full" errors | - When preferred slot is full, offer next available<br>- Error email sent if no slots available within 7 days<br>- Clear message: "Lab is fully booked until [date]" | LOW |
| **H2** | Handle invalid email format | - Error reply with template example<br>- Highlights missing/invalid fields<br>- Provides correct CURP/date format | LOW |
| **H3** | Handle database errors | - Graceful failure with error logging<br>- Retry logic for transient errors<br>- Alert on persistent failures | MEDIUM |
| **H4** | Handle OAuth token expiration | - Daily token refresh cron job<br>- Alert if refresh fails<br>- Fallback: manual token regeneration instructions | MEDIUM |
| **H5** | Handle Gmail API failures | - Retry with exponential backoff<br>- Queue emails for later delivery<br>- Log all failures for debugging | MEDIUM |

---

## v2 Requirements (Deferred)

**Definition:** Important features for post-POC development. Not needed for demo but should be tracked.

| ID | Requirement | Rationale for Deferral |
|----|-------------|------------------------|
| **V2-1** | Automated appointment reminders (24h before) | Adds scheduled job complexity; POC only needs booking flow |
| **V2-2** | Cancellation notifications | POC focuses on booking; cancellations are secondary workflow |
| **V2-3** | Patient portal for self-booking | POC uses doctor-mediated workflow; patient portal is future enhancement |
| **V2-4** | WhatsApp/SMS notifications | Email-only is sufficient for POC; WhatsApp adds API complexity |
| **V2-5** | Multi-location support | Single lab is sufficient for POC demo |
| **V2-6** | EHR/EMR integration | No real IMSS integration needed for POC |
| **V2-7** | HIPAA compliance certification | Using mock data; compliance not needed for demo |
| **V2-8** | Data retention policies | Auto-archive old records is operational concern, not POC |
| **V2-9** | Smart slot recommendations (AI-powered) | First-available is sufficient; AI optimization is differentiator |
| **V2-10** | Predictive no-show modeling | Advanced feature for production; not needed for POC |
| **V2-11** | Insurance verification | Out of scope for IMSS (public healthcare) |
| **V2-12** | Payment processing | Out of scope for IMSS (public healthcare) |
| **V2-13** | Multi-department scheduling (X-ray, consultations) | Lab-only is sufficient for POC |
| **V2-14** | Dynamic pricing / co-pay collection | Not applicable to IMSS model |
| **V2-15** | Voice call booking | Future accessibility feature; email is sufficient for POC |

---

## Out of Scope (Excluded)

**Definition:** Features deliberately not built. These are conscious exclusions, not deferred work.

| Exclusion | Rationale |
|-----------|-----------|
| **Patient self-booking portal** | Doctor-mediated workflow is core value prop; patient portal adds complexity without validating hypothesis |
| **Payment processing** | IMSS is public healthcare; no payments involved |
| **Full HIPAA certification** | Using mock data for demo; certification is expensive and unnecessary for POC |
| **Multi-clinic support** | Single lab validates the concept; multi-clinic is scaling concern |
| **Real IMSS system integration** | Mock data is sufficient for POC; real integration requires partnerships |
| **Complex scheduling rules** | Fixed slots (20/hour) validates booking flow; complexity can be added later |
| **WhatsApp notifications (for v1)** | Email-only validates communication channel; WhatsApp is enhancement |

---

## Requirements Summary

### v1 Scope (Active Hypotheses)

| Category | Requirements | Count |
|----------|--------------|-------|
| Email Communication | E1, E2, E3, E4, E5 | 5 |
| Appointment Booking | B1, B2, B3, B4, B5 | 5 |
| Data Management | D1, D2, D3, D4, D5 | 5 |
| OpenClaw Agent | A1, A2, A3, A4, A5, A6 | 6 |
| Docker & Deployment | C1, C2, C3, C4, C5 | 5 |
| Security | S1, S2, S3, S4, S5 | 5 |
| Error Handling | H1, H2, H3, H4, H5 | 5 |
| **Total v1** | | **36 requirements** |

### Complexity Distribution

| Complexity | Count | Percentage |
|------------|-------|------------|
| LOW | 16 | 44% |
| MEDIUM | 18 | 50% |
| HIGH | 2 | 6% |

**Estimated Effort:** 5-7 days (based on research)

---

## Acceptance Criteria for POC Success

The POC is considered successful when:

1. ✅ **End-to-end flow works:** Doctor emails → appointment booked → confirmation email sent
2. ✅ **No double-booking:** Concurrent requests don't result in overbooking
3. ✅ **Error handling works:** Invalid emails receive helpful error replies
4. ✅ **Docker container runs:** `docker compose up` starts working service
5. ✅ **Data persists:** Container restart doesn't lose appointments
6. ✅ **VPS deployment documented:** Step-by-step guide exists for deployment

---

## Traceability Matrix

| Requirement | Maps To PROJECT.md | Maps To Research |
|-------------|-------------------|------------------|
| E1-E5 (Email) | "Doctor can send email", "Patient receives confirmation" | FEATURES.md §2.2 |
| B1-B5 (Booking) | "Agent checks lab availability", "Agent books appointment slot" | FEATURES.md §2.1, ARCHITECTURE.md §4 |
| D1-D5 (Data) | "SQLite database stores appointments, doctors, labs" | STACK.md §2, ARCHITECTURE.md §5 |
| A1-A6 (OpenClaw) | "OpenClaw runs in Docker container" | ARCHITECTURE.md §3 |
| C1-C5 (Docker) | "Docker setup is deployable to VPS" | STACK.md §4, PITFALLS.md §6 |
| S1-S5 (Security) | Guardrails section | PITFALLS.md §1-4 |
| H1-H5 (Errors) | Error handling for failed email sends | PITFALLS.md §5, 11 |

---

## Notes

### Mock Data Approach

All patient and doctor data is synthetic for the POC:
- 50+ patients with realistic Mexican names (Pérez, García, Hernández, etc.)
- Valid CURP format (18 characters, checksum validated)
- 5+ doctors across different lab specialties
- No real personal information used

### Email Template (Doctor → System)

```
To: lab-appointments@imss-bot.gmail.com
Subject: Lab Appointment Request

Patient: [Full Name]
CURP: [18-character CURP]
Date of Birth: [YYYY-MM-DD or DD/MM/YYYY]
Lab Type: [Blood Work / X-Ray / Urinalysis / etc.]
Preferred Date: [YYYY-MM-DD]
Preferred Time: [HH:MM AM/PM]
Priority: [Routine / Urgent / STAT]
Notes: [Any special requirements, e.g., "Fasting required"]
```

### Technology Versions (from Research)

- Node.js: 22.12.0+ (LTS)
- OpenClaw: 2026.2.26+
- SQLite: 3.40+ with DELETE journal mode
- gogcli: v0.11.0
- Docker: 20.10+

---

*Last updated: March 23, 2026*
*Status: Ready for roadmap creation*
