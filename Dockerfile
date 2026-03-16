# ── Stage 1: Dependencies ────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# ── Stage 2: Builder ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm ci 2>/dev/null || npm install

COPY . .
# Ensure public exists (empty dirs may be omitted from build context)
RUN mkdir -p public

# Build-time env vars — NEXT_PUBLIC_* are baked by webpack at build time.
# These CANNOT be overridden at runtime, so they must be set here for staging.
# PAYLOAD_SECRET is NOT needed at build time — injected by DO App Platform at runtime.
ENV NEXT_PUBLIC_SERVER_URL=https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
ENV NEXT_PUBLIC_PLATFORM_DOMAIN=ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
ENV NEXT_TELEMETRY_DISABLED=1
# Polyfill for Next.js build (File/Blob); package.json build script also sets NODE_OPTIONS
ENV NODE_OPTIONS="--require ./node-polyfill.js"

RUN npm run build

# ── Stage 3: Runner (Production) ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Runtime env — NEXT_PUBLIC_* are baked at build time but also needed at runtime
# for Payload serverURL resolution. PAYLOAD_SECRET is injected by DO App Platform.
ENV NEXT_PUBLIC_SERVER_URL=https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
ENV NEXT_PUBLIC_PLATFORM_DOMAIN=ech-prime-web-v2-staging-pzdwc.ondigitalocean.app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# DB setup script: checks permissions, creates schema/tables, then starts server
COPY --from=builder --chown=nextjs:nodejs /app/scripts/db-setup.js ./db-setup.js
# Runtime polyfill for File/Blob (required by Payload/undici for RSC rendering)
COPY --from=builder --chown=nextjs:nodejs /app/node-polyfill.js ./node-polyfill.js

# Media upload directory
RUN mkdir -p /app/public/media && chown -R nextjs:nodejs /app/public/media

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Polyfill File/Blob at runtime (required by Payload for RSC rendering)
ENV NODE_OPTIONS="--require ./node-polyfill.js"

CMD ["node", "db-setup.js"]
