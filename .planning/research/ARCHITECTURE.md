# Architecture Research: OpenClaw Appointment Scheduling System

**Domain:** Healthcare Appointment Scheduling with OpenClaw
**Researched:** March 23, 2026
**Confidence:** HIGH

---

## Executive Summary

This document defines the **reference architecture** for an OpenClaw-based email appointment scheduling system for IMSS lab appointments. The architecture follows OpenClaw's skill-based agent patterns, uses Gmail API for bidirectional communication, and SQLite for persistent storage.

**Key Architectural Decision:** The system is structured as a **single OpenClaw agent** with custom skills for appointment management, rather than a monolithic application. This follows OpenClaw's 2026 best practices for maintainable, extensible AI agents.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMMUNICATION LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐              ┌──────────────────┐                 │
│  │   Doctor Email   │─────────────▶│   Gmail API      │                 │
│  │   (Request)      │              │   (gogcli)       │                 │
│  └──────────────────┘              └─────────┬────────┘                 │
│                                               │                          │
│  ┌──────────────────┐              ┌──────────▼────────┐                 │
│  │   Patient Email  │◀─────────────│   Gmail API      │                 │
│  │   (Confirmation) │              │   (gogcli)       │                 │
│  └──────────────────┘              └──────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPENCLAW AGENT LAYER                             │
├─────────────────────────────────────────────────────────────────────────┤
│                           OpenClaw Gateway                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Session Manager                               │    │
│  │  - Resolves email threads to sessions                            │    │
│  │  - Maintains conversation context                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Command Queue (Lane-based FIFO)               │    │
│  │  - Serializes email processing                                   │    │
│  │  - Prevents race conditions                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Skill Loader (Lazy)                           │    │
│  │  - appointment-scheduling/                                       │    │
│  │  - email-processing/                                             │    │
│  │  - database-operations/                                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    AI Model (GPT-5.2 / Claude 3.5)               │    │
│  │  - Parses email content (NLP)                                    │    │
│  │  - Extracts patient data                                         │    │
│  │  - Determines booking intent                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION SKILLS LAYER                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │  Email Parser    │  │  Slot Manager    │  │  Booking Engine  │      │
│  │  SKILL.md        │  │  SKILL.md        │  │  SKILL.md        │      │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤      │
│  │ - Extract patient│  │ - Check capacity │  │ - Atomic booking │      │
│  │ - Validate CURP  │  │ - Find available │  │ - Prevent double │      │
│  │ - Parse dates    │  │ - Reserve slot   │  │ - Confirm slot   │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐                           │
│  │  Email Sender    │  │  Audit Logger    │                           │
│  │  SKILL.md        │  │  SKILL.md        │                           │
│  ├──────────────────┤  ├──────────────────┤                           │
│  │ - Confirmation   │  │ - Log actions    │                           │
│  │ - Error replies  │  │ - HIPAA prep     │                           │
│  │ - Templates      │  │ - Timestamp      │                           │
│  └──────────────────┘  └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (SQLite)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   patients   │  │ appointments │  │ lab_capacity │  │ audit_log  │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├────────────┤  │
│  │ patient_id   │  │ appointment_ │  │ date         │  │ log_id     │  │
│  │ curp         │  │ patient_id   │  │ hour         │  │ user_id    │  │
│  │ full_name    │  │ lab_type     │  │ max_capacity │  │ action     │  │
│  │ dob          │  │ status       │  │ booked       │  │ resource   │  │
│  │ contact      │  │ scheduled    │  └──────────────┘  │ timestamp  │  │
│  └──────────────┘  │ duration     │                    │ details    │  │
│                    └──────────────┘                    └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **OpenClaw Gateway** | Central nervous system - owns all state, connections, session management | Node.js 22.12.0+ daemon, WebSocket API on 127.0.0.1:18789 |
| **Gmail Adapter (gogcli)** | Bidirectional email communication - read doctor requests, send confirmations | gogcli v0.11.0 with OAuth 2.0, scopes: gmail.modify |
| **Session Manager** | Resolves email threads to conversation sessions, maintains context | OpenClaw built-in, session keys: `agent:<id>:dm:<peerId>` |
| **Command Queue** | Lane-aware FIFO serialization - prevents race conditions in booking | OpenClaw built-in, modes: collect (default), steer, followup |
| **Email Parser Skill** | NLP extraction of patient data from doctor emails | Custom skill with SKILL.md, uses OpenClaw tool calling |
| **Slot Manager Skill** | Checks lab capacity (20/hour), finds available slots, reserves temporarily | Custom skill with SQLite queries, atomic transactions |
| **Booking Engine Skill** | Atomic appointment booking, prevents double-booking, confirms slots | Custom skill with SQLite transactions, constraint enforcement |
| **Email Sender Skill** | Sends confirmation/error emails to doctors using templates | Custom skill wrapping gogcli send command |
| **Audit Logger Skill** | Logs all actions for compliance (HIPAA preparation) | Custom skill writing to audit_log table |
| **SQLite Database** | Persistent storage for patients, appointments, capacity, audit logs | SQLite 3.40+ with sqlite-vec extension |

