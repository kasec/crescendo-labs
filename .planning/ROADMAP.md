# Roadmap: IMSS Lab Appointment Scheduling POC

**Version:** 1.0
**Date:** March 23, 2026
**Depth:** Quick (4 phases, 5-7 day timeline)
**Mode:** YOLO (auto-approve execution)

---

## Overview

This roadmap defines the **phased implementation plan** for the IMSS Lab Appointment Scheduling POC. Each phase maps to specific requirements from REQUIREMENTS.md and delivers observable, testable outcomes.

**Timeline:** 5-7 days (ASAP ship)
**Goal:** Working end-to-end demo: Doctor emails → appointment booked → confirmation sent

---

## Phase Structure

```
Phase 1: Foundation (Day 1-2)
  └─ OpenClaw + Gmail OAuth working locally

Phase 2: Database & Skills (Day 3-4)
  └─ SQLite schema + 3 core skills working

Phase 3: Integration (Day 5)
  └─ End-to-end booking flow working

Phase 4: Docker & Deployment (Day 6-7)
  └─ Production-ready container + VPS guide
```

---

## Phase 1: Foundation

**Duration:** Day 1-2
**Goal:** OpenClaw Gateway running locally with Gmail integration working

### Requirements Mapped

| Category | Requirements | Count |
|----------|--------------|-------|
| Email Communication | E1, E5 | 2 |
| Security | S1, S2, S4, S5 | 4 |
| OpenClaw Agent | A1 | 1 |
| **Total** | | **7 requirements** |

### Deliverables

1. **OpenClaw Gateway installed and running**
   - Node.js 22.12.0+ runtime configured
   - OpenClaw 2026.2.26+ installed
   - Gateway listening on port 18789
   - Health check endpoint responding

2. **Gmail OAuth configured**
   - Dedicated service account created (`lab-bot@yourdomain.com`)
   - Google Cloud project set up with OAuth credentials
   - Minimal scopes configured (`gmail.readonly`, `gmail.send`)
   - OAuth tokens stored and persisting

3. **gogcli v0.11 installed and tested**
   - Gmail CLI tool installed in environment
   - Can send test emails via `gog send`
   - Can read emails via `gog read`
   - Rate limiting wrapper script created

4. **Security baseline established**
   - Skill auditing policy documented
   - NO ClawHub skills installed (10.8% malicious risk)
   - Rate limiting wrapper with exponential backoff
   - Daily token refresh cron job configured

### Success Criteria (Observable Behaviors)

- [ ] `openclaw --version` returns 2026.2.26+
- [ ] Gateway health check responds at `http://localhost:18789/health`
- [ ] `gog auth status` shows valid OAuth tokens
- [ ] Test email sent successfully via `gog send`
- [ ] Test email read successfully via `gog read`
- [ ] Rate limiting wrapper script exists and handles 429 errors
- [ ] Token refresh cron job scheduled

### Research Flags

| Area | Confidence | Notes |
|------|------------|-------|
| OAuth setup | LOW | Standard patterns, well-documented |
| gogcli installation | LOW | Straightforward CLI install |
| OpenClaw setup | LOW | Official docs available |

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Google account suspension | MEDIUM | HIGH | Use dedicated service account, minimal scopes, exponential backoff |
| OAuth token expiration | MEDIUM | MEDIUM | Daily refresh cron job, manual regeneration instructions |
| Node.js version issues | LOW | HIGH | Use Node 22 LTS (not 24.x) |

---

## Phase 2: Database & Skills

**Duration:** Day 3-4
**Goal:** SQLite database with schema + 3 core OpenClaw skills working

### Requirements Mapped

| Category | Requirements | Count |
|----------|--------------|-------|
| Data Management | D1, D2, D3, D4, D5 | 5 |
| OpenClaw Agent | A2, A3, A6 | 3 |
| Appointment Booking | B1, B2 | 2 |
| **Total** | | **10 requirements** |

### Deliverables

1. **SQLite database schema created**
   - Tables: `patients`, `appointments`, `lab_capacity`, `audit_log`, `doctors`
   - DELETE journal mode (not WAL) for Docker safety
   - Foreign key constraints enabled
   - Indexes on frequently queried columns

2. **Mock data generated**
   - 50+ synthetic patients with realistic Mexican names
   - Valid CURP format (18 characters with checksum)
   - 5+ doctors across 3+ lab specialties
   - 7 days of lab capacity slots (20/hour, Mon-Fri 9-17)

3. **Email Parser Skill (A2)**
   - Parses incoming doctor emails using template format
   - Extracts: patient name, CURP, DOB, lab type, preferred date/time, priority, notes
   - Validates CURP format (regex + checksum)
   - Validates date format (YYYY-MM-DD or DD/MM/YYYY)
   - Returns structured data or error with helpful message

4. **Slot Manager Skill (A3)**
   - Queries `lab_capacity` table for availability
   - Returns available slots for given date
   - Reserves slot atomically (transaction)
   - Handles "no availability" gracefully
   - Respects fixed capacity (20/hour)

