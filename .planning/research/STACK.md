# Stack Research: Healthcare Appointment Scheduling with OpenClaw

**Research Date:** March 23, 2026  
**Project:** IMSS Lab Appointment Scheduling POC  
**Target Deployment:** Docker (Local) → VPS (Production)  
**Confidence Level:** HIGH (based on 2026 sources)

---

## Executive Summary

This document defines the **standard 2025-2026 stack** for building an OpenClaw-based email appointment scheduling system for Mexican healthcare. All recommendations are based on current production deployments and official OpenClaw documentation (February-March 2026).

### Key Decisions at a Glance

| Component | Choice | Confidence |
|-----------|--------|------------|
| **Runtime** | Node.js 22.12.0+ (LTS) | HIGH |
| **Database** | SQLite 3.40+ with sqlite-vec | HIGH |
| **Email Integration** | gogcli v0.11.0 (Gmail API) | HIGH |
| **Container** | Docker 20.10+ with security hardening | HIGH |
| **AI Models** | GPT-5.2 / Claude 3.5 Sonnet | MEDIUM |
| **Communication** | Gmail + WhatsApp Business API | MEDIUM |

---

## 1. Core Runtime Stack

### 1.1 Node.js (Primary Runtime)

**Recommended Version:** `Node.js 22.12.0+ (LTS)`

```bash
# Installation via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
nvm alias default 22
```

**Why Node.js 22?**
- **Hard requirement** for OpenClaw Gateway (v2026.2.26+)
- Node.js 24 has known issues with MEMORY_SYNC_FAILURES
- Node.js 20 is minimum supported but not recommended
- Includes security patch CVE-2026-21636

**What NOT to Use:**
- ❌ **Node.js 24.x** - Causes memory sync failures and build issues
- ❌ **Python-only deployments** - OpenClaw Gateway requires Node.js runtime
- ❌ **Node.js < 20** - Unsupported, missing critical features

**Confidence:** HIGH  
**Source:** OpenClaw Complete Guide 2026, A-bots (March 4, 2026)

---

### 1.2 OpenClaw Framework

**Recommended Version:** `openclaw@latest` (minimum: 2026.2.26)

```bash
# Quick install
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify installation
openclaw --version  # Should be >= 2026.2.26

# Manual installation
git clone https://github.com/openclaw/openclaw.git ~/.openclaw
cd ~/.openclaw
npm install
npm run build
```

**Key Components:**
- **Gateway** - Multi-channel communication (WhatsApp, Telegram, Gmail)
- **Harness** - AI agent execution environment
- **Memory System** - SQLite + Markdown for conversation history
- **Skills Hub** - Extensible capability modules (ClawHub)

**Critical Security Note:**
> 10.8% of ClawHub skills identified as malicious. **ALWAYS fork and audit skills before installing.**

**Confidence:** HIGH  
**Source:** OpenClaw security reports (February 2026)

---

## 2. Database Layer

### 2.1 SQLite (Primary Database)

**Recommended Version:** `SQLite 3.40+` with `sqlite-vec` extension

**Default Location:**
```
~/.openclaw/memory/main.sqlite
```

**Why SQLite for POC?**
- ✅ **Zero configuration** - Works out of the box
- ✅ **Embedded** - No separate database server required
- ✅ **Vector search** - sqlite-vec extension for semantic memory
- ✅ **Docker-friendly** - Single file, easy volume mounts
- ✅ **Backup simplicity** - Copy single file for full backup
- ✅ **Perfect for single-instance deployments**

**SQLite Configuration:**
```yaml
# ~/.openclaw/config.yaml
memory:
  backend: "sqlite"  # Default, stores in ~/.openclaw/memory/main.sqlite
  
memorySearch:
  query:
    hybrid:
      enabled: true
      vectorWeight: 0.7
      textWeight: 0.3
      candidateMultiplier: 4
```

**sqlite-vec Extension:**
- Accelerates vector similarity searches
- Stores embeddings in SQLite virtual tables (vec0)
- Enables semantic search over conversation history
- Bundled with OpenClaw by default

**Database Schema (Application Tables):**

For the IMSS appointment system, you'll create additional tables:

