# Ultra MCP - Docker Multi-stage Build
# Phase 2: Docker Containerization for Ultra-MCP with SSE transport

# =============================================================================
# Builder Stage: Install dependencies and compile TypeScript
# =============================================================================
FROM node:20-bookworm AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json tsup.config.ts ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Install bun for build process
RUN npm install -g bun

# Copy source code and build configuration
COPY src/ ./src/
COPY drizzle/ ./drizzle/

# Build TypeScript to JavaScript
RUN bun run build

# =============================================================================
# Production Stage: Runtime environment with compiled code
# =============================================================================
FROM node:20-bookworm-slim AS production

# Create non-root user for security
RUN groupadd -g 1001 ultra-mcp && \
    useradd -r -u 1001 -g ultra-mcp ultra-mcp

# Set working directory
WORKDIR /app

# Install only curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/drizzle ./drizzle/

# Create volume directories with proper ownership
RUN mkdir -p /app/.config/ultra-mcp /app/data /app/logs && \
    chown -R ultra-mcp:ultra-mcp /app

# Switch to non-root user
USER ultra-mcp


# Set environment variables for container
ENV NODE_ENV=production
ENV PORT=8080

# Health check using existing /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Default command starts Ultra MCP with SSE transport
CMD ["node", "dist/cli.js", "-t", "http"]