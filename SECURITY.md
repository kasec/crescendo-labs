# Security Policy: IMSS Lab Appointment Bot

**Version:** 1.0  
**Effective Date:** March 24, 2026  
**Project:** Crescendo Labs - IMSS Lab Appointment Scheduling POC

---

## ⚠️ CRITICAL SECURITY WARNING

### Skill Auditing Policy

**DO NOT install skills from ClawHub.**

Research shows **10.8% of ClawHub skills are malicious** and may:
- Exfiltrate sensitive data
- Harvest credentials
- Make unauthorized API calls
- Access files without permission

### Approved Skills Only

Only use custom skills developed in-house for this project:

| Skill | Directory | Purpose |
|-------|-----------|---------|
| `email-parser` | `skills/email-parser/` | Parse appointment request emails |
| `slot-manager` | `skills/slot-manager/` | Manage available appointment slots |
| `booking-engine` | `skills/booking-engine/` | Handle appointment booking logic |
| `email-sender` | `skills/email-sender/` | Send confirmation emails |
| `audit-logger` | `skills/audit-logger/` | Log all operations for compliance |

### Skill Review Checklist

Before using ANY skill, verify:

- [ ] Code reviewed for data exfiltration patterns
- [ ] No external API calls to unknown domains
- [ ] No credential harvesting or storage
- [ ] No unauthorized file system access
- [ ] No network calls outside approved endpoints
- [ ] All dependencies audited for vulnerabilities

---

## OAuth Security

### Minimal Scopes Policy

The bot requests **ONLY** the following Gmail API scopes:

| Scope | Purpose | Justification |
|-------|---------|---------------|
| `gmail.readonly` | Read appointment request emails | Required to process incoming requests |
| `gmail.send` | Send confirmation emails | Required to respond to users |

**NEVER** request these scopes:
- `gmail.modify` - Not needed for read/send operations
- `gmail.compose` - Overly permissive
- `gmail.labels` - Not required for core functionality
- Any scope beyond `gmail.readonly` and `gmail.send`

### Service Account Requirements

- **Dedicated account only** - Never use personal Gmail
- Account naming: `lab-bot-{domain}@gmail.com`
- Separate Google Cloud project: `imss-lab-appointments`
- Credentials stored securely at: `~/.openclaw/credentials.json`

### Credential Storage

```bash
# Credentials file location
~/.openclaw/credentials.json

# Required permissions (600 = owner read/write only)
chmod 600 ~/.openclaw/credentials.json

# NEVER commit to git
# Added to .gitignore
```

### Token Management

- **Daily token refresh** via launchd agent (macOS) or cron (Linux)
- Scheduled at: 3:00 AM daily
- Alert on failure: Email sent to admin
- Manual regeneration: https://myaccount.google.com/permissions

---

## Rate Limiting & API Quotas

### Exponential Backoff Policy

To prevent Google API quota exhaustion and account suspension:

| Retry | Delay | Cumulative |
|-------|-------|------------|
| 1st | 5 seconds | 5s |
| 2nd | 10 seconds | 15s |
| 3rd | 15 seconds | 30s |

**Maximum retries:** 3  
**Action after max retries:** Fail and log error

### Rate Limit Monitoring

All rate limit events logged to: `~/.openclaw/logs/rate-limit.log`

Log format:
```
[YYYY-MM-DD HH:MM:SS] Rate limit hit. Retrying in {delay}s (attempt {n}/3)
```

---

## Network Security

### Gateway Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Port | 18789 | Dedicated port for OpenClaw Gateway |
| Host | 0.0.0.0 | All interfaces (configure firewall) |
| Health Check | Enabled | Monitor gateway status |

### Firewall Rules (Recommended)

```bash
# macOS - Allow incoming connections to port 18789
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /opt/homebrew/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /opt/homebrew/bin/node

# Or restrict to localhost only in gateway.yaml:
# gateway.host: 127.0.0.1
```

---

## Logging & Audit

### Log Locations

| Log | Path | Purpose |
|-----|------|---------|
| Gateway | `~/.openclaw/logs/gateway.log` | Gateway startup, errors |
| Rate Limit | `~/.openclaw/logs/rate-limit.log` | API rate limit events |
| Token Refresh | `~/.openclaw/logs/token-refresh.log` | OAuth token refresh status |

### Log Retention

- Active logs: Last 30 days
- Archive: Quarterly rotation
- Sensitive data: Redacted before logging

### Audit Trail Requirements

All operations must log:
- Timestamp (ISO 8601)
- Operation type
- User/email involved
- Success/failure status
- Error details (if failed)

---

## Incident Response

### If Security Incident Suspected

**Immediate Actions (within 1 hour):**

1. **Stop OpenClaw Gateway**
   ```bash
   # Find and kill gateway process
   lsof -ti :18789 | xargs kill -9
   ```

2. **Revoke OAuth Tokens**
   - Go to: https://myaccount.google.com/permissions
   - Revoke "IMSS Lab Appointments Bot"
   - Delete all stored tokens: `rm ~/.openclaw/credentials.json`

3. **Preserve Evidence**
   ```bash
   # Copy logs for analysis
   cp -r ~/.openclaw/logs/ ~/security-incident-$(date +%Y%m%d)/
   ```

4. **Review Audit Logs**
   - Check `~/.openclaw/logs/` for suspicious activity
   - Look for: Unusual email patterns, unknown recipients, high volume

5. **Rotate All Credentials**
   - Create new Gmail service account
   - Generate new OAuth credentials
   - Update all configurations

6. **Notify Stakeholders**
   - Email: Security team
   - Include: Timeline, impact assessment, remediation steps

### Incident Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Data breach, credential theft | Immediate (< 1 hour) |
| P2 | Unauthorized API access | Within 4 hours |
| P3 | Rate limit abuse, quota exhaustion | Within 24 hours |
| P4 | Configuration drift, policy violation | Within 7 days |

---

## Compliance

### Data Protection

- **No PHI stored** - Appointment details processed in-memory only
- **No PII logged** - Email addresses redacted in logs
- **Encryption at rest** - Credentials file permissions (600)
- **Encryption in transit** - HTTPS for all API calls

### Access Control

- **Single operator boundary** - Personal deployment only
- **No multi-tenant support** - Shared inbox requires separate trust boundaries
- **Tool access minimal** - Only email read/send enabled

### Security Audits

Run regular security audits:

```bash
# Monthly security audit
openclaw security audit --deep

# Auto-fix where possible
openclaw security audit --fix

# Review skill permissions
openclaw skills list --verbose
```

---

## Contact

**Security Questions:** security@crescendo-labs.internal  
**Incident Reports:** security-incident@crescendo-labs.internal  
**Emergency:** +1-XXX-XXX-XXXX (Security Team Lead)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-24 | Initial security policy |

---

*This document is part of the IMSS Lab Appointment Scheduling POC security baseline.*
*Review and update quarterly or after any security incident.*
