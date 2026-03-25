# IMSS Lab Appointment Scheduling POC

This Proof of Concept (POC) demonstrates an automated laboratory appointment scheduling system powered by **OpenClaw** and **gogcli**. It automates the extraction of patient data from emails, manages clinic slot availability via **SQLite**, and provides automated confirmation/error notifications through **Gmail**.

---

## 🚀 Quick Start (Docker)

The fastest way to run the POC is using Docker:

```bash
# 1. Build the Docker image
./scripts/docker-build.sh

# 2. Configure environment variables in .env (see DEPLOYMENT.md)
# 3. Start the service
./scripts/docker-up.sh
```

For detailed deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## 📁 Project Structure

-   `Dockerfile`: Security-hardened Docker configuration.
-   `docker-compose.yml`: Service orchestration for the OpenClaw Gateway.
-   `config/`: Gateway and OpenClaw configuration files.
-   `skills/`: Custom OpenClaw skills (Booking Engine, Email Parser/Sender, Slot Manager).
-   `data/`: SQLite database storage (`sqlite.db`).
-   `scripts/`: Utility scripts for database management, verification, and Docker operations.
-   `docs/`: Documentation, including architecture and deployment guides.

---

## 🏗️ Architecture

1.  **OpenClaw Gateway**: The central orchestration engine managing agents and skills.
2.  **Gmail Integration**: `gogcli` is used to poll for new appointment request emails and send replies.
3.  **Booking Engine Skill**: Coordinates the end-to-end flow with atomic SQLite transactions.
4.  **Lanes (Serialization)**: Configuration to prevent race conditions during slot reservation.
5.  **Audit Logging**: Every action is recorded in the `audit_log` table for compliance.

---

## 🔧 Maintenance & Cleanup

To stop the Dockerized service and clean up temporary artifacts:

```bash
./scripts/cleanup.sh
```

To verify the project state after a phase completion:

```bash
./scripts/verify-phase-2.sh
# and other verify-* scripts in scripts/
```

---

*Phase 4 Complete: Production-Ready Dockerized POC.*
