# Cloudflare Tunnel Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Cloudflared
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Or download from: https://github.com/cloudflare/cloudflared/releases
```

### Step 2: Start Your Servers

**Terminal 1: Backend Server**
```bash
cd server
npm run dev
```

**Terminal 2: Frontend Server**
```bash
cd client
npm run dev
```

### Step 3: Start Cloudflare Tunnels

**Terminal 3: Backend Tunnel (Port 8080)**
```bash
cloudflared tunnel --url http://localhost:8080
```

**Copy the URL that appears!** It will look like:
```
https://random-words-here.trycloudflare.com
```

**Terminal 4: Frontend Tunnel (Port 3000)**
```bash
cloudflared tunnel --url http://localhost:3000
```

**Copy this URL too!**

### Step 4: Configure Environment Variables

Create `client/.env` file:
```env
VITE_API_URL=https://your-backend-tunnel-url.trycloudflare.com
VITE_WS_URL=wss://your-backend-tunnel-url.trycloudflare.com
```

**Important:**
- Replace `your-backend-tunnel-url.trycloudflare.com` with the URL from Terminal 3
- Use `wss://` (not `ws://`) for WebSocket
- Use `https://` (not `http://`) for API URL

### Step 5: Restart Frontend Server

After creating/updating `client/.env`, restart your frontend server (Ctrl+C in Terminal 2, then run `npm run dev` again).

### Step 6: Access Your App

Open the frontend tunnel URL from Terminal 4 in your browser or VR headset!

## 🎯 Using the Startup Script

Alternatively, you can use the provided script:

```bash
./start-cloudflare.sh
```

This will:
- Start both servers
- Start both Cloudflare tunnels
- Show you the tunnel URLs in the logs

**Note:** You'll still need to create `client/.env` with the tunnel URLs and restart the frontend.

## 📝 Quick Reference

| Service | Local Port | Tunnel Command |
|---------|-----------|----------------|
| Backend | 8080 | `cloudflared tunnel --url http://localhost:8080` |
| Frontend | 3000 | `cloudflared tunnel --url http://localhost:3000` |

| Environment Variable | Value Format | Example |
|---------------------|--------------|---------|
| `VITE_API_URL` | `https://...trycloudflare.com` | `https://abc123.trycloudflare.com` |
| `VITE_WS_URL` | `wss://...trycloudflare.com` | `wss://abc123.trycloudflare.com` |

## ⚠️ Important Notes

1. **URLs change**: Quick tunnel URLs change every time you restart the tunnel
2. **Use wss://**: Always use `wss://` (secure WebSocket) not `ws://`
3. **Restart after .env changes**: Restart the frontend server after updating `.env`
4. **Keep tunnels running**: Don't close the tunnel terminals - they need to stay running

## 🔧 Troubleshooting

### "Configuration Error: Server URL not configured"
→ Create `client/.env` with `VITE_API_URL` and `VITE_WS_URL`

### WebSocket connection fails
→ Make sure you're using `wss://` (not `ws://`) in `VITE_WS_URL`

### CORS errors
→ The backend is already configured to allow Cloudflare tunnel origins

### Tunnel URLs not appearing
→ Check the tunnel logs in `logs/backend-tunnel.log` and `logs/frontend-tunnel.log`

## 📚 Full Documentation

For more detailed instructions, see `CLOUDFLARE_SETUP.md`

---

**Happy flying! ✈️🥽**

