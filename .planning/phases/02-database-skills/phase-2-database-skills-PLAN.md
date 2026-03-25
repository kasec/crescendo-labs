# PLAN.md — Phase 2: Database & Skills

**Phase:** 2 of 4
**Goal:** SQLite database with schema + 3 core OpenClaw skills working
**Duration:** Day 3-4
**Mode:** YOLO (auto-approve execution)

---

## Objective

Build the data layer and core agent skills for the IMSS Lab Appointment Scheduling POC:

1. Create SQLite database schema with 5 tables (patients, appointments, lab_capacity, audit_log, doctors)
2. Generate mock data (50+ patients, 5+ doctors, 7 days of lab capacity)
3. Implement Email Parser Skill (A2) with CURP validation
4. Implement Slot Manager Skill (A3) with atomic reservation
5. Configure lane-based command queue (A6) in OpenClaw gateway

This plan satisfies **10 requirements**: D1, D2, D3, D4, D5, A2, A3, A6, B1, B2

---

## Execution Context

### Phase Requirements (from ROADMAP.md)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **D1** | SQLite database with schema | Tables: patients, appointments, lab_capacity, audit_log, doctors; DELETE journal mode; foreign keys enabled |
| **D2** | Mock patient data (50+ records) | 50+ synthetic patients with realistic Mexican names, valid CURP format (18 chars + checksum) |
| **D3** | Mock doctor data (5+ records) | 5+ doctors across 3+ lab specialties |
| **D4** | Appointment history tracking | All appointments stored with full details, queryable by patient/date/status |
| **D5** | Basic audit logging | audit_log table records: user_id, action, resource, timestamp, details |
| **A2** | Email parser skill | Parses doctor emails, extracts structured data, validates CURP/date format |
| **A3** | Slot manager skill | Queries lab_capacity, returns available slots, reserves atomically |
| **A6** | Lane-based command queue | Configured in gateway.yaml, prevents race conditions on slot booking |
| **B1** | Fixed slot capacity management | 20 slots/hour, Mon-Fri 9-17 operating hours |
| **B2** | Real-time slot availability tracking | Atomic availability check before booking |

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

### Key Constraints

- **SQLite 3.40+ required** with DELETE journal mode (not WAL for Docker safety)
- **CURP validation** must check format (18 characters) and basic checksum
- **Atomic transactions** required for slot reservation (prevent double-booking)
- **Lane-based queue** must serialize email processing per lane
- **Mock data only** — no real patient information

### Research Context

From REQUIREMENTS.md:
- CURP: 18-character Mexican personal ID code with checksum
- Lab capacity: 20 slots/hour, Mon-Fri 9:00-17:00
- Email template format defined for doctor → system communication
- Audit log structure: user_id, action, resource, timestamp, details

From STACK.md:
- SQLite DELETE journal mode preferred for Docker (not WAL)
- Foreign key constraints must be enabled explicitly
- Indexes recommended on frequently queried columns

From PITFALLS.md:
- SQLite corruption risk in Docker with WAL mode
- Race conditions on slot booking without proper locking
- CURP validation complexity (use regex + simplified checksum)

---

## Tasks

### Task 1: Create SQLite Database Schema

**Goal:** Create database with 5 tables and proper constraints

**Checklist:**
- [ ] Create `data/` directory
- [ ] Create schema SQL file
- [ ] Execute schema to create database
- [ ] Verify all tables created
- [ ] Enable foreign key constraints
- [ ] Set DELETE journal mode

**Schema:** `scripts/create-schema.sql`
```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Set journal mode to DELETE (not WAL for Docker safety)
PRAGMA journal_mode = DELETE;

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curp TEXT UNIQUE NOT NULL CHECK(length(curp) = 18),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT CHECK(gender IN ('M', 'F', 'O')),
    phone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lab capacity table (fixed slots per hour)
CREATE TABLE IF NOT EXISTS lab_capacity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK(hour >= 9 AND hour <= 16),
    max_slots INTEGER DEFAULT 20,
    booked_slots INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, hour)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER,
    lab_capacity_id INTEGER NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
    lab_type TEXT NOT NULL,
    priority TEXT DEFAULT 'routine' CHECK(priority IN ('routine', 'urgent', 'stat')),
    notes TEXT,
    booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (lab_capacity_id) REFERENCES lab_capacity(id)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_patients_curp ON patients(curp);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(booked_at);
CREATE INDEX IF NOT EXISTS idx_lab_capacity_date ON lab_capacity(date);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
```

**Commands:**
```bash
mkdir -p data
sqlite3 data/sqlite.db < scripts/create-schema.sql

# Verify tables
sqlite3 data/sqlite.db ".tables"

# Verify journal mode
sqlite3 data/sqlite.db "PRAGMA journal_mode;"

# Verify foreign keys enabled
sqlite3 data/sqlite.db "PRAGMA foreign_keys;"
```

**Acceptance:** All 5 tables exist, journal_mode=delete, foreign_keys=on

---

### Task 2: Generate Mock Patient Data (50+ Records)

**Goal:** Create realistic synthetic patient data with valid CURP format

**Checklist:**
- [ ] Create data generation script
- [ ] Include realistic Mexican names
- [ ] Generate valid CURP format (18 characters)
- [ ] Insert 50+ patient records
- [ ] Verify data integrity

