# Email Sender Skill

IMSS Lab Appointment Email Sender - Sends confirmation and error emails via Gmail API.

## Overview

This skill handles all email sending for the booking system:
1. Confirmation emails for successful bookings
2. Error emails for failed bookings (invalid data, no availability, etc.)
3. Retry logic with exponential backoff for Gmail API errors
4. Rate limiting to avoid 429 errors

## Files

- `skill.json` - Skill metadata and triggers
- `index.js` - Main entry point (sendEmail)
- `sender-service.js` - Email sending service with gogcli integration
- `email-templates.js` - Email templates
- `README.md` - This file

## Dependencies

- gogcli v0.12.0+ (Gmail CLI tool)
- Gmail OAuth credentials

## Email Types

- **Confirmation**: Booking confirmed with appointment details
- **Error - Invalid Data**: Missing or invalid fields
- **Error - No Availability**: No slots in 7 days
- **Error - Slot Full**: Alternative slot offered
- **Error - Database**: Temporary DB error
- **Error - System**: Unknown system error

## Retry Logic

- Max retries: 3
- Backoff schedule: 5s, 10s, 15s
- Retryable errors: 429 (rate limit), 500/502/503 (server errors), timeout
- Non-retryable: 401 (unauthorized), 403 (forbidden), invalid request

## Usage

```javascript
const { sendEmail } = require('./index');

const context = {
    input: {
        email: {
            to: 'doctor@imss.mx',
            subject: 'Cita Confirmada',
            body: '...',
            threadId: 'optional-thread-id'
        },
        appointmentId: 123
    },
    log: console
};

const result = await sendEmail(context);
```

## Gmail API Integration

Uses gogcli for sending:
```bash
echo "<mime_message>" | gogcli gmail send [--thread_id <id>]
```
