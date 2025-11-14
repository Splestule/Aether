# syntax=docker/dockerfile:1

FROM node:20-bookworm AS builder
WORKDIR /app

# Shared dependencies and build artifacts
COPY shared/package*.json shared/
RUN npm install --prefix shared

COPY shared/tsconfig.json shared/
COPY shared/src shared/src
RUN npm run build --prefix shared

# Server dependencies and build artifacts
COPY server/package*.json server/
RUN npm install --prefix server

COPY server/tsconfig.json server/
COPY server/src server/src
COPY server/env.example server/
RUN npm run build --prefix server

FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/shared/package-lock.json shared/
COPY --from=builder /app/shared/dist shared/dist

COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/server/package-lock.json server/
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/server/env.example server/

RUN npm ci --omit=dev --prefix shared
RUN npm ci --omit=dev --prefix server

EXPOSE 8080
CMD ["npm", "start", "--prefix", "server"]