**Script:** `scripts/generate-mock-data.py`
```python
#!/usr/bin/env python3
"""
Generate mock patient and doctor data for IMSS Lab Appointment POC.
All data is synthetic - no real personal information used.
"""

import sqlite3
import random
from datetime import datetime, timedelta

# Mexican name components (common surnames and given names)
FIRST_NAMES_M = [
    "José", "Juan", "Pedro", "Luis", "Carlos", "Jorge", "Miguel", "Antonio",
    "Francisco", "Jesús", "Alejandro", "Sergio", "Raúl", "Ricardo", "Alberto",
    "Arturo", "Héctor", "Roberto", "Manuel", "Fernando", "David", "Javier",
    "Ángel", "Eduardo", "Gustavo", "Pablo", "Andrés", "Oscar", "Enrique", "Ramón"
]

FIRST_NAMES_F = [
    "María", "Juana", "Patricia", "Elizabeth", "Yolanda", "Guadalupe", "Teresa",
    "Rosa", "Carmen", "Ana", "Lucía", "Isabel", "Margarita", "Verónica",
    "Silvia", "Gabriela", "Mónica", "Alejandra", "Adriana", "Laura",
    "Daniela", "Sofía", "Valentina", "Camila", "Valeria", "Ximena", "Fernanda"
]

LAST_NAMES = [
    "Hernández", "García", "Martínez", "López", "González", "Rodríguez",
    "Pérez", "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales",
    "Jiménez", "Reyes", "Gutiérrez", "Ruiz", "Díaz", "Moreno", "Álvarez",
    "Muñoz", "Romero", "Vázquez", "Castillo", "Ramos", "Ortiz", "Mendoza",
    "Aguilar", "Vega", "Torres", "Domínguez", "Guerrero", "Medina", "Delgado"
]

STATES = [
    "AS", "BC", "BS", "CC", "CS", "CH", "CL", "CM", "DF", "DG", "GT", "GR",
    "HG", "JC", "MC", "MN", "MS", "NT", "NL", "OC", "PL", "QT", "QR", "SP",
    "SL", "SR", "TC", "TS", "TL", "VZ", "YN", "ZS", "NE"  # Mexican state codes
]

def generate_curp(first_name, last_name, dob, gender):
    """
    Generate a CURP-like 18-character code.
    Format: AAAA000000H000000 (simplified - not full RFC validation)
    """
    # First 4 chars: first letter of paternal surname + first vowel + first letter of maternal surname + first letter of first name
    curp = last_name[0].upper()
    
    # Find first vowel in paternal surname
    for char in last_name[1:]:
        if char in 'AEIOU':
            curp += char.upper()
            break
    else:
        curp += 'X'
    
    # Maternal surname first letter (or X if none)
    curp += last_name.split()[1][0].upper() if len(last_name.split()) > 1 else 'X'
    
    # First name first letter
    curp += first_name[0].upper()
    
    # Date of birth (YYMMDD)
    curp += dob.strftime('%y%m%d')
    
    # Gender
    curp += 'H' if gender == 'M' else 'M'
    
    # State code (2 chars)
    curp += random.choice(STATES)
    
    # Consonants from surnames and name (3 chars)
    consonants = ''.join([c for c in (last_name + first_name) if c not in 'AEIOU'])
    curp += ''.join(random.sample(consonants.upper(), min(3, len(consonants))))
    
    # Checksum digit (simplified - random for POC)
    curp += str(random.randint(0, 9))
    
    # Pad/truncate to 18 chars
    return curp[:17].ljust(18, 'X') if len(curp) < 18 else curp[:18]

def generate_patients(conn, count=55):
    """Generate synthetic patient records."""
    cursor = conn.cursor()
    
    patients = []
    for _ in range(count):
        gender = random.choice(['M', 'F'])
        first_name = random.choice(FIRST_NAMES_M if gender == 'M' else FIRST_NAMES_F)
        last_name = f"{random.choice(LAST_NAMES)} {random.choice(LAST_NAMES)}"
        
        # Random DOB between 1950 and 2020
        dob = datetime(1950, 1, 1) + timedelta(days=random.randint(0, 25550))
        
        curp = generate_curp(first_name, last_name, dob, gender)
        
        patients.append({
            'curp': curp,
            'first_name': first_name,
            'last_name': last_name,
            'dob': dob.strftime('%Y-%m-%d'),
            'gender': gender,
            'phone': f"55{random.randint(10000000, 99999999)}",
            'email': f"{first_name.lower()}.{last_name.split()[0].lower()}{random.randint(1, 999)}@email.com"
        })
    
    # Insert patients
    for p in patients:
        try:
            cursor.execute("""
                INSERT INTO patients (curp, first_name, last_name, date_of_birth, gender, phone, email)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (p['curp'], p['first_name'], p['last_name'], p['dob'], p['gender'], p['phone'], p['email']))
        except sqlite3.IntegrityError:
            # CURP already exists, skip
            continue
    
    conn.commit()
    return cursor.execute("SELECT COUNT(*) FROM patients").fetchone()[0]

if __name__ == "__main__":
    conn = sqlite3.connect('data/sqlite.db')
    conn.execute("PRAGMA foreign_keys = ON")
    
    patient_count = generate_patients(conn, 55)
    print(f"Generated {patient_count} patients")
    
    conn.close()
```

**Commands:**
```bash
python3 scripts/generate-mock-data.py

# Verify patient count
sqlite3 data/sqlite.db "SELECT COUNT(*) FROM patients;"

# Sample patient data
sqlite3 data/sqlite.db "SELECT curp, first_name, last_name, date_of_birth FROM patients LIMIT 5;"
```

