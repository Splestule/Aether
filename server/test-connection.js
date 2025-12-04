#!/usr/bin/env node

/**
 * Flight Tracker Connection Diagnostic Tool
 * Tests connectivity to server, API endpoints, and OpenSky Network
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';
const OPENSKY_API_URL = process.env.OPENSKY_API_URL || 'https://opensky-network.org/api/states/all';
const OPENSKY_AUTH_URL = process.env.OPENSKY_AUTH_URL || 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// Test coordinates (Prague, Czech Republic)
const TEST_LAT = 50.0755;
const TEST_LON = 14.4378;
const TEST_RADIUS = 100;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

async function testServerHealth() {
  logSection('1. Testing Server Health');
  
  try {
    const startTime = Date.now();
    const response = await axios.get(`${SERVER_URL}/health`, {
      timeout: 5000,
    });
    const duration = Date.now() - startTime;
    
    if (response.status === 200) {
      logSuccess(`Server is running (${duration}ms)`);
      logInfo(`Status: ${response.data.status}`);
      logInfo(`Uptime: ${Math.floor(response.data.uptime)}s`);
      return true;
    } else {
      logError(`Server returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError('Server is not running or not accessible');
      logInfo(`Tried to connect to: ${SERVER_URL}`);
    } else if (error.code === 'ETIMEDOUT') {
      logError('Server connection timeout');
    } else {
      logError(`Server health check failed: ${error.message}`);
    }
    return false;
  }
}

async function testFlightsEndpoint() {
  logSection('2. Testing Flights API Endpoint');
  
  try {
    logInfo(`Testing: ${SERVER_URL}/api/flights?lat=${TEST_LAT}&lon=${TEST_LON}&radius=${TEST_RADIUS}`);
    
    const startTime = Date.now();
    const response = await axios.get(`${SERVER_URL}/api/flights`, {
      params: {
        lat: TEST_LAT,
        lon: TEST_LON,
        radius: TEST_RADIUS,
      },
      timeout: 30000, // 30 seconds for flight data
    });
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success) {
      logSuccess(`Flights endpoint responded successfully (${duration}ms)`);
      logInfo(`Flights returned: ${response.data.count || response.data.data?.length || 0}`);
      logInfo(`Timestamp: ${new Date(response.data.timestamp).toISOString()}`);
      
      if (response.data.data && response.data.data.length > 0) {
        const sampleFlight = response.data.data[0];
        logInfo(`Sample flight: ${sampleFlight.callsign || 'N/A'} (${sampleFlight.icao24})`);
      } else {
        logWarning('No flights returned (this might be normal if no planes in area)');
      }
      return true;
    } else {
      logError(`Unexpected response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        logError(`API returned error: ${error.response.status} ${error.response.statusText}`);
        if (error.response.data) {
          logError(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      } else if (error.request) {
        logError('No response received from server');
        logInfo(`Request timeout or network error`);
      } else {
        logError(`Request setup error: ${error.message}`);
      }
    } else {
      logError(`Unexpected error: ${error.message}`);
    }
    return false;
  }
}

async function testOpenSkyDirect() {
  logSection('3. Testing OpenSky Network API (Direct)');
  
  try {
    logInfo(`Testing: ${OPENSKY_API_URL}`);
    logInfo(`Using bounding box: lat ${TEST_LAT-1} to ${TEST_LAT+1}, lon ${TEST_LON-1} to ${TEST_LON+1}`);
    
    const startTime = Date.now();
    const response = await axios.get(OPENSKY_API_URL, {
      params: {
        lamin: TEST_LAT - 1,
        lomin: TEST_LON - 1,
        lamax: TEST_LAT + 1,
        lomax: TEST_LON + 1,
      },
      timeout: 15000,
      headers: {
        'User-Agent': 'VR-Flight-Tracker-Diagnostic/1.0',
      },
    });
    const duration = Date.now() - startTime;
    
    if (response.status === 200) {
      logSuccess(`OpenSky API responded (${duration}ms)`);
      
      if (response.data && response.data.states) {
        const flightCount = Array.isArray(response.data.states) ? response.data.states.length : 0;
        logInfo(`Flights in response: ${flightCount}`);
        
        if (flightCount > 0) {
          const sampleState = response.data.states[0];
          logInfo(`Sample flight: ${sampleState[1] || 'N/A'} (${sampleState[0]})`);
        } else {
          logWarning('OpenSky returned empty states array (no flights in area)');
        }
      } else {
        logWarning('OpenSky response missing states array');
        logInfo(`Response structure: ${Object.keys(response.data || {}).join(', ')}`);
      }
      return true;
    } else {
      logError(`OpenSky returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        logError(`OpenSky API error: ${error.response.status} ${error.response.statusText}`);
        if (error.response.status === 429) {
          logWarning('Rate limit exceeded - too many requests');
        } else if (error.response.status === 401) {
          logWarning('Authentication required - credentials may be needed');
        } else if (error.response.status === 403) {
          logWarning('Forbidden - check API access permissions');
        }
        if (error.response.data) {
          logInfo(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      } else if (error.code === 'ETIMEDOUT') {
        logError('OpenSky API connection timeout');
        logInfo('This could indicate network issues or OpenSky API is down');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        logError('Cannot reach OpenSky API');
        logInfo('Check your internet connection');
      } else {
        logError(`OpenSky connection error: ${error.message}`);
      }
    } else {
      logError(`Unexpected error: ${error.message}`);
    }
    return false;
  }
}

async function testOpenSkyAuth() {
  logSection('4. Testing OpenSky Authentication');
  
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    logWarning('OpenSky credentials not configured');
    logInfo('Set OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET in .env file');
    logInfo('Note: Anonymous access may have rate limits');
    return null;
  }
  
  logInfo('Credentials found, testing authentication...');
  
  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    
    const startTime = Date.now();
    const response = await axios.post(OPENSKY_AUTH_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.access_token) {
      logSuccess(`Authentication successful (${duration}ms)`);
      logInfo(`Token expires in: ${response.data.expires_in || 'unknown'} seconds`);
      return true;
    } else {
      logError('Authentication failed - invalid response');
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        logError(`Auth error: ${error.response.status} ${error.response.statusText}`);
        if (error.response.status === 401) {
          logWarning('Invalid credentials - check OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET');
        }
      } else {
        logError(`Auth connection error: ${error.message}`);
      }
    } else {
      logError(`Unexpected error: ${error.message}`);
    }
    return false;
  }
}

async function testCacheStats() {
  logSection('5. Testing Cache Statistics');
  
  try {
    const response = await axios.get(`${SERVER_URL}/api/cache/stats`, {
      timeout: 5000,
    });
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Cache stats endpoint accessible');
      const stats = response.data.data;
      
      if (stats.cache) {
        logInfo(`Cache hits: ${stats.cache.hits}`);
        logInfo(`Cache misses: ${stats.cache.misses}`);
        logInfo(`Cache size: ${stats.cache.size || 'N/A'}`);
      }
      
      if (stats.flight) {
        logInfo(`Total requests: ${stats.flight.totalRequests || 'N/A'}`);
        logInfo(`OpenSky auth: ${stats.flight.openskyAuthentication || 'N/A'}`);
        
        if (stats.flight.openskyAuthDetails) {
          const authDetails = stats.flight.openskyAuthDetails;
          logInfo(`Credentials configured: ${authDetails.credentialsConfigured ? 'Yes' : 'No'}`);
          if (authDetails.lastAuthSuccessAt) {
            logInfo(`Last auth success: ${new Date(authDetails.lastAuthSuccessAt).toISOString()}`);
          }
          if (authDetails.lastAuthErrorAt) {
            logWarning(`Last auth error: ${new Date(authDetails.lastAuthErrorAt).toISOString()}`);
            logWarning(`Error message: ${authDetails.lastAuthErrorMessage || 'N/A'}`);
          }
        }
      }
      return true;
    } else {
      logError('Cache stats endpoint returned unexpected response');
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      logError(`Cache stats error: ${error.response.status}`);
    } else {
      logError(`Cache stats check failed: ${error.message}`);
    }
    return false;
  }
}

async function runDiagnostics() {
  console.log('\n');
  log('╔══════════════════════════════════════════════════════════════╗', 'bright');
  log('║     VR Flight Tracker - Connection Diagnostic Tool          ║', 'bright');
  log('╚══════════════════════════════════════════════════════════════╝', 'bright');
  
  logInfo(`Server URL: ${SERVER_URL}`);
  logInfo(`OpenSky API: ${OPENSKY_API_URL}`);
  logInfo(`Test coordinates: ${TEST_LAT}, ${TEST_LON} (radius: ${TEST_RADIUS}km)`);
  
  const results = {
    serverHealth: false,
    flightsEndpoint: false,
    openskyDirect: false,
    openskyAuth: null,
    cacheStats: false,
  };
  
  // Run tests
  results.serverHealth = await testServerHealth();
  
  if (results.serverHealth) {
    results.flightsEndpoint = await testFlightsEndpoint();
    results.cacheStats = await testCacheStats();
  } else {
    logWarning('Skipping server-dependent tests (server not accessible)');
  }
  
  results.openskyDirect = await testOpenSkyDirect();
  results.openskyAuth = await testOpenSkyAuth();
  
  // Summary
  logSection('Diagnostic Summary');
  
  const allTests = [
    ['Server Health', results.serverHealth],
    ['Flights API Endpoint', results.flightsEndpoint],
    ['OpenSky API Direct', results.openskyDirect],
    ['OpenSky Authentication', results.openskyAuth],
    ['Cache Statistics', results.cacheStats],
  ];
  
  allTests.forEach(([name, result]) => {
    if (result === null) {
      logWarning(`${name}: Not tested (optional)`);
    } else if (result) {
      logSuccess(`${name}: PASS`);
    } else {
      logError(`${name}: FAIL`);
    }
  });
  
  console.log('\n');
  
  // Recommendations
  if (!results.serverHealth) {
    logSection('Recommendations');
    logWarning('1. Start the server: cd server && npm run dev');
    logWarning('2. Check if server is running on the correct port');
    logWarning('3. Verify SERVER_URL environment variable');
  } else if (!results.flightsEndpoint) {
    logSection('Recommendations');
    logWarning('1. Check server logs for errors');
    logWarning('2. Verify OpenSky API connectivity (see test 3)');
    logWarning('3. Check if OpenSky credentials are needed');
  } else if (!results.openskyDirect) {
    logSection('Recommendations');
    logWarning('1. Check your internet connection');
    logWarning('2. OpenSky API may be temporarily unavailable');
    logWarning('3. Check if you need authentication (see test 4)');
    logWarning('4. Try again in a few minutes (rate limiting)');
  } else if (results.flightsEndpoint && results.openskyDirect) {
    logSection('Status');
    logSuccess('All critical tests passed! The system should be working.');
    if (!results.openskyAuth) {
      logInfo('Note: Using anonymous OpenSky access (may have rate limits)');
    }
  }
  
  console.log('\n');
}

// Run diagnostics
runDiagnostics().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

