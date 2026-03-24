# Research Summary: IMSS Lab Appointment Scheduling POC

**Research Date:** March 23, 2026
**Domain:** Healthcare Appointment Scheduling with OpenClaw
**Confidence:** HIGH

---

## Executive Summary

This research defines the **standard 2026 stack and architecture** for building an email-based lab appointment scheduling system using OpenClaw. The system allows doctors to email appointment requests, which are automatically processed to book fixed lab slots (20/hour capacity) and send confirmation emails to patients.

### Key Findings at a Glance

| Dimension | Recommendation | Confidence |
|-----------|---------------|------------|
| **Stack** | Node.js 22 + OpenClaw 2026.2.26+ + SQLite + gogcli v0.11 | HIGH |
| **Architecture** | Skill-based OpenClaw agent with 3 layers (Communication → Agent → Data) | HIGH |
| **Critical Pitfall** | Google account suspension from bot-like polling (10.8% malicious skills risk) | HIGH |
| **POC Scope** | Email ingestion → slot booking → confirmation (5-day build) | HIGH |

---

## 1. Stack Recommendations

### Core Runtime
- **Node.js 22.12.0+ (LTS)** — Hard requirement for OpenClaw Gateway. Node 24 causes memory sync failures.
- **OpenClaw 2026.2.26+** — Latest stable with security patches.
- **SQLite 3.40+ with sqlite-vec** — Zero-config, embedded, perfect for single-instance POC.
- **gogcli v0.11.0** — Gmail CLI tool (preferred over Himalaya due to OAuth stability).
- **Docker 20.10+** — With security hardening (non-root user, read-only filesystem, dropped capabilities).

### What NOT to Use
- ❌ Node.js 24.x — Memory sync failures
- ❌ PostgreSQL/MySQL — Overkill for POC
- ❌ Himalaya CLI — OAuth breaks headless
- ❌ Primary Gmail account — Use dedicated bot account
- ❌ Running Docker as root — Critical security risk

**Full details:** [`STACK.md`](./STACK.md)

---

## 2. Feature Categorization

### POC Essentials (In Scope)
1. **Email ingestion** via Gmail API + gogcli
2. **Slot booking** with 20/hour capacity enforcement
3. **Confirmation emails** back to doctors
4. **Mock patient data** (50+ synthetic records)
5. **Basic audit logging**

### Table Stakes (Phase 2+)
- Real-time slot availability with double-booking prevention
- Patient portal for self-service
- Multi-location support
- EHR/EMR integration
- HIPAA compliance certification

### Differentiators (Future)
- AI-powered email parsing (OpenClaw NLP)
- WhatsApp/SMS reminders (higher engagement in Mexico)
- Predictive no-show modeling
- Dynamic pricing/co-pay collection

### Anti-Features (Deliberately Excluded)
- Patient self-booking portal (doctor-mediated workflow)
- Payment processing (IMSS is public healthcare)
- Full HIPAA certification (using mock data for demo)
- Multi-clinic support (single lab for POC)

**Full details:** [`FEATURES.md`](./FEATURES.md)

---

## 3. Architecture Overview

### 3-Layer Structure

```
┌─────────────────────────────────────────┐
│     COMMUNICATION LAYER (Gmail API)     │
│     Doctor Email ←→ Patient Email       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     OPENCLAW AGENT LAYER                │
│     Gateway → Session Manager → Skills  │
│     (Email Parser, Slot Manager,        │
│      Booking Engine, Email Sender)      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     DATA LAYER (SQLite)                 │
│     patients, appointments,             │
│     lab_capacity, audit_log             │
└─────────────────────────────────────────┘
```

### Key Components
1. **OpenClaw Gateway** — Central nervous system, multi-channel communication
2. **Gmail Adapter (gogcli)** — Bidirectional email processing
3. **Session Manager** — Maintains conversation context
4. **Command Queue (Lane-based FIFO)** — Prevents race conditions
5. **Skill Loader (Lazy)** — Loads skills on-demand
6. **Custom Skills** — Email Parser, Slot Manager, Booking Engine, Email Sender, Audit Logger

### Build Order (4 Phases)
- **Phase 1 (Day 1-2):** Foundation — Node.js, OpenClaw, Google Cloud, gogcli
- **Phase 2 (Day 3-4):** Database & Skills — Schema, mock data, 3 custom skills
- **Phase 3 (Day 5):** Integration & Testing — End-to-end flow, error handling
- **Phase 4 (Day 6-7):** Docker & Deployment — Containerization, security hardening

**Full details:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 4. Critical Pitfalls

### Critical (Show-Stoppers)
1. **Google Account Suspension** — Bot-like polling triggers fraud detection. Use dedicated service account + minimal OAuth scopes + exponential backoff.
2. **SQLite Database Corruption in Docker** — WAL mode + concurrent access = data loss. Use DELETE journal mode + serialized access.
3. **Prompt Injection via Malicious Emails** — 10.8% of ClawHub skills are malicious. NEVER install skills from ClawHub. Audit all skills.
4. **OAuth Token Expiration** — Silent failures after 60 minutes. Implement daily token refresh cron job.

### High (Major Delays)
5. **Gmail API Rate Limiting** — 429 errors from aggressive polling. Use exponential backoff wrapper.
6. **Docker Volume Permission Errors** — EACCES errors from wrong ownership. Pre-create directories with correct ownership.
7. **Double-Booking Race Conditions** — Parallel email processing conflicts. Use lane-based command queue.
8. **OpenClaw Skill Injection Attacks** — Malicious skills exfiltrate data. Fork + audit before installing.