```sql
-- Patients table
CREATE TABLE patients (
    patient_id TEXT PRIMARY KEY,
    curp VARCHAR(18) UNIQUE,  -- Mexican ID
    full_name VARCHAR(200),
    date_of_birth DATE,
    gender VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    imss_number VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
    appointment_id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(patient_id),
    lab_type VARCHAR(100),  -- Blood work, X-ray, etc.
    status VARCHAR(50),     -- scheduled, completed, cancelled
    scheduled_time DATETIME,
    duration_minutes INTEGER DEFAULT 15,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lab capacity table
CREATE TABLE lab_capacity (
    date DATE,
    hour INTEGER,  -- 9-16 (9 AM to 5 PM)
    max_capacity INTEGER DEFAULT 20,
    booked INTEGER DEFAULT 0,
    PRIMARY KEY (date, hour)
);

-- Audit log (HIPAA compliance)
CREATE TABLE audit_log (
    log_id TEXT PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);
```

**What NOT to Use (for POC):**
- ❌ **PostgreSQL** - Overkill for single-instance POC, adds operational complexity
- ❌ **MySQL** - Same as PostgreSQL, unnecessary for demo
- ❌ **MongoDB** - No advantage for structured appointment data
- ❌ **Cloud databases** - Adds latency, cost, and complexity for local demo

**When to Migrate to PostgreSQL:**
- Multiple concurrent OpenClaw instances (SQLITE_BUSY errors)
- Need for advanced concurrency control
- Production deployment with >1000 daily appointments

**Confidence:** HIGH  
**Source:** OpenClaw Complete Guide 2026, arXiv paper (March 2026)

---

### 2.2 Memory Architecture

OpenClaw uses a **hybrid storage approach**:

```
┌─────────────────────────────────────────┐
│         MEMORY SYSTEM                    │
├─────────────────────────────────────────┤
│  Hot Path (Active Context)              │
│  - Daily logs: ~/.openclaw/memory/YYYY-MM-DD.md
│  - Format: Markdown transcripts          │
├─────────────────────────────────────────┤
│  Cold Path (Long-term Memory)           │
│  - Vector embeddings: main.sqlite (sqlite-vec)
│  - Full-text search: FTS5 extension      │
└─────────────────────────────────────────┘
```

**MEMORY.md** - Long-term facts about patients, doctors, lab rules  
**Daily logs** - Session transcripts with timestamps

**Confidence:** HIGH

---

## 3. Email Integration Stack

### 3.1 Gmail API Integration (Recommended)

**Tool:** `gogcli v0.11.0` (Google Workspace CLI)

**Installation:**
```bash
# macOS
brew install steipete/tap/gogcli

# Linux (manual)
cd /tmp
wget https://github.com/steipete/gogcli/releases/download/v0.11.0/gogcli_0.11.0_linux_amd64.tar.gz
tar -xzf gogcli_0.11.0_linux_amd64.tar.gz
sudo install -m 0755 gog /usr/local/bin/gog
gog --version  # Verify: v0.11.0
```

**Why gogcli?**
- ✅ **Official Gmail API** - Better than IMAP (threading, labels, real-time)
- ✅ **Google Cloud Pub/Sub** - Real-time email delivery via webhooks
- ✅ **OpenClaw ClawHub skill** - Pre-built integration available
- ✅ **Active maintenance** - Regular updates, good documentation
- ✅ **Full Google Workspace support** - Gmail, Calendar, Drive, Sheets

**OAuth Setup Steps:**

1. **Create Google Cloud Project**
   ```
   Project name: "IMSS Lab Appointments"
   ```

2. **Enable APIs**
   - Gmail API (required)
   - Google Calendar API (for lab scheduling)
   - Cloud Pub/Sub API (for real-time delivery)

3. **Configure OAuth Consent Screen**
   ```
   User type: External
   App name: "IMSS Lab Appointment Bot"
   Support email: your-bot-email@gmail.com
   ```

4. **Create OAuth Credentials**
   ```
   Application type: Desktop app
   Download: google-credentials.json
   ```

5. **Minimal OAuth Scopes** (Security Best Practice)
   ```json
   {
     "scopes": [
       "https://www.googleapis.com/auth/gmail.modify",
       "https://www.googleapis.com/auth/calendar.events"
     ]
   }
   ```

**Scope Recommendations:**

