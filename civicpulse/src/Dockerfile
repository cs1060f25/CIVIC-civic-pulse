FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy all config files
COPY package.json package-lock.json* ./
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY next-env.d.ts ./

# Copy app directory (Next.js app router - contains pages, components, lib, etc.)
COPY app ./app

# Patch the problematic minify-webpack-plugin to fix WebpackError constructor issue
RUN sed -i 's/new _webpack\.WebpackError(/new Error(/g' /app/node_modules/next/dist/build/webpack/plugins/minify-webpack-plugin/src/index.js || true

# Build the application
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV CIVICPULSE_SKIP_DB=true
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
# Next.js standalone output includes everything needed
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public directory (Next.js doesn't include it in standalone by default)
COPY --from=builder --chown=nextjs:nodejs /app/app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

