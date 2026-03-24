# Features: Healthcare Appointment Scheduling System

**Research Date:** March 23, 2026
**Project:** IMSS Lab Appointment Scheduling POC
**Context:** Email-based medical appointment booking for Mexican healthcare system
**Target:** Greenfield POC → Demo

---

## Executive Summary

This document categorizes features for an **email-based healthcare appointment scheduling system** where doctors email requests to book lab slots for patients. The system processes these emails, books fixed slots (20/hour capacity), and sends confirmations back.

**Key Insight:** For a POC demo, focus on the **core booking loop** (email → parse → book → confirm) while deliberately excluding patient-facing interfaces, payment processing, and complex integrations that add complexity without demonstrating the core value proposition.

---

## 1. Feature Categories Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    POC SCOPE (This Build)                    │
├─────────────────────────────────────────────────────────────┤
│  Email ingestion → Slot booking → Confirmation email        │
│  Fixed capacity management (20/hour)                         │
│  Basic audit logging                                        │
│  Mock patient/doctor data                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  TABLE STAKES (Phase 2+)                     │
├─────────────────────────────────────────────────────────────┤
│  Real patient portal                                        │
│  Multi-location support                                     │
│  Insurance verification                                     │
│  EHR/EMR integration                                        │
│  HIPAA compliance certification                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 DIFFERENTIATORS (Future)                     │
├─────────────────────────────────────────────────────────────┤
│  AI-powered slot optimization                               │
│  Predictive no-show modeling                                │
│  Voice/WhatsApp booking                                     │
│  Dynamic pricing/co-pay collection                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Table Stakes Features

**Definition:** Features users expect in ANY appointment scheduling system. Without these, the system feels broken or unprofessional.

### 2.1 Core Booking Functionality

| Feature | Complexity | POC Status | Notes |
|---------|------------|------------|-------|
| **Real-time slot availability** | LOW | ✅ IN SCOPE | Track 20 slots/hour capacity in SQLite |
| **Prevent double-booking** | LOW | ✅ IN SCOPE | Database constraints + transaction locking |
| **Fixed slot duration** | LOW | ✅ IN SCOPE | 15-minute default slots (4 per hour × 5 labs = 20/hour) |
| **Basic capacity management** | LOW | ✅ IN SCOPE | `lab_capacity` table with date/hour/max/booked |

**Dependencies:**
- Requires SQLite database with proper schema
- Requires atomic booking operations (transactions)

---

### 2.2 Communication & Notifications

| Feature | Complexity | POC Status | Notes |
|---------|------------|------------|-------|
| **Booking confirmation** | MEDIUM | ✅ IN SCOPE | Email sent to doctor after successful booking |
| **Email-based request intake** | MEDIUM | ✅ IN SCOPE | Gmail API + gogcli for reading doctor emails |
| **Automated reminders** | MEDIUM | ⏸️ FUTURE | Send reminders 24h before appointment (Phase 2) |
| **Cancellation notifications** | LOW | ⏸️ FUTURE | Notify doctor if slot cancelled (Phase 2) |

**Dependencies:**
- Requires Gmail API OAuth setup
- Requires email parsing logic (NLP or template-based)
- Reminder system requires scheduled job runner

---

### 2.3 Data Management

| Feature | Complexity | POC Status | Notes |
|---------|------------|------------|-------|
| **Patient records (basic)** | LOW | ✅ IN SCOPE | Mock data: name, CURP, DOB, contact info |
| **Appointment history** | LOW | ✅ IN SCOPE | Track all bookings with status (scheduled/completed/cancelled) |
| **Audit logging (basic)** | LOW | ✅ IN SCOPE | Log who booked what and when (HIPAA prep) |
| **Data retention policies** | MEDIUM | ⏸️ FUTURE | Auto-archive old records (Phase 2, compliance) |

**Dependencies:**
- SQLite schema for `patients`, `appointments`, `audit_log` tables
- Mock data generation script for demo

---

### 2.4 User Experience (Doctor-Facing)

| Feature | Complexity | POC Status | Notes |
|---------|------------|------------|-------|
| **Simple email template** | LOW | ✅ IN SCOPE | Provide doctors with email format example |
| **Clear confirmation details** | LOW | ✅ IN SCOPE | Include: patient name, date/time, lab type, location |
| **Error handling** | MEDIUM | ✅ IN SCOPE | Reply with error if booking fails (slot full, invalid data) |

