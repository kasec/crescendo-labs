# PLAN.md — Phase 1: Foundation

**Phase:** 1 of 4
**Goal:** OpenClaw Gateway running locally with Gmail integration working
**Duration:** Day 1-2
**Mode:** YOLO (auto-approve execution)

---

## Objective

Set up the foundational infrastructure for the IMSS Lab Appointment Scheduling POC:
1. Install and configure OpenClaw Gateway with Node.js 22
2. Set up Gmail OAuth with minimal scopes using a dedicated service account
3. Install gogcli v0.11 and verify email send/receive
4. Implement rate limiting wrapper and security baseline

This plan satisfies **7 requirements**: E1, E5, S1, S2, S4, S5, A1

---

## Execution Context

### Phase Requirements (from ROADMAP.md)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| **E1** | System reads doctor emails via Gmail API | gogcli v0.11 installed, OAuth configured with minimal scopes, emails polled with exponential backoff |
| **E5** | Rate limiting on email operations | Exponential backoff on 429 errors, max 3 retries, daily token refresh cron job |
| **S1** | Minimal OAuth scopes | Only `gmail.readonly` and `gmail.send` requested |
| **S2** | Dedicated service account | Bot email (not personal Gmail), separate Google Cloud project |
| **S4** | Rate limiting wrapper | Bash wrapper around gogcli with exponential backoff |
| **S5** | Skill auditing | NO ClawHub skills installed, all skills audited |
| **A1** | OpenClaw Gateway running | Node.js 22+, OpenClaw 2026.2.26+, Gateway on port 18789, health check responding |

### Success Criteria (Observable Behaviors)

- [ ] `openclaw --version` returns 2026.2.26+
- [ ] Gateway health check responds at `http://localhost:18789/health`
- [ ] `gog auth status` shows valid OAuth tokens
- [ ] Test email sent successfully via `gog send`
- [ ] Test email read successfully via `gog read`
- [ ] Rate limiting wrapper script exists and handles 429 errors
- [ ] Token refresh cron job scheduled

### Key Constraints

- **Node.js 22.12.0+ required** (Node 24 causes memory sync failures)
- **Minimal OAuth scopes** (`gmail.readonly`, `gmail.send` only)
- **Dedicated service account** (never use personal Gmail)
- **NO ClawHub skills** (10.8% malicious risk)
- **Exponential backoff** required for Gmail API rate limits

### Research Context

From STACK.md:
- gogcli v0.11.0 is the recommended Gmail CLI tool
- OpenClaw 2026.2.26+ is the minimum stable version
- Rate limiting: 5s, 10s, 15s delays for retries (max 3)
- Daily token refresh via cron: `@daily gog auth refresh`

From PITFALLS.md:
- Critical: Google account suspension from bot-like polling
- Critical: OAuth token expiration after 60 minutes
- Prevention: Dedicated service account + minimal scopes + exponential backoff

---

## Tasks

### Task 1: Verify Prerequisites

**Goal:** Ensure system has required tools installed

**Checklist:**
- [ ] Check Node.js version (must be 22.x, not 24.x)
- [ ] Check npm version
- [ ] Check Docker version (for later phases)
- [ ] Verify port 18789 is available

**Commands:**
```bash
node --version  # Must be v22.x
npm --version
docker --version
lsof -i :18789  # Should return nothing (port free)
```

**Acceptance:** Node.js 22.12.0+ confirmed, port 18789 available

---

### Task 2: Install OpenClaw Gateway

**Goal:** Install OpenClaw 2026.2.26+ and verify installation

**Checklist:**
- [ ] Install OpenClaw via official installer
- [ ] Verify version is 2026.2.26+
- [ ] Initialize OpenClaw configuration
- [ ] Configure gateway to listen on port 18789

**Commands:**
```bash
# Install OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify installation
openclaw --version  # Should be >= 2026.2.26

# Initialize configuration
cd ~/.openclaw
npm install
npm run build
```