---

## Recommended Project Structure

```
crescendo-labs/
├── docker-compose.yml              # Docker orchestration for OpenClaw agent
├── .env                            # Environment variables (gitignored)
├── .gitignore
├── README.md
│
├── .planning/                      # Project planning & research
│   ├── config.json
│   ├── PROJECT.md
│   └── research/
│       ├── ARCHITECTURE.md         # This file
│       ├── FEATURES.md
│       ├── STACK.md
│       └── PITFALLS.md
│
├── config/                         # OpenClaw configuration
│   └── .openclaw/
│       ├── config.yaml             # Gateway configuration
│       ├── memory/
│       │   ├── main.sqlite         # SQLite database (vector + app tables)
│       │   ├── MEMORY.md           # Long-term memory (curated facts)
│       │   └── YYYY-MM-DD.md       # Daily session logs
│       ├── credentials/
│       │   └── google-credentials.json  # OAuth credentials (SECURE!)
│       └── adapters/
│           └── google/
│               └── config.json     # Gmail adapter config
│
├── skills/                         # Custom OpenClaw skills (Workspace skills - highest priority)
│   ├── appointment-scheduling/
│   │   ├── SKILL.md                # Skill definition (YAML frontmatter + instructions)
│   │   ├── index.ts                # Tool implementations (TypeScript)
│   │   ├── email-parser.ts         # NLP email parsing logic
│   │   ├── slot-manager.ts         # Capacity checking, slot finding
│   │   ├── booking-engine.ts       # Atomic booking operations
│   │   └── templates/
│   │       ├── confirmation.md     # Confirmation email template
│   │       └── error-reply.md      # Error response template
│   │
│   ├── database-operations/
│   │   ├── SKILL.md
│   │   ├── index.ts
│   │   ├── sqlite-client.ts        # SQLite connection & query helpers
│   │   └── schema.ts               # Table definitions, migrations
│   │
│   └── email-communication/
│       ├── SKILL.md
│       ├── index.ts
│       ├── send-email.ts           # Wrapper for gogcli send
│       └── read-email.ts           # Wrapper for gogcli search/read
│
├── workspace/                      # Agent file I/O workspace
│   └── appointments/               # Exported appointment data (optional)
│
├── scripts/                        # Utility scripts
│   ├── init-db.sh                  # Initialize SQLite schema
│   ├── seed-mock-data.ts           # Generate synthetic patient data
│   └── backup-db.sh                # Database backup script
│
├── data/                           # Persisted data (mounted to container)
│   └── sqlite.db                   # Application database (symlink or copy)
│
└── backups/                        # Automated database backups
    └── YYYY-MM-DD/
        └── openclaw-backup.tar.gz
```

---

### Structure Rationale

- **skills/:** Workspace skills have **highest priority** in OpenClaw's skill loading order (workspace > managed > bundled). Each skill is a self-contained module with SKILL.md defining capabilities and index.ts implementing tools.
- **config/.openclaw/:** Follows OpenClaw's default configuration structure. Volume-mounted to Docker container at `/root/.openclaw`.
- **workspace/:** Agent's sandboxed file I/O area. Skills can read/write here without accessing host filesystem.
- **scripts/:** Operational scripts kept separate from skills. Not loaded by agent, run manually or via cron.
- **data/:** Externalized persistence. Makes database backup/restore trivial (single file copy).

