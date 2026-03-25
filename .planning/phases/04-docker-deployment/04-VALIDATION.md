# Phase 04: Docker & Deployment - Validation Strategy

**Phase:** 4 of 4  
**Goal:** Production-ready Docker container with VPS deployment guide  
**Date:** March 24, 2026  
**Status:** DRAFT

---

## 1. Automated Validation (must-haves)

These checks must pass for the phase to be considered complete.

| ID | Check | Tool | Expected Outcome |
|----|-------|------|------------------|
| **V1** | Docker build | `docker build` | Image builds successfully without errors. |
| **V2** | Container startup | `docker-compose up -d` | Container starts and stays running (status: Up). |
| **V3** | Gateway health | `curl` | Health check responds at `http://localhost:18789/health`. |
| **V4** | gogcli installed | `docker exec` | `gog --version` returns v0.11+. |
| **V5** | Non-root user | `docker exec id` | Returns UID 1000 (node). |
| **V6** | Data persistence | `docker-compose down && docker-compose up -d` | SQLite database and appointments persist. |
| **V7** | Security scan | `docker scout` or `trivy` | No CRITICAL vulnerabilities in the image. |

---

## 2. Human Verification Required

These items require manual testing and review.

| ID | Item | Action | Success Criteria |
|----|------|--------|------------------|
| **H1** | Gmail Auth | Run `gog auth` in container | Successful token generation and persistence. |
| **H2** | VPS Deployment Guide | Review `DEPLOYMENT.md` | Clear, step-by-step, works on fresh VPS. |
| **H3** | SSL/TLS Setup | Verify HTTPS access | Gateway accessible via domain with valid SSL. |
| **H4** | Token Refresh | Manual trigger of refresh script | Token refreshes without user interaction. |

---

## 3. Requirement Traceability (C1-C5, S3)

- **C1 (Dockerfile):** Verified by V1, V4, V5, V7.
- **C2 (docker-compose):** Verified by V2, V6.
- **C3 (Persistence):** Verified by V6.
- **C4 (VPS Guide):** Verified by H2, H3.
- **C5 (Scripts):** Verified by manual execution of build/launch scripts.
- **S3 (Security):** Verified by V5, V7.

---

## 4. Final Goal Verification

The phase is achieved when:
1. All **Automated Validation** checks pass.
2. All **Human Verification** items are approved.
3. The end-to-end booking flow is confirmed working **inside the container**.

---

*Last Updated: March 24, 2026*
*Phase: 04-docker-deployment*
