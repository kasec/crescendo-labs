# VPS Deployment Guide: IMSS Lab Appointment Scheduling POC

This guide provides step-by-step instructions for deploying the OpenClaw-powered IMSS Lab Appointment Scheduling POC to a Linux-based Virtual Private Server (VPS).

## Prerequisites

-   **Linux VPS** (Ubuntu 22.04 LTS or Debian 12 recommended)
-   **Docker & Docker Compose** installed
-   **Domain Name** pointed to your VPS IP address
-   **Gmail Service Account** credentials (`credentials.json`)

---

## 1. Initial Server Setup

Connect to your VPS and perform basic hardening:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Create a non-root user (optional but recommended)
# sudo adduser deploy
# sudo usermod -aG docker deploy
```

---

## 2. Project Deployment

### Clone the Repository

```bash
git clone https://github.com/your-username/crescendo-labs.git
cd crescendo-labs
```

### Configure Environment Variables

Create a `.env` file in the project root:

```bash
# IMSS Lab Appointment POC - Environment Configuration
GMAIL_SERVICE_ACCOUNT="lab-bot@yourdomain.com"
GMAIL_CREDENTIALS_JSON='{ ... your JSON credentials here ... }'
OPENCLAW_TOKEN=$(openssl rand -hex 24)
```

### Initialize Directory Structure

```bash
# Create necessary local directories for persistence
mkdir -p data .openclaw/config .openclaw/identity .openclaw/logs skills

# Set correct permissions
sudo chown -R 1000:1000 .
```

---

## 3. Launching the Service

### Build and Start

```bash
# Build the Docker image
./scripts/docker-build.sh

# Start the service
./scripts/docker-up.sh
```

### Verify Status

```bash
# Check running containers
docker compose ps

# View logs
docker compose logs -f
```

---

## 4. Reverse Proxy with SSL (Optional but Recommended)

To secure the OpenClaw Gateway with HTTPS, use a reverse proxy like **Nginx** or **Caddy**.

### Example Caddyfile (easiest)

```caddyfile
lab-bot.yourdomain.com {
    reverse_proxy localhost:18789
}
```

---

## 5. Security Checklist

-   [ ] **Non-root user:** Container runs as `node` (UID 1000).
-   [ ] **No new privileges:** `no-new-privileges:true` is set in compose.
-   [ ] **Capabilities dropped:** `ALL` capabilities dropped.
-   [ ] **Firewall:** Only ports 80, 443, and 22 (SSH) should be open. Port 18789 should be internal-only if using a reverse proxy.
-   [ ] **Secrets:** Never commit your `.env` file or `credentials.json` to source control.

---

## 6. Troubleshooting

### Gmail Authentication Issues

If the bot fails to read/send emails, check the OAuth token status inside the container:

```bash
docker exec -it openclaw-gateway gog auth status
```

### Database Access

To inspect the SQLite database:

```bash
docker exec -it openclaw-gateway sqlite3 /home/node/app/data/sqlite.db
```

### Health Check Failure

If the container is unhealthy, check the logs:

```bash
docker compose logs openclaw-gateway
```

---

*Last Updated: March 24, 2026*
