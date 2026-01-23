/**
 * Client-side diagnostic test for flight tracker connectivity
 * Run this from browser console: window.runFlightDiagnostics()
 */

interface DiagnosticResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
  duration?: number;
}

const colors = {
  reset: '%c',
  success: '%c',
  error: '%c',
  warning: '%c',
  info: '%c',
};

const styles = {
  reset: '',
  success: 'color: green; font-weight: bold;',
  error: 'color: red; font-weight: bold;',
  warning: 'color: orange; font-weight: bold;',
  info: 'color: blue;',
};

function log(message: string, style: keyof typeof styles = 'reset') {
  console.log(`${colors[style]}${message}${colors.reset}`, styles[style]);
}

export async function runFlightDiagnostics(): Promise<void> {
  console.log(
    '\n%c╔══════════════════════════════════════════════════════════════╗',
    'font-weight: bold'
  );
  console.log(
    '%c║     VR Flight Tracker - Client Diagnostic Tool              ║',
    'font-weight: bold'
  );
  console.log(
    '%c╚══════════════════════════════════════════════════════════════╝',
    'font-weight: bold'
  );

  const results: DiagnosticResult[] = [];
  const config = (window as any).__FLIGHT_TRACKER_CONFIG__ || {
    apiUrl: 'http://localhost:8080',
    wsUrl: 'ws://localhost:8080',
  };

  log(`API URL: ${config.apiUrl}`, 'info');
  log(`WebSocket URL: ${config.wsUrl}`, 'info');

  // Test 1: Server Health
  console.log('\n%c[1] Testing Server Health', 'font-weight: bold');
  try {
    const startTime = performance.now();
    const response = await fetch(`${config.apiUrl}/health`);
    const duration = performance.now() - startTime;
    const data = await response.json();

    if (response.ok) {
      results.push({
        test: 'Server Health',
        success: true,
        message: `Server is running (${Math.round(duration)}ms)`,
        details: data,
      });
      log(`✓ Server is running (${Math.round(duration)}ms)`, 'success');
    } else {
      results.push({
        test: 'Server Health',
        success: false,
        message: `Server returned ${response.status}`,
      });
      log(`✗ Server returned ${response.status}`, 'error');
    }
  } catch (error: any) {
    results.push({
      test: 'Server Health',
      success: false,
      message: error.message || 'Connection failed',
    });
    log(`✗ Server connection failed: ${error.message}`, 'error');
  }

  // Test 2: Flights API
  console.log('\n%c[2] Testing Flights API', 'font-weight: bold');
  const testLat = 50.0755; // Prague
  const testLon = 14.4378;
  const testRadius = 100;

  try {
    log(`Testing: /api/flights?lat=${testLat}&lon=${testLon}&radius=${testRadius}`, 'info');
    const startTime = performance.now();
    const response = await fetch(
      `${config.apiUrl}/api/flights?lat=${testLat}&lon=${testLon}&radius=${testRadius}`
    );
    const duration = performance.now() - startTime;
    const data = await response.json();

    if (response.ok && data.success) {
      const flightCount = data.count || data.data?.length || 0;
      results.push({
        test: 'Flights API',
        success: true,
        message: `Flights endpoint working (${Math.round(duration)}ms)`,
        details: {
          flightCount,
          timestamp: data.timestamp,
        },
        duration: Math.round(duration),
      });
      log(`✓ Flights API working (${Math.round(duration)}ms)`, 'success');
      log(`  Flights returned: ${flightCount}`, 'info');

      if (flightCount > 0 && data.data?.[0]) {
        const sample = data.data[0];
        log(`  Sample: ${sample.callsign || 'N/A'} (${sample.icao24})`, 'info');
      } else {
        log(`  ⚠ No flights in area (this may be normal)`, 'warning');
      }
    } else {
      results.push({
        test: 'Flights API',
        success: false,
        message: `API error: ${response.status}`,
        details: data,
      });
      log(`✗ Flights API error: ${response.status}`, 'error');
      if (data.error) {
        log(`  Error: ${data.error}`, 'error');
      }
    }
  } catch (error: any) {
    results.push({
      test: 'Flights API',
      success: false,
      message: error.message || 'Request failed',
    });
    log(`✗ Flights API request failed: ${error.message}`, 'error');
  }

  // Test 3: WebSocket Connection
  console.log('\n%c[3] Testing WebSocket Connection', 'font-weight: bold');
  try {
    const ws = new WebSocket(config.wsUrl);
    const wsTestPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });

    const wsConnected = await wsTestPromise;

    if (wsConnected) {
      results.push({
        test: 'WebSocket',
        success: true,
        message: 'WebSocket connection successful',
      });
      log(`✓ WebSocket connection successful`, 'success');
    } else {
      results.push({
        test: 'WebSocket',
        success: false,
        message: 'WebSocket connection failed or timed out',
      });
      log(`✗ WebSocket connection failed`, 'error');
    }
  } catch (error: any) {
    results.push({
      test: 'WebSocket',
      success: false,
      message: error.message || 'WebSocket test failed',
    });
    log(`✗ WebSocket test error: ${error.message}`, 'error');
  }

  // Test 4: Cache Stats
  console.log('\n%c[4] Testing Cache Statistics', 'font-weight: bold');
  try {
    const response = await fetch(`${config.apiUrl}/api/cache/stats`);
    const data = await response.json();

    if (response.ok && data.success) {
      results.push({
        test: 'Cache Stats',
        success: true,
        message: 'Cache stats accessible',
        details: data.data,
      });
      log(`✓ Cache stats accessible`, 'success');

      if (data.data?.cache) {
        log(`  Cache hits: ${data.data.cache.hits}`, 'info');
        log(`  Cache misses: ${data.data.cache.misses}`, 'info');
      }

      if (data.data?.flight) {
        log(`  OpenSky auth: ${data.data.flight.openskyAuthentication || 'N/A'}`, 'info');
        if (data.data.flight.openskyAuthDetails?.lastAuthErrorAt) {
          log(
            `  ⚠ Last auth error: ${new Date(data.data.flight.openskyAuthDetails.lastAuthErrorAt).toISOString()}`,
            'warning'
          );
        }
      }
    } else {
      results.push({
        test: 'Cache Stats',
        success: false,
        message: `Cache stats error: ${response.status}`,
      });
      log(`✗ Cache stats error: ${response.status}`, 'error');
    }
  } catch (error: any) {
    results.push({
      test: 'Cache Stats',
      success: false,
      message: error.message || 'Cache stats request failed',
    });
    log(`✗ Cache stats request failed: ${error.message}`, 'error');
  }

  // Summary
  console.log(
    '\n%c═══════════════════════════════════════════════════════════════',
    'font-weight: bold'
  );
  console.log('%cDiagnostic Summary', 'font-weight: bold');
  console.log(
    '%c═══════════════════════════════════════════════════════════════',
    'font-weight: bold'
  );

  const passed = results.filter((r) => r.success).length;
  const total = results.length;

  results.forEach((result) => {
    if (result.success) {
      log(`✓ ${result.test}: PASS`, 'success');
    } else {
      log(`✗ ${result.test}: FAIL - ${result.message}`, 'error');
    }
  });

  console.log(
    `\n%cResults: ${passed}/${total} tests passed`,
    passed === total ? 'color: green; font-weight: bold;' : 'color: orange; font-weight: bold;'
  );

  // Recommendations
  if (passed < total) {
    console.log('\n%cRecommendations:', 'font-weight: bold');

    if (!results.find((r) => r.test === 'Server Health')?.success) {
      log('1. Check if server is running (cd server && npm run dev)', 'warning');
    }

    if (!results.find((r) => r.test === 'Flights API')?.success) {
      log('2. Check server logs for errors', 'warning');
      log('3. Test OpenSky API connectivity (run server test-connection script)', 'warning');
    }

    if (!results.find((r) => r.test === 'WebSocket')?.success) {
      log('4. Check WebSocket URL configuration', 'warning');
    }
  } else {
    log('\n✓ All tests passed! System should be working correctly.', 'success');
  }

  console.log('\n');

  // Store results globally for inspection
  (window as any).__FLIGHT_DIAGNOSTIC_RESULTS__ = results;

  return Promise.resolve();
}

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).runFlightDiagnostics = runFlightDiagnostics;
  console.log('%cFlight Diagnostics Available', 'color: blue; font-weight: bold;');
  console.log('Run: runFlightDiagnostics()');
}
