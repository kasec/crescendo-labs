---
wave: 1
depends_on: []
files_modified:
  - Dockerfile
  - docker-compose.yml
  - scripts/docker-build.sh
  - scripts/docker-up.sh
  - scripts/verify-persistence.sh
  - docs/DEPLOYMENT.md
  - .planning/phases/04-docker-deployment/SUMMARY.md
autonomous: true
requirements: [C1, C2, C3, C4, C5, S3]
---

# Phase 04: Docker Deployment Plan

This phase focuses on containerizing the OpenClaw agent and its dependencies (SQLite, gogcli) into a production-ready Docker image, ensuring data persistence, security hardening, and providing a clear path for VPS deployment.

## Wave 1: Dockerization & Security Hardening (C1, C2, S3)

In this wave, we will create the core Docker infrastructure with a focus on security and minimal privileges.

<tasks>
  <task id="T1" requirements="C1, S3">
    <description>Create a security-hardened Dockerfile for the OpenClaw agent.</description>
    <action>
      Create a `Dockerfile` using `node:22.12.0-slim` as the base image.
      Implement the following security measures:
      1. Run as non-root user (`USER node`).
      2. Install `gogcli v0.11.0` at build time.
      3. Set working directory to `/home/node/app`.
      4. Copy only necessary files and install production dependencies.
    </action>
  </task>

  <task id="T2" requirements="C2, S3">
    <description>Create a docker-compose.yml for local and production orchestration.</description>
    <action>
      Create `docker-compose.yml` with the following configuration:
      1. Service `openclaw-gateway` mapping port 18789.
      2. Environment variables for Gmail OAuth (referenced from a .env file).
      3. Security hardening in compose: `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`.
      4. `tmpfs` mounts for `/tmp` and `/run`.
    </action>
  </task>
</tasks>

## Wave 2: Configuration & Persistence (C3, C5)

This wave ensures that data survives container restarts and that the system is easy to manage.

<tasks>
  <task id="T3" requirements="C3">
    <description>Configure Docker volumes for data persistence and SQLite compatibility.</description>
    <action>
      1. Map volumes in `docker-compose.yml` for:
         - `./data` -> `/home/node/app/data` (for `sqlite.db`)
         - `./skills` -> `/home/node/app/skills`
         - `./.openclaw` -> `/home/node/.openclaw` (for config and tokens)
      2. Ensure the startup script or initialization logic forces SQLite `journal_mode=DELETE` for Docker volume compatibility.
    </action>
  </task>

  <task id="T4" requirements="C5">
    <description>Create build and orchestration scripts for the Docker environment.</description>
    <action>
      Create helper scripts in `scripts/`:
      1. `docker-build.sh`: Builds the Docker image with proper tagging.
      2. `docker-up.sh`: Starts the containerized service and performs a health check.
      3. `verify-persistence.sh`: A script that writes test data, restarts the container, and verifies data integrity.
    </action>
  </task>
</tasks>

## Wave 3: Documentation & Final Validation (C4)

The final wave focuses on the deployment guide and verifying the entire POC inside the container.

<tasks>
  <task id="T5" requirements="C4">
    <description>Produce a comprehensive VPS deployment guide.</description>
    <action>
      Create `docs/DEPLOYMENT.md` including:
      1. Prerequisites (Docker, Compose, Domain, SSL).
      2. SSH hardening steps.
      3. Step-by-step setup using the Docker files.
      4. Nginx/Caddy reverse proxy configuration for SSL.
      5. Post-deployment health checks.
    </action>
  </task>

  <task id="T6" requirements="C1, C2, C3, C5, S3">
    <description>Run final end-to-end validation inside the Docker container.</description>
    <action>
      Execute the end-to-end booking flow tests within the running container to ensure all skills, database operations, and Gmail integrations work as expected in the production-like environment.
    </action>
  </task>
</tasks>

## Verification Criteria

| ID | Check | Expected Outcome |
|----|-------|------------------|
| **V1** | Docker build | `docker compose build` completes without errors. |
| **V2** | Non-root check | `docker exec openclaw-gateway id` returns UID 1000. |
| **V3** | Persistence check | `scripts/verify-persistence.sh` passes after restart. |
| **V4** | Health check | `curl http://localhost:18789/health` returns 200 OK. |
| **V5** | Security scan | `docker scout quickview` (or equivalent) shows no critical vulnerabilities. |
| **V6** | E2E flow | End-to-end booking works inside the container. |

## Must Haves (Goal-Backward Verification)

- **Must have** a `Dockerfile` that builds a working image with `gogcli` and OpenClaw.
- **Must have** a `docker-compose.yml` that correctly mounts volumes for persistence.
- **Must have** the container running as a non-root user with a read-only filesystem (where possible).
- **Must have** a `DEPLOYMENT.md` that enables a user to deploy this to a VPS in under 15 minutes.
- **Must have** verified data persistence across `docker-compose down` and `docker-compose up`.
