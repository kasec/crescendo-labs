# Email Parser Skill

Parses doctor appointment request emails for IMSS Lab Appointment POC.

## Features

- Extracts patient information from templated emails
- Validates CURP format (18 characters)
- Parses multiple date formats
- Returns structured data

## Expected Email Format

```
Patient: [Full Name]
CURP: [18-character CURP]
Date of Birth: [YYYY-MM-DD]
Lab Type: [Blood Work / X-Ray / Urinalysis]
Preferred Date: [YYYY-MM-DD]
Preferred Time: [HH:MM AM/PM]
Priority: [Routine / Urgent / STAT]
Notes: [Any special requirements]
```

## License

MIT