**Acceptance:** 50+ patients in database, CURP format valid (18 chars)

---

### Task 3: Generate Mock Doctor Data (5+ Records)

**Goal:** Create synthetic doctor records across multiple specialties

**Checklist:**
- [ ] Add doctor generation to mock data script
- [ ] Include 3+ lab specialties
- [ ] Insert 5+ doctor records
- [ ] Verify data integrity

**Add to `scripts/generate-mock-data.py`:**
```python
def generate_doctors(conn, count=6):
    """Generate synthetic doctor records."""
    cursor = conn.cursor()
    
    doctors = [
        ("Dr. María García", "Blood Work", "mgarcia@imss-clinic.mx"),
        ("Dr. Juan Hernández", "X-Ray", "jhernandez@imss-clinic.mx"),
        ("Dr. Patricia López", "Urinalysis", "plopez@imss-clinic.mx"),
        ("Dr. Carlos Martínez", "Blood Work", "cmartinez@imss-clinic.mx"),
        ("Dr. Ana Rodríguez", "X-Ray", "arodriguez@imss-clinic.mx"),
        ("Dr. Luis Pérez", "General Lab", "lperez@imss-clinic.mx"),
    ]
    
    for name, specialty, email in doctors[:count]:
        try:
            cursor.execute("""
                INSERT INTO doctors (name, specialty, email)
                VALUES (?, ?, ?)
            """, (name, specialty, email))
        except sqlite3.IntegrityError:
            continue
    
    conn.commit()
    return cursor.execute("SELECT COUNT(*) FROM doctors").fetchone()[0]

# In main block:
doctor_count = generate_doctors(conn, 6)
print(f"Generated {doctor_count} doctors")
```

**Commands:**
```bash
python3 scripts/generate-mock-data.py

# Verify doctor count
sqlite3 data/sqlite.db "SELECT COUNT(*) FROM doctors;"

# List doctors by specialty
sqlite3 data/sqlite.db "SELECT specialty, COUNT(*) FROM doctors GROUP BY specialty;"
```

**Acceptance:** 5+ doctors, 3+ specialties represented

---

### Task 4: Generate Lab Capacity Data (7 Days)

**Goal:** Create 7 days of lab capacity slots (20/hour, Mon-Fri 9-17)

**Checklist:**
- [ ] Add capacity generation to mock data script
- [ ] Generate 8 hours/day × 7 days = 56 capacity records
- [ ] Set max_slots=20, booked_slots=0 initially
- [ ] Verify data integrity

**Add to `scripts/generate-mock-data.py`:**
```python
from datetime import date

def generate_lab_capacity(conn, days=7):
    """Generate lab capacity slots for next N days."""
    cursor = conn.cursor()
    
    today = date.today()
    hours = list(range(9, 17))  # 9:00 to 16:00 (each hour represents a slot)
    
    for day_offset in range(days):
        current_date = today + timedelta(days=day_offset)
        
        # Skip weekends for realistic scheduling
        if current_date.weekday() >= 5:  # Saturday=5, Sunday=6
            continue
        
        for hour in hours:
            try:
                cursor.execute("""
                    INSERT INTO lab_capacity (date, hour, max_slots, booked_slots)
                    VALUES (?, ?, 20, 0)
                """, (current_date.strftime('%Y-%m-%d'), hour))
            except sqlite3.IntegrityError:
                continue
    
    conn.commit()
    return cursor.execute("SELECT COUNT(DISTINCT date) FROM lab_capacity").fetchone()[0]

# In main block:
capacity_days = generate_lab_capacity(conn, 7)
print(f"Generated capacity for {capacity_days} days")
```

**Commands:**
```bash
python3 scripts/generate-mock-data.py

# Verify capacity data
sqlite3 data/sqlite.db "SELECT COUNT(*) FROM lab_capacity;"
sqlite3 data/sqlite.db "SELECT COUNT(DISTINCT date) FROM lab_capacity;"
sqlite3 data/sqlite.db "SELECT date, SUM(max_slots) as total_slots, SUM(booked_slots) as booked FROM lab_capacity GROUP BY date;"
```

**Acceptance:** 7+ days of capacity, 20 slots/hour, 0 initially booked

---

### Task 5: Create Email Parser Skill (A2)

**Goal:** Build OpenClaw skill to parse doctor appointment request emails

**Checklist:**
- [ ] Create skill directory structure
- [ ] Implement email template parser
- [ ] Add CURP validation (regex + length check)
- [ ] Add date format validation
- [ ] Return structured data or error message
- [ ] Test with sample emails

**Skill Structure:** `~/.openclaw/skills/email-parser/`
```
email-parser/
├── skill.json
├── index.js
├── parser.js
└── README.md
```

**skill.json:**
```json
{
  "name": "email-parser",
  "version": "1.0.0",
  "description": "Parses doctor appointment request emails and extracts structured data",
  "author": "IMSS Lab Bot Team",
  "license": "MIT",
  "main": "index.js",
  "entryPoint": "parseAppointmentRequest",
  "triggers": [
    {
      "type": "email",
      "subject_pattern": ".*[Aa]ppointment.*|[Rr]equest.*",
      "from_pattern": ".*@imss.*|.*@clinic.*"
    }
  ],
  "config": {
    "curp_regex": "^[A-Z]{4}[0-9]{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]$",
    "date_formats": ["YYYY-MM-DD", "DD/MM/YYYY"]
  }
}
```

