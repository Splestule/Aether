# syntax=docker/dockerfile:1

FROM node:20-bookworm AS builder
WORKDIR /app

# Copy root package files for workspace support
COPY package.json package-lock.json ./

# Copy all workspace packages
COPY shared/package*.json shared/
COPY shared/tsconfig.json shared/
COPY shared/src shared/src

COPY server/package*.json server/
COPY server/tsconfig.json server/
COPY server/src server/src
COPY server/env.example server/

# Install all dependencies at root level (sets up workspaces)
# Using npm install instead of npm ci to handle cross-platform optional dependencies
RUN npm install

# Build shared package first (required by server)
WORKDIR /app/shared
RUN npm run build

# Build server package
WORKDIR /app/server
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy root package files for workspace support
COPY package.json package-lock.json ./

# Copy shared package (built dist and package.json for runtime)
COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/shared/dist shared/dist

# Copy server package
COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/server/env.example server/

# Install production dependencies only
# Install at root to set up workspace linking, then install production deps
RUN npm install --omit=dev

EXPOSE 8080
WORKDIR /app/server
CMD ["node", "dist/index.js"]

