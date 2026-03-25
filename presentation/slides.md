---
theme: default
highlighter: shiki
colorSchema: light
title: CRESCENDO LABS - OpenClaw AI Tinkerers
aspectRatio: 16/9
---

# CRESCENDO LABS - AI Tinkerers

## HealthTech • IMSS Lab Appointment Scheduling

---

## Problem & Solution

**Problem:** Mexican citizens face inefficient bureaucratic processes when scheduling medical appointments at IMSS - multiple visits, long queues, forgotten appointments.

**Solution:** OpenClaw-powered automation that connects doctors, labs, and patients via existing communication channels (WhatsApp/Email) with automated scheduling and progressive reminders.

---

## Architecture

### OpenClaw Domain

```yaml
Database Tables:
  - Patients
  - Doctors
  - Laboratories
  - Appointments

Communication Channels:
  - Gmail (Primary)
  - WhatsApp (Future)
  - SMS Notifications (Future)
```

### Key Components

- **State Management:** SQLite persistence for appointments and patient data
- **Tool Calling:** Gmail API integration for calendar coordination
- **Reasoning Cycles:** Business rules for slot availability (e.g., "Lab: 20 patients/hour")

---

## Proposed Flow

1. **Doctor Visit** → Patient sees general practitioner
2. **Email Trigger** → Doctor sends request to specific lab section
3. **OpenClaw Processing** → Checks calendar availability + business rules
4. **Collaborative Scheduling** → Doctor & patient select best time slot
5. **Multi-Channel Notification** → WhatsApp + Email confirmation
6. **Progressive Reminders** → 1 week, 1 day, 1 hour before appointment

> **Accessibility First:** Leverages WhatsApp (already installed on every Mexican/Latino phone) - no new app required

---

## Key Metrics & Guardrails

### Token Efficiency
- Minimal context windows for appointment queries
- Structured data extraction from emails
- Caching for repeated calendar lookups

### Security Guardrails
- **fail2ban-like mechanism:** Ban users attempting channel abuse
- **Docker Security:** Non-root user, dropped capabilities, no-new-privileges
- **OAuth2:** Secure Gmail API authentication
- **Rate Limiting:** Prevents calendar slot flooding

### Impact Metrics
- Reduced patient visits: 4 → 1
- Appointment forgetfulness: Mitigated via automated reminders
- Queue time reduction: Eliminated re-queuing for scheduling

---

## Team & Tech Stack

**Vertical:** HealthTech

**Technology:**
- OpenClaw Framework
- Node.js + Docker
- SQLite Database
- Gmail API
- WhatsApp Business API (planned)

**Repository:** github.com/crescendo-labs

---

## Demo

<!-- You can embed a video or screenshot here -->

**1-Minute Demo:** [Loom/YouTube Link]

*Agent executing appointment scheduling workflow end-to-end*

---

# Thank You

## Questions?

**GitHub:** github.com/crescendo-labs  
**Vertical:** HealthTech  
**Focus:** Bureaucracy • Government • Healthcare Accessibility