**Example Email Template (Doctor → System):**
```
To: lab-appointments@imss-bot.gmail.com
Subject: Lab Appointment Request

Patient: Juan Pérez García
CURP: PEGJ850315HDFRRN09
Date of Birth: March 15, 1985
Lab Type: Blood Work (Chemistry Panel)
Preferred Date: March 25, 2026
Preferred Time: 10:00 AM - 12:00 PM
Priority: Routine
Notes: Fasting required
```

---

## 3. Differentiating Features

**Definition:** Features that provide competitive advantage or demonstrate technical sophistication. These are **NOT** needed for POC but should be noted for future positioning.

### 3.1 AI-Powered Capabilities

| Feature | Complexity | POC Status | Strategic Value |
|---------|------------|------------|-----------------|
| **Natural language email parsing** | HIGH | ⚠️ PARTIAL | OpenClaw can parse free-form emails vs. rigid templates |
| **Intelligent slot recommendations** | HIGH | ⏸️ FUTURE | Suggest optimal slots based on urgency, patient history |
| **Predictive no-show modeling** | HIGH | ⏸️ FUTURE | Flag high-risk appointments for overbooking strategy |
| **Automatic rescheduling** | HIGH | ⏸️ FUTURE | Detect conflicts and propose alternatives proactively |

**POC Approach:** Use OpenClaw's built-in NLP for email parsing (demonstrates AI capability) but keep slot assignment simple (first available).

---

### 3.2 Multi-Channel Communication

| Feature | Complexity | POC Status | Strategic Value |
|---------|------------|------------|-----------------|
| **WhatsApp Business API** | MEDIUM | ⏸️ FUTURE | Patient preference in Mexico; higher engagement than email |
| **SMS reminders** | LOW | ⏸️ FUTURE | Better open rates (97%) vs. email (20%) |
| **Voice call booking** | HIGH | ⏸️ FUTURE | Serve patients without smartphone/internet access |
| **Telegram bot** | MEDIUM | ⏸️ FUTURE | Alternative channel for tech-savvy users |

**POC Approach:** Email-only for both doctor intake and patient confirmation. Document WhatsApp/SMS as Phase 2 enhancements.

---

### 3.3 Advanced Scheduling Logic

| Feature | Complexity | POC Status | Strategic Value |
|---------|------------|------------|-----------------|
| **Multi-location scheduling** | MEDIUM | ⏸️ FUTURE | Scale to multiple IMSS clinics |
| **Provider-specific slots** | MEDIUM | ⏸️ FUTURE | Book with specific lab technicians |
| **Service-type routing** | MEDIUM | ⏸️ FUTURE | X-ray vs. blood work vs. ultrasound → different labs |
| **Urgency-based prioritization** | HIGH | ⏸️ FUTURE | Emergency cases bump routine appointments |
| **Waitlist management** | MEDIUM | ⏸️ FUTURE | Auto-book cancelled slots for waitlisted patients |

**POC Approach:** Single lab location, single service type ("Lab Work"), first-come-first-served booking.

---

### 3.4 Integration Capabilities

| Feature | Complexity | POC Status | Strategic Value |
|---------|------------|------------|-----------------|
| **EHR/EMR integration** | HIGH | ⏸️ FUTURE | Pull patient data directly from medical records |
| **Insurance verification** | HIGH | ⏸️ FUTURE | Real-time eligibility checks |
| **Calendar sync (provider)** | MEDIUM | ⏸️ FUTURE | Block lab slots when technicians are unavailable |
| **Billing system integration** | HIGH | ⏸️ FUTURE | Auto-generate invoices, collect co-pays |

**POC Approach:** Standalone system with mock data. No external integrations beyond Gmail API.

---

## 4. Anti-Features (Deliberately Excluded)

**Definition:** Features we are **explicitly choosing NOT to build** for this POC. These are not oversights—they are intentional scope exclusions to maintain focus.

### 4.1 Patient-Facing Booking Interface

| Excluded Feature | Rationale | Alternative |
|------------------|-----------|-------------|
| **Patient self-booking portal** | POC validates doctor-mediated workflow; patient portal adds UI complexity | Doctor emails on behalf of patient |
| **Mobile app for patients** | Overkill for demo; email confirmations sufficient | Email with mobile-friendly formatting |
| **Patient login/authentication** | Adds security/compliance burden without POC value | No patient authentication in POC |