| Use Case | Scope | Rationale |
|----------|-------|-----------|
| **Read emails** | `gmail.readonly` | Least privilege |
| **Send emails** | `gmail.send` | Send-only, no read access |
| **Full mailbox** | `gmail.modify` | Read, send, delete (recommended for POC) |
| **Calendar** | `calendar.events` | Manage lab appointments |

**What NOT to Use:**
- ❌ **gmail scope "full"** - Overprivileged, includes delete without need
- ❌ **Primary personal Gmail** - Use dedicated bot account only
- ❌ **App passwords** - Less secure than OAuth, deprecated

**Configuration Files:**

```bash
# OAuth credentials (secure permissions)
~/.config/gogcli/credentials.json
chmod 600 ~/.config/gogcli/credentials.json

# OpenClaw adapter config
~/.openclaw/adapters/google/config.json
{
  "credentials_path": "~/.openclaw/credentials/google-credentials.json",
  "scopes": [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.events"
  ],
  "redirect_uri": "http://localhost:8080"
}
```

**Authenticate gogcli:**
```bash
gog auth credentials ~/.config/gogcli/credentials.json
gog auth add your-bot-email@gmail.com --services gmail,calendar
```

**Environment Variables:**
```bash
export GOG_KEYRING_PASSWORD="your-secure-passphrase"
```

**Confidence:** HIGH  
**Source:** DigitalOcean tutorial (February 2026), AgentMail comparison (February 2026)

---

### 3.2 Alternative: Himalaya CLI (IMAP/SMTP)

**Tool:** `himalaya` (Rust-based email CLI)

**When to Use:**
- ✅ Personal experiments only
- ✅ No Google Cloud setup desired
- ✅ Using non-Gmail providers (Outlook, custom domains)

**Why NOT for Production:**
- ❌ **OAuth requires browser** - Breaks headless Docker deployments
- ❌ **Full inbox exposure** - Agent reads ALL emails (bank statements, medical records)
- ❌ **Security vulnerabilities** - Documented prompt injection attacks (ShadowLeak, ZombieAgent)
- ❌ **User reports** - Auth failures, incorrect syntax in docs

**Confidence:** HIGH (for NOT using in production)  
**Source:** LobsterMail comparison (February 2026)

---

### 3.3 Alternative: LobsterMail (Emerging Option)

**Status:** Pre-launch (waitlist as of March 2026)

**When to Consider:**
- ✅ Want isolated inboxes (not sharing personal Gmail)
- ✅ Need prompt injection scanning
- ✅ Headless-first design
- ✅ Flat pricing: $0-$9/month

**Why NOT for POC:**
- ❌ **Pre-launch** - Not yet generally available
- ❌ **Newer platform** - Less battle-tested
- ❌ **Custom integration required** - No official OpenClaw skill yet

**Confidence:** MEDIUM (promising but not ready)  
**Source:** LobsterMail comparison (February 2026)

---

## 4. Docker Containerization

### 4.1 Base Configuration

**Docker Version:** `20.10+`

**Base Image:** `openclaw/openclaw:latest`

**Docker Run Command (Development):**
```bash
docker run -d \
  --name imss-lab-bot \
  -p 8080:8080 \
  -v ~/.openclaw:/root/.openclaw \
  -v ~/openclaw/workspace:/root/workspace \
  -e OPENCLAW_LOG_LEVEL=info \
  -e MODEL_API_KEY=your-api-key \
  --restart unless-stopped \
  openclaw/openclaw:latest
```

**Volume Mounts:**

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `~/.openclaw` | `/root/.openclaw` | Configuration, credentials, SQLite database |
| `~/openclaw/workspace` | `/root/workspace` | Agent workspace, file I/O |

**Critical Permission Fix:**
```bash
sudo chown -R 1000:1000 ~/.openclaw ~/openclaw/workspace
```

**Confidence:** HIGH  
**Source:** Simon Willison TIL (February 2026), Tencent Cloud tutorial (March 2026)

---

