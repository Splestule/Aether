# syntax=docker/dockerfile:1

FROM node:20-bookworm AS builder
WORKDIR /app

# Shared dependencies and build
COPY shared/package*.json shared/
RUN npm install --prefix shared

COPY shared/tsconfig.json shared/
COPY shared/src shared/src
RUN npm run build --prefix shared

# Client dependencies
COPY client/package*.json client/
RUN npm install --prefix client

# Copy client source files
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

RUN npm run build --prefix client

FROM nginx:1.27-alpine AS production

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

