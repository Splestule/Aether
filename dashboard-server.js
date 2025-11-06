#!/usr/bin/env node

// Simple dashboard server for VR Flight Tracker
// Serves a web dashboard showing server stats and logs

const express = require('express');
const { readFile } = require('fs');
const { createServer } = require('http');
const path = require('path');
const { execSync } = require('child_process');

// Get directory - works when run directly as script
const scriptDir = (() => {
  try {
    // Try to use __dirname if available (CommonJS)
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
  } catch {}
  // Fallback: use the script's directory
  return path.dirname(process.argv[1] || '.');
})();

const app = express();
const server = createServer(app);
const DASHBOARD_PORT = 8081;

app.use(express.static(path.join(scriptDir, 'dashboard')));

// Serve log files
app.get('/api/logs/server', (req, res) => {
  const logPath = path.join(scriptDir, 'logs', 'server.log');
  readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      return res.json({ error: 'Log file not found', lines: [] });
    }
    const lines = data.split('\n').slice(-100); // Last 100 lines
    res.json({ lines });
  });
});

app.get('/api/logs/client', (req, res) => {
  const logPath = path.join(scriptDir, 'logs', 'client.log');
  readFile(logPath, 'utf8', (err, data) => {
    if (err) {
      return res.json({ error: 'Log file not found', lines: [] });
    }
    const lines = data.split('\n').slice(-100); // Last 100 lines
    res.json({ lines });
  });
});

// Get server stats
app.get('/api/stats', async (req, res) => {
  try {
    // Check if main server is running
    let cacheStats = null;
    try {
      const http = require('http');
      const response = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8080/api/cache/stats', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(1000, () => { req.destroy(); resolve(null); });
      });
      cacheStats = response;
    } catch {
      cacheStats = null;
    }

    // Check ports
    const checkPort = (port) => {
      try {
        const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8', stdio: 'pipe' });
        return result.trim().length > 0;
      } catch {
        return false;
      }
    };

    const stats = {
      server: {
        running: checkPort(8080),
        port: 8080,
        cache: cacheStats || null,
      },
      client: {
        running: checkPort(3000) || checkPort(5173),
        port: checkPort(3000) ? 3000 : (checkPort(5173) ? 5173 : null),
      },
      dashboard: {
        running: true,
        port: DASHBOARD_PORT,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(stats);
  } catch (error) {
    res.json({
      server: { running: false },
      client: { running: false },
      dashboard: { running: true, port: DASHBOARD_PORT },
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

server.listen(DASHBOARD_PORT, () => {
  console.log(`📊 Dashboard server running on http://localhost:${DASHBOARD_PORT}`);
});