### 4.2 Docker Compose (Recommended for POC)

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  openclaw-gateway:
    image: openclaw/openclaw:latest
    container_name: imss-lab-bot
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./config/.openclaw:/root/.openclaw
      - ./workspace:/root/workspace
      - ./backups:/backups
    environment:
      - OPENCLAW_LOG_LEVEL=info
      - MODEL_API_KEY=${MODEL_API_KEY}
      - NODE_OPTIONS=--max-old-space-size=2048
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64M
    networks:
      - openclaw-network

  # Optional: Monitoring stack
  grafana:
    image: grafana/grafana:latest
    container_name: imss-grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - openclaw-network

volumes:
  grafana-data:

networks:
  openclaw-network:
    driver: bridge
```

**Why Docker Compose?**
- ✅ **Reproducible** - Same setup everywhere
- ✅ **Version controlled** - Track changes in git
- ✅ **Multi-service** - Easy to add monitoring, proxies
- ✅ **Simplified management** - `docker compose up -d`

**Confidence:** HIGH

---

### 4.3 Production Security Hardening

**Docker Run Command (Production):**
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

**Security Flags Explained:**

| Flag | Purpose |
|------|---------|
| `--read-only` | Root filesystem read-only, prevents malware persistence |
| `--security-opt=no-new-privileges` | Blocks privilege escalation |
| `--cap-drop=ALL` | Drops all Linux capabilities (SYS_ADMIN, etc.) |
| `--cap-add=NET_BIND_SERVICE` | Only capability needed for network binding |
| `--tmpfs /tmp:rw,noexec,nosuid` | Writable temp without execution |
| `--cpus` / `--memory` | Resource limits prevent DoS |
| `-u 1000:1000` | Run as non-root user |

**Network Restrictions (Advanced):**
```bash
# Zero external network access
--network none

# Mount Unix socket to host proxy for allowlisted domains only
-v /var/run/proxy.sock:/var/run/proxy.sock
```

**Squid Proxy Allowlist:**
```
# Allow only required domains
api.openai.com
backend.composio.dev
api.anthropic.com
www.googleapis.com  # Gmail API
```

**Confidence:** HIGH  
**Source:** Composio security guide (January 2026), LumaDock best practices (January 2026)

---

### 4.4 Docker Best Practices for OpenClaw

**DO:**
- ✅ **Pin versions** - `openclaw/openclaw:2026.2.26` not `:latest` in production
- ✅ **Externalize state** - All persistence in volume mounts
- ✅ **Use restart policies** - `--restart unless-stopped`
- ✅ **Structure logs** - `OPENCLAW_LOG_LEVEL=info`
- ✅ **Backup volumes** - Regular tar.gz of `~/.openclaw`
- ✅ **Health checks** - `openclaw doctor` in monitoring loop
- ✅ **Non-root user** - `-u 1000:1000`

**DON'T:**
- ❌ **Bake secrets into images** - Use environment variables
- ❌ **Mount entire home directory** - Scope to specific paths
- ❌ **Run as root** - Always specify `-u`
- ❌ **Expose port 18789** - Gateway WebSocket is internal only
- ❌ **Skip time sync** - Drifting clocks corrupt debugging

**Backup Strategy:**
```bash
# Manual backup
tar czf "openclaw-backup-$(date +%Y%m%d).tar.gz" ~/.openclaw/

# Automated daily backups (cron)
0 3 * * * tar czf "/backups/openclaw_$(date +\%Y\%m\%d_\%H\%M\%S).tar.gz" ~/.openclaw/ 2>/dev/null
```

**Confidence:** HIGH

---

## 5. AI Model Integration

### 5.1 Recommended Models (2026)

**Primary Model:** `GPT-5.2` (via OpenAI API)

**Alternative Models:**
- `Claude 3.5 Sonnet` - Better for long-horizon tasks
- `GPT-5.2 Thinking` - Deep clinical reasoning (if needed)
- `Local models (32B+)` - For PHI data sovereignty (requires 24GB+ VRAM)

**Model Configuration:**
```yaml
# ~/.openclaw/config.yaml
model:
  provider: "openai"
  model: "gpt-5.2"
  apiKey: "${OPENAI_API_KEY}"
  rateLimiting:
    retryOnRateLimit: true
    maxRetries: 3
    retryDelay: 5000
    maxRequestsPerMinute: 30
