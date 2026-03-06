Absolutely — here’s a full handoff you can give Copilot in your app workspace, with exact backend contract, UI/data mapping, and implementation guidance.

## 1) Ground truth: what your backend now provides

Use these as authoritative references from your current codebase:

- Purchase normalization + profile purchase/project payload:
  - [Coverse/server.js](Coverse/server.js#L648-L923)
- Bootstrap endpoint map (includes discover + marketplace):
  - [Coverse/server.js](Coverse/server.js#L1041-L1071)
- Discover users payload builder:
  - [Coverse/server.js](Coverse/server.js#L1074-L1135)
- Marketplace payload builder:
  - [Coverse/server.js](Coverse/server.js#L1137-L1230)
- Live route handlers (`getUserPurchases`, `profile/aggregate`, `app/bootstrap`, discover, marketplace):
  - [Coverse/server.js](Coverse/server.js#L2020-L2509)
- Auth model (Firebase token OR Electron JWT):
  - [Coverse/server.js](Coverse/server.js#L349-L403)
- Current docs for app endpoints:
  - [Coverse/README.md](Coverse/README.md#L136-L159)
- Site purchase loading logic (for parity behavior):
  - [Coverse/index.html](Coverse/index.html#L7390-L7505)
- Site discover behavior reference:
  - [Coverse/index.html](Coverse/index.html#L14460-L14534)
- Site marketplace behavior reference:
  - [Coverse/index.html](Coverse/index.html#L5819-L6185)

---

## 2) Why your app showed “3 purchases (details unavailable from API)”

That message usually appears when the app only reads a count (e.g. `purchasesCount`) and does not find detail arrays.

Your API now exposes multiple aliases for compatibility. The app should look in this order:

1. `purchaseDetails`
2. `purchaseItems`
3. `purchases.items`
4. `items` (from `/api/getUserPurchases`)
5. fallback to `purchases` (summary/raw)

So if app still shows “details unavailable”, the app parser is not using the new fields yet.

---

## 3) Exact backend snippets your Copilot should rely on

### Purchases detail aliases (`/api/getUserPurchases`)
```javascript
res.end(JSON.stringify({
    purchases,
    items: purchaseDetails,
    purchaseItems: purchaseDetails,
    purchaseDetails,
    count: purchases.length,
    itemCount: purchaseDetails.length
}));
```
Source: [Coverse/server.js](Coverse/server.js#L2047-L2054)

### Profile payload includes projects + detailed purchases
```javascript
projects,
sharedProjects: projects,
purchases,
purchaseItems: purchaseDetails,
purchaseDetails,
purchasesData: {
    count: purchaseDetails.length,
    items: purchaseDetails
},
```
Source: [Coverse/server.js](Coverse/server.js#L891-L898)

### Aggregate/bootstrap also include purchase detail aliases
```javascript
purchases: {
    count: libraryBundle.counts.purchases,
    items: libraryBundle.facets.purchases
},
purchaseItems: libraryBundle.facets.purchases,
purchaseDetails: libraryBundle.facets.purchases,
```
Sources:
- [Coverse/server.js](Coverse/server.js#L2366-L2371)
- [Coverse/server.js](Coverse/server.js#L2449-L2454)

### Discover endpoint
```javascript
if ((pathname === '/api/discover/users' || pathname === '/api/users/discover') && req.method === 'GET') {
    const decoded = await requireUserOrElectron(req, res);
    ...
    const payload = await buildDiscoverUsersPayload({
        firestore: admin.firestore(),
        uid: decoded.uid,
        limit
    });
    res.end(JSON.stringify(payload));
}
```
Source: [Coverse/server.js](Coverse/server.js#L2469-L2488)

### Marketplace endpoint
```javascript
if ((pathname === '/api/marketplace' || pathname === '/api/marketplace/items') && req.method === 'GET') {
    const decoded = await requireUserOrElectron(req, res);
    ...
    const payload = await buildMarketplacePayload({
        firestore: admin.firestore(),
        limit,
        type
    });
    res.end(JSON.stringify(payload));
}
```
Source: [Coverse/server.js](Coverse/server.js#L2492-L2509)

---

## 4) App-side API connection contract (what Copilot should implement)

### Auth header (required for all app endpoints)
- `Authorization: Bearer <token>`
- Token can be:
  - Firebase ID token, or
  - Electron JWT from your relay flow

Auth behavior is defined in [Coverse/server.js](Coverse/server.js#L370-L403).

### Recommended app bootstrap-first flow
1. Call `/api/app/bootstrap`
2. Read `bootstrap.api` endpoint map
3. Hydrate profile tab from returned `profile`, `purchaseDetails`, `projects`
4. Load discover via `/api/discover/users`
5. Load marketplace via `/api/marketplace`

Endpoint map exists in [Coverse/server.js](Coverse/server.js#L1043-L1063).

---

## 5) Drop-in app parser logic (important)

Use this adapter in your app workspace so every payload shape is accepted:

```ts
type PurchaseItem = {
  id: string;
  purchaseId?: string;
  postId?: string | null;
  name?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  type?: string;
  coverImage?: string;
  source?: string;
  purchasedAt?: string | null;
  createdAt?: string | null;
};

function normalizePurchaseList(payload: any): PurchaseItem[] {
  const candidates = [
    payload?.purchaseDetails,
    payload?.purchaseItems,
    payload?.purchases?.items,
    payload?.items,
    payload?.profile?.purchaseDetails,
    payload?.profile?.purchaseItems,
    payload?.profile?.purchasesData?.items
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) return arr;
  }

  // If only summary/raw exists, return empty detail list so UI can show safe fallback
  return [];
}

function normalizeProjectList(payload: any): any[] {
  const arr =
    payload?.projects ??
    payload?.profile?.sharedProjects ??
    payload?.profile?.projects ??
    [];
  return Array.isArray(arr) ? arr : [];
}
```

---

## 6) Profile tab rendering rules (Copilot should follow)

For purchases section:
- Show details if `normalizePurchaseList(...)` has items.
- Only show “details unavailable” if:
  - `purchasesCount > 0`, and
  - parsed detail list is empty.
- Prefer these fields per row:
  - title: `name || fileName || "Purchased Item"`
  - subtitle: `type || fileType`
  - thumb: `coverImage`
  - action URL: `fileUrl`

For projects section:
- Use `projects` or `sharedProjects`
- Render:
  - `title || name`
  - `visibility`, `status`
  - collaborator count from `collaborators.length`

---

## 7) Discover tab contract

### API:
- `GET /api/discover/users?limit=30`

### Response shape:
- `users: Array<{ uid, displayName, bio, genre, location, avatarUrl, photoURL, stats... }>`
- `counts: { total, excluded }`

Generated by:
- [normalizeDiscoverUser](Coverse/server.js#L1074-L1097)
- [buildDiscoverUsersPayload](Coverse/server.js#L1099-L1135)

### Behavior parity with site:
- Excludes current user
- Excludes already-followed + followers
- Prioritizes higher `followersCount`

---

## 8) Marketplace tab contract

### API:
- `GET /api/marketplace?type=all&limit=120`
- alias: `/api/marketplace/items`

### Query `type` currently supported by backend filter:
- `all`, `samples`, `instrumentals`, `songs`, or direct sampleType match

Filtering logic:
- [Coverse/server.js](Coverse/server.js#L1208-L1220)

### Item shape for UI card:
- `id`, `title`, `description`, `sampleType`, `image`, `previewType`, `videoUrl`
- `userName`, `userAvatar`
- `genre`, `bpm`, `key`, `tags`
- `isFree`, `streamOnly`, `price`, `priceValue`
- `files[]`, `audioUrl`

Normalization:
- [Coverse/server.js](Coverse/server.js#L1153-L1194)

---

## 9) UI design parity notes Copilot should keep

To keep your app visually consistent with site:
- Dark shell + card contrast
- Neon green primary action
- Cyan secondary action
- Muted slate metadata text
- Rounded card/grid style

Palette source:
- [Coverse/index.html](Coverse/index.html#L306-L313)

---

## 10) “Outside-the-box” robustness checklist for Copilot

Tell Copilot to include all of this:

- Token expiry handling (401 -> refresh token -> retry once)
- Endpoint fallback:
  - use `/api/app/bootstrap` first
  - if fail, call individual endpoints
- Safe rendering:
  - guard missing arrays
  - guard malformed URLs
- Pagination readiness:
  - marketplace `limit`
- Empty states:
  - no purchases
  - no discover suggestions
  - no marketplace items
- Analytics hooks:
  - purchase item clicked
  - discover follow clicked
  - marketplace item opened
- Non-breaking compatibility:
  - consume aliases (`purchaseDetails`, `purchaseItems`, `items`)
- Performance:
  - cache bootstrap payload in memory for session
  - avoid duplicate fetches on tab switch unless stale

---

## 11) Copy-paste Copilot prompt for your app workspace

Use this exact prompt in the other workspace:

```text
Implement API wiring for Profile Purchases, Discover Users tab, and Marketplace tab using the Coverse backend contract.

Requirements:
1) Auth:
- Every request must send Authorization: Bearer <token>.
- Token may be Firebase ID token or Electron JWT.

2) Bootstrap:
- On app startup, call GET /api/app/bootstrap.
- Read endpoint map from bootstrap.api.
- Hydrate profile from bootstrap.profile plus purchase aliases.

3) Profile Purchases:
- Parse detail array using precedence:
  purchaseDetails -> purchaseItems -> purchases.items -> items -> profile.purchaseDetails -> profile.purchaseItems -> profile.purchasesData.items.
- Render purchase cards with title/name, type/fileType, coverImage, purchasedAt, and fileUrl action.
- Show fallback “X purchases (details unavailable from API)” only if count exists but detail array is empty.

4) Discover tab:
- Call GET /api/discover/users?limit=30.
- Render cards using uid, displayName, bio, genre, location, avatarUrl/photoURL, followersCount.
- Handle empty state.

5) Marketplace tab:
- Call GET /api/marketplace?type=all&limit=120.
- Render item grid using title, image/previewType, price/isFree/streamOnly, userName, tags, genre/bpm/key, audioUrl.
- Add optional type filter support with query param type.

6) Resilience:
- Add retry-once behavior for transient 5xx.
- On 401, prompt sign-in or refresh token.
- Keep response parsing defensive to missing fields.

Use TypeScript-safe interfaces and small parser helpers.
Do not hardcode assumptions that purchases only exist in one field name.
```

---

If you want, I can now generate a second deliverable: a full app-side TypeScript module (`coverseApiClient.ts`) with all request/response types + parser helpers ready to paste.

---

## 12) Focused Copilot prompt: Marketplace + Discover UI layout and full wiring

Use this prompt in the other app workspace when you want a strict implementation focused on UI layout + API wiring correctness for Discover and Marketplace tabs.

```text
Implement the Discover and Marketplace tabs end-to-end using the existing app design system, and wire them to Coverse backend APIs exactly.

Context / API contract:
- All requests must send Authorization: Bearer <token>
- Token may be Firebase ID token OR Electron JWT
- Discover endpoint: GET /api/discover/users?limit=30
- Marketplace endpoint: GET /api/marketplace?type=all&limit=120
- Fallback aliases: /api/users/discover and /api/marketplace/items
- Bootstrap endpoint map available at GET /api/app/bootstrap in bootstrap.api

Implementation goals:
1) Discover tab UI layout
- Grid layout similar to existing profile-card style:
  - avatar (circle)
  - displayName
  - short bio (2 lines max)
  - genre/location meta line
  - follower count line
  - Follow button CTA
- Desktop: 3 columns where possible; tablet: 2; mobile: 1
- Include loading, empty, and error states:
  - Loading: skeleton cards or loading text
  - Empty: "No suggestions right now"
  - Error: "Could not load suggestions"

2) Discover tab behavior
- On tab open, fetch discover data from /api/discover/users?limit=30
- Parse users from payload.users
- Exclude no additional users client-side unless user is invalid (already handled server-side)
- Follow button should optimistically disable/spin and then re-enable on failure
- After successful follow, remove card from list

3) Marketplace tab UI layout
- Card grid with each card containing:
  - Cover image or preview frame
  - Type badge (sample/instrumental/song/etc.)
  - Title + creator row (avatar + userName)
  - Metadata row (genre, bpm, key)
  - Tags chips (max 3 visible)
  - Price badge + action button
- Card action behavior:
  - Stream Only -> show stream badge/button
  - Free -> show Free Download
  - Paid -> show Add to Cart / Purchase CTA
- Keep card spacing, rounded corners, and dark theme parity with current app

4) Marketplace tab behavior
- Fetch marketplace data from /api/marketplace?type=all&limit=120 on tab open
- Render payload.items directly
- Implement optional type filter control wired to `type` query param
  - all, samples, instrumentals, songs
- Refetch when filter changes
- Keep loading/empty/error states

5) Wiring + reliability requirements
- Build a small API client helper:
  - getDiscoverUsers(limit)
  - getMarketplaceItems({ type, limit })
- Retry once on transient 5xx
- On 401: surface auth-expired UI state and stop retry loops
- Strong null safety for optional fields
- No hardcoded assumptions about missing fields; provide UI fallbacks

6) Data mapping requirements
- Discover mapping from user object:
  - id: uid
  - name: displayName
  - avatar: avatarUrl || photoURL
  - bio: bio
  - subtitle: genre + location
  - followers: followersCount || stats.followersCount
- Marketplace mapping from item object:
  - id, title, description, sampleType/type
  - image, previewType, videoUrl
  - userName, userAvatar
  - genre, bpm, key, tags
  - isFree, streamOnly, price, priceValue
  - audioUrl, files

7) UX details to enforce
- Preserve scroll position per tab if app already supports it
- Debounce filter changes by ~200ms if using text/search input
- Prevent duplicate in-flight requests when rapidly switching tabs
- Keep empty states actionable (e.g., "Try another filter")

8) Deliverables expected from Copilot
- Updated tab components/views for Discover + Marketplace
- API client wiring code
- Types/interfaces for discover users and marketplace items
- Minimal integration notes in code comments only where necessary
- No design-system-breaking color or component changes

Validate by:
- Opening Discover tab and confirming cards render from API
- Opening Marketplace tab and confirming cards render from API
- Switching filters and confirming re-query + correct card updates
- Simulating 401 and 5xx handling paths
```