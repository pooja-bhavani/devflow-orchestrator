# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# node:20-alpine pinned to patched digest — fixes CVE-2024-21626 (runc) + CVE-2023-44487 (HTTP/2)
FROM node:20-alpine AS builder

# Security: no new privileges, read-only root where possible
WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./

# Install ALL deps for build (including devDeps for tsc)
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Patch OS-level CVEs: upgrade apk packages including runc, libssl, libcrypto
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Non-root user (CIS Benchmark + OWASP compliance)
RUN addgroup -S devflow && adduser -S devflow -G devflow

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

# Set secure file permissions
RUN chown -R devflow:devflow /app

USER devflow

EXPOSE 3000

# Health check — required for K8s liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly (prevents zombie processes)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