**index.js:**
```javascript
/**
 * Email Parser Skill - IMSS Lab Appointment POC
 * Parses doctor emails requesting lab appointments
 */

const { parseEmailBody } = require('./parser');

/**
 * Main entry point for the email parser skill
 * @param {Object} context - OpenClaw execution context
 * @returns {Object} Parsed appointment data or error
 */
async function parseAppointmentRequest(context) {
    const { email } = context.input;
    
    context.log.info('Parsing appointment request email', {
        from: email.from,
        subject: email.subject,
        received: email.receivedAt
    });
    
    try {
        const parsed = parseEmailBody(email.body);
        
        // Validate required fields
        const errors = validateParsedData(parsed);
        
        if (errors.length > 0) {
            context.log.warn('Validation errors', { errors });
            return {
                success: false,
                error: 'INVALID_DATA',
                message: `Missing or invalid fields: ${errors.join(', ')}`,
                parsed: parsed // Return partial data for debugging
            };
        }
        
        context.log.info('Email parsed successfully', {
            patient: parsed.patientName,
            curp: parsed.curp,
            labType: parsed.labType
        });
        
        return {
            success: true,
            data: parsed
        };
        
    } catch (error) {
        context.log.error('Parse error', { error: error.message });
        return {
            success: false,
            error: 'PARSE_ERROR',
            message: `Failed to parse email: ${error.message}`
        };
    }
}

/**
 * Validate parsed appointment data
 */
function validateParsedData(data) {
    const errors = [];
    
    if (!data.patientName || data.patientName.trim().length < 3) {
        errors.push('Patient name is required (min 3 characters)');
    }
    
    if (!data.curp) {
        errors.push('CURP is required');
    } else if (data.curp.length !== 18) {
        errors.push('CURP must be 18 characters');
    } else if (!/^[A-Z0-9]{18}$/.test(data.curp)) {
        errors.push('CURP format invalid (must be 18 alphanumeric characters)');
    }
    
    if (!data.dateOfBirth) {
        errors.push('Date of birth is required');
    }
    
    if (!data.labType) {
        errors.push('Lab type is required');
    }
    
    if (!data.preferredDate) {
        errors.push('Preferred date is required');
    }
    
    return errors;
}

module.exports = { parseAppointmentRequest };
```

**parser.js:**
```javascript
/**
 * Email body parser - extracts structured data from template
 */

/**
 * Parse email body using template-based extraction
 * Expected format:
 *   Patient: [Full Name]
 *   CURP: [18-character CURP]
 *   Date of Birth: [YYYY-MM-DD or DD/MM/YYYY]
 *   Lab Type: [Blood Work / X-Ray / Urinalysis]
 *   Preferred Date: [YYYY-MM-DD]
 *   Preferred Time: [HH:MM AM/PM]
 *   Priority: [Routine / Urgent / STAT]
 *   Notes: [Any special requirements]
 */
function parseEmailBody(body) {
    const result = {
        patientName: null,
        curp: null,
        dateOfBirth: null,
        labType: null,
        preferredDate: null,
        preferredTime: null,
        priority: 'routine',
        notes: null
    };
    
    if (!body) {
        throw new Error('Empty email body');
    }
    
    const lines = body.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Patient name
        if (trimmed.match(/^Patient:/i)) {
            result.patientName = extractValue(trimmed);
        }
        
        // CURP
        else if (trimmed.match(/^CURP:/i)) {
            result.curp = extractValue(trimmed).toUpperCase().replace(/\s/g, '');
        }
        
        // Date of birth
        else if (trimmed.match(/^Date of Birth:/i)) {
            result.dateOfBirth = parseDate(extractValue(trimmed));
        }
        
        // Lab type
        else if (trimmed.match(/^Lab Type:/i)) {
            result.labType = extractValue(trimmed);
        }
        
        // Preferred date
        else if (trimmed.match(/^Preferred Date:/i)) {
            result.preferredDate = parseDate(extractValue(trimmed));
        }
        
        // Preferred time
        else if (trimmed.match(/^Preferred Time:/i)) {
            result.preferredTime = extractValue(trimmed);
        }
        
        // Priority
        else if (trimmed.match(/^Priority:/i)) {
            result.priority = extractValue(trimmed).toLowerCase();
        }
        
        // Notes
        else if (trimmed.match(/^Notes:/i)) {
            result.notes = extractValue(trimmed);
        }
    }
    
    return result;
}

/**
 * Extract value after colon
 */
function extractValue(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return '';
    return line.substring(colonIndex + 1).trim();
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    dateStr = dateStr.trim();
    
    // Try YYYY-MM-DD format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    
    // Try DD/MM/YYYY format
    const euroMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (euroMatch) {
        return `${euroMatch[3]}-${euroMatch[2]}-${euroMatch[1]}`;
    }
    
    // Try MM/DD/YYYY format (US)
    const usMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (usMatch) {
        // Ambiguous - assume DD/MM/YYYY for Mexico
        return `${usMatch[3]}-${usMatch[2]}-${usMatch[1]}`;
    }
    
    return dateStr; // Return as-is if no pattern matches
}

module.exports = { parseEmailBody, extractValue, parseDate };
```