```

**Why GPT-5.2?**
- ✅ **Proven in healthcare** - Documented success in appointment scheduling
- ✅ **Tool calling** - Native support for OpenClaw skills
- ✅ **Context window** - 128K tokens for complex conversations
- ✅ **Reliability** - High uptime, consistent performance

**What NOT to Use:**
- ❌ **GPT-4 or older** - Inferior reasoning, smaller context
- ❌ **Uncensored local models** - Safety risks in healthcare context
- ❌ **Multiple models simultaneously** - Adds complexity without benefit for POC

**Confidence:** MEDIUM-HIGH  
**Source:** Healthcare Digital article (February 2026)

---

### 5.2 API Key Management

**Secure Storage:**
```bash
# NEVER store in .env files (agent can read and leak)
# Use environment variables or secret management

# Development
export OPENAI_API_KEY="sk-..."
export MODEL_API_KEY="..."

# Production (Docker)
docker run -e OPENAI_API_KEY=${OPENAI_API_KEY} ...

# Production (Secrets Manager)
# AWS Secrets Manager / HashiCorp Vault
```

**Confidence:** HIGH

---

## 6. Communication Channels

### 6.1 Gmail (Primary Channel)

**Setup:** gogcli v0.11.0 (see Section 3.1)

**Use Cases:**
- Doctor sends email → OpenClaw books lab slot
- Patient receives confirmation email
- Automated reminders (1 week, 1 day, 1 hour before)

**Confidence:** HIGH

---

### 6.2 WhatsApp Business API (Future Enhancement)

**Provider:** Twilio WhatsApp Business API

**When to Add:**
- Phase 2 (after POC validation)
- Patient preference for WhatsApp over email
- Reminder notifications via preferred channel

**Why NOT for POC:**
- ❌ **Additional setup complexity** - Business verification required
- ❌ **Cost** - Per-conversation pricing
- ❌ **Not critical for demo** - Email sufficient for validation

**Confidence:** MEDIUM (for future phases)

---

## 7. Complete Stack Summary

### 7.1 Technology Stack Table

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Node.js | 22.12.0+ | OpenClaw Gateway execution |
| **Framework** | OpenClaw | 2026.2.26+ | AI agent orchestration |
| **Database** | SQLite | 3.40+ | Appointment data, vector memory |
| **Email** | gogcli | 0.11.0 | Gmail API integration |
| **Container** | Docker | 20.10+ | Isolation, reproducibility |
| **AI Model** | GPT-5.2 | Latest | Reasoning, tool calling |
| **Monitoring** | Grafana | Latest | Metrics, dashboards |
| **OS** | Ubuntu | 22.04+ | VPS deployment target |

---

### 7.2 File Structure

```
/opt/imss-lab-bot/
├── docker-compose.yml           # Docker orchestration
├── .env                         # Environment variables (gitignored)
├── config/
│   └── .openclaw/              # OpenClaw configuration
│       ├── config.yaml         # Gateway config
│       ├── memory/
│       │   ├── main.sqlite     # SQLite database
│       │   ├── MEMORY.md       # Long-term memory
│       │   └── 2026-03-23.md   # Daily logs
│       ├── credentials/
│       │   └── google-credentials.json
│       └── adapters/
│           └── google/
│               └── config.json
├── workspace/                   # Agent file I/O
│   └── appointments/           # Appointment exports
└── backups/                    # Automated backups
```

---

### 7.3 Installation Checklist

**Phase 1: Local Development (Day 1-2)**

- [ ] Install Node.js 22.12.0+ via nvm
- [ ] Install OpenClaw: `curl -fsSL https://openclaw.ai/install.sh | bash`
- [ ] Create Google Cloud project
- [ ] Enable Gmail API + Calendar API
- [ ] Create OAuth credentials (Desktop app)
- [ ] Install gogcli: `brew install steipete/tap/gogcli`
- [ ] Authenticate gogcli: `gog auth add your-email@gmail.com --services gmail,calendar`
- [ ] Test OpenClaw: `openclaw tui` → "What was my most recent email?"
- [ ] Create SQLite tables for patients, appointments, lab capacity
- [ ] Test appointment booking flow

**Phase 2: Docker Containerization (Day 3-4)**

- [ ] Create `docker-compose.yml`
- [ ] Configure volume mounts
- [ ] Set environment variables
- [ ] Run: `docker compose up -d`
- [ ] Verify health: `docker compose exec openclaw-gateway openclaw --version`
- [ ] Test email integration inside container
- [ ] Set up automated backups

