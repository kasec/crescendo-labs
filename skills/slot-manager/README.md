# Slot Manager Skill

Manages lab appointment slot availability and reservations for IMSS Lab POC.

## Features

- Queries lab_capacity table for available slots
- Atomic slot reservation with transactions
- Prevents overbooking (20 slots/hour max)
- Returns next available slot if preferred is full

## Configuration

- Max slots per hour: 20
- Operating hours: 9:00 - 17:00
- Operating days: Monday - Friday

## Usage

```javascript
const { manageSlots } = require('./index.js');

// Check availability
const result = await manageSlots({
    input: {
        action: 'check_availability',
        preferredDate: '2026-03-25'
    },
    log: console
});

// Reserve slot
const reservation = await manageSlots({
    input: {
        action: 'reserve',
        preferredDate: '2026-03-25',
        preferredTime: '10:00 AM',
        patientId: 1,
        labType: 'Blood Work'
    },
    log: console
});
```

## License

MIT
