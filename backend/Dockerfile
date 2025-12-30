# Multi-stage build for AutoSong Studio Backend

# Stage 1: Base image with FFmpeg
FROM node:18-slim AS base

# Install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 2: Dependencies
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Stage 3: Production
FROM base AS production

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create temp directory for file processing
RUN mkdir -p ./temp/audio ./temp/thumbnails ./temp/videos && \
    chmod -R 755 ./temp

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) process.exit(1)})"

# Run as non-root user
USER node

# Start application
CMD ["node", "server.js"]