**Phase 3: Security Hardening (Day 5)**

- [ ] Apply Docker security flags (read-only, cap-drop, non-root)
- [ ] Configure firewall (UFW deny incoming, allow SSH/80/443)
- [ ] Set up Tailscale for secure remote access
- [ ] Lock down file permissions: `chmod 600` for credentials
- [ ] Configure `gateway.yaml`: `host: "127.0.0.1"`, `dangerouslyDisableDeviceAuth: false`
- [ ] Review and audit all installed ClawHub skills
- [ ] Set DM policy to "pairing" (never "open")

**Phase 4: VPS Deployment (Day 6-7)**

- [ ] Provision VPS (DigitalOcean, 4GB RAM minimum)
- [ ] Install Docker + Docker Compose
- [ ] Transfer configuration via secure SCP
- [ ] Deploy: `docker compose up -d`
- [ ] Set up Nginx reverse proxy
- [ ] Configure SSL with Let's Encrypt
- [ ] Set up monitoring (Grafana dashboard)
- [ ] Test end-to-end appointment flow

---

## 8. What NOT to Use (Anti-Patterns)

### 8.1 Database Anti-Patterns

| Technology | Why Avoid | When to Reconsider |
|------------|-----------|-------------------|
| **PostgreSQL** | Overkill for single-instance POC | Multi-instance production (>1000 daily appointments) |
| **MongoDB** | No advantage for structured data | Need for unstructured clinical notes |
| **Cloud databases** | Adds latency, cost, complexity | Need for multi-region redundancy |

### 8.2 Email Integration Anti-Patterns

| Technology | Why Avoid | When to Reconsider |
|------------|-----------|-------------------|
| **Himalaya (IMAP)** | OAuth breaks headless, full inbox exposure | Personal experiments only |
| **Primary Gmail account** | Security risk (agent reads everything) | Never - always use dedicated bot account |
| **App passwords** | Less secure than OAuth, deprecated | Legacy systems without OAuth support |

### 8.3 Docker Anti-Patterns

| Practice | Why Avoid | Correct Approach |
|----------|-----------|-----------------|
| **Running as root** | Host compromise if container breached | `-u 1000:1000` |
| **Mounting entire home** | Exposes SSH keys, credentials | Mount only required directories |
| **Using `:latest` tag** | Unpredictable updates | Pin specific versions |
| **No resource limits** | DoS vulnerability | `--cpus`, `--memory` |
| **Exposing port 18789** | Gateway WebSocket is internal | Reverse proxy on 80/443 only |

### 8.4 Security Anti-Patterns

| Practice | Risk Level | Consequence |
|----------|-----------|-------------|
| **Plaintext API keys in .env** | CRITICAL | Agent can read and leak credentials |
| **Installing unaudited ClawHub skills** | CRITICAL | 10.8% contain malicious code |
| **No prompt injection defense** | HIGH | Data exfiltration via malicious emails |
| **Exposing Control UI to internet** | HIGH | Unauthorized access to agent |
| **Running on primary machine** | MEDIUM | Host compromise if container breached |

---

## 9. Performance & Scaling

### 9.1 System Requirements

| Resource | Minimum (POC) | Recommended (Production) |
|----------|---------------|-------------------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 2 GB | 4-8 GB |
| **Storage** | 10 GB | 50+ GB (SSD) |
| **Network** | 10 Mbps | 100+ Mbps |

**For Local Models (Optional):**
- **CPU:** 8+ cores (for RAG/Search)
- **RAM:** 16-32 GB
- **GPU:** 24GB+ VRAM (for 32B+ parameter models)

### 9.2 SQLite Performance Tuning

```yaml
# ~/.openclaw/config.yaml
memorySearch:
  query:
    hybrid:
      enabled: true
      vectorWeight: 0.7
      textWeight: 0.3
      candidateMultiplier: 4
```

**When SQLite Becomes a Bottleneck:**
- SQLITE_BUSY errors under concurrent load
- Multiple OpenClaw instances accessing same database
- >1000 appointments per day

**Migration Path:**
```
SQLite → PostgreSQL with pgvector extension
```

### 9.3 Rate Limits