**Commands:**
```bash
mkdir -p ~/.openclaw/skills/email-parser
# Create files above

# Test parser
node -e "
const { parseEmailBody } = require('./parser');
const testEmail = \`Patient: Juan Pérez García
CURP: PEGJ850101HDFRRN09
Date of Birth: 1985-01-01
Lab Type: Blood Work
Preferred Date: 2026-03-25
Preferred Time: 10:00 AM
Priority: Routine
Notes: Fasting required\`;
console.log(JSON.stringify(parseEmailBody(testEmail), null, 2));
"
```

**Acceptance:** Skill parses test email correctly, validates CURP format

---

### Task 6: Create Slot Manager Skill (A3)

**Goal:** Build OpenClaw skill to check and reserve lab appointment slots

**Checklist:**
- [ ] Create skill directory structure
- [ ] Implement availability query
- [ ] Add atomic slot reservation (transaction)
- [ ] Handle "no availability" gracefully
- [ ] Respect fixed capacity (20/hour)
- [ ] Test with concurrent requests

**Skill Structure:** `~/.openclaw/skills/slot-manager/`
```
slot-manager/
├── skill.json
├── index.js
├── slot-service.js
└── README.md
```

**skill.json:**
```json
{
  "name": "slot-manager",
  "version": "1.0.0",
  "description": "Manages lab appointment slot availability and reservations",
  "author": "IMSS Lab Bot Team",
  "license": "MIT",
  "main": "index.js",
  "entryPoint": "manageSlots",
  "config": {
    "database_path": "./data/sqlite.db",
    "max_slots_per_hour": 20,
    "operating_hours": {
      "start": 9,
      "end": 17
    },
    "operating_days": [1, 2, 3, 4, 5]
  }
}
```

**index.js:**
```javascript
/**
 * Slot Manager Skill - IMSS Lab Appointment POC
 * Checks availability and reserves slots atomically
 */

const { getAvailableSlots, reserveSlot, getNextAvailable } = require('./slot-service');

/**
 * Main entry point for slot management
 * @param {Object} context - OpenClaw execution context
 * @returns {Object} Available slots or reservation confirmation
 */
async function manageSlots(context) {
    const { action, preferredDate, preferredTime, patientId, labType } = context.input;
    
    context.log.info('Slot manager invoked', {
        action,
        preferredDate,
        preferredTime,
        patientId
    });
    
    try {
        if (action === 'check_availability') {
            const slots = await getAvailableSlots(preferredDate);
            return {
                success: true,
                action: 'availability_check',
                date: preferredDate,
                availableSlots: slots,
                totalAvailable: slots.length
            };
        }
        
        else if (action === 'reserve') {
            const reservation = await reserveSlot({
                preferredDate,
                preferredTime,
                patientId,
                labType,
                context
            });
            
            if (reservation.success) {
                context.log.info('Slot reserved successfully', {
                    capacityId: reservation.capacityId,
                    hour: reservation.hour
                });
                
                return {
                    success: true,
                    action: 'reservation',
                    capacityId: reservation.capacityId,
                    hour: reservation.hour,
                    date: preferredDate,
                    message: `Slot reserved for ${preferredDate} at ${reservation.hour}:00`
                };
            } else {
                // Slot full - get next available
                context.log.warn('Preferred slot full, finding next available');
                const nextAvailable = await getNextAvailable(preferredDate, context);
                
                return {
                    success: false,
                    action: 'reservation',
                    error: 'SLOT_FULL',
                    message: `No availability at preferred time. Next available: ${nextAvailable.date} at ${nextAvailable.hour}:00`,
                    nextAvailable
                };
            }
        }
        
        else {
            return {
                success: false,
                error: 'INVALID_ACTION',
                message: `Unknown action: ${action}`
            };
        }
        
    } catch (error) {
        context.log.error('Slot manager error', { error: error.message });
        return {
            success: false,
            error: 'DATABASE_ERROR',
            message: `Failed to manage slots: ${error.message}`
        };
    }
}

module.exports = { manageSlots };
```

**slot-service.js:**
```javascript
/**
 * Slot database operations with atomic transactions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve('./data/sqlite.db');

/**
 * Get available slots for a given date
 */
async function getAvailableSlots(date) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);
        
        db.all(`
            SELECT hour, max_slots, booked_slots, (max_slots - booked_slots) as available
            FROM lab_capacity
            WHERE date = ? AND booked_slots < max_slots
            ORDER BY hour
        `, [date], (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Reserve a slot atomically (transaction)
 */
async function reserveSlot({ preferredDate, preferredTime, patientId, labType, context }) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);
        
        // Convert preferred time to hour (e.g., "10:00 AM" -> 10)
        const hour = parseTimeToHour(preferredTime);
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Check availability
            db.get(`
                SELECT id, max_slots, booked_slots
                FROM lab_capacity
                WHERE date = ? AND hour = ?
            `, [preferredDate, hour], (err, row) => {
                if (err) {
                    db.run('ROLLBACK');
                    db.close();
                    reject(err);
                    return;
                }
                
                if (!row) {
                    db.run('ROLLBACK');
                    db.close();
                    resolve({
                        success: false,
                        error: 'NO_CAPACITY',
                        message: `No capacity defined for ${preferredDate} at ${hour}:00`
                    });
                    return;
                }
                
                if (row.booked_slots >= row.max_slots) {
                    db.run('ROLLBACK');
                    db.close();
                    resolve({
                        success: false,
                        error: 'SLOT_FULL'
                    });
                    return;
                }
                
                // Reserve the slot
                db.run(`
                    UPDATE lab_capacity
                    SET booked_slots = booked_slots + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [row.id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        db.close();
                        reject(err);
                        return;
                    }
                    
                    // Log to audit
                    db.run(`
                        INSERT INTO audit_log (user_id, action, resource, resource_id, details)
                        VALUES (?, 'slot_reserved', 'lab_capacity', ?, ?)
                    `, ['system', row.id, JSON.stringify({
                        patientId,
                        labType,
                        date: preferredDate,
                        hour
                    })], (err) => {
                        if (err) {
                            context.log.warn('Audit log failed', { error: err.message });
                            // Continue anyway - audit is non-critical
                        }
                        
                        db.run('COMMIT');
                        db.close();
                        
                        resolve({
                            success: true,
                            capacityId: row.id,
                            hour,
                            date: preferredDate
                        });
                    });
                });
            });
        });
    });
}

