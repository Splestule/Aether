# syntax=docker/dockerfile:1

FROM node:20-bookworm AS builder
WORKDIR /app

# Copy root package files for workspace support
COPY package.json package-lock.json ./

# Copy all workspace packages
COPY shared/package*.json shared/
COPY shared/tsconfig.json shared/
COPY shared/src shared/src

COPY client/package*.json client/
COPY client/tsconfig.json client/
COPY client/tsconfig.node.json client/
COPY client/vite.config.ts client/
COPY client/postcss.config.js client/
COPY client/tailwind.config.js client/
COPY client/public client/public
COPY client/src client/src
COPY client/index.html client/

# Build-time configuration
ARG VITE_API_URL=http://localhost:8080
ARG VITE_WS_URL=ws://localhost:8080
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Install all dependencies at root level (sets up workspaces)
RUN npm ci

# Build shared package first (required by client)
WORKDIR /app/shared
RUN npm run build

# Build client package
WORKDIR /app/client
RUN npm run build

# Production stage
FROM nginx:1.27-alpine AS production

# Copy built client files
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

