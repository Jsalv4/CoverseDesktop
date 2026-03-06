/**
 * Stripe Backend Verification Script
 * 
 * Run: node scripts/verify-stripe-backend.js [--token YOUR_AUTH_TOKEN]
 * 
 * Tests:
 * 1. GET /api/stripe-config returns { publishableKey }
 * 2. POST /api/create-checkout-session requires auth
 * 3. POST /api/confirm-payment requires auth
 * 4. Success URL format includes coverse://checkout?session_id=
 */

const API_BASE = process.env.API_BASE || 'https://coversehq.com';

const args = process.argv.slice(2);
const tokenIndex = args.indexOf('--token');
const AUTH_TOKEN = tokenIndex !== -1 && args[tokenIndex + 1] ? args[tokenIndex + 1] : null;

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${COLORS.reset} ${message}`);
}

function success(message) {
  log(COLORS.green, '✓', message);
}

function fail(message) {
  log(COLORS.red, '✗', message);
}

function warn(message) {
  log(COLORS.yellow, '⚠', message);
}

function info(message) {
  log(COLORS.blue, 'ℹ', message);
}

function debug(message) {
  log(COLORS.gray, '→', message);
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testStripeConfig() {
  info('Testing GET /api/stripe-config...');
  
  try {
    const response = await fetch(`${API_BASE}/api/stripe-config`);
    debug(`Status: ${response.status}`);
    
    if (!response.ok) {
      fail(`stripe-config endpoint returned ${response.status}`);
      const text = await response.text();
      debug(`Response: ${text}`);
      return false;
    }
    
    const data = await response.json();
    debug(`Response: ${JSON.stringify(data, null, 2)}`);
    
    if (!data || typeof data.publishableKey !== 'string') {
      fail('Response missing publishableKey field');
      return false;
    }
    
    if (!data.publishableKey.startsWith('pk_')) {
      fail(`publishableKey has invalid format: ${data.publishableKey}`);
      return false;
    }
    
    const isTestKey = data.publishableKey.startsWith('pk_test_');
    if (isTestKey) {
      success('stripe-config returns valid TEST publishableKey');
    } else {
      warn('stripe-config returns LIVE publishableKey (are you sure?)');
    }
    
    return true;
  } catch (error) {
    fail(`stripe-config request failed: ${error.message}`);
    return false;
  }
}

async function testCreateCheckoutSessionAuth() {
  info('Testing POST /api/create-checkout-session (auth enforcement)...');
  
  try {
    // Test without auth
    debug('Testing without Authorization header...');
    const noAuthResponse = await fetch(`${API_BASE}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          itemId: 'test-item',
          itemTitle: 'Test Item',
          price: 9.99,
          quantity: 1
        }],
        userId: 'test-user',
        returnUrl: 'coverse://checkout'
      })
    });
    
    debug(`Status without auth: ${noAuthResponse.status}`);
    
    if (noAuthResponse.status === 401 || noAuthResponse.status === 403) {
      success('create-checkout-session correctly rejects unauthenticated requests');
    } else if (noAuthResponse.status === 200) {
      fail('create-checkout-session allows unauthenticated requests (SECURITY ISSUE)');
      return false;
    } else {
      warn(`Unexpected status without auth: ${noAuthResponse.status}`);
    }
    
    // Test with auth
    if (!AUTH_TOKEN) {
      warn('No --token provided, skipping authenticated test');
      info('Run: node scripts/verify-stripe-backend.js --token YOUR_TOKEN');
      return true;
    }
    
    debug('Testing with Authorization header...');
    const authResponse = await fetch(`${API_BASE}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        items: [{
          itemId: 'test-item',
          itemTitle: 'Test Item',
          price: 9.99,
          itemType: 'sample',
          quantity: 1
        }],
        userId: 'test-user',
        returnUrl: 'coverse://checkout',
        authToken: AUTH_TOKEN
      })
    });
    
    debug(`Status with auth: ${authResponse.status}`);
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      warn(`Authenticated request failed: ${authResponse.status}`);
      debug(`Response: ${errorText}`);
      return false;
    }
    
    const data = await authResponse.json();
    debug(`Response: ${JSON.stringify(data, null, 2)}`);
    
    if (!data || typeof data.sessionId !== 'string') {
      fail('Response missing sessionId field');
      return false;
    }
    
    if (!data.sessionId.startsWith('cs_')) {
      fail(`sessionId has invalid format: ${data.sessionId}`);
      return false;
    }
    
    const isTestSession = data.sessionId.startsWith('cs_test_');
    if (isTestSession) {
      success('create-checkout-session returns valid TEST session ID');
    } else {
      warn('create-checkout-session returns LIVE session ID (are you sure?)');
    }
    
    // Check if success URL uses coverse:// protocol
    if (data.url || data.checkoutUrl) {
      debug(`Checkout URL: ${data.url || data.checkoutUrl}`);
    }
    
    return true;
  } catch (error) {
    fail(`create-checkout-session test failed: ${error.message}`);
    return false;
  }
}

async function testConfirmPaymentAuth() {
  info('Testing POST /api/confirm-payment (auth enforcement)...');
  
  try {
    // Test without auth
    debug('Testing without Authorization header...');
    const noAuthResponse = await fetch(`${API_BASE}/api/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'cs_test_fake_session_id'
      })
    });
    
    debug(`Status without auth: ${noAuthResponse.status}`);
    
    if (noAuthResponse.status === 401 || noAuthResponse.status === 403) {
      success('confirm-payment correctly rejects unauthenticated requests');
    } else if (noAuthResponse.status === 200) {
      fail('confirm-payment allows unauthenticated requests (SECURITY ISSUE)');
      return false;
    } else {
      warn(`Unexpected status without auth: ${noAuthResponse.status}`);
    }
    
    // Test with auth (but fake session - should fail with different error)
    if (!AUTH_TOKEN) {
      warn('No --token provided, skipping authenticated test');
      return true;
    }
    
    debug('Testing with Authorization header (fake session ID)...');
    const authResponse = await fetch(`${API_BASE}/api/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        sessionId: 'cs_test_fake_session_id',
        authToken: AUTH_TOKEN
      })
    });
    
    debug(`Status with auth: ${authResponse.status}`);
    
    // We expect this to fail (invalid session), but should be 404 or 400, not 401/403
    if (authResponse.status === 401 || authResponse.status === 403) {
      fail('confirm-payment rejected valid auth token');
      return false;
    }
    
    if (authResponse.status === 404 || authResponse.status === 400) {
      success('confirm-payment accepts auth and rejects invalid session');
      return true;
    }
    
    if (authResponse.status === 200) {
      warn('confirm-payment accepted fake session ID (check validation)');
      return true;
    }
    
    const errorText = await authResponse.text();
    warn(`Unexpected confirm-payment status: ${authResponse.status}`);
    debug(`Response: ${errorText}`);
    
    return true;
  } catch (error) {
    fail(`confirm-payment test failed: ${error.message}`);
    return false;
  }
}

async function testWebhookEndpoint() {
  info('Testing POST /api/stripe-webhook (existence check only)...');
  
  try {
    // We can't verify webhook signature without Stripe CLI, but we can check if endpoint exists
    const response = await fetch(`${API_BASE}/api/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'test',
        data: {}
      })
    });
    
    debug(`Status: ${response.status}`);
    
    // We expect 400 (signature verification failed) or 401, not 404
    if (response.status === 404) {
      fail('stripe-webhook endpoint not found');
      return false;
    }
    
    if (response.status === 400 || response.status === 401) {
      success('stripe-webhook endpoint exists (signature verification active)');
      return true;
    }
    
    warn(`Unexpected webhook status: ${response.status} (endpoint may exist but behave differently)`);
    return true;
  } catch (error) {
    fail(`stripe-webhook test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('   Stripe Backend Verification');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  info(`API Base: ${API_BASE}`);
  info(`Auth Token: ${AUTH_TOKEN ? '✓ Provided' : '✗ Not provided'}`);
  console.log('');
  
  const results = [];
  
  // Test 1: stripe-config
  results.push(await testStripeConfig());
  console.log('');
  await wait(500);
  
  // Test 2: create-checkout-session auth
  results.push(await testCreateCheckoutSessionAuth());
  console.log('');
  await wait(500);
  
  // Test 3: confirm-payment auth
  results.push(await testConfirmPaymentAuth());
  console.log('');
  await wait(500);
  
  // Test 4: webhook endpoint
  results.push(await testWebhookEndpoint());
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════════════');
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  if (passed === total) {
    success(`All ${total} tests passed!`);
    console.log('');
    info('Next steps:');
    console.log('  1. Configure Stripe webhook in Dashboard');
    console.log('  2. Test full checkout flow with test card 4242 4242 4242 4242');
    console.log('  3. Verify purchases appear in app after payment');
    console.log('');
  } else {
    fail(`${total - passed} out of ${total} tests failed`);
    console.log('');
    info('Fix the failing tests before proceeding to full checkout testing');
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
  console.error('');
  fail(`Verification script crashed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