---

## Architectural Patterns

### Pattern 1: Skill-Based Agent Architecture

**What:** OpenClaw agents are structured as **skills** (modular competence units) rather than monolithic prompt engineering. Each skill declares its capabilities in SKILL.md and implements tools in TypeScript.

**When to use:** Always for OpenClaw agents. This is the framework's core abstraction.

**Trade-offs:**
- **Pros:** Modular, testable, lazy-loaded (low token overhead), hot-reloadable
- **Cons:** Requires learning SKILL.md format, TypeScript for tools

**Example:**

```markdown
# skills/appointment-scheduling/SKILL.md

---
name: appointment-scheduling
description: Book lab appointments via email. Parses doctor requests, checks slot availability, books appointments.
version: 1.0.0
requires:
  bins: [sqlite3, gog]
  env: [DATABASE_PATH]
tools:
  - parseAppointmentRequest
  - checkSlotAvailability
  - bookAppointment
  - sendConfirmationEmail
---

# Appointment Scheduling Skill

You are an appointment scheduling assistant for IMSS lab appointments.

## Capabilities

1. **Parse doctor emails** - Extract patient name, CURP, lab type, preferred date/time
2. **Check slot availability** - Query lab_capacity table for open slots (20/hour max)
3. **Book appointments** - Atomic transaction to prevent double-booking
4. **Send confirmations** - Email doctor with appointment details

## Workflow

1. Doctor sends email with patient details
2. Parse email using parseAppointmentRequest tool
3. Check availability using checkSlotAvailability tool
4. Book slot using bookAppointment tool (atomic transaction)
5. Send confirmation using sendConfirmationEmail tool
6. Log action using audit logger

## Rules

- NEVER book without valid CURP (18 characters, Mexican format)
- NEVER exceed lab capacity (20 slots/hour)
- ALWAYS send confirmation email after successful booking
- ALWAYS log actions to audit_log table
```

```typescript
// skills/appointment-scheduling/index.ts

import { Tool } from '@openclaw/core';

export const parseAppointmentRequest: Tool = async (emailContent) => {
  // NLP extraction using LLM
  const patientData = await extractPatientData(emailContent);
  validateCURP(patientData.curp);
  return patientData;
};

export const checkSlotAvailability: Tool = async (date, preferredHour) => {
  const capacity = await db.get(
    'SELECT max_capacity, booked FROM lab_capacity WHERE date = ? AND hour = ?',
    [date, preferredHour]
  );
  if (!capacity || capacity.booked >= capacity.max_capacity) {
    return findNextAvailableSlot(date);
  }
  return { date, hour: preferredHour, available: true };
};

export const bookAppointment: Tool = async (appointmentData) => {
  // Atomic transaction prevents double-booking
  await db.run('BEGIN TRANSACTION');
  try {
    await db.run(
      'INSERT INTO appointments (...) VALUES (...)',
      [appointmentData]
    );
    await db.run(
      'UPDATE lab_capacity SET booked = booked + 1 WHERE date = ? AND hour = ?',
      [appointmentData.date, appointmentData.hour]
    );
    await db.run('COMMIT');
    return { success: true, appointmentId: generateId() };
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
};
```

---

### Pattern 2: Lane-Based Command Queue

**What:** OpenClaw's command queue serializes operations using **lanes** (global, per-session, sub-agent, cron). This prevents race conditions in appointment booking.

**When to use:** Always enabled in OpenClaw Gateway. Critical for preventing double-booking.

**Trade-offs:**
- **Pros:** Automatic serialization, no manual locking required, prevents race conditions
- **Cons:** Single-threaded per session (by design), may bottleneck under high load

**Queue Lane Structure:**

```
┌─────────────────────────────────┐
│ Global Lane (main)              │ maxConcurrent: 4
│ ├─ Session Lane (per email)     │ concurrency: 1 (strict serial)
│ ├─ Sub-agent Lane               │ concurrency: 8
│ └─ Cron Lane                    │ parallel with main
└─────────────────────────────────┘
```