**Configuration:**
Create `~/.openclaw/config/gateway.yaml`:
```yaml
gateway:
  port: 18789
  host: 0.0.0.0
  health_check: true
```

**Acceptance:** `openclaw --version` returns 2026.2.26+, config file created

---

### Task 3: Create Dedicated Service Account

**Goal:** Set up dedicated Gmail account for the bot (not personal Gmail)

**Checklist:**
- [ ] Create new Gmail account: `lab-bot-{yourdomain}@gmail.com`
- [ ] Create Google Cloud project
- [ ] Enable Gmail API
- [ ] Create OAuth 2.0 credentials
- [ ] Download credentials JSON

**Steps:**
1. Go to https://gmail.com and create new account
2. Go to https://console.cloud.google.com/
3. Create new project: `imss-lab-appointments`
4. Enable Gmail API: `APIs & Services > Library > Gmail API`
5. Create OAuth credentials: `APIs & Services > Credentials > OAuth 2.0 Client ID`
6. Download credentials JSON to `~/.openclaw/credentials.json`

**Acceptance:** Credentials JSON file exists, service account email documented

---

### Task 4: Configure Gmail OAuth with Minimal Scopes

**Goal:** Authenticate OpenClaw with Gmail using only required scopes

**Checklist:**
- [ ] Configure OAuth scopes: `gmail.readonly`, `gmail.send`
- [ ] Run OAuth flow to get access tokens
- [ ] Verify tokens are stored and persisting
- [ ] Test token refresh mechanism

**Commands:**
```bash
# Authenticate with minimal scopes
gog auth --scope gmail.readonly,gmail.send

# Check auth status
gog auth status
```

**Configuration:**
Add to `~/.openclaw/config/gateway.yaml`:
```yaml
gmail:
  service_account: lab-bot-{yourdomain}@gmail.com
  scopes:
    - gmail.readonly
    - gmail.send
  credentials_file: ~/.openclaw/credentials.json
```

**Acceptance:** `gog auth status` shows valid tokens, scopes are minimal

---

### Task 5: Install gogcli v0.11

**Goal:** Install Gmail CLI tool and verify send/receive

**Checklist:**
- [ ] Install gogcli v0.11.0
- [ ] Test sending email
- [ ] Test reading emails
- [ ] Verify OAuth tokens work

**Commands:**
```bash
# Install gogcli
curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Verify installation
gog --version

# Test send email
echo "Test email from IMSS Lab Bot" | gog send --to your-personal-email@gmail.com --subject "Test from IMSS Lab Bot"

# Test read emails
gog read --max 5
```

**Acceptance:** Email sent successfully, emails readable via gog

---

### Task 6: Create Rate Limiting Wrapper

**Goal:** Create bash wrapper script with exponential backoff for Gmail API calls

**Checklist:**
- [ ] Create wrapper script at `~/.openclaw/scripts/gog-wrapper.sh`
- [ ] Implement exponential backoff (5s, 10s, 15s)
- [ ] Max 3 retries before failing
- [ ] Log all rate limit events
- [ ] Make script executable

**Script:**
```bash
#!/bin/bash
# ~/.openclaw/scripts/gog-wrapper.sh

MAX_RETRIES=3
DELAYS=(5 10 15)

for i in $(seq 1 $MAX_RETRIES); do
  gog "$@"
  exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    exit 0
  fi
  
  # Check if rate limit error (429)
  if [ $exit_code -eq 429 ] || grep -q "rate limit" <<< "$(gog "$@" 2>&1)"; then
    delay=${DELAYS[$((i-1))]}
    echo "[$(date)] Rate limit hit. Retrying in ${delay}s (attempt $i/$MAX_RETRIES)" >> ~/.openclaw/logs/rate-limit.log
    sleep $delay
  else
    # Non-retryable error
    exit $exit_code
  fi
done

echo "[$(date)] Max retries exceeded" >> ~/.openclaw/logs/rate-limit.log
exit 1
```