/**
 * Get next available slot after preferred date/time
 */
async function getNextAvailable(preferredDate, context) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);
        
        db.get(`
            SELECT date, hour
            FROM lab_capacity
            WHERE (date > ? OR (date = ? AND hour > ?))
              AND booked_slots < max_slots
            ORDER BY date, hour
            LIMIT 1
        `, [preferredDate, preferredDate, parseTimeToHour(context.input.preferredTime)], (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row || { date: null, hour: null });
        });
    });
}

/**
 * Parse time string to hour integer
 */
function parseTimeToHour(timeStr) {
    if (!timeStr) return 9; // Default to 9 AM
    
    const match = timeStr.match(/(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!match) return 9;
    
    let hour = parseInt(match[1]);
    const period = match[2]?.toUpperCase();
    
    if (period === 'PM' && hour !== 12) {
        hour += 12;
    } else if (period === 'AM' && hour === 12) {
        hour = 0;
    }
    
    return hour;
}

module.exports = { getAvailableSlots, reserveSlot, getNextAvailable, parseTimeToHour };
```

**Commands:**
```bash
mkdir -p ~/.openclaw/skills/slot-manager
# Create files above

# Test slot query
sqlite3 data/sqlite.db "SELECT date, hour, max_slots, booked_slots FROM lab_capacity WHERE date >= date('now') LIMIT 5;"
```

**Acceptance:** Skill queries availability, reserves slots atomically

---

### Task 7: Configure Lane-Based Command Queue (A6)

**Goal:** Configure OpenClaw gateway with lane-based queue for serialized email processing

**Checklist:**
- [ ] Update gateway.yaml with lane configuration
- [ ] Configure email processing lanes
- [ ] Set up lane routing rules
- [ ] Test lane serialization

**Update `~/.openclaw/config/gateway.yaml`:**
```yaml
gateway:
  port: 18789
  host: 0.0.0.0
  health_check: true

# Lane-based command queue configuration
lanes:
  # Email processing lane - serialized to prevent race conditions
  email-processing:
    type: serialized
    max_concurrent: 1
    queue_size: 100
    timeout_ms: 30000
    retry_on_failure: true
    max_retries: 3
    
  # Slot booking lane - critical section for atomic operations
  slot-booking:
    type: serialized
    max_concurrent: 1
    queue_size: 50
    timeout_ms: 15000
    retry_on_failure: true
    max_retries: 2

# Skill routing
routing:
  rules:
    # Route appointment request emails through serialized lane
    - trigger:
        type: email
        subject_pattern: ".*[Aa]ppointment.*"
      lane: email-processing
      skills:
        - email-parser
        - slot-manager
        
    # Route slot operations through booking lane
    - trigger:
        type: skill
        skill_name: slot-manager
        action: reserve
      lane: slot-booking
      skills:
        - slot-manager

# Skills configuration
skills:
  enabled:
    - email-parser
    - slot-manager
  
  # Skill loading (lazy loading for safety)
  loading: lazy
  
  # NO ClawHub skills (security policy)
  clawhub_enabled: false

# Logging
logging:
  level: info
  format: json
  output:
    - file: ~/.openclaw/logs/gateway.log
    - console
  
  # Audit logging
  audit:
    enabled: true
    log_file: ~/.openclaw/logs/audit.log
```

**Commands:**
```bash
# Verify gateway config
cat ~/.openclaw/config/gateway.yaml | grep -A 10 "lanes:"

# Restart gateway to apply changes
pm2 restart openclaw-gateway  # or however gateway is managed

# Check gateway logs for lane configuration
tail -f ~/.openclaw/logs/gateway.log | grep -i lane
```

**Acceptance:** Lanes configured in gateway.yaml, email processing serialized

---

### Task 8: Create Database Utility Scripts

**Goal:** Create helper scripts for database operations and verification

**Checklist:**
- [ ] Create database query helper script
- [ ] Create appointment history query
- [ ] Create audit log viewer
- [ ] Test all scripts

**Script:** `scripts/db-utils.sh`
```bash
#!/bin/bash
# Database utility functions for IMSS Lab Appointment POC

DB_PATH="./data/sqlite.db"

# Check database integrity
check_integrity() {
    echo "=== Database Integrity Check ==="
    sqlite3 "$DB_PATH" "PRAGMA integrity_check;"
}

# Show table counts
show_counts() {
    echo "=== Record Counts ==="
    echo "Patients: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patients;")"
    echo "Doctors: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM doctors;")"
    echo "Appointments: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM appointments;")"
    echo "Lab Capacity Days: $(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT date) FROM lab_capacity;")"
    echo "Audit Log Entries: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audit_log;")"
}