**Implication for Appointment System:**
- Each doctor's email thread is a separate session
- Sessions are processed serially (no parallel booking from same thread)
- Multiple doctors' emails can be processed in parallel (up to maxConcurrent: 4)
- **Atomic transactions in SQLite provide additional safety** against race conditions

---

### Pattern 3: Lazy Skill Loading

**What:** Skills are **NOT** injected into system prompts. Only compact metadata (name + description + file path) is included. The LLM reads SKILL.md on-demand when a task matches.

**When to use:** Always for OpenClaw agents. Reduces token usage by ~97 chars per skill + field lengths.

**Trade-offs:**
- **Pros:** Minimal token overhead, supports many skills without context bloat
- **Cons:** Model must learn to read SKILL.md files (trained behavior)

**Example:**

```xml
<!-- System prompt includes only metadata -->
<available_skills>
  <skill>
    <name>appointment-scheduling</name>
    <description>Book lab appointments via email. Parses requests, checks availability, books slots.</description>
    <location>/root/workspace/skills/appointment-scheduling/SKILL.md</location>
  </skill>
  <skill>
    <name>database-operations</name>
    <description>SQLite database operations for patients, appointments, capacity management.</description>
    <location>/root/workspace/skills/database-operations/SKILL.md</location>
  </skill>
  <skill>
    <name>email-communication</name>
    <description>Send and read emails via Gmail API (gogcli).</description>
    <location>/root/workspace/skills/email-communication/SKILL.md</location>
  </skill>
</available_skills>
```

---

### Pattern 4: Hybrid Memory Architecture

**What:** OpenClaw uses a **4-layer memory system**: session context (JSONL), daily logs (Markdown), curated facts (MEMORY.md), and vector search (SQLite + embeddings).

**When to use:** Always for OpenClaw agents. Application data (appointments, patients) uses separate SQLite tables.

**Trade-offs:**
- **Pros:** Efficient context management, semantic search, automatic compaction
- **Cons:** Requires understanding of memory layers, vector search setup

**Memory Layers:**

```
┌─────────────────────────────────────────┐
│ Layer 4: Vector Search (SQLite + sqlite-vec) │
│ - Semantic search over conversation history  │
│ - Hybrid: 0.7×vectorScore + 0.3×BM25Score    │
├─────────────────────────────────────────┤
│ Layer 3: MEMORY.md (curated long-term)  │
│ - Patient preferences, lab rules, hours │
│ - Manually curated facts                │
├─────────────────────────────────────────┤
│ Layer 2: Daily Logs (memory/YYYY-MM-DD) │
│ - Session transcripts with timestamps   │
│ - Auto-compacted from sessions          │
├─────────────────────────────────────────┤
│ Layer 1: Session Context (JSONL)        │
│ - Active conversation transcript        │
│ - Expires daily at 4 AM or on idle      │
└─────────────────────────────────────────┘
```

**Application Data Separation:**
- **Conversation memory** uses OpenClaw's built-in memory system
- **Appointment data** uses separate SQLite tables (patients, appointments, lab_capacity, audit_log)
- **DO NOT mix** application data with conversation memory

---

## Data Flow

