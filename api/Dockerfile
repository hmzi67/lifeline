# Use Node.js 20 (Debian-based, Prisma compatible)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies (required for Prisma + OpenSSL)
RUN apt-get update && apt-get install -y openssl

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies (NO build here)
RUN npm install

# Copy full source code (IMPORTANT: Prisma schema must exist before generate)
COPY . .

# Generate Prisma client (now schema exists)
RUN npx prisma generate

# Build TypeScript project
RUN npm run build

# Runtime is production: errors-only logs, secure session cookie, generic error bodies.
# Set after the build so npm install above still gets dev dependencies.
ENV NODE_ENV=production

# Create runtime directories
RUN mkdir -p uploads logs

# Fix permissions (safe for production containers)
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose API port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