**Decision:** This is a **doctor-initiated booking system**, not a patient self-service platform. Valid for POC because it mirrors current IMSS workflow (doctor coordinates lab work).

---

### 4.2 Payment Processing

| Excluded Feature | Rationale | Alternative |
|------------------|-----------|-------------|
| **Credit card processing** | IMSS is public healthcare; no per-appointment payments | Mock billing data only |
| **Co-pay collection** | Adds PCI compliance complexity | Exclude from POC |
| **Deposit/cancellation fees** | Not applicable to public healthcare model | Exclude from POC |
| **Insurance billing** | Requires external integrations | Mock data only |

**Decision:** Payment processing is **out of scope** for this POC. IMSS provides free/low-cost services to enrolled patients.

---

### 4.3 Complex Compliance Features

| Excluded Feature | Rationale | Alternative |
|------------------|-----------|-------------|
| **Full HIPAA compliance certification** | Overkill for mock data demo | Basic audit logging only |
| **BAA (Business Associate Agreement)** | Requires legal review, vendor contracts | Use mock/synthetic patient data |
| **Data encryption at rest** | Adds operational complexity | SQLite file permissions only |
| **Consent management** | Requires legal workflows | Exclude from POC |

**Decision:** POC uses **mock patient data** (synthetic CURP, names, etc.). Real deployment would require full compliance review.

---

### 4.4 Advanced Operational Features

| Excluded Feature | Rationale | Alternative |
|------------------|-----------|-------------|
| **Multi-clinic support** | POC validates single-lab workflow | Hardcode single lab location |
| **Staff scheduling/shift management** | Adds HR system complexity | Fixed lab hours (9 AM - 5 PM) |
| **Resource allocation (equipment)** | Over-optimization for demo | Assume unlimited lab equipment |
| **Reporting/analytics dashboards** | Nice-to-have, not core value | Simple SQLite queries for demo metrics |

**Decision:** Keep operational model **deliberately simple** to validate core booking loop.

---

## 5. POC Essentials vs. Future Enhancements

### 5.1 POC Essentials (Must Have for Demo)

| Feature | Why It's Essential | Success Metric |
|---------|-------------------|----------------|
| **Email ingestion** | Core input mechanism | Doctor email → parsed within 30 seconds |
| **Slot booking** | Core value proposition | 20 slots/hour capacity enforced |
| **Confirmation email** | Closes the loop | Patient receives booking confirmation |
| **Mock patient data** | Enables demo without compliance burden | 50+ synthetic patient records |
| **Basic error handling** | System feels reliable | Clear error messages for failed bookings |
| **Audit logging** | Demonstrates compliance awareness | All actions logged to `audit_log` table |

**Minimum Viable Demo Flow:**
```
1. Doctor sends email with patient details
2. System parses email (OpenClaw NLP)
3. System finds next available slot (SQLite query)
4. System books slot (atomic transaction)
5. System sends confirmation email to doctor
6. System logs action to audit_log
```

---

### 5.2 Future Enhancements (Phase 2+)

| Feature | Priority | Estimated Effort | Dependencies |
|---------|----------|------------------|--------------|
| **Automated reminders (24h before)** | HIGH | 2-3 days | Scheduled job runner, SMS/WhatsApp integration |
| **Rescheduling workflow** | HIGH | 3-5 days | Email parsing for reschedule requests, slot release logic |
| **Cancellation handling** | MEDIUM | 1-2 days | Slot release, waitlist notification |
| **Multi-lab support** | MEDIUM | 3-5 days | Lab location schema, routing logic |
| **WhatsApp confirmations** | MEDIUM | 3-5 days | Twilio WhatsApp Business API setup |
| **Provider calendar sync** | LOW | 2-3 days | Google Calendar API integration |
| **Basic reporting dashboard** | LOW | 3-5 days | Grafana or simple web UI |

---

### 5.3 Future Enhancements (Phase 3 - Production)

| Feature | Priority | Estimated Effort | Business Case |
|---------|----------|------------------|---------------|
| **EHR integration** | HIGH | 2-4 weeks | Eliminate manual data entry, reduce errors |
| **Insurance verification** | HIGH | 2-3 weeks | Real-time eligibility, reduce claim denials |
| **Multi-clinic deployment** | HIGH | 3-6 weeks | Scale to full IMSS network |
| **HIPAA compliance certification** | CRITICAL | 4-8 weeks | Required for production use with real PHI |
| **Predictive no-show modeling** | MEDIUM | 2-3 weeks | Optimize overbooking strategy |
| **Voice/phone booking** | LOW | 2-4 weeks | Serve patients without internet access |

