# Use Node.js 22 slim as base (requires Node >= 22.16.0)
FROM node:22-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    tar \
    && rm -rf /var/lib/apt/lists/*

# Install gogcli v0.12.0
ENV GOGCLI_VERSION=0.12.0
RUN curl -L "https://github.com/steipete/gogcli/releases/download/v${GOGCLI_VERSION}/gogcli_${GOGCLI_VERSION}_linux_amd64.tar.gz" -o gogcli.tar.gz \
    && tar -xzf gogcli.tar.gz \
    && mv gog /usr/local/bin/gog \
    && chmod +x /usr/local/bin/gog \
    && rm gogcli.tar.gz

# Install OpenClaw globally
# Note: Using the version identified in the workspace
RUN npm install -g openclaw@2026.3.23-2

# Setup app directory for dependencies
WORKDIR /home/node/app
COPY package.json ./
RUN npm install --production

# Final Stage
FROM node:22-slim

# Install runtime dependencies (curl for healthcheck, sqlite3 for DB operations)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy gogcli binary
COPY --from=builder /usr/local/bin/gog /usr/local/bin/gog

# Copy OpenClaw global installation
COPY --from=builder /usr/local/lib/node_modules/openclaw /usr/local/lib/node_modules/openclaw
RUN ln -s /usr/local/lib/node_modules/openclaw/openclaw.mjs /usr/local/bin/openclaw

# Set up app directory
WORKDIR /home/node/app

# Copy dependencies and project files
COPY --from=builder /home/node/app/node_modules ./node_modules
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV OPENCLAW_STATE_DIR=/home/node/.openclaw

# Security Hardening: Create directories and set ownership
RUN mkdir -p /home/node/.openclaw/config \
    && mkdir -p /home/node/.openclaw/logs \
    && mkdir -p /home/node/.openclaw/identity \
    && mkdir -p /home/node/app/data \
    && chown -R node:node /home/node/app /home/node/.openclaw

# Ensure the entrypoint script is executable
RUN chmod +x /home/node/app/scripts/docker-entrypoint.sh

# Switch to non-root user
USER node

# Expose the gateway port
EXPOSE 18789

# Health check (requires curl)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:18789/health | grep '"ok":true' || exit 1

# Start via the entrypoint script
ENTRYPOINT ["/home/node/app/scripts/docker-entrypoint.sh"]
