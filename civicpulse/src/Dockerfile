FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy all config files
COPY package.json package-lock.json* ./
COPY next.config.ts tsconfig.json postcss.config.mjs ./
# Create public directory (icon.ico is in src/app/, not public/)
# We don't need to copy public/ since favicon is handled via icon.ico in app directory
RUN mkdir -p ./public

# Copy entire src directory (Next.js app router expects src/app structure)
# Exclude node_modules to avoid duplicate Next.js installations
COPY src ./src
RUN rm -rf ./src/app/node_modules ./src/node_modules 2>/dev/null || true

# Patch the problematic minify-webpack-plugin to fix WebpackError constructor issue
RUN sed -i 's/new _webpack\.WebpackError(/new Error(/g' /app/node_modules/next/dist/build/webpack/plugins/minify-webpack-plugin/src/index.js || true

# Build the application (upgraded Next.js should fix minifier bug)
# Explicitly use webpack instead of Turbopack
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV CIVICPULSE_SKIP_DB=true
RUN npm run build -- --webpack

# Production image
FROM base AS runner
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
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
# Copy from root public directory where favicon.ico lives
RUN mkdir -p ./public
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

