# ============================================================
# Multi-stage Production Dockerfile for LoanOps (Next.js Standalone)
# ============================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# --- Stage 1: Install dependencies ---
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
COPY prisma ./prisma
COPY scripts/pre-generate.js ./scripts/pre-generate.js

RUN npm ci --legacy-peer-deps && npx prisma generate

# --- Stage 2: Build application ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
# COPY respects .dockerignore: .env*, .git, node_modules, .next, db/,
# result.json, audit artifacts, logs and test output never enter the image.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate && npm run build

# --- Stage 3: Production runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/.storage/uploads && \
    chown -R nextjs:nodejs /app/.storage

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