---

## 6. Feature Dependencies

### 6.1 Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    POC FEATURE DEPENDENCIES                  │
└─────────────────────────────────────────────────────────────┘

Email Ingestion (Gmail API + gogcli)
    │
    ├──→ OAuth Setup (Google Cloud Project)
    │       └──→ Requires: Dedicated bot Gmail account
    │
    └──→ Email Parsing (OpenClaw NLP)
            └──→ Requires: Email template/guidelines for doctors

Slot Booking (SQLite)
    │
    ├──→ Database Schema (patients, appointments, lab_capacity)
    │       └──→ Requires: SQLite 3.40+ with sqlite-vec
    │
    ├──→ Capacity Management (20 slots/hour)
    │       └──→ Requires: Atomic transactions (prevent race conditions)
    │
    └──→ Mock Data Generation
            └──→ Requires: Synthetic patient records (50+)

Confirmation Email (Gmail API)
    │
    ├──→ Email Template (confirmation format)
    │       └──→ Requires: Branding/guidelines
    │
    └──→ Send via gogcli
            └──→ Requires: Same OAuth setup as ingestion

Audit Logging
    │
    └──→ audit_log Table Schema
            └──→ Requires: Log format (who, what, when, details)
```

---

### 6.2 Critical Path for POC Demo

```
Day 1-2: Foundation
├── Install Node.js 22.12.0+
├── Install OpenClaw 2026.2.26+
├── Set up Google Cloud Project + OAuth
├── Install gogcli v0.11.0
└── Test email read/send

Day 3-4: Core Booking
├── Create SQLite schema (patients, appointments, lab_capacity)
├── Generate mock patient data (50+ records)
├── Implement email parsing (OpenClaw NLP)
├── Implement slot booking logic (first available)
└── Test: Email → Parse → Book → Confirm

Day 5: Polish & Demo Prep
├── Add error handling (slot full, invalid data)
├── Add audit logging
├── Create demo script (sample doctor emails)
└── Record demo video or prepare live demo
```

---

## 7. Complexity Assessment

### 7.1 By Implementation Complexity

| Complexity | Features | Rationale |
|------------|----------|-----------|
| **LOW** | Slot booking, capacity management, audit logging, mock data | Straightforward CRUD operations, well-understood patterns |
| **MEDIUM** | Email ingestion, confirmation emails, error handling | Requires Gmail API integration, OAuth setup, email parsing |
| **HIGH** | AI-powered slot optimization, predictive modeling, EHR integration | Requires ML models, external system integrations, complex logic |

### 7.2 By Operational Complexity

| Complexity | Features | Ongoing Burden |
|------------|----------|----------------|
| **LOW** | SQLite database, mock data, fixed slot scheduling | Minimal maintenance, no external dependencies |
| **MEDIUM** | Gmail API integration, automated reminders | Monitor API quotas, handle rate limits |
| **HIGH** | HIPAA compliance, EHR integration, multi-clinic support | Legal review, vendor management, compliance audits |

---

## 8. Competitive Landscape Context

### 8.1 What Commercial Systems Offer (2025-2026)

| System | Key Features | Target Market |
|--------|--------------|---------------|
| **Calendly** | Calendar sync, one-click booking, reminders | SMB, individual professionals |
| **Chili Piper** | CRM integration, lead routing, form-based booking | B2B SaaS sales teams |
| **Emitrr** | HIPAA compliance, EHR integration, SMS/voice | Healthcare, wellness clinics |
| **ServiceAgent AI** | 24/7 voice calls, lead qualification, urgency detection | Service industries, emergency care |

### 8.2 How This POC Positions

| Dimension | Commercial Systems | This POC |
|-----------|-------------------|----------|
| **Input Channel** | Web forms, calendar links, phone calls | **Email-only** (doctor-mediated) |
| **Target User** | Patients book directly | **Doctors book on behalf of patients** |
| **AI Integration** | Basic NLP or rule-based | **OpenClaw NLP** for email parsing |
| **Compliance** | HIPAA-certified (paid plans) | **Mock data** (no compliance burden for demo) |
| **Deployment** | SaaS (monthly subscription) | **Self-hosted Docker** (one-time setup) |
| **Cost Model** | $10-50/user/month | **Free** (open source, self-hosted) |

**Differentiation:** This POC is **not competing** with commercial systems. It's a **proof-of-concept for a specific workflow** (doctor-mediated lab booking in public healthcare) that commercial systems don't address.

---

## 9. Quality Gate Checklist

- [x] **Categories are clear** - Table stakes vs. differentiators vs. anti-features clearly separated
- [x] **Complexity noted for each** - LOW/MEDIUM/HIGH assigned to all features
- [x] **Dependencies between features identified** - Dependency graph in Section 6.1
- [x] **POC scope is realistic** - 5-day implementation plan, focused on core booking loop

---

## 10. Recommendations for POC Success

### 10.1 Do Build (POC Essentials)

1. **Email ingestion with OpenClaw NLP** - Demonstrates AI capability, parses free-form doctor emails
2. **Simple slot booking (first available)** - Enforces 20/hour capacity, prevents double-booking
3. **Confirmation email** - Closes the loop, shows system responsiveness
4. **Mock patient data (50+ records)** - Enables realistic demo without compliance burden
5. **Basic audit logging** - Shows awareness of healthcare compliance requirements

### 10.2 Don't Build (Anti-Features)

1. **Patient self-booking portal** - Adds UI complexity, not core to doctor-mediated workflow
2. **Payment processing** - IMSS doesn't charge per appointment; adds PCI compliance burden
3. **HIPAA certification** - Overkill for mock data demo; document for production roadmap
4. **Multi-clinic support** - Validate single-lab workflow first
5. **WhatsApp/SMS integration** - Email is sufficient for POC; add in Phase 2

### 10.3 Document for Future (Phase 2+)

1. **Automated reminders** - Reduces no-shows (60% reduction documented in research)
2. **Rescheduling workflow** - Handle changes without manual intervention
3. **WhatsApp confirmations** - Higher engagement in Mexican market
4. **EHR integration** - Eliminate manual data entry for production deployment
5. **Multi-lab support** - Scale to multiple IMSS facilities

---

## Appendix A: Email Template Examples

### A.1 Doctor Request Email (Input)

```
To: lab-appointments@imss-bot.gmail.com
Subject: Lab Appointment Request