**Commands:**
```bash
mkdir -p ~/.openclaw/scripts ~/.openclaw/logs
chmod +x ~/.openclaw/scripts/gog-wrapper.sh
```

**Acceptance:** Wrapper script exists, executable, handles 429 errors

---

### Task 7: Configure Daily Token Refresh Cron Job

**Goal:** Prevent OAuth token expiration with daily refresh

**Checklist:**
- [ ] Create token refresh script
- [ ] Add cron job for daily refresh
- [ ] Configure alert on refresh failure
- [ ] Document manual regeneration process

**Script:** `~/.openclaw/scripts/refresh-token.sh`
```bash
#!/bin/bash
# Daily token refresh

echo "[$(date)] Refreshing Gmail OAuth token..." >> ~/.openclaw/logs/token-refresh.log

gog auth refresh >> ~/.openclaw/logs/token-refresh.log 2>&1

if [ $? -ne 0 ]; then
  echo "[$(date)] ERROR: Token refresh failed" >> ~/.openclaw/logs/token-refresh.log
  # Send alert email to admin
  echo "IMSS Lab Bot: OAuth token refresh failed. Manual intervention required." | \
    gog send --to admin@yourdomain.com --subject "ALERT: OAuth Token Refresh Failed"
  exit 1
fi

echo "[$(date)] Token refresh successful" >> ~/.openclaw/logs/token-refresh.log
```

**Cron job:**
```bash
# Add to crontab (crontab -e)
@daily /home/$USER/.openclaw/scripts/refresh-token.sh
```

**Acceptance:** Cron job scheduled, refresh script tested

---

### Task 8: Document Security Policy

**Goal:** Create security policy document prohibiting ClawHub skills

**Checklist:**
- [ ] Create SECURITY.md in project root
- [ ] Document skill auditing policy
- [ ] List prohibited actions (no ClawHub installs)
- [ ] Document OAuth scope restrictions
- [ ] Add incident response procedure

**File:** `SECURITY.md`
```markdown
# Security Policy: IMSS Lab Appointment Bot

## Skill Auditing Policy

**CRITICAL:** DO NOT install skills from ClawHub.

Research shows 10.8% of ClawHub skills are malicious and may exfiltrate data.

### Approved Skills Only

Only use custom skills developed in-house:
- `email-parser/`
- `slot-manager/`
- `booking-engine/`
- `email-sender/`
- `audit-logger/`

### Skill Review Checklist

Before using any skill:
- [ ] Code reviewed for data exfiltration
- [ ] No external API calls to unknown domains
- [ ] No credential harvesting
- [ ] No unauthorized file access

## OAuth Security

- Minimal scopes: `gmail.readonly`, `gmail.send` ONLY
- Dedicated service account (never personal Gmail)
- Daily token refresh
- Credentials stored in `~/.openclaw/credentials.json` (not committed to git)

## Incident Response

If security incident suspected:
1. Stop OpenClaw Gateway immediately
2. Revoke OAuth tokens: https://myaccount.google.com/permissions
3. Review audit logs: `~/.openclaw/logs/`
4. Rotate all credentials
```

**Acceptance:** SECURITY.md exists, policy documented

---

### Task 9: Start and Test OpenClaw Gateway

**Goal:** Start Gateway and verify health check

**Checklist:**
- [ ] Start OpenClaw Gateway
- [ ] Verify listening on port 18789
- [ ] Test health check endpoint
- [ ] Verify logs show no errors

**Commands:**
```bash
# Start Gateway
cd ~/.openclaw
npm start &

# Wait for startup
sleep 5

# Check if running
lsof -i :18789

# Test health check
curl http://localhost:18789/health

# Check logs
tail -f ~/.openclaw/logs/gateway.log
```

**Expected health check response:**
```json
{
  "status": "healthy",
  "version": "2026.2.26",
  "uptime": "00:00:05",
  "port": 18789
}
```

**Acceptance:** Health check returns 200 OK with status "healthy"

---

### Task 10: Run End-to-End Verification

**Goal:** Verify all Phase 1 success criteria are met

