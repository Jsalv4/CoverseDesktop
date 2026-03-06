# APP BUG SCAN REPORT
## Stripe + Auth Integration Health Check

**Generated:** Feb 23, 2026  
**Status:** SCANNING

---

## POTENTIAL ISSUES IDENTIFIED

### 1. ⚠️ Auth State Synchronization Risk
**File:** src/app.js line 132-136
```javascript
window.addEventListener('coverse-user-ready', async (e) => {
  console.log('[Coverse] User ready:', e.detail);
  currentUser = e.detail;
```

**Issue:** If `e.detail` is undefined or missing expected fields, `currentUser` becomes invalid.  
**Impact:** Subsequent calls to `currentUser.uid` will crash.  
**Check:** Add null guard. What exactly appears in browser console after login?

---

### 2. ⚠️ Stripe Init Timing
**File:** src/app.js line 147-148
```javascript
initCart().catch((error) => {
  console.error('[Cart] Stripe init failed:', error);
});
```

**Issue:** `initCart()` runs on DOMContentLoaded but Stripe.js may not be loaded yet.  
**File:** pages/app.html line 921
```html
<script src="https://js.stripe.com/v3/"></script>
<script src="../src/app.js"></script>
```

**Fix Status:** ✅ Script order is correct (Stripe before app.js)  
**Issue:** But `if (typeof Stripe === 'undefined')` check on line 1169 might still fail if Stripe CDN is slow.

---

### 3. ❌ CRITICAL: Auth Event Order Race Condition
**File:** pages/app.html lines 895-911
```javascript
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  // ... profile fetch ...
  window.dispatchEvent(new CustomEvent('coverse-user-ready', { detail: profile }));
});
```

**Potential Issue:** What if `profile` object from Firestore fetch has wrong shape?  
**Symptom:** `currentUser` gets set but missing critical fields like `uid`, `displayName`  
**Impact:** Checkout flow breaks, cart fails to submit userId

---

### 4. ❌ STRIPE: Missing null check before checkout
**File:** src/app.js line 1353
```javascript
if (!currentUser?.uid) {
  showNotification('Please sign in to checkout');
  return;
}
```

**Current Status:** ✅ Good  
**But:** What if `currentUser` is defined but `currentUser.uid` is undefined? The app might pass `userId: undefined` to backend.

---

### 5. ⚠️ Event Listener Crash Risk
**File:** src/app.js line 70-91
```javascript
window.coverse.onCheckoutSuccess?.(async (data) => {
  const sessionId = String(data?.sessionId || '').trim();
  if (!sessionId) {
    throw new Error('Missing sessionId from checkout callback');
  }
  const auth = await getProfilePostsAuthContext();
```

**Issue:** If `getProfilePostsAuthContext()` throws or returns null, `auth?.token` could be undefined and sent to backend.  
**Fix:** Add explicit null check.

---

### 6. ⚠️ Cart Total Calculation Bug Risk
**File:** src/app.js line 1325
```javascript
function updateCartTotal() {
  cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}
```

**Issue:** What if `item.price` is a string? JavaScript will coerce `"29.99" * 1` to `29.99` but could be fragile.  
**Fix:** Ensure API always returns prices as numbers.

---

## WHAT I NEED FROM YOU

**Please describe the login glitch:**
1. Does the page redirect but then blank/error?
2. Does it show an error message? (If yes, what does it say?)
3. Does the browser console show any red errors?
4. Does it hang/freeze indefinitely?
5. Does it redirect back to login after a few seconds?

**Once you tell me, I can pinpoint the exact fix.** In the meantime, let me check the browser console for errors during your next login attempt.

---

## QUICK DEBUG INSTRUCTIONS

1. **Open Dev Tools:** F12 or Right-click → Inspect
2. **Go to Console tab**
3. **Refresh page or try login**
4. **Take screenshot of any red errors**
5. **Paste the error text here**

This will tell us exactly where the glitch is.

---

## VERIFIED AS WORKING ✅

- [x] Stripe config endpoint returns valid key
- [x] Cart add/remove/quantity functions
- [x] Cart localStorage persistence
- [x] Deep-link handler `coverse://checkout?session_id=`
- [x] IPC protocol handlers in main.js
- [x] stripeBridge preload exposure
- [x] Backend returns 401 for unauthorized checkout

---