### Email Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Doctor Sends Email                                              │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Gmail API Receives Email                                        │
│ - gogcli polls Gmail API (or receives via Pub/Sub webhook)              │
│ - New email detected: "Lab Appointment Request" from dr.martinez@...    │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: OpenClaw Gateway Processes Email                                │
│ - Channel Bridge normalizes email to internal envelope                  │
│ - Session Manager resolves to session: agent:<id>:dm:<doctorPeerId>     │
│ - Command Queue serializes (lane-aware FIFO)                            │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: AI Model Parses Email (NLP)                                     │
│ - System prompt assembled with skill metadata                           │
│ - Model reads appointment-scheduling/SKILL.md                           │
│ - parseAppointmentRequest tool extracts:                                │
│   - Patient: Juan Pérez García                                          │
│   - CURP: PEGJ850315HDFRRN09                                            │
│   - Lab Type: Blood Work                                                │
│   - Preferred: March 25, 2026, 10:00 AM                                 │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Check Slot Availability                                         │
│ - checkSlotAvailability tool queries SQLite:                            │
│   SELECT max_capacity, booked FROM lab_capacity                         │
│   WHERE date = '2026-03-25' AND hour = 10                               │
│ - Result: 5/20 booked → 15 slots available                              │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Book Appointment (Atomic Transaction)                           │
│ - bookAppointment tool executes:                                        │
│   BEGIN TRANSACTION                                                     │
│   INSERT INTO appointments (...) VALUES (...)                           │
│   UPDATE lab_capacity SET booked = booked + 1                           │
│   WHERE date = '2026-03-25' AND hour = 10                               │
│   COMMIT                                                                │
│ - appointment_id generated: LAB-2026-032501                             │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: Send Confirmation Email                                         │
│ - sendConfirmationEmail tool uses template:                             │
│   To: dr.martinez@imss-clinic.mx                                        │
│   Subject: Lab Appointment Confirmed - Juan Pérez García                │
│   Body: Appointment details, instructions, ID                           │
│ - gogcli send command transmits email                                   │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 8: Log Action (Audit Trail)                                        │
│ - auditLogger tool writes to audit_log table:                           │
│   INSERT INTO audit_log (user_id, action, resource_type, resource_id)   │
│   VALUES ('dr.martinez', 'BOOK_APPOINTMENT', 'appointment', 'LAB-...')  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Database Schema

```sql
-- Patients table
CREATE TABLE patients (
    patient_id TEXT PRIMARY KEY,           -- PAT-001, PAT-002, ...
    curp VARCHAR(18) UNIQUE NOT NULL,      -- Mexican ID (18 chars)
    full_name VARCHAR(200) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    imss_number VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
    appointment_id TEXT PRIMARY KEY,       -- LAB-2026-032501
    patient_id TEXT NOT NULL REFERENCES patients(patient_id),
    doctor_email VARCHAR(255) NOT NULL,
    lab_type VARCHAR(100) NOT NULL,        -- Blood Work, X-ray, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    scheduled_date DATE NOT NULL,
    scheduled_hour INTEGER NOT NULL,       -- 9-16 (9 AM to 5 PM)
    duration_minutes INTEGER DEFAULT 15,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lab capacity table (fixed slot management)
CREATE TABLE lab_capacity (
    date DATE NOT NULL,
    hour INTEGER NOT NULL,                 -- 9-16 (9 AM to 5 PM)
    max_capacity INTEGER NOT NULL DEFAULT 20,
    booked INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, hour),
    CHECK (booked <= max_capacity)
);

-- Audit log table (HIPAA compliance preparation)
CREATE TABLE audit_log (
    log_id TEXT PRIMARY KEY,               -- LOG-<timestamp>-<uuid>
    user_id VARCHAR(100) NOT NULL,         -- Doctor email or system
    action VARCHAR(100) NOT NULL,          -- BOOK_APPOINTMENT, CANCEL, etc.
    resource_type VARCHAR(100),            -- appointment, patient
    resource_id TEXT,                      -- appointment_id or patient_id
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT                           -- JSON with additional context
);

-- Indexes for performance
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date, scheduled_hour);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, timestamp);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

---

### State Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPENCLAW STATE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Conversation State (OpenClaw Memory)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Session JSONL → Daily Markdown → MEMORY.md → Vector Search     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Application State (SQLite Tables)                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  patients | appointments | lab_capacity | audit_log              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Communication State (Gmail API)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Email threads | Labels | Drafts | Sent items                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Principle:** Conversation state and application state are **separated**.
- **Conversation state** (what was discussed with which doctor) uses OpenClaw memory
- **Application state** (appointments, patients, capacity) uses SQLite tables
- **Communication state** (email threads) uses Gmail API labels/threads

---

## Build Order & Dependencies

### Phase 1: Foundation (Day 1-2)

**Dependencies:** None (greenfield)

```
1. Install Node.js 22.12.0+ via nvm
   └── Required for OpenClaw Gateway

2. Install OpenClaw Framework
   └── curl -fsSL https://openclaw.ai/install.sh | bash
   └── Version must be >= 2026.2.26

3. Create Google Cloud Project
   ├── Enable Gmail API
   ├── Enable Calendar API (optional for Phase 2)
   └── Create OAuth credentials (Desktop app)