Patient: Juan Pérez García
CURP: PEGJ850315HDFRRN09
Date of Birth: March 15, 1985
Lab Type: Blood Work (Chemistry Panel)
Preferred Date: March 25, 2026
Preferred Time: 10:00 AM - 12:00 PM
Priority: Routine
Notes: Fasting required
```

### A.2 Confirmation Email (Output)

```
To: dr.martinez@imss-clinic.mx
Subject: Lab Appointment Confirmed - Juan Pérez García

Appointment Confirmed

Patient: Juan Pérez García
CURP: PEGJ850315HDFRRN09
Appointment ID: LAB-2026-032501

Date: Wednesday, March 25, 2026
Time: 10:00 AM
Lab: IMSS Clinic Lab #1
Service: Blood Work (Chemistry Panel)

Instructions:
- Patient must fast for 12 hours before appointment
- Bring official ID (INE or passport)
- Arrive 15 minutes early for check-in

To reschedule or cancel, reply to this email.

IMSS Lab Appointment System
```

---

## Appendix B: Mock Data Schema

### B.1 Patient Table (Mock)

```sql
CREATE TABLE patients (
    patient_id TEXT PRIMARY KEY,
    curp VARCHAR(18) UNIQUE,
    full_name VARCHAR(200),
    date_of_birth DATE,
    gender VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    imss_number VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sample mock data
INSERT INTO patients VALUES (
    'PAT-001',
    'PEGJ850315HDFRRN09',
    'Juan Pérez García',
    '1985-03-15',
    'Male',
    '+52-55-1234-5678',
    'juan.perez@email.com',
    'IMSS-123456789',
    CURRENT_TIMESTAMP
);
```

### B.2 Lab Capacity Table

```sql
CREATE TABLE lab_capacity (
    date DATE,
    hour INTEGER,  -- 9-16 (9 AM to 5 PM)
    max_capacity INTEGER DEFAULT 20,
    booked INTEGER DEFAULT 0,
    PRIMARY KEY (date, hour)
);

-- Sample: March 25, 2026, 10 AM hour has 5 slots booked
INSERT INTO lab_capacity VALUES ('2026-03-25', 10, 20, 5);
```

---

**Document Version:** 1.0
**Last Updated:** March 23, 2026
**Next Review:** After POC demo validation
