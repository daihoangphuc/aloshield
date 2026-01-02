# Multi-stage build for optimized image size and faster builds

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies only (with cache mount for faster rebuilds)
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build args for Next.js environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Set as environment variables for Next.js build (build-time only)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install all dependencies (including devDependencies for build)
# Use cache mount for faster rebuilds
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npm cache clean --force

# Copy configuration files
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY eslint.config.mjs ./

# Copy source code
COPY public ./public
COPY src ./src

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Next.js build output (standalone mode includes server.js and minimal dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check (check root endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode < 500 ? 0 : 1)})"

CMD ["node", "server.js"]