### Medium (Fixable Friction)
9. **Node.js Version Incompatibility** — Node 24 causes memory sync failures. Use Node 22 LTS.
10. **YAML Configuration Syntax Errors** — Tabs vs spaces, missing colons. Use YAML linting.
11. **Email Parsing Failures** — NLP edge cases, ambiguous dates. Use template-based parsing for POC.
12. **Gateway Port Conflicts** — Port 18789 already in use. Check before starting.

**Full details:** [`PITFALLS.md`](./PITFALLS.md)

---

## 5. Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Day 1-2)
**Goal:** OpenClaw running locally with Gmail integration

- **Addresses:** Email ingestion, OAuth setup, gogcli installation
- **Avoids:** Google account suspension (Pitfall #1), OAuth expiration (Pitfall #4)
- **Uses:** Node.js 22, OpenClaw 2026.2.26+, gogcli v0.11
- **Deliverables:**
  - OpenClaw Gateway running locally
  - Gmail OAuth configured with minimal scopes
  - Test: Can send/receive emails via gogcli

### Phase 2: Database & Core Skills (Day 3-4)
**Goal:** SQLite database with schema + 3 core skills

- **Addresses:** Slot booking, capacity management, audit logging
- **Avoids:** SQLite corruption (Pitfall #2), race conditions (Pitfall #7)
- **Uses:** SQLite 3.40+ with DELETE journal mode, lane-based command queue
- **Deliverables:**
  - Database schema (patients, appointments, lab_capacity, audit_log)
  - Mock data generator (50+ patients, 7 days of slots)
  - Skills: `email-parser`, `slot-manager`, `booking-engine`

### Phase 3: Integration & Testing (Day 5)
**Goal:** End-to-end booking flow working

- **Addresses:** Email → booking → confirmation flow
- **Avoids:** Email parsing failures (Pitfall #11), prompt injection (Pitfall #3)
- **Uses:** Template-based email parsing, skill auditing
- **Deliverables:**
  - End-to-end test: Doctor emails → appointment booked → confirmation sent
  - Error handling for edge cases
  - Test suite with 10+ scenarios

### Phase 4: Docker & Deployment Prep (Day 6-7)
**Goal:** Production-ready Docker container

- **Addresses:** Docker security, volume persistence, port conflicts
- **Avoids:** Permission errors (Pitfall #6), port conflicts (Pitfall #12), running as root
- **Uses:** Docker 20.10+ with security hardening, pre-created volumes
- **Deliverables:**
  - Dockerfile with security flags (non-root, read-only, dropped capabilities)
  - docker-compose.yml with volume mounts
  - Deployment guide for VPS migration

---

### Phase Ordering Rationale

1. **Foundation first** — Gmail OAuth must be correct from day 1 to avoid account suspension. Can't build anything without working email.

2. **Database before skills** — Skills depend on database schema. Mock data enables testing without real patients.

3. **Integration before Docker** — Get end-to-end flow working locally before containerizing. Easier to debug.

4. **Docker last** — Once flow works, containerize with security hardening. Easy to deploy to VPS.

---

### Research Flags for Phases

| Phase | Research Needed? | Reason |
|-------|-----------------|--------|
| Phase 1 | **LOW** — Standard patterns | OAuth setup well-documented, gogcli straightforward |
| Phase 2 | **MEDIUM** — Schema design | Need to validate SQLite schema for appointment scheduling |
| Phase 3 | **LOW** — Standard patterns | Email parsing + booking logic is straightforward |
| Phase 4 | **MEDIUM** — Security hardening | Docker security flags need careful configuration |

---

## 6. Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack choices** | HIGH | Based on OpenClaw 2026 documentation, production deployments |
| **Architecture patterns** | HIGH | Skill-based agent is OpenClaw 2026 best practice |
| **Pitfall severity** | HIGH | Based on security reports (10.8% malicious skills), real incidents |
| **Timeline estimates** | MEDIUM | 5-7 days assumes focused work, no major blockers |
| **Feature scope** | HIGH | POC scope is realistic, deliberately limited |

---

## 7. Key Metrics from Research

### Performance Targets
- **Email processing:** < 30 seconds from receipt to booking
- **Slot booking:** < 5 seconds database transaction
- **Confirmation delivery:** < 1 minute after booking
- **Token refresh:** Daily cron job, silent failures prevented

### Security Metrics
- **OAuth scopes:** Minimum required (gmail.readonly + gmail.send)
- **Docker security:** Non-root user, read-only filesystem, dropped capabilities
- **Skill auditing:** 100% of skills forked + audited before use
- **Rate limiting:** Exponential backoff, max 3 retries

### Cost Estimates
- **POC (local):** $0 (free tier Gmail API, local development)
- **VPS deployment:** $10-30/month (Hetzner/GCP ARM instance)
- **Production:** $87-137/month (multi-instance, monitoring, backups)

---

## 8. Next Steps

Research complete. Recommended next action:

**`/gsd:define-requirements`** — Translate research findings into concrete requirements with acceptance criteria.

This will produce `REQUIREMENTS.md` with:
- Validated requirements (inferred from research)
- Active requirements (hypotheses to validate)
- Out of scope items (from FEATURES.md anti-features)
- Acceptance criteria for each requirement

---

*Research completed: March 23, 2026*
*Files: SUMMARY.md, STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
