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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Stop all servers endpoint
app.post('/api/stop', (req, res) => {
  console.log('🛑 Stop request received');
  
  // Send response immediately to ensure client gets it
  res.json({ 
    success: true, 
    message: 'Stopping all servers...',
    killedCount: 0
  });
  
  // Use setImmediate to ensure response is sent before we start killing processes
  setImmediate(() => {
    try {
      const fs = require('fs');
      const pidFile = path.join(scriptDir, '.vr-flight-tracker.pids');
      
      // Function to kill a PID and all its children
      const killProcessTree = (pid) => {
        try {
          // Kill all children first
          try {
            const children = execSync(`pgrep -P ${pid}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
            if (children) {
              children.split('\n').forEach(childPid => {
                killProcessTree(childPid.trim());
              });
            }
          } catch (e) {
            // No children or already dead
          }
          
          // Kill the process itself
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
            console.log(`✅ Killed process ${pid} and its children`);
            return 1;
          } catch (e) {
            console.log(`⚠️ Could not kill process ${pid}: ${e.message}`);
            return 0;
          }
        } catch (e) {
          return 0;
        }
      };

      // Function to kill processes by port
      const killByPort = (port, excludeSelf = false) => {
        try {
          const result = execSync(`lsof -ti:${port}`, { encoding: 'utf8', stdio: 'pipe' });
          const pids = result.trim();
          if (pids) {
            const pidArray = pids.split('\n').filter(pid => {
              const pidNum = pid.trim();
              if (excludeSelf && pidNum === String(process.pid)) {
                return false;
              }
              return pidNum;
            });
            let count = 0;
            pidArray.forEach(pid => {
              count += killProcessTree(pid.trim());
            });
            return count;
          }
        } catch (e) {
          console.log(`ℹ️ No process found on port ${port}`);
        }
        return 0;
      };

      // Function to kill processes by name pattern (kills entire process tree)
      const killByName = (pattern, excludeSelf = false) => {
        try {
          const result = execSync(`pgrep -f "${pattern}"`, { encoding: 'utf8', stdio: 'pipe' });
          const pids = result.trim();
          if (pids) {
            const pidArray = pids.split('\n').filter(pid => {
              const pidNum = pid.trim();
              if (excludeSelf && pidNum === String(process.pid)) {
                return false;
              }
              return pidNum;
            });
            let count = 0;
            pidArray.forEach(pid => {
              count += killProcessTree(pid.trim());
            });
            return count;
          }
        } catch (e) {
          console.log(`ℹ️ No process found matching "${pattern}"`);
        }
        return 0;
      };

      console.log('🛑 Stopping all servers...');
      
      let killedCount = 0;
      
      // Try to read PIDs from file first (more reliable)
      try {
        if (fs.existsSync(pidFile)) {
          const pidData = fs.readFileSync(pidFile, 'utf8');
          const lines = pidData.split('\n');
          lines.forEach(line => {
            const match = line.match(/(SERVER|CLIENT|DASHBOARD)_PID=(\d+)/);
            if (match) {
              const pid = match[2];
              console.log(`Killing ${match[1]} process ${pid} from PID file...`);
              killedCount += killProcessTree(pid);
            }
          });
        }
      } catch (e) {
        console.log('⚠️ Could not read PID file, using fallback methods');
      }
      
      // Fallback: Kill by port
      killedCount += killByPort(8080); // Backend server
      killedCount += killByPort(3000); // Frontend (if using port 3000)
      killedCount += killByPort(5173); // Frontend (Vite default)
      
      // Also kill by process name patterns (kills entire trees)
      killedCount += killByName('tsx watch src/index.ts'); // Backend dev server
      killedCount += killByName('vite'); // Frontend dev server
      killedCount += killByName('npm run dev'); // npm processes
      
      console.log(`✅ Stopped ${killedCount} process(es)`);
      
      // Clean up PID file
      try {
        if (fs.existsSync(pidFile)) {
          fs.unlinkSync(pidFile);
        }
      } catch (e) {
        // Ignore
      }
      
      // Kill dashboard server last, after a delay to ensure response was sent
      setTimeout(() => {
        console.log('🛑 Shutting down dashboard server...');
        killByPort(8081, true);
        killByName('node.*dashboard-server', true);
        setTimeout(() => {
          process.exit(0);
        }, 200);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error stopping servers:', error);
      setTimeout(() => {
        process.exit(1);
      }, 500);
    }
  });
});

server.listen(DASHBOARD_PORT, () => {
  console.log(`📊 Dashboard server running on http://localhost:${DASHBOARD_PORT}`);
});

