# Docker Guide

This page keeps everything about Docker in one simple place so you can follow along even if you are new to containers.

## Why use Docker?

- **Same setup everywhere** – Docker bundles code + runtime so the app behaves the same on any machine.
- **Fewer install steps** – No need to install Node, npm, or build tools on the host. Docker images ship with everything already installed.
- **Easy hosting** – Any server (or cloud service) that supports Docker can run these images. Start/stop/upgrade is just `docker run` or `docker compose up`.
- **Clean isolation** – If something breaks inside the container, your local machine stays untouched.

## Images we provide

| Image               | Purpose                                    | Exposed port |
| ------------------- | ------------------------------------------ | ------------ |
| `server/Dockerfile` | Express API + WebSocket server             | `8080`       |
| `client/Dockerfile` | Built React/WebXR frontend served by nginx | `80`         |

Both images use the shared TypeScript package, and the `client` build also accepts two build-time values:

- `VITE_API_URL` – URL the browser should call for REST (default `http://localhost:8080`).
- `VITE_WS_URL` – URL for WebSocket updates (default `ws://localhost:8080`).

## Build locally

```bash
# Backend only
docker build -t vr-flight-server -f server/Dockerfile .

# Frontend only (override API endpoints if you deploy elsewhere)
docker build \
  --build-arg VITE_API_URL=https://your-domain.example/api \
  --build-arg VITE_WS_URL=wss://your-domain.example \
  -t vr-flight-client \
  -f client/Dockerfile .
```

## Run everything with Docker Compose

```bash
=> ERROR [client builder 18/18] RUN npm run build --prefix client         1.3s
------
 > [client builder 18/18] RUN npm run build --prefix client:
0.133
0.133 > @vr-flight-tracker/client@1.0.0 build
0.133 > tsc && vite build
0.133
1.271 src/App.tsx(181,9): error TS6133: 'handleVRToggle' is declared but its value is never read.
1.271 src/components/LocationSelector.tsx(74,3): error TS6133: 'onConfirm' is declared but its value is never read.
1.272 src/components/LocationSelector.tsx(140,20): error TS2503: Cannot find namespace 'NodeJS'.
1.272 src/hooks/useWebSocket.ts(29,38): error TS2503: Cannot find namespace 'NodeJS'.
------
Dockerfile:34

--------------------

  32 |     ENV VITE_WS_URL=${VITE_WS_URL}

  33 |

  34 | >>> RUN npm run build --prefix client

  35 |

  36 |     FROM nginx:1.27-alpine AS production

--------------------

target client: failed to solve: process "/bin/sh -c npm run build --prefix client" did not complete successfully: exit code: 2
```

What happens:

1. The server image is built and published on port `8080`.
2. The client image is built, baked with `VITE_*` URLs, and served by nginx on port `4173` (mapped to container port `80`).
3. The client talks to the server over the internal Docker network.

Environment variables such as `OPENSKY_USERNAME` can be placed in a `.env` file next to `docker-compose.yml`, or you can pass them inline when running Compose.

## Deploying elsewhere

Once built, push the images to any container registry (Docker Hub, GHCR, etc.) and run them on your favorite host or orchestrator:

```bash
docker run -d --name vr-flight-server -p 8080:8080 \
  -e OPENSKY_USERNAME=you \
  -e OPENSKY_PASSWORD=secret \
  vr-flight-server

docker run -d --name vr-flight-client -p 4173:80 vr-flight-client
```

You can mix and match: host the API on one machine and serve the static build via any CDN by copying `client/dist`.

## Common tweaks

- **Change ports** – Edit the `ports` block in `docker-compose.yml` or the `-p` flags when running `docker run`.
- **Point client to remote API** – Rebuild the client image with new `VITE_API_URL` / `VITE_WS_URL` values.
- **Use real credentials** – Provide environment variables (never commit secrets into the repo).

If something is unclear, follow the Compose flow first. It is the quickest way to see both containers working together.