4. Install gogcli v0.11.0
   ├── brew install steipete/tap/gogcli (macOS)
   └── Authenticate: gog auth add your-bot-email@gmail.com

5. Test OpenClaw + Gmail Integration
   ├── openclaw tui
   └── Query: "What was my most recent email?"
```

**Deliverable:** Working OpenClaw instance that can read/send emails

---

### Phase 2: Database & Skills (Day 3-4)

**Dependencies:** Phase 1 complete

```
1. Create SQLite Schema
   ├── patients table
   ├── appointments table
   ├── lab_capacity table
   └── audit_log table
   └── Run: scripts/init-db.sh

2. Generate Mock Data
   ├── 50+ synthetic patient records
   ├── Lab capacity for next 30 days
   └── Run: scripts/seed-mock-data.ts

3. Create Appointment Scheduling Skill
   ├── SKILL.md (definition)
   ├── index.ts (tool implementations)
   ├── email-parser.ts (NLP extraction)
   ├── slot-manager.ts (capacity checking)
   └── booking-engine.ts (atomic booking)

4. Create Database Operations Skill
   ├── SKILL.md
   ├── sqlite-client.ts (connection helper)
   └── schema.ts (migrations)

5. Create Email Communication Skill
   ├── SKILL.md
   ├── send-email.ts (gogcli wrapper)
   └── read-email.ts (gogcli wrapper)
```

**Deliverable:** Custom skills for appointment booking

---

### Phase 3: Integration & Testing (Day 5)

**Dependencies:** Phase 2 complete

```
1. Test End-to-End Flow
   ├── Send test email from doctor account
   ├── Verify email parsed correctly
   ├── Verify slot booked in SQLite
   ├── Verify confirmation email sent
   └── Verify audit log entry created

2. Add Error Handling
   ├── Slot full → reply with alternatives
   ├── Invalid CURP → reply with error
   ├── Missing patient data → request clarification

3. Add Email Templates
   ├── confirmation.md (successful booking)
   └── error-reply.md (booking failed)

4. Performance Testing
   ├── Measure: Email → Confirmation time (< 30 seconds target)
   └── Measure: Concurrent booking (no double-booking)
```

**Deliverable:** Working end-to-end appointment booking flow

---

### Phase 4: Docker & Deployment (Day 6-7)

**Dependencies:** Phase 3 complete

```
1. Create Docker Configuration
   ├── docker-compose.yml
   ├── .env (environment variables)
   └── Dockerfile (if custom image needed)

2. Configure Volume Mounts
   ├── ./config/.openclaw:/root/.openclaw
   ├── ./skills:/root/workspace/skills
   └── ./data:/root/data

3. Apply Security Hardening
   ├── --read-only filesystem
   ├── --security-opt=no-new-privileges
   ├── --cap-drop=ALL
   ├── --cap-add=NET_BIND_SERVICE
   └── -u 1000:1000 (non-root user)

4. Test Docker Deployment
   ├── docker compose up -d
   ├── Verify health: docker compose exec ... openclaw --version
   └── Test email flow inside container

5. Set Up Backups
   ├── scripts/backup-db.sh
   └── Cron job for daily backups