5. **Lane-based command queue (A6)**
   - Configured in OpenClaw gateway.yaml
   - Email processing serialized per lane
   - Prevents race conditions on slot booking

### Success Criteria (Observable Behaviors)

- [ ] SQLite database file exists at `./data/sqlite.db`
- [ ] All 5 tables created with correct schema
- [ ] `SELECT COUNT(*) FROM patients` returns 50+
- [ ] `SELECT COUNT(*) FROM doctors` returns 5+
- [ ] `SELECT COUNT(DISTINCT date) FROM lab_capacity` returns 7+
- [ ] Email Parser Skill correctly extracts data from test email
- [ ] Email Parser Skill rejects invalid CURP with error message
- [ ] Slot Manager returns available slots for test date
- [ ] Slot Manager prevents overbooking (atomic reservation)
- [ ] Lane-based queue configured in gateway.yaml

### Research Flags

| Area | Confidence | Notes |
|------|------------|-------|
| SQLite schema design | MEDIUM | Standard patterns, need to validate for appointment scheduling |
| Mock data generation | LOW | Straightforward script |
| OpenClaw skill development | MEDIUM | Follows official skill templates |

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite corruption in Docker | MEDIUM | HIGH | Use DELETE journal mode, serialized access |
| CURP validation complexity | LOW | LOW | Use regex + simplified checksum (not full RFC) |
| Skill loading failures | LOW | MEDIUM | Lazy loading, error handling in SKILL.md |

---

## Phase 3: Integration

**Duration:** Day 5
**Goal:** End-to-end booking flow working with error handling

### Requirements Mapped

| Category | Requirements | Count |
|----------|--------------|-------|
| Email Communication | E2, E3, E4 | 3 |
| Appointment Booking | B3, B4, B5 | 3 |
| OpenClaw Agent | A4, A5 | 2 |
| Error Handling | H1, H2, H3, H4, H5 | 5 |
| **Total** | | **13 requirements** |

### Deliverables

1. **Booking Engine Skill (A4)**
   - Coordinates full booking flow
   - Calls Email Parser → Slot Manager → creates appointment → triggers Email Sender
   - Atomic transaction (rollback on any failure)
   - Logs all actions to `audit_log` table
   - Returns success/failure status

2. **Email Sender Skill (A5)**
   - Sends confirmation emails on successful booking
   - Sends error emails on failed booking
   - Uses email templates for consistency
   - Tracks sent status in database
   - Includes: patient name, date/time, lab type, location

3. **End-to-end flow tested**
   - Test case 1: Valid email → booking confirmed → confirmation sent
   - Test case 2: Invalid CURP → error email sent
   - Test case 3: Slot full → next available offered
   - Test case 4: No slots in 7 days → error email sent
   - Test case 5: Gmail API 429 → retry with backoff

4. **Error handling implemented**
   - H1: Slot full errors handled with next-available fallback
   - H2: Invalid email format returns template example
   - H3: Database errors logged with retry logic
   - H4: OAuth token expiration handled with alert
   - H5: Gmail API failures queued for retry

### Success Criteria (Observable Behaviors)

- [ ] End-to-end test case 1 passes (happy path)
- [ ] End-to-end test case 2 passes (invalid CURP)
- [ ] End-to-end test case 3 passes (slot full)
- [ ] End-to-end test case 4 passes (no availability)
- [ ] End-to-end test case 5 passes (rate limit retry)
- [ ] Confirmation email received within 1 minute of booking
- [ ] Error email received with clear reason for failure
- [ ] `audit_log` table shows all actions for test bookings
- [ ] No double-booking under concurrent requests
- [ ] Booking Engine Skill rolls back on failure

### Research Flags

| Area | Confidence | Notes |
|------|------------|-------|
| End-to-end flow | LOW | Standard patterns from research |
| Error handling | LOW | Well-understood patterns |
| Email templates | LOW | Straightforward |

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Email parsing failures | MEDIUM | MEDIUM | Template-based parsing (not free-form NLP) for POC |
| Transaction deadlocks | LOW | MEDIUM | DELETE journal mode, serialized access |
| Gmail API rate limits | MEDIUM | MEDIUM | Exponential backoff, max 3 retries |

---

## Phase 4: Docker & Deployment

**Duration:** Day 6-7
**Goal:** Production-ready Docker container with VPS deployment guide

### Requirements Mapped

| Category | Requirements | Count |
|----------|--------------|-------|
| Docker & Deployment | C1, C2, C3, C4, C5 | 5 |
| Security | S3 | 1 |
| **Total** | | **6 requirements** |

### Deliverables

1. **Dockerfile with security hardening (C1)**
   - Node.js 22 base image
   - Non-root user (node)
   - Read-only filesystem where possible
   - Dropped capabilities (CAP_NET_BIND_SERVICE only)
   - No unnecessary packages
   - gogcli v0.11 baked in at build time

