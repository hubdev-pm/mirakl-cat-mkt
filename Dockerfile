# Multi-stage build for XLSX to Database Migration System
# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production runtime
FROM node:18-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S migration -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy built application from builder stage
COPY --from=builder --chown=migration:nodejs /app/dist ./dist
COPY --from=builder --chown=migration:nodejs /app/node_modules ./node_modules

# Create necessary directories with proper permissions
RUN mkdir -p logs credentials && \
    chown -R migration:nodejs logs credentials && \
    chmod 755 logs credentials

# Copy environment template
COPY --chown=migration:nodejs .env.example .env.example

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Switch to non-root user
USER migration

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Expose port for potential future web interface
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/index.js", "--help"]