```

**Deliverable:** Dockerized, production-ready deployment

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|-------------------------|
| **POC (1-10 appointments/day)** | SQLite + single OpenClaw instance (current design) |
| **Pilot (10-100 appointments/day)** | Add connection pooling, optimize SQLite queries |
| **Production (100-1000 appointments/day)** | Migrate to PostgreSQL with pgvector, add read replicas |
| **Multi-clinic (1000+ appointments/day)** | Horizontal scaling: multiple OpenClaw instances + load balancer |

### Scaling Priorities

1. **First bottleneck (100+ appointments/day):** SQLite concurrent writes
   - **Fix:** Connection pooling, WAL mode, increase busy_timeout
   - **Alternative:** Migrate to PostgreSQL

2. **Second bottleneck (500+ appointments/day):** Gmail API rate limits
   - **Fix:** Use Pub/Sub webhooks instead of polling
   - **Alternative:** Multiple Gmail accounts with round-robin

3. **Third bottleneck (1000+ appointments/day):** Single OpenClaw instance
   - **Fix:** Multiple instances with shared PostgreSQL database
   - **Fix:** Load balancer distributes email processing

---

## Anti-Patterns

### Anti-Pattern 1: Monolithic Skill

**What people do:** Put all appointment logic in a single SKILL.md with 500+ lines of code.

**Why it's wrong:**
- Hard to test individual components
- Token bloat in system prompt
- Difficult to debug and maintain
- Violates single responsibility principle

**Do this instead:**
```
skills/
├── appointment-scheduling/   # Orchestrates workflow
├── database-operations/      # SQLite CRUD operations
└── email-communication/      # Gmail API wrapper
```

Each skill has a **single responsibility** and can be tested independently.

---

### Anti-Pattern 2: Skipping Atomic Transactions

**What people do:** Insert appointment and update capacity in separate database calls.

**Why it's wrong:**
- Race conditions allow double-booking
- Data inconsistency if second operation fails
- Violates ACID properties

**Do this instead:**
```typescript
export const bookAppointment: Tool = async (data) => {
  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('INSERT INTO appointments (...) VALUES (...)');
    await db.run(
      'UPDATE lab_capacity SET booked = booked + 1 WHERE date = ? AND hour = ?'
    );
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
};
```

---

### Anti-Pattern 3: Mixing Conversation Memory with Application Data

**What people do:** Store appointment records in OpenClaw's MEMORY.md or daily logs.

**Why it's wrong:**
- Conversation memory is for **context**, not **state**
- No query capability (can't do: "find all appointments on March 25")
- Auto-compaction may lose data
- Violates separation of concerns

**Do this instead:**
- **Conversation memory:** "Dr. Martinez requested an appointment for Juan Pérez"
- **Application state:** SQLite `appointments` table with structured data
- **Query application state** using database-operations skill

---

### Anti-Pattern 4: Hardcoding Credentials

**What people do:** Store Gmail OAuth credentials in .env files or code.

**Why it's wrong:**
- Agent can read .env files and leak credentials
- Accidental git commit exposes secrets
- Violates security best practices

**Do this instead:**
```bash
# Use environment variables (not .env files)
export OPENAI_API_KEY="sk-..."
export MODEL_API_KEY="..."

# Docker: pass as environment variables
docker run -e OPENAI_API_KEY=${OPENAI_API_KEY} ...

# Credentials in secure location (~/.openclaw/credentials/)
chmod 600 ~/.openclaw/credentials/google-credentials.json
```

---

### Anti-Pattern 5: Polling Gmail Without Rate Limiting

**What people do:** Check Gmail every 10 seconds for new emails.

**Why it's wrong:**
- Hits Gmail API rate limits (250 units/second/user)
- Triggers abuse detection (account suspension risk)
- Wastes resources when no new emails

**Do this instead:**
- **Option 1:** Use Gmail Pub/Sub webhooks for real-time notifications
- **Option 2:** Poll with exponential backoff (start at 60 seconds, increase on no new emails)
- **Option 3:** Use AgentMail for production (dedicated agent email infrastructure)

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Gmail API** | gogcli v0.11.0 with OAuth 2.0 | Scopes: gmail.modify, calendar.events (optional) |
| **Google Cloud Pub/Sub** | Webhook for real-time email delivery | Requires public endpoint (Tailscale Funnel or ngrok) |
| **OpenAI API** | LLM for NLP and reasoning | Model: GPT-5.2, rate limit: 30 requests/minute |
| **Anthropic API** | Alternative LLM | Model: Claude 3.5 Sonnet, better for long-horizon tasks |

---

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Gateway ↔ Skills** | Tool calling (TypeScript functions) | Skills expose tools via index.ts exports |
| **Gateway ↔ Memory** | SQLite queries + file I/O | Memory search uses hybrid (vector + BM25) |
| **Gateway ↔ Gmail** | gogcli CLI commands | Skills call gog via child_process.exec |
| **Skills ↔ SQLite** | Better-sqlite3 (synchronous) | Atomic transactions for booking |

---

## OpenClaw Agent Structure

### Agent Configuration

```yaml
# config/.openclaw/config.yaml