**Checklist:**
- [ ] Run verification script
- [ ] All 7 success criteria pass
- [ ] Document any issues
- [ ] Update STATE.md with phase progress

**Verification Script:** `scripts/verify-phase-1.sh`
```bash
#!/bin/bash

echo "=== Phase 1 Verification ==="
echo ""

# 1. OpenClaw version
echo -n "1. OpenClaw version: "
openclaw --version

# 2. Gateway health check
echo -n "2. Gateway health check: "
curl -s http://localhost:18789/health | jq -r '.status'

# 3. OAuth status
echo -n "3. OAuth status: "
gog auth status | grep -o "valid\|expired"

# 4. Test send email
echo -n "4. Test send email: "
echo "Phase 1 verification test" | gog send --to your-personal-email@gmail.com --subject "Phase 1 Test" && echo "PASS" || echo "FAIL"

# 5. Test read email
echo -n "5. Test read email: "
gog read --max 1 > /dev/null && echo "PASS" || echo "FAIL"

# 6. Rate limiting wrapper exists
echo -n "6. Rate limiting wrapper: "
[ -x ~/.openclaw/scripts/gog-wrapper.sh ] && echo "PASS" || echo "FAIL"

# 7. Cron job scheduled
echo -n "7. Token refresh cron: "
crontab -l | grep -q "refresh-token.sh" && echo "PASS" || echo "FAIL"

echo ""
echo "=== Verification Complete ==="
```

**Acceptance:** All 7 checks pass

---

## Verification

### Phase 1 Completion Checklist

- [ ] Task 1: Prerequisites verified
- [ ] Task 2: OpenClaw installed (v2026.2.26+)
- [ ] Task 3: Service account created
- [ ] Task 4: OAuth configured with minimal scopes
- [ ] Task 5: gogcli installed and tested
- [ ] Task 6: Rate limiting wrapper created
- [ ] Task 7: Daily token refresh cron job scheduled
- [ ] Task 8: Security policy documented
- [ ] Task 9: Gateway running and healthy
- [ ] Task 10: End-to-end verification passed

### Requirements Satisfied

| Requirement | Status | Evidence |
|-------------|--------|----------|
| E1 (Email via Gmail API) | ☐ | gogcli installed, OAuth configured |
| E5 (Rate limiting) | ☐ | Wrapper script with backoff |
| S1 (Minimal scopes) | ☐ | Only gmail.readonly + gmail.send |
| S2 (Service account) | ☐ | Dedicated bot email created |
| S4 (Rate limiting wrapper) | ☐ | gog-wrapper.sh exists |
| S5 (Skill auditing) | ☐ | SECURITY.md documents policy |
| A1 (Gateway running) | ☐ | Health check responds |

---

## Output

### Files Created

- `~/.openclaw/config/gateway.yaml` — OpenClaw Gateway configuration
- `~/.openclaw/credentials.json` — OAuth credentials (NOT committed to git)
- `~/.openclaw/scripts/gog-wrapper.sh` — Rate limiting wrapper
- `~/.openclaw/scripts/refresh-token.sh` — Daily token refresh
- `SECURITY.md` — Security policy document
- `scripts/verify-phase-1.sh` — Verification script

### Configuration

- OpenClaw Gateway listening on port 18789
- Gmail OAuth with minimal scopes
- Rate limiting with exponential backoff
- Daily token refresh cron job

### State Updates

Update `.planning/STATE.md`:
```yaml
current_phase: 1
phase_status: completed
phase_progress: 1/4 phases complete
```

---

## Next Steps

After Phase 1 completion:

1. **Update STATE.md** — Mark Phase 1 as completed
2. **Commit changes** — Add configuration files (exclude credentials.json)
3. **Begin Phase 2** — Database & Skills (SQLite schema + 3 core skills)

**Command to start Phase 2:**
```
/gsd:plan-phase 2
```

---

*Plan created: March 23, 2026*
*Phase 1 of 4 — Foundation*
