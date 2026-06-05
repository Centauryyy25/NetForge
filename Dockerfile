# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:22-slim AS deps

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable pnpm

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (including devDependencies for build)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable pnpm

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js (standalone output)
ENV NODE_ENV=production
RUN pnpm build

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy full node_modules (needed by worker, migrate, and tsx)
# Standalone only traces Next.js page/API imports, not worker deps
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy worker source (tsx compiles at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

# Copy drizzle migrations and config (for migrate service)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 8080

ENV PORT=8080

# Default: run Next.js web server
CMD ["node", "server.js"]
