# Cloudflare Tunnel Setup Guide

This guide will help you set up Cloudflare Tunnels to expose your VR Flight Tracker locally running servers to the internet, allowing you to access the app from your VR headset or any remote device.

## Prerequisites

- Node.js and your application running locally (ports 3000 for frontend, 8080 for backend)
- Cloudflare account (free tier works)
- `cloudflared` CLI tool installed

## Step 1: Install Cloudflared

### macOS (using Homebrew)
```bash
brew install cloudflare/cloudflare/cloudflared
```

### macOS (manual installation)
```bash
# Download and install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### Linux
```bash
# Download and install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### Windows
Download from: https://github.com/cloudflare/cloudflared/releases/latest

## Step 2: Login to Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window. Select the domain you want to use (you can use a free Cloudflare domain or your own).

## Step 3: Create Tunnels for Your Ports

### Option A: Quick Tunnels (Simplest - Recommended for Testing)

This creates temporary tunnels that change URLs each time. Perfect for quick testing.

#### Terminal 1: Frontend Tunnel (Port 3000)
```bash
cloudflared tunnel --url http://localhost:3000
```

This will output something like:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

**Copy this URL!** You'll need it for the environment variables.

#### Terminal 2: Backend Tunnel (Port 8080)
```bash
cloudflared tunnel --url http://localhost:8080
```

This will output another URL like:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://different-random-words.trycloudflare.com                                          |
+--------------------------------------------------------------------------------------------+
```

**Copy this URL too!**

### Option B: Named Tunnels (Persistent - Recommended for Production)

For persistent tunnels that keep the same URL, you need to create named tunnels:

#### 1. Create a tunnel
```bash
cloudflared tunnel create vr-flight-tracker
```

#### 2. Create a config file
Create a file at `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id-from-step-1>
credentials-file: /Users/your-username/.cloudflared/<tunnel-id>.json

ingress:
  # Frontend
  - hostname: your-frontend-subdomain.yourdomain.com
    service: http://localhost:3000
  # Backend
  - hostname: your-backend-subdomain.yourdomain.com
    service: http://localhost:8080
  # Catch-all
  - service: http_status:404
```

#### 3. Route DNS (if using custom domain)
```bash
cloudflared tunnel route dns vr-flight-tracker your-frontend-subdomain.yourdomain.com
cloudflared tunnel route dns vr-flight-tracker your-backend-subdomain.yourdomain.com
```

#### 4. Run the tunnel
```bash
cloudflared tunnel run vr-flight-tracker
```

## Step 4: Configure Environment Variables

### For Frontend (Client)

Create or update `client/.env`:

```env
# Cloudflare Tunnel URLs (replace with your actual tunnel URLs)
VITE_API_URL=https://your-backend-tunnel-url.trycloudflare.com
VITE_WS_URL=wss://your-backend-tunnel-url.trycloudflare.com
```

**Important Notes:**
- Use `https://` for API URL (not `http://`)
- Use `wss://` for WebSocket URL (not `ws://`) - Cloudflare tunnels use secure WebSockets
- Replace `your-backend-tunnel-url.trycloudflare.com` with your actual backend tunnel URL

### Example `.env` file:
```env
VITE_API_URL=https://recognised-examined-nicole-bras.trycloudflare.com
VITE_WS_URL=wss://recognised-examined-nicole-bras.trycloudflare.com
```

## Step 5: Update Vite Configuration (if needed)

If you're using a custom subdomain, you may need to update `client/vite.config.ts`:

```typescript
server: {
  port: 3000,
  host: true,
  allowedHosts: [
    "your-frontend-tunnel-url.trycloudflare.com",
    ".trycloudflare.com",
    "localhost"
  ],
},
```

## Step 6: Restart Your Servers

1. **Stop your current servers** (if running)

2. **Start your backend server:**
   ```bash
   cd server
   npm run dev
   ```

3. **In a new terminal, start your frontend:**
   ```bash
   cd client
   npm run dev
   ```

4. **In separate terminals, start your Cloudflare tunnels:**
   ```bash
   # Terminal for frontend tunnel
   cloudflared tunnel --url http://localhost:3000
   
   # Terminal for backend tunnel
   cloudflared tunnel --url http://localhost:8080
   ```

## Step 7: Access Your Application

1. **Access the frontend** using your frontend Cloudflare tunnel URL (e.g., `https://random-words.trycloudflare.com`)
2. The frontend will automatically connect to the backend using the `VITE_API_URL` and `VITE_WS_URL` environment variables

## Troubleshooting

### Issue: "Configuration Error: Server URL not configured for remote access"

**Solution:** Make sure you've created `client/.env` with the correct `VITE_API_URL` and `VITE_WS_URL` variables, and restarted your frontend server.

### Issue: WebSocket connection fails

**Solution:** 
- Make sure you're using `wss://` (not `ws://`) in `VITE_WS_URL`
- Ensure your backend tunnel is running
- Check that your backend server is running on port 8080

### Issue: CORS errors

**Solution:** The backend should already be configured to allow Cloudflare tunnel origins. Check `server/src/index.ts` - it should include `/\.trycloudflare\.com$/` in the CORS origins.

### Issue: Tunnel URLs keep changing

**Solution:** Use named tunnels (Option B) instead of quick tunnels (Option A) for persistent URLs.

### Issue: "Tunnel not found" or authentication errors

**Solution:** 
- Make sure you're logged in: `cloudflared tunnel login`
- For named tunnels, verify your tunnel ID and credentials file path

## Quick Start Script

You can create a script to start everything at once. Create `start-cloudflare.sh`:

```bash
#!/bin/bash

# Start backend server
cd server && npm run dev &
BACKEND_PID=$!

# Start frontend server
cd client && npm run dev &
FRONTEND_PID=$!

# Wait for servers to start
sleep 5

# Start Cloudflare tunnels
echo "Starting Cloudflare tunnels..."
echo "Frontend tunnel:"
cloudflared tunnel --url http://localhost:3000 &
FRONTEND_TUNNEL_PID=$!

echo "Backend tunnel:"
cloudflared tunnel --url http://localhost:8080 &
BACKEND_TUNNEL_PID=$!

echo "Servers and tunnels started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Frontend Tunnel PID: $FRONTEND_TUNNEL_PID"
echo "Backend Tunnel PID: $BACKEND_TUNNEL_PID"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID $FRONTEND_TUNNEL_PID $BACKEND_TUNNEL_PID; exit" INT TERM
wait
```

Make it executable:
```bash
chmod +x start-cloudflare.sh
```

Run it:
```bash
./start-cloudflare.sh
```

## Important Notes

1. **Quick tunnels expire** when you close the terminal. Use named tunnels for persistent access.
2. **WebSocket support**: Cloudflare tunnels automatically support WebSockets, so use `wss://` for WebSocket URLs.
3. **HTTPS**: All Cloudflare tunnel URLs use HTTPS automatically, which is required for WebXR/VR.
4. **Rate limits**: Free Cloudflare tunnels have rate limits. For production, consider upgrading or using your own domain.
5. **Security**: Don't commit your `.env` files with tunnel URLs to git. They change frequently with quick tunnels.

## Next Steps

1. Test the setup by accessing your frontend tunnel URL in a browser
2. Test VR mode by accessing the URL from your VR headset's browser
3. Consider setting up named tunnels for production use
4. Monitor your Cloudflare dashboard for tunnel status and usage

---

**Happy flying in VR! ✈️🥽**