2. **docker-compose.yml (C2, C3)**
   - Service: `openclaw-gateway`
   - Volume mounts: `~/.openclaw`, `./data/sqlite.db`
   - Port mapping: 18789:18789
   - Environment variables for OAuth tokens
   - Data persists across container restarts

3. **Build and launch scripts (C5)**
   - `docker compose build` produces working image
   - `docker compose up -d openclaw-gateway` starts service
   - Verification commands documented
   - Health check script included

4. **VPS deployment guide (C4)**
   - Step-by-step instructions for Hetzner/GCP/AWS
   - Prerequisites: Docker, domain, SSL certificate
   - Post-deployment checklist
   - Troubleshooting section

5. **Docker security hardening (S3)**
   - Container runs as non-root user
   - Read-only root filesystem
   - Dropped Linux capabilities
   - No privileged mode
   - Security scan passes (no critical vulnerabilities)

### Success Criteria (Observable Behaviors)

- [ ] `docker compose build` completes without errors
- [ ] `docker compose up -d` starts container successfully
- [ ] Container health check passes
- [ ] End-to-end booking flow works inside container
- [ ] Data persists after `docker compose down` + `docker compose up`
- [ ] `docker exec` shows non-root user
- [ ] Security scan shows no critical vulnerabilities
- [ ] VPS deployment guide exists and is complete
- [ ] Deployment tested on local Docker (VPS simulation)

### Research Flags

| Area | Confidence | Notes |
|------|------------|-------|
| Docker security hardening | MEDIUM | Security flags need careful configuration |
| VPS deployment | LOW | Standard patterns, well-documented |

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Docker volume permissions | MEDIUM | MEDIUM | Pre-create directories with correct ownership |
| Port conflicts (18789) | LOW | LOW | Check before starting, configurable port |
| Binary installation at runtime | HIGH | HIGH | Bake all binaries at build time (lost on restart otherwise) |

---

## Requirement Coverage Summary

| Phase | Requirements | Count | Cumulative |
|-------|--------------|-------|------------|
| Phase 1 | E1, E5, S1, S2, S4, S5, A1 | 7 | 7 |
| Phase 2 | D1, D2, D3, D4, D5, A2, A3, A6, B1, B2 | 10 | 17 |
| Phase 3 | E2, E3, E4, B3, B4, B5, A4, A5, H1, H2, H3, H4, H5 | 13 | 30 |
| Phase 4 | C1, C2, C3, C4, C5, S3 | 6 | 36 |
| **Total** | | **36** | **100% coverage** |

**All v1 requirements mapped to phases — no orphans.**

---

## Critical Path

```
Day 1-2: Phase 1 (Foundation)
    │
    ▼
Day 3-4: Phase 2 (Database & Skills)
    │
    ▼
Day 5:   Phase 3 (Integration)
    │
    ▼
Day 6-7: Phase 4 (Docker & Deployment)
    │
    ▼
         POC Demo Ready
```

**Phase dependencies:**
- Phase 2 requires Phase 1 (skills need OpenClaw running)
- Phase 3 requires Phase 2 (booking flow needs skills + database)
- Phase 4 requires Phase 3 (containerize working system)

---

## Success Metrics

### POC Success Criteria (from REQUIREMENTS.md)

The POC is considered successful when:

1. ✅ **End-to-end flow works:** Doctor emails → appointment booked → confirmation email sent
2. ✅ **No double-booking:** Concurrent requests don't result in overbooking
3. ✅ **Error handling works:** Invalid emails receive helpful error replies
4. ✅ **Docker container runs:** `docker compose up` starts working service
5. ✅ **Data persists:** Container restart doesn't lose appointments
6. ✅ **VPS deployment documented:** Step-by-step guide exists for deployment

### Phase Completion Criteria

| Phase | Definition of Done |
|-------|-------------------|
| Phase 1 | All 7 success criteria checked |
| Phase 2 | All 10 success criteria checked |
| Phase 3 | All 10 success criteria checked |
| Phase 4 | All 9 success criteria checked |

---

## Notes

### Timeline Assumptions

- **5-7 days** assumes focused work (6-8 hours/day)
- **ASAP ship** means minimal polish, working functionality only
- Buffer time included for debugging OAuth/Docker issues

### Out of Scope (v2+)

The following are explicitly **not** in this roadmap:
- Automated appointment reminders (V2-1)
- Patient portal for self-booking (V2-3)
- WhatsApp/SMS notifications (V2-4)
- Multi-location support (V2-5)
- Smart slot recommendations (V2-9)

See REQUIREMENTS.md for full v2 and out-of-scope lists.

### Technology Versions

- Node.js: 22.12.0+ (LTS)
- OpenClaw: 2026.2.26+
- SQLite: 3.40+ with DELETE journal mode
- gogcli: v0.11.0
- Docker: 20.10+

---

*Last updated: March 23, 2026*
*Status: Ready for phase planning*