| Service | Limit | Mitigation |
|---------|-------|------------|
| **Gmail API** | 250 units/second/user | Built-in retry logic |
| **Gmail sending** | 500 emails/day (free) | Upgrade to Workspace (2000/day) |
| **OpenAI API** | Model-dependent | Configure `maxRequestsPerMinute` |

---

## 10. Monitoring & Observability

### 10.1 Built-in Monitoring

```bash
# Health checks
openclaw --version
openclaw doctor
openclaw config validate

# Memory health
ls -lh ~/.openclaw/memory/main.sqlite
openclaw memory search "test query"

# Logs
journalctl -u openclaw -f  # systemd
docker logs -f imss-lab-bot  # Docker
```

### 10.2 Grafana Dashboard

**Metrics to Monitor:**
- Gateway health (uptime, restarts)
- API token usage (cost tracking)
- Memory search latency
- Skill execution metrics
- Appointment booking success rate

**Dashboard URL:** `http://localhost:3000` (if monitoring stack enabled)

### 10.3 Alerting

**Critical Alerts:**
- Gateway down (>5 minutes)
- SQLITE_BUSY errors (>10/hour)
- API rate limit exceeded
- Failed appointment bookings (>5/hour)

---

## 11. Compliance & Security (Healthcare)

### 11.1 HIPAA Considerations (US Healthcare)

**Requirements:**
- ✅ **Business Associate Agreements (BAAs)** with AI providers
- ✅ **Audit logging** (who accessed what, when, why)
- ✅ **Encryption:** AES-256 at rest, TLS 1.3 in transit
- ✅ **Access controls** with MFA
- ✅ **Patient consent** for AI processing
- ✅ **Breach detection** and notification procedures

**Note:** For Mexican IMSS system, consult local healthcare regulations (COFEPRIS, Ley General de Salud).

### 11.2 Data Minimization

**Principle:** AI agents access only PHI required for specific tasks.

**Implementation:**
- Separate database tables for PII vs. appointment data
- Role-based access control (doctor vs. lab technician)
- Consent flags in patient records

### 11.3 Audit Logging

```sql
CREATE TABLE audit_log (
    log_id TEXT PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);
```

**Log All:**
- Patient record access
- Appointment creation/modification/cancellation
- Email communications
- API key usage

---

## 12. Cost Estimation

### 12.1 Local Development (POC)

| Item | Cost |
|------|------|
| **OpenClaw** | Free (open source) |
| **SQLite** | Free |
| **Docker** | Free |
| **Gmail API** | Free (within quotas) |
| **OpenAI API** | ~$10-30/month (POC usage) |
| **Total** | **~$10-30/month** |

### 12.2 VPS Production

| Item | Cost (Monthly) |
|------|----------------|
| **VPS (DigitalOcean 4GB)** | $24 |
| **OpenAI API** | $50-100 |
| **Google Workspace** | $6 (optional, for higher limits) |
| **Domain + SSL** | $2 |
| **Backup storage** | $5 |
| **Total** | **~$87-137/month** |

---

## 13. Risk Assessment

### 13.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Prompt injection attack** | MEDIUM | HIGH | Input sanitization, human review for sensitive actions |
| **SQLite database corruption** | LOW | MEDIUM | Regular backups, WAL mode |
| **Gmail API quota exceeded** | LOW | LOW | Rate limiting, retry logic |
| **Docker container escape** | LOW | HIGH | Security hardening, non-root user |
| **ClawHub skill malware** | MEDIUM | HIGH | Audit all skills before installing |

### 13.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **API key leakage** | MEDIUM | HIGH | Secret management, regular rotation |
| **Appointment double-booking** | LOW | MEDIUM | Database constraints, locking |
| **Email delivery failure** | LOW | MEDIUM | Retry logic, fallback channels |
| **VPS downtime** | LOW | MEDIUM | Monitoring, automated restarts |

---

## 14. Future Enhancements (Post-POC)

### Phase 2: Enhanced Communication

- [ ] WhatsApp Business API integration
- [ ] SMS reminders via Twilio
- [ ] Multi-channel preference management

### Phase 3: Advanced Scheduling

- [ ] Multi-lab support (different locations)
- [ ] Provider-specific calendars
- [ ] Emergency slot management
- [ ] Waitlist automation

### Phase 4: Analytics & Reporting

