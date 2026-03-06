# Stripe Integration Complete Walkthrough

## ✅ Status: Backend Auth + Endpoints Verified

All 4 backend verification tests pass:
- ✓ GET /api/stripe-config returns TEST publishableKey
- ✓ POST /api/create-checkout-session enforces auth (401 unauthenticated)
- ✓ POST /api/confirm-payment enforces auth (401 unauthenticated)
- ✓ POST /api/stripe-webhook exists and verifies signatures

**Commit:** 81427e5 on backend repo

---

## Step 1: Configure Stripe Dashboard Webhook (REQUIRED)

### 1.1 Go to Stripe Dashboard → Developers → Webhooks
- URL: https://dashboard.stripe.com/test/webhooks

### 1.2 Click "Add Endpoint"
- **Endpoint URL:** `https://coversehq.com/api/stripe-webhook`
- **Events to listen for:** Select:
  - `checkout.session.completed`
  - (Optional but recommended) `charge.refunded`
- **Click "Add Endpoint"**

### 1.3 Copy the Webhook Signing Secret
- After creation, click the endpoint you just made
- Scroll to "Signing secret" → **Click "Reveal"**
- Copy the secret (starts with `whsec_`)
- **Add to Railway env var:** `STRIPE_WEBHOOK_SECRET=whsec_...`

### 1.4 Test webhook delivery
- In Dashboard, scroll down to "Recent events"
- You should see test pings if webhook is reachable

---

## Step 2: Test App → Backend → Stripe Flow (LOCAL DEV)

### 2.1 Start Electron Dev App
```bash
npm start
```

### 2.2 Sign In
- Use your test Firebase account (same as backend)
- Confirm `currentUser.uid` is populated

### 2.3 Add Item to Cart
- Go to **Marketplace** tab
- Find any paid item (price > 0)
- Click the item → should add to cart
- Cart badge should show "1"

### 2.4 Open Cart Modal
- Click **cart button** in header
- Verify item appears in cart with price

### 2.5 Click Checkout
- **Click "Checkout"** button
- App should:
  1. Show "Creating checkout session..." notification
  2. Fetch publishable key via IPC → `stripe:getPublishableKey`
  3. Call `stripe:createCheckoutSession` → backend creates Stripe session
  4. Redirect to Stripe Checkout page

### 2.6 Complete Stripe Checkout
- Use **test card:** `4242 4242 4242 4242`
- **Expiry:** Any future date (e.g., `12/28`)
- **CVC:** Any 3 digits (e.g., `123`)
- **Name:** Any name
- **Email:** Any email
- **Click "Pay"**

### 2.7 Verify Return to App
- Browser/app should redirect to `coverse://checkout?session_id=cs_test_...`
- Electron main process handles deep-link → emits `checkout-success` IPC
- Renderer should:
  1. Call `stripeBridge.confirmPayment(sessionId, authToken)`
  2. Show "Purchase completed! Check your library."
  3. Refresh library + purchases cache
  4. Cart should clear

### 2.8 Verify Purchases Show in App
- Go to **Profile** → **Purchases** tab
- New purchase should appear
- Or go to **Library** → should show newly purchased item available

---

## Step 3: Monitor Backend Logs

While running checkout flow, check backend logs for:

```
[Stripe] create-checkout-session called
[Stripe] Session created: cs_test_...
[Stripe] Webhook received: checkout.session.completed
[Stripe] Purchase recorded: userId=... sessionId=cs_test_...
```

If webhook doesn't fire, check:
1. Stripe Dashboard → Developers → Webhooks → Recent events (look for errors)
2. Backend logs for webhook signature validation errors
3. Ensure `STRIPE_WEBHOOK_SECRET` is set correctly on Railway

---

## Step 4: Repeat Test (Different Item/Amount)

Test multiple scenarios:
- [ ] Single item checkout
- [ ] Multiple items in cart (quantity > 1)
- [ ] Different price points
- [ ] Verify each purchase appears in library

---

## Step 5: Test Decline Scenario (Optional)

**Use decline test card:** `4000 0000 0000 0002`

Expected flow:
1. Stripe Checkout should reject payment
2. Redirect to `coverse://checkout-cancel`
3. App should show "Checkout was cancelled"
4. Cart should remain intact (not cleared)
5. User can retry checkout

---

## Step 6: Prepare for Production

Once test mode fully works:

### 6.1 Get Live Stripe Keys
- Stripe Dashboard → Settings → API Keys (toggle "Live" mode)
- Copy **live publishable key** (starts with `pk_live_`)
- Copy **live secret key** (starts with `sk_live_`)
- Copy **live webhook secret**

### 6.2 Update Railway Env Vars
```
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

### 6.3 Update Callback URLs
- Stripe Dashboard → Settings → Checkout configuration
- **Success URL:** (Stripe auto-determines via webhooks, just verify)
- **Cancel URL:** (same as checkout)

### 6.4 Test with Live Keys (Small Amount)
- Use **live test card:** `4242 4242 4242 4242` (still test with live keys)
- Actually charges your card (then refund in Dashboard)
- Verify cart → checkout → success flow works with live keys

### 6.5 Ensure App Protocol Registration
- Rebuild installer: `npm run build:win`
- Installer should now register `coverse://` protocol on install
- Test deep-link after install

---

## Checklist: What's Done vs. What's Left

### ✅ Done (Desktop App)
- [x] Cart UI (add/remove/quantity)
- [x] Cart persistence (localStorage)
- [x] Stripe.js loading from CDN
- [x] Publishable key fetched from backend via IPC
- [x] Checkout session created via IPC
- [x] Redirect to Stripe Checkout
- [x] Deep-link handler for `coverse://checkout?session_id=...`
- [x] Payment confirmation via IPC
- [x] Library refresh after purchase
- [x] Protocol registration in installer config

### ✅ Done (Backend)
- [x] GET /api/stripe-config
- [x] POST /api/create-checkout-session (auth enforced)
- [x] POST /api/confirm-payment (auth enforced, ownership check)
- [x] POST /api/stripe-webhook (signature verification)
- [x] Success URL format: `coverse://checkout?session_id=...`

### ⚠️ Partially Done (Backend)
- [-] Webhook purchase persistence (endpoint exists, business logic TODO)
  - Currently webhook receives and verifies signature
  - Does NOT yet write purchase to Firebase
  - **Fix:** Implement purchase recording in webhook handler (server.js:3000+)

### 📋 TODO (External)
- [ ] Configure webhook in Stripe Dashboard (you do this manually)
- [ ] Test with test card (you do this)
- [ ] Migrate to live keys when ready (you do this)

---

## Troubleshooting

### Cart button not showing?
- Check browser console for JavaScript errors
- Ensure `pages/app.html` line 177-186 cart button HTML is present
- Reload page

### "Payment system not available" error?
- App failed to load Stripe.js or fetch publishable key
- Check browser console → Network tab → look for failed `/api/stripe-config` fetch
- Verify backend is running and endpoint returns valid key

### Stripe Checkout doesn't load?
- `stripe.redirectToCheckout()` failed
- Check console for error message
- Verify sessionId is valid (should start with `cs_test_` or `cs_live_`)
- Verify Stripe.js initialized correctly with correct key

### Deep-link doesn't return to app?
- Browser/OS may not recognize `coverse://` protocol
- On Windows installer, ensure installer registered protocol (check Registry)
- Test manually: `start coverse://checkout?session_id=cs_test_abc`

### Webhook not firing?
- Stripe Dashboard → Developers → Webhooks → click endpoint
- Check "Recent events" tab for any failed deliveries
- Click failed event → scroll to "Request body" to see error details
- Common issue: `STRIPE_WEBHOOK_SECRET` mismatch (regenerate and update)

### Purchase not appearing in library after payment?
- Check backend logs for webhook processing errors
- Manually verify purchase was written to Firebase
- Confirm signed-in user ID matches purchase record
- Try manual page refresh (F5)

---

## Final Verification Command

Once everything is wired, verify backend still passes all checks:

```bash
node scripts/verify-stripe-backend.js --token YOUR_AUTH_TOKEN
```

Expected output:
```
✓ stripe-config returns valid TEST publishableKey
✓ create-checkout-session correctly rejects unauthenticated requests
✓ create-checkout-session returns valid TEST session ID (with auth)
✓ confirm-payment correctly rejects unauthenticated requests
✓ confirm-payment accepts valid auth
✓ stripe-webhook endpoint exists (signature verification active)
```

---

## Timeline

- **Now:** Steps 1-3 (test test-mode flow)
- **After verification:** Step 4-5 (edge cases)
- **When ready:** Step 6 (go live)

You are here: **Step 1 prerequisites**

Good luck! 🚀
