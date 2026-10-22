# ══════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile for BowlingHub (Unified Operator + Kiosk)
# Solves parseEnv and ERESOLVE issues using clean node build + bun/node runtime
# ══════════════════════════════════════════════════════════════════

# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Clean install with legacy-peer-deps to avoid esbuild/vite ERESOLVE collisions
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy full source tree
COPY . .

# Build production client bundle into dist/
RUN npm run build

# Stage 2: Production Server Runtime
FROM oven/bun:latest AS runner

WORKDIR /app

# Copy package config and install production runtime dependencies
COPY package*.json ./
RUN bun install --production

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend TypeScript sources & server entry point
COPY server.ts ./server.ts
COPY tsconfig.json ./tsconfig.json
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
ENV MQTT_HOST=mosquitto
ENV MQTT_PORT=1883

EXPOSE 3000

CMD ["bun", "run", "server.ts"]