- [ ] Appointment no-show prediction
- [ ] Lab capacity optimization
- [ ] Patient flow analytics
- [ ] Integration with IMSS systems (future)

---

## 15. References & Sources

### Primary Sources (2026)

1. **OpenClaw Complete Guide 2026** - A-bots (March 4, 2026)
   - URL: https://a-bots.com/blog/openclaw

2. **OpenClaw Docker Deployment Tutorial** - Tencent Cloud (March 3, 2026)
   - URL: https://www.tencentcloud.com/techpedia/140024

3. **Connect OpenClaw to Gmail Tutorial** - AgentMail (February 20, 2026)
   - URL: https://www.agentmail.to/blog/connect-openclaw-to-gmail

4. **OpenClaw Email Skills Comparison** - LobsterMail (February 19, 2026)
   - URL: https://lobstermail.ai/blog/openclaw-email-skills-compared

5. **OpenClaw Security Hardening Guide** - AI Maker (February 10, 2026)
   - URL: https://aimaker.substack.com/p/openclaw-security-hardening-guide

6. **Secure OpenClaw Setup** - Composio (January 28, 2026)
   - URL: https://composio.dev/content/secure-openclaw-moltbot-clawdbot-setup

7. **OpenClaw in Healthcare** - LinkedIn (February 12, 2026)
   - URL: https://www.linkedin.com/pulse/openclaw-healthcare-executives-guide-autonomous-security-guy-fuller-cvycc

8. **DigitalOcean OpenClaw Tutorial** - DigitalOcean (February 18, 2026)
   - URL: https://www.digitalocean.com/community/tutorials/connect-google-to-openclaw

9. **Simon Willison TIL: OpenClaw Docker** - February 1, 2026
   - URL: https://til.simonwillison.net/llms/openclaw-docker

10. **arXiv: A Case Study of OpenClaw** - March 13, 2026
    - URL: https://arxiv.org/html/2603.12644v1

### Version Information

- **OpenClaw:** Latest (minimum 2026.2.26)
- **gogcli:** v0.11.0
- **Node.js:** 22.12.0+ (LTS)
- **SQLite:** 3.40+ with sqlite-vec
- **Docker:** 20.10+

---

## Appendix A: Quick Start Commands

```bash
# 1. Install Node.js 22
nvm install 22 && nvm use 22

# 2. Install OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash

# 3. Install gogcli
brew install steipete/tap/gogcli

# 4. Create project directory
mkdir -p ~/imss-lab-bot/{config,workspace,backups}
cd ~/imss-lab-bot

# 5. Create docker-compose.yml (see Section 4.2)

# 6. Set environment variables
export MODEL_API_KEY="your-openai-key"
export GOG_KEYRING_PASSWORD="your-secure-passphrase"

# 7. Start container
docker compose up -d

# 8. Verify
docker compose exec openclaw-gateway openclaw --version

# 9. Test email
docker compose exec openclaw-gateway openclaw tui
# Ask: "What was my most recent email?"

# 10. Create database tables
docker compose exec openclaw-gateway sqlite3 ~/.openclaw/memory/main.sqlite
# Run SQL from Section 2.1
```

---

## Appendix B: Troubleshooting

### Common Issues

**Issue:** `SQLITE_BUSY` errors  
**Solution:** 
```bash
openclaw gateway stop
ls -la ~/.openclaw/*.lock
rm ~/.openclaw/*.lock
openclaw gateway start
```

**Issue:** `MEMORY_SYNC_FAILURES`  
**Solution:** Ensure Node.js 22 (not 24)
```bash
nvm use 22
```

**Issue:** `RPC PROBE: FAILED`  
**Solution:** Check port 18789 not blocked
```bash
lsof -i :18789
```

**Issue:** `EACCES` permission errors  
**Solution:** Fix volume permissions
```bash
sudo chown -R 1000:1000 ~/.openclaw ~/openclaw/workspace
```

**Issue:** gogcli authentication fails  
**Solution:** Verify OAuth credentials
```bash
gog auth credentials ~/.config/gogcli/credentials.json
gog auth add your-email@gmail.com --services gmail,calendar
```

---

**Document Status:** COMPLETE  
**Last Updated:** March 23, 2026  
**Next Review:** After POC deployment validation
