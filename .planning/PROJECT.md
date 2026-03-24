# IMSS Lab Appointment Scheduling - OpenClaw POC

## One-Liner

Email-based lab appointment scheduling agent for IMSS clinics using OpenClaw in Docker.

## Context

### Problem

Mexican healthcare system (IMSS) requires patients to navigate inefficient bureaucratic processes for scheduling medical appointments, particularly lab tests. The current flow involves multiple in-person visits and waiting in lines.

### Solution

An OpenClaw agent that allows doctors to schedule lab appointments via email, automatically checks lab availability (fixed slots), and sends confirmation emails to patients when appointments are booked.

### Motivation

Before attempting to solve complex problems at scale, we need to prove the concept works with a simple, pragmatic local solution. This POC demonstrates the core value proposition without building a "second floor when the first floor operates inefficiently."

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] OpenClaw runs in Docker container locally
- [ ] Doctor can send email to request lab appointment
- [ ] Agent checks lab availability (fixed slots: 20 people/hour)
- [ ] Agent books appointment slot
- [ ] Patient receives email confirmation when appointment is booked
- [ ] SQLite database stores appointments, doctors, labs
- [ ] Docker setup is deployable to VPS

### Out of Scope

- Patient-facing booking interface — WhatsApp/email only for notifications
- Real IMSS integration — mock data for POC
- Multiple departments — lab appointments only for POC
- SMS/WhatsApp notifications — email only for POC
- Complex scheduling rules — fixed slots only

## Architecture

### Components

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Doctor    │────▶│  OpenClaw Agent  │────▶│   SQLite    │
│   (Email)   │     │   (Docker)       │     │  Database   │
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Patient   │
                    │   (Email)   │
                    └─────────────┘
```

### OpenClaw Domain

**Database Tables:**
- `Doctors` — doctor info, email
- `Labs` — lab info, fixed slot capacity
- `Appointments` — scheduled appointments with status
- `Patients` — patient info, email

**Communication Channel:**
- Gmail API for bidirectional email
  - Doctor sends appointment request
  - Agent processes and books slot
  - Patient receives confirmation

**Business Rules:**
- Lab capacity: 20 people per hour
- Operating hours: Mon-Fri 9-5 (configurable)
- No patient interaction required for booking
- Doctor makes all scheduling decisions

### Docker Structure

```
crescendo-labs/
├── docker-compose.yml
├── Dockerfile
├── openclaw/
│   └── (OpenClaw source or mounted volume)
├── data/
│   └── sqlite.db (persisted)
└── .openclaw/ (config, skills, workspace)
```

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Docker-first deployment | Must be deployable to VPS later | Container runs locally, migrates easily |
| SQLite database | Simple, file-based, good for POC | No external DB dependency |
| Email-only channels | Fastest path to working demo | Gmail API (user has credentials) |
| Fixed slot scheduling | Reduces complexity for POC | 20 people/hour, configurable hours |
| Mock data | No IMSS integration needed | Realistic test scenarios |
| Doctor email interface | Matches existing workflow | No new UI to build |

## Metrics

### Efficiency Targets

- Token optimization: TBD (measure after first implementation)
- Response time: < 30 seconds for appointment booking
- Email delivery: < 1 minute confirmation delay

### Guardrails

- Rate limiting on email processing
- Appointment validation before booking
- Error handling for failed email sends

## Out of Scope (Future Versions)

- WhatsApp notifications
- Patient self-booking interface
- Multiple lab departments (X-ray, consultations)
- Real IMSS system integration
- fail2ban-style security for unauthorized access

## Success Criteria

1. **Working end-to-end flow** — Doctor emails → appointment booked → patient receives confirmation
2. **Solid infrastructure** — Clean Docker setup with compose
3. **Deployable** — Can move to VPS with minimal changes

---

*Last updated: March 23, 2026 after initialization*
