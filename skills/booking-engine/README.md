# Booking Engine Skill

IMSS Lab Appointment Booking Engine - Coordinates the full appointment booking flow.

## Overview

This skill orchestrates the complete booking process:
1. Receives parsed email data from Email Parser Skill
2. Executes atomic booking transaction via Booking Service
3. Handles errors with comprehensive error handlers (H1-H5)
4. Triggers Email Sender Skill for confirmations/errors
5. Logs all actions to audit_log table

## Files

- `skill.json` - Skill metadata and dependencies
- `index.js` - Main entry point (processBookingRequest)
- `booking-service.js` - Core booking logic with atomic transactions
- `error-handler.js` - Error handling for H1-H5 error types
- `audit-logger.js` - Audit logging module
- `templates.js` - Email templates

## Dependencies

- email-parser (A2)
- slot-manager (A3)

## Error Types Handled

- **H1**: Slot full - offers next available slot
- **H2**: Invalid data - replies with template example
- **H3**: Database errors - graceful failure with retry
- **H4**: OAuth expired - alerts admin
- **H5**: Gmail API failures - retry with exponential backoff

## Usage

```javascript
const { processBookingRequest } = require('./index');

const context = {
    input: {
        parsedData: { ... },
        email: { from: 'doctor@imss.mx', ... },
        doctorInfo: { name: 'Dr. Smith' }
    },
    log: console
};

const result = await processBookingRequest(context);
```

## Atomic Transaction Flow

1. BEGIN TRANSACTION
2. Find/create patient
3. Find doctor
4. Reserve slot
5. Create appointment
6. Update capacity
7. COMMIT (or ROLLBACK on failure)

## Audit Logging

All actions logged:
- booking_initiated
- slot_reserved
- appointment_created
- confirmation_email_sent
- error_occurred
- rollback_performed