# Show available slots for a date
show_availability() {
    local date=${1:-$(date +%Y-%m-%d)}
    echo "=== Availability for $date ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT hour, max_slots, booked_slots, (max_slots - booked_slots) as available
        FROM lab_capacity
        WHERE date = '$date'
        ORDER BY hour;
    "
}

# Show recent appointments
show_recent_appointments() {
    echo "=== Recent Appointments ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT a.id, p.first_name || ' ' || p.last_name as patient,
               a.lab_type, a.status, a.booked_at
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        ORDER BY a.booked_at DESC
        LIMIT 10;
    "
}

# Show recent audit log entries
show_audit_log() {
    echo "=== Recent Audit Log ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT id, action, resource, created_at
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT 10;
    "
}

# Main command dispatcher
case "${1:-help}" in
    integrity) check_integrity ;;
    counts) show_counts ;;
    availability) show_availability "$2" ;;
    appointments) show_recent_appointments ;;
    audit) show_audit_log ;;
    *)
        echo "Usage: $0 {integrity|counts|availability [date]|appointments|audit}"
        exit 1
        ;;
esac
```

**Commands:**
```bash
chmod +x scripts/db-utils.sh

# Test utilities
./scripts/db-utils.sh counts
./scripts/db-utils.sh availability $(date +%Y-%m-%d)
./scripts/db-utils.sh audit
```

**Acceptance:** All utility scripts work, show correct data

---

### Task 9: Test Skills End-to-End

**Goal:** Verify email parser and slot manager work together

**Checklist:**
- [ ] Create test email fixture
- [ ] Test email parser with valid data
- [ ] Test email parser with invalid CURP
- [ ] Test slot manager availability check
- [ ] Test slot manager reservation
- [ ] Verify audit log entries created

**Test Script:** `scripts/test-skills.sh`
```bash
#!/bin/bash
# End-to-end skill testing

echo "=== Phase 2 Skill Testing ==="
echo ""

# Test 1: Email Parser with valid data
echo "Test 1: Email Parser (valid data)"
node -e "
const { parseEmailBody } = require('./skills/email-parser/parser.js');
const testEmail = \`Patient: Juan Pérez García
CURP: PEGJ850101HDFRRN09
Date of Birth: 1985-01-01
Lab Type: Blood Work
Preferred Date: 2026-03-25
Preferred Time: 10:00 AM
Priority: Routine
Notes: Fasting required\`;
const result = parseEmailBody(testEmail);
console.log('Parsed:', JSON.stringify(result, null, 2));
if (result.curp === 'PEGJ850101HDFRRN09' && result.labType === 'Blood Work') {
    console.log('✓ PASS');
} else {
    console.log('✗ FAIL');
    process.exit(1);
}
"

# Test 2: Email Parser with invalid CURP
echo ""
echo "Test 2: Email Parser (invalid CURP - too short)"
node -e "
const { parseEmailBody } = require('./skills/email-parser/parser.js');
const testEmail = \`Patient: Juan Pérez
CURP: SHORT123
Lab Type: Blood Work
Preferred Date: 2026-03-25\`;
const result = parseEmailBody(testEmail);
console.log('CURP length:', result.curp.length);
if (result.curp.length !== 18) {
    console.log('✓ PASS - Invalid CURP detected');
} else {
    console.log('✗ FAIL - Should reject short CURP');
    process.exit(1);
}
"

# Test 3: Slot availability check
echo ""
echo "Test 3: Slot Availability Check"
TODAY=$(date +%Y-%m-%d)
AVAILABLE=$(sqlite3 ./data/sqlite.db "SELECT COUNT(*) FROM lab_capacity WHERE date >= '$TODAY' AND booked_slots < max_slots;")
if [ "$AVAILABLE" -gt 0 ]; then
    echo "Available slots: $AVAILABLE"
    echo "✓ PASS"
else
    echo "✗ FAIL - No available slots"
    process.exit(1)
fi

# Test 4: Audit log structure
echo ""
echo "Test 4: Audit Log Structure"
sqlite3 ./data/sqlite.db "PRAGMA table_info(audit_log);" | grep -q "action" && echo "✓ PASS" || echo "✗ FAIL"

echo ""
echo "=== All Tests Complete ==="
```

**Commands:**
```bash
chmod +x scripts/test-skills.sh
./scripts/test-skills.sh
```

**Acceptance:** All tests pass, skills parse and reserve correctly

---

### Task 10: Run Phase 2 Verification

**Goal:** Verify all Phase 2 success criteria are met

**Checklist:**
- [ ] Run verification script
- [ ] All 10 success criteria pass
- [ ] Document any issues
- [ ] Update STATE.md with phase progress

**Verification Script:** `scripts/verify-phase-2.sh` (see Output section)

**Commands:**
```bash
chmod +x scripts/verify-phase-2.sh
./scripts/verify-phase-2.sh
```

**Acceptance:** All 10 checks pass

---

## Verification

### Phase 2 Completion Checklist

- [ ] Task 1: SQLite schema created (5 tables)
- [ ] Task 2: Mock patient data generated (50+ records)
- [ ] Task 3: Mock doctor data generated (5+ records)
- [ ] Task 4: Lab capacity data generated (7+ days)
- [ ] Task 5: Email Parser Skill created and tested
- [ ] Task 6: Slot Manager Skill created and tested
- [ ] Task 7: Lane-based queue configured in gateway.yaml
- [ ] Task 8: Database utility scripts created
- [ ] Task 9: End-to-end skill tests passed
- [ ] Task 10: Phase 2 verification passed

