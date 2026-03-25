# Phase 04 Research: Docker & Deployment

**Project:** IMSS Lab Appointment Scheduling POC
**Research Date:** March 24, 2026
**Status:** COMPLETE — Ready for planning

---

## Executive Summary

This research document identifies the requirements, best practices, and potential pitfalls for implementing **Phase 04: Docker & Deployment**. The goal is to containerize the OpenClaw agent and provide a production-ready deployment strategy for a VPS.

**Key Answer:** To plan this phase well, you need to understand:
1. **Node.js 22.12.0+ Hardening:** How to create a secure, non-root Docker image.
2. **SQLite Persistence:** How to manage database file locking and journal modes across Docker volumes.
3. **Gmail OAuth Continuity:** How to persist and refresh OAuth tokens in a headless environment.
4. **VPS Security:** How to deploy with minimal privilege and SSL protection.

---

## 1. Requirement Mapping (Category 5 & S3)

| ID | Requirement | Key Knowledge for Planning |
|----|-------------|-----------------------------|
| **C1** | Dockerfile with security hardening | Node.js 22 base image, `USER node`, multi-stage builds. |
| **C2** | docker-compose.yml configuration | Volume mapping for persistence, environment variable management. |
| **C3** | Data persistence | SQLite journal mode (`DELETE`), persistent volume for `.openclaw`. |
| **C4** | VPS deployment guide | SSH setup, Docker/Compose installation, Nginx/Caddy for SSL. |
| **C5** | Build and launch scripts | Bash scripts for `docker-compose` orchestration and health checks. |
| **S3** | Docker security hardening | `cap_drop`, `no-new-privileges`, `read_only` root FS. |

---

## 2. Docker Implementation Strategy

### 2.1 Base Image & Hardening (C1, S3)

- **Base Image:** `node:22.12.0-slim` or `openclaw/openclaw:latest` (if verified).
- **Non-Root User:** Must use `USER node` (UID 1000) to prevent container escape risks.
- **Capabilities:** Drop all by default, only add `CAP_NET_BIND_SERVICE` if listening on ports < 1024 (though 18789 is used).
- **Read-Only FS:** Use `read_only: true` in `docker-compose.yml` and mount `tmpfs` for `/tmp`.

### 2.2 gogcli Integration

- Since the agent relies on `gogcli` for Gmail API access, the Dockerfile must install it:
  ```dockerfile
  RUN wget https://github.com/steipete/gogcli/releases/download/v0.11.0/gogcli_0.11.0_linux_amd64.tar.gz \
      && tar -xzf gogcli_0.11.0_linux_amd64.tar.gz \
      && install -m 0755 gog /usr/local/bin/gog
  ```

### 2.3 Volume Mounts (C2, C3)

- **Config:** `./config/.openclaw:/root/.openclaw` (contains tokens and config).
- **Data:** `./data:/root/.openclaw/memory` (persists the SQLite database).
- **Skills:** `./skills:/root/workspace/skills` (persists custom skills).

---

## 3. SQLite Persistence Strategy (C3)

SQLite's WAL (Write-Ahead Logging) mode can be problematic with some Docker volume providers (especially on network storage or macOS bind mounts).
- **Recommendation:** Force `journal_mode=DELETE` in the initialization script to ensure maximum compatibility across different VPS environments.
- **Locking:** Ensure only one container accesses the database at a time to avoid `SQLITE_BUSY` errors.

---

## 4. Gmail OAuth & Headless Operations (E1, E5)

- **Token Persistence:** OAuth tokens are stored in the `.openclaw` volume. If the volume is lost, the agent loses Gmail access.
- **Headless Refresh:** `gogcli` requires a manual initial authentication. The plan must include a step for the user to perform this once and then persist the resulting `credentials.json` in the volume.
- **Automation:** Include a cron job or a sidecar container to run `gog auth refresh` daily to prevent token expiration (Pitfall #4).

---

## 5. VPS Deployment Strategy (C4)

- **Provider:** DigitalOcean, Hetzner, or AWS (EC2/Lighthouse).
- **Prerequisites:** Docker, Docker Compose, Domain Name.
- **Reverse Proxy:** Nginx or Caddy (Caddy is recommended for automatic SSL/TLS).
- **Security:**
  - UFW (Uncomplicated Firewall) to block port 18789 from the public internet.
  - SSH hardening (disable root login, use keys only).
  - Fail2ban for brute-force protection.

---

## 6. Critical Pitfalls to Avoid (from PITFALLS.md)

1. **Pitfall #1: Google Account Suspension:** Use a dedicated service account and exponential backoff (already implemented in skills, but needs verification in container).
2. **Pitfall #2: Database Corruption:** Use `DELETE` journal mode and avoid concurrent local/Docker execution.
3. **Pitfall #4: OAuth Token Expiration:** Ensure tokens are persisted in the volume and refreshed regularly.
4. **Pitfall #6: Volume Permissions:** Ensure the `node` user in the container has ownership of the mounted host directories (`chown 1000:1000`).

---

## 7. Next Steps for Planning

1. **Verify `gogcli` in Docker:** Test the installation steps in a `node:22-slim` image.
2. **Define SSL Strategy:** Decide between Nginx + Certbot or Caddy for the deployment guide.
3. **Draft Build Scripts:** Create `docker-build.sh` and `docker-up.sh` to simplify operations for the user.
4. **Finalize Verification Plan:** Ensure Phase 4 verification script can run inside the container.

---

*Last Updated: March 24, 2026*
*Status: Research Complete — Move to Phase 4 Planning*