model:
  provider: openai
  model: gpt-5.2
  apiKey: ${OPENAI_API_KEY}
  rateLimiting:
    retryOnRateLimit: true
    maxRetries: 3
    retryDelay: 5000
    maxRequestsPerMinute: 30

memory:
  backend: sqlite  # Default: ~/.openclaw/memory/main.sqlite

memorySearch:
  query:
    hybrid:
      enabled: true
      vectorWeight: 0.7
      textWeight: 0.3
      candidateMultiplier: 4

gateway:
  host: 127.0.0.1  # Security: not 0.0.0.0
  port: 18789
  dangerouslyDisableDeviceAuth: false  # Security: always false in production

skills:
  workspace: ./skills  # Workspace skills (highest priority)
  managed: ~/.openclaw/skills
  bundled: <install>/skills

hooks:
  enabled: true
  directory: ~/.openclaw/hooks

cron:
  enabled: true
  timezone: America/Mexico_City

heartbeat:
  enabled: false  # Enable for proactive check-ins (Phase 2)
```

---

### Session Configuration

```yaml
# Session lifecycle for email threads

session:
  dmScope: main  # All emails from same doctor → same session
  # Alternative: per-peer (agent:<id>:dm:<peerId>)

compaction:
  enabled: true
  strategy: daily  # Compact at 4 AM local time
  # Alternative: idle (compact after N minutes of inactivity)

bootstrapMaxChars: 20000  # Truncate system prompt at 20K chars
```

---

## Security Architecture

### 7-Layer Security Model (OpenClaw Best Practices)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Authentication                                                  │
│ - Device pairing with token-based auth                                  │
│ - OAuth 2.0 for Gmail API                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Trust                                                           │
│ - Allowlist trusted contacts (doctor emails)                            │
│ - Block unknown senders from triggering actions                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Channel Allowlists                                              │
│ - Only process emails from @imss-clinic.mx domain                       │
│ - Reject emails from unknown domains                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Tool Policy                                                     │
│ - Require approval for destructive operations (cancel appointments)     │
│ - Read-only operations allowed without approval                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Layer 5: Execution Approvals                                             │
│ - Human-in-the-loop for high-risk actions                               │
│ - Auto-approve routine bookings                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Layer 6: Sandbox                                                         │
│ - Docker container isolation                                              │
│ - Read-only filesystem (except mounted volumes)                         │
│ - Network restrictions (allowlist domains only)                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Layer 7: Send Policy                                                     │
│ - Rate limit outgoing emails (max 50/hour)                              │
│ - Template-based responses only (no free-form generation)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Docker Security Hardening

```bash
docker run -d \
  --name imss-lab-bot-secure \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64M \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --cpus="2.0" \
  --memory="4g" \
  -u 1000:1000 \
  -v /opt/imss-bot/.openclaw:/root/.openclaw:rw \
  -v /opt/imss-bot/workspace:/root/workspace:ro \
  --network openclaw-network \
  --restart unless-stopped \
  openclaw/openclaw:latest
```

**Security Flags:**
- `--read-only`: Prevents malware persistence
- `--security-opt=no-new-privileges`: Blocks privilege escalation
- `--cap-drop=ALL`: Drops all Linux capabilities
- `--cap-add=NET_BIND_SERVICE`: Only capability needed for network binding
- `--tmpfs /tmp:rw,noexec,nosuid`: Writable temp without execution
- `--cpus` / `--memory`: Resource limits prevent DoS
- `-u 1000:1000`: Run as non-root user

---

## Sources

- **OpenClaw Complete Guide 2026** - Official documentation (February-March 2026)
- **Reference Architecture: OpenClaw (Early Feb 2026 Edition)** - robotpaper.ai
- **OpenClaw's Skill-Based AI Architecture** - LinkedIn technical analysis
- **Connect OpenClaw to Gmail: Step-by-Step Tutorial** - AgentMail.to
- **Healthcare Appointment Scheduling with OpenClaw** - Tencent Cloud tutorial
- **OpenClaw Security Best Practices** - Composio security guide

---

*Architecture research for: OpenClaw Appointment Scheduling System*
*Researched: March 23, 2026*
*Next review: After POC demo validation*