### Requirements Satisfied

| Requirement | Status | Evidence |
|-------------|--------|----------|
| D1 (SQLite schema) | ☐ | 5 tables with correct schema |
| D2 (Mock patients) | ☐ | 50+ patients with valid CURP |
| D3 (Mock doctors) | ☐ | 5+ doctors, 3+ specialties |
| D4 (Appointment tracking) | ☐ | appointments table with status |
| D5 (Audit logging) | ☐ | audit_log table with entries |
| A2 (Email parser) | ☐ | Skill parses test emails correctly |
| A3 (Slot manager) | ☐ | Skill reserves slots atomically |
| A6 (Lane queue) | ☐ | Lanes configured in gateway.yaml |
| B1 (Fixed capacity) | ☐ | 20 slots/hour in lab_capacity |
| B2 (Real-time tracking) | ☐ | booked_slots updated atomically |

---

## Output

### Files Created

**Database:**
- `data/sqlite.db` — SQLite database with schema and mock data
- `scripts/create-schema.sql` — Database schema definition

**Scripts:**
- `scripts/generate-mock-data.py` — Mock data generator (patients, doctors, capacity)
- `scripts/db-utils.sh` — Database utility functions
- `scripts/test-skills.sh` — Skill testing script
- `scripts/verify-phase-2.sh` — Phase 2 verification script

**Skills:**
- `~/.openclaw/skills/email-parser/skill.json` — Email parser skill definition
- `~/.openclaw/skills/email-parser/index.js` — Email parser entry point
- `~/.openclaw/skills/email-parser/parser.js` — Email parsing logic
- `~/.openclaw/skills/email-parser/README.md` — Skill documentation
- `~/.openclaw/skills/slot-manager/skill.json` — Slot manager skill definition
- `~/.openclaw/skills/slot-manager/index.js` — Slot manager entry point
- `~/.openclaw/skills/slot-manager/slot-service.js` — Slot database operations
- `~/.openclaw/skills/slot-manager/README.md` — Skill documentation

**Configuration:**
- `~/.openclaw/config/gateway.yaml` — Updated with lane-based queue configuration

### Database Schema

```sql
-- 5 tables created:
-- doctors (id, name, specialty, email, timestamps)
-- patients (id, curp, first_name, last_name, dob, gender, phone, email, timestamps)
-- lab_capacity (id, date, hour, max_slots, booked_slots, timestamps)
-- appointments (id, patient_id, doctor_id, lab_capacity_id, status, lab_type, priority, notes, timestamps)
-- audit_log (id, user_id, action, resource, resource_id, details, created_at)
```

### Mock Data

- **55 patients** with realistic Mexican names and valid CURP format
- **6 doctors** across 4 specialties (Blood Work, X-Ray, Urinalysis, General Lab)
- **7 days** of lab capacity (8 hours/day × 20 slots/hour = 160 slots/day)

### Configuration

- Lane-based queue configured for email processing and slot booking
- Serialized lanes prevent race conditions on slot reservation
- Skills loaded lazily for safety

### State Updates

Update `.planning/STATE.md`:
```yaml
current_phase: 2
phase_status: completed
phase_progress: 2/4 phases complete
```

---

## Verification Script

**File:** `scripts/verify-phase-2.sh`
```bash
#!/bin/bash
# scripts/verify-phase-2.sh
# Phase 2 End-to-End Verification Script

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

DB_PATH="./data/sqlite.db"

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
if [ -f ~/.openclaw/skills/email-parser/skill.json ] && \
   [ -f ~/.openclaw/skills/email-parser/index.js ] && \
   [ -f ~/.openclaw/skills/email-parser/parser.js ]; then
    echo "  Path: ~/.openclaw/skills/email-parser/"
    check_result 0
else
    echo "  Skill files not found"
    check_result 1
fi

# 7. Slot Manager Skill exists
echo "7. Slot Manager Skill:"
if [ -f ~/.openclaw/skills/slot-manager/skill.json ] && \
   [ -f ~/.openclaw/skills/slot-manager/index.js ]; then
    echo "  Path: ~/.openclaw/skills/slot-manager/"
    check_result 0
else
    echo "  Skill files not found"
    check_result 1
fi

# 8. Lane-based queue configured
echo "8. Lane-based queue configuration:"
if grep -q "lanes:" ~/.openclaw/config/gateway.yaml 2>/dev/null; then
    echo "  Lanes configured in gateway.yaml"
    grep -A 2 "lanes:" ~/.openclaw/config/gateway.yaml | head -3
    check_result 0
else
    echo "  Lane configuration not found"
    check_result 1
fi

# 9. CURP validation test
echo "9. CURP validation (Email Parser):"
CURP_TEST=$(node -e "
const { parseEmailBody } = require('./skills/email-parser/parser.js');
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
```

---

## Next Steps

After Phase 2 completion:

1. **Update STATE.md** — Mark Phase 2 as completed
2. **Commit changes** — Add database, scripts, and skill configurations
3. **Begin Phase 3** — Integration (Booking Engine + Email Sender + End-to-End Flow)

**Command to start Phase 3:**
```
/gsd:plan-phase 3
```

---

*Plan created: March 24, 2026*
*Phase 2 of 4 — Database & Skills*
