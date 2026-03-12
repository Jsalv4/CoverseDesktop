// ============================================
// COVERSE - Discord-Style Collaboration App
// Main Application Controller
// ============================================

// ============================================
// STATE
// ============================================
let currentSession = null;
let currentChannel = null;
let currentChannelType = null;
let inVoiceCall = false;
let isJoiningVoice = false;
let voiceStartTime = null;
let voiceTimerInterval = null;

// User state
let currentUser = null;
let userFriends = [];
let userConversations = [];
let userLibrary = [];
let currentDMUser = null;
let currentConversationId = null;
let pendingFriendRequests = [];
let currentFriendsTab = 'all';
let addFriendModalMode = 'friend';
let currentProfileTab = 'posts';
let sessionInviteSearchTimer = null;
let lastSessionId = null;
let checkoutIpcListenersBound = false;
let pendingCheckoutSessionId = '';
let processingCheckoutSessionId = '';
let lastProcessedCheckoutSessionId = '';
let purchaseSyncEntries = [];
let purchasesSyncLoading = false;
let lastPurchasesSyncError = '';
let inviteNotificationsUnsubscribe = null;
let inviteNotificationPrimed = false;
let seenInviteNotificationIds = new Set();
let followNotificationsUnsubscribe = null;
let followNotificationsPrimed = false;
let seenFollowNotificationIds = new Set();
let notificationCounter = 0;
let notificationTimers = new Map();
let notificationHistory = [];
let notificationUnreadCount = 0;

const NOTIFICATION_HISTORY_LIMIT = 40;

const SESSION_CACHE_KEY = 'coverse_sessions_cache';
const LAST_SESSION_KEY = 'coverse_last_session';
const LIBRARY_CACHE_KEY = 'coverse_library';
const LIBRARY_REMOTE_KEY = 'coverse_remote_library';
const LIBRARY_SITE_KEY = 'coverse_site_library';
const LIBRARY_SHOW_PROFILE_UPLOADS_KEY = 'coverse_library_show_profile_uploads';
const LIBRARY_BLOB_DB = 'coverse_library_blobs';
const LIBRARY_BLOB_STORE = 'files';
const API_BASE_KEY = 'coverse_api_base';
const DEFAULT_API_BASE = 'https://coversehq.com';
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const DEFAULT_TEXT_CHANNELS = ['general', 'files'];
const DEFAULT_VOICE_CHANNELS = ['Main', 'Studio'];
const SESSION_BOARD_CHANNEL_ID = 'board';
const SESSION_BOARD_LABEL = 'Session Board';

const coverseFeedUtils = (typeof window !== 'undefined' && window.CoverseFeedUtils) || {};
const normalizeFeedType = typeof coverseFeedUtils.normalizeFeedType === 'function'
  ? coverseFeedUtils.normalizeFeedType
  : ((value = '') => String(value || '').trim().toLowerCase() || 'sample');
const normalizeFeedFilterType = typeof coverseFeedUtils.normalizeFeedFilterType === 'function'
  ? coverseFeedUtils.normalizeFeedFilterType
  : ((value = '', fallback = 'all') => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowList = ['all', 'music', 'sample', 'sample-pack', 'drum-pack', 'loop', 'vocal', 'one-shot', 'fx-pack', 'midi-pack', 'preset-pack', 'beat', 'collabs', 'video', 'service', 'plugin'];
    return allowList.includes(normalized) ? normalized : (allowList.includes(String(fallback || '').trim().toLowerCase()) ? String(fallback || '').trim().toLowerCase() : 'all');
  });
const getDisplayTypeLabel = typeof coverseFeedUtils.getDisplayTypeLabel === 'function'
  ? coverseFeedUtils.getDisplayTypeLabel
  : ((value = '') => String(value || '').trim() || 'Sample');
const getActiveFeedFilter = typeof coverseFeedUtils.getActiveFeedFilter === 'function'
  ? coverseFeedUtils.getActiveFeedFilter
  : ((value = '', fallback = 'all') => normalizeFeedFilterType(value, fallback));
const getFeedFilterAllowedTypes = typeof coverseFeedUtils.getFeedFilterAllowedTypes === 'function'
  ? coverseFeedUtils.getFeedFilterAllowedTypes
  : ((filterType = 'all') => {
    const normalizedFilter = normalizeFeedFilterType(filterType, 'all');
    if (normalizedFilter === 'all') return [];
    if (normalizedFilter === 'sample-pack') {
      return ['sample-pack', 'drum-pack', 'fx-pack', 'midi-pack', 'preset-pack', 'one-shot', 'loop', 'vocal'];
    }
    if (normalizedFilter === 'collabs') return ['collab'];
    return [normalizedFilter];
  });
const applyFeedFilter = typeof coverseFeedUtils.applyFeedFilter === 'function'
  ? coverseFeedUtils.applyFeedFilter
  : ((items = []) => Array.isArray(items) ? items.slice() : []);
const normalizeMarketplaceFilterType = typeof coverseFeedUtils.normalizeMarketplaceFilterType === 'function'
  ? coverseFeedUtils.normalizeMarketplaceFilterType
  : ((value = '', fallback = 'all') => {
    const normalized = String(value || '').trim().toLowerCase();
    const allowList = ['all', 'samples', 'instrumentals', 'sample-packs', 'drum-kits', 'loops', 'vocals', 'one-shots', 'fx', 'midi-packs', 'preset-banks', 'songs', 'services', 'plugins'];
    return allowList.includes(normalized) ? normalized : (allowList.includes(String(fallback || '').trim().toLowerCase()) ? String(fallback || '').trim().toLowerCase() : 'all');
  });
const mapMarketplaceFilterToTypes = typeof coverseFeedUtils.mapMarketplaceFilterToTypes === 'function'
  ? coverseFeedUtils.mapMarketplaceFilterToTypes
  : ((filterType = 'all') => {
    const normalizedFilter = normalizeMarketplaceFilterType(filterType, 'all');
    const map = {
      samples: ['sample'],
      instrumentals: ['beat'],
      'sample-packs': ['sample-pack', 'drum-pack', 'fx-pack', 'midi-pack', 'preset-pack', 'one-shot', 'loop', 'vocal'],
      'drum-kits': ['drum-pack'],
      loops: ['loop'],
      vocals: ['vocal'],
      'one-shots': ['one-shot'],
      fx: ['fx-pack'],
      'midi-packs': ['midi-pack'],
      'preset-banks': ['preset-pack'],
      songs: ['music'],
      services: ['service'],
      plugins: ['plugin']
    };
    return Array.isArray(map[normalizedFilter]) ? map[normalizedFilter].slice() : [];
  });
const normalizeMarketplaceTypeValue = typeof coverseFeedUtils.normalizeMarketplaceType === 'function'
  ? coverseFeedUtils.normalizeMarketplaceType
  : ((value = '') => normalizeFeedType(value));
const filterMarketplaceItemsByRules = typeof coverseFeedUtils.filterMarketplaceItems === 'function'
  ? coverseFeedUtils.filterMarketplaceItems
  : ((items = []) => Array.isArray(items) ? items.slice() : []);
const normalizeGenreValue = typeof coverseFeedUtils.normalizeGenreValue === 'function'
  ? coverseFeedUtils.normalizeGenreValue
  : ((value = '') => String(value || '').trim().toLowerCase());
const parseBpmFilter = typeof coverseFeedUtils.parseBpmFilter === 'function'
  ? coverseFeedUtils.parseBpmFilter
  : (() => ({ kind: 'any' }));
const getMarketplacePriceBucket = typeof coverseFeedUtils.getMarketplacePriceBucket === 'function'
  ? coverseFeedUtils.getMarketplacePriceBucket
  : (() => 'paid');
const getMarketplaceMinPaidPrice = typeof coverseFeedUtils.getMarketplaceMinPaidPrice === 'function'
  ? coverseFeedUtils.getMarketplaceMinPaidPrice
  : (() => NaN);
const matchesPriceFilter = typeof coverseFeedUtils.matchesPriceFilter === 'function'
  ? coverseFeedUtils.matchesPriceFilter
  : (() => true);
const parseTagTerms = typeof coverseFeedUtils.parseTagTerms === 'function'
  ? coverseFeedUtils.parseTagTerms
  : ((value = '') => String(value || '').split(/[\s,#]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean));
const matchesTagTerms = typeof coverseFeedUtils.matchesTagTerms === 'function'
  ? coverseFeedUtils.matchesTagTerms
  : (() => true);
const mapMarketplaceItemToFeedItem = typeof coverseFeedUtils.mapMarketplaceItemToFeedItem === 'function'
  ? coverseFeedUtils.mapMarketplaceItemToFeedItem
  : ((item = {}) => ({ ...item, id: String(item.id || item.postId || '').trim() }));
const deriveActionState = typeof coverseFeedUtils.deriveActionState === 'function'
  ? coverseFeedUtils.deriveActionState
  : (() => ({ action: 'buy', label: 'Add to cart', disabled: false, muted: false, canPreview: true }));
const dedupeAndSortFeedItems = typeof coverseFeedUtils.dedupeAndSortFeedItems === 'function'
  ? coverseFeedUtils.dedupeAndSortFeedItems
  : ((items = []) => Array.isArray(items) ? items.slice() : []);
const getFeedTimestampMs = typeof coverseFeedUtils.getFeedTimestampMs === 'function'
  ? coverseFeedUtils.getFeedTimestampMs
  : ((value) => getTimestampMs(value));
const getFeedPriceLabel = typeof coverseFeedUtils.getFeedPriceLabel === 'function'
  ? coverseFeedUtils.getFeedPriceLabel
  : (() => 'Price unavailable');
const normalizeFeedIdentity = typeof coverseFeedUtils.normalizeIdentityKey === 'function'
  ? coverseFeedUtils.normalizeIdentityKey
  : ((value = '') => String(value || '').trim().toLowerCase());

// Media state
let localStream = null;
let screenStream = null;
let isMicMuted = false;
let isCameraOff = true;
let isScreenSharing = false;
let isDeafened = false;
let stageSelection = null;
let activeStageSource = null;
let micMonitorContext = null;
let micMonitorSource = null;
let micMonitorAnalyser = null;
let micMonitorData = null;
let micMonitorRaf = null;
let localSpeakingHoldUntil = 0;
let localSpeakingState = false;
let latestCameraPreviewDataUrl = '';
let cameraPreviewCaptureInterval = null;
let cameraPreviewVideoElement = null;
let cameraPreviewCanvasElement = null;
let latestScreenPreviewDataUrl = '';
let screenPreviewCaptureInterval = null;
let screenPreviewVideoElement = null;
let screenPreviewCanvasElement = null;
let voiceSignalSocket = null;
let voiceSignalConnected = false;
let voiceSignalRoom = '';
let voiceSignalReconnectTimer = null;
let voiceSignalManualClose = false;
let voiceSignalingBackoffMs = 1200;
let voiceSignalingRuntimeConfig = null;
let voiceSignalsUnsubscribe = null;
let voiceFirestoreSignaling = false;
let masterOutputVolume = 1.0;
let remoteAudioContext = null;
let remoteAudioMonitorRaf = null;
let remoteAudioPlaybackNoticeShown = false;
const voicePeerConnections = new Map();
const remoteAudioElements = new Map();
const remoteAudioMonitors = new Map();
const participantPopoutWindows = new Map();

const DEFAULT_VOICE_SIGNAL_URL = 'wss://coversehq.com/ws/signal';
const DEFAULT_VOICE_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const REMOTE_SPEAKING_THRESHOLD = 0.03;
const LOCAL_SPEAKING_THRESHOLD = 0.02;

// Participants
let participants = [
  {
    id: 'local',
    uid: null,
    name: 'You',
    avatar: 'Y',
    isLocal: true,
    isMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isSpeaking: false,
    audioLevel: 0,
    cameraPreview: '',
    screenPreview: ''
  }
];

const REMOTE_CONTROL_REQUEST_TTL_MS = 30 * 1000;
const REMOTE_CONTROL_GRANT_TTL_MS = 2 * 60 * 1000;
const REMOTE_CONTROL_INACTIVITY_TIMEOUT_MS = 25 * 1000;
const REMOTE_CONTROL_HEARTBEAT_MS = 8 * 1000;
const CAMERA_PREVIEW_CAPTURE_INTERVAL_MS = 1800;
const SCREEN_PREVIEW_CAPTURE_INTERVAL_MS = 2000;

let activeVoiceSessionId = null;
let activeVoiceChannelId = null;
let localVoiceRealtimeKey = '';
let voiceParticipantsUnsubscribe = null;
let voicePreviewParticipantsUnsubscribe = null;
let voicePreviewRealtimeKey = '';
let remoteControlRequestsUnsubscribe = null;
let remoteControlGrantsUnsubscribe = null;
let remoteControlHeartbeatInterval = null;
let remoteControlCleanupInterval = null;
let remoteControlPromptedRequestIds = new Set();
let remoteControlState = {
  outgoingRequestId: '',
  outgoingTargetUid: '',
  outgoingStatus: '',
  activeRole: 'none',
  activeGrantId: '',
  activeTargetUid: '',
  activeControllerUid: ''
};

// Sessions data (will be loaded from Firebase for the user)
let sessions = [];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Coverse] Initializing app...');
  
  initSessionBar();
  initChannelBar();
  initVoiceControls();
  initChat();
  initModals();
  initUserPanel();
  initSimpleProfileTab();
  initLibrary();
  initUpdaterUi();
  initDiscoverAndMarketplace();
  initCart();
  
  // Load library from local storage
  loadLibraryFromStorage();
  hydrateLibraryMedia().then(() => {
    renderLibrary();
  }).catch(() => {});
  
  // Default to home view
  showHomeView();
  
  console.log('[Coverse] App initialized');
});

// Listen for user ready event from Firebase auth
window.addEventListener('coverse-user-ready', async (e) => {
  console.log('[Coverse] User ready:', e.detail);
  currentUser = e.detail;
  updateUserPanel();
  await hydrateProfileFromApi({ silent: true });
  await loadUserData();
  await refreshPurchaseSyncPipeline({ reason: 'startup', showLoading: true, force: true });
  
  // Check for outstanding checkout callbacks
  handleCheckoutCallback();
  
  // Set up IPC listeners for Stripe redirects
  setupCheckoutIpcListeners();

  if (pendingCheckoutSessionId) {
    const pendingSessionId = pendingCheckoutSessionId;
    pendingCheckoutSessionId = '';
    await handleCheckoutSuccess(pendingSessionId, 'queued');
  }
});

// Set up IPC listeners for checkout completion from Stripe
function setupCheckoutIpcListeners() {
  if (checkoutIpcListenersBound) return;

  if (typeof window.coverse?.onCheckoutSuccess !== 'function') {
    console.warn('[Checkout] IPC handler not available, relying on URL callback');
    return;
  }

  checkoutIpcListenersBound = true;
  console.log('[Checkout] Setting up IPC listeners');

  window.coverse.onCheckoutSuccess(async (data) => {
    console.log('[Checkout] Received checkout-success IPC event:', data);
    const sessionId = data?.sessionId;
    if (!sessionId) {
      console.warn('[Checkout] No sessionId in IPC event data');
      return;
    }

    await handleCheckoutSuccess(sessionId, 'ipc');
  });

  window.coverse.onCheckoutCancel(() => {
    console.log('[Checkout] Checkout cancelled by user via IPC');
    showNotification('Payment cancelled. Your cart is still available.');
  });
}

async function handleCheckoutSuccess(sessionId, source = 'unknown') {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) return;

  if (normalizedSessionId === lastProcessedCheckoutSessionId) {
    console.log('[Checkout] Ignoring duplicate success callback:', { source, sessionId: normalizedSessionId });
    return;
  }

  if (processingCheckoutSessionId === normalizedSessionId) {
    console.log('[Checkout] Checkout confirmation already in progress for session:', normalizedSessionId);
    return;
  }

  if (!currentUser?.uid) {
    pendingCheckoutSessionId = normalizedSessionId;
    console.warn('[Checkout] User not ready yet, queued checkout confirmation:', normalizedSessionId);
    return;
  }

  processingCheckoutSessionId = normalizedSessionId;
  try {
    const previousFingerprint = getPurchaseFingerprint(purchaseSyncEntries);
    const result = await confirmMarketplacePayment(normalizedSessionId);
    console.log('[Checkout] Payment confirmed successfully:', { source, sessionId: normalizedSessionId, result });

    const refreshResult = await refreshPurchaseSyncWithBackoff({
      reason: 'checkout',
      delays: [1000, 2000, 4000],
      force: true,
      previousFingerprint
    });

    if (!refreshResult.ok) {
      const errorCode = String(refreshResult.error || '').trim();
      if (errorCode === 'AUTH_ERROR') {
        showNotification('Payment succeeded, but purchases could not refresh (auth expired). Please sign in again and tap Refresh Purchases.');
      } else if (errorCode === 'TRANSIENT_SERVER_ERROR') {
        showNotification('Payment succeeded. Purchase sync is delayed by the server—tap Refresh Purchases in a few seconds.');
      } else {
        showNotification('Payment succeeded, but purchase sync failed. Tap Refresh Purchases to retry.');
      }
      return;
    }

    clearCart();
    closeModal('cartModal');
    showNotification('Payment successful! Your purchase has been completed.');

    await hydrateProfileFromApi({ silent: true });
    await loadUserData();
    await hydrateLibraryMedia();
    renderLibrary();
    renderProfileDashboard();
    refreshHomeFeedView({ force: true }).catch(() => {});

    lastProcessedCheckoutSessionId = normalizedSessionId;
  } catch (error) {
    console.error('[Checkout] Payment confirmation failed:', error);
    showNotification('Payment confirmation failed: ' + (error.message || 'Unknown error'));
  } finally {
    processingCheckoutSessionId = '';
  }
}

// Handle deep-link callback from URL params (fallback for web)
function handleCheckoutCallback() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  
  if (sessionId) {
    console.log('[Checkout] Handling URL callback with sessionId:', sessionId);
    handleCheckoutSuccess(sessionId, 'url');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ============================================
// USER PANEL & PROFILE
// ============================================
function initUserPanel() {
  // Settings button opens user menu
  document.getElementById('btnPanelSettings')?.addEventListener('click', openSettingsMenu);
  
  // Clicking on user info could open profile
  document.querySelector('.user-panel-info')?.addEventListener('click', openUserProfile);
}

function setSimpleProfileStatus(message, level = 'info') {
  const status = document.getElementById('simpleProfileStatus');
  if (!status) return;
  status.textContent = message || '';
  status.dataset.level = level;
}

function getTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isLibraryStylePost(post = {}) {
  if (post.isLibrary === true) return true;
  if (String(post.source || '').toLowerCase() === 'library') return true;
  if (String(post.postType || '').toLowerCase() === 'library') return true;
  return false;
}

function extractProfilePostsArray(payload) {
  if (Array.isArray(payload?.posts)) return payload.posts;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.posts)) return payload.data.posts;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

async function getProfilePostsAuthContext() {
  try {
    if (window.firebaseAuth?.currentUser?.getIdToken) {
      const firebaseToken = await window.firebaseAuth.currentUser.getIdToken();
      if (firebaseToken) {
        localStorage.setItem('coverseIdToken', firebaseToken);
        return { token: firebaseToken, type: 'firebase' };
      }
    }
  } catch (_error) {
    // fallback below
  }

  try {
    const electronToken = window.coverseBridge?.getToken?.();
    if (electronToken) {
      return { token: String(electronToken), type: 'electron' };
    }
  } catch (_error) {
    // fallback below
  }

  const cached = localStorage.getItem('coverseIdToken') || '';
  if (cached) {
    return { token: cached, type: 'firebase' };
  }

  return { token: '', type: 'unknown' };
}

function sleepMs(durationMs = 0) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(durationMs) || 0)));
}

function normalizePurchaseTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.toMillis === 'function') return new Date(value.toMillis());
  if (typeof value === 'object' && Number.isFinite(Number(value.seconds))) {
    const millis = Number(value.seconds) * 1000 + Number(value.nanoseconds || 0) / 1e6;
    return new Date(millis);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function isPlaceholderPurchaseTitle(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return ['purchased item', 'purchase item', 'item', 'untitled'].includes(normalized);
}

function firstNonEmptyString(values = []) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function firstMeaningfulPurchaseTitle(values = []) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    if (isPlaceholderPurchaseTitle(text)) continue;
    return text;
  }
  return '';
}

function preferredPurchaseAmount(...values) {
  let fallback = 0;
  for (const value of values) {
    if (value === '' || value == null) continue;
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    if (num > 0) return num;
    fallback = num;
  }
  return fallback;
}

function choosePurchaseString(currentValue, incomingValue, { titleMode = false } = {}) {
  const current = String(currentValue || '').trim();
  const incoming = String(incomingValue || '').trim();

  if (titleMode) {
    const currentMeaningful = current && !isPlaceholderPurchaseTitle(current);
    const incomingMeaningful = incoming && !isPlaceholderPurchaseTitle(incoming);
    if (currentMeaningful) return current;
    if (incomingMeaningful) return incoming;
    if (current) return current;
    return incoming;
  }

  if (current) return current;
  return incoming;
}

function mergePurchaseEntry(existingEntry = {}, incomingEntry = {}) {
  const merged = {
    ...existingEntry,
    ...incomingEntry
  };

  merged.id = choosePurchaseString(existingEntry.id, incomingEntry.id);
  merged.postId = choosePurchaseString(existingEntry.postId, incomingEntry.postId);
  merged.userId = choosePurchaseString(existingEntry.userId, incomingEntry.userId);
  merged.buyerUid = choosePurchaseString(existingEntry.buyerUid, incomingEntry.buyerUid);
  merged.uid = choosePurchaseString(existingEntry.uid, incomingEntry.uid);
  merged.sellerId = choosePurchaseString(existingEntry.sellerId, incomingEntry.sellerId);
  merged.sellerName = choosePurchaseString(existingEntry.sellerName, incomingEntry.sellerName);

  const mergedTitle = choosePurchaseString(
    firstMeaningfulPurchaseTitle([existingEntry.itemTitle, existingEntry.title, existingEntry.postTitle]),
    firstMeaningfulPurchaseTitle([incomingEntry.itemTitle, incomingEntry.title, incomingEntry.postTitle]),
    { titleMode: true }
  ) || choosePurchaseString(existingEntry.itemTitle, incomingEntry.itemTitle, { titleMode: true });

  merged.itemTitle = mergedTitle || merged.itemTitle || '';
  merged.title = choosePurchaseString(existingEntry.title, incomingEntry.title, { titleMode: true }) || merged.itemTitle;
  merged.postTitle = choosePurchaseString(existingEntry.postTitle, incomingEntry.postTitle, { titleMode: true }) || merged.itemTitle;

  merged.fileUrl = choosePurchaseString(existingEntry.fileUrl, incomingEntry.fileUrl);
  merged.files = Array.isArray(existingEntry.files) && existingEntry.files.length
    ? existingEntry.files
    : (Array.isArray(incomingEntry.files) ? incomingEntry.files : []);

  merged.pricePaid = preferredPurchaseAmount(existingEntry.pricePaid, incomingEntry.pricePaid, incomingEntry.price, incomingEntry.amount);
  merged.price = preferredPurchaseAmount(existingEntry.price, incomingEntry.price, existingEntry.pricePaid, incomingEntry.pricePaid, incomingEntry.amount);
  merged.amount = preferredPurchaseAmount(existingEntry.amount, incomingEntry.amount, incomingEntry.pricePaid, incomingEntry.price);

  merged.purchasedAt = getTimestampMs(existingEntry.purchasedAt)
    ? existingEntry.purchasedAt
    : incomingEntry.purchasedAt;

  return merged;
}

function getPurchaseEntryMergeKey(entry = {}) {
  if (!entry || typeof entry !== 'object') return '';

  const postId = String(entry.postId || '').trim().toLowerCase();
  if (postId) return `post:${postId}`;

  const fileUrl = normalizeProfileMediaUrl(
    entry.fileUrl ||
    entry.downloadURL ||
    entry.url ||
    (Array.isArray(entry.files) && entry.files[0] && typeof entry.files[0] === 'object' ? entry.files[0].url : '') ||
    (Array.isArray(entry.files) && typeof entry.files[0] === 'string' ? entry.files[0] : '')
  );
  if (fileUrl) return `file:${fileUrl.toLowerCase()}`;

  const title = firstMeaningfulPurchaseTitle([entry.itemTitle, entry.title, entry.postTitle]).toLowerCase();
  const sellerId = String(entry.sellerId || '').trim().toLowerCase();
  const amount = preferredPurchaseAmount(entry.pricePaid, entry.price, entry.amount);
  if (title && sellerId) return `title:${sellerId}|${title}|${amount}`;
  if (title) return `title:${title}|${amount}`;

  const id = String(entry.id || '').trim().toLowerCase();
  if (id) return `id:${id}`;

  return '';
}

function normalizePurchaseEntry(rawEntry = {}) {
  if (!rawEntry || typeof rawEntry !== 'object') return null;

  const purchase = rawEntry.purchase && typeof rawEntry.purchase === 'object' ? rawEntry.purchase : {};
  const metadata = rawEntry.metadata && typeof rawEntry.metadata === 'object' ? rawEntry.metadata : {};
  const item = rawEntry.item && typeof rawEntry.item === 'object' ? rawEntry.item : {};
  const post = rawEntry.post && typeof rawEntry.post === 'object' ? rawEntry.post : {};
  const product = rawEntry.product && typeof rawEntry.product === 'object' ? rawEntry.product : {};
  const file = rawEntry.file && typeof rawEntry.file === 'object' ? rawEntry.file : {};
  const details = rawEntry.details && typeof rawEntry.details === 'object' ? rawEntry.details : {};

  const files = Array.isArray(rawEntry.files)
    ? rawEntry.files
    : (Array.isArray(item.files)
        ? item.files
        : (Array.isArray(post.files)
            ? post.files
            : (Array.isArray(product.files) ? product.files : [])));

  const primaryFileUrl = String(
    rawEntry.fileUrl ||
    rawEntry.downloadURL ||
    rawEntry.url ||
    rawEntry.sourceUrl ||
    rawEntry.mediaUrl ||
    purchase.fileUrl ||
    purchase.downloadURL ||
    purchase.url ||
    metadata.fileUrl ||
    metadata.downloadURL ||
    item.fileUrl ||
    item.downloadURL ||
    post.fileUrl ||
    post.downloadURL ||
    product.fileUrl ||
    product.downloadURL ||
    details.fileUrl ||
    details.downloadURL ||
    file.fileUrl ||
    file.downloadURL ||
    file.url ||
    files.find((file) => typeof file === 'string') ||
    files.find((file) => file && typeof file === 'object' && file.url)?.url ||
    ''
  ).trim();

  const normalizedFiles = files
    .map((file, index) => {
      if (!file) return null;
      if (typeof file === 'string') {
        const url = String(file).trim();
        if (!url) return null;
        return { id: `file_${index}`, url, name: `File ${index + 1}` };
      }
      if (typeof file === 'object') {
        const url = String(file.url || file.fileUrl || file.downloadURL || '').trim();
        if (!url) return null;
        return {
          id: String(file.id || file.fileId || `file_${index}`),
          url,
          name: String(file.name || file.title || file.fileName || `File ${index + 1}`),
          type: String(file.type || file.mimeType || '')
        };
      }
      return null;
    })
    .filter(Boolean);

  const purchasedAt = normalizePurchaseTimestamp(
    rawEntry.purchasedAt ||
    rawEntry.purchaseDate ||
    rawEntry.createdAt ||
    rawEntry.paidAt ||
    rawEntry.updatedAt ||
    purchase.purchasedAt ||
    purchase.createdAt ||
    metadata.purchasedAt ||
    metadata.createdAt ||
    item.purchasedAt ||
    post.purchasedAt ||
    product.purchasedAt
  );

  const resolvedTitle = firstMeaningfulPurchaseTitle([
    rawEntry.itemTitle,
    rawEntry.postTitle,
    rawEntry.title,
    rawEntry.name,
    rawEntry.fileName,
    rawEntry.sampleName,
    rawEntry.productName,
    rawEntry.trackName,
    rawEntry.assetName,
    rawEntry.label,
    purchase.itemTitle,
    purchase.postTitle,
    purchase.title,
    purchase.name,
    metadata.itemTitle,
    metadata.postTitle,
    metadata.title,
    metadata.name,
    item.itemTitle,
    item.postTitle,
    item.title,
    item.name,
    post.itemTitle,
    post.postTitle,
    post.title,
    post.name,
    product.itemTitle,
    product.postTitle,
    product.title,
    product.name,
    details.itemTitle,
    details.postTitle,
    details.title,
    details.name,
    file.fileName,
    file.name,
    normalizedFiles[0]?.name
  ]);

  const postId = firstNonEmptyString([
    rawEntry.postId,
    rawEntry.itemId,
    purchase.postId,
    purchase.itemId,
    metadata.postId,
    metadata.itemId,
    item.postId,
    item.itemId,
    item.id,
    post.postId,
    post.itemId,
    post.id,
    product.postId,
    product.itemId,
    product.id,
    details.postId,
    details.itemId,
    details.id
  ]);

  const fallbackTitle = resolvedTitle || (postId ? `Item ${postId.slice(0, 10)}` : 'Purchased item');

  const normalized = {
    id: String(
      rawEntry.purchaseId ||
      purchase.purchaseId ||
      rawEntry.id ||
      purchase.id ||
      rawEntry.orderId ||
      rawEntry.itemId ||
      postId ||
      item.id ||
      post.id ||
      `purchase_${Date.now().toString(36)}`
    ).trim(),
    userId: firstNonEmptyString([rawEntry.userId, rawEntry.buyerUid, rawEntry.uid, purchase.userId, purchase.buyerUid, metadata.userId, metadata.uid]),
    buyerUid: firstNonEmptyString([rawEntry.buyerUid, rawEntry.userId, rawEntry.uid, purchase.buyerUid, purchase.userId, metadata.buyerUid]),
    uid: firstNonEmptyString([rawEntry.uid, rawEntry.userId, rawEntry.buyerUid, purchase.uid, metadata.uid]),
    postId,
    title: fallbackTitle,
    itemTitle: fallbackTitle,
    postTitle: firstMeaningfulPurchaseTitle([rawEntry.postTitle, purchase.postTitle, metadata.postTitle, item.postTitle, post.title, details.postTitle]) || fallbackTitle,
    pricePaid: preferredPurchaseAmount(rawEntry.pricePaid, rawEntry.price, rawEntry.amount, purchase.pricePaid, purchase.price, item.pricePaid, item.price, metadata.pricePaid, metadata.price, details.pricePaid),
    price: preferredPurchaseAmount(rawEntry.price, rawEntry.pricePaid, rawEntry.amount, purchase.price, purchase.pricePaid, item.price, metadata.price, details.price),
    amount: preferredPurchaseAmount(rawEntry.amount, rawEntry.pricePaid, rawEntry.price, purchase.amount, item.amount, metadata.amount, details.amount),
    fileUrl: primaryFileUrl,
    files: normalizedFiles,
    purchasedAt,
    sellerId: firstNonEmptyString([rawEntry.sellerId, purchase.sellerId, metadata.sellerId, item.sellerId, post.sellerId, product.sellerId]),
    sellerName: firstNonEmptyString([rawEntry.sellerName, purchase.sellerName, metadata.sellerName, item.sellerName, post.sellerName, product.sellerName]),
    imageUrl: firstNonEmptyString([
      rawEntry.imageUrl,
      rawEntry.image,
      rawEntry.coverImageUrl,
      rawEntry.thumbnailURL,
      rawEntry.thumbnailUrl,
      rawEntry.previewUrl,
      purchase.imageUrl,
      purchase.coverImageUrl,
      metadata.imageUrl,
      metadata.coverImageUrl,
      item.imageUrl,
      item.coverImageUrl,
      post.imageUrl,
      post.coverImageUrl,
      product.imageUrl,
      product.coverImageUrl
    ]),
    coverImageUrl: firstNonEmptyString([
      rawEntry.coverImageUrl,
      rawEntry.imageUrl,
      purchase.coverImageUrl,
      metadata.coverImageUrl,
      item.coverImageUrl,
      post.coverImageUrl,
      product.coverImageUrl
    ]),
    previewUrl: firstNonEmptyString([
      rawEntry.previewUrl,
      rawEntry.thumbnailURL,
      rawEntry.thumbnailUrl,
      rawEntry.imageUrl,
      purchase.previewUrl,
      metadata.previewUrl,
      item.previewUrl,
      post.previewUrl,
      product.previewUrl
    ]),
    mimeType: firstNonEmptyString([
      rawEntry.mimeType,
      rawEntry.contentType,
      purchase.mimeType,
      metadata.mimeType,
      item.mimeType,
      post.mimeType,
      product.mimeType,
      normalizedFiles[0]?.type
    ]),
    size: Number(rawEntry.size || rawEntry.fileSize || item.size || post.size || product.size || normalizedFiles[0]?.size || 0),
    description: firstNonEmptyString([rawEntry.description, purchase.description, metadata.description, item.description, post.description, product.description]),
    genre: firstNonEmptyString([rawEntry.genre, purchase.genre, metadata.genre, item.genre, post.genre, product.genre]),
    bpm: Number(rawEntry.bpm || purchase.bpm || metadata.bpm || item.bpm || post.bpm || product.bpm || 0),
    key: firstNonEmptyString([rawEntry.key, purchase.key, metadata.key, item.key, post.key, product.key]),
    type: firstNonEmptyString([rawEntry.type, rawEntry.sampleType, item.type, item.sampleType, post.type, post.sampleType, product.type, product.sampleType])
  };

  const dedupeKey = String(normalized.postId || normalized.id || normalized.fileUrl || normalized.itemTitle).trim();
  if (!dedupeKey) return null;
  return normalized;
}

function collectPurchaseOwnerIds(entry = {}) {
  if (!entry || typeof entry !== 'object') return new Set();

  const ownerIds = new Set();
  const pushId = (value) => {
    const normalized = String(value || '').trim();
    if (normalized) ownerIds.add(normalized);
  };

  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    pushId(value.userId);
    pushId(value.uid);
    pushId(value.buyerUid);
    pushId(value.buyerId);
    pushId(value.ownerUid);
    pushId(value.customerUid);

    if (value.user && typeof value.user === 'object') visit(value.user);
    if (value.buyer && typeof value.buyer === 'object') visit(value.buyer);
    if (value.metadata && typeof value.metadata === 'object') visit(value.metadata);
    if (value.item && typeof value.item === 'object') visit(value.item);
    if (value.post && typeof value.post === 'object') visit(value.post);
    if (value.product && typeof value.product === 'object') visit(value.product);
    if (value.purchase && typeof value.purchase === 'object') visit(value.purchase);
  };

  visit(entry);
  return ownerIds;
}

function looksLikePurchaseEntry(entry = {}) {
  if (!entry || typeof entry !== 'object') return false;

  if (entry.purchaseId || entry.orderId || entry.transactionId || entry.paymentIntentId) return true;
  if (entry.itemId || entry.postId) return true;
  if (entry.pricePaid != null || entry.amount != null) return true;
  if (entry.metadata?.license || entry.license || entry.item?.metadata?.license) return true;
  if ((entry.itemTitle || entry.postTitle) && (entry.purchasedAt || entry.createdAt || entry.paidAt)) return true;

  return false;
}

function extractPurchaseArraysByPrecedence(payload = {}, sourcePath = '') {
  const purchaseFirst = [
    payload?.purchaseDetails,
    payload?.data?.purchaseDetails,
    payload?.profile?.purchaseDetails,
    payload?.result?.purchaseDetails,
    payload?.purchasesData?.items,
    payload?.data?.purchasesData?.items,
    payload?.profile?.purchasesData?.items,
    payload?.purchaseItems,
    payload?.data?.purchaseItems,
    payload?.profile?.purchaseItems,
    payload?.result?.purchaseItems,
    payload?.purchases?.items,
    payload?.data?.purchases?.items,
    payload?.profile?.purchases?.items,
    payload?.result?.purchases?.items
  ];

  const endpointSpecific = [];
  if (sourcePath === '/api/getUserPurchases') {
    endpointSpecific.push(payload?.items, payload?.data?.items, payload?.result?.items);
  } else if (sourcePath === '/api/getLibrary') {
    endpointSpecific.push(
      payload?.facets?.purchases,
      payload?.data?.facets?.purchases,
      payload?.result?.facets?.purchases,
      payload?.libraryBundle?.facets?.purchases,
      payload?.data?.libraryBundle?.facets?.purchases
    );
  } else if (sourcePath === '/api/profile/aggregate') {
    endpointSpecific.push(
      payload?.aggregate?.purchaseDetails,
      payload?.aggregate?.purchaseItems,
      payload?.aggregate?.purchases?.items,
      payload?.aggregate?.purchasesData?.items,
      payload?.profile?.purchasesData?.items
    );
  }

  return [...purchaseFirst, ...endpointSpecific].filter((value) => Array.isArray(value) && value.length > 0);
}

function mergePurchaseEntries(payloads = [], expectedUid = '') {
  const merged = new Map();
  const targetUid = String(expectedUid || '').trim();

  payloads.forEach((payloadEntry) => {
    const sourcePath = String(payloadEntry?.path || '').trim();
    const payload = payloadEntry?.payload && typeof payloadEntry.payload === 'object'
      ? payloadEntry.payload
      : payloadEntry;

    const arrays = extractPurchaseArraysByPrecedence(payload, sourcePath);
    arrays.forEach((entries) => {
      entries.forEach((rawEntry) => {
        if (!looksLikePurchaseEntry(rawEntry)) return;

        if (targetUid) {
          const ownerIds = collectPurchaseOwnerIds(rawEntry);
          if (ownerIds.size > 0 && !ownerIds.has(targetUid)) return;
          if (ownerIds.size === 0 && sourcePath === '/api/getLibrary') return;
        }

        const normalized = normalizePurchaseEntry(rawEntry);
        if (!normalized) return;

        if (targetUid) {
          const normalizedOwners = collectPurchaseOwnerIds(normalized);
          if (normalizedOwners.size > 0 && !normalizedOwners.has(targetUid)) return;
        }

        const key = getPurchaseEntryMergeKey(normalized);
        if (!key) return;
        if (!merged.has(key)) {
          merged.set(key, normalized);
          return;
        }
        const existing = merged.get(key) || {};
        merged.set(key, mergePurchaseEntry(existing, normalized));
      });
    });
  });

  return Array.from(merged.values()).sort((a, b) => getTimestampMs(b.purchasedAt) - getTimestampMs(a.purchasedAt));
}

function getPurchaseDisplayLabel(entry = {}) {
  const title = firstMeaningfulPurchaseTitle([
    entry.itemTitle,
    entry.title,
    entry.postTitle,
    entry.files?.[0]?.name,
    entry.postId ? `Item ${String(entry.postId).slice(0, 10)}` : '',
    entry.id ? `Purchase ${String(entry.id).slice(0, 10)}` : ''
  ]) || 'Purchased item';
  const amount = Number(entry.pricePaid || entry.price || entry.amount || 0);
  if (amount > 0) {
    return `${title} · $${amount.toFixed(2)}`;
  }
  return title;
}

function mapPurchaseEntryToProfilePost(entry = {}, index = 0) {
  if (!entry || typeof entry !== 'object') return null;

  const purchaseId = String(entry.postId || entry.id || `purchase_${index}`).trim();
  if (!purchaseId) return null;

  const files = Array.isArray(entry.files) ? entry.files : [];
  const firstFile = files.find((file) => file && typeof file === 'object' && String(file.url || file.fileUrl || file.downloadURL || '').trim()) || null;
  const firstFileUrl = firstFile
    ? String(firstFile.url || firstFile.fileUrl || firstFile.downloadURL || '').trim()
    : String(files.find((value) => typeof value === 'string' && String(value).trim()) || '').trim();

  const mediaUrl = firstNonEmptyString([
    entry.fileUrl,
    firstFileUrl,
    entry.downloadURL,
    entry.url,
    entry.mediaUrl,
    entry.sourceUrl
  ]);

  const title = firstMeaningfulPurchaseTitle([
    entry.itemTitle,
    entry.title,
    entry.postTitle,
    firstFile?.name,
    entry.postId ? `Item ${String(entry.postId).slice(0, 10)}` : '',
    entry.id ? `Purchase ${String(entry.id).slice(0, 10)}` : ''
  ]) || 'Purchased item';

  const imageUrl = firstNonEmptyString([
    entry.imageUrl,
    entry.coverImageUrl,
    entry.previewUrl,
    entry.thumbnailURL,
    entry.thumbnailUrl
  ]);

  const mimeType = firstNonEmptyString([
    entry.mimeType,
    firstFile?.type,
    inferMimeTypeFromName(firstFile?.name || title),
    inferMimeTypeFromName(mediaUrl || title)
  ]);

  const normalizedType = normalizeLibraryType(
    firstNonEmptyString([entry.type, entry.sampleType, entry.mediaKind]),
    mimeType,
    firstFile?.name || title
  );

  const price = preferredPurchaseAmount(entry.pricePaid, entry.price, entry.amount);
  const purchasedAt = entry.purchasedAt || new Date();

  const normalized = normalizeProfilePostItem({
    id: `purchase_post_${purchaseId}`,
    postId: entry.postId || purchaseId,
    purchaseId: entry.id || purchaseId,
    title,
    name: title,
    description: entry.description || '',
    mimeType,
    size: Number(entry.size || firstFile?.size || 0),
    type: normalizedType,
    sampleType: firstNonEmptyString([entry.sampleType, normalizedType]),
    mediaKind: normalizedType,
    createdAt: purchasedAt,
    timestamp: purchasedAt,
    uploadedAt: purchasedAt,
    fileName: firstFile?.name || title,
    downloadURL: mediaUrl,
    audioUrl: mediaUrl,
    sourceAudioUrl: mediaUrl,
    mediaUrl,
    fileUrl: mediaUrl,
    storagePath: String(entry.storagePath || '').trim(),
    coverImageUrl: imageUrl,
    thumbnailURL: imageUrl,
    thumbnailUrl: imageUrl,
    previewUrl: imageUrl,
    imageUrl,
    genre: entry.genre || '',
    bpm: Number(entry.bpm || 0),
    key: entry.key || '',
    isFree: price <= 0,
    streamOnly: false,
    price,
    files,
    postType: 'purchase',
    isPurchased: true,
    purchased: true,
    sellerId: entry.sellerId || '',
    sellerName: entry.sellerName || ''
  });

  return {
    ...normalized,
    postId: firstNonEmptyString([entry.postId, purchaseId]),
    purchaseId: firstNonEmptyString([entry.id, purchaseId]),
    source: 'purchase',
    siteId: firstNonEmptyString([entry.postId]),
    sourceId: firstNonEmptyString([entry.postId])
  };
}

function normalizeIdentityValue(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildPurchaseIdentityTokens(item = {}, fallbackIndex = 0) {
  if (!item || typeof item !== 'object') return [];

  const tokens = [];
  const pushToken = (prefix, rawValue) => {
    const normalized = normalizeIdentityValue(rawValue);
    if (!normalized) return;
    tokens.push(`${prefix}:${normalized}`);
  };

  const canonicalId = String(item.id || '')
    .trim()
    .replace(/^purchase_post_/i, '')
    .replace(/^site_/i, '');
  const purchaseId = firstNonEmptyString([item.purchaseId, canonicalId]);
  const postId = firstNonEmptyString([item.postId, item.siteId, item.sourceId]);
  const sourceId = firstNonEmptyString([item.sourceId, item.siteId]);
  const storagePath = String(item.storagePath || item.path || '').trim();
  const mediaUrl = normalizeProfileMediaUrl(item.downloadURL || item.audioUrl || item.mediaUrl || item.fileUrl || item.url || '');
  const title = firstMeaningfulPurchaseTitle([item.itemTitle, item.title, item.name, item.postTitle]);
  const amount = preferredPurchaseAmount(item.pricePaid, item.price, item.amount);

  pushToken('purchase', purchaseId);
  pushToken('post', postId);

  if (mediaUrl) {
    const lowerUrl = mediaUrl.toLowerCase();
    pushToken('media', lowerUrl);
    const tail = lowerUrl.split('/').pop()?.split('?')[0] || '';
    pushToken('media-tail', tail);
    try {
      const parsed = new URL(mediaUrl);
      parsed.search = '';
      parsed.hash = '';
      pushToken('media-clean', parsed.toString().toLowerCase());
    } catch (_error) {
      // Keep best-effort token matching for relative/non-URL media paths.
    }
  }

  pushToken('source', sourceId);
  pushToken('storage', storagePath);

  const normalizedTitle = normalizeIdentityValue(title);
  if (normalizedTitle) {
    pushToken('title-price', `${normalizedTitle}|${Number(amount || 0)}`);
    pushToken('title-size', `${normalizedTitle}|${Number(item.size || 0)}`);
  }

  pushToken('id', canonicalId);

  return Array.from(new Set(tokens));
}

function getPurchasePostDedupeKey(item = {}, fallbackIndex = 0) {
  const tokens = buildPurchaseIdentityTokens(item, fallbackIndex);
  if (!tokens.length) return `idx:${fallbackIndex}`;
  return tokens[0];
}

function getPurchasePostQualityScore(item = {}) {
  if (!item || typeof item !== 'object') return 0;

  let score = 0;
  if (normalizeProfileMediaUrl(item.downloadURL || item.audioUrl || item.mediaUrl || item.fileUrl || item.url || '')) score += 8;
  if (normalizeProfileMediaUrl(item.videoUrl || item.previewVideoUrl || item.mediaVideoUrl || '')) score += 6;
  if (firstNonEmptyString([item.thumbnailURL, item.thumbnailUrl, item.previewUrl, item.imageUrl, item.coverImageUrl])) score += 4;
  if (firstMeaningfulPurchaseTitle([item.title, item.name])) score += 2;
  if (Number(item.size || 0) > 0) score += 1;
  if (String(item.genre || '').trim()) score += 1;
  if (Number(item.bpm || 0) > 0) score += 1;
  if (String(item.key || '').trim()) score += 1;
  if (String(item.postId || '').trim()) score += 2;
  return score;
}

function getSimpleProfilePurchasePosts() {
  const merged = new Map();
  const tokenToKey = new Map();
  let syntheticKeyCounter = 0;

  const registerTokens = (key, tokens = []) => {
    if (!key) return;
    tokens.forEach((token) => {
      if (!token) return;
      tokenToKey.set(token, key);
    });
  };

  const addItem = (item, fallbackIndex = 0) => {
    if (!item || typeof item !== 'object') return;
    const normalized = normalizeProfilePostItem(item);
    const enriched = {
      ...normalized,
      id: normalized.id || String(item.id || '').trim(),
      postId: firstNonEmptyString([item.postId, normalized.postId, item.siteId, item.sourceId]),
      purchaseId: firstNonEmptyString([item.purchaseId, item.id]),
      source: firstNonEmptyString([item.source, normalized.source, 'purchase']),
      postType: 'purchase',
      isPurchased: true,
      purchased: true
    };

    const identityTokens = buildPurchaseIdentityTokens({ ...item, ...enriched }, fallbackIndex);
    let key = identityTokens.map((token) => tokenToKey.get(token)).find(Boolean);
    if (!key) {
      key = `purchase_${syntheticKeyCounter++}`;
    }

    if (!merged.has(key)) {
      merged.set(key, enriched);
      registerTokens(key, identityTokens);
      registerTokens(key, buildPurchaseIdentityTokens(enriched, fallbackIndex));
      return;
    }

    const existing = merged.get(key) || {};
    const existingScore = getPurchasePostQualityScore(existing);
    const incomingScore = getPurchasePostQualityScore(enriched);
    let nextValue = existing;

    if (incomingScore > existingScore) {
      nextValue = { ...existing, ...enriched, postType: 'purchase', isPurchased: true, purchased: true };
    } else if (incomingScore === existingScore) {
      const existingTime = getTimestampMs(existing.uploadedAt || existing.createdAt || existing.purchasedAt);
      const incomingTime = getTimestampMs(enriched.uploadedAt || enriched.createdAt || enriched.purchasedAt);
      if (incomingTime > existingTime) {
        nextValue = { ...existing, ...enriched, postType: 'purchase', isPurchased: true, purchased: true };
      }
    }

    merged.set(key, nextValue);
    registerTokens(key, identityTokens);
    registerTokens(key, buildPurchaseIdentityTokens(nextValue, fallbackIndex));
  };

  (purchaseSyncEntries || []).forEach((entry, index) => {
    const postItem = mapPurchaseEntryToProfilePost(entry, index);
    if (postItem) addItem(postItem, index);
  });

  const libraryCandidates = [
    ...(Array.isArray(simpleProfileLibraryCache) ? simpleProfileLibraryCache : []),
    ...(Array.isArray(userLibrary) ? userLibrary : [])
  ];

  libraryCandidates
    .filter((item) => item && !item.isDeleted && (item.isPurchased || item.purchased || item.purchaseId || String(item.source || '').toLowerCase() === 'purchase'))
    .forEach((item, index) => addItem(item, index));

  return Array.from(merged.values())
    .sort((a, b) => getTimestampMs(b.uploadedAt || b.createdAt) - getTimestampMs(a.uploadedAt || a.createdAt));
}

function mergePurchasesIntoLibrary(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return;

  const byId = new Map((Array.isArray(userLibrary) ? userLibrary : []).map((item) => [item.id, item]));
  entries.forEach((entry, index) => {
    const purchaseId = String(entry.id || entry.postId || `purchase_${index}`).trim();
    if (!purchaseId) return;

    const fileUrl = String(entry.fileUrl || '').trim();
    const typeHint = inferMimeTypeFromName(entry.itemTitle || entry.title || '');
    const normalized = normalizeSiteLibraryItem(purchaseId, {
      id: purchaseId,
      title: entry.itemTitle || entry.title || 'Purchased item',
      name: entry.itemTitle || entry.title || 'Purchased item',
      fileUrl,
      downloadURL: fileUrl,
      url: fileUrl,
      files: entry.files || [],
      uploadedAt: entry.purchasedAt || new Date(),
      createdAt: entry.purchasedAt || new Date(),
      type: typeHint,
      source: 'purchase',
      postId: entry.postId,
      purchaseId: entry.id,
      sellerId: entry.sellerId,
      sellerName: entry.sellerName,
      pricePaid: entry.pricePaid,
      price: entry.price,
      amount: entry.amount,
      isPurchased: true,
      purchased: true
    });

    byId.set(normalized.id, {
      ...byId.get(normalized.id),
      ...normalized,
      section: 'site',
      source: 'purchase',
      postId: entry.postId,
      isPurchased: true,
      purchased: true,
      purchasedAt: entry.purchasedAt,
      purchaseId: entry.id
    });
  });

  userLibrary = dedupeLibraryItems(Array.from(byId.values()));
  persistSiteLibraryCacheFromState();
}

function getPurchaseFingerprint(entries = []) {
  return JSON.stringify((entries || []).map((entry) => `${entry.id}|${entry.postId}|${getTimestampMs(entry.purchasedAt)}`));
}

async function fetchPurchaseEndpoint(path, uid = '') {
  const apiBase = getSiteApiBase();
  const headers = await getSiteApiAuthHeaders();
  const params = new URLSearchParams();
  if (uid) {
    params.set('uid', uid);
    params.set('userId', uid);
    params.set('targetUid', uid);
  }
  const url = `${apiBase}${path}${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (response.status === 401 || response.status === 403) {
    throw new Error('AUTH_ERROR');
  }
  if (response.status === 400) {
    throw new Error('INVALID_REQUEST');
  }
  if (response.status >= 500) {
    throw new Error('TRANSIENT_SERVER_ERROR');
  }
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  return {
    path,
    payload
  };
}

async function refreshPurchaseSyncPipeline({ reason = 'manual', showLoading = false, force = false } = {}) {
  if (!currentUser?.uid) {
    return { ok: false, entries: [], reason: 'no-user' };
  }

  if (showLoading) {
    purchasesSyncLoading = true;
    renderSimpleProfileSections();
  }

  lastPurchasesSyncError = '';

  try {
    const payloads = [];
    const uid = currentUser.uid;

    payloads.push(await fetchPurchaseEndpoint('/api/profile/aggregate', uid));
    payloads.push(await fetchPurchaseEndpoint('/api/getUserPurchases', uid));
    payloads.push(await fetchPurchaseEndpoint('/api/getLibrary', uid));

    const mergedEntries = mergePurchaseEntries(payloads, uid);
    purchaseSyncEntries = mergedEntries;
    simpleProfilePurchasesCache = mergedEntries.map((entry) => getPurchaseDisplayLabel(entry));
    mergePurchasesIntoLibrary(mergedEntries);

    if (force) {
      renderLibrary();
      renderProfileDashboard();
    }

    return { ok: true, entries: mergedEntries, reason };
  } catch (error) {
    lastPurchasesSyncError = String(error?.message || 'PURCHASE_REFRESH_FAILED');
    return { ok: false, entries: purchaseSyncEntries, reason, error: lastPurchasesSyncError };
  } finally {
    purchasesSyncLoading = false;
    renderSimpleProfileSections();
  }
}

async function refreshPurchaseSyncWithBackoff({ reason = 'checkout', delays = [1000, 2000, 4000], force = false, previousFingerprint = '' } = {}) {
  let result = await refreshPurchaseSyncPipeline({ reason, showLoading: true, force });
  let currentFingerprint = getPurchaseFingerprint(result.entries || []);
  if (result.ok && (!previousFingerprint || currentFingerprint !== previousFingerprint)) {
    return result;
  }

  for (const delay of delays) {
    await sleepMs(delay);
    result = await refreshPurchaseSyncPipeline({ reason: `${reason}-retry`, showLoading: true, force });
    currentFingerprint = getPurchaseFingerprint(result.entries || []);
    if (result.ok && (!previousFingerprint || currentFingerprint !== previousFingerprint)) {
      return result;
    }
  }

  return result;
}

function resolveProfilePostAudioCandidate(post = {}) {
  const files = Array.isArray(post.files) ? post.files : [];
  const firstAudioFile = files.find((file) => String(file?.type || '').toLowerCase().startsWith('audio/') && String(file?.url || '').trim());
  if (firstAudioFile?.url) {
    return { url: String(firstAudioFile.url).trim(), source: 'audio file' };
  }

  const playable = String(post.playableUrl || '').trim();
  if (playable) {
    return { url: playable, source: 'playableUrl' };
  }

  const firstFileUrl = String(files[0]?.url || '').trim();
  if (firstFileUrl) {
    return { url: firstFileUrl, source: 'audio file' };
  }

  return { url: '', source: 'none' };
}

function resolveProfilePostVideoCandidate(post = {}) {
  const files = Array.isArray(post.files) ? post.files : [];
  const firstVideoFile = files.find((file) => String(file?.type || '').toLowerCase().startsWith('video/') && String(file?.url || '').trim());
  if (firstVideoFile?.url) return String(firstVideoFile.url).trim();
  const playable = String(post.playableUrl || '').trim();
  if (playable) return playable;
  return String(files[0]?.url || '').trim();
}

async function loadProfilePosts(targetUid) {
  const uid = String(targetUid || '').trim();
  if (!uid) {
    profilePostsPayload = null;
    profilePostsPayloadUid = '';
    return [];
  }

  const apiBase = getSiteApiBase();
  const auth = await getProfilePostsAuthContext();
  const headers = {
    Accept: 'application/json'
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const endpoints = ['/api/profile/posts', '/api/getProfilePosts'];

  try {
    for (const endpoint of endpoints) {
      const params = new URLSearchParams();
      params.set('uid', uid);
      params.set('userId', uid);
      params.set('targetUid', uid);
      const url = `${apiBase}${endpoint}?${params.toString()}`;

      console.info('[ProfilePosts] endpoint called:', endpoint, 'auth token type:', auth.type);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        console.warn('[ProfilePosts] endpoint failed:', endpoint, response.status);
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      profilePostsPayload = payload;
      profilePostsPayloadUid = uid;
      const posts = extractProfilePostsArray(payload)
        .filter((post) => post && !isLibraryStylePost(post))
        .map((post, index) => ({
          id: post.id || post._id || `profile_post_${index}`,
          ...post
        }));

      const counts = payload?.counts || payload?.data?.counts || {};
      console.info('[ProfilePosts] response:', endpoint, 'posts=', posts.length, 'counts=', counts);

      posts.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
      return posts;
    }
  } catch (_error) {
    return [];
  }

  return [];
}

async function loadProfileLibrary(targetUid) {
  if (!targetUid) {
    return [];
  }

  try {
    const byKey = new Map();

    if (window.firebaseDb && window.firebaseCollection && window.firebaseGetDocs) {
      const libraryRef = window.firebaseCollection(window.firebaseDb, 'users', targetUid, 'library');
      const snapshot = await window.firebaseGetDocs(libraryRef);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isDeleted) return;
        const normalized = normalizeSiteLibraryItem(docSnap.id, data);
        const key = String(normalized.siteId || normalized.id || docSnap.id || '').trim();
        if (key) byKey.set(key, normalized);
      });
    }

    if (window.firebaseDoc && window.firebaseGetDoc) {
      try {
        const userLibraryDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'userLibraries', targetUid));
        if (userLibraryDoc.exists()) {
          const items = Array.isArray(userLibraryDoc.data()?.items) ? userLibraryDoc.data().items : [];
          items.forEach((entry, index) => {
            if (!entry || entry.isDeleted) return;
            const entryId = entry.id || entry.siteId || entry.fileId || `userLibrary_${index}`;
            const normalized = normalizeSiteLibraryItem(entryId, entry);
            const key = String(normalized.siteId || normalized.id || entryId || '').trim();
            if (key) byKey.set(key, normalized);
          });
        }
      } catch (_docError) {
        // no-op
      }
    }

    try {
      const apiBase = getSiteApiBase();
      const auth = await getProfilePostsAuthContext();
      const headers = { Accept: 'application/json' };
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
      const endpoints = ['/api/profile/library', '/api/getProfileLibrary', '/api/user/library'];

      for (const endpoint of endpoints) {
        const params = new URLSearchParams();
        params.set('uid', targetUid);
        params.set('userId', targetUid);
        params.set('targetUid', targetUid);
        const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
          method: 'GET',
          headers
        });

        if (response.status === 404) continue;
        if (!response.ok) continue;

        const payload = await response.json().catch(() => ({}));
        const rawItems = extractLibraryArray(payload);
        rawItems.forEach((entry, index) => {
          if (!entry || entry.isDeleted) return;
          const entryId = entry.id || entry._id || entry.siteId || entry.fileId || `profile_library_${index}`;
          const normalized = normalizeSiteLibraryItem(entryId, entry);
          const key = String(normalized.siteId || normalized.id || entryId || '').trim();
          if (key) byKey.set(key, normalized);
        });

        if (rawItems.length) break;
      }
    } catch (_apiError) {
      // no-op
    }

    if (String(targetUid) === String(currentUser?.uid || '') && Array.isArray(purchaseSyncEntries) && purchaseSyncEntries.length) {
      purchaseSyncEntries.forEach((entry, index) => {
        const purchaseId = String(entry.postId || entry.id || `purchase_profile_${index}`).trim();
        if (!purchaseId) return;
        const normalized = normalizeSiteLibraryItem(purchaseId, {
          id: purchaseId,
          title: entry.itemTitle || entry.title || 'Purchased item',
          name: entry.itemTitle || entry.title || 'Purchased item',
          fileUrl: entry.fileUrl || '',
          downloadURL: entry.fileUrl || '',
          uploadedAt: entry.purchasedAt || new Date(),
          source: 'purchase',
          isPurchased: true,
          purchased: true,
          purchaseId: entry.id
        });
        const key = String(normalized.siteId || normalized.id || purchaseId).trim();
        if (key) byKey.set(key, { ...normalized, isPurchased: true, purchased: true });
      });
    }

    const items = Array.from(byKey.values());

    items.sort((a, b) => getTimestampMs(b.uploadedAt || b.createdAt) - getTimestampMs(a.uploadedAt || a.createdAt));
    return items;
  } catch (_error) {
    return [];
  }
}

async function loadProfilePurchases(targetUid) {
  if (!targetUid) {
    return [];
  }

  if (String(targetUid) === String(currentUser?.uid || '') && Array.isArray(purchaseSyncEntries) && purchaseSyncEntries.length) {
    return purchaseSyncEntries.map((entry) => getPurchaseDisplayLabel(entry));
  }

  const labels = new Set();
  const isMeaningfulPurchaseLabel = (value) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^\d+$/.test(text)) return false;
    if (/^(true|false|null|undefined)$/i.test(text)) return false;
    return true;
  };

  const addLabel = (value) => {
    const text = String(value || '').trim();
    if (isMeaningfulPurchaseLabel(text)) labels.add(text);
  };

  const extractLabel = (entry = {}) => (
    entry.name ||
    entry.title ||
    entry.fileName ||
    entry.file_name ||
    entry.label ||
    entry.sampleName ||
    entry.sample_name ||
    entry.productName ||
    entry.product_name ||
    entry.itemName ||
    entry.item_name ||
    entry.assetName ||
    entry.asset_name ||
    entry.trackName ||
    entry.track_name ||
    entry.product?.name ||
    entry.item?.name ||
    entry.asset?.name ||
    entry.track?.name ||
    ''
  );

  const pushEntry = (entry) => {
    if (entry == null) return;
    if (Array.isArray(entry)) {
      entry.forEach((item) => pushEntry(item));
      return;
    }
    if (typeof entry === 'string') {
      addLabel(entry);
      return;
    }
    if (typeof entry !== 'object') {
      addLabel(entry);
      return;
    }

    addLabel(extractLabel(entry));

    ['items', 'purchases', 'savedSamples', 'saved_samples', 'saved', 'samples', 'results', 'assets', 'tracks', 'files', 'products'].forEach((key) => {
      if (Array.isArray(entry[key])) {
        pushEntry(entry[key]);
      }
    });

    if (entry.data && Array.isArray(entry.data)) {
      pushEntry(entry.data);
    }
  };

  const pushFromEntries = (entries = []) => {
    entries.forEach((entry) => pushEntry(entry));
  };

  if (window.firebaseDb && window.firebaseCollection && window.firebaseGetDocs) {
    try {
      const purchasesRef = window.firebaseCollection(window.firebaseDb, 'users', targetUid, 'purchases');
      const purchasesSnap = await window.firebaseGetDocs(purchasesRef);
      purchasesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        pushFromEntries([data]);
        pushFromEntries(Array.isArray(data.items) ? data.items : []);
      });
    } catch (_error) {
      // no-op
    }
  }

  if (window.firebaseDoc && window.firebaseGetDoc) {
    try {
      const userDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'users', targetUid));
      if (userDoc.exists()) {
        const data = userDoc.data() || {};
        pushFromEntries(Array.isArray(data.savedSamples) ? data.savedSamples : []);
        pushFromEntries(Array.isArray(data.purchases) ? data.purchases : []);
      }
    } catch (_error) {
      // no-op
    }

    try {
      const userPurchasesDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'userPurchases', targetUid));
      if (userPurchasesDoc.exists()) {
        const data = userPurchasesDoc.data() || {};
        pushFromEntries(Array.isArray(data.items) ? data.items : []);
        pushFromEntries(Array.isArray(data.purchases) ? data.purchases : []);
        pushFromEntries(Array.isArray(data.savedSamples) ? data.savedSamples : []);
      }
    } catch (_error) {
      // no-op
    }
  }

  try {
    const apiBase = getSiteApiBase();
    const auth = await getProfilePostsAuthContext();
    const headers = { Accept: 'application/json' };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
    const endpoints = ['/api/profile/purchases', '/api/getProfilePurchases', '/api/user/purchases', '/api/purchases'];

    for (const endpoint of endpoints) {
      const params = new URLSearchParams();
      params.set('uid', targetUid);
      params.set('userId', targetUid);
      params.set('targetUid', targetUid);

      const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) continue;
      if (!response.ok) continue;

      const payload = await response.json().catch(() => ({}));
      pushEntry(payload);
      pushFromEntries(extractLibraryArray(payload));
      pushFromEntries(extractProfilePostsArray(payload));
    }
  } catch (_error) {
    // no-op
  }

  pushFromEntries(collectProfileArrayEntries(['savedSamples', 'savedSample', 'purchases', 'purchaseHistory', 'orders']));

  return Array.from(labels.values());
}

async function loadDiscoverUsers(limit = 30) {
  try {
    const apiBase = getSiteApiBase();
    const auth = await getProfilePostsAuthContext();
    const headers = { Accept: 'application/json' };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

    const params = new URLSearchParams();
    params.set('limit', String(limit));

    const endpoints = ['/api/discover/users', '/api/users/discover'];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) continue;
      if (!response.ok) {
        if (response.status === 401) {
          return { error: 'auth', users: [] };
        }
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      return {
        users: Array.isArray(payload.users) ? payload.users : [],
        counts: payload.counts || {}
      };
    }
  } catch (error) {
    console.error('Error loading discover users:', error);
  }
  
  return { users: [], counts: {} };
}

async function loadMarketplaceItems(type = 'all', limit = 120) {
  try {
    const apiBase = getSiteApiBase();
    const auth = await getProfilePostsAuthContext();
    const headers = { Accept: 'application/json' };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

    const params = new URLSearchParams();
    params.set('type', type);
    params.set('limit', String(limit));

    const endpoints = ['/api/marketplace', '/api/marketplace/items'];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) continue;
      if (!response.ok) {
        if (response.status === 401) {
          return { error: 'auth', items: [] };
        }
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      return {
        items: extractMarketplaceItemsArray(payload),
        counts: payload.counts || {}
      };
    }
  } catch (error) {
    console.error('Error loading marketplace items:', error);
  }
  
  return { items: [], counts: {} };
}

function generateMarketplaceWaveformSvg(itemId = '') {
  const bars = 60;
  const height = 40;
  const barWidth = 2;
  const gapWidth = 1;
  const width = bars * (barWidth + gapWidth);
  
  // Generate pseudo-random waveform based on item ID (deterministic)
  const seed = itemId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const random = (index) => {
    const x = Math.sin(seed + index) * 10000;
    return x - Math.floor(x);
  };
  
  let svgBars = '';
  for (let i = 0; i < bars; i++) {
    const intensity = random(i);
    const barHeight = Math.max(4, height * intensity);
    const y = (height - barHeight) / 2;
    const x = i * (barWidth + gapWidth);
    
    svgBars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#00ffc8" rx="1"/>`;
  }
  
  return `
    <svg viewBox="0 0 ${width} ${height}" class="marketplace-waveform-svg" preserveAspectRatio="none">
      ${svgBars}
    </svg>
  `;
}

async function uploadMarketplaceItem(formData) {
  if (!formData.title || !formData.title.trim()) {
    throw new Error('Title is required');
  }

  if (!Array.isArray(formData.files) || formData.files.length === 0) {
    throw new Error('At least one file is required');
  }

  const files = formData.files
    .filter((f) => f && f.url)
    .map((f) => ({
      name: String(f.name || '').trim(),
      url: String(f.url || '').trim(),
      type: String(f.type || 'audio/wav'),
      size: Number(f.size || 0)
    }));

  if (files.length === 0) {
    throw new Error('At least one file URL is required');
  }

  const payload = {
    title: String(formData.title || '').trim(),
    description: String(formData.description || '').trim(),
    type: String(formData.type || 'sample').trim(),
    sampleType: String(formData.sampleType || 'Audio').trim(),
    files,
    coverImageUrl: String(formData.coverImageUrl || '').trim(),
    genre: String(formData.genre || '').trim(),
    bpm: Number(formData.bpm || 0),
    key: String(formData.key || '').trim(),
    tags: Array.isArray(formData.tags) 
      ? formData.tags.filter((t) => t).map((t) => String(t).trim())
      : [],
    isFree: parseMarketplaceBoolean(formData.isFree, false),
    streamOnly: parseMarketplaceBoolean(formData.streamOnly, false),
    licenseTiers: Array.isArray(formData.licenseTiers) ? formData.licenseTiers : [],
    licenses: Array.isArray(formData.licenses) ? formData.licenses : [],
    licenseOptions: Array.isArray(formData.licenseOptions) ? formData.licenseOptions : [],
    basicPrice: Number(formData.basicPrice || 0),
    personalPrice: Number(formData.personalPrice || 0),
    commercialPrice: Number(formData.commercialPrice || 0),
    exclusivePrice: Number(formData.exclusivePrice || 0)
  };

  const headers = await getSiteApiAuthHeaders();
  headers['Content-Type'] = 'application/json';

  const response = await fetch(`${getSiteApiBase()}/api/marketplace/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  handleMarketplaceApiError(response, 'upload marketplace item');

  const result = await response.json();
  if (!result.ok || !result.postId) {
    throw new Error('Failed to create marketplace post');
  }

  const createdItem = result.item || {
    id: result.postId,
    title: formData.title,
    type: formData.type || 'sample'
  };

  showNotification(`Successfully uploaded "${formData.title}" to marketplace!`);
  return {
    ok: true,
    postId: result.postId,
    item: normalizeMarketplaceItem(createdItem)
  };
}

function openMarketplaceUploadModal() {
  if (!currentUser) {
    showNotification('Please sign in to upload to marketplace');
    return;
  }

  const container = document.getElementById('marketplaceUploadForm');
  if (!container) {
    console.error('[Marketplace] Upload form container not found');
    return;
  }

  container.innerHTML = `
    <form id="mpUploadForm" class="marketplace-upload-form">
      <div class="form-group">
        <label for="mpTitle">Title *</label>
        <input type="text" id="mpTitle" name="title" placeholder="e.g., Chill Beats Vol. 1" required />
      </div>
      
      <div class="form-group">
        <label for="mpDescription">Description</label>
        <textarea id="mpDescription" name="description" placeholder="Describe your marketplace item..." rows="3"></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="mpType">Type</label>
          <select id="mpType" name="type">
            <option value="sample">Sample Pack</option>
            <option value="preset">Preset</option>
            <option value="template">Template</option>
            <option value="drumkit">Drum Kit</option>
            <option value="sound">Sound</option>
            <option value="loop">Loop</option>
            <option value="plugin">Plugin</option>
          </select>
        </div>
        <div class="form-group">
          <label for="mpGenre">Genre</label>
          <input type="text" id="mpGenre" name="genre" placeholder="e.g., Electronic, Hip-Hop" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="mpBpm">BPM</label>
          <input type="number" id="mpBpm" name="bpm" min="0" placeholder="120" />
        </div>
        <div class="form-group">
          <label for="mpKey">Key</label>
          <input type="text" id="mpKey" name="key" placeholder="e.g., C Minor" />
        </div>
      </div>

      <div class="form-group">
        <label for="mpTags">Tags (comma-separated)</label>
        <input type="text" id="mpTags" name="tags" placeholder="e.g., trap, 808, atmospheric" />
      </div>

      <div class="form-group">
        <label for="mpCoverImage">Cover Image URL</label>
        <input type="url" id="mpCoverImage" name="coverImageUrl" placeholder="https://..." />
      </div>

      <fieldset class="form-group">
        <legend>Pricing</legend>
        <div class="pricing-option">
          <label>
            <input type="radio" name="pricingType" value="free" checked /> 
            Free
          </label>
          <label>
            <input type="radio" name="pricingType" value="stream-only" /> 
            Stream Only
          </label>
          <label>
            <input type="radio" name="pricingType" value="paid" /> 
            Paid
          </label>
        </div>
        
        <div id="paidPricingSection" style="display: none;">
          <div class="form-row">
            <div class="form-group">
              <label for="mpBasicPrice">Basic Price</label>
              <input type="number" id="mpBasicPrice" name="basicPrice" min="0" step="0.01" placeholder="9.99" />
            </div>
            <div class="form-group">
              <label for="mpPersonalPrice">Personal Price</label>
              <input type="number" id="mpPersonalPrice" name="personalPrice" min="0" step="0.01" placeholder="24.99" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="mpCommercialPrice">Commercial Price</label>
              <input type="number" id="mpCommercialPrice" name="commercialPrice" min="0" step="0.01" placeholder="49.99" />
            </div>
            <div class="form-group">
              <label for="mpExclusivePrice">Exclusive Price</label>
              <input type="number" id="mpExclusivePrice" name="exclusivePrice" min="0" step="0.01" placeholder="99.99" />
            </div>
          </div>
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn-primary">Upload to Marketplace</button>
        <button type="button" class="btn-secondary" id="btnCancelMpUpload">Cancel</button>
      </div>
    </form>
  `;

  const pricingRadios = container.querySelectorAll('input[name="pricingType"]');
  const paidSection = container.getElementById('paidPricingSection');
  
  pricingRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (paidSection) {
        paidSection.style.display = radio.value === 'paid' ? 'block' : 'none';
      }
    });
  });

  const form = container.querySelector('#mpUploadForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const formData = new FormData(form);
        const pricingType = formData.get('pricingType');
        
        const uploadPayload = {
          title: formData.get('title'),
          description: formData.get('description'),
          type: formData.get('type'),
          genre: formData.get('genre'),
          bpm: formData.get('bpm'),
          key: formData.get('key'),
          tags: (formData.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
          coverImageUrl: formData.get('coverImageUrl'),
          isFree: pricingType === 'free',
          streamOnly: pricingType === 'stream-only',
          basicPrice: pricingType === 'paid' ? (formData.get('basicPrice') || 0) : 0,
          personalPrice: pricingType === 'paid' ? (formData.get('personalPrice') || 0) : 0,
          commercialPrice: pricingType === 'paid' ? (formData.get('commercialPrice') || 0) : 0,
          exclusivePrice: pricingType === 'paid' ? (formData.get('exclusivePrice') || 0) : 0,
          files: [] // User would upload files separately or provide URLs
        };

        await uploadMarketplaceItem(uploadPayload);
        form.reset();
        closeModal('marketplaceUploadModal');
        
        await reloadMarketplaceView();
      } catch (error) {
        console.error('[Marketplace] Upload error:', error);
        showNotification(String(error.message || 'Upload failed. Please try again.'));
      }
    });
  }

  const cancelBtn = container.querySelector('#btnCancelMpUpload');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal('marketplaceUploadModal');
    });
  }

  openModal('marketplaceUploadModal');
}

async function reloadMarketplaceView() {
  const result = await loadMarketplaceItems('all', 120);
  if (!result.error && result.items) {
    simpleProfileMarketplaceCache = (result.items || []).map((item, index) => normalizeMarketplaceItem(item, index));
    setupMarketplaceGenreOptions(simpleProfileMarketplaceCache);
    filterContent(marketplaceFilterType);
  }
}

function extractMarketplaceItemsArray(payload = {}) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.marketplace)) return payload.marketplace;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function parseMarketplaceBoolean(value, fallback = null) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', ''].includes(normalized)) return false;
  }
  return fallback;
}

function parseMarketplacePrice(item = {}) {
  const candidates = [
    item.price,
    item.priceValue,
    item.amount,
    item.unitPrice,
    item.priceUsd,
    item.priceUSD,
    item.priceInUsd,
    item.minPrice,
    item.startingPrice,
    item.priceCents,
    item.amountCents
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      if (String(candidate).includes('.') || candidate < 1000) return Math.max(0, candidate);
      if (String(candidate).endsWith('00')) return Math.max(0, candidate / 100);
      return Math.max(0, candidate);
    }

    if (typeof candidate === 'string') {
      const cleaned = candidate.replace(/[^\d.-]/g, '').trim();
      if (!cleaned) continue;
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return Math.max(0, parsed);
    }
  }

  return NaN;
}

function getMarketplacePriceLabel(item = {}) {
  if (!item) return 'Price unavailable';

  const priceLabel = String(item.priceLabel || item.price || '').trim();
  if (priceLabel && !priceLabel.startsWith('$') && priceLabel !== '0' && priceLabel !== '0.00') {
    return priceLabel;
  }

  const streamOnly = parseMarketplaceBoolean(item.streamOnly, false);
  if (streamOnly) return 'Stream Only';

  const isFree = parseMarketplaceBoolean(item.isFree, false);
  if (isFree) return 'Free';

  const priceValue = getMarketplaceMinPrice(item);
  if (Number.isFinite(priceValue) && priceValue > 0) {
    const licenseTiers = Array.isArray(item.licenseTiers) ? item.licenseTiers : [];
    if (licenseTiers.length > 1) {
      return `From $${Number(priceValue).toFixed(2)}`;
    }
    return `$${Number(priceValue).toFixed(2)}`;
  }

  return 'Price unavailable';
}

function getMarketplaceMinPrice(item = {}) {
  if (!item) return NaN;

  const explicit = item.priceValue;
  if (Number.isFinite(explicit)) return Number(explicit);

  const licenseTiers = Array.isArray(item.licenseTiers) ? item.licenseTiers : [];
  const tierPrices = licenseTiers
    .map((tier) => Number(tier?.price ?? tier?.amount ?? 0))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (tierPrices.length) return tierPrices[0];

  const legacyPrices = [
    item.basicPrice,
    item.personalPrice,
    item.commercialPrice,
    item.exclusivePrice
  ]
    .map((p) => Number(p ?? 0))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (legacyPrices.length) return legacyPrices[0];

  const fallback = Number(item.price ?? item.priceValue ?? 0);
  return Number.isFinite(fallback) ? fallback : NaN;
}

function normalizeMarketplaceItem(item = {}, index = 0) {
  const title = String(item.title || item.name || item.caption || item.description || 'Untitled').trim();
  const sellerName = String(item.userName || item.sellerName || item.creatorName || item.displayName || item.username || item.ownerName || 'Unknown').trim();
  const rawPrice = parseMarketplacePrice(item);
  const explicitIsFree = parseMarketplaceBoolean(item.isFree, null);
  const explicitStreamOnly = parseMarketplaceBoolean(item.streamOnly, null);
  const previewOnly = parseMarketplaceBoolean(item.previewOnly, null);
  const isPreviewOnly = parseMarketplaceBoolean(item.isPreviewOnly, null);
  const streamOnly = explicitStreamOnly === true || previewOnly === true || isPreviewOnly === true;
  const isFree = explicitIsFree === true
    ? true
    : (explicitIsFree === false
      ? false
      : (Number.isFinite(rawPrice) && rawPrice === 0 && !streamOnly));
  const audioUrl = normalizeProfileMediaUrl(
    item.audioUrl || item.audioURL || item.previewAudioUrl || item.sampleUrl || item.demoUrl || item.downloadURL || item.fileUrl || item.url || item.sourceAudioUrl || ''
  );
  const idFallback = [title, sellerName, Number.isFinite(rawPrice) ? rawPrice.toFixed(2) : '0.00', index].join('::');
  const id = String(item.id || item.itemId || item.postId || item._id || item.slug || idFallback).trim();

  const tags = Array.isArray(item.tags)
    ? item.tags
    : (typeof item.tags === 'string' ? item.tags.split(',').map((entry) => entry.trim()).filter(Boolean) : []);

  const minPrice = getMarketplaceMinPrice(item);
  const normalizedPrice = Number.isFinite(minPrice) ? minPrice : 0;
  const priceLabel = getMarketplacePriceLabel(item);

  return {
    ...item,
    id,
    title,
    description: String(item.description || item.caption || '').trim(),
    sampleType: String(item.sampleType || item.type || item.category || 'Item').trim(),
    type: String(item.type || item.sampleType || item.category || 'item').trim(),
    image: item.image || item.coverImage || item.coverImageUrl || item.thumbnailURL || item.thumbnailUrl || item.previewUrl || item.imageUrl || '',
    userName: sellerName,
    userAvatar: item.userAvatar || item.avatarUrl || item.photoURL || item.creatorAvatar || '',
    genre: item.genre || '',
    bpm: item.bpm || '',
    key: item.key || '',
    tags,
    price: normalizedPrice,
    priceValue: normalizedPrice,
    priceLabel,
    hasPriceValue: Number.isFinite(minPrice),
    isFree,
    streamOnly,
    audioUrl,
    downloadURL: normalizeProfileMediaUrl(item.downloadURL || item.fileUrl || audioUrl || ''),
    fileUrl: normalizeProfileMediaUrl(item.fileUrl || item.downloadURL || audioUrl || ''),
    storagePath: String(item.storagePath || item.audioPath || item.filePath || item.path || item.mediaPath || item.firebasePath || '').trim(),
    sellerId: item.sellerId || item.userId || item.ownerUid || item.uid || '',
    license: item.license || null,
    licenseTiers: Array.isArray(item.licenseTiers) ? item.licenseTiers : [],
    basicPrice: Number(item.basicPrice ?? 0),
    personalPrice: Number(item.personalPrice ?? 0),
    commercialPrice: Number(item.commercialPrice ?? 0),
    exclusivePrice: Number(item.exclusivePrice ?? 0)
  };
}

function marketplaceItemToLibraryFile(item = {}) {
  const inferredMime = inferMimeTypeFromName(item.title || item.name || '');
  const normalizedType = normalizeLibraryType(item.type, item.mimeType || inferredMime, item.title || item.name || '');
  
  return {
    id: `marketplace_${String(item.id || '').trim()}`,
    sourceId: String(item.id || '').trim(),
    name: item.title || item.name || 'Untitled',
    title: item.title || item.name || 'Untitled',
    size: Number(item.size || 0),
    type: normalizedType === 'unknown' || normalizedType === 'other' ? 'audio' : normalizedType,
    section: 'marketplace',
    uploadedAt: item.createdAt || item.uploadedAt || new Date(),
    mimeType: item.mimeType || inferredMime || 'audio/wav',
    downloadURL: normalizeProfileMediaUrl(item.downloadURL || item.fileUrl || item.audioUrl || ''),
    audioUrl: normalizeProfileMediaUrl(item.audioUrl || item.downloadURL || item.fileUrl || ''),
    sourceAudioUrl: normalizeProfileMediaUrl(item.audioUrl || item.downloadURL || item.fileUrl || ''),
    storagePath: String(item.storagePath || '').trim(),
    thumbnailURL: item.image || item.thumbnailURL || item.thumbnailUrl || '',
    isReadOnly: true
  };
}

function ensureMarketplacePreviewItem(item = {}) {
  const file = marketplaceItemToLibraryFile(item);
  if (!file.sourceId) return '';

  const existingIndex = userLibrary.findIndex((entry) => String(entry?.id || '').trim() === file.id);
  if (existingIndex >= 0) {
    userLibrary[existingIndex] = { ...userLibrary[existingIndex], ...file };
  } else {
    userLibrary.push(file);
  }

  return file.id;
}

async function previewMarketplaceItem(item = {}) {
  const previewId = ensureMarketplacePreviewItem(item);
  if (!previewId) {
    showNotification('Preview unavailable for this item');
    return;
  }

  await playLibraryItem(previewId);
}

async function downloadMarketplaceItem(item = {}) {
  const previewId = ensureMarketplacePreviewItem(item);
  if (!previewId) {
    showNotification('Download unavailable for this item');
    return;
  }

  const file = findRenderableLibraryItemById(previewId);
  if (!file) {
    showNotification('Download unavailable for this item');
    return;
  }

  await downloadFile(file);
}

function normalizeProfilePostItem(post = {}) {
  const title = post.title || post.name || post.caption || post.text || post.description || 'Untitled';
  const files = Array.isArray(post.files) ? post.files : [];
  const audioCandidate = resolveProfilePostAudioCandidate(post);
  const videoCandidate = resolveProfilePostVideoCandidate(post);
  const firstFile = files[0] || {};
  const mimeType = post.mimeType || post.contentType || firstFile.type || inferMimeTypeFromName(firstFile.name || post.fileName || post.name || title || '');

  return {
    id: post.id || '',
    title,
    name: post.name || title,
    mimeType,
    size: Number(post.size || post.fileSize || firstFile.size || 0),
    createdAt: post.createdAt || post.timestamp || post.created_at || null,
    uploadedAt: post.createdAt || post.timestamp || post.created_at || null,
    sourceAudioUrl: audioCandidate.url,
    audioSourceKind: audioCandidate.source,
    downloadURL: audioCandidate.url,
    audioUrl: audioCandidate.url,
    videoUrl: String(videoCandidate || '').trim(),
    mediaUrl: String(post.mediaUrl || '').trim(),
    storagePath: String(post.storagePath || post.audioPath || post.filePath || post.path || post.mediaPath || post.firebasePath || '').trim(),
    thumbnailURL: post.coverImageUrl || post.thumbnailURL || post.thumbnailUrl || post.imageUrl || post.coverUrl || post.previewUrl || '',
    mediaKind: post.mediaKind || '',
    type: post.type || post.sampleType || '',
    sampleType: post.sampleType || '',
    visibility: post.visibility || '',
    isFree: Boolean(post.isFree),
    streamOnly: Boolean(post.streamOnly),
    price: Number(post.price || 0),
    files,
    genre: post.genre || '',
    bpm: post.bpm || '',
    key: post.key || ''
  };
}

function normalizeProfileMediaUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('http://')) {
    try {
      const parsed = new URL(raw);
      if (['localhost', '127.0.0.1'].includes(parsed.hostname)) return raw;
      return raw.replace(/^http:\/\//i, 'https://');
    } catch (_error) {
      return raw.replace(/^http:\/\//i, 'https://');
    }
  }
  if (raw.startsWith('https://') || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
  if (raw.startsWith('/')) return `${getSiteApiBase()}${raw}`;
  if (/^[^\s]+\.[^\s]+/.test(raw) && !raw.includes('://')) {
    return `${getSiteApiBase()}/${raw.replace(/^\/+/, '')}`;
  }
  return '';
}

function getWaveformCompatibleAudioUrl(value = '') {
  const normalized = normalizeProfileMediaUrl(value);
  if (!normalized) return '';
  if (normalized.startsWith('blob:') || normalized.startsWith('data:')) return normalized;

  try {
    const parsed = new URL(normalized);
    if (['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
      return normalized;
    }
    const origin = String(window.location?.origin || '').trim();
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      return normalized;
    }
    return `${origin}/proxy/media?url=${encodeURIComponent(normalized)}`;
  } catch (_error) {
    return normalized;
  }
}

async function resolveProfilePostAudioSource(post = {}) {
  const directCandidates = [
    post.downloadURL,
    post.audioUrl,
    post.audioURL,
    post.mediaUrl,
    post.fileUrl,
    post.url,
    post.sourceAudioUrl
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeProfileMediaUrl(candidate);
    if (normalized) return normalized;
  }

  const storagePath = String(post.storagePath || post.audioPath || post.filePath || post.path || post.mediaPath || post.firebasePath || '').trim();
  if (storagePath && window.firebaseStorage && window.firebaseStorageRef && window.firebaseGetDownloadURL) {
    try {
      const ref = window.firebaseStorageRef(window.firebaseStorage, storagePath);
      const url = await window.firebaseGetDownloadURL(ref);
      const normalized = normalizeProfileMediaUrl(url);
      if (normalized) {
        post.downloadURL = normalized;
        return normalized;
      }
    } catch (_error) {
      // no-op
    }
  }

  return '';
}

window.waveformInstances = window.waveformInstances || {};
let waveformPlayDelegationBound = false;

function pauseOtherWaveforms(activeId = '') {
  const map = window.waveformInstances || {};
  Object.entries(map).forEach(([id, instance]) => {
    if (!instance || id === activeId) return;
    try {
      if (instance.isPlaying && instance.isPlaying()) {
        instance.pause();
      }
    } catch (_error) {
      // no-op
    }
  });
}

function getWaveformButtonIcon(isPlaying) {
  return isPlaying
    ? '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M96,48H64A16,16,0,0,0,48,64V192a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V64A16,16,0,0,0,96,48Zm96,0H160a16,16,0,0,0-16,16V192a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V64A16,16,0,0,0,192,48Z"/></svg>'
    : '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M88,64V192a8,8,0,0,0,12.14,6.86l96-64a8,8,0,0,0,0-13.72l-96-64A8,8,0,0,0,88,64Z"/></svg>';
}

function setWaveformButtonState(waveformId, isPlaying) {
  document.querySelectorAll(`.play-btn[data-waveform-id="${CSS.escape(String(waveformId || ''))}"]`).forEach((button) => {
    button.classList.toggle('is-playing', Boolean(isPlaying));
    button.innerHTML = getWaveformButtonIcon(Boolean(isPlaying));
  });
}

function initializeWaveforms() {
  const containers = Array.from(document.querySelectorAll('[data-audio-url]'));
  console.info('[Waveforms] containers found:', containers.length);

  containers.forEach((container, index) => {
    if (!container) return;
    if (container.dataset.initialized === '1') return;

    let containerId = String(container.id || '').trim();
    if (!containerId) {
      containerId = `waveform_${Date.now()}_${index}`;
      container.id = containerId;
    }

    const audioUrl = getWaveformCompatibleAudioUrl(container.dataset.audioUrl || '');
    if (!audioUrl) return;

    if (!window.WaveSurfer?.create) return;

    try {
      const instance = window.WaveSurfer.create({
        container,
        url: audioUrl,
        backend: 'MediaElement',
        mediaType: 'audio',
        mediaControls: false,
        xhr: { mode: 'cors', credentials: 'omit' },
        waveColor: '#22d3ee',
        progressColor: '#34d399',
        height: 56,
        barWidth: 3,
        barGap: 2,
        barRadius: 3,
        responsive: true,
        normalize: true
      });

      window.waveformInstances[containerId] = instance;
      container.dataset.initialized = '1';
      console.info('[Waveforms] initialized:', containerId, audioUrl);

      instance.on('play', () => {
        pauseOtherWaveforms(containerId);
        setWaveformButtonState(containerId, true);
      });
      instance.on('pause', () => {
        setWaveformButtonState(containerId, false);
      });
      instance.on('finish', () => {
        setWaveformButtonState(containerId, false);
      });
    } catch (_error) {
      // no-op
    }
  });
}

window.initializeWaveforms = initializeWaveforms;

async function hydrateSimpleProfileWaveformSources() {
  const waveformContainers = Array.from(document.querySelectorAll('#simpleProfilePosts [data-profile-post-id][data-audio-url], #simpleProfileShares [data-profile-post-id][data-audio-url], #simpleProfileProjects [data-profile-post-id][data-audio-url], #simpleProfilePurchasesList [data-profile-post-id][data-audio-url]'));
  const purchasePostsById = new Map(getSimpleProfilePurchasePosts().map((item) => [String(item.id || '').trim(), item]));
  for (const container of waveformContainers) {
    const currentUrl = normalizeProfileMediaUrl(container.dataset.audioUrl || '');
    if (currentUrl) continue;

    const postId = String(container.dataset.profilePostId || '').trim();
    if (!postId) continue;

    const post = simpleProfilePostsCache.find((item) => String(item.id || '').trim() === postId) || purchasePostsById.get(postId);
    if (!post) continue;

    const source = await resolveProfilePostAudioSource(post);
    if (source) {
      container.dataset.audioUrl = source;
    }
  }

  initializeWaveforms();
}

let simpleProfilePostsCache = [];
let simpleProfileLibraryCache = [];
let simpleProfilePurchasesCache = [];
let simpleProfileDiscoverCache = [];
let simpleProfileMarketplaceCache = [];
let profilePostsPayload = null;
let profilePostsPayloadUid = '';
let currentSimpleProfileTab = 'posts';
let simpleProfileTargetUid = '';
let marketplaceFilterType = 'all';
let currentHomeFeedFilter = 'all';
let discoverDataLoading = false;
let marketplaceDataLoading = false;
let homeFeedLoading = false;
let homeFeedItemsCache = [];
let homeFeedItemMap = new Map();
let homeFeedEndpointMap = null;
let homeFeedEndpointMapLoaded = false;
let homeFeedOwnershipState = {
  ownedIds: new Set(),
  cartIds: new Set(),
  currentUserId: ''
};
let marketplaceSubfiltersInitialized = false;
let marketplaceTagSuggestionsInitialized = false;
let filterUiListenersInitialized = false;

const MARKETPLACE_EXCLUDED_TYPES = new Set(['video', 'collab', 'collaboration', 'collabs', 'post', 'text']);

const MARKETPLACE_SUBFILTER_HINT_MAP = {
  samples: 'Refine sample listings by genre, BPM, key, price, and tags.',
  instrumentals: 'Narrow beats by genre, BPM range, musical key, price, and tags.',
  'sample-packs': 'Filter packs by pack type, pricing, and tags.',
  'drum-kits': 'Filter drum kits by pricing and tags.',
  loops: 'Filter loop listings by genre, BPM, key, price, and tags.',
  vocals: 'Filter vocal listings by genre, BPM, key, price, and tags.',
  'one-shots': 'Filter one-shots by pricing and tags.',
  fx: 'Filter FX packs by pricing and tags.',
  'midi-packs': 'Filter MIDI packs by pricing and tags.',
  'preset-banks': 'Filter preset banks by pricing and tags.',
  songs: 'Refine songs by genre, BPM, key, price, and tags.',
  services: 'Filter services by pricing and tags.',
  plugins: 'Filter plugins by pricing and tags.'
};

const TAG_SUGGESTIONS = [
  'trap', 'drill', 'rage', 'boom bap', 'east coast', 'west coast', 'southern', 'uk',
  'afrobeats', 'amapiano', 'dancehall', 'reggaeton', 'latin', 'rnb', 'neo soul', 'pop',
  'alt pop', 'hyperpop', 'edm', 'house', 'techno', 'dnb', 'ambient', 'cinematic',
  'orchestral', 'synthwave', 'phonk', 'lofi', 'melodic', 'dark', 'aggressive', 'emotional',
  'guitar', 'piano', '808', 'bass', 'vocal chop', 'fx', 'one shot', 'midi', 'preset',
  'serum', 'kontakt', 'vst', 'mixing', 'mastering', 'recording', 'songwriting', 'collab'
];

// Cart state
let cartItems = [];
let cartTotal = 0;
let stripe = null;

function isShareStylePost(post = {}) {
  if (post.isShare === true) return true;
  if (String(post.source || '').toLowerCase() === 'share') return true;
  if (String(post.postType || '').toLowerCase() === 'share') return true;
  if (post.shareId || post.sharedPostId || post.sharedFromId || post.repostOf) return true;
  return false;
}

function asNameList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      return String(entry?.displayName || entry?.username || entry?.name || entry?.uid || '').trim();
    })
    .filter(Boolean);
}

function buildKnownProfileNameMap() {
  const map = new Map();

  const addEntry = (key, label) => {
    const normalizedKey = String(key || '').trim();
    const normalizedLabel = String(label || '').trim();
    if (!normalizedKey || !normalizedLabel) return;
    map.set(normalizedKey, normalizedLabel);
    map.set(normalizedKey.toLowerCase(), normalizedLabel);
  };

  addEntry(currentUser?.uid, currentUser?.displayName || currentUser?.username);
  addEntry(currentUser?.username, currentUser?.displayName || currentUser?.username);

  (userFriends || []).forEach((friend) => {
    const label = friend?.displayName || friend?.username || friend?.email || friend?.uid || friend?.id;
    addEntry(friend?.uid, label);
    addEntry(friend?.id, label);
    addEntry(friend?.username, label);
    addEntry(friend?.email, label);
  });

  return map;
}

function toProfileNameList(value, knownNames = new Map()) {
  let source = [];
  if (Array.isArray(value)) {
    source = value;
  } else if (value && typeof value === 'object') {
    source = Array.isArray(value.items)
      ? value.items
      : Object.values(value);
  }

  return source
    .map((entry) => {
      if (typeof entry === 'string') {
        const raw = entry.trim();
        if (!raw) return '';
        return knownNames.get(raw) || knownNames.get(raw.toLowerCase()) || raw;
      }
      if (entry && typeof entry === 'object') {
        const direct = String(entry.displayName || entry.username || entry.name || '').trim();
        if (direct) return direct;
        const uid = String(entry.uid || entry.id || entry.userId || entry.ownerUid || '').trim();
        if (!uid) return '';
        return knownNames.get(uid) || knownNames.get(uid.toLowerCase()) || uid;
      }
      return '';
    })
    .filter(Boolean);
}

function getCollectionLength(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value.items)) return value.items.length;
  if (Array.isArray(value.data)) return value.data.length;
  if (Number.isFinite(Number(value.count))) return Number(value.count);
  if (Number.isFinite(Number(value.total))) return Number(value.total);
  if (Number.isFinite(Number(value.length))) return Number(value.length);
  return Object.keys(value).length;
}

function resolveSocialCount(explicitCount, rawCollection, fallbackLength = 0) {
  const explicit = Number(explicitCount);
  const rawLength = Number(getCollectionLength(rawCollection));
  const fallback = Number(fallbackLength);
  const safeExplicit = Number.isFinite(explicit) && explicit >= 0 ? explicit : 0;
  const safeRaw = Number.isFinite(rawLength) && rawLength >= 0 ? rawLength : 0;
  const safeFallback = Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
  return Math.max(safeExplicit, safeRaw, safeFallback);
}

function buildSimpleProfileSocialData() {
  const knownNames = buildKnownProfileNameMap();

  const fallbackFollowers = (userFriends || [])
    .filter((friend) => ['follower', 'mutual'].includes(String(friend?.status || '').toLowerCase()))
    .map((friend) => String(friend?.displayName || friend?.username || friend?.uid || friend?.id || '').trim())
    .filter(Boolean);
  const fallbackFollowing = (userFriends || [])
    .filter((friend) => ['following', 'mutual'].includes(String(friend?.status || '').toLowerCase()))
    .map((friend) => String(friend?.displayName || friend?.username || friend?.uid || friend?.id || '').trim())
    .filter(Boolean);
  const fallbackConnections = (userFriends || [])
    .filter((friend) => String(friend?.status || '').toLowerCase() === 'mutual')
    .map((friend) => String(friend?.displayName || friend?.username || friend?.uid || friend?.id || '').trim())
    .filter(Boolean);

  const rawFollowers = profileApiRaw?.followers ?? profileApiRaw?.followerUsers ?? profileApiRaw?.followersList;
  const rawFollowing = profileApiRaw?.following ?? profileApiRaw?.followingUsers ?? profileApiRaw?.followingList;
  const rawConnections = profileApiRaw?.connections ?? profileApiRaw?.connectionUsers ?? profileApiRaw?.connectionsList;

  const followersList = toProfileNameList(rawFollowers, knownNames).length
    ? toProfileNameList(rawFollowers, knownNames)
    : fallbackFollowers;
  const followingList = toProfileNameList(rawFollowing, knownNames).length
    ? toProfileNameList(rawFollowing, knownNames)
    : fallbackFollowing;
  const connectionsList = toProfileNameList(rawConnections, knownNames).length
    ? toProfileNameList(rawConnections, knownNames)
    : fallbackConnections;

  const followersCount = resolveSocialCount(profileApiRaw?.followersCount ?? profileApiRaw?.followerCount, rawFollowers, followersList.length);
  const followingCount = resolveSocialCount(profileApiRaw?.followingCount, rawFollowing, followingList.length);
  const connectionsCount = resolveSocialCount(profileApiRaw?.connectionsCount ?? profileApiRaw?.connectionCount, rawConnections, connectionsList.length);

  return {
    followersList,
    followingList,
    connectionsList,
    followersCount,
    followingCount,
    connectionsCount
  };
}

function formatHandle(value = '', fallback = 'coverse') {
  const raw = String(value || '').trim();
  const clean = raw.replace(/^@+/, '').trim() || String(fallback || 'coverse').replace(/^@+/, '').trim() || 'coverse';
  return `${String.fromCharCode(64)}${clean}`;
}

function resolveUserHandle(profile = {}) {
  const emailPrefix = String(currentUser?.email || '').includes('@')
    ? String(currentUser.email).split('@')[0]
    : '';

  const candidates = [
    profile.username,
    profile.handle,
    profile.userName,
    currentUser?.username,
    currentUser?.handle,
    profile.displayName,
    currentUser?.displayName,
    emailPrefix
  ];

  const picked = candidates
    .map((entry) => String(entry || '').trim())
    .find(Boolean) || 'coverse';

  return picked.replace(/^@+/, '').trim() || 'coverse';
}

function isSimpleProfileOwner(targetUid = '') {
  const normalizedTarget = String(targetUid || '').trim();
  const ownUid = String(currentUser?.uid || '').trim();
  return Boolean(normalizedTarget && ownUid && normalizedTarget === ownUid);
}

function setSimpleProfileTab(tab) {
  const requested = String(tab || '').trim().toLowerCase() || 'posts';
  const nextTab = requested === 'library' ? 'projects' : requested;
  currentSimpleProfileTab = nextTab;

  document.querySelectorAll('#simpleProfileTabs .simple-profile-tab').forEach((button) => {
    const tabName = button.dataset.tab || '';
    button.classList.toggle('active', tabName === nextTab);
  });

  document.querySelectorAll('#profileSimpleView .simple-profile-panel').forEach((panel) => {
    const tabName = panel.dataset.tab || '';
    panel.classList.toggle('hidden', tabName !== nextTab);
  });
}

async function loadAndRenderDiscoverUsers() {
  if (discoverDataLoading) return;
  discoverDataLoading = true;

  const container = document.getElementById('discoverUsersGrid');
  if (container) {
    container.innerHTML = '<div class="simple-profile-post-empty">Loading...</div>';
  }

  const result = await loadDiscoverUsers(30);
  discoverDataLoading = false;

  if (result.error === 'auth') {
    if (container) {
      container.innerHTML = '<div class="simple-profile-post-empty">Authentication required</div>';
    }
    return;
  }

  simpleProfileDiscoverCache = result.users || [];
  renderDiscoverUsers(simpleProfileDiscoverCache);
}

async function loadAndRenderMarketplaceItems(type = 'all') {
  const nextFilter = normalizeMarketplaceFilterType(type, 'all');

  if (simpleProfileMarketplaceCache.length && !marketplaceDataLoading) {
    setupMarketplaceGenreOptions(simpleProfileMarketplaceCache);
    filterContent(nextFilter);
    return;
  }

  if (marketplaceDataLoading) {
    marketplaceFilterType = nextFilter;
    return;
  }

  marketplaceDataLoading = true;
  const container = document.getElementById('marketplaceItemsGrid');
  if (container) {
    container.innerHTML = '<div class="simple-profile-post-empty">Loading...</div>';
  }

  const result = await loadMarketplaceItems('all', 120);
  marketplaceDataLoading = false;

  if (result.error === 'auth') {
    if (container) {
      container.innerHTML = '<div class="simple-profile-post-empty">Authentication required</div>';
    }
    return;
  }

  simpleProfileMarketplaceCache = (result.items || []).map((item, index) => normalizeMarketplaceItem(item, index));
  setupMarketplaceGenreOptions(simpleProfileMarketplaceCache);
  filterContent(nextFilter);
}

function setChipActiveState(button, isActive, { marketplace = false } = {}) {
  if (!button) return;

  button.classList.toggle('active', Boolean(isActive));
  button.classList.toggle('bg-accent-neon', Boolean(isActive));
  button.classList.toggle('text-slate-900', Boolean(isActive));

  if (marketplace) {
    button.classList.toggle('bg-slate-700', !isActive);
    button.classList.toggle('text-gray-300', !isActive);
    return;
  }

  button.classList.remove('bg-slate-700');
  button.classList.toggle('text-gray-300', !isActive);
  button.classList.toggle('hover:text-white', !isActive);
  button.classList.toggle('hover:bg-slate-700', !isActive);
}

function getMarketplaceSubfilters() {
  return {
    genre: String(document.getElementById('marketplaceSubfilterGenre')?.value || '').trim(),
    bpm: String(document.getElementById('marketplaceSubfilterBpm')?.value || '').trim(),
    key: String(document.getElementById('marketplaceSubfilterKey')?.value || '').trim(),
    packType: String(document.getElementById('marketplaceSubfilterPackType')?.value || '').trim(),
    price: String(document.getElementById('marketplaceSubfilterPrice')?.value || '').trim(),
    tags: String(document.getElementById('marketplaceSubfilterTags')?.value || '').trim()
  };
}

function renderMarketplaceSubfilters(filterType = 'all') {
  const normalizedFilter = normalizeMarketplaceFilterType(filterType, 'all');
  const panel = document.getElementById('marketplaceSubfiltersPanel');
  if (!panel) return;

  const showPanel = normalizedFilter !== 'all' && Boolean(MARKETPLACE_SUBFILTER_HINT_MAP[normalizedFilter]);
  panel.classList.toggle('hidden', !showPanel);
  if (!showPanel) {
    closeMarketTagsPanel();
    return;
  }

  const showGenreSet = new Set(['instrumentals', 'samples', 'songs', 'loops', 'vocals']);
  const showGenre = showGenreSet.has(normalizedFilter);
  const showPackType = normalizedFilter === 'sample-packs';
  const showPriceAndTags = normalizedFilter !== 'all';

  const genreGroup = document.getElementById('marketplaceSubfilterGenreGroup');
  const bpmGroup = document.getElementById('marketplaceSubfilterBpmGroup');
  const keyGroup = document.getElementById('marketplaceSubfilterKeyGroup');
  const packTypeGroup = document.getElementById('marketplaceSubfilterPackTypeGroup');
  const priceGroup = document.getElementById('marketplaceSubfilterPriceGroup');
  const tagsGroup = document.getElementById('marketplaceSubfilterTagsGroup');
  const hint = document.getElementById('marketplaceSubfilterHint');

  genreGroup?.classList.toggle('hidden', !showGenre);
  bpmGroup?.classList.toggle('hidden', !showGenre);
  keyGroup?.classList.toggle('hidden', !showGenre);
  packTypeGroup?.classList.toggle('hidden', !showPackType);
  priceGroup?.classList.toggle('hidden', !showPriceAndTags);
  tagsGroup?.classList.toggle('hidden', !showPriceAndTags);

  if (hint) {
    hint.textContent = MARKETPLACE_SUBFILTER_HINT_MAP[normalizedFilter] || 'Refine your marketplace results with subfilters.';
  }

  const currentTagInput = String(document.getElementById('marketplaceSubfilterTags')?.value || '').trim();
  renderMarketplaceTagSuggestions(currentTagInput);
}

function openMarketTagsPanel() {
  const panel = document.getElementById('marketplaceTagSuggestions');
  const toggle = document.getElementById('btnMarketTagsToggle');
  if (!panel) return;
  panel.classList.remove('hidden');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function closeMarketTagsPanel() {
  const panel = document.getElementById('marketplaceTagSuggestions');
  const toggle = document.getElementById('btnMarketTagsToggle');
  if (!panel) return;
  panel.classList.add('hidden');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleMarketTagsExpanded() {
  const panel = document.getElementById('marketplaceTagSuggestions');
  if (!panel) return;
  if (panel.classList.contains('hidden')) {
    openMarketTagsPanel();
  } else {
    closeMarketTagsPanel();
  }
}

function renderMarketplaceTagSuggestions(filterValue = '') {
  const panel = document.getElementById('marketplaceTagSuggestions');
  const tagsInput = document.getElementById('marketplaceSubfilterTags');
  if (!panel || !tagsInput) return;

  const selectedTags = new Set(parseTagTerms(tagsInput.value || ''));
  const query = String(filterValue || '').trim().toLowerCase();

  const suggestions = TAG_SUGGESTIONS
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .filter((tag) => !selectedTags.has(tag.toLowerCase()))
    .filter((tag) => !query || tag.toLowerCase().includes(query))
    .slice(0, 24);

  if (!suggestions.length) {
    panel.innerHTML = '<span class="marketplace-tag-suggestion" aria-disabled="true">No tag suggestions</span>';
    return;
  }

  panel.innerHTML = suggestions
    .map((tag) => `<button class="marketplace-tag-suggestion" data-tag="${escapeHtml(tag)}" type="button">${escapeHtml(tag)}</button>`)
    .join('');
}

function applyMarketplaceTagSuggestion(tag) {
  const tagsInput = document.getElementById('marketplaceSubfilterTags');
  if (!tagsInput) return;

  const tagValue = String(tag || '').trim().toLowerCase();
  if (!tagValue) return;

  const selected = parseTagTerms(tagsInput.value || '');
  if (!selected.includes(tagValue)) {
    selected.push(tagValue);
  }

  tagsInput.value = selected.join(', ');
  renderMarketplaceTagSuggestions('');
  updatePhotoGallery(marketplaceFilterType);
}

function setupMarketplaceTagSuggestions() {
  if (marketplaceTagSuggestionsInitialized) return;
  marketplaceTagSuggestionsInitialized = true;

  const tagsInput = document.getElementById('marketplaceSubfilterTags');
  const toggle = document.getElementById('btnMarketTagsToggle');
  const panel = document.getElementById('marketplaceTagSuggestions');
  if (!tagsInput || !panel) return;

  const updateSuggestionsFromInput = () => {
    const tokens = String(tagsInput.value || '').split(/[\s,#]+/).filter(Boolean);
    const latestToken = tokens.length ? tokens[tokens.length - 1] : '';
    renderMarketplaceTagSuggestions(latestToken);
  };

  tagsInput.addEventListener('focus', () => {
    updateSuggestionsFromInput();
    openMarketTagsPanel();
  });

  tagsInput.addEventListener('input', () => {
    updateSuggestionsFromInput();
    openMarketTagsPanel();
    updatePhotoGallery(marketplaceFilterType);
  });

  tagsInput.addEventListener('blur', () => {
    window.setTimeout(() => {
      const focused = document.activeElement;
      if (focused && panel.contains(focused)) return;
      closeMarketTagsPanel();
    }, 120);
  });

  toggle?.addEventListener('click', () => {
    renderMarketplaceTagSuggestions(String(tagsInput.value || '').trim());
    toggleMarketTagsExpanded();
  });

  panel.addEventListener('click', (event) => {
    const suggestion = event.target?.closest?.('.marketplace-tag-suggestion[data-tag]');
    if (!suggestion) return;
    applyMarketplaceTagSuggestion(suggestion.dataset.tag || '');
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target) return;
    if (target.closest('#marketplaceSubfilterTags') || target.closest('#marketplaceTagSuggestions') || target.closest('#btnMarketTagsToggle')) {
      return;
    }
    closeMarketTagsPanel();
  });
}

function setupMarketplaceGenreOptions(items = simpleProfileMarketplaceCache) {
  const genreSelect = document.getElementById('marketplaceSubfilterGenre');
  if (!genreSelect) return;

  const previousValue = String(genreSelect.value || '').trim();

  const genreSet = new Set();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const genre = String(item?.genre || '').trim();
    if (!genre) return;
    genreSet.add(genre);
  });

  const sortedGenres = Array.from(genreSet).sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }));
  genreSelect.innerHTML = '<option value="">All genres</option>';

  sortedGenres.forEach((genre) => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    genreSelect.appendChild(option);
  });

  if (previousValue && sortedGenres.includes(previousValue)) {
    genreSelect.value = previousValue;
  }
}

function updatePhotoGallery(filterType = marketplaceFilterType) {
  const normalizedFilter = normalizeMarketplaceFilterType(filterType, 'all');
  marketplaceFilterType = normalizedFilter;

  const activeSubfilters = getMarketplaceSubfilters();
  const filteredItems = filterMarketplaceItemsByRules(simpleProfileMarketplaceCache, normalizedFilter, activeSubfilters);
  renderMarketplaceItems(filteredItems);
}

function resetMarketplaceSubfilters(skipApply = false) {
  const genre = document.getElementById('marketplaceSubfilterGenre');
  const bpm = document.getElementById('marketplaceSubfilterBpm');
  const key = document.getElementById('marketplaceSubfilterKey');
  const packType = document.getElementById('marketplaceSubfilterPackType');
  const price = document.getElementById('marketplaceSubfilterPrice');
  const tags = document.getElementById('marketplaceSubfilterTags');

  if (genre) genre.value = '';
  if (bpm) bpm.value = '';
  if (key) key.value = '';
  if (packType) packType.value = '';
  if (price) price.value = '';
  if (tags) tags.value = '';

  renderMarketplaceTagSuggestions('');
  if (!skipApply) {
    updatePhotoGallery(marketplaceFilterType);
  }
}

function filterContent(filterType = 'all') {
  const nextFilter = normalizeMarketplaceFilterType(filterType, 'all');
  const hasChanged = nextFilter !== marketplaceFilterType;
  marketplaceFilterType = nextFilter;

  document.querySelectorAll('.marketplace-filter[data-type]').forEach((button) => {
    const chipType = normalizeMarketplaceFilterType(button.dataset.type || 'all', 'all');
    setChipActiveState(button, chipType === marketplaceFilterType, { marketplace: true });
  });

  if (hasChanged) {
    resetMarketplaceSubfilters(true);
  }

  renderMarketplaceSubfilters(marketplaceFilterType);
  updatePhotoGallery(marketplaceFilterType);
}

function setupFeedFilteringListeners() {
  const activeFilter = getActiveFeedFilter('', currentHomeFeedFilter, { root: document });
  currentHomeFeedFilter = normalizeFeedFilterType(activeFilter, 'all');
  updateHomeFeedFilterButtons();
}

function setupMarketplaceSubfilterListeners() {
  if (marketplaceSubfiltersInitialized) return;
  marketplaceSubfiltersInitialized = true;

  const listenIds = [
    'marketplaceSubfilterGenre',
    'marketplaceSubfilterBpm',
    'marketplaceSubfilterKey',
    'marketplaceSubfilterPackType',
    'marketplaceSubfilterPrice'
  ];

  listenIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    const eventName = element.tagName === 'SELECT' ? 'change' : 'input';
    element.addEventListener(eventName, () => updatePhotoGallery(marketplaceFilterType));
  });

  document.getElementById('btnResetMarketplaceSubfilters')?.addEventListener('click', () => {
    resetMarketplaceSubfilters(false);
  });

  setupMarketplaceTagSuggestions();
}

function setHomeFeedStatus(message = '', level = 'info') {
  const status = document.getElementById('homeFeedStatus');
  if (!status) return;
  const text = String(message || '').trim();
  status.textContent = text;
  status.dataset.level = level;
  status.classList.toggle('hidden', !text);
}

function updateHomeFeedFilterButtons() {
  document.querySelectorAll('.home-feed-filter[data-filter]').forEach((button) => {
    const chipFilter = normalizeFeedFilterType(button.dataset.filter || 'all', 'all');
    setChipActiveState(button, chipFilter === currentHomeFeedFilter, { marketplace: false });
  });
}

function filterFeed(filterType = '') {
  const selectedFilter = normalizeFeedFilterType(filterType || getActiveFeedFilter('', currentHomeFeedFilter, { root: document }), 'all');
  currentHomeFeedFilter = selectedFilter;
  updateHomeFeedFilterButtons();

  const allowedTypes = new Set(getFeedFilterAllowedTypes(currentHomeFeedFilter));
  let visibleCount = 0;

  document.querySelectorAll('#homeFeedGrid .feed-post[data-type]').forEach((card) => {
    const cardType = normalizeFeedType(card.dataset.type || 'sample');
    const isVisible = currentHomeFeedFilter === 'all' || allowedTypes.has(cardType);
    card.classList.toggle('hidden', !isVisible);
    if (isVisible) visibleCount += 1;
  });

  return visibleCount;
}

function setHomeFeedFilter(filter = 'all', { render = true } = {}) {
  currentHomeFeedFilter = normalizeFeedFilterType(filter, 'all');
  if (render) {
    renderHomeFeed();
    return;
  }
  filterFeed(currentHomeFeedFilter);
}

function addHomeFeedIdentity(targetSet, value) {
  if (!(targetSet instanceof Set)) return;
  const key = normalizeFeedIdentity(value);
  if (!key) return;
  targetSet.add(key);
}

function addIdentityVariants(targetSet, value) {
  addHomeFeedIdentity(targetSet, value);
  const text = String(value || '').trim();
  if (!text) return;

  if (text.startsWith('site_')) addHomeFeedIdentity(targetSet, text.slice(5));
  if (text.startsWith('purchase_post_')) addHomeFeedIdentity(targetSet, text.slice('purchase_post_'.length));
  if (text.startsWith('purchase_')) addHomeFeedIdentity(targetSet, text.slice('purchase_'.length));
  if (text.startsWith('marketplace_')) addHomeFeedIdentity(targetSet, text.slice('marketplace_'.length));
  if (text.startsWith('homefeed_')) addHomeFeedIdentity(targetSet, text.slice('homefeed_'.length));
}

function collectHomeFeedIdsFromObject(value, targetSet, visited = new Set()) {
  if (!value || !(targetSet instanceof Set)) return;
  if (typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => collectHomeFeedIdsFromObject(entry, targetSet, visited));
    return;
  }

  [
    value.id,
    value.postId,
    value.itemId,
    value.purchaseId,
    value.sourceId,
    value.siteId,
    value.fileId,
    value.marketplaceId,
    value.slug
  ].forEach((idValue) => addIdentityVariants(targetSet, idValue));

  Object.values(value).forEach((entry) => {
    if (entry && typeof entry === 'object') {
      collectHomeFeedIdsFromObject(entry, targetSet, visited);
    }
  });
}

function normalizeEndpointList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function parseBooleanLike(value, fallback = null) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', ''].includes(normalized)) return false;
  }
  return fallback;
}

function resolveHomeFeedEndpointMap(payload = {}) {
  const roots = [
    payload,
    payload?.data,
    payload?.config,
    payload?.endpoints,
    payload?.data?.endpoints,
    payload?.api,
    payload?.api?.endpoints
  ].filter((entry) => entry && typeof entry === 'object');

  const firstList = (...keys) => {
    for (const root of roots) {
      for (const key of keys) {
        const list = normalizeEndpointList(root?.[key]);
        if (list.length) return list;
      }
    }
    return [];
  };

  const firstBoolean = (...keys) => {
    for (const root of roots) {
      for (const key of keys) {
        const parsed = parseBooleanLike(root?.[key], null);
        if (parsed !== null) return parsed;
      }
    }
    return null;
  };

  return {
    marketplace: firstList('marketplaceFeed', 'marketplaceEndpoints', 'marketplace', 'feedMarketplace', 'feedItems'),
    profilePosts: firstList('feedProfilePosts', 'profilePosts', 'profilePostEndpoints', 'feedPosts'),
    includeProfilePosts: firstBoolean('includeProfilePosts', 'mergeProfilePosts', 'includePosts')
  };
}

async function loadHomeFeedEndpointMap() {
  if (homeFeedEndpointMapLoaded) {
    return homeFeedEndpointMap || {};
  }

  homeFeedEndpointMapLoaded = true;
  homeFeedEndpointMap = {};

  try {
    const apiBase = getSiteApiBase();
    const auth = await getProfilePostsAuthContext();
    const headers = { Accept: 'application/json' };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

    const bootstrapEndpoints = [
      '/api/feed/bootstrap',
      '/api/home/bootstrap',
      '/api/bootstrap',
      '/api/config/endpoints'
    ];

    for (const endpoint of bootstrapEndpoints) {
      try {
        const response = await fetch(`${apiBase}${endpoint}`, {
          method: 'GET',
          headers
        });

        if (response.status === 404) continue;
        if (!response.ok) continue;

        const payload = await response.json().catch(() => ({}));
        const resolved = resolveHomeFeedEndpointMap(payload);
        if (resolved.marketplace.length || resolved.profilePosts.length || resolved.includeProfilePosts !== null) {
          homeFeedEndpointMap = resolved;
          return homeFeedEndpointMap;
        }
      } catch (_error) {
        // try next endpoint
      }
    }
  } catch (_error) {
    // fallback map below
  }

  return homeFeedEndpointMap;
}

function resolveHomeFeedMarketplaceEndpoints() {
  const configured = normalizeEndpointList(homeFeedEndpointMap?.marketplace);
  if (configured.length) return configured;
  return ['/api/marketplace', '/api/marketplace/items'];
}

function resolveHomeFeedProfileEndpoints() {
  const configured = normalizeEndpointList(homeFeedEndpointMap?.profilePosts);
  if (configured.length) return configured;
  return [];
}

function mapProfilePostToHomeFeedItem(post = {}, index = 0) {
  const normalized = normalizeProfilePostItem(post || {});
  const fallbackId = `profile_feed_${index}`;
  const id = String(normalized.id || post.postId || post.id || fallbackId).trim();
  const postId = String(post.postId || normalized.id || id).trim();
  const type = normalizeFeedType(post.sampleType || post.type || normalized.sampleType || normalized.type || 'sample');
  const createdAt = normalized.createdAt || post.createdAt || post.timestamp || post.created_at || null;
  const numericPrice = Number(post.price ?? normalized.price ?? 0);
  const isFree = Boolean(post.isFree || normalized.isFree || numericPrice === 0);
  const streamOnly = Boolean(post.streamOnly || normalized.streamOnly);

  return {
    id,
    postId,
    sourceId: String(post.sourceId || post.id || post.postId || '').trim(),
    title: String(normalized.title || post.title || post.name || 'Untitled').trim(),
    description: String(post.description || post.caption || '').trim(),
    normalizedType: type,
    type,
    rawType: String(post.sampleType || post.type || normalized.sampleType || '').trim(),
    displayType: getDisplayTypeLabel(type),
    image: String(normalized.thumbnailURL || post.coverImageUrl || post.thumbnailUrl || post.imageUrl || '').trim(),
    userName: String(post.userName || post.ownerName || post.author || post.creatorName || currentUser?.displayName || 'Unknown').trim(),
    userAvatar: String(post.userAvatar || post.avatarUrl || post.photoURL || '').trim(),
    genre: String(post.genre || normalized.genre || '').trim(),
    bpm: Number(post.bpm || normalized.bpm || 0),
    key: String(post.key || normalized.key || '').trim(),
    tags: Array.isArray(post.tags) ? post.tags : [],
    price: Number.isFinite(numericPrice) ? numericPrice : 0,
    priceValue: Number.isFinite(numericPrice) ? numericPrice : 0,
    priceLabel: streamOnly
      ? 'Stream Only'
      : (isFree
        ? 'Free'
        : (Number.isFinite(numericPrice) && numericPrice > 0 ? `$${numericPrice.toFixed(2)}` : getFeedPriceLabel(post))),
    hasPriceValue: Number.isFinite(numericPrice),
    isFree,
    streamOnly,
    audioUrl: String(normalized.audioUrl || post.audioUrl || post.downloadURL || post.fileUrl || '').trim(),
    downloadURL: String(normalized.downloadURL || post.downloadURL || post.fileUrl || '').trim(),
    fileUrl: String(post.fileUrl || normalized.downloadURL || normalized.audioUrl || '').trim(),
    storagePath: String(normalized.storagePath || post.storagePath || post.filePath || '').trim(),
    sellerId: String(post.sellerId || post.userId || post.ownerUid || post.uid || '').trim(),
    license: post.license || null,
    licenseTiers: Array.isArray(post.licenseTiers) ? post.licenseTiers : [],
    hasPreview: Boolean(normalized.audioUrl || normalized.downloadURL || normalized.storagePath || post.audioUrl || post.downloadURL),
    source: 'profile',
    sourceKind: 'profile',
    createdAt,
    timestampMs: getFeedTimestampMs(createdAt),
    rawPost: post,
    rawItem: post,
    identityKeys: [id, postId, post.sourceId, post.id, post.postId]
      .map((value) => normalizeFeedIdentity(value))
      .filter(Boolean)
  };
}

async function fetchHomeFeedMarketplaceItems(limit = 120) {
  const apiBase = getSiteApiBase();
  const auth = await getProfilePostsAuthContext();
  const headers = { Accept: 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const endpoints = resolveHomeFeedMarketplaceEndpoints();
  for (const endpoint of endpoints) {
    const params = new URLSearchParams();
    params.set('type', 'all');
    params.set('limit', String(limit));

    try {
      const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) continue;
      if (!response.ok) {
        if (response.status === 401) {
          return { items: [], error: 'auth' };
        }
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const rawItems = extractMarketplaceItemsArray(payload);
      const mapped = rawItems.map((item, index) => mapMarketplaceItemToFeedItem(item, index));
      return { items: mapped, error: '' };
    } catch (_error) {
      // try next endpoint
    }
  }

  return { items: [], error: '' };
}

async function fetchHomeFeedProfileItems(limit = 60) {
  const collected = [];
  (simpleProfilePostsCache || []).forEach((post, index) => {
    if (!post || post.isDeleted) return;
    collected.push(mapProfilePostToHomeFeedItem(post, index));
  });

  const includeProfilePosts = homeFeedEndpointMap?.includeProfilePosts;
  if (includeProfilePosts === false) {
    return { items: dedupeAndSortFeedItems(collected), error: '' };
  }

  const endpoints = resolveHomeFeedProfileEndpoints();
  if (!endpoints.length) {
    return { items: dedupeAndSortFeedItems(collected), error: '' };
  }

  const apiBase = getSiteApiBase();
  const auth = await getProfilePostsAuthContext();
  const headers = { Accept: 'application/json' };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  for (const endpoint of endpoints) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (currentUser?.uid) {
      params.set('uid', String(currentUser.uid));
      params.set('userId', String(currentUser.uid));
      params.set('targetUid', String(currentUser.uid));
    }

    try {
      const response = await fetch(`${apiBase}${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) continue;
      if (!response.ok) {
        if (response.status === 401) {
          return { items: dedupeAndSortFeedItems(collected), error: 'auth' };
        }
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const rawPosts = extractProfilePostsArray(payload);
      rawPosts.forEach((post, index) => {
        if (!post || post.isDeleted) return;
        collected.push(mapProfilePostToHomeFeedItem(post, index + collected.length));
      });
      break;
    } catch (_error) {
      // try next endpoint
    }
  }

  return { items: dedupeAndSortFeedItems(collected), error: '' };
}

async function buildHomeFeedOwnershipState() {
  const ownedIds = new Set();
  const cartIds = new Set();

  (cartItems || []).forEach((item) => {
    addIdentityVariants(cartIds, item?.id);
    addIdentityVariants(cartIds, item?.metadata?.postId);
    addIdentityVariants(cartIds, item?.metadata?.sourceId);
  });

  (purchaseSyncEntries || []).forEach((entry) => {
    addIdentityVariants(ownedIds, entry?.id);
    addIdentityVariants(ownedIds, entry?.postId);
    addIdentityVariants(ownedIds, entry?.purchaseId);
    addIdentityVariants(ownedIds, entry?.itemId);
  });

  getSimpleProfilePurchasePosts().forEach((post) => {
    addIdentityVariants(ownedIds, post?.id);
    addIdentityVariants(ownedIds, post?.postId);
    addIdentityVariants(ownedIds, post?.purchaseId);
    addIdentityVariants(ownedIds, post?.sourceId);
  });

  (userLibrary || []).forEach((entry) => {
    if (!(entry?.isPurchased || entry?.purchased || entry?.purchaseId || String(entry?.source || '').toLowerCase().includes('purchase'))) {
      return;
    }
    addIdentityVariants(ownedIds, entry?.id);
    addIdentityVariants(ownedIds, entry?.postId);
    addIdentityVariants(ownedIds, entry?.purchaseId);
    addIdentityVariants(ownedIds, entry?.sourceId);
    addIdentityVariants(ownedIds, entry?.siteId);
  });

  try {
    const apiBase = getSiteApiBase();
    const auth = await getProfilePostsAuthContext();
    const headers = { Accept: 'application/json' };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

    const payloads = [];
    for (const endpoint of ['/api/profile/aggregate', '/api/getUserPurchases', '/api/getLibrary']) {
      try {
        const response = await fetch(`${apiBase}${endpoint}`, {
          method: 'GET',
          headers
        });

        if (response.status === 404) continue;
        if (!response.ok) continue;

        const payload = await response.json().catch(() => ({}));
        payloads.push({ sourcePath: endpoint, payload });
        collectHomeFeedIdsFromObject(payload, ownedIds);
      } catch (_error) {
        // try next endpoint
      }
    }

    if (payloads.length) {
      const mergedPurchases = mergePurchaseEntries(payloads, currentUser?.uid || '');
      (mergedPurchases || []).forEach((entry) => {
        addIdentityVariants(ownedIds, entry?.id);
        addIdentityVariants(ownedIds, entry?.postId);
        addIdentityVariants(ownedIds, entry?.purchaseId);
        addIdentityVariants(ownedIds, entry?.itemId);
      });
    }
  } catch (_error) {
    // fallback to local ownership state
  }

  return {
    ownedIds,
    cartIds,
    currentUserId: normalizeFeedIdentity(currentUser?.uid || '')
  };
}

function getHomeFeedRenderableItems() {
  const source = Array.isArray(homeFeedItemsCache) ? homeFeedItemsCache.slice() : [];
  homeFeedItemMap = new Map();

  source.forEach((item) => {
    const id = String(item?.id || item?.postId || '').trim();
    if (!id) return;
    homeFeedItemMap.set(id, item);
  });

  return source;
}

function renderHomeFeedItems(items = []) {
  const container = document.getElementById('homeFeedGrid');
  if (!container) return;

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = '<div class="simple-profile-post-empty">No feed items available</div>';
    return;
  }

  container.innerHTML = items.slice(0, 120).map((item, index) => {
    const id = escapeHtml(String(item.id || item.postId || `feed_${index}`));
    const title = escapeHtml(item.title || 'Untitled');
    const description = escapeHtml(String(item.description || '').substring(0, 88));
    const normalizedType = normalizeFeedType(item.normalizedType || item.type || item.rawType || 'sample');
    const typeLabel = escapeHtml(item.displayType || getDisplayTypeLabel(normalizedType));
    const image = normalizeProfileMediaUrl(item.image || '');
    const userName = escapeHtml(item.userName || 'Unknown');
    const userAvatar = normalizeProfileMediaUrl(item.userAvatar || '');
    const genre = escapeHtml(item.genre || '');
    const bpm = Number(item.bpm || 0) > 0 ? `${Number(item.bpm)} BPM` : '';
    const key = escapeHtml(item.key || '');
    const metaText = [genre, bpm, key].filter(Boolean).join(' • ');
    const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3) : [];
    const actionState = deriveActionState(item, homeFeedOwnershipState || {});
    const actionLabel = escapeHtml(actionState.label || 'Add to cart');
    const actionAttr = actionState.disabled ? 'disabled aria-disabled="true"' : '';
    const actionClass = actionState.muted ? ' is-muted' : '';
    const previewAttr = actionState.canPreview ? '' : 'disabled aria-disabled="true"';
    const priceLabel = escapeHtml(item.priceLabel || getFeedPriceLabel(item) || 'Price unavailable');

    return `
      <div class="home-feed-item-card feed-post" data-feed-id="${id}" data-type="${escapeHtml(normalizedType)}">
        <div class="home-feed-item-image">
          ${image ? `<img src="${image}" alt="${title}">` : '<div class="home-feed-item-placeholder"></div>'}
          <div class="home-feed-item-type-badge">${typeLabel}</div>
        </div>
        <div class="home-feed-item-content">
          <div class="home-feed-item-title">${title}</div>
          ${description ? `<div class="home-feed-item-description">${description}</div>` : ''}
          <div class="home-feed-item-creator">
            ${userAvatar ? `<img src="${userAvatar}" alt="${userName}" class="home-feed-creator-avatar">` : ''}
            <span class="home-feed-creator-name">${userName}</span>
          </div>
          ${metaText ? `<div class="home-feed-item-meta">${metaText}</div>` : ''}
          ${tags.length ? `<div class="home-feed-item-tags">${tags.map((tag) => `<span class="home-feed-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          <div class="home-feed-item-footer">
            <span class="home-feed-item-price">${priceLabel}</span>
            <div class="home-feed-item-actions">
              <button class="home-feed-preview-btn" data-feed-id="${id}" type="button" ${previewAttr}>Play</button>
              <button class="home-feed-action-btn${actionClass}" data-feed-id="${id}" data-action="${escapeHtml(actionState.action || 'buy')}" type="button" ${actionAttr}>${actionLabel}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHomeFeed() {
  renderHomeFeedItems(getHomeFeedRenderableItems());
  filterFeed(currentHomeFeedFilter);
}

async function refreshHomeFeedView({ force = false } = {}) {
  if (homeFeedLoading) return;

  if (!currentUser?.uid) {
    setHomeFeedStatus('Authentication required', 'error');
    renderHomeFeedItems([]);
    return;
  }

  if (force || !homeFeedItemsCache.length) {
    homeFeedLoading = true;
    setHomeFeedStatus('Loading feed...', 'info');

    try {
      await loadHomeFeedEndpointMap();

      const marketplaceResult = await fetchHomeFeedMarketplaceItems(120);
      if (marketplaceResult.error === 'auth') {
        setHomeFeedStatus('Authentication required', 'error');
        homeFeedItemsCache = [];
        renderHomeFeedItems([]);
        homeFeedLoading = false;
        return;
      }

      const profileResult = await fetchHomeFeedProfileItems(60);
      if (profileResult.error === 'auth') {
        setHomeFeedStatus('Authentication required', 'error');
      }

      const merged = dedupeAndSortFeedItems([
        ...(marketplaceResult.items || []),
        ...(profileResult.items || [])
      ]);

      homeFeedItemsCache = merged;
      if (!merged.length) {
        setHomeFeedStatus('No feed items available right now.', 'info');
      } else {
        setHomeFeedStatus('', 'info');
      }
    } catch (error) {
      console.error('[Home Feed] Failed to refresh feed:', error);
      setHomeFeedStatus('Failed to load feed. Please try again.', 'error');
      homeFeedItemsCache = [];
    } finally {
      homeFeedLoading = false;
    }
  }

  homeFeedOwnershipState = await buildHomeFeedOwnershipState();
  renderHomeFeed();
}

function isHomeFeedViewActive() {
  return Boolean(document.getElementById('homeFeedView')?.classList.contains('active'));
}

async function resolveHomeFeedPreviewSource(item = {}) {
  const directCandidates = [
    item.audioUrl,
    item.downloadURL,
    item.fileUrl,
    item.rawItem?.audioUrl,
    item.rawItem?.downloadURL,
    item.rawItem?.fileUrl,
    item.rawMarketplaceItem?.audioUrl,
    item.rawMarketplaceItem?.downloadURL,
    item.rawMarketplaceItem?.fileUrl
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeProfileMediaUrl(candidate || '');
    if (normalized) return normalized;
  }

  if (item.sourceKind === 'profile' && item.rawPost) {
    const resolved = await resolveProfilePostAudioSource(item.rawPost);
    if (resolved) return resolved;
  }

  return '';
}

function homeFeedItemToLibraryFile(item = {}, audioUrl = '') {
  const idSeed = String(item.id || item.postId || Date.now()).trim() || Date.now().toString();
  const normalizedAudio = normalizeProfileMediaUrl(audioUrl || item.audioUrl || item.downloadURL || item.fileUrl || '');
  const inferredMime = inferMimeTypeFromName(item.title || item.name || '');
  const type = normalizeLibraryType(item.type, inferredMime, item.title || item.name || '');

  return {
    id: `homefeed_${idSeed}`,
    sourceId: String(item.id || item.postId || '').trim(),
    postId: String(item.postId || item.id || '').trim(),
    name: item.title || item.name || 'Untitled',
    title: item.title || item.name || 'Untitled',
    size: Number(item.size || 0),
    type: type === 'unknown' || type === 'other' ? 'audio' : type,
    section: 'marketplace',
    uploadedAt: item.createdAt || item.uploadedAt || new Date(),
    mimeType: inferredMime || 'audio/wav',
    downloadURL: normalizedAudio,
    audioUrl: normalizedAudio,
    sourceAudioUrl: normalizedAudio,
    storagePath: String(item.storagePath || '').trim(),
    thumbnailURL: item.image || '',
    isReadOnly: true
  };
}

function ensureHomeFeedPreviewItem(item = {}, audioUrl = '') {
  const file = homeFeedItemToLibraryFile(item, audioUrl);
  if (!file.id) return '';

  const existingIndex = userLibrary.findIndex((entry) => String(entry?.id || '').trim() === file.id);
  if (existingIndex >= 0) {
    userLibrary[existingIndex] = { ...userLibrary[existingIndex], ...file };
  } else {
    userLibrary.push(file);
  }

  return file.id;
}

async function playHomeFeedItem(itemId = '') {
  const normalizedId = String(itemId || '').trim();
  if (!normalizedId) return;

  const item = homeFeedItemMap.get(normalizedId) || homeFeedItemsCache.find((entry) => String(entry?.id || '').trim() === normalizedId);
  if (!item) return;

  if (item.sourceKind === 'marketplace') {
    await previewMarketplaceItem(buildMarketplaceActionItemFromFeed(item));
    return;
  }

  const source = await resolveHomeFeedPreviewSource(item);
  if (!source) {
    showNotification('Track source unavailable right now. Please try again later.');
    return;
  }

  const previewId = ensureHomeFeedPreviewItem(item, source);
  if (!previewId) {
    showNotification('Track source unavailable right now. Please try again later.');
    return;
  }

  await playLibraryItem(previewId);
}

function buildMarketplaceActionItemFromFeed(item = {}) {
  if (item.rawMarketplaceItem) {
    return normalizeMarketplaceItem(item.rawMarketplaceItem);
  }

  return normalizeMarketplaceItem({
    id: item.id,
    postId: item.postId,
    title: item.title,
    description: item.description,
    type: item.rawType || item.type,
    sampleType: item.rawType || item.type,
    image: item.image,
    userName: item.userName,
    userAvatar: item.userAvatar,
    genre: item.genre,
    bpm: item.bpm,
    key: item.key,
    tags: item.tags,
    price: item.priceValue,
    isFree: item.isFree,
    streamOnly: item.streamOnly,
    audioUrl: item.audioUrl,
    downloadURL: item.downloadURL,
    fileUrl: item.fileUrl,
    storagePath: item.storagePath,
    sellerId: item.sellerId,
    license: item.license,
    licenseTiers: item.licenseTiers
  });
}

async function handleHomeFeedItemAction(itemId = '') {
  const normalizedId = String(itemId || '').trim();
  if (!normalizedId) return;

  const item = homeFeedItemMap.get(normalizedId) || homeFeedItemsCache.find((entry) => String(entry?.id || '').trim() === normalizedId);
  if (!item) return;

  const actionState = deriveActionState(item, homeFeedOwnershipState || {});

  switch (actionState.action) {
    case 'stream':
      await playHomeFeedItem(normalizedId);
      break;
    case 'download':
      if (item.sourceKind === 'marketplace') {
        await downloadMarketplaceItem(buildMarketplaceActionItemFromFeed(item));
      } else {
        await playHomeFeedItem(normalizedId);
      }
      break;
    case 'buy': {
      const marketplaceItem = buildMarketplaceActionItemFromFeed(item);
      handleMarketplaceActionWithTier(marketplaceItem, 'primary');
      break;
    }
    case 'owned':
    case 'in-cart':
    case 'self':
      if (actionState.canPreview) {
        await playHomeFeedItem(normalizedId);
      }
      break;
    default:
      if (actionState.canPreview) {
        await playHomeFeedItem(normalizedId);
      }
      break;
  }

  homeFeedOwnershipState.cartIds = new Set(
    (cartItems || [])
      .flatMap((entry) => [entry?.id, entry?.metadata?.postId, entry?.metadata?.sourceId])
      .map((value) => normalizeFeedIdentity(value))
      .filter(Boolean)
  );

  if (isHomeFeedViewActive()) {
    renderHomeFeed();
  }
}

function refreshHomeFeedActionStates() {
  homeFeedOwnershipState.cartIds = new Set(
    (cartItems || [])
      .flatMap((entry) => [entry?.id, entry?.metadata?.postId, entry?.metadata?.sourceId])
      .map((value) => normalizeFeedIdentity(value))
      .filter(Boolean)
  );

  if (isHomeFeedViewActive()) {
    renderHomeFeed();
  }
}

async function handleDiscoverFollow(uid) {
  try {
    const apiBase = getSiteApiBase();
    const auth = await getProfilePostsAuthContext();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

    const response = await fetch(`${apiBase}/api/follow`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetUid: uid })
    });

    if (!response.ok) {
      console.error('Follow failed:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error following user:', error);
    return false;
  }
}

async function handleMarketplaceItemAction(itemId, action = 'primary') {
  const item = simpleProfileMarketplaceCache.find((i) => i.id === itemId);
  if (!item) {
    console.warn('Marketplace item not found:', itemId);
    return;
  }

  handleMarketplaceActionWithTier(item, action);
}

// ============================================
// CART MANAGEMENT
// ============================================

function initCart() {
  initStripeClient().catch((error) => {
    console.error('[Cart] Stripe init failed:', error);
  });

  loadCartFromStorage();

  // Use event delegation on document for better reliability
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'btnCart' || e.target?.closest('#btnCart')) {
      console.log('[Cart] Cart button clicked via delegation');
      loadCartFromStorage();
      updateCartTotal();
      renderCartBadge();
      renderCartItems();
      openModal('cartModal');
    }
    if (e.target?.id === 'btnCloseCart' || e.target?.closest('#btnCloseCart')) {
      console.log('[Cart] Close cart button clicked via delegation');
      closeModal('cartModal');
    }
    if (e.target?.id === 'btnCheckout' || e.target?.closest('#btnCheckout')) {
      console.log('[Cart] Checkout button clicked via delegation');
      initiateCheckout();
    }
  }, { passive: false });

  console.log('[Cart] Initialized with event delegation');
}

async function initStripeClient() {
  if (stripe) return stripe;
  if (typeof Stripe === 'undefined') {
    throw new Error('Stripe.js is not loaded');
  }
  if (!window.stripeBridge?.getPublishableKey) {
    throw new Error('Stripe bridge unavailable');
  }

  const publishableKey = await window.stripeBridge.getPublishableKey();
  if (!publishableKey) {
    throw new Error('Missing publishable key from backend');
  }

  stripe = Stripe(publishableKey);
  return stripe;
}

function addToCart(item, selectedTier = null) {
  if (!item || !item.id) return;

  const licenseTiers = Array.isArray(item.licenseTiers) ? item.licenseTiers : [];
  const price = (selectedTier?.price ?? item.price ?? item.priceValue ?? 0);
  
  if (price <= 0) {
    console.warn('[Cart] Cannot add free/invalid price item to cart');
    return;
  }

  const existingItem = cartItems.find(cartItem => cartItem.id === item.id);

  if (existingItem) {
    existingItem.quantity += 1;
    showNotification(`Increased quantity: ${item.title || 'item'}`);
  } else {
    cartItems.push({
      id: item.id,
      title: item.title || 'Untitled',
      price: Number(price),
      image: item.image || item.coverImage || '',
      type: item.sampleType || item.type || 'item',
      quantity: 1,
      metadata: {
        postId: item.postId,
        userName: item.userName,
        fileUrl: item.fileUrl || item.audioUrl,
        sellerId: item.sellerId || item.userId || '',
        license: selectedTier ? {
          tierId: selectedTier.id || selectedTier.tierId || '',
          tierName: selectedTier.name || selectedTier.tierName || '',
          includes: selectedTier.includes || selectedTier.features || [],
          terms: selectedTier.terms || selectedTier.restrictions || []
        } : (item.license || null)
      }
    });
    showNotification(`Added to cart: ${item.title || 'item'}`);
  }

  updateCartTotal();
  renderCartBadge();
  renderCartItems();
  saveCartToStorage();
  refreshHomeFeedActionStates();
}

function openTierSelectionModal(item) {
  if (!item || !Array.isArray(item.licenseTiers) || item.licenseTiers.length === 0) {
    addToCart(item);
    return;
  }

  if (item.licenseTiers.length === 1) {
    addToCart(item, item.licenseTiers[0]);
    return;
  }

  const tierContainer = document.getElementById('tierSelectionContent');
  const tierModal = document.getElementById('tierSelectionModal');
  if (!tierContainer || !tierModal) {
    console.error('[Marketplace] Tier selection modal/container not found');
    addToCart(item);
    return;
  }

  const itemTitle = escapeHtml(item.title || 'Item');
  tierContainer.innerHTML = `
    <div class="tier-selection-header">
      <h3>Select License for: ${itemTitle}</h3>
      <p class="tier-selection-description">Choose the license tier that suits your needs:</p>
    </div>
    <div class="tier-selection-list">
      ${item.licenseTiers.map((tier, idx) => {
        const tierId = escapeHtml(tier.id || tier.tierId || String(idx));
        const tierName = escapeHtml(tier.name || tier.tierName || `Tier ${idx + 1}`);
        const tierPrice = Number(tier.price ?? tier.amount ?? 0);
        const tierDesc = escapeHtml(tier.description || '');
        const features = Array.isArray(tier.includes || tier.features) 
          ? (tier.includes || tier.features) 
          : [];
        
        return `
          <div class="tier-option" data-tier-id="${tierId}" data-tier-index="${idx}">
            <div class="tier-option-header">
              <div class="tier-option-title">${tierName}</div>
              <div class="tier-option-price">$${tierPrice.toFixed(2)}</div>
            </div>
            ${tierDesc ? `<div class="tier-option-description">${tierDesc}</div>` : ''}
            ${features.length ? `
              <div class="tier-option-features">
                ${features.map((f) => `<div class="tier-feature">✓ ${escapeHtml(String(f || ''))}</div>`).join('')}
              </div>
            ` : ''}
            <button class="tier-option-select" data-tier-id="${tierId}" data-tier-index="${idx}" type="button">
              Select
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Remove old listener if exists
  const oldHandler = tierModal._tierSelectionHandler;
  if (oldHandler) {
    tierModal.removeEventListener('click', oldHandler);
  }

  // Use event delegation on modal for all clicks
  const tierSelectionHandler = (e) => {
    const selectBtn = e.target?.closest?.('.tier-option-select');
    if (selectBtn) {
      e.preventDefault();
      e.stopPropagation();
      const tierIdx = parseInt(selectBtn.dataset.tierIndex || 0);
      const selectedTier = item.licenseTiers[tierIdx];
      if (selectedTier) {
        console.log('[Tier Selection] Selected tier:', selectedTier.name || `Tier ${tierIdx + 1}`);
        closeModal('tierSelectionModal');
        addToCart(item, selectedTier);
      }
      return;
    }

    const cancelBtn = e.target?.closest?.('#btnCancelTierSelection');
    if (cancelBtn) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Tier Selection] Cancelled');
      closeModal('tierSelectionModal');
    }
  };

  tierModal._tierSelectionHandler = tierSelectionHandler;
  tierModal.addEventListener('click', tierSelectionHandler);

  openModal('tierSelectionModal');
}

function handleMarketplaceActionWithTier(item, action) {
  if (!item) return;

  if (action === 'primary') {
    const streamOnly = parseMarketplaceBoolean(item.streamOnly, false);
    const isFree = parseMarketplaceBoolean(item.isFree, false);

    if (streamOnly) {
      previewMarketplaceItem(item);
    } else if (isFree) {
      downloadMarketplaceItem(item);
    } else {
      const licenseTiers = Array.isArray(item.licenseTiers) ? item.licenseTiers : [];
      if (licenseTiers.length > 1) {
        openTierSelectionModal(item);
      } else if (licenseTiers.length === 1) {
        addToCart(item, licenseTiers[0]);
      } else {
        addToCart(item);
      }
    }
  } else if (action === 'preview') {
    previewMarketplaceItem(item);
  }
}

function removeFromCart(itemId) {
  const index = cartItems.findIndex(item => item.id === itemId);
  if (index !== -1) {
    const item = cartItems[index];
    showNotification(`Removed: ${item.title}`);
    cartItems.splice(index, 1);
    updateCartTotal();
    renderCartBadge();
    renderCartItems();
    saveCartToStorage();
    refreshHomeFeedActionStates();
  }
}

function updateCartItemQuantity(itemId, delta) {
  const item = cartItems.find(cartItem => cartItem.id === itemId);
  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    removeFromCart(itemId);
  } else {
    updateCartTotal();
    renderCartItems();
    saveCartToStorage();
    refreshHomeFeedActionStates();
  }
}

function clearCart() {
  cartItems = [];
  cartTotal = 0;
  renderCartBadge();
  renderCartItems();
  saveCartToStorage();
  refreshHomeFeedActionStates();
}

function updateCartTotal() {
  cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function renderCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = String(totalItems);
  badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('btnCheckout');

  if (!container) return;

  if (cartItems.length === 0) {
    container.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
    if (totalEl) totalEl.textContent = '$0.00';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  container.innerHTML = cartItems.map(item => `
    <div class="cart-item" data-id="${escapeHtml(item.id)}">
      <div class="cart-item-image">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : '<div class="cart-item-placeholder"></div>'}
      </div>
      <div class="cart-item-details">
        <div class="cart-item-title">${escapeHtml(item.title)}</div>
        <div class="cart-item-type">${escapeHtml(item.type)}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
      </div>
      <div class="cart-item-quantity">
        <button class="cart-qty-btn" data-id="${escapeHtml(item.id)}" data-delta="-1" type="button">−</button>
        <span>${item.quantity}</span>
        <button class="cart-qty-btn" data-id="${escapeHtml(item.id)}" data-delta="1" type="button">+</button>
      </div>
      <button class="cart-item-remove" data-id="${escapeHtml(item.id)}" type="button" title="Remove">
        <svg viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>
      </button>
    </div>
  `).join('');

  if (totalEl) totalEl.textContent = `$${cartTotal.toFixed(2)}`;
  if (checkoutBtn) checkoutBtn.disabled = false;

  // Add event listeners to quantity buttons
  document.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.id;
      const delta = parseInt(btn.dataset.delta);
      updateCartItemQuantity(itemId, delta);
    });
  });

  // Add event listeners to remove buttons
  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(btn.dataset.id);
    });
  });
}

function saveCartToStorage() {
  try {
    localStorage.setItem('coverse-cart', JSON.stringify(cartItems));
  } catch (e) {
    console.error('[Cart] Failed to save to storage:', e);
  }
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('coverse-cart');
    if (saved) {
      cartItems = JSON.parse(saved);
      updateCartTotal();
      renderCartBadge();
      refreshHomeFeedActionStates();
    }
  } catch (e) {
    console.error('[Cart] Failed to load from storage:', e);
    cartItems = [];
  }
}

async function initiateCheckout() {
  if (!cartItems.length) {
    showNotification('Your cart is empty');
    return;
  }

  if (!currentUser?.uid) {
    showNotification('Please sign in to checkout');
    return;
  }

  // Prevent duplicate checkout clicks
  const checkoutBtn = document.getElementById('btnCheckout');
  if (checkoutBtn?.disabled) {
    console.log('[Checkout] Checkout already in progress');
    return;
  }

  try {
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
    }

    console.log('[Checkout] Raw cart items:', JSON.stringify(cartItems, null, 2));
    
    showNotification('Creating checkout session...');

    const auth = await getProfilePostsAuthContext();
    if (!auth?.token) {
      throw new Error('Authentication failed. Please sign in and try again.');
    }

    const stripeClient = await initStripeClient();
    
    // Validate cart items have required fields
    const validItems = cartItems.filter((item) => {
      const hasId = !!item.id;
      const hasTitle = !!item.title;
      
      if (!hasId || !hasTitle) {
        console.warn('[Checkout] Cart item missing required fields:', { item, hasId, hasTitle });
      }
      return hasId && hasTitle;
    });

    console.log('[Checkout] Cart validation result:', { 
      total: cartItems.length, 
      valid: validItems.length,
      filtered: cartItems.length - validItems.length
    });

    if (validItems.length === 0) {
      throw new Error('No valid items in cart. Cart items must have id and title.');
    }

    const payload = {
      items: validItems.map((item) => {
        const mappedItem = {
          id: String(item.id).trim(),
          itemId: String(item.id).trim(),
          title: String(item.title).trim(),
          itemTitle: String(item.title).trim(),
          price: Number(item.price) || 0,
          type: item.type || 'item',
          itemType: item.type || 'item',
          sellerId: item.metadata?.sellerId || null,
          sellerName: item.metadata?.userName || null,
          quantity: Number(item.quantity) || 1,
          image: item.image || null,
          metadata: {
            postId: item.metadata?.postId || null,
            userName: item.metadata?.userName || null,
            sellerId: item.metadata?.sellerId || null,
            fileUrl: item.metadata?.fileUrl || null,
            license: item.metadata?.license || null
          }
        };
        console.log('[Checkout] Mapped item:', mappedItem);
        return mappedItem;
      }),
      userId: currentUser.uid,
      returnUrl: 'coverse://checkout'
    };

    console.log('[Checkout] Complete payload being sent:', JSON.stringify(payload, null, 2));
    console.log('[Checkout] Initiating session creation with payload:', { itemCount: payload.items.length, userId: payload.userId });

    const authHeaders = await getSiteApiAuthHeaders();
    const headers = {
      ...authHeaders,
      'Content-Type': 'application/json'
    };

    console.log('[Checkout] Request headers:', JSON.stringify(headers, null, 2));

    const response = await fetch(`${getSiteApiBase()}/api/create-checkout-session`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Checkout] Session creation failed:', { status: response.status, error: errorText });
      handleMarketplaceApiError(response, 'create checkout session');
    }

    const data = await response.json();
    const sessionId = data?.sessionId || '';
    const checkoutUrl = String(data?.url || data?.checkoutUrl || '').trim();
    
    if (!sessionId) {
      console.error('[Checkout] No sessionId in response:', data);
      throw new Error('Missing sessionId from checkout session response');
    }

    console.log('[Checkout] Got sessionId:', sessionId);
    if (checkoutUrl && typeof window.coverse?.openExternal === 'function') {
      console.log('[Checkout] Opening external Stripe checkout URL');
      await window.coverse.openExternal(checkoutUrl);
      return;
    }

    console.log('[Checkout] Redirecting to Stripe with sessionId:', sessionId);
    
    const result = await stripeClient.redirectToCheckout({ sessionId });
    console.log('[Checkout] Stripe redirect result:', result);
    
    if (result.error) {
      console.error('[Checkout] Stripe redirect error:', result.error);
      showNotification(result.error.message);
    }
  } catch (error) {
    console.error('[Cart] Checkout error:', error);
    showNotification(String(error.message || 'Failed to start checkout. Please try again.'));
  } finally {
    // Re-enable checkout button
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
    }
  }
}

function handleMarketplaceApiError(response, context = 'API call') {
  if (response.ok) return;

  const status = response.status;
  let errorMessage = `${context} failed`;

  if (status === 401) {
    errorMessage = 'Sign in required. Please log in and try again.';
  } else if (status === 403) {
    errorMessage = 'You do not have permission to perform this action.';
  } else if (status === 400) {
    errorMessage = 'Invalid request. Please check your input and try again.';
  } else if (status === 404) {
    errorMessage = 'Resource not found.';
  } else if (status >= 500) {
    errorMessage = 'Server error. Please try again later.';
  }

  throw new Error(errorMessage);
}

async function confirmMarketplacePayment(sessionId) {
  if (!sessionId) {
    throw new Error('Missing session ID for payment confirmation');
  }

  const auth = await getProfilePostsAuthContext();
  const headers = {
    ...await getSiteApiAuthHeaders(),
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${getSiteApiBase()}/api/confirm-payment`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ sessionId, userId: currentUser.uid })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error('AUTH_ERROR');
    }
    if (response.status === 400) {
      throw new Error(`INVALID_SESSION${errorText ? `: ${errorText}` : ''}`);
    }
    if (response.status >= 500) {
      throw new Error('TRANSIENT_SERVER_ERROR');
    }
    throw new Error(`CONFIRM_PAYMENT_FAILED_${response.status}`);
  }

  const confirmation = await response.json();
  return confirmation;
}

function dismissNotificationToast(toastEl, options = {}) {
  if (!toastEl || toastEl.dataset.closed === '1') return;

  const immediate = options.immediate === true;

  toastEl.dataset.closed = '1';
  const toastId = String(toastEl.dataset.toastId || '').trim();
  const timeoutId = notificationTimers.get(toastId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    notificationTimers.delete(toastId);
  }

  if (immediate) {
    toastEl.remove();
    return;
  }

  toastEl.classList.remove('is-visible');
  toastEl.classList.add('is-leaving');
  setTimeout(() => {
    toastEl.remove();
  }, 180);
}

function updateNotificationUnreadBadge() {
  const badge = document.getElementById('notificationUnreadBadge');
  if (!badge) return;

  const count = Math.max(0, Number(notificationUnreadCount) || 0);
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    badge.textContent = '0';
  }
}

function updatePendingFriendsBadge() {
  const badge = document.getElementById('friendsPendingBadge');
  const button = document.getElementById('btnShowMembers');
  const count = Array.isArray(pendingFriendRequests) ? pendingFriendRequests.length : 0;

  if (badge) {
    if (count > 0 && !currentSession) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
      badge.textContent = '0';
    }
  }

  if (button) {
    const title = currentSession
      ? 'Show Members'
      : (count > 0 ? `Friends (${count} pending)` : 'Friends');
    button.title = title;
    button.setAttribute('aria-label', title);
  }
}

function getNotificationTimeLabel(timestampMs = 0) {
  const date = new Date(Number(timestampMs) || Date.now());
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderNotificationCenter() {
  const listEl = document.getElementById('notificationCenterList');
  if (!listEl) return;

  if (!notificationHistory.length) {
    listEl.innerHTML = '<div class="notification-center-empty">No notifications yet</div>';
    return;
  }

  listEl.innerHTML = notificationHistory.map((entry) => {
    const level = ['info', 'success', 'warning', 'error'].includes(String(entry.level || '').toLowerCase())
      ? String(entry.level || '').toLowerCase()
      : 'info';
    return `
      <div class="notification-center-item notification-center-item--${level}">
        <div class="notification-center-message">${escapeHtml(String(entry.message || ''))}</div>
        <div class="notification-center-time">${escapeHtml(getNotificationTimeLabel(entry.timestampMs))}</div>
      </div>
    `;
  }).join('');
}

function closeNotificationCenter(options = {}) {
  const panel = document.getElementById('notificationCenter');
  const trigger = document.getElementById('btnNotifications');
  panel?.classList.add('hidden');
  trigger?.setAttribute('aria-expanded', 'false');
  if (options.focusTrigger === true) {
    trigger?.focus();
  }
}

function openNotificationCenter() {
  const panel = document.getElementById('notificationCenter');
  const trigger = document.getElementById('btnNotifications');
  if (!panel) return;

  renderNotificationCenter();
  panel.classList.remove('hidden');
  trigger?.setAttribute('aria-expanded', 'true');

  notificationUnreadCount = 0;
  updateNotificationUnreadBadge();
}

function toggleNotificationCenter() {
  const panel = document.getElementById('notificationCenter');
  if (!panel) return;

  if (panel.classList.contains('hidden')) {
    openNotificationCenter();
  } else {
    closeNotificationCenter({ focusTrigger: true });
  }
}

function addNotificationHistoryEntry(message, level = 'info') {
  const text = String(message || '').trim();
  if (!text) return;

  const normalizedLevel = ['info', 'success', 'warning', 'error'].includes(String(level || '').toLowerCase())
    ? String(level || '').toLowerCase()
    : 'info';

  notificationHistory.unshift({
    id: `notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    message: text,
    level: normalizedLevel,
    timestampMs: Date.now()
  });

  if (notificationHistory.length > NOTIFICATION_HISTORY_LIMIT) {
    notificationHistory = notificationHistory.slice(0, NOTIFICATION_HISTORY_LIMIT);
  }

  const panel = document.getElementById('notificationCenter');
  const isOpen = panel && !panel.classList.contains('hidden');
  if (!isOpen) {
    notificationUnreadCount += 1;
    updateNotificationUnreadBadge();
  }

  renderNotificationCenter();
}

function showNotification(message, options = {}) {
  const text = String(message || '').trim();
  if (!text) return;

  const allowedLevels = ['info', 'success', 'warning', 'error'];
  const level = allowedLevels.includes(String(options.level || '').trim().toLowerCase())
    ? String(options.level || '').trim().toLowerCase()
    : 'info';
  const durationValue = Number(options.duration);
  const durationMs = Number.isFinite(durationValue) && durationValue >= 0 ? durationValue : 4200;
  const actionLabel = String(options.actionLabel || '').trim();
  const actionHandler = typeof options.action === 'function' ? options.action : null;

  addNotificationHistoryEntry(text, level);

  const status = document.getElementById('simpleProfileStatus') || document.getElementById('libraryStatus');
  if (status) {
    status.textContent = text;
    status.dataset.level = level;
    setTimeout(() => {
      if (status.textContent === text) {
        status.textContent = '';
      }
    }, 3000);
  }

  const box = document.getElementById('notificationBox');
  if (!box) {
    console.info('[Notification]', text);
    return;
  }

  notificationCounter += 1;
  const toastId = `toast-${Date.now().toString(36)}-${notificationCounter.toString(36)}`;
  const toastEl = document.createElement('div');
  toastEl.className = `notification-item notification-item--${level}`;
  toastEl.dataset.toastId = toastId;
  toastEl.innerHTML = `
    <div class="notification-item-message">${escapeHtml(text)}</div>
    <div class="notification-item-actions"></div>
    <button type="button" class="notification-item-close" aria-label="Dismiss notification">×</button>
  `;

  const actionsEl = toastEl.querySelector('.notification-item-actions');
  if (actionsEl && actionLabel && actionHandler) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'notification-item-action';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', async () => {
      dismissNotificationToast(toastEl);
      try {
        await actionHandler();
      } catch (error) {
        console.warn('[Coverse] Notification action failed:', error);
      }
    });
    actionsEl.appendChild(actionBtn);
  }

  toastEl.querySelector('.notification-item-close')?.addEventListener('click', () => {
    dismissNotificationToast(toastEl);
  });

  box.prepend(toastEl);
  requestAnimationFrame(() => {
    toastEl.classList.add('is-visible');
  });

  while (box.children.length > 5) {
    const oldest = box.lastElementChild;
    if (!oldest) break;
    dismissNotificationToast(oldest, { immediate: true });
  }

  if (durationMs > 0) {
    const timeoutId = setTimeout(() => {
      dismissNotificationToast(toastEl);
    }, durationMs);
    notificationTimers.set(toastId, timeoutId);
  }
}

function renderSimpleProfileList(containerId, names, count, label) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (names.length) {
    container.innerHTML = names.slice(0, 50).map((name) => (
      `<div class="simple-profile-list-item">${escapeHtml(name)}</div>`
    )).join('');
    return;
  }

  container.innerHTML = `<div class="simple-profile-summary">${escapeHtml(String(count))} ${escapeHtml(label)}</div>`;
}

function renderSimpleProfileSections() {
  const postsWrap = document.getElementById('simpleProfilePosts');
  const sharesWrap = document.getElementById('simpleProfileShares');
  const projectsWrap = document.getElementById('simpleProfileProjects');
  const purchasesWrap = document.getElementById('simpleProfilePurchasesList');

  if (postsWrap) {
    if (!simpleProfilePostsCache.length) {
      postsWrap.innerHTML = '<div class="simple-profile-post-empty">No posts yet</div>';
    } else {
      postsWrap.innerHTML = renderProfilePostGrid(simpleProfilePostsCache.slice(0, 30), true, false);
    }
  }

  const shares = simpleProfilePostsCache.filter(isShareStylePost);
  const projects = getSimpleProfileProjectUploads();
  if (sharesWrap) {
    if (!shares.length) {
      sharesWrap.innerHTML = '<div class="simple-profile-post-empty">No shares yet</div>';
    } else {
      sharesWrap.innerHTML = renderProfilePostGrid(shares.slice(0, 30), true, false);
    }
  }

  if (projectsWrap) {
    if (!projects.length) {
      projectsWrap.innerHTML = '<div class="simple-profile-post-empty">No project uploads yet</div>';
    } else {
      projectsWrap.innerHTML = renderProfilePostGrid(projects.slice(0, 30), true, false);
    }
  }

  const purchases = getSimpleProfilePurchases();
  const purchasePosts = getSimpleProfilePurchasePosts();
  if (purchasesWrap) {
    if (purchasesSyncLoading) {
      purchasesWrap.innerHTML = `
        <div class="simple-profile-post-empty">Loading purchases...</div>
      `;
    } else if (!purchasePosts.length && !purchases.length) {
      purchasesWrap.innerHTML = '<div class="simple-profile-post-empty">No purchases yet</div>';
    } else if (purchasePosts.length) {
      purchasesWrap.innerHTML = renderProfilePostGrid(purchasePosts.slice(0, 30), true, false);
    } else {
      purchasesWrap.innerHTML = purchases.slice(0, 50).map((name) => (
        `<div class="simple-profile-list-item">${escapeHtml(name)}</div>`
      )).join('');
    }
  }

  const {
    followersList,
    followingList,
    connectionsList,
    followersCount,
    followingCount,
    connectionsCount
  } = buildSimpleProfileSocialData();

  renderSimpleProfileList('simpleProfileFollowersList', followersList, followersCount, 'followers');
  renderSimpleProfileList('simpleProfileConnectionsList', connectionsList, connectionsCount, 'connections');
  renderSimpleProfileList('simpleProfileFollowingList', followingList, followingCount, 'following');

  hydrateSimpleProfileWaveformSources().catch(() => {});
}

function renderSimpleProfileLibrary(items = []) {
  const container = document.getElementById('simpleProfileLibrary');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<div class="simple-profile-post-empty">No library items yet</div>';
    return;
  }

  container.innerHTML = items.slice(0, 12).map((item) => {
    const name = escapeHtml(item.name || item.title || 'Untitled');
    const meta = `${escapeHtml(getFileTypeLabel(item))} · ${formatFileSize(item.size || 0)}`;
    return `
      <div class="simple-profile-library-item">
        <div class="simple-profile-library-name">${name}</div>
        <div class="simple-profile-library-meta">${meta}</div>
      </div>
    `;
  }).join('');
}

function renderDiscoverUsers(users = []) {
  const container = document.getElementById('discoverUsersGrid');
  if (!container) return;

  if (!users.length) {
    container.innerHTML = '<div class="simple-profile-post-empty">No suggestions right now</div>';
    return;
  }

  container.innerHTML = users.slice(0, 30).map((user) => {
    const uid = escapeHtml(user.uid || '');
    const displayName = escapeHtml(user.displayName || 'User');
    const bio = escapeHtml((user.bio || '').substring(0, 100));
    const genre = escapeHtml(user.genre || '');
    const location = escapeHtml(user.location || '');
    const avatarUrl = user.avatarUrl || user.photoURL || '';
    const followersCount = user.followersCount || user.stats?.followersCount || 0;
    
    const metaParts = [genre, location].filter(Boolean);
    const metaText = metaParts.length ? metaParts.join(' • ') : '';
    
    return `
      <div class="discover-user-card" data-uid="${uid}">
        <div class="discover-user-avatar">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="${displayName}">` : `<div class="discover-user-initials">${escapeHtml(getInitials(displayName))}</div>`}
        </div>
        <div class="discover-user-info">
          <div class="discover-user-name">${displayName}</div>
          ${bio ? `<div class="discover-user-bio">${bio}</div>` : ''}
          ${metaText ? `<div class="discover-user-meta">${metaText}</div>` : ''}
          <div class="discover-user-followers">${followersCount} followers</div>
        </div>
        <button class="discover-follow-btn" data-uid="${uid}" type="button">Follow</button>
      </div>
    `;
  }).join('');
}

function renderMarketplaceItems(items = []) {
  const container = document.getElementById('marketplaceItemsGrid');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<div class="simple-profile-post-empty">No marketplace items available</div>';
    return;
  }

  container.innerHTML = items.slice(0, 120).map((item, index) => {
    const normalized = normalizeMarketplaceItem(item, index);
    const normalizedType = normalizeMarketplaceTypeValue(normalized.sampleType || normalized.type || normalized.rawType || '');
    if (MARKETPLACE_EXCLUDED_TYPES.has(normalizedType)) {
      return '';
    }
    const id = escapeHtml(normalized.id || '');
    const title = escapeHtml(normalized.title || 'Untitled');
    const description = escapeHtml((normalized.description || '').substring(0, 80));
    const sampleType = escapeHtml(normalized.sampleType || getDisplayTypeLabel(normalizedType || 'sample'));
    const image = normalizeProfileMediaUrl(normalized.image || '');
    const userName = escapeHtml(normalized.userName || 'Unknown');
    const userAvatar = normalizeProfileMediaUrl(normalized.userAvatar || '');
    const genre = escapeHtml(normalized.genre || '');
    const bpm = normalized.bpm ? `${normalized.bpm} BPM` : '';
    const key = escapeHtml(normalized.key || '');
    const tags = Array.isArray(normalized.tags) ? normalized.tags.slice(0, 3) : [];
    
    const isFree = normalized.isFree || false;
    const streamOnly = normalized.streamOnly || false;
    const hasPreview = Boolean(normalized.audioUrl || normalized.downloadURL || normalized.fileUrl || normalized.storagePath);
    const priceLabel = getMarketplacePriceLabel(normalized);
    const waveformSvg = generateMarketplaceWaveformSvg(id);
    
    const metaParts = [genre, bpm, key].filter(Boolean);
    const metaText = metaParts.join(' • ');
    
    return `
      <div class="marketplace-item-card" data-id="${id}" data-type="${escapeHtml(normalizedType)}">
        <div class="marketplace-item-image">
          ${image ? `<img src="${image}" alt="${title}">` : '<div class="marketplace-item-placeholder"></div>'}
          <div class="marketplace-item-type-badge">${sampleType}</div>
        </div>
        <div class="marketplace-item-content">
          <div class="marketplace-item-title">${title}</div>
          ${description ? `<div class="marketplace-item-description">${description}</div>` : ''}
          <div class="marketplace-item-creator">
            ${userAvatar ? `<img src="${userAvatar}" alt="${userName}" class="marketplace-creator-avatar">` : ''}
            <span class="marketplace-creator-name">${userName}</span>
          </div>
          ${metaText ? `<div class="marketplace-item-meta">${metaText}</div>` : ''}
          ${tags.length ? `<div class="marketplace-item-tags">${tags.map(tag => `<span class="marketplace-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          <div class="marketplace-item-waveform">
            ${waveformSvg}
          </div>
          <div class="marketplace-item-footer">
            <span class="marketplace-item-price">${priceLabel}</span>
            <div class="marketplace-item-actions">
              <button class="marketplace-preview-btn" data-id="${id}" data-action="preview" type="button" ${hasPreview ? '' : 'disabled aria-disabled="true"'}>Play</button>
              <button class="marketplace-action-btn" data-id="${id}" data-action="primary" type="button">
                ${streamOnly ? 'Stream' : isFree ? 'Download' : 'Add to cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSimpleProfileView() {
  const profile = profileBaseline || mapProfileFromApi(profileApiRaw || {});
  const avatarUrl = normalizeAvatarUrl(profile.avatarUrl || profile.photoURL || currentUser?.avatarUrl || '');
  const posts = simpleProfilePostsCache;
  const {
    followersCount,
    followingCount,
    connectionsCount
  } = buildSimpleProfileSocialData();

  const avatarEl = document.getElementById('simpleProfileAvatar');
  if (avatarEl) {
    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    } else {
      avatarEl.textContent = getInitials(profile.displayName || currentUser?.displayName || 'User');
    }
  }

  const nameEl = document.getElementById('simpleProfileName');
  if (nameEl) nameEl.textContent = profile.displayName || currentUser?.displayName || 'User';

  const handleEl = document.getElementById('simpleProfileHandle');
  if (handleEl) handleEl.textContent = formatHandle(resolveUserHandle(profile), 'coverse');

  const bioEl = document.getElementById('simpleProfileBio');
  if (bioEl) bioEl.textContent = profile.bio || 'No bio yet.';

  const locationEl = document.getElementById('simpleProfileLocation');
  if (locationEl) locationEl.textContent = profile.location || '-';

  const genreEl = document.getElementById('simpleProfileGenre');
  if (genreEl) genreEl.textContent = profile.genre || '-';

  const postsEl = document.getElementById('simpleProfilePostsCount');
  if (postsEl) postsEl.textContent = String(posts.length || 0);

  const followersEl = document.getElementById('simpleProfileFollowersCount');
  if (followersEl) followersEl.textContent = String(followersCount);

  const connectionsEl = document.getElementById('simpleProfileConnectionsCount');
  if (connectionsEl) connectionsEl.textContent = String(connectionsCount);

  const followingEl = document.getElementById('simpleProfileFollowingCount');
  if (followingEl) followingEl.textContent = String(followingCount);

  setSimpleProfileTab(currentSimpleProfileTab);
  renderSimpleProfileSections();
}

function initSimpleProfileTab() {
  document.getElementById('btnSimpleProfileEdit')?.addEventListener('click', () => {
    openUserProfile();
  });

  document.getElementById('btnSimpleProfileRefresh')?.addEventListener('click', async () => {
    setSimpleProfileStatus('Refreshing profile...', 'info');
    const ok = await hydrateProfileFromApi({ silent: true });
    if (ok) {
      await refreshSimpleProfileSections(currentUser?.uid || '');
      await refreshPurchaseSyncPipeline({ reason: 'profile-refresh', showLoading: true, force: true });
      setSimpleProfileStatus('Profile refreshed.', 'success');
    } else {
      setSimpleProfileStatus('Profile refresh failed.', 'error');
    }
  });

  const profileActions = document.querySelector('.profile-simple-actions');
  if (profileActions && !document.getElementById('btnRefreshPurchases')) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.id = 'btnRefreshPurchases';
    btn.type = 'button';
    btn.textContent = 'Refresh Purchases';
    profileActions.insertBefore(btn, document.getElementById('btnSimpleProfileEdit') || null);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setSimpleProfileStatus('Refreshing purchases...', 'info');
      const result = await refreshPurchaseSyncWithBackoff({ reason: 'manual', delays: [1000, 2000, 4000], force: true });
      if (result.ok) {
        setSimpleProfileStatus(`Purchases refreshed (${result.entries.length}).`, 'success');
      } else if (String(result.error || '') === 'AUTH_ERROR') {
        setSimpleProfileStatus('Auth expired. Please sign in again.', 'error');
      } else if (String(result.error || '') === 'TRANSIENT_SERVER_ERROR') {
        setSimpleProfileStatus('Server busy. Retry in a few seconds.', 'error');
      } else {
        setSimpleProfileStatus('Purchase refresh failed. Try again.', 'error');
      }
      btn.disabled = false;
    });
  }

  document.querySelectorAll('#simpleProfileTabs .simple-profile-tab').forEach((button) => {
    button.addEventListener('click', () => {
      setSimpleProfileTab(button.dataset.tab || 'posts');
    });
  });

  if (!waveformPlayDelegationBound) {
    waveformPlayDelegationBound = true;
    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.play-btn');
      if (!button) return;
      const waveformId = String(button.dataset.waveformId || '').trim();
      if (!waveformId) return;

      console.info('[Waveforms] play button click:', waveformId);

      const instance = window.waveformInstances?.[waveformId];
      if (!instance) return;

      try {
        const wasPlaying = Boolean(instance.isPlaying && instance.isPlaying());
        instance.playPause();
        const waveformEl = document.getElementById(waveformId);
        const profilePostId = String(waveformEl?.dataset?.profilePostId || '').trim();
        const waveformSourceHint = String(waveformEl?.dataset?.audioUrl || '').trim();
        if (!wasPlaying && profilePostId) {
          playProfilePostInBottomPlayer(profilePostId, waveformSourceHint).catch(() => {});
        }
      } catch (_error) {
        // no-op
      }
    });
  }

  document.addEventListener('click', (event) => {
    const card = event.target?.closest?.('.simple-profile-post-card[data-file-id]');
    if (!card) return;
    if (event.target?.closest?.('.play-btn, .simple-profile-video, video, audio, button, a')) return;

    const rawFileId = String(card.dataset.fileId || '').trim();
    if (!rawFileId) return;

    const previewId = ensureSimpleProfilePreviewItem(rawFileId);
    if (!previewId) return;
    openFilePreview(previewId);
  });
}

function initDiscoverAndMarketplace() {
  if (!filterUiListenersInitialized) {
    filterUiListenersInitialized = true;
    setupFeedFilteringListeners();
    setupMarketplaceSubfilterListeners();
    setupMarketplaceTagSuggestions();
    setupMarketplaceGenreOptions(simpleProfileMarketplaceCache);
    updatePhotoGallery(marketplaceFilterType);
  }

  document.addEventListener('click', (event) => {
    const homeFeedFilterBtn = event.target?.closest?.('.home-feed-filter[data-filter]');
    if (homeFeedFilterBtn) {
      filterFeed(homeFeedFilterBtn.dataset.filter || 'all');
      return;
    }

    const marketplaceFilterBtn = event.target?.closest?.('.marketplace-filter[data-type]');
    if (marketplaceFilterBtn) {
      filterContent(marketplaceFilterBtn.dataset.type || 'all');
      return;
    }

    if (event.target?.id === 'btnMarketplaceUpload' || event.target?.closest?.('#btnMarketplaceUpload')) {
      openMarketplaceUploadModal();
      return;
    }

    const homeFeedPreviewBtn = event.target?.closest?.('.home-feed-preview-btn[data-feed-id]');
    if (homeFeedPreviewBtn) {
      const feedId = String(homeFeedPreviewBtn.dataset.feedId || '').trim();
      if (feedId) {
        playHomeFeedItem(feedId).catch((error) => {
          console.error('[Home Feed] Preview failed:', error);
          showNotification('Preview failed. Please try again.');
        });
      }
      return;
    }

    const homeFeedActionBtn = event.target?.closest?.('.home-feed-action-btn[data-feed-id]');
    if (homeFeedActionBtn) {
      const feedId = String(homeFeedActionBtn.dataset.feedId || '').trim();
      if (feedId) {
        handleHomeFeedItemAction(feedId).catch((error) => {
          console.error('[Home Feed] Action failed:', error);
          showNotification('Feed action failed. Please try again.');
        });
      }
      return;
    }

    const followBtn = event.target?.closest?.('.discover-follow-btn[data-uid]');
    if (followBtn) {
      const uid = String(followBtn.dataset.uid || '').trim();
      if (!uid) return;

      followBtn.disabled = true;
      followBtn.textContent = 'Following...';

      handleDiscoverFollow(uid).then((success) => {
        if (success) {
          const card = followBtn.closest('.discover-user-card');
          if (card) {
            card.style.opacity = '0';
            setTimeout(() => {
              card.remove();
              const remaining = document.querySelectorAll('.discover-user-card').length;
              if (remaining === 0) {
                const container = document.getElementById('discoverUsersGrid');
                if (container) {
                  container.innerHTML = '<div class="simple-profile-post-empty">No more suggestions</div>';
                }
              }
            }, 300);
          }
        } else {
          followBtn.disabled = false;
          followBtn.textContent = 'Follow';
        }
      }).catch(() => {
        followBtn.disabled = false;
        followBtn.textContent = 'Follow';
      });
      return;
    }

    const marketplaceBtn = event.target?.closest?.('.marketplace-action-btn[data-id], .marketplace-preview-btn[data-id]');
    if (marketplaceBtn) {
      const itemId = String(marketplaceBtn.dataset.id || '').trim();
      const action = String(marketplaceBtn.dataset.action || 'primary').trim() || 'primary';
      if (itemId) {
        handleMarketplaceItemAction(itemId, action).catch((error) => {
          console.error('Marketplace action failed:', error);
          showNotification('Marketplace action failed. Please try again.');
        });
      }
      return;
    }
  });
}

async function refreshSimpleProfileSections(targetUid) {
  const uid = String(targetUid || '').trim();
  simpleProfileTargetUid = uid;

  if (currentSimpleProfileTab === 'library') {
    currentSimpleProfileTab = 'projects';
  }

  if (!uid) {
    simpleProfilePostsCache = [];
    simpleProfileLibraryCache = [];
    simpleProfilePurchasesCache = [];
    renderSimpleProfileView();
    return;
  }

  const [posts, libraryItems, purchases] = await Promise.all([
    loadProfilePosts(uid),
    loadProfileLibrary(uid),
    loadProfilePurchases(uid)
  ]);

  simpleProfilePostsCache = posts.map(normalizeProfilePostItem);
  simpleProfileLibraryCache = libraryItems;
  simpleProfilePurchasesCache = purchases;

  const purchaseLibraryItems = (libraryItems || []).filter((item) => {
    if (!item || item.isDeleted) return false;
    if (item.isPurchased || item.purchased || item.purchaseId) return true;
    const sourceText = String(item.source || '').toLowerCase();
    return sourceText.includes('purchase');
  });

  if (purchaseLibraryItems.length) {
    const mergedById = new Map((Array.isArray(userLibrary) ? userLibrary : []).map((item) => [item.id, item]));
    purchaseLibraryItems.forEach((item) => {
      if (!item?.id) return;
      mergedById.set(item.id, {
        ...mergedById.get(item.id),
        ...item,
        section: 'site',
        isPurchased: true,
        purchased: true
      });
    });
    userLibrary = Array.from(mergedById.values());
    persistSiteLibraryCacheFromState();
  }

  profileApiLibrary = [...simpleProfilePostsCache, ...simpleProfileLibraryCache];
  renderSimpleProfileView();
}

function getProfileUploads() {
  const source = profileApiLibrary;

  const toStringKey = (value) => String(value || '').trim().toLowerCase();
  const collectOwnerKeys = (item = {}) => {
    const keys = [
      item.ownerUid,
      item.ownerId,
      item.uid,
      item.userId,
      item.authorId,
      item.creatorUid,
      item.uploadedByUid,
      item.ownerUsername,
      item.username,
      item.handle,
      item.ownerName,
      item.author,
      item.uploader,
      item?.owner?.uid,
      item?.owner?.id,
      item?.owner?.username,
      item?.owner?.displayName,
      item?.user?.uid,
      item?.user?.id,
      item?.user?.username,
      item?.createdBy?.uid,
      item?.createdBy?.id,
      item?.createdBy?.username
    ]
      .map(toStringKey)
      .filter(Boolean);

    return Array.from(new Set(keys));
  };

  const currentKeys = [
    currentUser?.uid,
    currentUser?.username,
    currentUser?.displayName,
    profileBaseline?.username,
    profileBaseline?.displayName
  ]
    .map(toStringKey)
    .filter(Boolean);

  if (isSimpleProfileOwner(simpleProfileTargetUid)) {
    return source
      .filter((item) => item && !item.isDeleted)
      .slice()
      .sort((a, b) => {
        const aMs = new Date(a.uploadedAt || a.createdAt || a.updatedAt || 0).getTime() || 0;
        const bMs = new Date(b.uploadedAt || b.createdAt || b.updatedAt || 0).getTime() || 0;
        return bMs - aMs;
      });
  }

  const anyOwnerMetadata = source.some((item) => collectOwnerKeys(item).length > 0);

  const filtered = source.filter((item) => {
    if (!item || item.isDeleted) return false;
    if (!anyOwnerMetadata) return true;
    const ownerKeys = collectOwnerKeys(item);
    if (!ownerKeys.length) return false;
    return ownerKeys.some((ownerKey) => currentKeys.includes(ownerKey));
  });

  return filtered
    .slice()
    .sort((a, b) => {
      const aMs = new Date(a.uploadedAt || a.createdAt || a.updatedAt || 0).getTime() || 0;
      const bMs = new Date(b.uploadedAt || b.createdAt || b.updatedAt || 0).getTime() || 0;
      return bMs - aMs;
    });
}

function getProfilePostPreviewUrl(file = {}) {
  const thumb = String(file.thumbnailURL || file.thumbnailUrl || file.previewUrl || file.imageUrl || '').trim();
  if (thumb) return thumb;
  const mime = String(file.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') && file.downloadURL) return file.downloadURL;
  return '';
}

function normalizeProjectLookup(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,6}$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getProfilePayloadRoots() {
  const roots = [
    profileApiRaw,
    profileApiRaw?.data,
    profileApiRaw?.profile,
    profileApiRaw?.user,
    profileApiRaw?.result,
    profileApiRaw?.data?.profile,
    profileApiRaw?.data?.user,
    profilePostsPayload,
    profilePostsPayload?.data,
    profilePostsPayload?.profile,
    profilePostsPayload?.user,
    profilePostsPayload?.result,
    profilePostsPayload?.data?.profile,
    profilePostsPayload?.data?.user
  ].filter((entry) => entry && typeof entry === 'object');

  return Array.from(new Set(roots));
}

function collectProfileArrayEntries(keys = []) {
  const entries = [];
  const keyList = Array.isArray(keys) ? keys : [keys];
  getProfilePayloadRoots().forEach((root) => {
    keyList.forEach((key) => {
      if (Array.isArray(root?.[key])) {
        entries.push(...root[key]);
      }
    });
  });
  return entries;
}

function collectProfileValuesByKeyPatterns(patterns = []) {
  const testers = (Array.isArray(patterns) ? patterns : [patterns])
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);

  if (!testers.length) return [];

  const results = [];
  const roots = getProfilePayloadRoots();

  const shouldCollect = (key) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) return false;
    return testers.some((pattern) => normalized === pattern || normalized.includes(pattern));
  };

  const walk = (node, visited = new Set()) => {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      node.forEach((entry) => walk(entry, visited));
      return;
    }

    Object.entries(node).forEach(([key, value]) => {
      if (shouldCollect(key)) {
        if (Array.isArray(value)) {
          results.push(...value);
        } else if (value != null) {
          results.push(value);
        }
      }
      if (value && typeof value === 'object') {
        walk(value, visited);
      }
    });
  };

  roots.forEach((root) => walk(root));
  return results;
}

function getProfilePurchaseCountHint() {
  const keys = [
    'purchasesCount', 'purchaseCount', 'savedSamplesCount', 'savedCount', 'ordersCount',
    'purchases_count', 'purchase_count', 'saved_samples_count', 'orders_count',
    'totalPurchases', 'total_purchases'
  ];

  let maxCount = 0;
  getProfilePayloadRoots().forEach((root) => {
    if (!root || typeof root !== 'object') return;
    const countsRoot = root.counts && typeof root.counts === 'object' ? root.counts : null;

    keys.forEach((key) => {
      const direct = Number(root[key]);
      if (Number.isFinite(direct) && direct > maxCount) maxCount = direct;
      const nested = Number(countsRoot?.[key]);
      if (Number.isFinite(nested) && nested > maxCount) maxCount = nested;
    });
  });

  return Math.max(0, Math.floor(maxCount));
}

function getEntryDisplayLabel(entry) {
  const isMeaningfulPurchaseLabel = (value) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/^\d+$/.test(text)) return false;
    if (/^(true|false|null|undefined)$/i.test(text)) return false;
    return true;
  };

  if (typeof entry === 'string') {
    const text = String(entry || '').trim();
    return isMeaningfulPurchaseLabel(text) ? text : '';
  }
  if (!entry || typeof entry !== 'object') {
    const text = String(entry || '').trim();
    return isMeaningfulPurchaseLabel(text) ? text : '';
  }

  const primary = String(
    entry.name ||
    entry.title ||
    entry.label ||
    entry.fileName ||
    entry.file_name ||
    entry.sampleName ||
    entry.sample_name ||
    entry.productName ||
    entry.product_name ||
    entry.itemName ||
    entry.item_name ||
    entry.assetName ||
    entry.asset_name ||
    entry.trackName ||
    entry.track_name ||
    entry.product?.name ||
    entry.item?.name ||
    entry.asset?.name ||
    entry.track?.name ||
    ''
  ).trim();
  if (isMeaningfulPurchaseLabel(primary)) return primary;

  const fallback = String(
    entry.id || ''
  ).trim();
  return isMeaningfulPurchaseLabel(fallback) ? fallback : '';
}

function collectPurchaseReferenceTokens(entries = []) {
  const tokens = new Set();
  const addToken = (value) => {
    const text = normalizeProjectLookup(value);
    if (!text) return;
    tokens.add(text);
  };

  const visit = (entry) => {
    if (entry == null) return;
    if (Array.isArray(entry)) {
      entry.forEach((item) => visit(item));
      return;
    }
    if (typeof entry === 'string') {
      addToken(entry);
      return;
    }
    if (typeof entry !== 'object') {
      addToken(entry);
      return;
    }

    addToken(entry.id);
    addToken(entry.fileId);
    addToken(entry.siteId);
    addToken(entry.itemId);
    addToken(entry.productId);
    addToken(entry.sampleId);
    addToken(entry.libraryId);
    addToken(entry.purchaseId);
    addToken(entry.sku);
    addToken(entry.slug);
    addToken(entry.name);
    addToken(entry.title);
    addToken(entry.label);
    addToken(entry.fileName);
    addToken(entry.sampleName);
    addToken(entry.productName);
    addToken(entry.itemName);

    if (entry.product && typeof entry.product === 'object') {
      visit(entry.product);
    }
    if (entry.item && typeof entry.item === 'object') {
      visit(entry.item);
    }

    ['items', 'purchases', 'savedSamples', 'saved', 'samples', 'results', 'products', 'files', 'owned'].forEach((key) => {
      if (Array.isArray(entry[key])) {
        visit(entry[key]);
      }
    });
  };

  visit(entries);
  return tokens;
}

function normalizeProjectList(payload) {
  const candidates = [
    payload?.projects,
    payload?.sharedProjects,
    payload?.profile?.projects,
    payload?.profile?.sharedProjects,
    payload?.data?.projects,
    payload?.data?.sharedProjects,
    payload?.user?.projects,
    payload?.user?.sharedProjects,
    payload?.result?.projects,
    payload?.result?.sharedProjects
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function collectProfileProjectNameSet() {
  const set = new Set();
  const add = (value) => {
    const normalized = normalizeProjectLookup(value);
    if (normalized) set.add(normalized);
  };

  const extractCandidates = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
    }
    if (typeof value === 'object') {
      if (Array.isArray(value.items)) return value.items;
      return Object.values(value);
    }
    return [];
  };

  const payloadRoots = [
    profileApiRaw,
    profilePostsPayload,
    profileApiRaw?.data,
    profileApiRaw?.profile,
    profileApiRaw?.user,
    profileApiRaw?.result,
    profilePostsPayload?.data,
    profilePostsPayload?.profile,
    profileBaseline
  ].filter(Boolean);

  const rawProjects = [];
  payloadRoots.forEach((payload) => {
    const normalized = normalizeProjectList(payload);
    if (normalized.length) {
      rawProjects.push(...normalized);
    }
  });

  rawProjects.forEach((entry) => add(typeof entry === 'object' ? (entry?.name || entry?.title || entry?.project || '') : entry));
  return set;
}

function getSimpleProfileProjectUploads() {
  const fallbackLibrary = Array.isArray(userLibrary)
    ? userLibrary.filter((item) => {
        if (!item) return false;
        if (isSimpleProfileOwner(simpleProfileTargetUid)) return true;
        const target = String(simpleProfileTargetUid || '').trim();
        const ownerCandidates = [item.ownerUid, item.userId, item.uid, item.ownerId]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        return target ? ownerCandidates.includes(target) : true;
      })
    : [];

  const baseUploads = Array.isArray(simpleProfileLibraryCache) && simpleProfileLibraryCache.length
    ? simpleProfileLibraryCache
    : [...getProfileUploads(), ...fallbackLibrary];

  const payloadRoots = [
    profileApiRaw,
    profilePostsPayload,
    profileApiRaw?.data,
    profileApiRaw?.profile,
    profileApiRaw?.user,
    profileApiRaw?.result,
    profilePostsPayload?.data,
    profilePostsPayload?.profile
  ].filter(Boolean);

  const rawProjects = [];
  payloadRoots.forEach((payload) => {
    const normalized = normalizeProjectList(payload);
    if (normalized.length) {
      rawProjects.push(...normalized);
    }
  });

  const normalizedProjectEntries = rawProjects
    .map((entry, index) => {
      if (entry == null) return null;
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return normalizeSiteLibraryItem(`project_label_${index}`, { name: text, title: text, type: 'project', postType: 'project' });
      }
      if (typeof entry !== 'object') return null;

      const sourceId = entry.id || entry._id || entry.siteId || entry.fileId || `project_share_${index}`;
      const hasLibraryShape = Boolean(
        entry.downloadURL || entry.url || entry.fileUrl || entry.storagePath || entry.mimeType || entry.fileName || entry.name || entry.title
      );
      if (hasLibraryShape) {
        return normalizeSiteLibraryItem(sourceId, entry);
      }
      return normalizeProfilePostItem({ id: sourceId, ...entry });
    })
    .filter(Boolean);

  const byId = new Map();
  [...baseUploads, ...normalizedProjectEntries].forEach((item, index) => {
    if (!item || item.isDeleted) return;
    const key = String(item.id || item.siteId || item.storagePath || `project_item_${index}`).trim();
    if (!key) return;
    if (!byId.has(key)) byId.set(key, item);
  });

  const uploads = Array.from(byId.values());
  const profileProjectNames = collectProfileProjectNameSet();
  const projectFilePattern = /\.(vst3|vst|aup3|als|flp|logicx|band|cpr|ptx|rpp|song|sesx|npr|reason|xrns|xpj|adg|fxp|fst|zip)$/i;

  return uploads.filter((item) => {
    if (!item || item.isDeleted) return false;
    const itemName = String(item.name || item.title || '').trim();
    const mimeType = item.mimeType || inferMimeTypeFromName(itemName);
    const normalizedType = normalizeLibraryType(item.type || item.sampleType || item.mediaKind || '', mimeType, itemName);
    if (normalizedType === 'project') return true;

    if (itemName && projectFilePattern.test(itemName)) return true;

    const normalizedName = normalizeProjectLookup(itemName);
    if (normalizedName) {
      if (profileProjectNames.has(normalizedName)) return true;
      for (const projectName of profileProjectNames) {
        if (!projectName) continue;
        if (normalizedName.includes(projectName) || projectName.includes(normalizedName)) return true;
      }
    }

    const markers = [
      item.projectType,
      item.fileCategory,
      item.category,
      item.postType,
      item.mediaKind,
      item.type,
      item.sampleType,
      item.tag,
      item.tags,
      item.projectShares,
      item.projectShare
    ];

    return markers.some((markerValue) => {
      if (Array.isArray(markerValue)) {
        return markerValue.some((entry) => String(entry || '').toLowerCase().includes('project'));
      }
      return String(markerValue || '').toLowerCase().includes('project');
    });
  });
}

function normalizePurchaseList(payload) {
  const candidates = [
    payload?.purchaseDetails,
    payload?.purchaseItems,
    payload?.purchases?.items,
    payload?.items,
    payload?.profile?.purchaseDetails,
    payload?.profile?.purchaseItems,
    payload?.profile?.purchasesData?.items,
    payload?.data?.purchaseDetails,
    payload?.data?.purchaseItems,
    payload?.data?.purchases?.items,
    payload?.data?.items,
    payload?.user?.purchaseDetails,
    payload?.user?.purchaseItems,
    payload?.user?.purchases?.items,
    payload?.result?.purchaseDetails,
    payload?.result?.purchaseItems,
    payload?.result?.purchases?.items
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function getSimpleProfilePurchases() {
  const explicit = [];
  const pushExplicit = (value) => {
    const text = String(value || '').trim();
    if (text) explicit.push(text);
  };

  const payloadRoots = [
    profileApiRaw,
    profilePostsPayload,
    profileApiRaw?.data,
    profileApiRaw?.profile,
    profileApiRaw?.user,
    profileApiRaw?.result,
    profilePostsPayload?.data,
    profilePostsPayload?.profile,
    profileBaseline
  ].filter(Boolean);

  const rawPurchases = [];
  payloadRoots.forEach((payload) => {
    const normalized = normalizePurchaseList(payload);
    if (normalized.length) {
      rawPurchases.push(...normalized);
    }
  });

  const purchaseTokens = collectPurchaseReferenceTokens(rawPurchases);

  rawPurchases.forEach((entry) => pushExplicit(getEntryDisplayLabel(entry)));
  (simpleProfilePurchasesCache || []).forEach((entry) => pushExplicit(entry));

  const explicitLookup = new Set(explicit.map((entry) => normalizeProjectLookup(entry)).filter(Boolean));

  const candidates = [
    ...(Array.isArray(simpleProfileLibraryCache) ? simpleProfileLibraryCache : []),
    ...(Array.isArray(userLibrary) ? userLibrary : [])
  ];

  const fromLibrary = candidates
    .filter((item) => {
      if (!item || item.isDeleted) return false;
      if (item.isPurchased || item.purchased || item.purchaseId) return true;
      const normalizedName = normalizeProjectLookup(item.name || item.title || '');
      const normalizedId = normalizeProjectLookup(item.id || item.siteId || item.storagePath || '');
      return (
        (normalizedName && (explicitLookup.has(normalizedName) || purchaseTokens.has(normalizedName))) ||
        (normalizedId && (explicitLookup.has(normalizedId) || purchaseTokens.has(normalizedId)))
      );
    })
    .map((item) => String(item.name || item.title || item.id || '').trim())
    .filter(Boolean);

  const unique = new Set();
  [...explicit, ...fromLibrary].forEach((entry) => {
    const key = normalizeProjectLookup(entry);
    if (!key) return;
    if (!unique.has(key)) unique.add(key);
  });

  const resolved = Array.from(unique).map((key) => {
    const explicitMatch = explicit.find((entry) => normalizeProjectLookup(entry) === key);
    if (explicitMatch) return explicitMatch;
    const libraryMatch = fromLibrary.find((entry) => normalizeProjectLookup(entry) === key);
    return libraryMatch || key;
  });

  return resolved;
}

function buildSimpleProfilePreviewItem(source = {}, fallbackId = '') {
  const sourceId = String(source.id || source.siteId || fallbackId || '').trim() || `profile_preview_${Date.now()}`;
  const name = String(source.name || source.title || source.fileName || 'Untitled').trim() || 'Untitled';
  const mimeType = source.mimeType || source.contentType || inferMimeTypeFromName(name);
  const type = normalizeLibraryType(source.type || source.sampleType || source.mediaKind || '', mimeType, name);
  const section = source.section || (source.siteId || source.storagePath || source.downloadURL ? 'site' : 'local');

  return {
    id: sourceId,
    siteId: source.siteId || source.id?.replace(/^site_/, '') || '',
    name,
    title: source.title || name,
    size: Number(source.size || source.fileSize || 0),
    type,
    section,
    uploadedAt: source.uploadedAt || source.createdAt || source.updatedAt || new Date(),
    mimeType,
    storagePath: source.storagePath || source.path || '',
    downloadURL: source.downloadURL || source.url || source.fileUrl || source.audioUrl || source.sourceAudioUrl || '',
    thumbnailURL: source.thumbnailURL || source.thumbnailUrl || source.previewUrl || source.imageUrl || '',
    previewUrl: source.previewUrl || source.thumbnailURL || source.thumbnailUrl || source.imageUrl || '',
    imageUrl: source.imageUrl || source.previewUrl || source.thumbnailURL || '',
    isReadOnly: false,
    pushToSite: section !== 'site'
  };
}

function ensureSimpleProfilePreviewItem(fileId = '') {
  const key = String(fileId || '').trim();
  if (!key) return '';

  const existing = findRenderableLibraryItemById(key);
  if (existing) return existing.id;

  const projectItems = getSimpleProfileProjectUploads();
  const source = [
    ...(Array.isArray(simpleProfileLibraryCache) ? simpleProfileLibraryCache : []),
    ...(Array.isArray(simpleProfilePostsCache) ? simpleProfilePostsCache : []),
    ...(Array.isArray(projectItems) ? projectItems : [])
  ].find((item) => String(item?.id || '').trim() === key);

  if (!source) return '';

  const previewItem = buildSimpleProfilePreviewItem(source, key);
  const existingIndex = userLibrary.findIndex((item) => item?.id === previewItem.id);
  if (existingIndex >= 0) {
    userLibrary[existingIndex] = { ...userLibrary[existingIndex], ...previewItem };
  } else {
    userLibrary.push(previewItem);
  }

  return previewItem.id;
}

function renderProfilePostGrid(items = [], includeDate = false, wrap = true) {
  const cards = items.map((file) => {
        const mimeType = file.mimeType || inferMimeTypeFromName(file.name || '');
        const normalizedType = normalizeLibraryType(file.type, mimeType, file.name || '');
        const audioSrc = normalizeProfileMediaUrl(file.downloadURL || file.audioUrl || file.mediaUrl || file.sourceAudioUrl || '');
        const waveformAudioSrc = getWaveformCompatibleAudioUrl(audioSrc);
        const videoSrc = normalizeProfileMediaUrl(file.videoUrl || file.previewVideoUrl || file.mediaVideoUrl || resolveProfilePostVideoCandidate(file));
        const audioLikeByMime = String(mimeType || '').toLowerCase().startsWith('audio/');
        const audioLikeByName = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(String(file.name || file.title || ''));
        const videoLikeByMime = String(mimeType || '').toLowerCase().startsWith('video/');
        const videoLikeByName = /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(file.name || file.title || ''));
        const hasResolvableStorage = Boolean(String(file.storagePath || '').trim());
        const canPlayAudio = (normalizedType === 'audio' || audioLikeByMime || audioLikeByName) && (Boolean(audioSrc) || hasResolvableStorage);
        const canPlayVideo = (normalizedType === 'video' || videoLikeByMime || videoLikeByName || String(file.mediaKind || '').toLowerCase() === 'video') && Boolean(videoSrc);
        const audioSourceLog = audioSrc ? (file.audioSourceKind || 'audio file') : 'none';
        console.info('[ProfilePosts] render post:', file.id || '(no-id)', 'audio source:', audioSourceLog);
        const previewUrl = getProfilePostPreviewUrl(file);
        const typeLabel = escapeHtml(getFileTypeLabel(file));
        const sizeLabel = formatFileSize(file.size || 0);
        const badgeType = escapeHtml((file.postType || normalizedType || 'post').toString().toUpperCase());
        const mediaKindBadge = file.mediaKind ? `<span class="simple-profile-post-badge">${escapeHtml(String(file.mediaKind).toUpperCase())}</span>` : '';
        const pricingBadge = file.streamOnly
          ? '<span class="simple-profile-post-badge">STREAM ONLY</span>'
          : (file.isFree
              ? '<span class="simple-profile-post-badge">FREE</span>'
              : (Number.isFinite(Number(file.price)) && Number(file.price) > 0
                  ? `<span class="simple-profile-post-badge">$${escapeHtml(Number(file.price).toFixed(2))}</span>`
                  : ''));
        const dateLabel = includeDate
          ? ` · ${escapeHtml(formatDate(file.uploadedAt || file.createdAt || file.updatedAt))}`
          : '';
        const title = escapeHtml(file.title || file.name || 'Untitled');
        const waveformIdRaw = `waveform_${String(file.id || '').replace(/[^a-zA-Z0-9_-]/g, '_') || `idx_${Math.random().toString(36).slice(2, 8)}`}`;
        const waveformId = escapeHtml(waveformIdRaw);
        const genreLine = file.genre ? `<div class="simple-profile-post-sub">${escapeHtml(file.genre)}${file.bpm ? ` · ${escapeHtml(String(file.bpm))} BPM` : ''}</div>` : '';

        return `
          <div class="simple-profile-post-card" data-file-id="${escapeHtml(file.id || '')}">
            ${canPlayVideo
              ? ''
              : `<div class="simple-profile-post-cover">${previewUrl ? `<img src="${previewUrl}" alt="${title}">` : '<div class="simple-profile-post-fallback">♪</div>'}</div>`}
            <div class="simple-profile-post-title">${title}</div>
            ${genreLine}
            <div class="simple-profile-post-badges">
              <span class="simple-profile-post-badge">${badgeType}</span>
              ${mediaKindBadge}
              ${pricingBadge}
              ${canPlayAudio ? '<span class="simple-profile-post-badge">AUDIO</span>' : ''}
              ${canPlayVideo ? '<span class="simple-profile-post-badge">VIDEO</span>' : ''}
            </div>
            <div class="simple-profile-post-meta">${typeLabel} · ${sizeLabel}${dateLabel}</div>
            ${canPlayVideo
              ? `<video class="simple-profile-video" controls preload="metadata" ${previewUrl ? `poster="${previewUrl}"` : ''} src="${videoSrc}"></video>`
              : (canPlayAudio
                  ? `<div class="simple-profile-wave-player"><div class="simple-profile-waveform" id="${waveformId}" data-profile-post-id="${escapeHtml(String(file.id || ''))}" data-audio-url="${waveformAudioSrc}" data-title="${title}" data-artist="${escapeHtml(currentUser?.displayName || '')}"></div><button type="button" class="play-btn" data-waveform-id="${waveformId}" aria-label="Play/Pause">${getWaveformButtonIcon(false)}</button></div>`
                  : '<div class="simple-profile-post-empty">Audio preview unavailable for this post.</div>')}
          </div>
        `;
      }).join('');

  if (!wrap) return cards;

  return `
    <div class="simple-profile-posts">
      ${cards}
    </div>
  `;
}

function updateProfileHero(profile = {}) {
  const heroName = document.getElementById('profileHeroName');
  const heroSub = document.getElementById('profileHeroSub');
  const heroBio = document.getElementById('profileHeroBio');
  const heroAvatar = document.getElementById('profileHeroAvatar');

  if (heroName) {
    heroName.textContent = profile.displayName || currentUser?.displayName || 'User';
  }

  const parts = [];
  parts.push(formatHandle(resolveUserHandle(profile), 'coverse'));
  if (profile.location) parts.push(profile.location);
  if (profile.genre) parts.push(profile.genre);
  if (heroSub) {
    heroSub.textContent = parts.join(' · ') || formatHandle('', 'coverse');
  }

  if (heroBio) {
    heroBio.textContent = profile.bio || 'Tell collaborators who you are and what you are working on.';
  }

  if (heroAvatar) {
    const avatarUrl = normalizeAvatarUrl(profile.avatarUrl || profile.photoURL || currentUser?.avatarUrl || '');
    if (avatarUrl) {
      heroAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    } else {
      heroAvatar.textContent = getInitials(profile.displayName || currentUser?.displayName || 'User');
    }
  }
}

function updateProfileStats(profile = {}) {
  const uploads = getProfileUploads().length;
  const playlists = Array.isArray(profile.playlists) ? profile.playlists.length : 0;
  const projects = getSimpleProfileProjectUploads().length || (Array.isArray(profile.projects) ? profile.projects.length : 0);
  const purchases = Math.max(getSimpleProfilePurchases().length, getSimpleProfilePurchasePosts().length);
  const followers = resolveSocialCount(profileApiRaw?.followersCount || profileApiRaw?.followerCount, profileApiRaw?.followers, 0);
  const following = resolveSocialCount(profileApiRaw?.followingCount, profileApiRaw?.following, userFriends.length || 0);

  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  setValue('profileStatUploads', uploads);
  setValue('profileStatPlaylists', playlists);
  setValue('profileStatFollowers', followers);
  setValue('profileStatFollowing', following);
  setValue('profileStatProjects', projects);
  setValue('profileStatPurchases', purchases);
}

function renderProfileTabContent() {
  const container = document.getElementById('profileTabContent');
  if (!container) return;

  const profile = profileBaseline || mapProfileFromApi(profileApiRaw || {});
  const uploads = getProfileUploads();

  document.querySelectorAll('#profileTabs .profile-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === currentProfileTab);
  });

  if (currentProfileTab === 'feed') {
    const feed = uploads.slice(0, 30);
    if (!feed.length) {
      container.innerHTML = '<div class="profile-empty">No recent activity yet.</div>';
      return;
    }

    container.innerHTML = renderProfilePostGrid(feed, true);
    return;
  }

  if (currentProfileTab === 'uploads') {
    const uploadItems = uploads.slice(0, 60);
    if (!uploadItems.length) {
      container.innerHTML = '<div class="profile-empty">No uploads yet. Upload to Site or App Cloud to populate this view.</div>';
      return;
    }

    container.innerHTML = renderProfilePostGrid(uploadItems, false);
    return;
  }

  if (currentProfileTab === 'playlists') {
    const playlists = Array.isArray(profile.playlists) ? profile.playlists : [];
    container.innerHTML = playlists.length
      ? `<div class="profile-pill-list">${playlists.map((item) => `<span class="profile-pill">${escapeHtml(String(item))}</span>`).join('')}</div>`
      : '<div class="profile-empty">No playlists in profile yet.</div>';
    return;
  }

  if (currentProfileTab === 'projects') {
    const projectUploads = getSimpleProfileProjectUploads();
    if (projectUploads.length) {
      container.innerHTML = renderProfilePostGrid(projectUploads.slice(0, 60), false);
      return;
    }
    const projects = Array.isArray(profile.projects) ? profile.projects : [];
    container.innerHTML = projects.length
      ? `<div class="profile-pill-list">${projects.map((item) => `<span class="profile-pill">${escapeHtml(String(item))}</span>`).join('')}</div>`
      : '<div class="profile-empty">No project uploads yet.</div>';
    return;
  }

  const links = [];
  const listLinks = Array.isArray(profile.links) ? profile.links : [];
  const mediaLinks = Array.isArray(profile.mediaLinks) ? profile.mediaLinks : [];
  listLinks.forEach((item) => links.push(item));
  mediaLinks.forEach((item) => links.push(item));

  container.innerHTML = links.length
    ? `<div class="profile-pill-list">${links.map((item) => `<span class="profile-pill">${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</span>`).join('')}</div>`
    : '<div class="profile-empty">No links in profile yet.</div>';
}

function renderProfileDashboard() {
  renderSimpleProfileView();
}

async function saveProfileChanges() {
  if (!profileBaseline) {
    setProfileStatus('Profile not loaded yet.', 'error');
    return;
  }

  const nextState = readProfileForm();
  const patch = buildProfilePatch(profileBaseline, nextState);

  if (!Object.keys(patch).length) {
    setProfileStatus('No changes to save.', 'info');
    return;
  }

  setProfileStatus('Saving profile...', 'info');
  try {
    await profileApiRequest('/api/updateUserProfile', { method: 'POST', body: patch, retryOn401: true });
    await hydrateProfileFromApi({ silent: true });
    renderProfileDashboard();
    setProfileStatus('Profile saved successfully.', 'success');
  } catch (error) {
    setProfileStatus(error?.message || 'Failed to save profile.', 'error');
  }
}

function initUpdaterUi() {
  const updateWidget = document.getElementById('updateStatusWidget');
  const updateTitle = document.getElementById('updateStatusTitle');
  const updateText = document.getElementById('updateStatusText');
  const updateProgress = document.getElementById('updateStatusProgress');
  const btnCheck = document.getElementById('btnCheckUpdatesNow');
  const btnInstall = document.getElementById('btnInstallUpdate');
  const btnLater = document.getElementById('btnUpdateLater');
  const btnClose = document.getElementById('btnCloseUpdateWidget');

  if (!updateWidget || !window.coverse?.onUpdateStatus) {
    return;
  }

  const showWidget = (show) => {
    updateWidget.classList.toggle('hidden', !show);
  };

  const setText = (title, text) => {
    if (updateTitle) updateTitle.textContent = title;
    if (updateText) updateText.textContent = text;
  };

  btnInstall?.addEventListener('click', async () => {
    btnInstall.disabled = true;
    try {
      await window.coverse.installUpdate();
    } finally {
      btnInstall.disabled = false;
    }
  });

  btnLater?.addEventListener('click', async () => {
    await window.coverse.remindUpdateLater();
    btnLater.classList.add('hidden');
    btnInstall.classList.add('hidden');
    setText('Updater', 'Update reminder snoozed.');
  });

  btnClose?.addEventListener('click', () => {
    showWidget(false);
  });

  window.coverse.onUpdateStatus((payload = {}) => {
    const state = String(payload.state || 'idle');
    const percent = Number(payload.percent || 0);
    const message = String(payload.message || '').trim();
    const nextVersion = payload.nextVersion ? ` ${payload.nextVersion}` : '';

    updateProgress?.classList.add('hidden');
    btnInstall?.classList.add('hidden');
    btnLater?.classList.add('hidden');

    if (state === 'checking') {
      showWidget(true);
      setText('Updater', message || 'Checking for updates...');
      return;
    }

    if (state === 'update-available' || state === 'downloading') {
      showWidget(true);
      setText('Updater', message || `Downloading update${nextVersion}...`);
      if (updateProgress) {
        updateProgress.classList.remove('hidden');
        updateProgress.textContent = `${percent.toFixed(1)}%`;
      }
      return;
    }

    if (state === 'downloaded') {
      showWidget(true);
      setText('Updater', message || `Update${nextVersion} is ready to install.`);
      btnInstall?.classList.remove('hidden');
      btnLater?.classList.remove('hidden');
      return;
    }

    if (state === 'remind-later') {
      showWidget(true);
      setText('Updater', message || 'Update reminder snoozed.');
      return;
    }

    if (state === 'up-to-date') {
      showWidget(true);
      setText('Updater', message || 'You are on the latest version.');
      setTimeout(() => showWidget(false), 5000);
      return;
    }

    if (state === 'error') {
      showWidget(true);
      setText('Updater', message || 'Update check failed.');
      return;
    }

    showWidget(false);
  });

  showWidget(false);
  setText('Updater', 'Update status');
}

function updateUserPanel() {
  if (!currentUser) return;
  
  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  const userStatusEl = document.getElementById('userStatus');
  
  if (userNameEl) {
    userNameEl.textContent = currentUser.displayName || 'User';
  }
  
  if (userAvatarEl) {
    const normalizedAvatarUrl = normalizeAvatarUrl(currentUser.avatarUrl);
    currentUser.avatarUrl = normalizedAvatarUrl || null;
    // Check if we have an avatar URL
    if (normalizedAvatarUrl) {
      userAvatarEl.innerHTML = `<img src="${currentUser.avatarUrl}" alt="Avatar"><div class="status-dot"></div>`;
    } else {
      // Use initials
      const initials = getInitials(currentUser.displayName || 'User');
      userAvatarEl.innerHTML = `<span>${initials}</span><div class="status-dot"></div>`;
    }
  }
  
  if (userStatusEl) {
    userStatusEl.textContent = 'Online';
  }
  
  // Update local participant
  participants[0] = {
    ...participants[0],
    name: currentUser.displayName || 'You',
    avatar: getInitials(currentUser.displayName || 'You')
  };
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function normalizeAvatarUrl(avatarUrl = '') {
  const value = String(avatarUrl || '').trim();
  if (!value) return '';

  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (value === '/photos/wave.png' || value.endsWith('/photos/wave.png') || value.endsWith('wave.png')) {
    return 'https://coversehq.com/photos/wave.png';
  }

  return '';
}

const PROFILE_FIELD_KEYS = [
  'displayName', 'username', 'bio', 'location', 'genre', 'genres', 'role', 'roles',
  'website', 'instagram', 'twitter', 'photoURL', 'avatarUrl', 'daws',
  'acceptsAnyDaw', 'availability', 'travelRadius', 'rateRange', 'mediaLinks', 'links',
  'notifyEmail', 'notifyPush', 'playlists', 'savedSamples', 'projects'
];
const PROFILE_LIST_KEYS = new Set(['genres', 'roles', 'daws', 'playlists', 'savedSamples', 'projects']);
const PROFILE_STRUCTURED_KEYS = new Set(['mediaLinks', 'links']);

let profileApiRaw = null;
let profileBaseline = null;
let profileApiLibrary = [];

function parseListInput(value = '') {
  return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function parseStructuredInput(value = '') {
  const text = String(value || '').trim();
  if (!text) return [];
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      // fallback below
    }
  }
  return text.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
}

function mapProfileFromApi(raw = {}) {
  return {
    displayName: String(raw.displayName || currentUser?.displayName || ''),
    username: String(raw.username || ''),
    bio: String(raw.bio || ''),
    location: String(raw.location || ''),
    genre: String(raw.genre || ''),
    genres: Array.isArray(raw.genres) ? raw.genres : parseListInput(raw.genres || ''),
    role: String(raw.role || ''),
    roles: Array.isArray(raw.roles) ? raw.roles : parseListInput(raw.roles || ''),
    website: String(raw.website || ''),
    instagram: String(raw.instagram || ''),
    twitter: String(raw.twitter || ''),
    photoURL: String(raw.photoURL || raw.avatarUrl || ''),
    avatarUrl: String(raw.avatarUrl || raw.photoURL || ''),
    daws: Array.isArray(raw.daws) ? raw.daws : parseListInput(raw.daws || ''),
    acceptsAnyDaw: Boolean(raw.acceptsAnyDaw ?? raw.acceptsAnyDAW ?? false),
    availability: String(raw.availability || ''),
    travelRadius: String(raw.travelRadius || ''),
    rateRange: String(raw.rateRange || ''),
    mediaLinks: Array.isArray(raw.mediaLinks) || typeof raw.mediaLinks === 'object'
      ? (raw.mediaLinks || [])
      : parseStructuredInput(raw.mediaLinks || ''),
    links: Array.isArray(raw.links) || typeof raw.links === 'object'
      ? (raw.links || [])
      : parseStructuredInput(raw.links || ''),
    notifyEmail: Boolean(raw.notifyEmail ?? false),
    notifyPush: Boolean(raw.notifyPush ?? false),
    playlists: Array.isArray(raw.playlists) ? raw.playlists : parseListInput(raw.playlists || ''),
    savedSamples: Array.isArray(raw.savedSamples) ? raw.savedSamples : parseListInput(raw.savedSamples || ''),
    projects: Array.isArray(raw.projects) ? raw.projects : parseListInput(raw.projects || '')
  };
}

function profileValuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function getFirebaseIdToken(forceRefresh = false) {
  try {
    if (window.firebaseAuth?.currentUser?.getIdToken) {
      const token = await window.firebaseAuth.currentUser.getIdToken(!!forceRefresh);
      if (token) {
        localStorage.setItem('coverseIdToken', token);
        return token;
      }
    }
  } catch (_error) {
    // fallback below
  }
  return localStorage.getItem('coverseIdToken') || '';
}

function setProfileStatus(message, level = 'info') {
  const status = document.getElementById('profileStatus');
  if (!status) return;
  status.textContent = message || '';
  status.dataset.level = level;
}

function profileInputId(key) {
  return `profile_${key}`;
}

function populateProfileForm(profile = {}) {
  PROFILE_FIELD_KEYS.forEach((key) => {
    const input = document.getElementById(profileInputId(key));
    if (!input) return;
    const value = profile[key];

    if (input.type === 'checkbox') {
      input.checked = Boolean(value);
      return;
    }

    if (PROFILE_LIST_KEYS.has(key)) {
      input.value = Array.isArray(value) ? value.join(', ') : '';
      return;
    }

    if (PROFILE_STRUCTURED_KEYS.has(key)) {
      if (typeof value === 'string') {
        input.value = value;
      } else {
        try {
          input.value = JSON.stringify(value || [], null, 2);
        } catch (_error) {
          input.value = '';
        }
      }
      return;
    }

    input.value = value == null ? '' : String(value);
  });
}

function readProfileForm() {
  const next = {};
  PROFILE_FIELD_KEYS.forEach((key) => {
    const input = document.getElementById(profileInputId(key));
    if (!input) return;
    if (input.type === 'checkbox') {
      next[key] = Boolean(input.checked);
      return;
    }
    const raw = String(input.value || '').trim();
    if (PROFILE_LIST_KEYS.has(key)) {
      next[key] = parseListInput(raw);
      return;
    }
    if (PROFILE_STRUCTURED_KEYS.has(key)) {
      next[key] = parseStructuredInput(raw);
      return;
    }
    next[key] = raw;
  });
  return next;
}

function buildProfilePatch(previous = {}, next = {}) {
  const patch = {};
  PROFILE_FIELD_KEYS.forEach((key) => {
    if (!profileValuesEqual(previous[key], next[key])) {
      patch[key] = next[key];
    }
  });
  if (Object.prototype.hasOwnProperty.call(patch, 'acceptsAnyDaw')) {
    patch.acceptsAnyDAW = patch.acceptsAnyDaw;
  }
  return patch;
}

function applyProfileToCurrentUser(profile = {}) {
  if (!currentUser) return;
  currentUser = {
    ...currentUser,
    displayName: profile.displayName || profile.username || currentUser.displayName || 'User',
    username: profile.username || currentUser.username || '',
    bio: profile.bio || currentUser.bio || '',
    location: profile.location || currentUser.location || '',
    genre: profile.genre || currentUser.genre || '',
    avatarUrl: normalizeAvatarUrl(profile.avatarUrl || profile.photoURL || currentUser.avatarUrl || '') || null,
    photoURL: profile.photoURL || currentUser.photoURL || ''
  };
  updateUserPanel();
}

function handleProfileUnauthorized() {
  setProfileStatus('Session expired. Please sign in again.', 'error');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 1200);
}

async function profileApiRequest(path, { method = 'GET', body = null, retryOn401 = true } = {}) {
  const apiBase = getSiteApiBase();
  const token = await getFirebaseIdToken(false);
  if (!token) throw new Error('No Firebase token available.');

  const send = async (bearerToken) => {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${bearerToken}`
    };
    if (method !== 'GET') headers['Content-Type'] = 'application/json';
    return fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body || {})
    });
  };

  let response = await send(token);
  if (response.status === 401 && retryOn401) {
    const refreshed = await getFirebaseIdToken(true);
    if (!refreshed) {
      handleProfileUnauthorized();
      throw new Error('401 Unauthorized');
    }
    response = await send(refreshed);
  }

  if (response.status === 401) {
    handleProfileUnauthorized();
    throw new Error('401 Unauthorized');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Profile API failed (${response.status}) ${text}`.trim());
  }

  return response.json().catch(() => ({}));
}

async function fetchProfileFromApi() {
  const payload = await profileApiRequest('/api/getUserProfile', { method: 'GET' });
  return payload?.profile || payload?.user || payload?.data || payload || {};
}

async function hydrateProfileFromApi({ silent = false } = {}) {
  try {
    profileApiRaw = await fetchProfileFromApi();
    profileBaseline = mapProfileFromApi(profileApiRaw);
    populateProfileForm(profileBaseline);
    applyProfileToCurrentUser(profileBaseline);
    renderProfileDashboard();
    if (!silent) setProfileStatus('Profile loaded from API.', 'success');
    return true;
  } catch (error) {
    if (!silent) setProfileStatus(error?.message || 'Failed to load profile.', 'error');
    return false;
  }
}

function ensureProfileModal() {
  if (document.getElementById('profileModal')) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'profileModal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:760px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
      <div class="modal-header"><h2>My Profile</h2><p>Synced with Coverse API</p></div>
      <div class="modal-body" style="overflow-y:auto;">
        <div class="form-group"><label class="form-label">Display Name</label><input class="form-input" id="profile_displayName"></div>
        <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="profile_username"></div>
        <div class="form-group"><label class="form-label">Bio</label><textarea class="form-input" id="profile_bio" rows="3"></textarea></div>
        <div class="form-group"><label class="form-label">Location</label><input class="form-input" id="profile_location"></div>
        <div class="form-group"><label class="form-label">Genre</label><input class="form-input" id="profile_genre"></div>
        <div class="form-group"><label class="form-label">Genres (comma separated)</label><input class="form-input" id="profile_genres"></div>
        <div class="form-group"><label class="form-label">Role</label><input class="form-input" id="profile_role"></div>
        <div class="form-group"><label class="form-label">Roles (comma separated)</label><input class="form-input" id="profile_roles"></div>
        <div class="form-group"><label class="form-label">Website</label><input class="form-input" id="profile_website"></div>
        <div class="form-group"><label class="form-label">Instagram</label><input class="form-input" id="profile_instagram"></div>
        <div class="form-group"><label class="form-label">Twitter</label><input class="form-input" id="profile_twitter"></div>
        <div class="form-group"><label class="form-label">Photo URL</label><input class="form-input" id="profile_photoURL"></div>
        <div class="form-group"><label class="form-label">Avatar URL</label><input class="form-input" id="profile_avatarUrl"></div>
        <div class="form-group"><label class="form-label">DAWs (comma separated)</label><input class="form-input" id="profile_daws"></div>
        <div class="form-group"><label class="form-label"><input type="checkbox" id="profile_acceptsAnyDaw"> Accepts Any DAW</label></div>
        <div class="form-group"><label class="form-label">Availability</label><input class="form-input" id="profile_availability"></div>
        <div class="form-group"><label class="form-label">Travel Radius</label><input class="form-input" id="profile_travelRadius"></div>
        <div class="form-group"><label class="form-label">Rate Range</label><input class="form-input" id="profile_rateRange"></div>
        <div class="form-group"><label class="form-label">Media Links (JSON or comma/newline)</label><textarea class="form-input" id="profile_mediaLinks" rows="3"></textarea></div>
        <div class="form-group"><label class="form-label">Links (JSON or comma/newline)</label><textarea class="form-input" id="profile_links" rows="3"></textarea></div>
        <div class="form-group"><label class="form-label"><input type="checkbox" id="profile_notifyEmail"> Notify Email</label></div>
        <div class="form-group"><label class="form-label"><input type="checkbox" id="profile_notifyPush"> Notify Push</label></div>
        <div class="form-group"><label class="form-label">Playlists (comma separated)</label><input class="form-input" id="profile_playlists"></div>
        <div class="form-group"><label class="form-label">Saved Samples (comma separated)</label><input class="form-input" id="profile_savedSamples"></div>
        <div class="form-group"><label class="form-label">Projects (comma separated)</label><input class="form-input" id="profile_projects"></div>
        <div class="form-group"><div id="profileStatus" class="library-status" data-level="info"></div></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="btnProfileReload">Reload</button>
        <button class="btn btn-secondary" id="btnCancelProfile">Cancel</button>
        <button class="btn btn-primary" id="btnSaveProfile">Save Profile</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal('profileModal');
  });

  document.getElementById('btnCancelProfile')?.addEventListener('click', () => closeModal('profileModal'));
  document.getElementById('btnProfileReload')?.addEventListener('click', async () => {
    setProfileStatus('Refreshing profile...', 'info');
    await hydrateProfileFromApi({ silent: false });
  });

  document.getElementById('btnSaveProfile')?.addEventListener('click', async () => {
    await saveProfileChanges();
  });
}

async function openUserProfileModal() {
  ensureProfileModal();
  openModal('profileModal');
  if (profileBaseline) {
    populateProfileForm(profileBaseline);
    setProfileStatus('Loaded cached profile. Refreshing...', 'info');
  } else {
    setProfileStatus('Loading profile...', 'info');
  }
  await hydrateProfileFromApi({ silent: false });
}

async function loadUserData() {
  if (!currentUser) return;
  
  try {
    // Load user's sessions from Firebase
    await loadUserSessions();
    
    // Load friends list
    await loadFriends();
    
    // Load pending friend requests
    await loadPendingRequests();
    
    // Load conversations (DMs)
    await loadConversations();

    // Load app cloud/cache library metadata
    await loadRemoteLibraryItems();
    await loadSiteLibraryItems();
    await refreshSimpleProfileSections(currentUser.uid);
    await hydrateLibraryMedia();
    renderLibrary();
    renderProfileDashboard();
    if (!homeFeedItemsCache.length) {
      await refreshHomeFeedView({ force: false });
    } else {
      refreshHomeFeedActionStates();
    }

    console.log('[Coverse] User data loaded');
  } catch (error) {
    console.error('[Coverse] Error loading user data:', error);
  } finally {
    initInviteNotificationSync();
    initFollowNotificationSync();
  }
}

async function loadUserSessions() {
  const cachedSessions = loadSessionsFromStorage();
  const cachedById = new Map(cachedSessions.map((session) => [session.id, session]));
  if (cachedSessions.length > 0) {
    sessions = cachedSessions;
    renderSessionBar();
  }

  if (!currentUser || !window.firebaseDb) {
    if (sessions.length === 0) {
      sessions = [
        {
          id: 'my-studio',
          name: `${currentUser?.displayName || 'My'} Studio`,
          icon: getInitials(currentUser?.displayName || 'MS'),
          textChannels: DEFAULT_TEXT_CHANNELS.slice(),
          voiceChannels: DEFAULT_VOICE_CHANNELS.slice()
        }
      ];
      saveSessionsToStorage();
      renderSessionBar();
    }
    restoreLastSessionSelection();
    return;
  }

  try {
    const db = window.firebaseDb;
    const sessionsRef = window.firebaseCollection(db, 'sessions');
    const q = window.firebaseQuery(
      sessionsRef,
      window.firebaseWhere('memberIds', 'array-contains', currentUser.uid)
    );
    const snapshot = await window.firebaseGetDocs(q);

    const cloudSessions = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      cloudSessions.push({
        id: docSnap.id,
        name: data.name || 'Session',
        icon: data.icon || getInitials(data.name || 'S'),
        textChannels: data.textChannels || DEFAULT_TEXT_CHANNELS.slice(),
        voiceChannels: data.voiceChannels || DEFAULT_VOICE_CHANNELS.slice(),
        inviteCode: data.inviteCode || '',
        ownerUid: data.ownerUid || ''
      });
    });

    cloudSessions.forEach((session) => {
      const inviteCode = String(session.inviteCode || '').trim().toUpperCase();
      if (!inviteCode) return;
      persistSessionInviteCodeRecord(session.id, inviteCode, {
        sessionName: session.name || 'Session',
        ownerUid: session.ownerUid || currentUser?.uid || ''
      });
    });

    const merged = new Map(cachedById);
    cloudSessions.forEach((session) => {
      merged.set(session.id, {
        ...(merged.get(session.id) || {}),
        ...session
      });
    });
    sessions = Array.from(merged.values());

    if (sessions.length === 0) {
      sessions = [
        {
          id: 'my-studio',
          name: `${currentUser.displayName}'s Studio`,
          icon: getInitials(currentUser.displayName || 'MS'),
          textChannels: DEFAULT_TEXT_CHANNELS.slice(),
          voiceChannels: DEFAULT_VOICE_CHANNELS.slice()
        }
      ];
    }

    saveSessionsToStorage();
    renderSessionBar();
    restoreLastSessionSelection();
  } catch (error) {
    console.error('[Coverse] Failed to load sessions:', error);
    if (sessions.length > 0) {
      renderSessionBar();
      restoreLastSessionSelection();
    }
  }
}

function saveSessionsToStorage() {
  try {
    const safeSessions = sessions.map((session) => ({
      id: session.id,
      name: session.name,
      icon: session.icon,
      textChannels: session.textChannels || DEFAULT_TEXT_CHANNELS.slice(),
      voiceChannels: session.voiceChannels || DEFAULT_VOICE_CHANNELS.slice(),
      inviteCode: session.inviteCode || '',
      ownerUid: session.ownerUid || '',
      roles: session.roles || {}
    }));
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(safeSessions));
  } catch (error) {
    console.warn('[Coverse] Could not cache sessions:', error);
  }
}

function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((session) => session && session.id && session.name);
  } catch (error) {
    console.warn('[Coverse] Could not load cached sessions:', error);
    return [];
  }
}

function saveLastSessionSelection(sessionId) {
  if (!sessionId) return;
  try {
    localStorage.setItem(LAST_SESSION_KEY, sessionId);
  } catch (error) {
    console.warn('[Coverse] Could not save last session:', error);
  }
}

function restoreLastSessionSelection() {
  if (!sessions.length) return;

  let savedId = '';
  try {
    savedId = localStorage.getItem(LAST_SESSION_KEY) || '';
  } catch (error) {
    savedId = '';
  }

  const sessionToSelect =
    sessions.find((session) => session.id === savedId) ||
    sessions.find((session) => session.id === lastSessionId) ||
    sessions[0] ||
    null;

  if (sessionToSelect) {
    selectSession(sessionToSelect.id);
  }
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function resolveInviteTargetSession() {
  if (currentSession) return currentSession;

  if (lastSessionId) {
    const last = sessions.find((session) => session.id === lastSessionId);
    if (last) return last;
  }

  return sessions.length > 0 ? sessions[0] : null;
}

async function persistSessionInviteCodeRecord(sessionId, inviteCode, options = {}) {
  const normalizedSessionId = String(sessionId || '').trim();
  const normalizedInviteCode = String(inviteCode || '').trim().toUpperCase();
  const sessionName = String(options.sessionName || 'Session').trim() || 'Session';
  const ownerUid = String(options.ownerUid || currentUser?.uid || '').trim();

  if (!normalizedSessionId || !normalizedInviteCode || !ownerUid || !window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
    return false;
  }

  try {
    await window.firebaseSetDoc(
      window.firebaseDoc(window.firebaseDb, 'sessionInviteCodes', normalizedInviteCode),
      {
        inviteCode: normalizedInviteCode,
        sessionId: normalizedSessionId,
        sessionName,
        ownerUid,
        updatedAt: new Date(),
        createdAt: new Date()
      },
      { merge: true }
    );

    return true;
  } catch (error) {
    console.warn('[Coverse] Could not persist invite code record:', error);
    return false;
  }
}

async function ensureSessionInviteCode(session) {
  if (!session) return '';

  const sessionName = String(session.name || 'Session').trim() || 'Session';
  const ownerUid = String(session.ownerUid || currentUser?.uid || '').trim();

  if (session.inviteCode) {
    await persistSessionInviteCodeRecord(session.id, session.inviteCode, {
      sessionName,
      ownerUid
    });
    return String(session.inviteCode || '').trim().toUpperCase();
  }

  const inviteCode = generateInviteCode();
  session.inviteCode = inviteCode;

  const sessionIndex = sessions.findIndex((s) => s.id === session.id);
  if (sessionIndex >= 0) {
    sessions[sessionIndex].inviteCode = inviteCode;
  }
  saveSessionsToStorage();

  if (window.firebaseDb && session.id) {
    try {
      await window.firebaseSetDoc(
        window.firebaseDoc(window.firebaseDb, 'sessions', session.id),
        {
          inviteCode,
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('[Coverse] Could not persist invite code:', error);
    }

    await persistSessionInviteCodeRecord(session.id, inviteCode, {
      sessionName,
      ownerUid
    });
  }

  return inviteCode;
}

async function copyCurrentSessionInvite() {
  const options = arguments[0] || {};
  const codeOnly = options.codeOnly === true;
  const quiet = options.quiet === true;

  const targetSession = resolveInviteTargetSession();
  if (!targetSession) {
    if (!quiet) {
      showNotification('Select a session first to copy an invite.');
    }
    return null;
  }

  const inviteCode = await ensureSessionInviteCode(targetSession);
  if (!inviteCode) {
    if (!quiet) {
      showNotification('Unable to generate invite code.');
    }
    return null;
  }

  const inviteText = buildSessionInviteText(targetSession, inviteCode);
  const valueToCopy = codeOnly ? inviteCode : inviteText;
  const copied = await copyTextToClipboard(valueToCopy, inviteCode);

  if (!quiet) {
    showNotification(copied ? (codeOnly ? 'Invite code copied.' : 'Session invite message copied.') : 'Copied invite shown in prompt.');
  }

  return {
    targetSession,
    inviteCode,
    inviteText
  };
}

function buildSessionInviteText(targetSession, inviteCode) {
  const sessionName = String(targetSession?.name || 'Session').trim() || 'Session';
  const code = String(inviteCode || '').trim().toUpperCase();
  return `Join my Coverse session "${sessionName}" with invite code: ${code}`;
}

async function copyTextToClipboard(value, fallbackValue = '') {
  const text = String(value || '').trim();
  if (!text) return false;

  let copied = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (error) {
      console.warn('[Coverse] Clipboard write failed:', error);
    }
  }

  if (!copied) {
    const fallbackText = String(fallbackValue || text || '').trim();
    try {
      if (window.prompt) {
        window.prompt('Copy this text:', fallbackText);
      }
    } catch (_error) {
      // no-op
    }
  }

  return copied;
}

function resetSessionInviteSearch() {
  if (sessionInviteSearchTimer) {
    clearTimeout(sessionInviteSearchTimer);
    sessionInviteSearchTimer = null;
  }

  const friendFilterInput = document.getElementById('sessionInviteFriendFilter');
  const userSearchInput = document.getElementById('sessionInviteUserSearch');
  const userResults = document.getElementById('sessionInviteUserResults');

  if (friendFilterInput) friendFilterInput.value = '';
  if (userSearchInput) userSearchInput.value = '';
  if (userResults) userResults.innerHTML = '';
}

function getSessionInviteRecipientName(uid) {
  const targetUid = String(uid || '').trim();
  if (!targetUid) return 'collaborator';

  const friend = userFriends.find((entry) => String(entry.uid || entry.id || '').trim() === targetUid);
  if (friend?.displayName) return friend.displayName;
  if (currentDMUser?.uid === targetUid && currentDMUser?.displayName) return currentDMUser.displayName;
  return 'collaborator';
}

async function sendSessionInviteMessageToUser(targetUid, targetSession, inviteCode, options = {}) {
  const openView = options.openView === true;
  const recipientUid = String(targetUid || '').trim();
  if (!recipientUid || !currentUser || !window.firebaseDb) return false;

  try {
    const conversation = await openDMWithUser(recipientUid, { openView });
    const conversationId = String(conversation?.id || '').trim();
    if (!conversationId) return false;

    const db = window.firebaseDb;
    const sessionName = String(targetSession?.name || 'Session').trim() || 'Session';
    const normalizedCode = String(inviteCode || '').trim().toUpperCase();
    const messageText = `🎵 Session invite: ${sessionName}\nInvite code: ${normalizedCode}`;
    const previewText = `Session invite: ${sessionName} (${normalizedCode})`;

    await window.firebaseAddDoc(window.firebaseCollection(db, 'messages'), {
      conversationId,
      senderId: currentUser.uid,
      receiverId: recipientUid,
      fromUid: currentUser.uid,
      toUid: recipientUid,
      senderName: String(currentUser.displayName || currentUser.email || 'Collaborator').trim() || 'Collaborator',
      text: messageText,
      kind: 'session_invite',
      inviteCode: normalizedCode,
      inviteSessionId: String(targetSession?.id || '').trim(),
      inviteSessionName: sessionName,
      timestamp: new Date(),
      createdAt: new Date()
    });

    await window.firebaseSetDoc(
      window.firebaseDoc(db, 'conversations', conversationId),
      {
        lastMessage: previewText,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      },
      { merge: true }
    );

    if (currentConversationId === conversationId) {
      const messages = await loadMessages(conversationId, recipientUid);
      renderDMMessages(messages);
    }

    await loadConversations();
    return true;
  } catch (error) {
    console.warn('[Coverse] Could not send invite in DM:', error);
    return false;
  }
}

async function getUserDisplayNameByUid(uid) {
  const targetUid = String(uid || '').trim();
  if (!targetUid) return 'User';

  if (targetUid === String(currentUser?.uid || '').trim()) {
    return String(currentUser?.displayName || currentUser?.email || 'You').trim() || 'You';
  }

  const friend = userFriends.find((entry) => String(entry.uid || entry.id || '').trim() === targetUid);
  if (friend?.displayName) return String(friend.displayName).trim() || 'User';

  const conversation = userConversations.find((entry) => String(entry.otherUid || entry.otherUser?.uid || '').trim() === targetUid);
  if (conversation?.otherUser?.displayName) {
    return String(conversation.otherUser.displayName).trim() || 'User';
  }

  if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseGetDoc) return 'User';

  try {
    const userDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'users', targetUid));
    if (userDoc.exists()) {
      const userData = userDoc.data() || {};
      return String(userData.displayName || userData.username || userData.email || 'User').trim() || 'User';
    }
  } catch (_error) {
    // no-op
  }

  return 'User';
}

function stopFollowNotificationSync() {
  if (typeof followNotificationsUnsubscribe === 'function') {
    followNotificationsUnsubscribe();
  }
  followNotificationsUnsubscribe = null;
  followNotificationsPrimed = false;
  seenFollowNotificationIds = new Set();
}

function initFollowNotificationSync() {
  stopFollowNotificationSync();

  if (
    !currentUser?.uid ||
    !window.firebaseDb ||
    !window.firebaseOnSnapshot ||
    !window.firebaseCollection ||
    !window.firebaseQuery ||
    !window.firebaseWhere
  ) {
    return;
  }

  try {
    const db = window.firebaseDb;
    const syncStartedAtMs = Date.now();
    const followsRef = window.firebaseCollection(db, 'follows');
    const incomingFollowsQuery = window.firebaseQuery(
      followsRef,
      window.firebaseWhere('following', '==', currentUser.uid)
    );

    followNotificationsUnsubscribe = window.firebaseOnSnapshot(
      incomingFollowsQuery,
      async (snapshot) => {
        if (!followNotificationsPrimed) {
          snapshot.forEach((docSnap) => {
            seenFollowNotificationIds.add(docSnap.id);
          });
          followNotificationsPrimed = true;
          return;
        }

        const addedChanges = snapshot.docChanges().filter((change) => (
          change.type === 'added' && !seenFollowNotificationIds.has(change.doc.id)
        ));

        if (!addedChanges.length) {
          return;
        }

        if (addedChanges.length > 8) {
          addedChanges.forEach((change) => {
            seenFollowNotificationIds.add(change.doc.id);
          });
          Promise.all([loadFriends(), loadConversations()]).catch(() => {});
          return;
        }

        let hasIncomingChanges = false;

        for (const change of addedChanges) {
          seenFollowNotificationIds.add(change.doc.id);

          const data = change.doc.data() || {};
          const followerUid = String(data.follower || '').trim();
          if (!followerUid || followerUid === currentUser.uid) continue;

          const createdAtMs = getTimestampMs(data.createdAt || data.updatedAt || data.timestamp);
          if (createdAtMs > 0 && createdAtMs < (syncStartedAtMs - 15000)) {
            continue;
          }

          hasIncomingChanges = true;
          const followerName = await getUserDisplayNameByUid(followerUid);
          const existingFriend = userFriends.find((entry) => String(entry.uid || entry.id || '').trim() === followerUid);
          const alreadyConnected = existingFriend?.status === 'mutual' || existingFriend?.status === 'following';

          showNotification(
            alreadyConnected
              ? `${followerName} followed you back. You can message each other now.`
              : `${followerName} added you.`,
            {
              level: 'info',
              actionLabel: 'Message',
              action: () => openDMWithUser(followerUid)
            }
          );
        }

        if (hasIncomingChanges) {
          Promise.all([loadFriends(), loadConversations()]).catch(() => {});
        }
      },
      (error) => {
        console.warn('[Coverse] Follow notification listener failed:', error);
      }
    );
  } catch (error) {
    console.warn('[Coverse] Could not start follow notifications:', error);
  }
}

function stopInviteNotificationSync() {
  if (typeof inviteNotificationsUnsubscribe === 'function') {
    inviteNotificationsUnsubscribe();
  }
  inviteNotificationsUnsubscribe = null;
  inviteNotificationPrimed = false;
  seenInviteNotificationIds = new Set();
}

function initInviteNotificationSync() {
  stopInviteNotificationSync();

  if (
    !currentUser?.uid ||
    !window.firebaseDb ||
    !window.firebaseOnSnapshot ||
    !window.firebaseCollection ||
    !window.firebaseQuery ||
    !window.firebaseWhere
  ) {
    return;
  }

  try {
    const db = window.firebaseDb;
    const messagesRef = window.firebaseCollection(db, 'messages');
    const inviteQuery = window.firebaseQuery(
      messagesRef,
      window.firebaseWhere('toUid', '==', currentUser.uid)
    );

    inviteNotificationsUnsubscribe = window.firebaseOnSnapshot(
      inviteQuery,
      (snapshot) => {
        if (!inviteNotificationPrimed) {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (String(data.kind || '').trim() === 'session_invite') {
              seenInviteNotificationIds.add(docSnap.id);
            }
          });
          inviteNotificationPrimed = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          if (seenInviteNotificationIds.has(change.doc.id)) return;

          const data = change.doc.data() || {};
          if (String(data.kind || '').trim() !== 'session_invite') return;

          seenInviteNotificationIds.add(change.doc.id);
          const senderName = String(data.senderName || data.fromDisplayName || 'Someone').trim() || 'Someone';
          const inviteCode = String(data.inviteCode || '').trim().toUpperCase();
          const sessionName = String(data.inviteSessionName || 'Session').trim() || 'Session';

          if (inviteCode) {
            showNotification(`${senderName} invited you to ${sessionName}.`, {
              level: 'info',
              actionLabel: 'Join',
              action: () => joinSessionInviteFromMessage(inviteCode, { confirm: true })
            });
          } else {
            showNotification(`${senderName} sent you a session invite.`);
          }
        });
      },
      (error) => {
        console.warn('[Coverse] Invite notification listener failed:', error);
      }
    );
  } catch (error) {
    console.warn('[Coverse] Could not start invite notifications:', error);
  }
}

async function inviteFriendToCurrentSession(friendUid, options = {}) {
  const sendDmMessage = options.sendDmMessage !== false;
  const openDm = options.openDm === true;
  const quiet = options.quiet === true;

  if (!friendUid) return;

  const targetSession = resolveInviteTargetSession();
  if (!targetSession) {
    if (!quiet) {
      showNotification('Create or select a session first.');
    }
    return null;
  }

  const inviteCode = await ensureSessionInviteCode(targetSession);
  if (!inviteCode) {
    if (!quiet) {
      showNotification('Could not prepare a session invite.');
    }
    return null;
  }

  const friend = userFriends.find((f) => (f.uid || f.id) === friendUid);
  const friendName = friend?.displayName || 'your friend';
  let firestoreInviteSent = false;
  let dmInviteSent = false;

  if (!currentUser || !window.firebaseDb) {
    await copyTextToClipboard(inviteCode, inviteCode);
    if (!quiet) {
      showNotification(`Share this invite code with ${friendName}: ${inviteCode}`);
    }
    return {
      inviteCode,
      firestoreInviteSent,
      dmInviteSent
    };
  }

  try {
    const db = window.firebaseDb;
    const inviteId = `${targetSession.id}_${friendUid}_${Date.now().toString(36)}`;

    await window.firebaseSetDoc(
      window.firebaseDoc(db, 'sessionInvites', inviteId),
      {
        id: inviteId,
        sessionId: targetSession.id,
        sessionName: targetSession.name || 'Session',
        inviteCode,
        fromUid: currentUser.uid,
        senderId: currentUser.uid,
        toUid: friendUid,
        receiverId: friendUid,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { merge: true }
    );

    firestoreInviteSent = true;
  } catch (error) {
    console.error('[Coverse] Failed to send session invite:', error);
  }

  if (sendDmMessage) {
    dmInviteSent = await sendSessionInviteMessageToUser(friendUid, targetSession, inviteCode, { openView: openDm });
  }

  if (!quiet) {
    if (firestoreInviteSent && dmInviteSent) {
      showNotification(`Invite sent to ${friendName} and shared in messages.`);
    } else if (firestoreInviteSent) {
      showNotification(`Invite sent to ${friendName}.`);
    } else if (dmInviteSent) {
      showNotification(`Invite shared in messages with ${friendName}.`);
    } else {
      await copyTextToClipboard(inviteCode, inviteCode);
      showNotification(`Could not send directly. Share code ${inviteCode} with ${friendName}.`);
    }
  }

  return {
    inviteCode,
    firestoreInviteSent,
    dmInviteSent
  };
}

function renderSessionInviteFriendList() {
  const container = document.getElementById('sessionInviteFriendsList');
  if (!container) return;

  const filterValue = String(document.getElementById('sessionInviteFriendFilter')?.value || '').trim().toLowerCase();
  const source = Array.isArray(userFriends) ? userFriends.slice() : [];

  const filtered = source
    .filter((friend) => {
      if (!filterValue) return true;
      const name = String(friend.displayName || '').toLowerCase();
      const email = String(friend.email || '').toLowerCase();
      return name.includes(filterValue) || email.includes(filterValue);
    })
    .sort((a, b) => {
      if (Boolean(a.isOnline) !== Boolean(b.isOnline)) {
        return a.isOnline ? -1 : 1;
      }
      return String(a.displayName || '').localeCompare(String(b.displayName || ''));
    });

  if (!filtered.length) {
    container.innerHTML = '<div class="session-invite-empty">No friends found.</div>';
    return;
  }

  container.innerHTML = filtered.map((friend) => {
    const uid = String(friend.uid || friend.id || '').trim();
    if (!uid) return '';
    const avatar = friend.avatarUrl
      ? `<img src="${friend.avatarUrl}" alt="">`
      : `<span>${getInitials(friend.displayName || 'U')}</span>`;

    return `
      <div class="session-invite-item">
        <div class="session-invite-item-avatar">${avatar}</div>
        <div class="session-invite-item-meta">
          <div class="session-invite-item-name">${escapeHtml(friend.displayName || 'User')}</div>
          <div class="session-invite-item-sub">${escapeHtml(friend.email || getConnectionStatusText(friend) || '')}</div>
        </div>
        <button class="session-invite-send-btn" data-user-id="${uid}" data-source="friends">Invite</button>
      </div>
    `;
  }).join('');
}

function renderSessionInviteUserResults(results = []) {
  const container = document.getElementById('sessionInviteUserResults');
  if (!container) return;

  const source = Array.isArray(results) ? results : [];
  if (!source.length) {
    const query = String(document.getElementById('sessionInviteUserSearch')?.value || '').trim();
    container.innerHTML = `<div class="session-invite-empty">${query.length >= 2 ? 'No users found.' : 'Search users to invite.'}</div>`;
    return;
  }

  container.innerHTML = source.map((user) => {
    const uid = String(user.uid || user.id || '').trim();
    if (!uid) return '';
    const avatarUrl = normalizeAvatarUrl(user.avatarUrl || user.photoURL || '');
    const avatar = avatarUrl
      ? `<img src="${avatarUrl}" alt="">`
      : `<span>${getInitials(user.displayName || 'U')}</span>`;

    return `
      <div class="session-invite-item">
        <div class="session-invite-item-avatar">${avatar}</div>
        <div class="session-invite-item-meta">
          <div class="session-invite-item-name">${escapeHtml(user.displayName || 'User')}</div>
          <div class="session-invite-item-sub">${escapeHtml(user.email || '')}</div>
        </div>
        <button class="session-invite-send-btn" data-user-id="${uid}" data-source="search">Invite</button>
      </div>
    `;
  }).join('');
}

async function handleSessionInviteToUser(targetUid, source = 'friends') {
  const normalizedUid = String(targetUid || '').trim();
  if (!normalizedUid) return;

  const recipientName = getSessionInviteRecipientName(normalizedUid);
  const result = await inviteFriendToCurrentSession(normalizedUid, {
    sendDmMessage: true,
    openDm: false,
    quiet: true,
    source
  });

  if (!result) return;

  if (result.firestoreInviteSent && result.dmInviteSent) {
    showNotification(`Invite sent to ${recipientName} and shared in messages.`);
  } else if (result.firestoreInviteSent) {
    showNotification(`Invite sent to ${recipientName}.`);
  } else if (result.dmInviteSent) {
    showNotification(`Invite shared in messages with ${recipientName}.`);
  } else {
    showNotification(`Could not send directly. Share code ${result.inviteCode || ''} with ${recipientName}.`);
  }
}

async function inviteDmUserToCurrentSession(userId) {
  const targetUid = String(userId || '').trim();
  if (!targetUid) return;
  await handleSessionInviteToUser(targetUid, 'dm-list');
}

async function inviteCurrentDmUserToSession() {
  const targetUid = String(
    currentDMUser?.uid ||
    userConversations.find((conv) => conv.id === currentConversationId)?.otherUid ||
    ''
  ).trim();

  if (!targetUid) {
    showNotification('Open a direct message first.');
    return;
  }

  const result = await inviteFriendToCurrentSession(targetUid, {
    sendDmMessage: true,
    openDm: true,
    quiet: true,
    source: 'dm-header'
  });

  const recipientName = getSessionInviteRecipientName(targetUid);
  if (result?.firestoreInviteSent || result?.dmInviteSent) {
    showNotification(`Session invite sent to ${recipientName}.`);
  } else if (result?.inviteCode) {
    showNotification(`Could not send directly. Share code ${result.inviteCode} with ${recipientName}.`);
  }
}

async function openSessionInviteModal() {
  const targetSession = resolveInviteTargetSession();
  if (!targetSession) {
    showNotification('Select a session first to send invites.');
    return;
  }

  const inviteCode = await ensureSessionInviteCode(targetSession);
  if (!inviteCode) {
    showNotification('Could not prepare invite code.');
    return;
  }

  const titleEl = document.getElementById('sessionInviteSessionName');
  const codeInput = document.getElementById('sessionInviteCode');
  if (titleEl) {
    titleEl.textContent = `Session: ${targetSession.name || 'Session'}`;
  }
  if (codeInput) {
    codeInput.value = inviteCode;
  }

  resetSessionInviteSearch();
  renderSessionInviteFriendList();
  renderSessionInviteUserResults([]);
  openModal('sessionInviteModal');
}

async function loadFriends() {
  if (!currentUser || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    userFriends = [];
    
    // Load from 'follows' collection (matches web app structure)
    // Get people I'm following
    const followingRef = window.firebaseCollection(db, 'follows');
    const followingQuery = window.firebaseQuery(
      followingRef,
      window.firebaseWhere('follower', '==', currentUser.uid)
    );
    const followingSnap = await window.firebaseGetDocs(followingQuery);
    
    // Get people following me
    const followersQuery = window.firebaseQuery(
      followingRef,
      window.firebaseWhere('following', '==', currentUser.uid)
    );
    const followersSnap = await window.firebaseGetDocs(followersQuery);
    
    // Build sets for mutual detection
    const iFollow = new Set();
    const followsMe = new Set();
    
    followingSnap.forEach(doc => {
      iFollow.add(doc.data().following);
    });
    
    followersSnap.forEach(doc => {
      followsMe.add(doc.data().follower);
    });
    
    // Collect all unique user IDs
    const allUserIds = new Set([...iFollow, ...followsMe]);
    
    // Fetch user profiles for all connections
    for (const userId of allUserIds) {
      try {
        const userDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const isMutual = iFollow.has(userId) && followsMe.has(userId);
          
          userFriends.push({
            id: userId,
            uid: userId,
            displayName: userData.displayName || userData.username || 'User',
            avatarUrl: normalizeAvatarUrl(userData.avatarUrl || userData.photoURL || ''),
            email: userData.email || '',
            status: isMutual ? 'mutual' : (iFollow.has(userId) ? 'following' : 'follower'),
            isOnline: userData.isOnline || false
          });
        }
      } catch (e) {
        console.log('[Coverse] Could not load user:', userId);
      }
    }
    
    console.log('[Coverse] Loaded connections:', userFriends.length, '(from follows collection)');
    renderFriendsList();
    
  } catch (error) {
    console.error('[Coverse] Error loading friends:', error);
    userFriends = [];
    renderFriendsList();
  }
}

async function loadConversations() {
  if (!currentUser || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    
    // Load conversations where user is a participant
    // Structure: conversations collection with participants array
    const convRef = window.firebaseCollection(db, 'conversations');
    const q = window.firebaseQuery(
      convRef, 
      window.firebaseWhere('participants', 'array-contains', currentUser.uid)
    );
    const snapshot = await window.firebaseGetDocs(q);
    
    const conversationMap = new Map();

    const toMillis = (value) => {
      if (!value) return 0;
      if (typeof value?.toMillis === 'function') return value.toMillis();
      const date = new Date(value);
      const ms = date.getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    const getConversationActivityMs = (conv) => {
      return (
        toMillis(conv.lastMessageAt) ||
        toMillis(conv.updatedAt) ||
        toMillis(conv.createdAt) ||
        0
      );
    };

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Get the other participant's info
      const otherUid = data.participants?.find(p => p !== currentUser.uid);
      let otherUser = null;
      
      if (otherUid) {
        try {
          const userDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'users', otherUid));
          if (userDoc.exists()) {
            const rawUser = userDoc.data() || {};
            otherUser = {
              uid: otherUid,
              ...rawUser,
              avatarUrl: normalizeAvatarUrl(rawUser.avatarUrl || rawUser.photoURL || '')
            };
          } else {
            otherUser = { uid: otherUid };
          }
        } catch (e) {
          console.log('[Coverse] Could not load user:', otherUid);
          otherUser = { uid: otherUid };
        }
      }
      
      const conversation = {
        id: doc.id,
        ...data,
        otherUid,
        otherUser
      };

      const pairKey = otherUid
        ? [currentUser.uid, otherUid].sort().join('::')
        : doc.id;
      const existing = conversationMap.get(pairKey);
      if (!existing || getConversationActivityMs(conversation) >= getConversationActivityMs(existing)) {
        conversationMap.set(pairKey, conversation);
      }
    }

    userConversations = Array.from(conversationMap.values()).sort((a, b) => {
      const aMs =
        (typeof a.lastMessageAt?.toMillis === 'function' ? a.lastMessageAt.toMillis() : new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime()) || 0;
      const bMs =
        (typeof b.lastMessageAt?.toMillis === 'function' ? b.lastMessageAt.toMillis() : new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime()) || 0;
      return bMs - aMs;
    });
    
    console.log('[Coverse] Loaded conversations:', userConversations.length);
    renderDMList();
    
  } catch (error) {
    console.log('[Coverse] Conversations not found or empty');
    userConversations = [];
    renderDMList();
  }
}

async function loadMessages(conversationId, otherUserId = '') {
  if (!conversationId || !window.firebaseDb) return [];

  const db = window.firebaseDb;
  const messages = [];
  const seenIds = new Set();

  const pushMessage = (docId, data = {}, idPrefix = '') => {
    const key = `${idPrefix}${docId}`;
    if (seenIds.has(key)) return;
    seenIds.add(key);
    messages.push({
      id: key,
      senderId: data.senderId || data.fromUid || data.sender || data.from || '',
      text: data.text || data.content || data.message || '',
      timestamp: data.timestamp || data.createdAt || data.sentAt || data.date || null,
      ...data
    });
  };

  const addSnapshot = (snapshot, prefix = '') => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      pushMessage(docSnap.id, data, prefix);
    });
  };

  const messagesRef = window.firebaseCollection(db, 'messages');

  try {
    const q = window.firebaseQuery(
      messagesRef,
      window.firebaseWhere('conversationId', '==', conversationId)
    );
    const snapshot = await window.firebaseGetDocs(q);
    addSnapshot(snapshot);
  } catch (error) {
    console.debug('[Coverse] Primary message query skipped:', error?.message || error);
  }

  if (messages.length === 0) {
    try {
      const convDocRef = window.firebaseDoc(db, 'conversations', conversationId);
      const legacyRef = window.firebaseCollection(convDocRef, 'messages');
      const legacySnap = await window.firebaseGetDocs(legacyRef);
      addSnapshot(legacySnap, 'legacy_');
    } catch (error) {
      console.debug('[Coverse] Legacy message query skipped:', error?.message || error);
    }
  }

  if (messages.length === 0 && otherUserId && currentUser?.uid) {
    const me = currentUser.uid;
    const pairs = [
      ['senderId', 'receiverId'],
      ['fromUid', 'toUid'],
      ['sender', 'receiverId'],
      ['sender', 'toUid']
    ];

    for (const [senderField, receiverField] of pairs) {
      try {
        const qOut = window.firebaseQuery(
          messagesRef,
          window.firebaseWhere(senderField, '==', me),
          window.firebaseWhere(receiverField, '==', otherUserId)
        );
        const qIn = window.firebaseQuery(
          messagesRef,
          window.firebaseWhere(senderField, '==', otherUserId),
          window.firebaseWhere(receiverField, '==', me)
        );
        const [outSnap, inSnap] = await Promise.all([
          window.firebaseGetDocs(qOut),
          window.firebaseGetDocs(qIn)
        ]);
        addSnapshot(outSnap, `${senderField}_${receiverField}_out_`);
        addSnapshot(inSnap, `${senderField}_${receiverField}_in_`);
      } catch (pairErr) {
        console.debug('[Coverse] Pair query skipped:', senderField, receiverField, pairErr?.message || pairErr);
      }
    }
  }

  messages.sort((a, b) => {
    const aTime = a.timestamp?.toMillis?.() || new Date(a.timestamp || 0).getTime() || 0;
    const bTime = b.timestamp?.toMillis?.() || new Date(b.timestamp || 0).getTime() || 0;
    return aTime - bTime;
  });

  return messages;
}

async function loadPendingRequests() {
  if (!currentUser || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    const requestsRef = window.firebaseCollection(db, 'friendRequests');
    const q = window.firebaseQuery(
      requestsRef,
      window.firebaseWhere('toUid', '==', currentUser.uid),
      window.firebaseWhere('status', '==', 'pending')
    );
    const snapshot = await window.firebaseGetDocs(q);
    
    pendingFriendRequests = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Get sender info
      let senderUser = null;
      if (data.fromUid) {
        try {
          const userDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'users', data.fromUid));
          if (userDoc.exists()) {
            const rawSender = userDoc.data() || {};
            senderUser = {
              ...rawSender,
              avatarUrl: normalizeAvatarUrl(rawSender.avatarUrl || rawSender.photoURL || '')
            };
          }
        } catch (e) {}
      }
      pendingFriendRequests.push({
        id: doc.id,
        ...data,
        senderUser
      });
    }
    
    console.log('[Coverse] Pending requests:', pendingFriendRequests.length);
    updatePendingFriendsBadge();
  } catch (error) {
    console.log('[Coverse] Friend requests not found');
    pendingFriendRequests = [];
    updatePendingFriendsBadge();
  }
}

// ============================================
// FRIENDS & DM RENDERING
// ============================================
function renderFriendsList() {
  const container = document.getElementById('friendsList');
  if (!container) return;
  
  const filteredFriends = filterFriendsByTab();
  
  if (filteredFriends.length === 0 && pendingFriendRequests.length === 0) {
    container.innerHTML = `
      <div class="friends-empty">
        <svg viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>
        <h3>No collaborators yet</h3>
        <p>Add friends to start collaborating!</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  // Show pending requests first if on pending tab
  if (currentFriendsTab === 'pending' && pendingFriendRequests.length > 0) {
    html += `<div class="friends-section-header">Pending — ${pendingFriendRequests.length}</div>`;
    pendingFriendRequests.forEach(req => {
      const user = req.senderUser || {};
      const avatar = user.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : getInitials(user.displayName || 'U');
      html += `
        <div class="friend-item pending" data-request-id="${req.id}">
          <div class="friend-avatar">
            ${typeof avatar === 'string' && avatar.startsWith('<') ? avatar : `<span>${avatar}</span>`}
          </div>
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(user.displayName || 'Unknown')}</div>
            <div class="friend-status">Incoming Friend Request</div>
          </div>
          <div class="friend-pending-actions">
            <button class="friend-pending-btn accept" onclick="acceptFriendRequest('${req.id}', '${req.fromUid}')">Accept</button>
            <button class="friend-pending-btn decline" onclick="declineFriendRequest('${req.id}')">Ignore</button>
          </div>
        </div>
      `;
    });
  }
  
  // Show friends/connections
  if (filteredFriends.length > 0) {
    const headerText = currentFriendsTab === 'online' ? 'Online' : 'All Connections';
    html += `<div class="friends-section-header">${headerText} — ${filteredFriends.length}</div>`;
    
    filteredFriends.forEach(friend => {
      const avatar = friend.avatarUrl ? `<img src="${friend.avatarUrl}" alt="">` : getInitials(friend.displayName || 'U');
      const statusClass = friend.isOnline ? 'online' : '';
      const statusText = getConnectionStatusText(friend);
      
      html += `
        <div class="friend-item" data-friend-id="${friend.uid || friend.id}">
          <div class="friend-avatar">
            ${typeof avatar === 'string' && avatar.startsWith('<') ? avatar : `<span>${avatar}</span>`}
            <div class="status-indicator ${statusClass}"></div>
          </div>
          <div class="friend-info">
            <div class="friend-name">${escapeHtml(friend.displayName || 'User')}</div>
            <div class="friend-status">${statusText}</div>
          </div>
          <div class="friend-actions">
            <button class="friend-action-btn" title="Invite to Current Session" onclick="inviteFriendToCurrentSession('${friend.uid || friend.id}')">
              <svg viewBox="0 0 256 256"><path d="M219.31,72l-56-56A16,16,0,0,0,152,11.31H56A16,16,0,0,0,40,27.31V216a16,16,0,0,0,16,16H152a16,16,0,0,0,11.31-4.69l56-56A16,16,0,0,0,224,160V83.31A16,16,0,0,0,219.31,72ZM152,216H56V27.31h96V72a16,16,0,0,0,16,16h44.69V160H168a16,16,0,0,0-16,16Zm56-56H168v40.69L207.31,160ZM168,72V32.69L207.31,72Z"/></svg>
            </button>
            <button class="friend-action-btn" title="Message" onclick="openDMWithUser('${friend.uid || friend.id}')">
              <svg viewBox="0 0 256 256"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48Z"/></svg>
            </button>
            <button class="friend-action-btn" title="Voice Call" onclick="startVoiceCallWith('${friend.uid || friend.id}')">
              <svg viewBox="0 0 256 256"><path d="M231.88,175.08A56.26,56.26,0,0,1,176,224C96.6,224,32,159.4,32,80A56.26,56.26,0,0,1,80.92,24.12a16,16,0,0,1,16.62,9.52l21.12,47.15,0,.12A16,16,0,0,1,117.39,96c-.18.27-.37.52-.57.77L96,121.45c7.49,15.22,23.41,31,38.83,38.51l24.34-20.71a8.12,8.12,0,0,1,.75-.56,16,16,0,0,1,15.17-1.4l.13.06,47.11,21.11A16,16,0,0,1,231.88,175.08Z"/></svg>
            </button>
          </div>
        </div>
      `;
    });
  }
  
  container.innerHTML = html || `
    <div class="friends-empty">
      <h3>${currentFriendsTab === 'pending' ? 'No pending requests' : 'No friends online'}</h3>
    </div>
  `;
}

function filterFriendsByTab() {
  switch (currentFriendsTab) {
    case 'online':
      // Show only online connections (mutual, following, or followers who are online)
      return userFriends.filter(f => f.isOnline === true);
    case 'pending':
      return []; // Pending shows requests, not friends
    case 'all':
    default:
      return userFriends;
  }
}

function getConnectionStatusText(friend) {
  if (friend.isOnline) return 'Online';
  
  switch (friend.status) {
    case 'mutual': return 'Friends';
    case 'following': return 'Following';
    case 'follower': return 'Follows you';
    default: return 'Offline';
  }
}

function renderDMList() {
  const container = document.getElementById('dmList');
  if (!container) return;
  
  if (userConversations.length === 0) {
    container.innerHTML = '<div class="dm-empty">No messages yet</div>';
    return;
  }
  
  let html = '';
  userConversations.forEach(conv => {
    const otherUser = conv.otherUser || {};
    const otherUid = String(otherUser.uid || conv.otherUid || '').trim();
    const escapedConversationId = String(conv.id || '').replace(/'/g, "\\'");
    const escapedOtherUid = otherUid.replace(/'/g, "\\'");
    const avatar = otherUser.avatarUrl 
      ? `<img src="${otherUser.avatarUrl}" alt="">` 
      : `<span>${getInitials(otherUser.displayName || 'U')}</span>`;
    const isOnline = otherUser.status === 'online';
    
    html += `
      <div class="dm-item${currentConversationId === conv.id ? ' active' : ''}" data-conversation-id="${conv.id}" data-user-id="${otherUid}" onclick="openConversation('${escapedConversationId}')">
        <div class="dm-item-avatar">
          ${avatar}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">${escapeHtml(otherUser.displayName || 'User')}</div>
          ${conv.lastMessage ? `<div class="dm-item-preview">${escapeHtml(conv.lastMessage)}</div>` : ''}
        </div>
        <div class="dm-item-meta">
          ${conv.unreadCount ? `<div class="dm-item-badge">${conv.unreadCount}</div>` : ''}
          ${otherUid ? `<button class="dm-item-invite-btn" title="Invite to Current Session" onclick="event.stopPropagation(); inviteDmUserToCurrentSession('${escapedOtherUid}')">Invite</button>` : ''}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

async function openConversation(conversationId) {
  const conv = userConversations.find(c => c.id === conversationId);
  if (!conv) return;
  
  currentConversationId = conversationId;
  const resolvedOtherUid =
    conv.otherUser?.uid ||
    conv.otherUid ||
    conv.participants?.find((p) => p !== currentUser?.uid) ||
    '';
  currentDMUser = {
    ...(conv.otherUser || {}),
    uid: resolvedOtherUid
  };
  
  // Update DM list selection
  document.querySelectorAll('.dm-item').forEach(el => {
    el.classList.toggle('active', el.dataset.conversationId === conversationId);
  });
  
  // Update DM view header
  const user = conv.otherUser || {};
  document.getElementById('dmUserName').textContent = user.displayName || 'User';
  document.getElementById('dmUserStatus').textContent = user.status || 'Offline';
  document.getElementById('dmInput').placeholder = `Message @${user.displayName || 'User'}`;
  
  const avatarEl = document.getElementById('dmUserAvatar');
  if (user.avatarUrl) {
    avatarEl.innerHTML = `<img src="${user.avatarUrl}" alt="">`;
  } else {
    avatarEl.innerHTML = `<span>${getInitials(user.displayName || 'U')}</span>`;
  }
  
  // Load and render messages
  const messages = await loadMessages(conversationId, resolvedOtherUid);
  renderDMMessages(messages);
  
  // Show DM view
  showDMView();
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase();
}

function formatMessageTextHtml(value) {
  return escapeHtml(String(value || '')).replace(/\n/g, '<br>');
}

async function joinSessionInviteFromMessage(inviteCode, options = {}) {
  const code = normalizeInviteCode(inviteCode);
  if (!code) {
    showNotification('Invite code is missing from this message.');
    return false;
  }

  if (options.confirm !== false) {
    const approved = window.confirm(`Join this session with invite code ${code}?`);
    if (!approved) return false;
  }

  const joined = await joinSessionByInvite(code, {
    suppressAlert: true,
    showSuccessNotification: false
  });

  if (joined) {
    showNotification('Joined session from invite.');
  }

  return joined;
}

function renderDMMessages(messages) {
  const container = document.getElementById('dmMessages');
  if (!container) return;
  
  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="dm-messages-empty">
        <svg viewBox="0 0 256 256"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48Z"/></svg>
        <p>Start the conversation!</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  messages.forEach(msg => {
    const isMe = msg.senderId === currentUser?.uid;
    const senderName = isMe ? (currentUser.displayName || 'You') : (currentDMUser?.displayName || 'User');
    const messageText = String(msg.text || msg.content || '');
    const inviteCode = normalizeInviteCode(msg.inviteCode || msg.code || '');
    const kind = String(msg.kind || '').trim().toLowerCase();
    const isSessionInvite = kind === 'session_invite' && Boolean(inviteCode);
    const avatar = isMe 
      ? (currentUser.avatarUrl ? `<img src="${currentUser.avatarUrl}" alt="">` : getInitials(currentUser.displayName || 'Y'))
      : (currentDMUser?.avatarUrl ? `<img src="${currentDMUser.avatarUrl}" alt="">` : getInitials(currentDMUser?.displayName || 'U'));
    
    const time = formatMessageTime(msg.timestamp);
    const messageBody = isSessionInvite
      ? `
          <div class="dm-message-text dm-message-text--invite">${formatMessageTextHtml(messageText || `Session invite code: ${inviteCode}`)}</div>
          <div class="dm-message-actions">
            <button type="button" class="dm-invite-join-btn" data-invite-code="${escapeHtml(inviteCode)}">Join Session</button>
          </div>
        `
      : `<div class="dm-message-text">${formatMessageTextHtml(messageText)}</div>`;
    
    html += `
      <div class="dm-message ${isMe ? 'dm-message--sent' : 'dm-message--received'}">
        <div class="dm-message-avatar">
          ${typeof avatar === 'string' && avatar.startsWith('<') ? avatar : `<span>${avatar}</span>`}
        </div>
        <div class="dm-message-content">
          <div class="dm-message-header">
            <span class="dm-message-author">${escapeHtml(senderName)}</span>
            <span class="dm-message-time">${time}</span>
          </div>
          ${messageBody}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;

  container.querySelectorAll('.dm-invite-join-btn').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const inviteCode = String(buttonEl.dataset.inviteCode || '').trim();
      if (!inviteCode) return;

      buttonEl.disabled = true;
      try {
        await joinSessionInviteFromMessage(inviteCode, { confirm: true });
      } finally {
        buttonEl.disabled = false;
      }
    });
  });

  container.scrollTop = container.scrollHeight;
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }
  
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return 'Today at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function applyAddFriendModalMode(mode = 'friend') {
  const nextMode = mode === 'dm' ? 'dm' : 'friend';
  addFriendModalMode = nextMode;

  const modal = document.getElementById('addFriendModal');
  if (!modal) return;

  const titleEl = modal.querySelector('.modal-header h2');
  const subtitleEl = modal.querySelector('.modal-header p');
  const labelEl = modal.querySelector('.form-group .form-label');
  const inputEl = document.getElementById('friendSearchInput');
  const actionBtn = document.getElementById('btnSendFriendRequest');

  if (nextMode === 'dm') {
    if (titleEl) titleEl.textContent = 'Start a Direct Message';
    if (subtitleEl) subtitleEl.textContent = 'Search collaborators and start a conversation instantly';
    if (labelEl) labelEl.textContent = 'Find collaborator';
    if (inputEl) inputEl.placeholder = 'Search username or email...';
    if (actionBtn) actionBtn.textContent = 'Start Message';
  } else {
    if (titleEl) titleEl.textContent = 'Add a Collaborator';
    if (subtitleEl) subtitleEl.textContent = 'You can add collaborators by their username or email';
    if (labelEl) labelEl.textContent = 'Username or Email';
    if (inputEl) inputEl.placeholder = 'Enter username or email...';
    if (actionBtn) actionBtn.textContent = 'Send Request';
  }
}

function resetAddFriendModalInputs(options = {}) {
  const preserveMode = options.preserveMode === true;
  const searchInputEl = document.getElementById('friendSearchInput');
  if (searchInputEl) {
    searchInputEl.value = '';
  }
  document.getElementById('friendSearchResults')?.replaceChildren();
  document.getElementById('btnSendFriendRequest')?.setAttribute('disabled', 'disabled');
  if (!preserveMode) {
    applyAddFriendModalMode('friend');
  }
}

function collectQuickDmCandidates(limit = 12) {
  const byUid = new Map();

  const upsertCandidate = (entry = {}) => {
    const uid = String(entry.uid || entry.id || '').trim();
    if (!uid || uid === String(currentUser?.uid || '').trim()) return;

    const existing = byUid.get(uid) || {};
    byUid.set(uid, {
      uid,
      displayName: String(entry.displayName || entry.username || existing.displayName || 'User').trim() || 'User',
      email: String(entry.email || existing.email || '').trim(),
      avatarUrl: normalizeAvatarUrl(entry.avatarUrl || entry.photoURL || existing.avatarUrl || ''),
      subtitle: String(entry.subtitle || existing.subtitle || '').trim()
    });
  };

  userFriends.forEach((friend) => {
    upsertCandidate({
      uid: friend.uid || friend.id,
      displayName: friend.displayName,
      email: friend.email,
      avatarUrl: friend.avatarUrl,
      subtitle: getConnectionStatusText(friend)
    });
  });

  userConversations.forEach((conversation) => {
    const otherUser = conversation.otherUser || {};
    upsertCandidate({
      uid: conversation.otherUid || otherUser.uid,
      displayName: otherUser.displayName,
      email: otherUser.email,
      avatarUrl: otherUser.avatarUrl,
      subtitle: conversation.lastMessage ? 'Recent conversation' : ''
    });
  });

  return Array.from(byUid.values())
    .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')))
    .slice(0, limit);
}

function renderAddFriendModalDefaultResults() {
  const container = document.getElementById('friendSearchResults');
  if (!container) return;

  if (addFriendModalMode !== 'dm') {
    container.innerHTML = '';
    return;
  }

  const candidates = collectQuickDmCandidates();
  if (!candidates.length) {
    container.innerHTML = '<div class="search-no-results">Search for a user to start messaging.</div>';
    return;
  }

  container.innerHTML = candidates.map((user) => {
    const avatar = user.avatarUrl
      ? `<img src="${user.avatarUrl}" alt="">`
      : `<span>${getInitials(user.displayName || 'U')}</span>`;
    const subtitle = user.subtitle || user.email || 'Start conversation';

    return `
      <div class="search-result-item" data-user-id="${user.uid}" onclick="selectSearchResult(this)">
        <div class="search-result-avatar">${avatar}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(user.displayName || 'User')}</div>
          <div class="search-result-email">${escapeHtml(subtitle)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddFriendModal(mode = 'friend') {
  applyAddFriendModalMode(mode);
  resetAddFriendModalInputs({ preserveMode: true });

  if (addFriendModalMode === 'dm') {
    renderAddFriendModalDefaultResults();
  }

  openModal('addFriendModal');
}

function closeAddFriendModal() {
  closeModal('addFriendModal');
  resetAddFriendModalInputs();
}

// ============================================
// FRIEND ACTIONS
// ============================================
async function searchUsers(query) {
  if (!query || query.length < 2 || !window.firebaseDb) return [];
  
  try {
    const db = window.firebaseDb;
    // Search by email or displayName
    // Note: Firestore doesn't support full-text search, so this is limited
    const usersRef = window.firebaseCollection(db, 'users');
    const snapshot = await window.firebaseGetDocs(usersRef);
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.uid === currentUser?.uid) return; // Skip self
      
      const nameMatch = data.displayName?.toLowerCase().includes(queryLower);
      const emailMatch = data.email?.toLowerCase().includes(queryLower);
      
      if (nameMatch || emailMatch) {
        results.push({ id: doc.id, ...data });
      }
    });
    
    return results.slice(0, 10); // Limit results
  } catch (error) {
    console.error('[Coverse] Search error:', error);
    return [];
  }
}

async function sendFriendRequest(toUid) {
  const targetUid = String(toUid || '').trim();
  if (!targetUid || !currentUser || !window.firebaseDb) return false;
  
  try {
    const db = window.firebaseDb;
    const targetName = await getUserDisplayNameByUid(targetUid);
    const existingEntry = userFriends.find((entry) => String(entry.uid || entry.id || '').trim() === targetUid);
    const wasAlreadyFollower = existingEntry?.status === 'follower' || existingEntry?.status === 'mutual';
    
    // Check if already following
    const followsRef = window.firebaseCollection(db, 'follows');
    const existingQuery = window.firebaseQuery(
      followsRef,
      window.firebaseWhere('follower', '==', currentUser.uid),
      window.firebaseWhere('following', '==', targetUid)
    );
    const existing = await window.firebaseGetDocs(existingQuery);
    
    if (!existing.empty) {
      showNotification(`You already follow ${targetName}.`, {
        level: 'info',
        actionLabel: 'Message',
        action: () => openDMWithUser(targetUid)
      });
      return false;
    }
    
    // Create follow relationship (matches web app structure)
    await window.firebaseAddDoc(followsRef, {
      follower: currentUser.uid,
      following: targetUid,
      createdAt: new Date()
    });
    
    console.log('[Coverse] Now following:', targetUid);
    
    // Reload friends list
    await Promise.all([loadFriends(), loadConversations()]);

    closeAddFriendModal();

    const updatedEntry = userFriends.find((entry) => String(entry.uid || entry.id || '').trim() === targetUid);
    const isMutual = updatedEntry?.status === 'mutual' || wasAlreadyFollower;

    showNotification(
      isMutual
        ? `You and ${targetName} are now connected.`
        : `Added ${targetName}.`,
      {
        level: 'success',
        actionLabel: 'Message',
        action: () => openDMWithUser(targetUid)
      }
    );

    return true;
    
  } catch (error) {
    console.error('[Coverse] Error adding connection:', error);
    showNotification(`Failed to add connection: ${error.message || 'Unknown error'}`, {
      level: 'error'
    });
    return false;
  }
}

async function acceptFriendRequest(requestId, fromUid) {
  // With the follows model, accepting a request means following them back
  if (!fromUid || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    const senderUid = String(fromUid || '').trim();
    const senderName = await getUserDisplayNameByUid(senderUid);
    
    // Follow them back (creates mutual connection)
    const followsRef = window.firebaseCollection(db, 'follows');
    const existingQuery = window.firebaseQuery(
      followsRef,
      window.firebaseWhere('follower', '==', currentUser.uid),
      window.firebaseWhere('following', '==', senderUid)
    );
    const existingSnap = await window.firebaseGetDocs(existingQuery);

    if (existingSnap.empty) {
      await window.firebaseAddDoc(followsRef, {
        follower: currentUser.uid,
        following: senderUid,
        createdAt: new Date()
      });
    }
    
    // If there was a friendRequest, mark it as accepted
    if (requestId) {
      try {
        await window.firebaseSetDoc(
          window.firebaseDoc(db, 'friendRequests', requestId),
          { status: 'accepted' },
          { merge: true }
        );
      } catch (e) {
        // friendRequest may not exist, that's ok
      }
    }
    
    // Reload friends
    await Promise.all([loadFriends(), loadPendingRequests(), loadConversations()]);
    renderFriendsList();

    showNotification(`You and ${senderName} are now connected.`, {
      level: 'success',
      actionLabel: 'Message',
      action: () => openDMWithUser(senderUid)
    });
    
    console.log('[Coverse] Connection accepted - now mutual friends with:', senderUid);
    
  } catch (error) {
    console.error('[Coverse] Error accepting connection:', error);
    showNotification('Could not accept request. Please try again.', { level: 'error' });
  }
}

async function declineFriendRequest(requestId) {
  if (!requestId || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    
    await window.firebaseSetDoc(
      window.firebaseDoc(db, 'friendRequests', requestId),
      { status: 'declined' },
      { merge: true }
    );
    
    // Reload pending requests
    await loadPendingRequests();
    renderFriendsList();

    showNotification('Request ignored.');
    
  } catch (error) {
    console.error('[Coverse] Error declining friend request:', error);
    showNotification('Could not ignore request. Please try again.', { level: 'error' });
  }
}

// Flag to prevent duplicate conversation creation
let creatingConversationWith = null;

async function openDMWithUser(userId, options = {}) {
  const openView = options.openView !== false;
  if (!userId || !window.firebaseDb) return null;
  
  // Prevent double-click creating duplicates
  if (creatingConversationWith === userId) {
    console.log('[Coverse] Already creating conversation with this user...');
    return null;
  }
  
  const db = window.firebaseDb;
  
  // Check if conversation exists in local cache
  let conv = userConversations
    .filter(c => (c.otherUser?.uid || c.otherUid) === userId)
    .sort((a, b) => {
      const aMs = (typeof a.lastMessageAt?.toMillis === 'function' ? a.lastMessageAt.toMillis() : new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime()) || 0;
      const bMs = (typeof b.lastMessageAt?.toMillis === 'function' ? b.lastMessageAt.toMillis() : new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime()) || 0;
      return bMs - aMs;
    })[0];
  
  if (!conv) {
    // Check Firebase for existing conversation with this user
    try {
      const conversationsRef = window.firebaseCollection(db, 'conversations');
      const q = window.firebaseQuery(
        conversationsRef,
        window.firebaseWhere('participants', 'array-contains', currentUser.uid)
      );
      const snapshot = await window.firebaseGetDocs(q);
      
      // Look for a conversation that includes both users
      const matches = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.participants && data.participants.includes(userId)) {
          matches.push({
            id: docSnap.id,
            ...data,
            otherUid: userId
          });
        }
      }

      if (matches.length) {
        matches.sort((a, b) => {
          const aMs = (typeof a.lastMessageAt?.toMillis === 'function' ? a.lastMessageAt.toMillis() : new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime()) || 0;
          const bMs = (typeof b.lastMessageAt?.toMillis === 'function' ? b.lastMessageAt.toMillis() : new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime()) || 0;
          return bMs - aMs;
        });

        const userDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'users', userId));
        const otherUser = userDoc.exists() ? { uid: userId, ...userDoc.data() } : { uid: userId };
        conv = {
          ...matches[0],
          otherUser
        };

        // Keep only one local thread for this user
        userConversations = userConversations.filter(c => (c.otherUser?.uid || c.otherUid) !== userId);
        userConversations.unshift(conv);
        renderDMList();
      }
    } catch (error) {
      console.error('[Coverse] Error checking for existing conversation:', error);
    }
  }
  
  if (!conv) {
    // Create new conversation
    creatingConversationWith = userId; // Set flag to prevent duplicates
    try {
      const conversationsRef = window.firebaseCollection(db, 'conversations');
      
      // Get the other user's info
      const userDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'users', userId));
      const otherUser = userDoc.exists() ? { uid: userId, ...userDoc.data() } : { uid: userId };
      
      // Use addDoc to create new conversation with auto-generated ID
      const newConvRef = await window.firebaseAddDoc(conversationsRef, {
        participants: [currentUser.uid, userId],
        createdAt: new Date(),
        lastMessage: ''
      });
      
      conv = {
        id: newConvRef.id,
        participants: [currentUser.uid, userId],
        otherUser
      };
      
      userConversations.unshift(conv);
      renderDMList();
      
    } catch (error) {
      console.error('[Coverse] Error creating conversation:', error);
      const errorMessage = String(error?.message || 'Unknown error');
      const isPermissionError = /missing or insufficient permissions|permission[-_ ]denied/i.test(errorMessage);
      showNotification(
        isPermissionError
          ? 'Cannot start a new conversation because Firestore denied permission. Please update/deploy Firestore rules, then try again.'
          : `Failed to start conversation: ${errorMessage}`,
        { level: 'error', duration: isPermissionError ? 7000 : 5200 }
      );
      creatingConversationWith = null; // Clear flag on error
      return null;
    }
    creatingConversationWith = null; // Clear flag after success
  }
  
  if (openView) {
    await openConversation(conv.id);
  }

  return conv;
}

async function sendDMMessage() {
  const input = document.getElementById('dmInput');
  const text = input?.value?.trim();
  
  if (!text || !currentConversationId || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    const convDocRef = window.firebaseDoc(db, 'conversations', currentConversationId);
    const messagesRef = window.firebaseCollection(db, 'messages');
    const targetUid =
      currentDMUser?.uid ||
      userConversations.find((c) => c.id === currentConversationId)?.otherUid ||
      userConversations.find((c) => c.id === currentConversationId)?.participants?.find((p) => p !== currentUser?.uid) ||
      '';
    
    // Write using site-compatible schema
    await window.firebaseAddDoc(messagesRef, {
      conversationId: currentConversationId,
      senderId: currentUser.uid,
      receiverId: targetUid || null,
      fromUid: currentUser.uid,
      toUid: targetUid || null,
      text: text,
      timestamp: new Date(),
      createdAt: new Date()
    });
    
    // Update conversation's last message
    await window.firebaseSetDoc(
      convDocRef,
      { lastMessage: text, lastMessageAt: new Date() },
      { merge: true }
    );
    
    // Clear input and reload messages
    input.value = '';
    const messages = await loadMessages(currentConversationId, targetUid);
    renderDMMessages(messages);
    
  } catch (error) {
    console.error('[Coverse] Error sending message:', error);
  }
}

function startVoiceCallWith(userId) {
  Promise.resolve().then(async () => {
    const targetUserId = String(userId || '').trim();
    if (!targetUserId) return;

    console.log('[Coverse] Starting voice call with:', targetUserId);

    try {
      await openDMWithUser(targetUserId);
    } catch (_error) {
      // continue with voice flow regardless of DM open result
    }

    if (!currentSession && Array.isArray(sessions) && sessions.length > 0) {
      selectSession(sessions[0].id);
    }

    if (!currentChannel || currentChannelType !== 'voice') {
      selectChannel(getDefaultVoiceChannelId(currentSession), 'voice');
    }

    if (!inVoiceCall) {
      await joinVoice();
    } else {
      showCallView();
    }
  }).catch((error) => {
    console.error('[Coverse] Voice call start failed:', error);
    alert('Could not start voice call. Check microphone permissions and try again.');
  });
}

// ============================================
// LIBRARY FUNCTIONALITY
// ============================================
let libraryViewMode = 'grid';
let currentLibraryTab = 'all';
let selectedFiles = [];
let playerQueue = [];
let playerCurrentIndex = -1;
let playerCurrentFileId = null;
let playerCurrentItem = null;
let globalPlayerWaveform = null;
let globalPlayerWaveformSource = '';
let isGlobalPlayerMinimized = false;
let includeProfileUploadsInLibrary = false;
const pendingThumbnailHydration = new Set();
let libraryStatusTimer = null;

function setLibraryStatus(message, kind = 'info', sticky = false) {
  const statusEl = document.getElementById('libraryStatus');
  if (!statusEl) return;

  statusEl.textContent = String(message || '');
  statusEl.classList.remove('hidden', 'success', 'error');
  if (kind === 'success') statusEl.classList.add('success');
  if (kind === 'error') statusEl.classList.add('error');

  if (libraryStatusTimer) {
    clearTimeout(libraryStatusTimer);
    libraryStatusTimer = null;
  }

  if (!sticky) {
    libraryStatusTimer = setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 4500);
  }
}

function initLibrary() {
  try {
    includeProfileUploadsInLibrary = localStorage.getItem(LIBRARY_SHOW_PROFILE_UPLOADS_KEY) === '1';
  } catch (_error) {
    includeProfileUploadsInLibrary = false;
  }

  const profileUploadsToggle = document.getElementById('libraryProfileUploadsToggle');
  if (profileUploadsToggle) {
    profileUploadsToggle.checked = includeProfileUploadsInLibrary;
    profileUploadsToggle.addEventListener('change', async (event) => {
      includeProfileUploadsInLibrary = Boolean(event.target?.checked);
      try {
        localStorage.setItem(LIBRARY_SHOW_PROFILE_UPLOADS_KEY, includeProfileUploadsInLibrary ? '1' : '0');
      } catch (_error) {
        // no-op
      }

      if (includeProfileUploadsInLibrary && !simpleProfilePostsCache.length && currentUser?.uid) {
        const loadedPosts = await loadProfilePosts(currentUser.uid);
        simpleProfilePostsCache = loadedPosts.map(normalizeProfilePostItem);
      }

      renderLibrary(document.getElementById('librarySearchInput')?.value || '');
    });
  }

  // Tab switching
  document.querySelectorAll('.library-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentLibraryTab = tab.dataset.tab;
      document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderLibrary();
    });
  });
  
  // View mode switching
  document.getElementById('btnGridView')?.addEventListener('click', () => {
    libraryViewMode = 'grid';
    document.getElementById('btnGridView').classList.add('active');
    document.getElementById('btnListView').classList.remove('active');
    renderLibrary();
  });
  
  document.getElementById('btnListView')?.addEventListener('click', () => {
    libraryViewMode = 'list';
    document.getElementById('btnListView').classList.add('active');
    document.getElementById('btnGridView').classList.remove('active');
    renderLibrary();
  });
  
  // Upload button
  document.getElementById('btnUploadFile')?.addEventListener('click', () => openModal('uploadModal'));
  document.getElementById('btnUploadEmpty')?.addEventListener('click', () => openModal('uploadModal'));
  
  // Search
  document.getElementById('librarySearchInput')?.addEventListener('input', (e) => {
    renderLibrary(e.target.value);
  });
  
  // Sort
  document.getElementById('librarySortSelect')?.addEventListener('change', () => {
    renderLibrary();
  });

  const refreshSiteBtn = document.getElementById('btnRefreshSiteLibrary');
  refreshSiteBtn?.addEventListener('click', async () => {
    if (refreshSiteBtn.disabled) return;
    const originalText = refreshSiteBtn.textContent;
    refreshSiteBtn.disabled = true;
    refreshSiteBtn.textContent = 'Refreshing...';
    try {
      await loadSiteLibraryItems();
      renderLibrary(document.getElementById('librarySearchInput')?.value || '');
    } catch (error) {
      console.error('[Coverse] Manual Site Library refresh failed:', error);
      setLibraryStatus('Site Library refresh failed.', 'error');
    } finally {
      refreshSiteBtn.disabled = false;
      refreshSiteBtn.textContent = originalText || 'Refresh Site Library';
    }
  });
  
  // Upload modal
  initUploadModal();
  
  // Preview modal
  initPreviewModal();
  initGlobalPlayer();
}

function initUploadModal() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('btnBrowseFiles');
  const destinationInputs = document.querySelectorAll('input[name="uploadDestination"]');
  const siteMetaWrap = document.getElementById('siteUploadMeta');

  const updateUploadDestinationUi = () => {
    const selected = document.querySelector('input[name="uploadDestination"]:checked')?.value || 'local';
    siteMetaWrap?.classList.toggle('hidden', selected !== 'site');
  };

  destinationInputs.forEach((input) => {
    input.addEventListener('change', updateUploadDestinationUi);
  });
  updateUploadDestinationUi();
  
  // Browse button
  browseBtn?.addEventListener('click', () => fileInput?.click());
  
  // File input change
  fileInput?.addEventListener('change', (e) => {
    handleFileSelect(e.target.files);
  });
  
  // Drag and drop
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  
  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files);
  });
  
  // Cancel button
  document.getElementById('btnCancelUpload')?.addEventListener('click', () => {
    selectedFiles = [];
    renderSelectedFiles();
    const localDestination = document.querySelector('input[name="uploadDestination"][value="local"]');
    if (localDestination) localDestination.checked = true;
    const siteMetaName = document.getElementById('siteMetaName');
    const siteMetaGenre = document.getElementById('siteMetaGenre');
    const siteMetaBpm = document.getElementById('siteMetaBpm');
    const siteMetaKey = document.getElementById('siteMetaKey');
    if (siteMetaName) siteMetaName.value = '';
    if (siteMetaGenre) siteMetaGenre.value = '';
    if (siteMetaBpm) siteMetaBpm.value = '';
    if (siteMetaKey) siteMetaKey.value = '';
    updateUploadDestinationUi();
    closeModal('uploadModal');
  });
  
  // Confirm upload
  document.getElementById('btnConfirmUpload')?.addEventListener('click', () => {
    uploadFiles();
  });
}

function handleFileSelect(files) {
  if (!files || files.length === 0) return;

  const oversized = [];
  
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      oversized.push(file.name);
      continue;
    }

    const detectedMime = file.type || inferMimeTypeFromName(file.name);
    const type = normalizeLibraryType('', detectedMime, file.name);
    
    selectedFiles.push({
      file,
      name: file.name,
      size: file.size,
      type
    });
  }

  if (oversized.length > 0) {
    alert(`These files exceed the 250MB limit and were skipped:\n\n${oversized.join('\n')}`);
  }

  if (selectedFiles.length === 0) {
    renderSelectedFiles();
    return;
  }
  
  renderSelectedFiles();
  const siteMetaNameInput = document.getElementById('siteMetaName');
  if (siteMetaNameInput && !siteMetaNameInput.value && selectedFiles.length === 1) {
    siteMetaNameInput.value = selectedFiles[0].name;
  }
  document.getElementById('btnConfirmUpload').disabled = false;
}

function isProjectFile(filename) {
  const projectExtensions = ['.als', '.flp', '.ptx', '.logic', '.rpp', '.cpr', '.vst3', '.vst', '.aup3', '.zip', '.rar', '.7z'];
  return projectExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function isZipFile(file) {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  const mime = String(file.mimeType || inferMimeTypeFromName(file.name || '') || '').toLowerCase();
  const storagePath = String(file.storagePath || '').toLowerCase();
  const normalizedType = normalizeLibraryType(file.type, file.mimeType || inferMimeTypeFromName(file.name || ''), file.name || '');
  return name.endsWith('.zip') || storagePath.endsWith('.zip') || mime.includes('zip') || (normalizedType === 'project' && (name.includes('zip') || storagePath.includes('zip')));
}

function hideZipPreview() {
  document.getElementById('previewZipListWrap')?.classList.add('hidden');
  const metaEl = document.getElementById('previewZipMeta');
  const itemsEl = document.getElementById('previewZipItems');
  if (metaEl) metaEl.textContent = '';
  if (itemsEl) itemsEl.textContent = '';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function renderZipPreview(file) {
  const wrap = document.getElementById('previewZipListWrap');
  const metaEl = document.getElementById('previewZipMeta');
  const itemsEl = document.getElementById('previewZipItems');
  if (!wrap || !metaEl || !itemsEl) return;

  wrap.classList.remove('hidden');
  metaEl.textContent = 'Scanning archive...';
  itemsEl.textContent = '';

  const listZipEntries = window.coverse?.listZipEntries;
  if (typeof listZipEntries !== 'function') {
    metaEl.textContent = 'ZIP preview unavailable in this environment.';
    return;
  }

  let result = null;
  const sourceUrl = await resolveFileSourceUrl(file);

  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    result = await listZipEntries({ url: sourceUrl });
  } else {
    const blob = file._sourceFile instanceof Blob ? file._sourceFile : await resolveFileBlob(file);
    if (!blob) {
      metaEl.textContent = 'Could not load ZIP data for preview.';
      return;
    }

    if (blob.size > 40 * 1024 * 1024) {
      metaEl.textContent = 'ZIP is too large for inline preview. Download to inspect full contents.';
      return;
    }

    const buffer = await blob.arrayBuffer();
    result = await listZipEntries({ dataBase64: arrayBufferToBase64(buffer) });
  }

  if (!result?.ok) {
    metaEl.textContent = result?.error || 'Could not inspect ZIP contents.';
    return;
  }

  const entries = Array.isArray(result.entries) ? result.entries : [];
  const fileEntries = entries.filter((entry) => entry.name);
  metaEl.textContent = `${result.total || entries.length} entries${entries.length < (result.total || entries.length) ? ` (showing first ${entries.length})` : ''}`;

  if (!fileEntries.length) {
    itemsEl.textContent = '(No files found in archive)';
    return;
  }

  itemsEl.textContent = fileEntries
    .map((entry) => `${entry.isDirectory ? '📁' : '📄'} ${entry.name}`)
    .join('\n');
}

function inferMimeTypeFromName(filename = '') {
  const name = String(filename || '').toLowerCase();
  const map = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.aif': 'audio/aiff',
    '.aiff': 'audio/aiff',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml'
  };
  const entry = Object.keys(map).find((ext) => name.endsWith(ext));
  return entry ? map[entry] : 'application/octet-stream';
}

function normalizeLibraryType(type = '', mimeType = '', fileName = '') {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (normalizedMime.startsWith('audio/')) return 'audio';
  if (normalizedMime.startsWith('video/')) return 'video';
  if (normalizedMime.startsWith('image/')) return 'image';
  if (isProjectFile(fileName)) return 'project';

  if (['sample', 'one shot', 'one-shot', 'oneshot', 'loop', 'drum', 'audio'].includes(normalizedType)) return 'audio';
  if (['video', 'clip'].includes(normalizedType)) return 'video';
  if (['image', 'photo', 'artwork', 'cover'].includes(normalizedType)) return 'image';
  if (['project', 'session', 'zip', 'rar', '7z'].includes(normalizedType)) return 'project';

  return 'other';
}

function getFileTypeLabel(file) {
  const normalizedType = normalizeLibraryType(file?.type, file?.mimeType || inferMimeTypeFromName(file?.name || ''), file?.name || '');
  if (normalizedType === 'audio') return 'Sample';
  if (normalizedType === 'video') return 'Video';
  if (normalizedType === 'image') return 'Image';
  if (normalizedType === 'project') return 'Project';
  return 'File';
}

function getSectionLabel(section = 'local') {
  if (section === 'app-cache') return 'App Cloud/Cache';
  if (section === 'site') return 'Site Library';
  if (section === 'profile-upload') return 'Profile Upload';
  if (section === 'downloaded') return 'Downloaded';
  return 'Local';
}

function getLibraryProfileUploadItems() {
  return (simpleProfilePostsCache || []).map((post, index) => {
    const normalized = normalizeProfilePostItem(post || {});
    return {
      ...normalized,
      id: `profile_upload_${normalized.id || index}`,
      name: normalized.name || normalized.title || `Upload ${index + 1}`,
      section: 'profile-upload',
      isReadOnly: true
    };
  });
}

function getLibraryItemQualityScore(item = {}) {
  if (!item || typeof item !== 'object') return 0;

  let score = 0;
  if (normalizeProfileMediaUrl(item.downloadURL || item.fileUrl || item.audioUrl || item.mediaUrl || item.url || '')) score += 8;
  if (String(item.storagePath || item.path || '').trim()) score += 6;
  if (String(item.blobUrl || '').trim()) score += 4;
  if (firstNonEmptyString([item.thumbnailURL, item.thumbnailUrl, item.previewUrl, item.imageUrl, item.coverImageUrl])) score += 3;
  if (Number(item.size || item.fileSize || 0) > 0) score += 1;
  if (String(item.mimeType || '').trim()) score += 1;
  if (String(item.name || item.title || '').trim()) score += 1;
  if (item.isPurchased || item.purchased || item.purchaseId) score += 2;

  const section = String(item.section || '').toLowerCase();
  if (section === 'site') score += 2;
  if (section === 'app-cache') score += 1;

  return score;
}

function getLibraryItemIdentityTokens(item = {}, fallbackIndex = 0) {
  if (!item || typeof item !== 'object') return [];

  const tokens = [];
  const pushToken = (prefix, rawValue) => {
    const normalized = normalizeIdentityValue(rawValue);
    if (!normalized) return;
    tokens.push(`${prefix}:${normalized}`);
  };

  pushToken('id', item.id);
  pushToken('site', item.siteId);

  const storagePath = String(item.storagePath || item.path || '').trim();
  if (storagePath) {
    pushToken('storage', storagePath);
    const storageTail = storagePath.split('/').pop() || '';
    pushToken('storage-tail', storageTail);
  }

  const mediaUrl = normalizeProfileMediaUrl(item.downloadURL || item.fileUrl || item.audioUrl || item.mediaUrl || item.url || '');
  if (mediaUrl) {
    const lowerUrl = mediaUrl.toLowerCase();
    pushToken('media', lowerUrl);
    const mediaTail = lowerUrl.split('/').pop()?.split('?')[0] || '';
    pushToken('media-tail', mediaTail);
    try {
      const parsed = new URL(mediaUrl);
      parsed.search = '';
      parsed.hash = '';
      pushToken('media-clean', parsed.toString().toLowerCase());
    } catch (_error) {
      // Keep best-effort token matching for relative/non-URL media paths.
    }
  }

  const title = firstMeaningfulPurchaseTitle([item.name, item.title, item.itemTitle]);
  const normalizedTitle = normalizeIdentityValue(title);
  const size = Number(item.size || item.fileSize || 0);
  const section = normalizeIdentityValue(item.section || 'local');
  if (normalizedTitle && size > 0) {
    pushToken('name-size', `${normalizedTitle}|${size}`);
    pushToken('name-section-size', `${normalizedTitle}|${section}|${size}`);
  }

  const purchaseLike = Boolean(
    item.isPurchased ||
    item.purchased ||
    item.purchaseId ||
    String(item.source || '').toLowerCase().includes('purchase')
  );
  if (purchaseLike) {
    buildPurchaseIdentityTokens(item, fallbackIndex).forEach((token) => {
      if (token) {
        tokens.push(`purchase:${token}`);
      }
    });
  }

  if (!tokens.length && Number.isFinite(fallbackIndex)) {
    pushToken('fallback', `${section || 'local'}|${fallbackIndex}`);
  }

  return Array.from(new Set(tokens));
}

function mergeLibraryItems(existing = {}, incoming = {}) {
  const existingScore = getLibraryItemQualityScore(existing);
  const incomingScore = getLibraryItemQualityScore(incoming);

  if (incomingScore > existingScore) {
    return { ...existing, ...incoming };
  }

  if (existingScore > incomingScore) {
    return { ...incoming, ...existing };
  }

  const existingTime = getTimestampMs(existing.uploadedAt || existing.createdAt || existing.purchasedAt);
  const incomingTime = getTimestampMs(incoming.uploadedAt || incoming.createdAt || incoming.purchasedAt);

  if (incomingTime > existingTime) {
    return { ...existing, ...incoming };
  }

  if (existingTime > incomingTime) {
    return { ...incoming, ...existing };
  }

  return { ...existing, ...incoming };
}

function dedupeLibraryItems(items = []) {
  const merged = new Map();
  const tokenToKey = new Map();
  let syntheticKeyCounter = 0;

  const registerTokens = (key, tokens = []) => {
    if (!key) return;
    tokens.forEach((token) => {
      if (!token) return;
      tokenToKey.set(token, key);
    });
  };

  (Array.isArray(items) ? items : []).forEach((item, index) => {
    if (!item || typeof item !== 'object' || item.isDeleted) return;

    const tokens = getLibraryItemIdentityTokens(item, index);
    let key = tokens.map((token) => tokenToKey.get(token)).find(Boolean);
    if (!key) {
      key = `library_${syntheticKeyCounter++}`;
    }

    if (!merged.has(key)) {
      merged.set(key, item);
      registerTokens(key, tokens);
      registerTokens(key, getLibraryItemIdentityTokens(item, index));
      return;
    }

    const existing = merged.get(key) || {};
    const nextItem = mergeLibraryItems(existing, item);
    merged.set(key, nextItem);
    registerTokens(key, tokens);
    registerTokens(key, getLibraryItemIdentityTokens(nextItem, index));
  });

  return Array.from(merged.values());
}

function getRenderableLibraryItems() {
  const baseItems = dedupeLibraryItems(Array.isArray(userLibrary) ? userLibrary : []);
  if (includeProfileUploadsInLibrary && currentLibraryTab === 'all') {
    return dedupeLibraryItems(baseItems.concat(getLibraryProfileUploadItems()));
  }
  return baseItems;
}

function buildLibraryQueueCandidates() {
  const merged = new Map();
  const pushItem = (item = {}, fallbackKey = '') => {
    if (!item || typeof item !== 'object') return;
    const key = String(
      item.id ||
      item.siteId ||
      item.postId ||
      item.purchaseId ||
      item.storagePath ||
      item.downloadURL ||
      fallbackKey
    ).trim().toLowerCase();
    if (!key) return;

    if (!merged.has(key)) {
      merged.set(key, item);
      return;
    }

    const existing = merged.get(key) || {};
    const existingHasSource = Boolean(existing.downloadURL || existing.storagePath || existing.blobUrl);
    const incomingHasSource = Boolean(item.downloadURL || item.storagePath || item.blobUrl);
    if (!existingHasSource && incomingHasSource) {
      merged.set(key, { ...existing, ...item });
      return;
    }

    const existingTime = getTimestampMs(existing.uploadedAt || existing.createdAt || existing.purchasedAt);
    const incomingTime = getTimestampMs(item.uploadedAt || item.createdAt || item.purchasedAt);
    if (incomingTime > existingTime) {
      merged.set(key, { ...existing, ...item });
    }
  };

  getRenderableLibraryItems().forEach((item, index) => pushItem(item, `renderable_${index}`));
  getLibraryPurchaseTabItems().forEach((item, index) => pushItem(item, `purchase_${index}`));
  return Array.from(merged.values());
}

function getLibraryPurchaseTabItems() {
  const purchasePosts = getSimpleProfilePurchasePosts();
  const items = [];

  purchasePosts.forEach((post, index) => {
    if (!post || typeof post !== 'object') return;

    const previewItem = buildSimpleProfilePreviewItem(post, `purchase_tab_${index}`);
    const normalized = {
      ...previewItem,
      section: 'site',
      source: 'purchase',
      isPurchased: true,
      purchased: true,
      postId: firstNonEmptyString([post.postId, post.sourceId, post.id]),
      purchaseId: firstNonEmptyString([post.purchaseId, post.postId, post.id]),
      uploadedAt: post.uploadedAt || post.createdAt || post.purchasedAt || previewItem.uploadedAt
    };
    items.push(normalized);
  });

  return dedupeLibraryItems(items)
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
}

function findRenderableLibraryItemById(fileId) {
  const id = String(fileId || '').trim();
  if (!id) return null;

  const direct = getRenderableLibraryItems().find((item) => String(item?.id || '').trim() === id);
  if (direct) return direct;

  const fromPurchases = getLibraryPurchaseTabItems().find((item) => String(item?.id || '').trim() === id);
  return fromPurchases || null;
}

function getPreferredPreviewSource(file) {
  if (!file) return '';
  return (
    file.blobUrl ||
    file.downloadURL ||
    file.thumbnailURL ||
    file.thumbnailUrl ||
    file.thumbUrl ||
    file.thumbURL ||
    file.previewUrl ||
    file.previewURL ||
    file.artworkUrl ||
    file.artworkURL ||
    file.coverUrl ||
    file.coverURL ||
    file.coverImage ||
    file.imageUrl ||
    file.imageURL ||
    file.image ||
    file.url ||
    file.fileUrl ||
    ''
  );
}

function requestThumbnailHydration(file) {
  if (!file?.id || pendingThumbnailHydration.has(file.id)) return;

  const effectiveMime = file.mimeType || inferMimeTypeFromName(file.name);
  const normalizedType = normalizeLibraryType(file.type, effectiveMime, file.name);
  if (!effectiveMime?.startsWith('image/') && !effectiveMime?.startsWith('video/') && !['image', 'video'].includes(normalizedType)) return;

  if (getPreferredPreviewSource(file)) return;
  if (!file.storagePath && !file.downloadURL && !file.url && !file.fileUrl) return;

  pendingThumbnailHydration.add(file.id);
  Promise.resolve()
    .then(async () => {
      await resolveFileSourceUrl(file);
    })
    .then(() => {
      renderLibrary(document.getElementById('librarySearchInput')?.value || '');
    })
    .catch(() => {})
    .finally(() => {
      pendingThumbnailHydration.delete(file.id);
    });
}

function getMicIconSvg() {
  return '<svg viewBox="0 0 256 256"><path d="M128,160a32,32,0,0,0,32-32V72a32,32,0,0,0-64,0v56A32,32,0,0,0,128,160Zm56-32a8,8,0,0,1,16,0,72,72,0,0,1-64,71.55V224a8,8,0,0,1-16,0V199.55A72,72,0,0,1,56,128a8,8,0,0,1,16,0,56,56,0,0,0,112,0Z"/></svg>';
}

function getMutedMicIconSvg() {
  return '<svg viewBox="0 0 256 256"><path d="M216,128a8,8,0,0,1-16,0,55.67,55.67,0,0,0-10.15-32.15,8,8,0,0,1,13.09-9.2A71.63,71.63,0,0,1,216,128ZM53.92,34.62A8,8,0,1,0,42.08,45.38L92,95.88V128a36,36,0,0,0,57.43,28.83l17.26,17.26A55.66,55.66,0,0,1,128,184a56.06,56.06,0,0,1-56-56,8,8,0,0,0-16,0,72.11,72.11,0,0,0,64,71.55V224a8,8,0,0,0,16,0V199.55a72.41,72.41,0,0,0,42.31-16.16l23.77,23.77a8,8,0,0,0,11.84-10.76ZM128,144a20,20,0,0,1-20-20V111.88l30.58,30.58A19.84,19.84,0,0,1,128,144Zm50.29,5.77-13-13A35.82,35.82,0,0,0,164,128V72a36,36,0,0,0-60-26.83L92.64,33.8A52,52,0,0,1,180,72v56A51.88,51.88,0,0,1,178.29,149.77Z"/></svg>';
}

function renderSelectedFiles() {
  const container = document.getElementById('selectedFilesList');
  const wrapper = document.getElementById('uploadFilesList');
  
  if (!container || !wrapper) return;
  
  if (selectedFiles.length === 0) {
    wrapper.classList.add('hidden');
    document.getElementById('btnConfirmUpload').disabled = true;
    return;
  }
  
  wrapper.classList.remove('hidden');
  
  let html = '';
  selectedFiles.forEach((sf, index) => {
    const icon = getFileIcon(sf.type);
    html += `
      <div class="selected-file-item">
        <div class="selected-file-icon">${icon}</div>
        <div class="selected-file-info">
          <div class="selected-file-name">${escapeHtml(sf.name)}</div>
          <div class="selected-file-size">${formatFileSize(sf.size)}</div>
        </div>
        <button class="selected-file-remove" onclick="removeSelectedFile(${index})">
          <svg viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>
        </button>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.removeSelectedFile = function(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
};

function getFileIcon(type) {
  switch (type) {
    case 'audio':
      return '<svg viewBox="0 0 256 256"><path d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V62.25l112-28v99.83A36,36,0,1,0,216,168V24A8,8,0,0,0,212.92,17.69Z"/></svg>';
    case 'video':
      return '<svg viewBox="0 0 256 256"><path d="M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73Z"/></svg>';
    case 'project':
      return '<svg viewBox="0 0 256 256"><path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Zm0,128H40V56H92.69l29.65,29.66A8,8,0,0,0,128,88h88Z"/></svg>';
    case 'image':
      return '<svg viewBox="0 0 256 256"><path d="M208,40H48A16,16,0,0,0,32,56V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40ZM96,96a16,16,0,1,1,16,16A16,16,0,0,1,96,96Zm120,104H48V56H208V200Zm-24-40a8,8,0,0,1-8,8H72a8,8,0,0,1-6.22-13l24-30a8,8,0,0,1,12.44,0L120,147.53l30.34-37.93a8,8,0,0,1,12.5.25l26,32A8,8,0,0,1,192,160Z"/></svg>';
    default:
      return '<svg viewBox="0 0 256 256"><path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31Z"/></svg>';
  }
}

function sanitizeFileName(name) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function openLibraryBlobDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = window.indexedDB.open(LIBRARY_BLOB_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LIBRARY_BLOB_STORE)) {
        db.createObjectStore(LIBRARY_BLOB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function saveLibraryBlob(fileId, blob, mimeType = '') {
  if (!fileId || !(blob instanceof Blob)) return;
  try {
    const db = await openLibraryBlobDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_BLOB_STORE, 'readwrite');
      tx.objectStore(LIBRARY_BLOB_STORE).put({
        id: fileId,
        blob,
        mimeType: mimeType || blob.type || 'application/octet-stream',
        updatedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
    });
    db.close();
  } catch (error) {
    console.warn('[Coverse] Could not persist library blob:', error);
  }
}

async function loadLibraryBlob(fileId) {
  if (!fileId) return null;
  try {
    const db = await openLibraryBlobDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_BLOB_STORE, 'readonly');
      const request = tx.objectStore(LIBRARY_BLOB_STORE).get(fileId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed'));
    });
    db.close();
    return record;
  } catch (error) {
    return null;
  }
}

async function deleteLibraryBlob(fileId) {
  if (!fileId) return;
  try {
    const db = await openLibraryBlobDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_BLOB_STORE, 'readwrite');
      tx.objectStore(LIBRARY_BLOB_STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed'));
    });
    db.close();
  } catch (error) {
    // no-op
  }
}

async function hydrateLibraryItemMedia(item) {
  if (!item || item.blobUrl) return;

  const shouldTryLocalBlob = item.section === 'local' || item.section === 'app-cache' || item.hasLocalBlob;
  if (shouldTryLocalBlob) {
    const record = await loadLibraryBlob(item.id);
    if (record?.blob instanceof Blob) {
      item._sourceFile = record.blob;
      item.mimeType = item.mimeType || record.mimeType || record.blob.type || inferMimeTypeFromName(item.name);
      item.blobUrl = URL.createObjectURL(record.blob);
      item.hasLocalBlob = true;
      return;
    }
  }

  if (!item.downloadURL && item.storagePath && window.firebaseStorage && window.firebaseStorageRef && window.firebaseGetDownloadURL) {
    try {
      const storageRef = window.firebaseStorageRef(window.firebaseStorage, item.storagePath);
      item.downloadURL = await window.firebaseGetDownloadURL(storageRef);
    } catch (error) {
      // keep metadata-only fallback
    }
  }
}

async function hydrateLibraryMedia() {
  await Promise.all(userLibrary.map((item) => hydrateLibraryItemMedia(item)));
}

async function uploadFileToAppCloud(fileData, fileBlob) {
  if (!window.firebaseStorage || !window.firebaseStorageRef || !window.firebaseUploadBytes || !window.firebaseGetDownloadURL) {
    return;
  }

  const ownerId = window.firebaseAuth?.currentUser?.uid || currentUser?.uid || '';
  if (!ownerId) {
    throw new Error('Not authenticated for App Cloud upload');
  }
  const safeName = sanitizeFileName(fileData.name);
  const storagePath = `libraries/${ownerId}/${fileData.id}_${safeName}`;

  const fileRef = window.firebaseStorageRef(window.firebaseStorage, storagePath);
  await window.firebaseUploadBytes(fileRef, fileBlob, {
    contentType: fileBlob.type || 'application/octet-stream'
  });
  const downloadURL = await window.firebaseGetDownloadURL(fileRef);

  fileData.storagePath = storagePath;
  fileData.downloadURL = downloadURL;
}

async function deleteFileFromAppCloud(file) {
  if (!file?.storagePath || !window.firebaseStorage || !window.firebaseStorageRef || !window.firebaseDeleteObject) {
    return;
  }

  try {
    const fileRef = window.firebaseStorageRef(window.firebaseStorage, file.storagePath);
    await window.firebaseDeleteObject(fileRef);
  } catch (error) {
    console.warn('[Coverse] Could not delete file from App Cloud/Cache:', error);
  }
}

async function uploadFiles() {
  if (selectedFiles.length === 0) return;

  const destination = document.querySelector('input[name="uploadDestination"]:checked')?.value || 'local';
  const saveToAppCloudCache = destination === 'cloud';
  const syncToSiteLibrary = destination === 'site';
  const siteMeta = {
    name: (document.getElementById('siteMetaName')?.value || '').trim(),
    genre: (document.getElementById('siteMetaGenre')?.value || '').trim(),
    bpm: Number((document.getElementById('siteMetaBpm')?.value || '').trim() || 0),
    key: (document.getElementById('siteMetaKey')?.value || '').trim()
  };

  const confirmBtn = document.getElementById('btnConfirmUpload');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Uploading...';
  }
  setLibraryStatus(`Uploading ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}...`, 'info', true);
  
  for (const sf of selectedFiles) {
    if (sf.size > MAX_UPLOAD_BYTES) {
      console.warn('[Coverse] Skipping oversized file during upload:', sf.name);
      continue;
    }

    const fileData = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: sf.name,
      size: sf.size,
      type: sf.type,
      section: saveToAppCloudCache ? 'app-cache' : 'local',
      uploadedAt: new Date(),
      localPath: null, // Would store actual file path
      pushToSite: saveToAppCloudCache || syncToSiteLibrary,
      siteMeta
    };
    setLibraryStatus(`Uploading ${sf.name}...`, 'info', true);
    
    // Try to read file and store locally
    try {
      // Create a blob URL for preview (in-memory for now)
      fileData.blobUrl = URL.createObjectURL(sf.file);
      fileData.mimeType = sf.file.type;
      fileData.hasLocalBlob = true;
      await saveLibraryBlob(fileData.id, sf.file, sf.file.type || inferMimeTypeFromName(fileData.name));

      if (fileData.section === 'app-cache') {
        try {
          await uploadFileToAppCloud(fileData, sf.file);
        } catch (error) {
          throw new Error(error?.message || 'App Cloud upload failed');
        }
      }

      if (syncToSiteLibrary) {
        setLibraryStatus(`Syncing ${sf.name} to Site Library...`, 'info', true);
        const siteItem = await uploadToSiteLibraryApi(fileData, sf.file);
        if (siteItem) {
          fileData.siteMirrorId = siteItem.siteId || siteItem.id?.replace(/^site_/, '') || '';
          userLibrary.push(siteItem);
          await upsertSiteLibraryFirestore(siteItem);
        } else {
          const fallbackSiteItem = normalizeSiteLibraryItem(fileData.id, {
            id: fileData.id,
            name: fileData.name,
            size: fileData.size,
            mimeType: fileData.mimeType || sf.file.type || 'application/octet-stream',
            storagePath: fileData.storagePath || '',
            downloadURL: fileData.downloadURL || '',
            uploadedAt: fileData.uploadedAt,
            source: 'site'
          });
          fileData.siteMirrorId = fallbackSiteItem.siteId || fileData.id;
          userLibrary.push(fallbackSiteItem);
          await upsertSiteLibraryFirestore(fallbackSiteItem);
        }
      }

      fileData._sourceFile = sf.file;
      
      userLibrary.push(fileData);
      console.log('[Coverse] File added to library:', fileData.name);
      
    } catch (error) {
      console.error('[Coverse] Error processing file:', error);
      alert(`Upload failed for ${sf.name}: ${error?.message || 'unknown error'}`);
      setLibraryStatus(`Upload failed for ${sf.name}`, 'error');
    }
  }
  
  // Save to localStorage for persistence
  saveLibraryToStorage();
  await saveRemoteLibraryItems();
  persistSiteLibraryCacheFromState();
  
  // Clear and close
  selectedFiles = [];
  const localDestination = document.querySelector('input[name="uploadDestination"][value="local"]');
  if (localDestination) localDestination.checked = true;
  const siteMetaName = document.getElementById('siteMetaName');
  const siteMetaGenre = document.getElementById('siteMetaGenre');
  const siteMetaBpm = document.getElementById('siteMetaBpm');
  const siteMetaKey = document.getElementById('siteMetaKey');
  if (siteMetaName) siteMetaName.value = '';
  if (siteMetaGenre) siteMetaGenre.value = '';
  if (siteMetaBpm) siteMetaBpm.value = '';
  if (siteMetaKey) siteMetaKey.value = '';
  document.getElementById('siteUploadMeta')?.classList.add('hidden');
  renderSelectedFiles();
  closeModal('uploadModal');

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Upload';
  }
  
  // Refresh library view
  renderLibrary();
  setLibraryStatus('Upload completed.', 'success');
  
  console.log('[Coverse] Upload complete, library now has', userLibrary.length, 'files');
}

function saveLibraryToStorage() {
  try {
    // Don't save blob URLs, they're temporary
    const toSave = userLibrary.filter(f => {
      const section = f.section || 'local';
      return section !== 'app-cache' && section !== 'site';
    }).map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      section: f.section || 'local',
      uploadedAt: f.uploadedAt,
      mimeType: f.mimeType,
      hasLocalBlob: !!f.hasLocalBlob,
      pushToSite: f.pushToSite
    }));
    localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('[Coverse] Error saving library:', e);
  }
}

function loadLibraryFromStorage() {
  try {
    const saved = localStorage.getItem(LIBRARY_CACHE_KEY);
    if (saved) {
      userLibrary = JSON.parse(saved);
      userLibrary = userLibrary.map((f) => ({ ...f, section: f.section || 'local', hasLocalBlob: !!f.hasLocalBlob }));
      userLibrary = dedupeLibraryItems(userLibrary);
      console.log('[Coverse] Loaded', userLibrary.length, 'files from storage');
    }
  } catch (e) {
    console.error('[Coverse] Error loading library:', e);
    userLibrary = [];
  }
}

async function saveRemoteLibraryItems() {
  const cloudItems = userLibrary.filter((f) => (f.section || 'local') === 'app-cache');

  if (!cloudItems.length) {
    try {
      localStorage.removeItem(LIBRARY_REMOTE_KEY);
    } catch (error) {
      // no-op
    }
    return;
  }

  const payload = cloudItems.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    type: f.type,
    section: 'app-cache',
    uploadedAt: f.uploadedAt,
    mimeType: f.mimeType,
    pushToSite: true,
    storagePath: f.storagePath || '',
    downloadURL: f.downloadURL || ''
  }));

  try {
    localStorage.setItem(LIBRARY_REMOTE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[Coverse] Could not cache app cloud library metadata:', error);
  }

  if (!currentUser || !window.firebaseDb) return;

  try {
    await window.firebaseSetDoc(
      window.firebaseDoc(window.firebaseDb, 'userLibraries', currentUser.uid),
      {
        uid: currentUser.uid,
        items: payload,
        updatedAt: new Date()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Coverse] Could not sync app cloud library metadata:', error);
  }
}

async function loadRemoteLibraryItems() {
  let remoteItems = [];

  try {
    const saved = localStorage.getItem(LIBRARY_REMOTE_KEY);
    if (saved) {
      remoteItems = JSON.parse(saved) || [];
    }
  } catch (error) {
    remoteItems = [];
  }

  if (currentUser && window.firebaseDb) {
    try {
      const snapshot = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'userLibraries', currentUser.uid));
      if (snapshot.exists()) {
        const cloudItems = Array.isArray(snapshot.data()?.items) ? snapshot.data().items : [];
        remoteItems = cloudItems;
        localStorage.setItem(LIBRARY_REMOTE_KEY, JSON.stringify(cloudItems));
      }
    } catch (error) {
      console.warn('[Coverse] Could not load app cloud library metadata:', error);
    }
  }

  if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
    return;
  }

  const localById = new Map(userLibrary.map((item) => [item.id, item]));
  remoteItems.forEach((item) => {
    if (!item?.id) return;
    localById.set(item.id, {
      ...localById.get(item.id),
      ...item,
      section: 'app-cache',
      hasLocalBlob: !!localById.get(item.id)?.hasLocalBlob
    });
  });
  userLibrary = dedupeLibraryItems(Array.from(localById.values()));
}

function normalizeSiteLibraryItem(docId, rawData) {
  const data = rawData || {};
  const uploadedRaw = data.uploadedAt || data.createdAt || data.timestamp || null;
  const uploadedAt = typeof uploadedRaw?.toDate === 'function' ? uploadedRaw.toDate() : uploadedRaw;
  const inferredName = data.name || data.fileName || data.title || '';
  const mimeType = data.mimeType || data.contentType || inferMimeTypeFromName(inferredName);
  const type = normalizeLibraryType(data.type, mimeType, inferredName);

  return {
    id: `site_${docId}`,
    siteId: docId,
    title: data.title || data.name || data.fileName || 'Site file',
    name: data.name || data.fileName || data.title || 'Site file',
    size: Number(data.size || data.fileSize || 0),
    type,
    section: 'site',
    uploadedAt: uploadedAt || new Date(),
    mimeType,
    storagePath: data.storagePath || data.path || '',
    downloadURL: data.downloadURL || data.url || data.fileUrl || '',
    thumbnailURL: data.thumbnailURL || data.thumbnailUrl || data.thumbUrl || data.previewUrl || data.imageUrl || '',
    previewUrl: data.previewUrl || data.thumbnailURL || data.thumbnailUrl || data.imageUrl || '',
    imageUrl: data.imageUrl || data.previewUrl || data.thumbnailURL || '',
    projectType: data.projectType || '',
    fileCategory: data.fileCategory || '',
    category: data.category || '',
    postType: data.postType || '',
    mediaKind: data.mediaKind || '',
    sampleType: data.sampleType || '',
    tag: data.tag || '',
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
    projectShares: data.projectShares || data.projectShare || '',
    genre: data.genre || '',
    bpm: Number(data.bpm || 0),
    key: data.key || '',
    ownerUid: data.ownerUid || data.uid || data.userUid || data.userId || '',
    ownerId: data.ownerId || data.userId || data.uid || '',
    uid: data.uid || data.userUid || data.userId || data.ownerUid || '',
    userId: data.userId || data.uid || data.ownerUid || '',
    ownerUsername: data.ownerUsername || data.username || data.handle || '',
    username: data.username || data.ownerUsername || data.handle || '',
    ownerName: data.ownerName || data.displayName || data.author || '',
    author: data.author || data.ownerName || '',
    uploader: data.uploader || data.author || '',
    isDeleted: !!(data.isDeleted || data.deletedAt),
    source: data.source || 'site',
    pushToSite: true
  };
}

function getSiteApiBase() {
  const stored = localStorage.getItem(API_BASE_KEY) || '';
  const configured = (window.COVERSE_API_BASE || stored || DEFAULT_API_BASE).trim();
  return configured.replace(/\/$/, '');
}

async function getSiteApiAuthHeaders() {
  let token = localStorage.getItem('coverseIdToken') || '';

  if (!token && window.firebaseAuth?.currentUser?.getIdToken) {
    try {
      token = await window.firebaseAuth.currentUser.getIdToken();
    } catch (error) {
      token = '';
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function extractLibraryArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.files)) return payload.files;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  return [];
}

function persistSiteLibraryCacheFromState() {
  const siteItems = userLibrary
    .filter((item) => (item.section || 'local') === 'site')
    .map((item) => ({
      id: item.id,
      siteId: item.siteId || '',
      name: item.name,
      size: item.size,
      type: item.type,
      section: 'site',
      uploadedAt: item.uploadedAt,
      mimeType: item.mimeType || '',
      storagePath: item.storagePath || '',
      downloadURL: item.downloadURL || '',
      source: item.source || 'site',
      pushToSite: true
    }));

  try {
    localStorage.setItem(LIBRARY_SITE_KEY, JSON.stringify(siteItems));
  } catch (error) {
    // no-op
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to encode file'));
    reader.readAsDataURL(blob);
  });
}

async function uploadToSiteLibraryApi(fileData, fileBlob) {
  const apiBase = getSiteApiBase();
  const headers = await getSiteApiAuthHeaders();
  const endpoints = ['/api/library/upload', '/api/library', '/api/files/library/upload'];

  let fileBase64 = '';
  try {
    fileBase64 = await blobToBase64(fileBlob);
  } catch (error) {
    console.warn('[Coverse] Could not encode file for Site Library API upload:', error);
    return null;
  }

  const payload = {
    name: fileData.name || 'file',
    size: Number(fileData.size || fileBlob.size || 0),
    mimeType: fileData.mimeType || fileBlob.type || 'application/octet-stream',
    type: fileData.type || 'other',
    title: fileData.siteMeta?.name || fileData.name || 'file',
    genre: fileData.siteMeta?.genre || '',
    bpm: Number(fileData.siteMeta?.bpm || 0),
    key: fileData.siteMeta?.key || '',
    source: 'site',
    fileBase64
  };

  for (const endpoint of endpoints) {
    try {
      const requestHeaders = {
        ...headers,
        'Content-Type': 'application/json'
      };

      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload)
      });

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const payload = await response.json().catch(() => ({}));
      const rawItem = payload?.item || payload?.data || payload;
      const itemId = rawItem?.id || rawItem?._id || rawItem?.fileId || fileData.id;
      return normalizeSiteLibraryItem(itemId, rawItem);
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function upsertSiteLibraryFirestore(item) {
  if (!currentUser || !window.firebaseDb || !window.firebaseSetDoc || !window.firebaseDoc) {
    return false;
  }

  const siteId = item?.siteId || item?.id?.replace(/^site_/, '') || item?.id;
  if (!siteId) return false;

  try {
    await window.firebaseSetDoc(
      window.firebaseDoc(window.firebaseDb, 'users', currentUser.uid, 'library', siteId),
      {
        id: siteId,
        name: item.name || 'File',
        size: Number(item.size || 0),
        mimeType: item.mimeType || 'application/octet-stream',
        type: item.type || 'other',
        storagePath: item.storagePath || '',
        downloadURL: item.downloadURL || '',
        uploadedAt: item.uploadedAt || new Date(),
        source: item.source || 'site'
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.warn('[Coverse] Could not write canonical site library doc:', error);
    return false;
  }
}

async function deleteSiteLibraryFirestore(siteId) {
  if (!siteId || !currentUser || !window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
    return false;
  }

  try {
    await window.firebaseSetDoc(
      window.firebaseDoc(window.firebaseDb, 'users', currentUser.uid, 'library', siteId),
      {
        deletedAt: new Date(),
        isDeleted: true
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteFromSiteLibraryApi(siteId) {
  if (!siteId) return false;

  const apiBase = getSiteApiBase();
  const headers = await getSiteApiAuthHeaders();
  const endpoints = [
    `/api/library/${encodeURIComponent(siteId)}`,
    `/api/library/delete/${encodeURIComponent(siteId)}`,
    `/api/files/library/${encodeURIComponent(siteId)}`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'DELETE',
        headers
      });

      if (response.status === 404) {
        continue;
      }

      return response.ok;
    } catch (error) {
      continue;
    }
  }

  return false;
}

async function fetchSiteLibraryItemsFromApi() {
  const apiBase = getSiteApiBase();
  const headers = await getSiteApiAuthHeaders();
  const endpoints = ['/api/library', '/api/library/list', '/api/files/library', '/api/user/library'];
  const PAGE_SIZE = 200;

  const buildUrl = (endpoint, page, cursor = '') => {
    const query = new URLSearchParams();
    query.set('limit', String(PAGE_SIZE));
    query.set('page', String(page));
    if (cursor) query.set('cursor', cursor);
    const qs = query.toString();
    return `${apiBase}${endpoint}${endpoint.includes('?') ? '&' : '?'}${qs}`;
  };

  const toNormalizedItems = (payload, startIndex = 0) => {
    const rawItems = extractLibraryArray(payload);
    return rawItems
      .filter((item) => item && !item.isDeleted && !item.deletedAt)
      .map((item, index) => {
        const itemId = item?.id || item?._id || item?.fileId || `api_${startIndex + index}`;
        return normalizeSiteLibraryItem(itemId, item);
      })
      .filter((item) => !item.isDeleted);
  };

  const resolveNextCursor = (payload = {}) => {
    return (
      payload?.nextCursor ||
      payload?.cursor ||
      payload?.pagination?.nextCursor ||
      payload?.data?.nextCursor ||
      ''
    );
  };

  const resolveHasMore = (payload = {}, receivedCount = 0) => {
    if (typeof payload?.hasMore === 'boolean') return payload.hasMore;
    if (typeof payload?.pagination?.hasNextPage === 'boolean') return payload.pagination.hasNextPage;
    if (typeof payload?.data?.hasMore === 'boolean') return payload.data.hasMore;
    if (payload?.nextCursor || payload?.pagination?.nextCursor || payload?.data?.nextCursor) return true;
    const total = Number(payload?.total || payload?.totalCount || payload?.pagination?.total || payload?.data?.total || 0);
    if (Number.isFinite(total) && total > 0) {
      return receivedCount < total;
    }
    return false;
  };

  for (const endpoint of endpoints) {
    try {
      let page = 1;
      let cursor = '';
      let rounds = 0;
      const merged = [];
      const seen = new Set();
      let observedMaxTotalCount = 0;

      while (rounds < 30) {
        rounds += 1;
        const response = await fetch(buildUrl(endpoint, page, cursor), {
          method: 'GET',
          headers
        });

        if (response.status === 404) {
          break;
        }

        if (!response.ok) {
          return { available: false, items: [] };
        }

        const payload = await response.json().catch(() => ({}));
        const payloadTotal = Number(
          payload?.totalCount ||
          payload?.total ||
          payload?.pagination?.total ||
          payload?.data?.totalCount ||
          0
        );
        if (Number.isFinite(payloadTotal) && payloadTotal > observedMaxTotalCount) {
          observedMaxTotalCount = payloadTotal;
        }

        const batch = toNormalizedItems(payload, merged.length);
        let added = 0;

        for (const item of batch) {
          const dedupeKey = item.siteId || item.id;
          if (!dedupeKey || seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          merged.push(item);
          added += 1;
        }

        const nextCursor = resolveNextCursor(payload);
        const hasMore = resolveHasMore(payload, merged.length);

        if (nextCursor) {
          if (nextCursor === cursor && added === 0) break;
          cursor = nextCursor;
          continue;
        }

        if (hasMore || batch.length >= PAGE_SIZE) {
          page += 1;
          if (added === 0 && batch.length === 0) break;
          continue;
        }

        break;
      }

      if (merged.length > 0) {
        return {
          available: true,
          items: merged,
          meta: {
            endpoint,
            pagesFetched: rounds,
            totalCount: observedMaxTotalCount,
            fetchedCount: merged.length
          }
        };
      }
    } catch (error) {
      continue;
    }
  }

  return { available: false, items: [], meta: { endpoint: '', pagesFetched: 0, totalCount: 0, fetchedCount: 0 } };
}

function normalizePurchasedLibraryCandidate(entry = {}, index = 0) {
  if (!entry || typeof entry !== 'object') return null;

  const nestedItem = entry.item && typeof entry.item === 'object' ? entry.item : {};
  const nestedProduct = entry.product && typeof entry.product === 'object' ? entry.product : {};
  const nestedMeta = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
  const nestedFile = entry.file && typeof entry.file === 'object' ? entry.file : {};

  const merged = {
    ...nestedProduct,
    ...nestedItem,
    ...nestedFile,
    ...entry,
    ...nestedMeta,
    title: entry.itemTitle || nestedItem.itemTitle || entry.title || nestedItem.title || nestedProduct.title || entry.name || nestedItem.name || nestedProduct.name || '',
    name: entry.itemTitle || nestedItem.itemTitle || entry.name || nestedItem.name || nestedProduct.name || entry.title || nestedItem.title || nestedProduct.title || '',
    downloadURL: entry.downloadURL || entry.fileUrl || entry.url || entry.audioUrl || entry.sourceUrl || nestedMeta.fileUrl || nestedMeta.downloadURL || nestedItem.downloadURL || nestedItem.fileUrl || nestedProduct.downloadURL || nestedFile.downloadURL || nestedFile.fileUrl || nestedFile.url || '',
    imageUrl: entry.image || entry.imageUrl || entry.coverImageUrl || nestedItem.image || nestedItem.imageUrl || nestedItem.coverImageUrl || nestedProduct.image || nestedProduct.imageUrl || '',
    source: 'purchase'
  };

  const purchaseId = String(
    entry.itemId ||
    nestedItem.itemId ||
    nestedProduct.itemId ||
    entry.fileId ||
    nestedItem.fileId ||
    nestedFile.fileId ||
    entry.productId ||
    nestedItem.productId ||
    entry.siteId ||
    nestedItem.siteId ||
    nestedFile.siteId ||
    entry.id ||
    nestedItem.id ||
    nestedProduct.id ||
    nestedFile.id ||
    entry.purchaseId ||
    `purchase_${index}`
  ).trim();

  if (!purchaseId) return null;

  const normalized = normalizeSiteLibraryItem(purchaseId, merged);
  return {
    ...normalized,
    section: 'site',
    source: 'purchase',
    isPurchased: true,
    purchased: true,
    purchaseId: entry.purchaseId || entry.id || purchaseId
  };
}

async function fetchPurchasedLibraryItemsFromApi() {
  const apiBase = getSiteApiBase();
  const headers = await getSiteApiAuthHeaders();
  const endpoints = ['/api/profile/purchases', '/api/getProfilePurchases', '/api/user/purchases', '/api/purchases'];

  const collectEntries = (payload = {}) => {
    const entries = [];
    const seen = new Set();

    const pushEntry = (value) => {
      if (!value || typeof value !== 'object') return;
      const key = JSON.stringify({
        id: value.id || value.purchaseId || value.itemId || value.fileId || '',
        title: value.itemTitle || value.title || value.name || '',
        fileUrl: value.fileUrl || value.downloadURL || value.url || ''
      });
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(value);
    };

    const pushIfArray = (value) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') {
            pushEntry(entry);
          }
        });
      }
    };

    const isLikelyPurchaseObject = (value = {}) => {
      if (!value || typeof value !== 'object') return false;
      return Boolean(
        value.itemId ||
        value.itemTitle ||
        value.purchaseId ||
        value.orderId ||
        value.productId ||
        value.fileId ||
        value.fileUrl ||
        value.downloadURL ||
        value.item ||
        value.product ||
        value.file ||
        value.metadata?.license
      );
    };

    const walk = (value) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach((entry) => walk(entry));
        return;
      }
      if (typeof value !== 'object') return;

      if (isLikelyPurchaseObject(value)) {
        pushEntry(value);
      }

      Object.values(value).forEach((child) => {
        if (child && typeof child === 'object') {
          walk(child);
        }
      });
    };

    pushIfArray(extractLibraryArray(payload));
    pushIfArray(normalizePurchaseList(payload));
    pushIfArray(payload?.purchases);
    pushIfArray(payload?.orders);
    pushIfArray(payload?.data?.purchases);
    pushIfArray(payload?.data?.orders);
    pushIfArray(payload?.profile?.purchases);
    pushIfArray(payload?.user?.purchases);

    walk(payload);

    return entries;
  };

  for (const endpoint of endpoints) {
    try {
      const params = new URLSearchParams();
      if (currentUser?.uid) {
        params.set('uid', currentUser.uid);
        params.set('userId', currentUser.uid);
        params.set('targetUid', currentUser.uid);
      }

      const url = `${apiBase}${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (response.status === 404) {
        continue;
      }
      if (!response.ok) {
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const rawEntries = collectEntries(payload);
      if (!rawEntries.length) {
        continue;
      }

      const byId = new Map();
      rawEntries.forEach((entry, index) => {
        const normalized = normalizePurchasedLibraryCandidate(entry, index);
        if (!normalized?.id) return;
        byId.set(normalized.id, normalized);
      });

      const items = Array.from(byId.values());
      if (items.length) {
        return { available: true, items, meta: { endpoint, fetchedCount: items.length } };
      }
    } catch (_error) {
      continue;
    }
  }

  return { available: false, items: [], meta: { endpoint: '', fetchedCount: 0 } };
}

async function loadSiteLibraryItems() {
  setLibraryStatus('Refreshing Site Library...', 'info', true);
  let cachedItems = [];
  let apiItems = [];
  let purchasedItems = [];
  let firestoreItems = [];

  try {
    const saved = localStorage.getItem(LIBRARY_SITE_KEY);
    if (saved) {
      cachedItems = JSON.parse(saved) || [];
    }
  } catch (error) {
    cachedItems = [];
  }

  const apiResult = await fetchSiteLibraryItemsFromApi();
  let apiMeta = null;
  if (apiResult.available) {
    apiItems = Array.isArray(apiResult.items) ? apiResult.items : [];
    apiMeta = apiResult.meta || null;
  }

  const purchasedResult = await fetchPurchasedLibraryItemsFromApi();
  if (purchasedResult.available) {
    purchasedItems = Array.isArray(purchasedResult.items) ? purchasedResult.items : [];
  }

  if (currentUser && window.firebaseDb) {
    try {
      const fetched = [];
      const seenIds = new Set();

      const pushUnique = (item) => {
        if (!item?.id) return;
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        fetched.push(item);
      };

      const siteCollectionRef = window.firebaseCollection(window.firebaseDb, 'users', currentUser.uid, 'library');
      const siteSnapshot = await window.firebaseGetDocs(siteCollectionRef);
      siteSnapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isDeleted) return;
        pushUnique(normalizeSiteLibraryItem(docSnap.id, data));
      });

      const legacyRef = window.firebaseCollection(window.firebaseDb, 'library');
      const legacyOwnerQueries = [
        window.firebaseQuery(legacyRef, window.firebaseWhere('ownerUid', '==', currentUser.uid)),
        window.firebaseQuery(legacyRef, window.firebaseWhere('uid', '==', currentUser.uid)),
        window.firebaseQuery(legacyRef, window.firebaseWhere('userId', '==', currentUser.uid))
      ];

      for (const legacyQuery of legacyOwnerQueries) {
        try {
          const legacySnapshot = await window.firebaseGetDocs(legacyQuery);
          legacySnapshot.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (data.isDeleted) return;
            pushUnique(normalizeSiteLibraryItem(docSnap.id, data));
          });
        } catch (legacyError) {
          // keep best-effort compatibility across schema/rules variations
        }
      }

      firestoreItems = fetched
        .filter((item) => !item?.isDeleted)
        .map((item) => ({ ...item, section: 'site' }));
    } catch (error) {
      console.warn('[Coverse] Could not load site library items:', error);
    }
  }

  const mergedById = new Map();
  const addItems = (items) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item?.id || item.isDeleted) return;
      mergedById.set(item.id, {
        ...mergedById.get(item.id),
        ...item,
        section: 'site'
      });
    });
  };

  addItems(cachedItems);
  addItems(apiItems);
  addItems(purchasedItems);
  addItems(firestoreItems);
  const siteItems = Array.from(mergedById.values());

  try {
    localStorage.setItem(LIBRARY_SITE_KEY, JSON.stringify(siteItems));
  } catch (error) {
    // no-op
  }

  if (!Array.isArray(siteItems) || siteItems.length === 0) {
    setLibraryStatus('Site Library refreshed (0 items).', 'info');
    return;
  }

  const localById = new Map(userLibrary.map((item) => [item.id, item]));
  siteItems.forEach((item) => {
    if (!item?.id || item.isDeleted) return;
    localById.set(item.id, {
      ...localById.get(item.id),
      ...item,
      section: 'site'
    });
  });
  userLibrary = dedupeLibraryItems(Array.from(localById.values()));
  const apiDebug = apiMeta
    ? `apiFetched ${apiMeta.fetchedCount}/${apiMeta.totalCount || '?'} in ${apiMeta.pagesFetched} page(s)`
    : `apiFetched ${apiItems.length}`;
  setLibraryStatus(`Site Library refreshed (${siteItems.length}; cache ${cachedItems.length}, API ${apiItems.length}, purchases ${purchasedItems.length}, cloud ${firestoreItems.length}; ${apiDebug}).`, 'success');
}

function initPreviewModal() {
  document.getElementById('btnClosePreview')?.addEventListener('click', () => {
    closeModal('filePreviewModal');
    // Pause any playing media
    const audio = document.getElementById('audioPlayer');
    const video = document.getElementById('videoPlayer');
    if (audio) audio.pause();
    if (video) video.pause();
  });
  
  document.getElementById('btnDeleteFile')?.addEventListener('click', () => {
    if (currentPreviewFile) {
      deleteFile(currentPreviewFile.id);
      closeModal('filePreviewModal');
    }
  });
  
  document.getElementById('btnDownloadFile')?.addEventListener('click', async () => {
    if (currentPreviewFile) {
      await downloadFile(currentPreviewFile);
    }
  });

  document.getElementById('btnPlayInBottom')?.addEventListener('click', async () => {
    if (currentPreviewFile) {
      await playLibraryItem(currentPreviewFile.id);
    }
  });

  document.getElementById('btnPushToSite')?.addEventListener('click', async () => {
    if (currentPreviewFile) {
      await pushItemToSiteLibrary(currentPreviewFile.id);
    }
  });

  document.getElementById('btnCopyToLocal')?.addEventListener('click', async () => {
    if (currentPreviewFile) {
      await copyItemToSection(currentPreviewFile.id, 'local');
    }
  });

  document.getElementById('btnCopyToAppCloud')?.addEventListener('click', async () => {
    if (currentPreviewFile) {
      await copyItemToSection(currentPreviewFile.id, 'app-cache');
    }
  });
}

let currentPreviewFile = null;

async function openFilePreview(fileId, autoPlay = false) {
  const file = findRenderableLibraryItemById(fileId);
  if (!file) return;
  
  currentPreviewFile = file;
  
  // Set file info
  document.getElementById('previewFileName').textContent = file.name;
  document.getElementById('previewFileMeta').textContent = 
    `${getFileTypeLabel(file)} · ${formatFileSize(file.size)} · Uploaded ${formatDate(file.uploadedAt)}`;
  
  // Hide all preview types
  document.getElementById('previewAudio').classList.add('hidden');
  document.getElementById('previewVideo').classList.add('hidden');
  document.getElementById('previewImage').classList.add('hidden');
  document.getElementById('previewGeneric').classList.add('hidden');
  hideZipPreview();
  
  // Show appropriate preview
  const mediaUrl = getPreferredPreviewSource(file);

  const effectiveMime = file.mimeType || inferMimeTypeFromName(file.name);

  if (effectiveMime?.startsWith('audio/')) {
    const source = mediaUrl || await ensurePlayableSource(file);
    if (!source) {
      document.getElementById('previewGeneric').classList.remove('hidden');
      updatePreviewTransferActions(file);
      openModal('filePreviewModal');
      return;
    }
    document.getElementById('previewAudio').classList.remove('hidden');
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = source;
    if (autoPlay) {
      audioPlayer.play?.().catch(() => {});
    }
  } else if (effectiveMime?.startsWith('video/')) {
    const source = mediaUrl || await ensurePlayableSource(file);
    if (!source) {
      document.getElementById('previewGeneric').classList.remove('hidden');
      updatePreviewTransferActions(file);
      openModal('filePreviewModal');
      return;
    }
    document.getElementById('previewVideo').classList.remove('hidden');
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.src = source;
    if (autoPlay) {
      videoPlayer.play?.().catch(() => {});
    }
  } else if (effectiveMime?.startsWith('image/') && mediaUrl) {
    document.getElementById('previewImage').classList.remove('hidden');
    document.getElementById('imagePreview').src = mediaUrl;
  } else if (effectiveMime?.startsWith('image/')) {
    const source = await ensurePlayableSource(file);
    if (source) {
      document.getElementById('previewImage').classList.remove('hidden');
      document.getElementById('imagePreview').src = source;
    } else {
      document.getElementById('previewGeneric').classList.remove('hidden');
    }
  } else {
    document.getElementById('previewGeneric').classList.remove('hidden');
    const normalizedType = normalizeLibraryType(file.type, file.mimeType || inferMimeTypeFromName(file.name), file.name);
    if (isZipFile(file) || normalizedType === 'project') {
      await renderZipPreview(file);
    }
  }

  updatePreviewTransferActions(file);
  
  openModal('filePreviewModal');
}

async function deleteFile(fileId) {
  const index = userLibrary.findIndex(f => f.id === fileId);
  if (index > -1) {
    const fileToDelete = userLibrary[index];

    if ((fileToDelete.section || 'local') === 'site') {
      const siteId = fileToDelete.siteId || fileToDelete.id?.replace(/^site_/, '') || '';
      const deleted = await deleteFromSiteLibraryApi(siteId);
      const firestoreDeleted = await deleteSiteLibraryFirestore(siteId);
      if (!deleted && !firestoreDeleted) {
        alert('Could not delete Site Library item. Check API access and try again.');
        return;
      }
    }

    // Revoke blob URL if exists
    if (fileToDelete.blobUrl) {
      URL.revokeObjectURL(fileToDelete.blobUrl);
    }
    await deleteLibraryBlob(fileToDelete.id);
    if ((fileToDelete.section || 'local') === 'app-cache') {
      await deleteFileFromAppCloud(fileToDelete);
    }

    userLibrary.splice(index, 1);

    if ((fileToDelete.section || 'local') !== 'site' && fileToDelete.siteMirrorId) {
      await deleteFromSiteLibraryApi(fileToDelete.siteMirrorId);
      await deleteSiteLibraryFirestore(fileToDelete.siteMirrorId);
      userLibrary = userLibrary.filter((item) => {
        const itemSiteId = item.siteId || item.id?.replace(/^site_/, '') || '';
        return itemSiteId !== fileToDelete.siteMirrorId;
      });
    }

    saveLibraryToStorage();
    await saveRemoteLibraryItems();
    persistSiteLibraryCacheFromState();
    renderLibrary();
  }
}

async function downloadFile(file) {
  if (!file) return;

  const sourceUrl = await resolveFileSourceUrl(file);
  const saveFromUrlBridge = window.coverse?.saveLibraryFileFromUrl;
  if (sourceUrl && typeof saveFromUrlBridge === 'function' && /^https?:\/\//i.test(sourceUrl)) {
    const saveResult = await saveFromUrlBridge({
      defaultName: file.name || 'download',
      url: sourceUrl
    });

    if (saveResult?.ok) {
      if (!userLibrary.find((item) => item.sourceId === file.id && (item.section || 'local') === 'downloaded')) {
        userLibrary.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          sourceId: file.id,
          name: file.name,
          size: Number(file.size || 0),
          type: normalizeLibraryType(file.type, file.mimeType || inferMimeTypeFromName(file.name), file.name),
          section: 'downloaded',
          uploadedAt: new Date(),
          mimeType: file.mimeType || inferMimeTypeFromName(file.name),
          downloadURL: sourceUrl,
          hasLocalBlob: false,
          pushToSite: false
        });
        saveLibraryToStorage();
        await saveRemoteLibraryItems();
        persistSiteLibraryCacheFromState();
        renderLibrary();
      }
      return;
    }

    if (!saveResult?.canceled) {
      alert(saveResult?.error || 'Could not save file to disk.');
    }
    return;
  }

  const blob = await resolveFileBlob(file);
  if (!blob) {
    alert('Source data not found yet for this item. Try opening or playing it once, then download again.');
    return;
  }

  const bridge = window.coverse?.saveLibraryFile;
  if (typeof bridge === 'function') {
    const data = await blob.arrayBuffer();
    const saveResult = await bridge({
      defaultName: file.name || 'download',
      mimeType: file.mimeType || blob.type || inferMimeTypeFromName(file.name),
      data
    });

    if (!saveResult?.ok) {
      if (!saveResult?.canceled) {
        alert(saveResult?.error || 'Could not save file to disk.');
      }
      return;
    }
  } else {
    const sourceUrl = file.blobUrl || URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = sourceUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const existingDownloaded = userLibrary.find((item) => item.sourceId === file.id && (item.section || 'local') === 'downloaded');
  if (!existingDownloaded) {
    const downloadedItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      sourceId: file.id,
      name: file.name,
      size: Number(file.size || blob.size || 0),
      type: normalizeLibraryType(file.type, file.mimeType || blob.type || inferMimeTypeFromName(file.name), file.name),
      section: 'downloaded',
      uploadedAt: new Date(),
      mimeType: file.mimeType || blob.type || inferMimeTypeFromName(file.name),
      blobUrl: URL.createObjectURL(blob),
      hasLocalBlob: true,
      pushToSite: false,
      _sourceFile: blob
    };
    userLibrary.push(downloadedItem);
    await saveLibraryBlob(downloadedItem.id, blob, downloadedItem.mimeType);
    saveLibraryToStorage();
    await saveRemoteLibraryItems();
    persistSiteLibraryCacheFromState();
    renderLibrary();
  }
}

async function resolveFileBlob(file) {
  if (!file) return null;
  if (file._sourceFile instanceof Blob) return file._sourceFile;

  const sourceUrl = await resolveFileSourceUrl(file);
  if (!sourceUrl) return null;

  const persistResolvedBlob = async (blob) => {
    if (!blob) return null;
    file._sourceFile = blob;
    file.hasLocalBlob = true;
    await saveLibraryBlob(file.id, blob, file.mimeType || blob.type || inferMimeTypeFromName(file.name));
    return blob;
  };

  const fetchBlobBridge = window.coverse?.fetchLibraryBlobFromUrl;
  const isFirebaseStorageUrl = /^https:\/\/firebasestorage\.googleapis\.com\//i.test(sourceUrl);
  if (isFirebaseStorageUrl && typeof fetchBlobBridge === 'function') {
    try {
      const result = await fetchBlobBridge({ url: sourceUrl });
      if (result?.ok && result.dataBase64) {
        const binary = atob(result.dataBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.contentType || file.mimeType || inferMimeTypeFromName(file.name) });
        return await persistResolvedBlob(blob);
      }
    } catch (error) {
      // fall through to renderer fetch fallback
    }
  }

  try {
    let response = await fetch(sourceUrl);
    if (!response.ok) {
      const authHeaders = await getSiteApiAuthHeaders();
      response = await fetch(sourceUrl, { headers: authHeaders });
    }
    if (response.ok) {
      const blob = await response.blob();
      return await persistResolvedBlob(blob);
    }
  } catch (error) {
    // try Electron main-process fallback below
  }

  if (typeof fetchBlobBridge === 'function' && /^https?:\/\//i.test(sourceUrl)) {
    try {
      const result = await fetchBlobBridge({ url: sourceUrl });
      if (result?.ok && result.dataBase64) {
        const binary = atob(result.dataBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.contentType || file.mimeType || inferMimeTypeFromName(file.name) });
        return await persistResolvedBlob(blob);
      }
    } catch (error) {
      // no-op
    }
  }

  return null;
}

async function resolveFileSourceUrl(file) {
  if (!file) return '';
  if (file.blobUrl) return file.blobUrl;
  if (file.downloadURL) return file.downloadURL;

  if (file.storagePath && window.firebaseStorage && window.firebaseStorageRef && window.firebaseGetDownloadURL) {
    try {
      const storageRef = window.firebaseStorageRef(window.firebaseStorage, file.storagePath);
      const url = await window.firebaseGetDownloadURL(storageRef);
      if (url) {
        file.downloadURL = url;
        return url;
      }
    } catch (error) {
      // fall through to API refresh
    }
  }

  if ((file.section || 'local') === 'site') {
    try {
      const apiResult = await fetchSiteLibraryItemsFromApi();
      if (apiResult.available) {
        const targetSiteId = file.siteId || file.id?.replace(/^site_/, '') || file.id;
        const refreshed = apiResult.items.find((item) => {
          const refreshedId = item.siteId || item.id?.replace(/^site_/, '') || item.id;
          return refreshedId === targetSiteId;
        });
        if (refreshed) {
          if (refreshed.downloadURL) file.downloadURL = refreshed.downloadURL;
          if (refreshed.storagePath) file.storagePath = refreshed.storagePath;
          if (file.downloadURL) return file.downloadURL;

          if (file.storagePath && window.firebaseStorage && window.firebaseStorageRef && window.firebaseGetDownloadURL) {
            try {
              const storageRef = window.firebaseStorageRef(window.firebaseStorage, file.storagePath);
              const url = await window.firebaseGetDownloadURL(storageRef);
              if (url) {
                file.downloadURL = url;
                return url;
              }
            } catch (error) {
              // no-op
            }
          }
        }
      }
    } catch (error) {
      // no-op
    }
  }

  return '';
}

async function ensurePlayableSource(file) {
  if (!file) return '';
  if (file.blobUrl) return file.blobUrl;
  const resolvedSource = await resolveFileSourceUrl(file);
  if (resolvedSource) return resolvedSource;

  const isPurchaseLike = Boolean(
    file.isPurchased ||
    file.purchased ||
    file.purchaseId ||
    String(file.source || '').toLowerCase() === 'purchase' ||
    file.postId
  );

  if (isPurchaseLike) {
    const targetPostId = String(file.postId || file.sourceId || '').trim();
    const targetPurchaseId = String(file.purchaseId || '').trim();
    const purchasePost = getSimpleProfilePurchasePosts().find((post) => {
      const postId = String(post?.postId || '').trim();
      const purchaseId = String(post?.purchaseId || '').trim();
      const id = String(post?.id || '').trim();
      if (targetPostId && (postId === targetPostId || id === targetPostId)) return true;
      if (targetPurchaseId && purchaseId === targetPurchaseId) return true;
      return false;
    });

    if (purchasePost) {
      const purchaseSource = await resolveProfilePostAudioSource(purchasePost);
      if (purchaseSource) {
        file.downloadURL = purchaseSource;
        file.sourceAudioUrl = purchaseSource;
        if (!file.storagePath && purchasePost.storagePath) {
          file.storagePath = purchasePost.storagePath;
        }
        return purchaseSource;
      }
    }
  }

  const blob = await resolveFileBlob(file);
  if (blob) {
    file._sourceFile = blob;
    file.blobUrl = URL.createObjectURL(blob);
    file.hasLocalBlob = true;
    await saveLibraryBlob(file.id, blob, file.mimeType || blob.type || inferMimeTypeFromName(file.name));
    return file.blobUrl;
  }

  return '';
}

function updatePreviewTransferActions(file) {
  const section = file?.section || 'local';
  const isReadOnly = file?.isReadOnly === true || section === 'profile-upload';
  const showPush = !isReadOnly && section !== 'site';
  const showLocal = !isReadOnly && section === 'site';
  const showCloud = !isReadOnly && section === 'site';
  const showBottomPlayer = normalizeLibraryType(file?.type, file?.mimeType || inferMimeTypeFromName(file?.name || ''), file?.name || '') === 'audio';

  document.getElementById('btnPlayInBottom')?.classList.toggle('hidden', !showBottomPlayer);
  document.getElementById('btnPushToSite')?.classList.toggle('hidden', !showPush);
  document.getElementById('btnCopyToLocal')?.classList.toggle('hidden', !showLocal);
  document.getElementById('btnCopyToAppCloud')?.classList.toggle('hidden', !showCloud);
  document.getElementById('btnDeleteFile')?.classList.toggle('hidden', isReadOnly);
  document.getElementById('btnDownloadFile')?.classList.toggle('hidden', isReadOnly);
}

function isPlayableLibraryItem(file) {
  if (!file) return false;
  const normalizedType = normalizeLibraryType(file.type, file.mimeType || inferMimeTypeFromName(file.name), file.name);
  return normalizedType === 'audio' || normalizedType === 'video';
}

function buildPlayerQueue() {
  const q = [...buildLibraryQueueCandidates()].filter((item) => {
    const normalizedType = normalizeLibraryType(item.type, item.mimeType || inferMimeTypeFromName(item.name), item.name);
    return normalizedType === 'audio';
  });
  q.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
  return q;
}

function mapProfilePostToPlayerItem(post = {}) {
  const normalized = normalizeProfilePostItem(post || {});
  const playable = normalizeProfileMediaUrl(normalized.downloadURL || normalized.audioUrl || normalized.sourceAudioUrl || '');
  return {
    id: `profile_post_${String(normalized.id || '').trim()}`,
    sourceId: normalized.id || '',
    name: normalized.title || normalized.name || 'Untitled',
    size: Number(normalized.size || 0),
    type: 'audio',
    section: 'profile-upload',
    uploadedAt: normalized.uploadedAt || normalized.createdAt || new Date(),
    mimeType: normalized.mimeType || inferMimeTypeFromName(normalized.name || ''),
    downloadURL: playable,
    sourceAudioUrl: playable,
    storagePath: normalized.storagePath || '',
    isReadOnly: true
  };
}

function buildBottomPlayerProfileQueue() {
  const byId = new Map();

  const addProfilePost = (post = {}) => {
    if (!post || typeof post !== 'object') return;

    const normalized = normalizeProfilePostItem(post || {});
    const mimeType = normalized.mimeType || inferMimeTypeFromName(normalized.name || normalized.title || '');
    const normalizedType = normalizeLibraryType(normalized.type, mimeType, normalized.name || normalized.title || '');
    const hasDirectSource = Boolean(normalizeProfileMediaUrl(normalized.downloadURL || normalized.audioUrl || normalized.sourceAudioUrl || ''));
    const hasStorage = Boolean(String(normalized.storagePath || '').trim());
    if (!(normalizedType === 'audio' || hasDirectSource || hasStorage)) return;

    const mapped = mapProfilePostToPlayerItem(normalized);
    const key = String(mapped.sourceId || mapped.id || '').trim().toLowerCase();
    if (!key) return;

    if (!byId.has(key)) {
      byId.set(key, mapped);
      return;
    }

    const existing = byId.get(key) || {};
    const existingHasSource = Boolean(existing.downloadURL || existing.storagePath);
    const incomingHasSource = Boolean(mapped.downloadURL || mapped.storagePath);
    if (!existingHasSource && incomingHasSource) {
      byId.set(key, { ...existing, ...mapped });
      return;
    }

    const existingTime = getTimestampMs(existing.uploadedAt || existing.createdAt);
    const incomingTime = getTimestampMs(mapped.uploadedAt || mapped.createdAt);
    if (incomingTime > existingTime) {
      byId.set(key, { ...existing, ...mapped });
    }
  };

  (simpleProfilePostsCache || []).forEach((post) => addProfilePost(post));
  getSimpleProfilePurchasePosts().forEach((post) => addProfilePost(post));

  return Array.from(byId.values())
    .sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
}

async function playProfilePostInBottomPlayer(profilePostId = '', preferredSource = '') {
  const postId = String(profilePostId || '').trim();
  if (!postId) return;

  const profileAudioPosts = buildBottomPlayerProfileQueue();

  if (!profileAudioPosts.length) return;

  const targetId = `profile_post_${postId}`;
  const nextIndex = profileAudioPosts.findIndex((item) => item.id === targetId);
  if (nextIndex < 0) return;

  const hintedSource = normalizeProfileMediaUrl(preferredSource || '');
  if (hintedSource && profileAudioPosts[nextIndex]) {
    const target = profileAudioPosts[nextIndex];
    target.downloadURL = target.downloadURL || hintedSource;
    target.sourceAudioUrl = target.sourceAudioUrl || hintedSource;
  }

  playerQueue = profileAudioPosts;
  await playQueueIndex(nextIndex);
}

function setGlobalPlayerMinimized(minimized) {
  const player = document.getElementById('globalPlayer');
  const btnMinimize = document.getElementById('globalPlayerMinimize');
  const btnRestore = document.getElementById('globalPlayerRestore');
  if (!player || !btnMinimize || !btnRestore) return;

  isGlobalPlayerMinimized = Boolean(minimized);
  player.classList.toggle('minimized', isGlobalPlayerMinimized);
  btnMinimize.classList.toggle('hidden', isGlobalPlayerMinimized);
  btnRestore.classList.toggle('hidden', !isGlobalPlayerMinimized);
}

function updateGlobalPlayerUi(file, isPlaying) {
  const player = document.getElementById('globalPlayer');
  const title = document.getElementById('globalPlayerTitle');
  const meta = document.getElementById('globalPlayerMeta');
  const toggle = document.getElementById('globalPlayerToggle');
  if (!player || !title || !meta || !toggle) return;

  if (!file) {
    player.classList.add('hidden');
    setGlobalPlayerMinimized(false);
    title.textContent = 'No track selected';
    meta.textContent = 'Select a sample or song to play';
    return;
  }

  player.classList.remove('hidden');
  setGlobalPlayerMinimized(isGlobalPlayerMinimized);
  title.textContent = file.name || 'Untitled';
  meta.textContent = `${getSectionLabel(file.section || 'local')} · ${getFileTypeLabel(file)}`;
  toggle.classList.toggle('global-player-btn--primary', !isPlaying);
  toggle.innerHTML = isPlaying
    ? '<svg viewBox="0 0 256 256"><path d="M96,48H64A16,16,0,0,0,48,64V192a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V64A16,16,0,0,0,96,48Zm96,0H160a16,16,0,0,0-16,16V192a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V64A16,16,0,0,0,192,48Z"/></svg>'
    : '<svg viewBox="0 0 256 256"><path d="M88,64V192a8,8,0,0,0,12.14,6.86l96-64a8,8,0,0,0,0-13.72l-96-64A8,8,0,0,0,88,64Z"/></svg>';
}

function ensureGlobalPlayerWaveform(audioEl, sourceUrl = '') {
  const container = document.getElementById('globalPlayerWaveform');
  if (!audioEl || !container || !window.WaveSurfer?.create) return;

  try {
    if (!globalPlayerWaveform) {
      globalPlayerWaveform = window.WaveSurfer.create({
        container,
        media: audioEl,
        backend: 'MediaElement',
        mediaType: 'audio',
        waveColor: '#22d3ee',
        progressColor: '#34d399',
        height: 34,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true
      });
    }

    const proxied = getWaveformCompatibleAudioUrl(sourceUrl);
    if (proxied && proxied !== globalPlayerWaveformSource) {
      globalPlayerWaveformSource = proxied;
      globalPlayerWaveform.load(proxied);
    }
  } catch (_error) {
    // no-op
  }
}

function resolveCurrentPlayerItem() {
  const fromQueue = playerQueue.find((item) => item && item.id === playerCurrentFileId);
  if (fromQueue) return fromQueue;
  if (playerCurrentItem && playerCurrentItem.id === playerCurrentFileId) return playerCurrentItem;
  const fromLibrary = userLibrary.find((item) => item && item.id === playerCurrentFileId);
  return fromLibrary || null;
}

async function playQueueIndex(index) {
  const audio = document.getElementById('globalPlayerAudio');
  if (!audio) return;
  if (index < 0 || index >= playerQueue.length) return;

  const file = playerQueue[index];
  updateGlobalPlayerUi(file, false);
  const meta = document.getElementById('globalPlayerMeta');
  if (meta) meta.textContent = 'Loading track...';
  const source = await ensurePlayableSource(file);
  if (!source) {
    if (meta) meta.textContent = 'Source unavailable';
    const message = 'Track source unavailable right now.';
    setLibraryStatus(message, 'error');
    showNotification(message);
    return;
  }

  playerCurrentIndex = index;
  playerCurrentFileId = file.id;
  playerCurrentItem = file;
  pauseOtherWaveforms('__global_player__');
  const waveformSource = getWaveformCompatibleAudioUrl(source);
  audio.src = waveformSource || source;
  ensureGlobalPlayerWaveform(audio, source);
  await audio.play().catch(() => {});
  updateGlobalPlayerUi(file, true);
  saveLibraryToStorage();
  await saveRemoteLibraryItems();
}

async function playLibraryItem(fileId) {
  const target = findRenderableLibraryItemById(fileId);
  if (!target) return;

  const normalizedType = normalizeLibraryType(target.type, target.mimeType || inferMimeTypeFromName(target.name), target.name);
  if (normalizedType !== 'audio') {
    openFilePreview(fileId, true);
    return;
  }

  playerQueue = buildPlayerQueue();
  const index = playerQueue.findIndex((item) => item.id === fileId);
  if (index === -1) {
    playerQueue = [target];
    await playQueueIndex(0);
    return;
  }
  await playQueueIndex(index);
}

function handleLibraryItemClick(fileId) {
  openFilePreview(fileId);
}

function initGlobalPlayer() {
  const audio = document.getElementById('globalPlayerAudio');
  const btnToggle = document.getElementById('globalPlayerToggle');
  const btnPrev = document.getElementById('globalPlayerPrev');
  const btnNext = document.getElementById('globalPlayerNext');
  const btnMinimize = document.getElementById('globalPlayerMinimize');
  const btnRestore = document.getElementById('globalPlayerRestore');
  const btnClose = document.getElementById('globalPlayerClose');
  if (!audio || !btnToggle || !btnPrev || !btnNext || !btnMinimize || !btnRestore || !btnClose) return;

  ensureGlobalPlayerWaveform(audio, '');
  setGlobalPlayerMinimized(false);

  btnMinimize.addEventListener('click', () => {
    setGlobalPlayerMinimized(true);
  });

  btnRestore.addEventListener('click', () => {
    setGlobalPlayerMinimized(false);
  });

  btnToggle.addEventListener('click', async () => {
    if (!audio.src && playerCurrentIndex >= 0) {
      await playQueueIndex(playerCurrentIndex);
      return;
    }
    if (audio.paused) {
      pauseOtherWaveforms('__global_player__');
      await audio.play().catch(() => {});
      const file = resolveCurrentPlayerItem();
      updateGlobalPlayerUi(file || null, true);
    } else {
      audio.pause();
      pauseOtherWaveforms('__global_player__');
      const file = resolveCurrentPlayerItem();
      updateGlobalPlayerUi(file || null, false);
    }
  });

  btnPrev.addEventListener('click', async () => {
    if (!playerQueue.length) playerQueue = buildPlayerQueue();
    if (!playerQueue.length) return;
    const nextIndex = playerCurrentIndex > 0 ? playerCurrentIndex - 1 : playerQueue.length - 1;
    await playQueueIndex(nextIndex);
  });

  btnNext.addEventListener('click', async () => {
    if (!playerQueue.length) playerQueue = buildPlayerQueue();
    if (!playerQueue.length) return;
    const nextIndex = playerCurrentIndex < playerQueue.length - 1 ? playerCurrentIndex + 1 : 0;
    await playQueueIndex(nextIndex);
  });

  btnClose.addEventListener('click', () => {
    playerCurrentFileId = null;
    playerCurrentItem = null;
    playerCurrentIndex = -1;
    playerQueue = [];
    setGlobalPlayerMinimized(false);
    audio.pause();
    audio.src = '';
    globalPlayerWaveformSource = '';
    if (globalPlayerWaveform?.empty) {
      try {
        globalPlayerWaveform.empty();
      } catch (_error) {
        // no-op
      }
    }
    updateGlobalPlayerUi(null, false);
  });

  audio.addEventListener('ended', async () => {
    if (!playerQueue.length) playerQueue = buildPlayerQueue();
    if (!playerQueue.length) return;
    const nextIndex = playerCurrentIndex < playerQueue.length - 1 ? playerCurrentIndex + 1 : 0;
    await playQueueIndex(nextIndex);
  });
}

async function pushItemToSiteLibrary(fileId) {
  const file = userLibrary.find((item) => item.id === fileId);
  if (!file || (file.section || 'local') === 'site') return;

  setLibraryStatus(`Transferring ${file.name} to Site Library...`, 'info', true);

  await resolveFileSourceUrl(file);
  const blob = await resolveFileBlob(file);
  if (!blob) {
    setLibraryStatus('Transfer failed: source data unavailable.', 'error');
    alert('Source data not found for this item yet. Try playing/opening it once, then push again.');
    return;
  }

  const siteItem = await uploadToSiteLibraryApi({
    id: file.id,
    name: file.name,
    size: Number(file.size || blob.size || 0),
    type: normalizeLibraryType(file.type, file.mimeType || blob.type || inferMimeTypeFromName(file.name), file.name),
    mimeType: file.mimeType || blob.type || inferMimeTypeFromName(file.name)
  }, blob);

  if (!siteItem) {
    setLibraryStatus('Transfer to Site Library failed.', 'error');
    alert('Could not push this file to Site Library. Check API access and try again.');
    return;
  }

  file.siteMirrorId = siteItem.siteId || siteItem.id?.replace(/^site_/, '') || '';
  userLibrary = userLibrary.filter((item) => item.id !== siteItem.id);
  userLibrary.push(siteItem);
  await upsertSiteLibraryFirestore(siteItem);
  saveLibraryToStorage();
  await saveRemoteLibraryItems();
  persistSiteLibraryCacheFromState();
  renderLibrary();
  setLibraryStatus('Transferred to Site Library.', 'success');
  alert('Pushed to Site Library.');
}

async function copyItemToSection(fileId, targetSection) {
  const file = userLibrary.find((item) => item.id === fileId);
  if (!file || (file.section || 'local') !== 'site') return;
  if (!['local', 'app-cache'].includes(targetSection)) return;

  setLibraryStatus(`Copying ${file.name} to ${targetSection === 'app-cache' ? 'App Cloud' : 'Local'}...`, 'info', true);

  const sourceUrl = await resolveFileSourceUrl(file);
  const blob = await resolveFileBlob(file);
  if (!blob) {
    setLibraryStatus('Copy failed: source data unavailable.', 'error');
    alert('Source data not found for this Site item yet. Try opening/playing it once, then copy again.');
    return;
  }

  const copied = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: file.name,
    size: Number(file.size || blob.size || 0),
    type: normalizeLibraryType(file.type, file.mimeType || blob.type || inferMimeTypeFromName(file.name), file.name),
    section: targetSection,
    uploadedAt: new Date(),
    mimeType: file.mimeType || blob.type || inferMimeTypeFromName(file.name),
    blobUrl: URL.createObjectURL(blob),
    downloadURL: sourceUrl || file.downloadURL || '',
    storagePath: file.storagePath || '',
    hasLocalBlob: true,
    pushToSite: targetSection === 'app-cache',
    _sourceFile: blob
  };

  if (targetSection === 'app-cache') {
    try {
      await uploadFileToAppCloud(copied, blob);
    } catch (error) {
      const authUid = window.firebaseAuth?.currentUser?.uid || currentUser?.uid || 'none';
      setLibraryStatus('Copy to App Cloud failed.', 'error');
      alert(`Could not copy to App Cloud. Storage upload failed (auth uid: ${authUid}).`);
      return;
    }
  }

  try {
    userLibrary.push(copied);
    await saveLibraryBlob(copied.id, blob, copied.mimeType);
    saveLibraryToStorage();
    await saveRemoteLibraryItems();
    persistSiteLibraryCacheFromState();
    renderLibrary();
    setLibraryStatus(targetSection === 'app-cache' ? 'Copied to App Cloud.' : 'Copied to Local.', 'success');
    alert(targetSection === 'app-cache' ? 'Copied to App Cloud/Cache.' : 'Copied to Local.');
  } catch (error) {
    setLibraryStatus('Copy partially completed, but state save failed.', 'error');
    alert('Copy completed partially but could not persist library state.');
  }
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderLibrary(searchQuery = '') {
  const grid = document.getElementById('libraryGrid');
  const list = document.getElementById('libraryList');
  const empty = document.getElementById('libraryEmpty');
  
  if (!grid || !list || !empty) return;
  
  // Filter files
  let files = currentLibraryTab === 'purchases'
    ? getLibraryPurchaseTabItems()
    : getRenderableLibraryItems();
  
  // Filter by tab
  if (currentLibraryTab !== 'all' && currentLibraryTab !== 'purchases') {
    const sectionMap = {
      local: 'local',
      downloaded: 'downloaded',
      cache: 'app-cache',
      site: 'site'
    };
    const filterSection = sectionMap[currentLibraryTab];
    files = files.filter(f => (f.section || 'local') === filterSection);
  }
  
  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    files = files.filter(f => f.name.toLowerCase().includes(q));
  }
  
  // Sort
  const sortBy = document.getElementById('librarySortSelect')?.value || 'newest';
  switch (sortBy) {
    case 'newest':
      files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      break;
    case 'oldest':
      files.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
      break;
    case 'name':
      files.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'size':
      files.sort((a, b) => b.size - a.size);
      break;
  }
  
  // Show empty state or files
  if (files.length === 0) {
    empty.style.display = 'flex';
    grid.classList.add('hidden');
    list.classList.add('hidden');
    return;
  }
  
  empty.style.display = 'none';
  
  if (libraryViewMode === 'grid') {
    grid.classList.remove('hidden');
    list.classList.add('hidden');
    renderLibraryGrid(files, grid);
  } else {
    list.classList.remove('hidden');
    grid.classList.add('hidden');
    renderLibraryList(files, list);
  }
}

function renderLibraryGrid(files, container) {
  let html = '';
  
  files.forEach(file => {
    const effectiveMime = file.mimeType || inferMimeTypeFromName(file.name);
    const normalizedType = normalizeLibraryType(file.type, effectiveMime, file.name);
    const icon = getFileIcon(normalizedType);
    const isReadOnly = file.isReadOnly === true || (file.section || '') === 'profile-upload';
    const canDelete = !isReadOnly;
    const previewSource = getPreferredPreviewSource(file);
    requestThumbnailHydration(file);
    let previewHtml = icon;
    if ((effectiveMime?.startsWith('image/') || normalizedType === 'image') && previewSource) {
      previewHtml = `<img src="${previewSource}" alt="${escapeHtml(file.name)}">`;
    } else if ((effectiveMime?.startsWith('video/') || normalizedType === 'video') && previewSource) {
      previewHtml = `<video src="${previewSource}" muted></video>`;
    }
    const typeLabel = getFileTypeLabel({ ...file, type: normalizedType, mimeType: effectiveMime });
    const canPlay = isPlayableLibraryItem(file);
    const clickAttr = ` onclick="handleLibraryItemClick('${file.id}')"`;
    
    html += `
      <div class="file-card"${clickAttr}>
        <div class="file-card-preview">
          ${previewHtml}
          <span class="file-type-badge ${normalizedType}">${typeLabel}</span>
        </div>
        <div class="file-card-info">
          <div class="file-card-top">
            <div class="file-card-name">${escapeHtml(file.name)}</div>
            ${canPlay ? `<button class="file-card-inline-play" onclick="event.stopPropagation(); playLibraryItem('${file.id}')" title="Play in Bottom Player">
              <svg viewBox="0 0 256 256"><path d="M88,64V192a8,8,0,0,0,12.14,6.86l96-64a8,8,0,0,0,0-13.72l-96-64A8,8,0,0,0,88,64Z"/></svg>
            </button>` : ''}
          </div>
          <div class="file-card-meta">${formatFileSize(file.size)} · ${getSectionLabel(file.section || 'local')}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderLibraryList(files, container) {
  let html = '';
  
  files.forEach(file => {
    const effectiveMime = file.mimeType || inferMimeTypeFromName(file.name);
    const normalizedType = normalizeLibraryType(file.type, effectiveMime, file.name);
    const icon = getFileIcon(normalizedType);
    const typeLabel = getFileTypeLabel({ ...file, type: normalizedType, mimeType: effectiveMime });
    const isReadOnly = file.isReadOnly === true || (file.section || '') === 'profile-upload';
    const canDelete = !isReadOnly;
    const canPlay = isPlayableLibraryItem(file);
    const canDownload = !isReadOnly;
    const clickAttr = ` onclick="handleLibraryItemClick('${file.id}')"`;
    
    html += `
      <div class="file-row"${clickAttr}>
        <div class="file-row-icon ${normalizedType}">${icon}</div>
        <div class="file-row-info">
          <div class="file-row-name">${escapeHtml(file.name)}</div>
        </div>
        <div class="file-row-meta">
          <span>${typeLabel}</span>
          <span>${formatFileSize(file.size)}</span>
          <span>${formatDate(file.uploadedAt)}</span>
          <span>${getSectionLabel(file.section || 'local')}</span>
        </div>
        <div class="file-row-actions">
          ${canPlay ? `<button class="file-action-btn" onclick="event.stopPropagation(); playLibraryItem('${file.id}')" title="Play">
            <svg viewBox="0 0 256 256"><path d="M232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-96-56v112l56-56Z"/></svg>
          </button>` : ''}
          ${canDownload ? `<button class="file-action-btn" onclick="event.stopPropagation(); downloadFile(userLibrary.find(f => f.id === '${file.id}'))" title="Download">
            <svg viewBox="0 0 256 256"><path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,132.69V40a8,8,0,0,0-16,0v92.69L93.66,106.34a8,8,0,0,0-11.32,11.32Z"/></svg>
          </button>` : ''}
          ${canDelete ? `<button class="file-action-btn" onclick="event.stopPropagation(); deleteFile('${file.id}')" title="Delete">
            <svg viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>
          </button>` : ''}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Make functions global
window.openFilePreview = openFilePreview;
window.handleLibraryItemClick = handleLibraryItemClick;
window.playLibraryItem = playLibraryItem;
window.deleteFile = deleteFile;
window.downloadFile = downloadFile;

function showLibraryView() {
  // Hide other views
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');
  
  // Show library view
  const libraryView = document.getElementById('libraryView');
  if (libraryView) {
    libraryView.classList.add('active');
  }
  
  // Update header
  const header = document.getElementById('contentHeader');
  const contentTitle = document.getElementById('contentTitle');
  if (contentTitle) {
    contentTitle.textContent = 'Library';
  }
  if (header) {
    const icon = header.querySelector('svg');
    if (icon) {
      icon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Zm0,128H40V56H92.69l29.65,29.66A8,8,0,0,0,128,88h88Z"/></svg>`;
    }
  }
  
  // Update nav
  document.querySelectorAll('.home-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navLibrary')?.classList.add('active');

  const profileUploadsToggle = document.getElementById('libraryProfileUploadsToggle');
  if (profileUploadsToggle) {
    profileUploadsToggle.checked = includeProfileUploadsInLibrary;
  }
  
  renderLibrary();
}

function showProfileView() {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');

  document.getElementById('profileSimpleView')?.classList.add('active');

  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === 'profile');
  });

  const contentTitle = document.getElementById('contentTitle');
  if (contentTitle) {
    contentTitle.textContent = 'Profile';
  }

  const header = document.getElementById('contentHeader');
  if (header) {
    const icon = header.querySelector('svg');
    if (icon) {
      icon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>`;
    }
  }

  renderSimpleProfileView();
  if (!profileBaseline || getProfileUploads().length === 0) {
    hydrateProfileFromApi({ silent: true }).then(() => {
      refreshSimpleProfileSections(currentUser?.uid || '').catch(() => {});
      setSimpleProfileStatus('', 'info');
    }).catch(() => {
      setSimpleProfileStatus('Profile load failed.', 'error');
    });
  } else {
    refreshSimpleProfileSections(currentUser?.uid || '').catch(() => {});
  }
}

function showHomeFeedView() {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');

  document.getElementById('homeFeedView')?.classList.add('active');

  document.querySelectorAll('.home-nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === 'feed');
  });

  const contentTitle = document.getElementById('contentTitle');
  if (contentTitle) {
    contentTitle.textContent = 'Home Feed';
  }

  const header = document.getElementById('contentHeader');
  if (header) {
    const icon = header.querySelector('svg');
    if (icon) {
      icon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M224,120v96a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V120a16,16,0,0,1,5.17-11.78l80-75.48a16,16,0,0,1,21.66,0l80,75.48A16,16,0,0,1,224,120Zm-16,0L128,44.52,48,120v96H96V160a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v56h48Z"/></svg>`;
    }
  }

  if (!homeFeedItemsCache.length) {
    refreshHomeFeedView({ force: false }).catch(() => {
      setHomeFeedStatus('Failed to load feed. Please try again.', 'error');
    });
  } else {
    refreshHomeFeedActionStates();
    renderHomeFeed();
  }
}

function showDiscoverView() {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');

  document.getElementById('discoverView')?.classList.add('active');

  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === 'discover');
  });

  const contentTitle = document.getElementById('contentTitle');
  if (contentTitle) {
    contentTitle.textContent = 'Discover';
  }

  const header = document.getElementById('contentHeader');
  if (header) {
    const icon = header.querySelector('svg');
    if (icon) {
      icon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm53.66-98.34-40,40a8,8,0,0,1-11.32,0l-40-40a8,8,0,0,1,11.32-11.32L128,132.69l26.34-26.35a8,8,0,0,1,11.32,11.32Z"/></svg>`;
    }
  }

  if (!discoverDataLoading && !simpleProfileDiscoverCache.length) {
    loadAndRenderDiscoverUsers();
  }
}

function showMarketplaceView() {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');

  document.getElementById('marketplaceView')?.classList.add('active');

  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === 'marketplace');
  });

  const contentTitle = document.getElementById('contentTitle');
  if (contentTitle) {
    contentTitle.textContent = 'Marketplace';
  }

  const header = document.getElementById('contentHeader');
  if (header) {
    const icon = header.querySelector('svg');
    if (icon) {
      icon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M223.68,66.15,208,32.41a16,16,0,0,0-13.12-8.41H61.12A16,16,0,0,0,48,32.41L32.32,66.15A16.13,16.13,0,0,0,32,72v32a40,40,0,0,0,8,24v64a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V128a40,40,0,0,0,8-24V72A16.13,16.13,0,0,0,223.68,66.15ZM61.12,40H194.88l11.08,20H52.64ZM88,160H72a8,8,0,0,1,0-16H88a8,8,0,0,1,0,16Zm96,0H168a8,8,0,0,1,0-16h16a8,8,0,0,1,0,16Z"/></svg>`;
    }
  }

  if (!marketplaceDataLoading && !simpleProfileMarketplaceCache.length) {
    loadAndRenderMarketplaceItems(marketplaceFilterType);
  } else {
    setupMarketplaceGenreOptions(simpleProfileMarketplaceCache);
    filterContent(marketplaceFilterType);
  }

  console.log('[Marketplace] View initialized');
}

function renderSessionBar() {
  const sessionBar = document.getElementById('sessionBar');
  const addBtn = document.getElementById('btnAddSession');
  const insertAnchor = addBtn?.previousElementSibling || null;
  
  // Remove existing session icons (keep home and dividers)
  document.querySelectorAll('.session-icon').forEach(el => el.remove());
  
  // Add session icons
  sessions.forEach(session => {
    const icon = document.createElement('div');
    icon.className = 'session-icon';
    icon.dataset.session = session.id;
    icon.title = session.name;
    icon.tabIndex = 0;
    icon.setAttribute('role', 'button');
    icon.setAttribute('aria-label', session.name);
    icon.innerHTML = `<span>${session.icon}</span>`;
    icon.addEventListener('click', () => selectSession(session.id));
    icon.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showSessionContextMenu(session.id, event.clientX || 16, event.clientY || 16);
    });
    icon.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showSessionContextMenu(session.id, e.clientX, e.clientY);
    });
    icon.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectSession(session.id);
      }

      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const rect = icon.getBoundingClientRect();
        showSessionContextMenu(session.id, rect.left + 12, rect.bottom + 6);
      }
    });
    
    sessionBar.insertBefore(icon, insertAnchor);
  });

  if (currentSession) {
    document.querySelectorAll('.session-icon').forEach(icon => {
      icon.classList.toggle('active', icon.dataset.session === currentSession.id);
    });
  }
}

function canDeleteSession(session) {
  if (!session) return false;

  const ownerUid = String(session.ownerUid || '').trim();
  const currentUid = String(currentUser?.uid || '').trim();

  if (!ownerUid) return true;
  if (!currentUid) return false;
  return ownerUid === currentUid;
}

function showSessionContextMenu(sessionId, x, y) {
  // Remove existing context menu if any
  const existingMenu = document.querySelector('.session-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;
  const allowDelete = canDeleteSession(session);
  
  const menu = document.createElement('div');
  menu.className = 'session-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.innerHTML = `
    <div class="session-context-menu-item" data-action="invite">
      <svg viewBox="0 0 256 256"><path d="M256,128a8,8,0,0,1-8,8H136v112a8,8,0,0,1-16,0V136H8a8,8,0,0,1,0-16H120V8a8,8,0,0,1,16,0V120H248A8,8,0,0,1,256,128Z"/></svg>
      <span>Invite People</span>
    </div>
    ${allowDelete ? `
    <div class="session-context-menu-item" data-action="rename">
      <svg viewBox="0 0 256 256"><path d="M227.32,73.37,182.63,28.69a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31l0,0L227.32,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120Z"/></svg>
      <span>Rename Session</span>
    </div>
    ` : ''}
    <div class="session-context-menu-item" data-action="leave">
      <svg viewBox="0 0 256 256"><path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/></svg>
      <span>Leave Session</span>
    </div>
    ${allowDelete ? `
      <div class="session-context-menu-divider"></div>
      <div class="session-context-menu-item text-danger" data-action="delete">
        <svg viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>
        <span>Delete Session</span>
      </div>
    ` : ''}
  `;
  
  document.body.appendChild(menu);
  
  // Position menu on screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  }
  
  // Add action handlers
  menu.querySelector('[data-action="invite"]')?.addEventListener('click', () => {
    menu.remove();
    openSessionInviteModal();
  });

  menu.querySelector('[data-action="rename"]')?.addEventListener('click', () => {
    menu.remove();
    renameSession(sessionId);
  });

  menu.querySelector('[data-action="leave"]')?.addEventListener('click', () => {
    menu.remove();
    leaveSession(sessionId);
  });
  
  if (allowDelete) {
    menu.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      menu.remove();
      deleteSession(sessionId);
    });
  }
  
  // Close on outside click
  setTimeout(() => {
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 0);
  
  // Close on ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

async function deleteSession(sessionId) {
  console.log('[Coverse] deleteSession called with sessionId:', sessionId);
  const session = sessions.find(s => s.id === sessionId);
  if (!session) { console.warn('[Coverse] deleteSession: session not found'); return; }

  console.log('[Coverse] deleteSession: session found:', session.name, 'ownerUid:', session.ownerUid, 'currentUser:', currentUser?.uid);
  if (!canDeleteSession(session)) {
    const leaveInstead = confirm(`You can only delete sessions you own.\n\nLeave "${session.name}" instead?`);
    if (!leaveInstead) return;
    await leaveSession(sessionId, { skipConfirm: true });
    return;
  }
  
  const confirmed = confirm(`Delete "${session.name}"?\n\nThis will permanently delete the session and all its data.`);
  if (!confirmed) return;
  
  // Delete from Firebase if user is logged in
  if (currentUser && window.firebaseDb) {
    try {
      const db = window.firebaseDb;
      const sessionRef = window.firebaseDoc(db, 'sessions', sessionId);
      await window.firebaseDeleteDoc(sessionRef);
    } catch (error) {
      console.error('[Coverse] Failed to delete session from cloud:', error);

      const message = String(error?.message || '').toLowerCase();
      const permissionDenied = /missing or insufficient permissions|permission[-_ ]denied/.test(message);
      if (permissionDenied) {
        await leaveSession(sessionId, { skipConfirm: true });
        showNotification('You are not allowed to delete this session, so we left it instead.', { level: 'warning' });
        return;
      }
    }
  }
  
  // Remove from local array
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions.splice(index, 1);
  }
  
  // Save to storage
  saveSessionsToStorage();
  
  // If we were viewing this session, go back to home
  if (currentSession && currentSession.id === sessionId) {
    currentSession = null;
    showHomeView();
  }
  
  // Re-render session bar
  renderSessionBar();
  
  showNotification(`Deleted "${session.name}"`, { level: 'info' });
}

async function renameSession(sessionId) {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  const newName = prompt('Rename session:', session.name);
  if (!newName || !newName.trim() || newName.trim() === session.name) return;

  const cleanName = newName.trim();
  const oldName = session.name;
  session.name = cleanName;
  session.icon = cleanName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  // Persist to Firebase
  if (currentUser && window.firebaseDb && window.firebaseUpdateDoc && window.firebaseDoc) {
    try {
      await window.firebaseUpdateDoc(window.firebaseDoc(window.firebaseDb, 'sessions', sessionId), {
        name: cleanName,
        icon: session.icon,
        updatedAt: new Date()
      });
    } catch (error) {
      console.warn('[Coverse] Failed to rename session:', error);
      session.name = oldName;
      showNotification('Could not rename session.', { level: 'error' });
      return;
    }
  }

  saveSessionsToStorage();
  renderSessionBar();

  // Update header if currently viewing this session
  if (currentSession?.id === sessionId) {
    const sessionHeader = document.getElementById('sessionNameHeader');
    if (sessionHeader) sessionHeader.textContent = cleanName;
  }

  showNotification(`Renamed to "${cleanName}"`, { level: 'success' });
}

async function leaveSession(sessionId, options = {}) {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  const skipConfirm = options.skipConfirm === true;
  
  if (!skipConfirm) {
    const confirmed = confirm(`Leave "${session.name}"?\n\nYou can rejoin later with the invite code.`);
    if (!confirmed) return;
  }
  
  // Remove from Firebase memberIds if user is logged in
  if (currentUser && window.firebaseDb) {
    try {
      const db = window.firebaseDb;
      const sessionRef = window.firebaseDoc(db, 'sessions', sessionId);
      const sessionSnap = await window.firebaseGetDoc(sessionRef);
      if (sessionSnap.exists()) {
        const data = sessionSnap.data();
        const memberIds = (data.memberIds || []).filter(uid => uid !== currentUser.uid);
        await window.firebaseUpdateDoc(sessionRef, { memberIds });
      }
    } catch (error) {
      console.error('[Coverse] Failed to leave session in cloud:', error);
    }
  }
  
  // Remove from local array
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions.splice(index, 1);
  }
  
  // Save to storage
  saveSessionsToStorage();
  
  // If we were viewing this session, go back to home
  if (currentSession && currentSession.id === sessionId) {
    currentSession = null;
    showHomeView();
  }
  
  // Re-render session bar
  renderSessionBar();
  
  showNotification(`Left "${session.name}"`, { level: 'info' });
}

function openSettingsMenu() {
  // Create a simple dropdown menu
  const existingMenu = document.querySelector('.settings-dropdown');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }
  
  const menu = document.createElement('div');
  menu.className = 'settings-dropdown';
  menu.innerHTML = `
    <div class="settings-dropdown-item" id="menuProfile">
      <svg viewBox="0 0 256 256"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>
      <span>My Profile</span>
    </div>
    <div class="settings-dropdown-item" id="menuLibrary">
      <svg viewBox="0 0 256 256"><path d="M83.19,174.4a8,8,0,0,0,11.21-1.6,52,52,0,0,1,67.2,0,8,8,0,1,0,9.6-12.8,68,68,0,0,0-86.4,0A8,8,0,0,0,83.19,174.4ZM128,72a88,88,0,0,0-88,88,8,8,0,0,0,16,0,72,72,0,0,1,144,0,8,8,0,0,0,16,0A88,88,0,0,0,128,72Zm0,32a56,56,0,0,0-56,56,8,8,0,0,0,16,0,40,40,0,0,1,80,0,8,8,0,0,0,16,0A56,56,0,0,0,128,104Z"/></svg>
      <span>My Library</span>
    </div>
    <div class="settings-dropdown-item" id="menuFriends">
      <svg viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>
      <span>Friends</span>
    </div>
    <div class="settings-dropdown-divider"></div>
    <div class="settings-dropdown-item" id="menuSettings">
      <svg viewBox="0 0 256 256"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/></svg>
      <span>Settings</span>
    </div>
    <div class="settings-dropdown-item" id="menuCheckUpdates">
      <svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,16a88,88,0,0,1,85.59,68H196.94a8,8,0,0,0,0,16h16.65A88,88,0,0,1,40.41,124H57.06a8,8,0,0,0,0-16H40.41A88,88,0,0,1,128,40Zm0,176a88,88,0,0,1-85.59-68H59.06a8,8,0,0,0,0-16H42.41A88,88,0,0,1,215.59,132H198.94a8,8,0,0,0,0,16h16.65A88,88,0,0,1,128,216Zm40-92a8,8,0,0,1-8,8H136v24a8,8,0,0,1-16,0V124a8,8,0,0,1,8-8h32A8,8,0,0,1,168,124Z"/></svg>
      <span>Check for Updates</span>
    </div>
    <div class="settings-dropdown-item text-danger" id="menuLogout">
      <svg viewBox="0 0 256 256"><path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/></svg>
      <span>Log Out</span>
    </div>
  `;
  
  document.getElementById('userPanel').appendChild(menu);
  
  // Add click handlers
  menu.querySelector('#menuLogout')?.addEventListener('click', logout);
  menu.querySelector('#menuProfile')?.addEventListener('click', openUserProfile);
  menu.querySelector('#menuSettings')?.addEventListener('click', () => {
    menu.remove();
    // TODO: Open settings modal
  });
  menu.querySelector('#menuCheckUpdates')?.addEventListener('click', async () => {
    menu.remove();
    try {
      await window.coverse?.checkForUpdates?.();
    } catch (_error) {
      // no-op
    }
  });
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 0);
}

function openUserProfile() {
  openUserProfileModal().catch((error) => {
    console.error('[Coverse] Failed to open profile modal:', error);
  });
}

async function logout() {
  console.log('[Coverse] Logging out...');

  stopInviteNotificationSync();
  stopFollowNotificationSync();
  
  try {
    if (window.firebaseAuth && window.firebaseSignOut) {
      await window.firebaseSignOut(window.firebaseAuth);
    }
    window.location.href = 'login.html';
  } catch (error) {
    console.error('[Coverse] Logout error:', error);
    // Force redirect anyway
    window.location.href = 'login.html';
  }
}

// ============================================
// SESSION BAR (Server list)
// ============================================
function initSessionBar() {
  // Home button
  document.getElementById('btnHome')?.addEventListener('click', () => {
    showHomeView();
  });
  
  // Session icons
  document.querySelectorAll('.session-icon').forEach(icon => {
    icon.addEventListener('click', () => {
      selectSession(icon.dataset.session);
    });
  });
  
  // Add session button
  document.getElementById('btnAddSession')?.addEventListener('click', () => {
    openModal('createSessionModal');
  });
}

function selectSession(sessionId) {
  currentSession = sessions.find(s => s.id === sessionId);
  if (!currentSession) return;
  lastSessionId = currentSession.id;
  saveLastSessionSelection(currentSession.id);
  
  // Update UI
  document.querySelectorAll('.session-icon').forEach(icon => {
    icon.classList.toggle('active', icon.dataset.session === sessionId);
  });
  document.getElementById('btnHome')?.classList.remove('active');
  
  // Update session header
  document.getElementById('currentSessionName').textContent = currentSession.name;
  document.getElementById('btnCopySessionInvite')?.classList.remove('hidden');
  document.getElementById('btnSessionMenu')?.classList.remove('hidden');
  updatePendingFriendsBadge();
  
  // Show channel list, hide home sidebar
  document.getElementById('homeSidebar')?.classList.add('hidden');
  document.getElementById('channelList')?.classList.remove('hidden');
  renderSessionChannels();
  
  // Hide friends/DM views, show voice preview
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');
  
  // Select the session's default live room
  selectChannel(getDefaultVoiceChannelId(currentSession), 'voice');
}

function showHomeView() {
  currentSession = null;

  if (!inVoiceCall) {
    clearVoicePreviewRealtimeSubscription({ resetParticipants: true, preserveContext: false });
  }
  
  document.querySelectorAll('.session-icon').forEach(icon => {
    icon.classList.remove('active');
  });
  document.getElementById('btnHome')?.classList.add('active');
  
  document.getElementById('currentSessionName').textContent = 'Coverse';
  document.getElementById('btnCopySessionInvite')?.classList.add('hidden');
  document.getElementById('btnSessionMenu')?.classList.add('hidden');
  
  // Show home sidebar (Friends/DMs), hide channel list
  document.getElementById('homeSidebar')?.classList.remove('hidden');
  document.getElementById('channelList')?.classList.add('hidden');
  updatePendingFriendsBadge();
  
  // Show friends view by default
  showFriendsView();
}

function showFriendsView() {
  // Hide other views
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');
  
  // Show friends view
  document.getElementById('friendsView')?.classList.add('active');
  
  // Update nav items
  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === 'friends');
  });
  
  // Update header
  const contentTitle = document.getElementById('contentTitle');
  if (contentTitle) {
    contentTitle.textContent = 'Friends';
  }
  const header = document.getElementById('contentHeader');
  if (header) {
    const icon = header.querySelector('svg');
    if (icon) {
      icon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>`;
    }
  }
}

function showDMView() {
  // Hide other views
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('homeFeedView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  document.getElementById('discoverView')?.classList.remove('active');
  document.getElementById('marketplaceView')?.classList.remove('active');
  
  // Show DM view
  document.getElementById('dmView')?.classList.add('active');
  
  // Update nav items (none selected when in DM)
  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.classList.remove('active');
  });
}

function channelNameToId(value, fallback = 'channel') {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

function formatChannelLabel(value, fallback = 'Channel') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const hasIntentionalCase = /[A-Z]/.test(raw);
  if (hasIntentionalCase) return raw;

  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSessionChannelList(entries, fallbackChannels) {
  const sourceList = Array.isArray(entries) && entries.length ? entries : fallbackChannels;
  const seenIds = new Set();
  const unique = [];

  sourceList.forEach((entry) => {
    const cleanEntry = String(entry || '').trim();
    if (!cleanEntry) return;
    const entryId = channelNameToId(cleanEntry, 'channel');
    if (seenIds.has(entryId)) return;
    seenIds.add(entryId);
    unique.push(cleanEntry);
  });

  if (unique.length) return unique;
  return fallbackChannels.slice();
}

function getSessionTextChannels(session = currentSession) {
  const normalized = normalizeSessionChannelList(session?.textChannels, DEFAULT_TEXT_CHANNELS);
  if (session) {
    session.textChannels = normalized.slice();
  }
  return normalized;
}

function getSessionVoiceChannels(session = currentSession) {
  const normalized = normalizeSessionChannelList(session?.voiceChannels, DEFAULT_VOICE_CHANNELS);
  if (session) {
    session.voiceChannels = normalized.slice();
  }
  return normalized;
}

function getChannelDisplayName(channelId, channelType, session = currentSession) {
  const normalizedId = channelNameToId(channelId, 'channel');
  if (channelType === 'info' && normalizedId === SESSION_BOARD_CHANNEL_ID) {
    return SESSION_BOARD_LABEL;
  }

  if (channelType === 'voice') {
    const voiceName = getSessionVoiceChannels(session).find((entry) => channelNameToId(entry) === normalizedId);
    return formatChannelLabel(voiceName || channelId, 'Live Room');
  }

  const textName = getSessionTextChannels(session).find((entry) => channelNameToId(entry) === normalizedId);
  return formatChannelLabel(textName || channelId, 'Conversation');
}

function getDefaultVoiceChannelId(session = currentSession) {
  const voiceChannels = getSessionVoiceChannels(session);
  if (!voiceChannels.length) return 'main';
  return channelNameToId(voiceChannels[0], 'main');
}

function getTextChannelIconSvg() {
  return '<svg viewBox="0 0 256 256"><path d="M216,48H40A16,16,0,0,0,24,64V216a8,8,0,0,0,13.66,5.66L80,179.31H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48Zm0,115.31H76.69a8,8,0,0,0-5.66,2.35L40,196.69V64H216Z"/></svg>';
}

function getVoiceChannelIconSvg() {
  return '<svg viewBox="0 0 256 256"><path d="M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81Z"/></svg>';
}

function getChannelDeleteButtonSvg() {
  return '<svg viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>';
}

function renderSessionChannels() {
  const textContainer = document.getElementById('textChannelsContainer');
  const voiceContainer = document.getElementById('voiceChannelsContainer');
  if (!textContainer || !voiceContainer) return;

  const boardItem = document.querySelector(`.channel-item[data-channel="${SESSION_BOARD_CHANNEL_ID}"][data-type="info"]`);
  if (boardItem) {
    boardItem.classList.toggle('active', currentChannelType !== 'voice' && currentChannel === SESSION_BOARD_CHANNEL_ID);
    const boardNameEl = boardItem.querySelector('.channel-name');
    if (boardNameEl) {
      boardNameEl.textContent = SESSION_BOARD_LABEL;
    }
  }

  const textChannels = getSessionTextChannels(currentSession);
  const voiceChannels = getSessionVoiceChannels(currentSession);

  textContainer.innerHTML = textChannels.map((name) => {
    const channelId = channelNameToId(name, 'conversation');
    const isActive = currentChannelType !== 'voice' && currentChannel === channelId;
    const channelLabel = formatChannelLabel(name, 'Conversation');
    return `
      <div class="channel-item${isActive ? ' active' : ''}" data-channel="${escapeHtml(channelId)}" data-type="text">
        ${getTextChannelIconSvg()}
        <span class="channel-name">${escapeHtml(channelLabel)}</span>
        <button class="channel-delete-btn" data-action="delete-channel" data-channel="${escapeHtml(channelId)}" data-type="text" type="button" title="Delete conversation" aria-label="Delete ${escapeHtml(channelLabel)}">
          ${getChannelDeleteButtonSvg()}
        </button>
      </div>
    `;
  }).join('');

  voiceContainer.innerHTML = voiceChannels.map((name, index) => {
    const channelId = channelNameToId(name, `room-${index + 1}`);
    const isActive = currentChannelType === 'voice' && currentChannel === channelId;
    const timerMarkup = index === 0 ? '<span class="voice-timer" id="voiceTimer"></span>' : '';
    const channelLabel = formatChannelLabel(name, 'Live Room');

    return `
      <div class="channel-item${isActive ? ' active' : ''}" data-channel="${escapeHtml(channelId)}" data-type="voice">
        ${getVoiceChannelIconSvg()}
        <span class="channel-name">${escapeHtml(channelLabel)}</span>
        ${timerMarkup}
        <button class="channel-delete-btn" data-action="delete-channel" data-channel="${escapeHtml(channelId)}" data-type="voice" type="button" title="Delete live room" aria-label="Delete ${escapeHtml(channelLabel)}">
          ${getChannelDeleteButtonSvg()}
        </button>
      </div>
    `;
  }).join('');
}

async function persistSessionChannels(session) {
  if (!session?.id || !window.firebaseDb || !window.firebaseSetDoc) return;

  try {
    await window.firebaseSetDoc(
      window.firebaseDoc(window.firebaseDb, 'sessions', session.id),
      {
        textChannels: getSessionTextChannels(session),
        voiceChannels: getSessionVoiceChannels(session),
        updatedAt: new Date()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Coverse] Could not persist new channel list to cloud:', error);
    showNotification('Saved channel locally. Cloud sync will retry later.', { level: 'warning' });
  }
}

function promptForChannelName(promptLabel, defaultName) {
  const fallbackName = String(defaultName || '').trim() || 'Channel';

  try {
    if (typeof window.prompt === 'function') {
      return window.prompt(`Name your new ${promptLabel}:`, fallbackName);
    }
  } catch (error) {
    console.warn('[Coverse] Native prompt unavailable for channel naming, using fallback name:', error);
  }

  return fallbackName;
}

async function createSessionChannel(channelType = 'text') {
  try {
    if (!currentSession) {
      showNotification('Open a session first to add channels.', { level: 'warning' });
      return;
    }

    const normalizedType = channelType === 'voice' ? 'voice' : 'text';
    const isVoice = normalizedType === 'voice';
    const existingChannels = isVoice
      ? getSessionVoiceChannels(currentSession)
      : getSessionTextChannels(currentSession);

    const defaultName = isVoice
      ? `Room ${existingChannels.length + 1}`
      : `Conversation ${existingChannels.length + 1}`;
    const promptLabel = isVoice ? 'live room' : 'conversation';
    const rawName = promptForChannelName(promptLabel, defaultName);
    if (rawName === null) return;

    const cleanName = String(rawName || '').trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      showNotification('Channel name cannot be empty.', { level: 'warning' });
      return;
    }

    const nextId = channelNameToId(cleanName, isVoice ? 'room' : 'conversation');
    const alreadyExists = existingChannels.some((entry) => channelNameToId(entry) === nextId);
    if (alreadyExists) {
      showNotification('A channel with that name already exists.', { level: 'warning' });
      return;
    }

    if (isVoice) {
      currentSession.voiceChannels = [...existingChannels, cleanName];
    } else {
      currentSession.textChannels = [...existingChannels, cleanName];
    }

    saveSessionsToStorage();
    await persistSessionChannels(currentSession);
    renderSessionChannels();
    selectChannel(nextId, normalizedType);
    showNotification(`${formatChannelLabel(cleanName)} added.`, { level: 'success' });
  } catch (error) {
    console.warn('[Coverse] Failed to create channel:', error);
    showNotification('Could not create channel. Please try again.', { level: 'error' });
  }
}

async function deleteSessionChannel(channelId, channelType = 'text') {
  console.log('[Coverse] deleteSessionChannel called with:', channelId, channelType);
  try {
    if (!currentSession) {
      console.warn('[Coverse] deleteSessionChannel: no currentSession');
      showNotification('Open a session first to delete channels.', { level: 'warning' });
      return;
    }

    console.log('[Coverse] deleteSessionChannel: currentSession:', currentSession.name);
    const normalizedType = channelType === 'voice' ? 'voice' : 'text';
    const isVoice = normalizedType === 'voice';
    const existingChannels = isVoice
      ? getSessionVoiceChannels(currentSession)
      : getSessionTextChannels(currentSession);

    if (existingChannels.length <= 1) {
      showNotification(`A session needs at least one ${isVoice ? 'live room' : 'conversation'}.`, { level: 'warning' });
      return;
    }

    const normalizedId = channelNameToId(channelId, isVoice ? 'room' : 'conversation');
    const channelName = existingChannels.find((entry) => channelNameToId(entry) === normalizedId);
    if (!channelName) return;

    const displayName = formatChannelLabel(channelName, isVoice ? 'Live Room' : 'Conversation');
    const confirmed = confirm(`Delete "${displayName}"?\n\nThis will remove this ${isVoice ? 'live room' : 'conversation'} from the session.`);
    if (!confirmed) return;

    const remainingChannels = existingChannels.filter((entry) => channelNameToId(entry) !== normalizedId);
    if (!remainingChannels.length) {
      showNotification(`A session needs at least one ${isVoice ? 'live room' : 'conversation'}.`, { level: 'warning' });
      return;
    }

    if (isVoice) {
      currentSession.voiceChannels = remainingChannels;
    } else {
      currentSession.textChannels = remainingChannels;
    }

    saveSessionsToStorage();
    await persistSessionChannels(currentSession);
    renderSessionChannels();

    const wasSelected = currentChannelType === normalizedType && currentChannel === normalizedId;
    if (wasSelected) {
      const fallbackChannelId = channelNameToId(remainingChannels[0], isVoice ? 'room' : 'conversation');
      selectChannel(fallbackChannelId, normalizedType);
    }

    showNotification(`${displayName} deleted.`, { level: 'info' });
  } catch (error) {
    console.warn('[Coverse] Failed to delete channel:', error);
    showNotification('Could not delete channel. Please try again.', { level: 'error' });
  }
}

function showChannelContextMenu(channelId, channelType, x, y) {
  // Remove any existing context menus
  document.querySelector('.session-context-menu')?.remove();

  const normalizedType = channelType === 'voice' ? 'voice' : 'text';
  const isVoice = normalizedType === 'voice';
  const displayName = formatChannelLabel(channelId, isVoice ? 'Live Room' : 'Conversation');

  const menu = document.createElement('div');
  menu.className = 'session-context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.innerHTML = `
    <div class="session-context-menu-item text-danger" data-action="delete-channel">
      <svg viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>
      <span>Delete ${displayName}</span>
    </div>
  `;

  document.body.appendChild(menu);

  // Keep menu on screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  }

  menu.querySelector('[data-action="delete-channel"]')?.addEventListener('click', () => {
    menu.remove();
    deleteSessionChannel(channelId, normalizedType);
  });

  // Close on outside click
  setTimeout(() => {
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 0);

  // Close on ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ============================================
// CHANNEL BAR
// ============================================
function initChannelBar() {
  // Channel categories (collapse/expand)
  document.querySelectorAll('.channel-category').forEach(cat => {
    cat.addEventListener('click', (event) => {
      if (event.target.closest('.category-add-btn')) {
        return;
      }
      cat.classList.toggle('collapsed');
    });
  });

  // Channel items (delegated so dynamically added channels work too)
  const channelListEl = document.getElementById('channelList');
  channelListEl?.addEventListener('click', (event) => {
    const deleteButton = event.target?.closest?.('.channel-delete-btn');
    if (deleteButton) {
      console.log('[Coverse] Channel delete button clicked:', deleteButton.dataset.channel, deleteButton.dataset.type);
      event.preventDefault();
      event.stopPropagation();
      deleteSessionChannel(deleteButton.dataset.channel, deleteButton.dataset.type);
      return;
    }

    const item = event.target?.closest?.('.channel-item');
    if (!item) return;
    if (!item.dataset.channel || !item.dataset.type) return;
    selectChannel(item.dataset.channel, item.dataset.type);
  });

  // Right-click context menu on channels for delete
  channelListEl?.addEventListener('contextmenu', (event) => {
    const item = event.target?.closest?.('.channel-item');
    if (!item) return;
    const channelId = item.dataset.channel;
    const channelType = item.dataset.type;
    if (!channelId || !channelType) return;
    if (channelType === 'info') return; // don't allow deleting Session Board

    event.preventDefault();
    showChannelContextMenu(channelId, channelType, event.clientX, event.clientY);
  });

  // Category add buttons
  document.querySelectorAll('.category-add-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const channelType = String(button.dataset.channelType || '').trim().toLowerCase();
      createSessionChannel(channelType);
    });
  });
  
  // User panel buttons
  document.getElementById('btnPanelMic')?.addEventListener('click', toggleMic);
  document.getElementById('btnPanelDeafen')?.addEventListener('click', toggleDeafen);
  document.getElementById('btnPanelSettings')?.addEventListener('click', openSettings);
  document.getElementById('btnCopySessionInvite')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await openSessionInviteModal();
  });

  document.getElementById('btnSessionMenu')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!currentSession) return;

    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    showSessionContextMenu(currentSession.id, rect.left, rect.bottom + 6);
  });

  document.getElementById('btnNotifications')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleNotificationCenter();
  });

  document.getElementById('btnClearNotifications')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    notificationHistory = [];
    renderNotificationCenter();
  });

  document.getElementById('btnCloseNotifications')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeNotificationCenter({ focusTrigger: true });
  });

  document.getElementById('notificationCenter')?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('click', () => {
    closeNotificationCenter();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNotificationCenter();
    }
  });

  document.getElementById('btnShowMembers')?.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeNotificationCenter();

    if (currentSession) {
      toggleMembersPanel();
      return;
    }

    currentFriendsTab = pendingFriendRequests.length > 0 ? 'pending' : 'all';
    document.querySelectorAll('.friends-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === currentFriendsTab);
    });

    showFriendsView();
    renderFriendsList();
    setTimeout(() => {
      document.getElementById('searchFriends')?.focus();
    }, 100);
  });

  document.getElementById('btnCloseMembersPanel')?.addEventListener('click', () => {
    closeMembersPanel();
  });
  
  // Home navigation items
  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view === 'feed') {
        showHomeFeedView();
      } else if (view === 'friends') {
        showFriendsView();
      } else if (view === 'profile') {
        showProfileView();
      } else if (view === 'library') {
        showLibraryView();
      } else if (view === 'discover') {
        showDiscoverView();
      } else if (view === 'marketplace') {
        showMarketplaceView();
      }
    });
  });
  
  // Friends tabs
  document.querySelectorAll('.friends-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFriendsTab = tab.dataset.tab;
      document.querySelectorAll('.friends-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === currentFriendsTab);
      });
      renderFriendsList();
    });
  });
  document.querySelectorAll('.friends-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === currentFriendsTab);
  });
  
  // Add friend button
  document.getElementById('btnAddFriend')?.addEventListener('click', () => {
    openAddFriendModal('friend');
  });
  
  // DM send button and input
  document.getElementById('btnDMSend')?.addEventListener('click', sendDMMessage);
  document.getElementById('dmInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendDMMessage();
    }
  });

  document.getElementById('btnDMInvite')?.addEventListener('click', () => {
    inviteCurrentDmUserToSession().catch((error) => {
      console.error('[Coverse] Failed to send DM invite:', error);
      showNotification('Could not send session invite from this DM.');
    });
  });
  
  // New DM button
  document.getElementById('btnNewDM')?.addEventListener('click', () => {
    openAddFriendModal('dm');
  });

  renderNotificationCenter();
  updateNotificationUnreadBadge();
  updatePendingFriendsBadge();
  renderSessionChannels();
}

function selectChannel(channelId, channelType) {
  const normalizedChannelId = channelNameToId(channelId, 'channel');
  currentChannel = normalizedChannelId;
  currentChannelType = channelType;
  let channelLabel = '';
  
  // Update active state
  document.querySelectorAll('.channel-item').forEach(item => {
    item.classList.toggle('active', item.dataset.channel === normalizedChannelId);
  });
  
  // Update header
  const header = document.getElementById('contentHeader');
  const title = document.getElementById('contentTitle');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('profileSimpleView')?.classList.remove('active');
  const headerIcon = header?.querySelector('svg');
  
  if (channelType === 'voice') {
    setActiveVoiceContextFromSelection(currentSession?.id || lastSessionId, normalizedChannelId);
    channelLabel = getChannelDisplayName(normalizedChannelId, 'voice', currentSession);

    if (headerIcon) {
      headerIcon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81Z"/></svg>`;
    }
    if (title) {
      title.textContent = channelLabel;
    }
    
    // Show voice preview or call view
    if (inVoiceCall) {
      showCallView();
      ensureVoiceRealtimeSync().catch((error) => {
        console.warn('[Coverse] Voice realtime sync failed on channel switch:', error);
      });
      publishLocalVoiceState().catch(() => {});
      connectVoiceSignaling().catch((error) => {
        console.warn('[Coverse] Voice signaling reconnect failed on channel switch:', error);
      });
    } else {
      showVoicePreview(channelLabel);
      ensureVoicePreviewRealtimeSync().catch((error) => {
        console.warn('[Coverse] Voice preview sync failed on channel switch:', error);
      });
      updateRemoteControlButtonState();
    }
  } else {
    channelLabel = channelType === 'info'
      ? SESSION_BOARD_LABEL
      : getChannelDisplayName(normalizedChannelId, 'text', currentSession);

    if (!inVoiceCall) {
      clearVoicePreviewRealtimeSubscription({ resetParticipants: true, preserveContext: false });
    }

    if (headerIcon) {
      headerIcon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M216,48H40A16,16,0,0,0,24,64V216a8,8,0,0,0,13.66,5.66L80,179.31H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48Zm0,115.31H76.69a8,8,0,0,0-5.66,2.35L40,196.69V64H216Z"/></svg>`;
    }
    if (title) {
      title.textContent = channelLabel;
    }
    
    showChatView(channelLabel);
  }
  
  // Update chat input placeholder
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.placeholder = `Message in ${channelLabel || formatChannelLabel(normalizedChannelId, 'channel')}`;
  }
}

function showVoicePreview(channelId) {
  document.getElementById('voicePreview')?.classList.remove('hidden');
  document.getElementById('callView')?.classList.remove('hidden');
  document.getElementById('chatView')?.classList.remove('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  
  const label = String(channelId || '').trim();
  document.getElementById('voicePreviewTitle').textContent = label || 'Live Room';

  renderVoiceUsersList();
  refreshVoicePreviewStatus();
}

function showCallView() {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('hidden');
  document.getElementById('chatView')?.classList.remove('hidden');
  document.getElementById('callView')?.classList.add('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  document.getElementById('btnStageStopShare')?.classList.toggle('hidden', !isScreenSharing);
  
  renderParticipants();
  updateRemoteControlButtonState();
}

function showChatView(channelLabel) {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('hidden');
  document.getElementById('chatView')?.classList.remove('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.add('active');
  document.getElementById('libraryView')?.classList.remove('active');

  // Update placeholder text
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.placeholder = `Message in ${channelLabel || 'general'}`;
  }

  // Load cached messages immediately, then subscribe for real-time
  const key = getChannelMessagesKey();
  const cached = key ? channelMessagesCache.get(key) : null;
  if (cached) {
    renderChannelMessages(cached);
  } else {
    const container = document.getElementById('chatMessages');
    if (container) container.innerHTML = '<div class="chat-empty">Loading messages...</div>';
  }

  subscribeToChannelMessages();
}

function getVoiceTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLocalVoiceIdentity() {
  const fallbackName = String(currentUser?.displayName || currentUser?.email || 'You').trim() || 'You';
  return {
    uid: String(currentUser?.uid || 'local').trim() || 'local',
    name: fallbackName,
    avatar: getInitials(fallbackName || 'Y')
  };
}

function getActiveVoiceContext() {
  const identity = getLocalVoiceIdentity();
  const sessionId = String(activeVoiceSessionId || currentSession?.id || lastSessionId || '').trim();
  const channelId = String(activeVoiceChannelId || '').trim();

  if (!sessionId || !channelId) {
    return null;
  }

  return {
    key: `${sessionId}::${channelId}::${identity.uid}`,
    sessionId,
    channelId,
    localUid: identity.uid,
    localName: identity.name,
    localAvatar: identity.avatar
  };
}

function setActiveVoiceContextFromSelection(sessionId, channelId) {
  const nextSessionId = String(sessionId || '').trim();
  const nextChannelId = String(channelId || '').trim();

  activeVoiceSessionId = nextSessionId || null;
  activeVoiceChannelId = nextChannelId || null;
}

function getVoiceChannelRefs(context) {
  if (!window.firebaseDb || !context) return null;

  const channelDocRef = window.firebaseDoc(
    window.firebaseDb,
    'sessions',
    context.sessionId,
    'voiceChannels',
    context.channelId
  );

  return {
    channelDocRef,
    participantsRef: window.firebaseCollection(channelDocRef, 'participants'),
    requestsRef: window.firebaseCollection(channelDocRef, 'remoteControlRequests'),
    grantsRef: window.firebaseCollection(channelDocRef, 'remoteControlGrants')
  };
}

async function ensureVoiceSignalingRuntimeConfig() {
  if (voiceSignalingRuntimeConfig) return voiceSignalingRuntimeConfig;

  let config = null;
  try {
    config = await window.coverse?.getConfig?.();
  } catch (_error) {
    config = null;
  }

  const signalingConfig = config?.signaling || {};
  const url = String(signalingConfig.url || DEFAULT_VOICE_SIGNAL_URL).trim() || DEFAULT_VOICE_SIGNAL_URL;
  const token = String(signalingConfig.token || '').trim();
  const iceServers = Array.isArray(signalingConfig.iceServers) && signalingConfig.iceServers.length
    ? signalingConfig.iceServers
    : DEFAULT_VOICE_ICE_SERVERS;

  voiceSignalingRuntimeConfig = { url, token, iceServers };
  return voiceSignalingRuntimeConfig;
}

function getVoiceSignalingRoom(context) {
  if (!context?.sessionId || !context?.channelId) return '';
  return `${context.sessionId}::${context.channelId}`;
}

// ─── Firestore-based WebRTC signaling ───────────────────────────────────────
// Falls back to (or replaces) the WebSocket signaling server so that calls
// work without any separately-deployed backend.  Signal docs are written to
// sessions/{id}/voiceChannels/{ch}/signals/{msgId} and deleted after receipt.

function getVoiceSignalsRef(context) {
  if (!context?.sessionId || !context?.channelId) return null;
  if (!window.firebaseDb || !window.firebaseCollection) return null;
  return window.firebaseCollection(
    window.firebaseDb,
    'sessions', context.sessionId,
    'voiceChannels', context.channelId,
    'signals'
  );
}

async function sendFirestoreVoiceSignal(payload) {
  if (!payload?.type || !payload?.targetUid) return;
  const context = getActiveVoiceContext();
  if (!context) return;
  if (!window.firebaseDb || !window.firebaseAddDoc) return;
  const sigRef = getVoiceSignalsRef(context);
  if (!sigRef) return;
  try {
    await window.firebaseAddDoc(sigRef, {
      from: payload.uid,
      to: payload.targetUid,
      type: payload.type,
      name: payload.name || null,
      sdp: payload.sdp || null,
      candidate: payload.candidate || null,
      ts: new Date()
    });
  } catch (err) {
    console.warn('[Coverse] Firestore signal write failed:', err);
  }
}

function subscribeToVoiceSignals(context) {
  if (!context) return;
  if (!window.firebaseDb || !window.firebaseOnSnapshot || !window.firebaseQuery || !window.firebaseWhere) return;

  unsubscribeVoiceFirestoreSignals();

  const sigRef = getVoiceSignalsRef(context);
  if (!sigRef) return;

  const localUid = getLocalVoiceIdentity().uid;
  const processed = new Set();

  const q = window.firebaseQuery(
    sigRef,
    window.firebaseWhere('to', '==', localUid)
  );

  let isInitialLoad = true;

  voiceSignalsUnsubscribe = window.firebaseOnSnapshot(q, (snapshot) => {
    const changes = snapshot.docChanges();

    if (isInitialLoad) {
      isInitialLoad = false;
      // Purge any stale signals left from a previous session, don't process them
      changes.forEach((change) => {
        if (change.type === 'added') {
          window.firebaseDeleteDoc?.(change.doc.ref).catch(() => {});
        }
      });
      return;
    }

    changes.forEach((change) => {
      if (change.type !== 'added') return;
      const msgId = change.doc.id;
      if (processed.has(msgId)) return;
      processed.add(msgId);

      const data = change.doc.data();
      if (!data) return;

      // Delete after processing so signals don't accumulate
      window.firebaseDeleteDoc?.(change.doc.ref).catch(() => {});

      handleVoiceSignalingMessage({
        type: data.type,
        uid: data.from,
        name: data.name,
        targetUid: data.to,
        sdp: data.sdp,
        candidate: data.candidate
      });
    });
  }, (err) => {
    console.warn('[Coverse] Voice signals subscription error:', err);
  });

  voiceFirestoreSignaling = true;
}

function unsubscribeVoiceFirestoreSignals() {
  voiceFirestoreSignaling = false;
  if (typeof voiceSignalsUnsubscribe === 'function') {
    voiceSignalsUnsubscribe();
    voiceSignalsUnsubscribe = null;
  }
}
// ────────────────────────────────────────────────────────────────────────────

function getLocalAudioTrack() {
  return localStream?.getAudioTracks?.()[0] || null;
}

function getLocalCameraTrack() {
  return localStream?.getVideoTracks?.()[0] || null;
}

function getLocalScreenTrack() {
  return screenStream?.getVideoTracks?.()[0] || null;
}

function normalizeAudioLevel(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function syncParticipantAudioUi(participant) {
  if (!participant) return;

  const participantId = String(participant.id || participant.uid || '').trim();
  if (!participantId) return;

  const level = normalizeAudioLevel(participant.audioLevel);
  const speaking = Boolean(participant.isSpeaking && level > 0.01);
  const meterScale = Math.max(0.04, level).toFixed(3);

  document.querySelectorAll('.participant-tile').forEach((tile) => {
    if (tile.dataset.id !== participantId) return;
    tile.classList.toggle('speaking', speaking);
    const levelFill = tile.querySelector('.participant-audio-level-fill');
    if (levelFill) {
      levelFill.style.transform = `scaleX(${meterScale})`;
    }
  });

  document.querySelectorAll('.voice-user').forEach((voiceUser) => {
    if (voiceUser.dataset.user !== participantId) return;
    voiceUser.classList.toggle('speaking', speaking);
    const levelFill = voiceUser.querySelector('.voice-user-level-fill');
    if (levelFill) {
      levelFill.style.transform = `scaleX(${meterScale})`;
    }
  });
}

function syncAllParticipantAudioUi() {
  participants.forEach((participant) => syncParticipantAudioUi(participant));
}

function stopRemoteAudioMonitor(remoteUid) {
  const uid = String(remoteUid || '').trim();
  if (!uid) return;

  const monitor = remoteAudioMonitors.get(uid);
  if (!monitor) return;

  try {
    monitor.source?.disconnect?.();
  } catch (_error) {
    // no-op
  }

  remoteAudioMonitors.delete(uid);
}

function stopAllRemoteAudioMonitors() {
  Array.from(remoteAudioMonitors.keys()).forEach((uid) => stopRemoteAudioMonitor(uid));

  if (remoteAudioMonitorRaf) {
    cancelAnimationFrame(remoteAudioMonitorRaf);
    remoteAudioMonitorRaf = null;
  }

  if (remoteAudioContext) {
    try {
      remoteAudioContext.close?.();
    } catch (_error) {
      // no-op
    }
    remoteAudioContext = null;
  }
}

function ensureRemoteAudioMonitorLoop() {
  if (remoteAudioMonitorRaf) return;

  const tick = () => {
    if (!remoteAudioMonitors.size) {
      remoteAudioMonitorRaf = null;
      return;
    }

    const now = performance.now();
    remoteAudioMonitors.forEach((monitor, remoteUid) => {
      if (!monitor?.analyser || !monitor?.data) return;

      monitor.analyser.getByteTimeDomainData(monitor.data);
      let sum = 0;
      for (let i = 0; i < monitor.data.length; i += 1) {
        const centered = (monitor.data[i] - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / monitor.data.length);
      const instantLevel = normalizeAudioLevel((rms - 0.008) * 28);
      monitor.level = Math.max(instantLevel, monitor.level * 0.84);

      if (monitor.level > REMOTE_SPEAKING_THRESHOLD) {
        monitor.holdUntil = now + 220;
      }

      const speaking = now < monitor.holdUntil;
      const participant = participants.find((entry) => !entry.isLocal && String(entry.uid || entry.id || '') === remoteUid);
      if (!participant) return;

      participant.audioLevel = monitor.level;
      participant.isSpeaking = speaking;
      syncParticipantAudioUi(participant);
    });

    remoteAudioMonitorRaf = requestAnimationFrame(tick);
  };

  remoteAudioMonitorRaf = requestAnimationFrame(tick);
}

function ensureRemoteAudioMonitor(remoteUid, stream) {
  const uid = String(remoteUid || '').trim();
  if (!uid || !stream?.getAudioTracks?.().length) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!remoteAudioContext || remoteAudioContext.state === 'closed') {
    remoteAudioContext = new AudioContextClass();
  }

  if (remoteAudioContext.state === 'suspended') {
    remoteAudioContext.resume?.().catch(() => {});
  }

  const streamId = String(stream.id || '').trim();
  const existing = remoteAudioMonitors.get(uid);
  if (existing && existing.streamId === streamId) return;

  if (existing) {
    stopRemoteAudioMonitor(uid);
  }

  try {
    const analyser = remoteAudioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    const data = new Uint8Array(analyser.fftSize);
    const source = remoteAudioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    remoteAudioMonitors.set(uid, {
      uid,
      streamId,
      source,
      analyser,
      data,
      level: 0,
      holdUntil: 0
    });

    ensureRemoteAudioMonitorLoop();
  } catch (error) {
    console.warn('[Coverse] Failed to monitor remote audio level:', error);
  }
}

function ensureRemoteAudioElement(remoteUid, stream) {
  const uid = String(remoteUid || '').trim();
  if (!uid || !stream) return;

  let audioEl = remoteAudioElements.get(uid);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.preload = 'auto';
    audioEl.style.display = 'none';
    audioEl.dataset.remoteUid = uid;
    document.body.appendChild(audioEl);
    remoteAudioElements.set(uid, audioEl);
  }

  if (audioEl.srcObject !== stream) {
    audioEl.srcObject = stream;
  }

  audioEl.muted = Boolean(isDeafened);
  // Apply saved per-user volume scaled by master output volume
  if (participantVolumes.has(uid)) {
    audioEl.volume = Math.max(0, Math.min(1, participantVolumes.get(uid) * masterOutputVolume));
  } else {
    audioEl.volume = masterOutputVolume;
  }
  const playPromise = audioEl.play?.();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      if (!remoteAudioPlaybackNoticeShown) {
        remoteAudioPlaybackNoticeShown = true;
        showNotification('Click the call window once to enable remote audio playback.', { level: 'warning' });
      }
    });
  }
}

function removeRemoteAudioElement(remoteUid) {
  const uid = String(remoteUid || '').trim();
  if (!uid) return;

  const audioEl = remoteAudioElements.get(uid);
  if (!audioEl) return;

  try {
    audioEl.pause?.();
  } catch (_error) {
    // no-op
  }
  audioEl.srcObject = null;
  audioEl.remove();
  remoteAudioElements.delete(uid);
}

const participantVolumes = new Map(); // pid → 0..1

function setParticipantVolume(participantId, volume) {
  const pid = String(participantId || '').trim();
  if (!pid) return;
  const clampedVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  participantVolumes.set(pid, clampedVolume);

  // Apply to audio element
  const audioEl = remoteAudioElements.get(pid);
  if (audioEl) {
    audioEl.volume = clampedVolume;
  }
}

function clearRemoteAudioElements() {
  Array.from(remoteAudioElements.keys()).forEach((uid) => removeRemoteAudioElement(uid));
}

function updateRemoteAudioMuteState() {
  remoteAudioElements.forEach((audioEl) => {
    audioEl.muted = Boolean(isDeafened);
  });
}

function closeVoicePeer(remoteUid) {
  const uid = String(remoteUid || '').trim();
  if (!uid) return;

  const entry = voicePeerConnections.get(uid);
  if (!entry) return;

  entry.isClosed = true;

  try {
    entry.pc?.close?.();
  } catch (_error) {
    // no-op
  }

  voicePeerConnections.delete(uid);
  stopRemoteAudioMonitor(uid);
  removeRemoteAudioElement(uid);

  const participant = participants.find((item) => !item.isLocal && String(item.uid || item.id || '') === uid);
  if (participant) {
    participant.stream = null;
    participant.screenStream = null;
    participant.audioLevel = 0;
    participant.isSpeaking = false;
    syncParticipantAudioUi(participant);
  }
}

function closeAllVoicePeers() {
  Array.from(voicePeerConnections.keys()).forEach((uid) => closeVoicePeer(uid));
}

async function syncPeerLocalTracks(entry) {
  if (!entry?.pc || entry.isClosed) return false;
  const pc = entry.pc;
  let changed = false;

  const audioTrack = getLocalAudioTrack();
  if (audioTrack && localStream) {
    if (!entry.audioSender) {
      entry.audioSender = pc.addTrack(audioTrack, localStream);
      changed = true;
    } else if (entry.audioSender.track !== audioTrack) {
      await entry.audioSender.replaceTrack(audioTrack);
    }
  } else if (entry.audioSender) {
    pc.removeTrack(entry.audioSender);
    entry.audioSender = null;
    changed = true;
  }

  const cameraTrack = getLocalCameraTrack();
  if (cameraTrack && localStream) {
    if (!entry.cameraSender) {
      entry.cameraSender = pc.addTrack(cameraTrack, localStream);
      changed = true;
    } else if (entry.cameraSender.track !== cameraTrack) {
      await entry.cameraSender.replaceTrack(cameraTrack);
    }
  } else if (entry.cameraSender) {
    pc.removeTrack(entry.cameraSender);
    entry.cameraSender = null;
    changed = true;
  }

  const screenTrack = getLocalScreenTrack();
  if (screenTrack && screenStream) {
    if (!entry.screenSender) {
      entry.screenSender = pc.addTrack(screenTrack, screenStream);
      changed = true;
    } else if (entry.screenSender.track !== screenTrack) {
      await entry.screenSender.replaceTrack(screenTrack);
    }
  } else if (entry.screenSender) {
    pc.removeTrack(entry.screenSender);
    entry.screenSender = null;
    changed = true;
  }

  return changed;
}

function sendVoiceSignal(payload) {
  if (voiceSignalSocket && voiceSignalSocket.readyState === WebSocket.OPEN) {
    try {
      voiceSignalSocket.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('[Coverse] Failed to send voice signal via WebSocket:', error);
    }
  }

  // Firestore fallback for peer-directed signals (offer / answer / ice)
  if (payload?.targetUid && voiceFirestoreSignaling) {
    sendFirestoreVoiceSignal(payload).catch(() => {});
    return true;
  }

  return false;
}

async function renegotiateVoicePeer(entry, reason = 'sync') {
  if (!entry?.pc || entry.isClosed) return;
  if (!voiceSignalConnected && !voiceFirestoreSignaling) return;

  const pc = entry.pc;
  if (pc.signalingState === 'closed') return;
  if (entry.makingOffer) return;

  try {
    entry.makingOffer = true;
    await syncPeerLocalTracks(entry);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    sendVoiceSignal({
      type: 'offer',
      uid: getLocalVoiceIdentity().uid,
      name: getLocalVoiceIdentity().name,
      targetUid: entry.uid,
      reason,
      sdp: pc.localDescription
    });
  } catch (error) {
    console.warn('[Coverse] Voice renegotiation failed:', error);
  } finally {
    entry.makingOffer = false;
  }
}

async function syncLocalMediaToVoicePeers(options = {}) {
  const shouldRenegotiate = options.renegotiate !== false;

  for (const entry of voicePeerConnections.values()) {
    const changed = await syncPeerLocalTracks(entry);
    if (shouldRenegotiate && changed) {
      await renegotiateVoicePeer(entry, 'local-media-change');
    }
  }
}

function ensureRemoteParticipant(remoteUid, remoteName = '') {
  const uid = String(remoteUid || '').trim();
  if (!uid) return null;

  let participant = participants.find((item) => !item.isLocal && String(item.uid || item.id || '') === uid);
  if (participant) {
    if (remoteName && !participant.name) participant.name = remoteName;
    return participant;
  }

  participant = {
    id: uid,
    uid,
    name: remoteName || uid,
    avatar: getInitials(remoteName || uid),
    isLocal: false,
    isMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isSpeaking: false,
    audioLevel: 0,
    cameraPreview: '',
    screenPreview: '',
    stream: null,
    screenStream: null
  };

  participants.push(participant);
  return participant;
}

function isDisplayTrack(track) {
  const label = String(track?.label || '').toLowerCase();
  return label.includes('screen') || label.includes('display') || label.includes('window');
}

function ensureVoicePeer(remoteUid, remoteName = '') {
  const uid = String(remoteUid || '').trim();
  if (!uid) return null;
  const localUid = getLocalVoiceIdentity().uid;
  if (uid === localUid) return null;

  let entry = voicePeerConnections.get(uid);
  if (entry) {
    if (remoteName) entry.remoteName = remoteName;
    return entry;
  }

  const runtime = voiceSignalingRuntimeConfig || {
    iceServers: DEFAULT_VOICE_ICE_SERVERS
  };

  const pc = new RTCPeerConnection({
    iceServers: Array.isArray(runtime.iceServers) && runtime.iceServers.length
      ? runtime.iceServers
      : DEFAULT_VOICE_ICE_SERVERS,
    bundlePolicy: 'max-bundle',
    iceCandidatePoolSize: 2
  });

  entry = {
    uid,
    remoteName: remoteName || uid,
    pc,
    makingOffer: false,
    ignoreOffer: false,
    isSettingRemoteAnswerPending: false,
    polite: localUid.localeCompare(uid) > 0,
    isClosed: false,
    audioSender: null,
    cameraSender: null,
    screenSender: null
  };

  voicePeerConnections.set(uid, entry);

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    sendVoiceSignal({
      type: 'ice',
      uid: localUid,
      targetUid: uid,
      candidate: event.candidate
    });
  };

  pc.ontrack = (event) => {
    const incomingStream = event.streams?.[0] || new MediaStream([event.track]);
    const participant = ensureRemoteParticipant(uid, entry.remoteName);
    if (!participant) return;

    if (event.track.kind === 'audio') {
      if (!participant.stream) {
        participant.stream = incomingStream;
      }
      ensureRemoteAudioElement(uid, incomingStream);
      ensureRemoteAudioMonitor(uid, incomingStream);
    }

    if (event.track.kind === 'video') {
      if (isDisplayTrack(event.track)) {
        participant.screenStream = incomingStream;
        participant.isScreenSharing = true;
      } else {
        participant.stream = incomingStream;
        participant.isCameraOn = true;
      }
    }

    renderParticipants();

    event.track.addEventListener('ended', () => {
      if (event.track.kind === 'video') {
        if (isDisplayTrack(event.track)) {
          participant.screenStream = null;
          participant.isScreenSharing = false;
        } else {
          participant.stream = null;
          participant.isCameraOn = false;
        }
      }

      if (event.track.kind === 'audio') {
        stopRemoteAudioMonitor(uid);
        removeRemoteAudioElement(uid);
        participant.audioLevel = 0;
        participant.isSpeaking = false;
      }

      renderParticipants();
    });
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      closeVoicePeer(uid);
      renderParticipants();
    }
  };

  pc.onnegotiationneeded = () => {
    renegotiateVoicePeer(entry, 'negotiation-needed').catch(() => {});
  };

  syncPeerLocalTracks(entry).catch(() => {});
  return entry;
}

async function handleVoiceSignalDescriptionMessage(message, type) {
  const remoteUid = String(message.uid || '').trim();
  const targetUid = String(message.targetUid || '').trim();
  const localUid = getLocalVoiceIdentity().uid;
  if (!remoteUid || remoteUid === localUid) return;
  if (targetUid && targetUid !== localUid) return;

  const entry = ensureVoicePeer(remoteUid, String(message.name || remoteUid));
  if (!entry?.pc) return;

  const description = message.sdp;
  if (!description?.type) return;

  const pc = entry.pc;
  const readyForOffer = !entry.makingOffer && (pc.signalingState === 'stable' || entry.isSettingRemoteAnswerPending);
  const offerCollision = type === 'offer' && !readyForOffer;
  entry.ignoreOffer = !entry.polite && offerCollision;
  if (entry.ignoreOffer) return;

  try {
    entry.isSettingRemoteAnswerPending = type === 'answer';
    await pc.setRemoteDescription(description);
    entry.isSettingRemoteAnswerPending = false;

    if (type === 'offer') {
      await syncPeerLocalTracks(entry);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendVoiceSignal({
        type: 'answer',
        uid: localUid,
        name: getLocalVoiceIdentity().name,
        targetUid: remoteUid,
        sdp: pc.localDescription
      });
    }
  } catch (error) {
    console.warn('[Coverse] Failed to handle voice signaling description:', error);
  } finally {
    entry.isSettingRemoteAnswerPending = false;
  }
}

async function handleVoiceSignalIceMessage(message) {
  const remoteUid = String(message.uid || '').trim();
  const targetUid = String(message.targetUid || '').trim();
  const localUid = getLocalVoiceIdentity().uid;
  if (!remoteUid || remoteUid === localUid) return;
  if (targetUid && targetUid !== localUid) return;

  const entry = ensureVoicePeer(remoteUid, String(message.name || remoteUid));
  if (!entry?.pc || !message.candidate) return;

  try {
    await entry.pc.addIceCandidate(message.candidate);
  } catch (error) {
    if (!entry.ignoreOffer) {
      console.warn('[Coverse] Failed to add ICE candidate:', error);
    }
  }
}

function handleVoiceSignalingMessage(message) {
  if (!message || typeof message !== 'object') return;

  const localUid = getLocalVoiceIdentity().uid;
  if (message.type === 'joined') {
    voiceSignalConnected = true;
    return;
  }

  if (message.type === 'roster') {
    const members = Array.isArray(message.members) ? message.members : [];
    const activeRemoteUids = new Set();

    members.forEach((member) => {
      const remoteUid = String(member?.id || '').trim();
      if (!remoteUid || remoteUid === localUid) return;

      activeRemoteUids.add(remoteUid);
      const entry = ensureVoicePeer(remoteUid, String(member?.name || remoteUid));

      // Deterministic first offer to avoid initial glare in a fresh room.
      if (entry && localUid.localeCompare(remoteUid) > 0 && entry.pc.signalingState === 'stable') {
        renegotiateVoicePeer(entry, 'initial-roster').catch(() => {});
      }
    });

    Array.from(voicePeerConnections.keys()).forEach((uid) => {
      if (!activeRemoteUids.has(uid)) {
        closeVoicePeer(uid);
      }
    });

    renderParticipants();
    return;
  }

  if (message.type === 'presence') {
    const remoteUid = String(message.userId || '').trim();
    if (!remoteUid || remoteUid === localUid) return;

    if (String(message.status || '') === 'left') {
      closeVoicePeer(remoteUid);
      renderParticipants();
      return;
    }

    if (String(message.status || '') === 'joined') {
      const entry = ensureVoicePeer(remoteUid, String(message.name || remoteUid));
      if (entry && localUid.localeCompare(remoteUid) > 0 && entry.pc.signalingState === 'stable') {
        renegotiateVoicePeer(entry, 'presence-joined').catch(() => {});
      }
      return;
    }
  }

  if (message.type === 'offer') {
    handleVoiceSignalDescriptionMessage(message, 'offer').catch(() => {});
    return;
  }

  if (message.type === 'answer') {
    handleVoiceSignalDescriptionMessage(message, 'answer').catch(() => {});
    return;
  }

  if (message.type === 'ice') {
    handleVoiceSignalIceMessage(message).catch(() => {});
  }
}

function scheduleVoiceSignalingReconnect() {
  if (voiceSignalManualClose || !inVoiceCall) return;
  if (voiceSignalReconnectTimer) return;

  const delayMs = Math.min(10000, voiceSignalingBackoffMs);
  voiceSignalReconnectTimer = setTimeout(() => {
    voiceSignalReconnectTimer = null;
    if (!inVoiceCall || voiceSignalManualClose) return;
    connectVoiceSignaling().catch(() => {});
  }, delayMs);

  voiceSignalingBackoffMs = Math.min(12000, Math.round(voiceSignalingBackoffMs * 1.6));
}

async function connectVoiceSignaling() {
  if (!inVoiceCall) return;
  const context = getActiveVoiceContext();
  if (!context) return;

  const room = getVoiceSignalingRoom(context);
  if (!room) return;

  if (
    voiceSignalSocket &&
    voiceSignalSocket.readyState === WebSocket.OPEN &&
    voiceSignalConnected &&
    voiceSignalRoom === room
  ) {
    return;
  }

  const runtime = await ensureVoiceSignalingRuntimeConfig();
  if (!runtime?.url) {
    showNotification('Voice signaling is not configured.', { level: 'error' });
    return;
  }

  disconnectVoiceSignaling({ preservePeers: false, silent: true });

  voiceSignalManualClose = false;
  voiceSignalRoom = room;

  const socket = new WebSocket(runtime.url);
  voiceSignalSocket = socket;

  socket.addEventListener('open', () => {
    voiceSignalConnected = true;
    voiceSignalingBackoffMs = 1200;

    const identity = getLocalVoiceIdentity();
    sendVoiceSignal({
      type: 'join',
      room,
      token: runtime.token || '',
      uid: identity.uid,
      name: identity.name
    });
  });

  socket.addEventListener('message', (event) => {
    let payload = null;
    try {
      payload = JSON.parse(String(event.data || '{}'));
    } catch (_error) {
      payload = null;
    }

    if (!payload) return;
    handleVoiceSignalingMessage(payload);
  });

  socket.addEventListener('close', () => {
    voiceSignalConnected = false;
    if (voiceSignalSocket === socket) {
      voiceSignalSocket = null;
    }
    closeAllVoicePeers();
    scheduleVoiceSignalingReconnect();
  });

  socket.addEventListener('error', (error) => {
    console.warn('[Coverse] Voice signaling socket error:', error);
  });
}

function disconnectVoiceSignaling(options = {}) {
  const preservePeers = options.preservePeers === true;
  const silent = options.silent === true;

  voiceSignalManualClose = true;
  voiceSignalConnected = false;
  voiceSignalRoom = '';

  unsubscribeVoiceFirestoreSignals();

  if (voiceSignalReconnectTimer) {
    clearTimeout(voiceSignalReconnectTimer);
    voiceSignalReconnectTimer = null;
  }

  if (voiceSignalSocket) {
    try {
      voiceSignalSocket.close();
    } catch (_error) {
      // no-op
    }
    voiceSignalSocket = null;
  }

  if (!preservePeers) {
    closeAllVoicePeers();
    clearRemoteAudioElements();
    stopAllRemoteAudioMonitors();
  }

  if (!silent) {
    voiceSignalingBackoffMs = 1200;
  }
}

function setRemoteControlStatus(message = '', kind = 'info') {
  const statusEl = document.getElementById('remoteControlStatus');
  if (!statusEl) return;

  const text = String(message || '').trim();
  statusEl.classList.remove('hidden', 'warning', 'success');

  if (!text) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
    return;
  }

  statusEl.textContent = text;
  if (kind === 'warning') statusEl.classList.add('warning');
  if (kind === 'success') statusEl.classList.add('success');
}

function updateRemoteControlButtonState() {
  const button = document.getElementById('btnRemoteControl');
  if (!button) return;

  const labelEl = button.querySelector('span');
  const remoteSharers = participants.filter((participant) => !participant.isLocal && participant.isScreenSharing);

  let label = 'Request Ctrl';
  let disabled = !inVoiceCall;
  let title = 'Request remote control';

  if (remoteControlState.activeRole === 'target') {
    label = 'Revoke Ctrl';
    disabled = false;
    title = 'Revoke current remote controller';
  } else if (remoteControlState.activeRole === 'controller') {
    label = 'Stop Ctrl';
    disabled = false;
    title = 'Stop controlling remote screen';
  } else if (remoteControlState.outgoingStatus === 'pending' && remoteControlState.outgoingRequestId) {
    label = 'Cancel Req';
    disabled = false;
    title = 'Cancel pending remote-control request';
  } else if (!remoteSharers.length) {
    disabled = true;
    title = 'No remote screen share available';
  }

  if (labelEl) {
    labelEl.textContent = label;
  } else {
    button.textContent = label;
  }

  button.disabled = disabled;
  button.title = title;
  button.classList.toggle('active', remoteControlState.activeRole !== 'none');
}

function refreshVoicePreviewStatus() {
  const statusEl = document.getElementById('voicePreviewStatus');
  if (!statusEl) return;

  const usersInChannel = participants.filter((participant) => !participant.isLocal);
  if (usersInChannel.length > 0) {
    statusEl.textContent = `${usersInChannel.length} ${usersInChannel.length === 1 ? 'person is' : 'people are'} in voice`;
  } else {
    statusEl.textContent = 'No one is in voice';
  }
}

function stopRemoteControlHeartbeat() {
  if (remoteControlHeartbeatInterval) {
    clearInterval(remoteControlHeartbeatInterval);
    remoteControlHeartbeatInterval = null;
  }
}

function startRemoteControlHeartbeat(context, grantData = {}) {
  stopRemoteControlHeartbeat();

  if (!context || remoteControlState.activeRole !== 'controller') return;

  remoteControlHeartbeatInterval = setInterval(async () => {
    if (remoteControlState.activeRole !== 'controller') {
      stopRemoteControlHeartbeat();
      return;
    }

    const grantExpiresMs = getVoiceTimestampMs(grantData.expiresAt);
    if (grantExpiresMs > 0 && Date.now() >= grantExpiresMs) {
      stopRemoteControlHeartbeat();
      return;
    }

    const targetUid = String(remoteControlState.activeTargetUid || '').trim();
    if (!targetUid || !window.firebaseSetDoc || !window.firebaseDb) return;

    try {
      const grantRef = window.firebaseDoc(
        window.firebaseDb,
        'sessions',
        context.sessionId,
        'voiceChannels',
        context.channelId,
        'remoteControlGrants',
        targetUid
      );
      await window.firebaseSetDoc(
        grantRef,
        {
          lastActivityAt: new Date(),
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('[Coverse] Remote-control heartbeat failed:', error);
    }
  }, REMOTE_CONTROL_HEARTBEAT_MS);
}

function resetRemoteControlState() {
  remoteControlState = {
    outgoingRequestId: '',
    outgoingTargetUid: '',
    outgoingStatus: '',
    activeRole: 'none',
    activeGrantId: '',
    activeTargetUid: '',
    activeControllerUid: ''
  };
}

function clearVoiceRealtimeSubscriptions(options = {}) {
  const { resetParticipants = false, preserveContext = false } = options;

  if (typeof voiceParticipantsUnsubscribe === 'function') {
    voiceParticipantsUnsubscribe();
  }
  if (typeof remoteControlRequestsUnsubscribe === 'function') {
    remoteControlRequestsUnsubscribe();
  }
  if (typeof remoteControlGrantsUnsubscribe === 'function') {
    remoteControlGrantsUnsubscribe();
  }

  voiceParticipantsUnsubscribe = null;
  remoteControlRequestsUnsubscribe = null;
  remoteControlGrantsUnsubscribe = null;

  if (remoteControlCleanupInterval) {
    clearInterval(remoteControlCleanupInterval);
    remoteControlCleanupInterval = null;
  }

  stopRemoteControlHeartbeat();
  remoteControlPromptedRequestIds = new Set();
  resetRemoteControlState();

  if (!preserveContext) {
    activeVoiceSessionId = null;
    activeVoiceChannelId = null;
    localVoiceRealtimeKey = '';
  }

  if (resetParticipants) {
    const localIdentity = getLocalVoiceIdentity();
    const localParticipant = participants.find((participant) => participant.isLocal) || {
      id: 'local',
      isLocal: true
    };

    participants = [
      {
        ...localParticipant,
        id: 'local',
        uid: localIdentity.uid,
        name: localIdentity.name,
        avatar: localIdentity.avatar,
        isMuted: isMicMuted,
        isCameraOn: !isCameraOff,
        isScreenSharing: isScreenSharing,
        isSpeaking: false,
        audioLevel: 0,
        cameraPreview: latestCameraPreviewDataUrl,
        screenPreview: latestScreenPreviewDataUrl
      }
    ];
    renderParticipants();
    refreshVoicePreviewStatus();
  }

  setRemoteControlStatus('');
  updateRemoteControlButtonState();
}

function clearVoicePreviewRealtimeSubscription(options = {}) {
  const { resetParticipants = false, preserveContext = true } = options;

  if (typeof voicePreviewParticipantsUnsubscribe === 'function') {
    voicePreviewParticipantsUnsubscribe();
  }

  voicePreviewParticipantsUnsubscribe = null;
  voicePreviewRealtimeKey = '';

  if (!preserveContext && !inVoiceCall) {
    activeVoiceSessionId = null;
    activeVoiceChannelId = null;
  }

  if (resetParticipants && !inVoiceCall) {
    const localIdentity = getLocalVoiceIdentity();
    const localParticipant = participants.find((participant) => participant.isLocal) || {
      id: 'local',
      isLocal: true
    };

    participants = [
      {
        ...localParticipant,
        id: 'local',
        uid: localIdentity.uid,
        name: localIdentity.name,
        avatar: localIdentity.avatar,
        isMuted: isMicMuted,
        isCameraOn: !isCameraOff,
        isScreenSharing: isScreenSharing,
        isSpeaking: false,
        audioLevel: 0,
        cameraPreview: latestCameraPreviewDataUrl,
        screenPreview: latestScreenPreviewDataUrl
      }
    ];
    renderParticipants();
  }
}

async function ensureVoicePreviewRealtimeSync() {
  if (inVoiceCall) return;
  if (!window.firebaseDb || !window.firebaseOnSnapshot) return;

  const context = getActiveVoiceContext();
  if (!context) {
    clearVoicePreviewRealtimeSubscription({ resetParticipants: true, preserveContext: false });
    return;
  }

  const nextPreviewKey = `${context.sessionId}::${context.channelId}`;
  if (voicePreviewRealtimeKey === nextPreviewKey && typeof voicePreviewParticipantsUnsubscribe === 'function') {
    return;
  }

  const refs = getVoiceChannelRefs(context);
  if (!refs) return;

  clearVoicePreviewRealtimeSubscription({ preserveContext: true });
  voicePreviewRealtimeKey = nextPreviewKey;

  voicePreviewParticipantsUnsubscribe = window.firebaseOnSnapshot(
    refs.participantsRef,
    (snapshot) => {
      applyVoiceParticipantsSnapshot(snapshot);
    },
    (error) => {
      console.warn('[Coverse] Voice preview participants subscription failed:', error);
    }
  );
}

async function publishLocalVoiceState(overrides = {}) {
  if (!window.firebaseDb || !window.firebaseSetDoc) return;

  const context = getActiveVoiceContext();
  if (!context) return;

  const participantRef = window.firebaseDoc(
    window.firebaseDb,
    'sessions',
    context.sessionId,
    'voiceChannels',
    context.channelId,
    'participants',
    context.localUid
  );

  const payload = {
    uid: context.localUid,
    sessionId: context.sessionId,
    channelId: context.channelId,
    name: context.localName,
    avatar: context.localAvatar,
    isInVoice: Boolean(inVoiceCall),
    isScreenSharing: Boolean(isScreenSharing),
    screenPreview: isScreenSharing ? latestScreenPreviewDataUrl : '',
    cameraPreview: !isCameraOff ? latestCameraPreviewDataUrl : '',
    isCameraOn: !isCameraOff,
    isMuted: Boolean(isMicMuted),
    updatedAt: new Date(),
    ...overrides
  };

  await window.firebaseSetDoc(participantRef, payload, { merge: true });
}

function applyVoiceParticipantsSnapshot(snapshot) {
  const localIdentity = getLocalVoiceIdentity();
  const existingLocal = participants.find((participant) => participant.isLocal) || {
    id: 'local',
    isLocal: true
  };

  const previousRemoteByUid = new Map(
    participants
      .filter((participant) => participant && !participant.isLocal)
      .map((participant) => [String(participant.uid || participant.id || '').trim(), participant])
      .filter(([uid]) => Boolean(uid))
  );

  const remoteParticipants = [];
  const nextRemoteUids = new Set();
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const uid = String(data.uid || docSnap.id || '').trim();
    if (!uid || uid === localIdentity.uid || data.isInVoice !== true) return;

    nextRemoteUids.add(uid);
    const existingRemote = previousRemoteByUid.get(uid);

    remoteParticipants.push({
      ...existingRemote,
      id: uid,
      uid,
      name: String(data.name || uid).trim() || uid,
      avatar: String(data.avatar || getInitials(data.name || uid)).trim() || getInitials(uid),
      isLocal: false,
      isMuted: Boolean(data.isMuted),
      isCameraOn: Boolean(data.isCameraOn),
      isScreenSharing: Boolean(data.isScreenSharing),
      isSpeaking: Boolean(existingRemote?.isSpeaking),
      audioLevel: normalizeAudioLevel(existingRemote?.audioLevel),
      cameraPreview: String(data.cameraPreview || '').trim(),
      screenPreview: String(data.screenPreview || '').trim(),
      stream: existingRemote?.stream || null,
      screenStream: existingRemote?.screenStream || null
    });
  });

  // Firestore presence can lag signaling by a moment; keep connected peers visible.
  voicePeerConnections.forEach((entry, uid) => {
    if (!uid || nextRemoteUids.has(uid)) return;
    const existingRemote = previousRemoteByUid.get(uid);
    remoteParticipants.push({
      ...(existingRemote || {}),
      id: uid,
      uid,
      name: String(existingRemote?.name || entry.remoteName || uid).trim() || uid,
      avatar: String(existingRemote?.avatar || getInitials(existingRemote?.name || entry.remoteName || uid)).trim(),
      isLocal: false,
      isMuted: Boolean(existingRemote?.isMuted),
      isCameraOn: Boolean(existingRemote?.isCameraOn),
      isScreenSharing: Boolean(existingRemote?.isScreenSharing),
      isSpeaking: Boolean(existingRemote?.isSpeaking),
      audioLevel: normalizeAudioLevel(existingRemote?.audioLevel),
      cameraPreview: String(existingRemote?.cameraPreview || '').trim(),
      screenPreview: String(existingRemote?.screenPreview || '').trim(),
      stream: existingRemote?.stream || null,
      screenStream: existingRemote?.screenStream || null
    });
  });

  remoteParticipants.sort((a, b) => a.name.localeCompare(b.name));

  participants = [
    {
      ...existingLocal,
      id: 'local',
      uid: localIdentity.uid,
      name: localIdentity.name,
      avatar: localIdentity.avatar,
      isMuted: isMicMuted,
      isCameraOn: !isCameraOff,
      isScreenSharing: isScreenSharing,
      isSpeaking: localSpeakingState,
      audioLevel: normalizeAudioLevel(existingLocal.audioLevel),
      cameraPreview: latestCameraPreviewDataUrl,
      screenPreview: latestScreenPreviewDataUrl
    },
    ...remoteParticipants
  ];

  if (inVoiceCall) {
    remoteParticipants.forEach((participant) => {
      ensureVoicePeer(participant.uid, participant.name);
    });
  }

  renderParticipants();
  syncAllParticipantAudioUi();
  refreshVoicePreviewStatus();
  updateRemoteControlButtonState();
}

async function updateRemoteControlRequestStatus(context, requestId, status, reason = '') {
  if (!window.firebaseSetDoc || !window.firebaseDb || !context || !requestId) return;
  const localIdentity = getLocalVoiceIdentity();
  const requestRef = window.firebaseDoc(
    window.firebaseDb,
    'sessions',
    context.sessionId,
    'voiceChannels',
    context.channelId,
    'remoteControlRequests',
    requestId
  );

  await window.firebaseSetDoc(
    requestRef,
    {
      status,
      reason: String(reason || ''),
      updatedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUid: localIdentity.uid
    },
    { merge: true }
  );
}

async function revokeRemoteControlGrant(context, reason = 'manual-revoke', explicitTargetUid = '') {
  if (!window.firebaseSetDoc || !window.firebaseDb || !context) return;

  const localIdentity = getLocalVoiceIdentity();
  const targetUid = String(
    explicitTargetUid ||
    (remoteControlState.activeRole === 'target' ? localIdentity.uid : remoteControlState.activeTargetUid)
  ).trim();

  if (!targetUid) return;

  const grantRef = window.firebaseDoc(
    window.firebaseDb,
    'sessions',
    context.sessionId,
    'voiceChannels',
    context.channelId,
    'remoteControlGrants',
    targetUid
  );

  await window.firebaseSetDoc(
    grantRef,
    {
      isActive: false,
      revokeReason: String(reason || 'revoked'),
      revokedAt: new Date(),
      revokedByUid: localIdentity.uid,
      updatedAt: new Date()
    },
    { merge: true }
  );
}

async function approveRemoteControlRequest(context, request) {
  const localIdentity = getLocalVoiceIdentity();
  if (!request || request.targetUid !== localIdentity.uid) return;

  if (!isScreenSharing) {
    await updateRemoteControlRequestStatus(context, request.id, 'denied', 'target-not-sharing');
    showNotification('Remote control denied: you are not sharing your screen.');
    return;
  }

  if (
    remoteControlState.activeRole === 'target' &&
    remoteControlState.activeControllerUid &&
    remoteControlState.activeControllerUid !== request.requesterUid
  ) {
    await updateRemoteControlRequestStatus(context, request.id, 'denied', 'controller-already-active');
    showNotification('Remote control denied: another controller is already active.');
    return;
  }

  if (!window.firebaseSetDoc || !window.firebaseDb) return;

  const grantRef = window.firebaseDoc(
    window.firebaseDb,
    'sessions',
    context.sessionId,
    'voiceChannels',
    context.channelId,
    'remoteControlGrants',
    localIdentity.uid
  );

  const now = Date.now();
  await window.firebaseSetDoc(
    grantRef,
    {
      grantId: `${localIdentity.uid}_${request.requesterUid}`,
      sessionId: context.sessionId,
      channelId: context.channelId,
      targetUid: localIdentity.uid,
      targetName: localIdentity.name,
      controllerUid: request.requesterUid,
      controllerName: request.requesterName || request.requesterUid,
      requestId: request.id,
      isActive: true,
      grantedAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(now + REMOTE_CONTROL_GRANT_TTL_MS),
      revokeReason: '',
      revokedAt: null,
      revokedByUid: null
    },
    { merge: true }
  );

  await updateRemoteControlRequestStatus(context, request.id, 'approved', 'approved-by-target');
  showNotification(`Remote control approved for ${request.requesterName || 'collaborator'}.`);
}

async function handleRemoteControlRequestsSnapshot(snapshot, context) {
  const localIdentity = getLocalVoiceIdentity();
  const now = Date.now();
  const requestsMap = new Map();

  snapshot.forEach((docSnap) => {
    requestsMap.set(docSnap.id, {
      id: docSnap.id,
      ...(docSnap.data() || {})
    });
  });

  if (remoteControlState.outgoingRequestId) {
    const outgoingRequest = requestsMap.get(remoteControlState.outgoingRequestId);
    const outgoingStatus = String(outgoingRequest?.status || '').trim().toLowerCase();

    if (!outgoingRequest) {
      remoteControlState.outgoingRequestId = '';
      remoteControlState.outgoingTargetUid = '';
      remoteControlState.outgoingStatus = '';
    } else if (outgoingStatus && outgoingStatus !== 'pending') {
      if (outgoingStatus === 'denied') {
        showNotification('Remote control request denied.');
      } else if (outgoingStatus === 'expired') {
        showNotification('Remote control request expired.');
      } else if (outgoingStatus === 'revoked') {
        showNotification('Remote control request was canceled.');
      }
      remoteControlState.outgoingRequestId = '';
      remoteControlState.outgoingTargetUid = '';
      remoteControlState.outgoingStatus = '';
    } else if (outgoingStatus === 'pending') {
      remoteControlState.outgoingStatus = 'pending';
    }
  }

  if (!remoteControlState.outgoingRequestId) {
    const latestPendingOutgoing = Array.from(requestsMap.values())
      .filter((entry) => String(entry.requesterUid || '') === localIdentity.uid && String(entry.status || '') === 'pending')
      .sort((a, b) => getVoiceTimestampMs(b.createdAt) - getVoiceTimestampMs(a.createdAt))[0];

    if (latestPendingOutgoing) {
      remoteControlState.outgoingRequestId = latestPendingOutgoing.id;
      remoteControlState.outgoingTargetUid = String(latestPendingOutgoing.targetUid || '').trim();
      remoteControlState.outgoingStatus = 'pending';
    }
  }

  for (const request of requestsMap.values()) {
    const status = String(request.status || '').trim().toLowerCase();
    if (status !== 'pending') {
      remoteControlPromptedRequestIds.delete(request.id);
      continue;
    }

    if (String(request.targetUid || '') !== localIdentity.uid) continue;

    const expiresMs = getVoiceTimestampMs(request.expiresAt);
    if (expiresMs > 0 && now >= expiresMs) {
      await updateRemoteControlRequestStatus(context, request.id, 'expired', 'request-timeout');
      remoteControlPromptedRequestIds.delete(request.id);
      continue;
    }

    if (remoteControlPromptedRequestIds.has(request.id)) {
      continue;
    }

    remoteControlPromptedRequestIds.add(request.id);

    const requesterName = String(request.requesterName || request.requesterUid || 'Collaborator').trim() || 'Collaborator';
    const approved = window.confirm(`${requesterName} requested remote control for up to 2 minutes. Allow control now?`);

    if (approved) {
      await approveRemoteControlRequest(context, request);
    } else {
      await updateRemoteControlRequestStatus(context, request.id, 'denied', 'target-denied');
      showNotification(`Remote control denied for ${requesterName}.`);
    }

    remoteControlPromptedRequestIds.delete(request.id);
  }

  if (remoteControlState.activeRole === 'none') {
    if (remoteControlState.outgoingStatus === 'pending') {
      setRemoteControlStatus('Remote-control request pending approval…');
    } else {
      setRemoteControlStatus('');
    }
  }

  updateRemoteControlButtonState();
}

function applyRemoteControlRole(role, grantData = null) {
  const controllerUid = String(grantData?.controllerUid || '').trim();
  const targetUid = String(grantData?.targetUid || '').trim();

  remoteControlState.activeRole = role;
  remoteControlState.activeGrantId = String(grantData?.grantId || '').trim();
  remoteControlState.activeControllerUid = controllerUid;
  remoteControlState.activeTargetUid = targetUid;
}

async function handleRemoteControlGrantsSnapshot(snapshot, context) {
  const localIdentity = getLocalVoiceIdentity();
  const now = Date.now();
  const previousRole = remoteControlState.activeRole;
  const previousControllerUid = remoteControlState.activeControllerUid;
  const previousTargetUid = remoteControlState.activeTargetUid;
  let grantAsTarget = null;
  let grantAsController = null;

  const staleGrantIds = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const expiresMs = getVoiceTimestampMs(data.expiresAt);
    const lastActivityMs = getVoiceTimestampMs(data.lastActivityAt);
    const isExpired = expiresMs > 0 && now >= expiresMs;
    const isInactive = lastActivityMs > 0 && now - lastActivityMs >= REMOTE_CONTROL_INACTIVITY_TIMEOUT_MS;
    const isActive = data.isActive === true && !isExpired && !isInactive;

    if (!isActive) {
      if (String(data.targetUid || '') === localIdentity.uid && data.isActive === true) {
        staleGrantIds.push(docSnap.id);
      }
      return;
    }

    if (String(data.targetUid || '') === localIdentity.uid) {
      if (!grantAsTarget || getVoiceTimestampMs(data.grantedAt) > getVoiceTimestampMs(grantAsTarget.grantedAt)) {
        grantAsTarget = { id: docSnap.id, ...data };
      }
    }

    if (String(data.controllerUid || '') === localIdentity.uid) {
      if (!grantAsController || getVoiceTimestampMs(data.grantedAt) > getVoiceTimestampMs(grantAsController.grantedAt)) {
        grantAsController = { id: docSnap.id, ...data };
      }
    }
  });

  if (staleGrantIds.length && window.firebaseSetDoc && window.firebaseDb) {
    await Promise.all(staleGrantIds.map(async (grantId) => {
      const grantRef = window.firebaseDoc(
        window.firebaseDb,
        'sessions',
        context.sessionId,
        'voiceChannels',
        context.channelId,
        'remoteControlGrants',
        grantId
      );

      await window.firebaseSetDoc(
        grantRef,
        {
          isActive: false,
          revokeReason: 'grant-expired',
          revokedAt: new Date(),
          revokedByUid: localIdentity.uid,
          updatedAt: new Date()
        },
        { merge: true }
      );
    }));
  }

  if (grantAsTarget) {
    applyRemoteControlRole('target', grantAsTarget);
    stopRemoteControlHeartbeat();

    if (previousRole !== 'target' || previousControllerUid !== String(grantAsTarget.controllerUid || '')) {
      showNotification(`${grantAsTarget.controllerName || 'Collaborator'} now has remote control.`);
    }

    setRemoteControlStatus(`Controlled by ${grantAsTarget.controllerName || 'collaborator'}. Click Revoke Ctrl to stop.`, 'warning');

    if (!isScreenSharing) {
      await revokeRemoteControlGrant(context, 'target-stopped-sharing', localIdentity.uid);
    }
  } else if (grantAsController) {
    applyRemoteControlRole('controller', grantAsController);

    if (previousRole !== 'controller' || previousTargetUid !== String(grantAsController.targetUid || '')) {
      showNotification(`Remote control granted by ${grantAsController.targetName || 'collaborator'}.`);
    }

    remoteControlState.outgoingRequestId = '';
    remoteControlState.outgoingTargetUid = '';
    remoteControlState.outgoingStatus = '';

    setRemoteControlStatus(`Controlling ${grantAsController.targetName || 'remote screen'}.`, 'success');
    startRemoteControlHeartbeat(context, grantAsController);
  } else {
    if (previousRole !== 'none') {
      showNotification('Remote control session ended.');
    }

    applyRemoteControlRole('none', null);
    stopRemoteControlHeartbeat();

    if (remoteControlState.outgoingStatus === 'pending') {
      setRemoteControlStatus('Remote-control request pending approval…');
    } else {
      setRemoteControlStatus('');
    }
  }

  updateRemoteControlButtonState();
}

async function cleanupExpiredRemoteControlDocs(context) {
  if (!context || !inVoiceCall) return;
  if (remoteControlState.activeRole === 'target' && !isScreenSharing) {
    await revokeRemoteControlGrant(context, 'target-stopped-sharing');
  }
}

async function ensureVoiceRealtimeSync() {
  if (!inVoiceCall) return;
  if (!window.firebaseDb || !window.firebaseOnSnapshot) return;

  clearVoicePreviewRealtimeSubscription({ preserveContext: true });

  const context = getActiveVoiceContext();
  if (!context) return;

  if (
    localVoiceRealtimeKey === context.key &&
    typeof voiceParticipantsUnsubscribe === 'function' &&
    typeof remoteControlRequestsUnsubscribe === 'function' &&
    typeof remoteControlGrantsUnsubscribe === 'function'
  ) {
    return;
  }

  clearVoiceRealtimeSubscriptions({ preserveContext: true });
  localVoiceRealtimeKey = context.key;

  const refs = getVoiceChannelRefs(context);
  if (!refs) return;

  voiceParticipantsUnsubscribe = window.firebaseOnSnapshot(
    refs.participantsRef,
    (snapshot) => {
      applyVoiceParticipantsSnapshot(snapshot);
    },
    (error) => {
      console.warn('[Coverse] Voice participants subscription failed:', error);
    }
  );

  remoteControlRequestsUnsubscribe = window.firebaseOnSnapshot(
    refs.requestsRef,
    (snapshot) => {
      handleRemoteControlRequestsSnapshot(snapshot, context).catch((error) => {
        console.warn('[Coverse] Remote-control requests handler failed:', error);
      });
    },
    (error) => {
      console.warn('[Coverse] Remote-control request subscription failed:', error);
    }
  );

  remoteControlGrantsUnsubscribe = window.firebaseOnSnapshot(
    refs.grantsRef,
    (snapshot) => {
      handleRemoteControlGrantsSnapshot(snapshot, context).catch((error) => {
        console.warn('[Coverse] Remote-control grants handler failed:', error);
      });
    },
    (error) => {
      console.warn('[Coverse] Remote-control grant subscription failed:', error);
    }
  );

  if (remoteControlCleanupInterval) {
    clearInterval(remoteControlCleanupInterval);
  }
  remoteControlCleanupInterval = setInterval(() => {
    cleanupExpiredRemoteControlDocs(context).catch(() => {});
  }, 5000);

  try {
    await publishLocalVoiceState();
  } catch (error) {
    console.warn('[Coverse] Could not publish local voice state:', error);
  }

  updateRemoteControlButtonState();
}

function getPrimaryRemoteControlTarget() {
  if (activeStageSource?.participantId && activeStageSource.participantId !== 'local') {
    const staged = participants.find(
      (participant) => participant.id === activeStageSource.participantId && !participant.isLocal && participant.isScreenSharing
    );
    if (staged) return staged;
  }

  return participants.find((participant) => !participant.isLocal && participant.isScreenSharing) || null;
}

async function requestRemoteControl(context) {
  const target = getPrimaryRemoteControlTarget();
  if (!target) {
    showNotification('No remote screen share available for control.');
    return;
  }

  const localIdentity = getLocalVoiceIdentity();
  const targetUid = String(target.uid || target.id || '').trim();
  if (!targetUid || targetUid === localIdentity.uid) {
    showNotification('Choose another participant to request control.');
    return;
  }

  if (!window.firebaseSetDoc || !window.firebaseDb) {
    showNotification('Remote control requires Firebase sync.');
    return;
  }

  const requestId = `${localIdentity.uid}_${targetUid}_${Date.now().toString(36)}`;
  const requestRef = window.firebaseDoc(
    window.firebaseDb,
    'sessions',
    context.sessionId,
    'voiceChannels',
    context.channelId,
    'remoteControlRequests',
    requestId
  );

  const now = Date.now();
  await window.firebaseSetDoc(
    requestRef,
    {
      requestId,
      sessionId: context.sessionId,
      channelId: context.channelId,
      requesterUid: localIdentity.uid,
      requesterName: localIdentity.name,
      targetUid,
      targetName: target.name || targetUid,
      status: 'pending',
      reason: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(now + REMOTE_CONTROL_REQUEST_TTL_MS)
    },
    { merge: true }
  );

  remoteControlState.outgoingRequestId = requestId;
  remoteControlState.outgoingTargetUid = targetUid;
  remoteControlState.outgoingStatus = 'pending';
  setRemoteControlStatus(`Request sent to ${target.name || 'collaborator'}…`);
  updateRemoteControlButtonState();
  showNotification(`Remote-control request sent to ${target.name || 'collaborator'}.`);
}

async function handleRemoteControlAction() {
  if (!inVoiceCall) {
    showNotification('Join voice first to use remote control.');
    return;
  }

  const context = getActiveVoiceContext();
  if (!context) {
    showNotification('Select a session voice channel first.');
    return;
  }

  await ensureVoiceRealtimeSync();

  if (remoteControlState.activeRole === 'target') {
    await revokeRemoteControlGrant(context, 'target-manual-revoke');
    return;
  }

  if (remoteControlState.activeRole === 'controller') {
    await revokeRemoteControlGrant(context, 'controller-manual-stop');
    return;
  }

  if (remoteControlState.outgoingStatus === 'pending' && remoteControlState.outgoingRequestId) {
    await updateRemoteControlRequestStatus(context, remoteControlState.outgoingRequestId, 'revoked', 'requester-canceled');
    remoteControlState.outgoingRequestId = '';
    remoteControlState.outgoingTargetUid = '';
    remoteControlState.outgoingStatus = '';
    setRemoteControlStatus('');
    updateRemoteControlButtonState();
    return;
  }

  await requestRemoteControl(context);
}

// ============================================
// VOICE CONTROLS
// ============================================
function initVoiceControls() {
  // Join voice button
  document.getElementById('btnJoinVoice')?.addEventListener('click', joinVoice);
  
  // Call controls
  document.getElementById('btnMic')?.addEventListener('click', toggleMic);
  document.getElementById('btnCamera')?.addEventListener('click', toggleCamera);
  document.getElementById('btnScreenShare')?.addEventListener('click', toggleScreenShare);
  document.getElementById('btnRemoteControl')?.addEventListener('click', () => {
    handleRemoteControlAction().catch((error) => {
      console.warn('[Coverse] Remote-control action failed:', error);
      showNotification('Remote control action failed. Please try again.');
    });
  });
  document.getElementById('btnDisconnect')?.addEventListener('click', disconnectVoice);
  document.getElementById('callStage')?.addEventListener('click', cycleActiveStageSource);
  document.getElementById('btnStageStopShare')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isScreenSharing) {
      stopScreenShare();
    }
  });
  document.getElementById('btnStagePopout')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (activeStageSource?.participantId) {
      openParticipantPopout(activeStageSource.participantId, activeStageSource.sourceType || 'camera');
    }
  });
  document.getElementById('stageVolumeSlider')?.addEventListener('input', (event) => {
    event.stopPropagation();
    if (activeStageSource?.participantId) {
      const volume = parseInt(event.target.value, 10) / 100;
      setParticipantVolume(String(activeStageSource.participantId), volume);
    }
  });
  document.getElementById('stageVolumeSlider')?.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('stageVolumeControl')?.addEventListener('click', (e) => e.stopPropagation());
  
  // Device dropdowns
  document.getElementById('btnMicDropdown')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDeviceMenu('micMenu');
  });
  document.getElementById('btnCameraDropdown')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDeviceMenu('cameraMenu');
  });
  
  // Close menus on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.device-menu').forEach(m => m.classList.remove('open'));
    if (micLevelMeterRaf) { cancelAnimationFrame(micLevelMeterRaf); micLevelMeterRaf = null; }
  });

  updateRemoteControlButtonState();
}

async function joinVoice() {
  if (inVoiceCall) {
    showCallView();
    return;
  }
  if (isJoiningVoice) {
    return;
  }

  isJoiningVoice = true;
  console.log('[Coverse] Joining voice channel:', currentChannel);
  const joinButton = document.getElementById('btnJoinVoice');
  if (joinButton) joinButton.disabled = true;
  
  try {
    remoteAudioPlaybackNoticeShown = false;

    // Get microphone access
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 24,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (constraintError) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    
    inVoiceCall = true;
    setActiveVoiceContextFromSelection(currentSession?.id || lastSessionId, currentChannel);
    voiceStartTime = Date.now();
    startVoiceTimer();

    const localIdentity = getLocalVoiceIdentity();
    
    // Add self to voice users
    addVoiceUser('local', localIdentity.name, localIdentity.avatar);
    startMicActivityMonitor();
    
    showCallView();
    renderParticipants();
    updateRemoteAudioMuteState();

    clearVoicePreviewRealtimeSubscription({ preserveContext: true });
    await ensureVoiceRealtimeSync();
    await publishLocalVoiceState();

    // Subscribe to Firestore-based signaling so calls work without a WebSocket server
    const activeCtx = getActiveVoiceContext();
    if (activeCtx) subscribeToVoiceSignals(activeCtx);

    try {
      await connectVoiceSignaling();
    } catch (signalError) {
      console.warn('[Coverse] Voice signaling connection failed:', signalError);
    }
    
  } catch (err) {
    console.error('[Coverse] Failed to join voice:', err);
    alert('Could not access microphone. Please check permissions.');
  } finally {
    isJoiningVoice = false;
    if (joinButton) joinButton.disabled = false;
  }
}

function disconnectVoice() {
  console.log('[Coverse] Disconnecting from voice');

  const activeContext = getActiveVoiceContext();
  if (activeContext && remoteControlState.activeRole !== 'none') {
    revokeRemoteControlGrant(activeContext, 'voice-disconnect').catch(() => {});
  }

  disconnectVoiceSignaling({ preservePeers: false, silent: true });
  closeAllParticipantPopouts();
  remoteAudioPlaybackNoticeShown = false;
  
  // Stop all streams
  stopCameraPreviewCapture({ publishUpdate: false });
  stopScreenPreviewCapture({ publishUpdate: false });

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  
  inVoiceCall = false;
  isJoiningVoice = false;
  isScreenSharing = false;
  document.getElementById('btnStageStopShare')?.classList.add('hidden');
  isCameraOff = true;
  stageSelection = null;
  activeStageSource = null;
  
  stopVoiceTimer();
  stopMicActivityMonitor();
  removeVoiceUser('local');

  if (activeContext) {
    publishLocalVoiceState({
      isInVoice: false,
      isScreenSharing: false,
      isCameraOn: false,
      cameraPreview: '',
      cameraPreviewUpdatedAt: new Date(),
      screenPreview: '',
      screenPreviewUpdatedAt: new Date(),
      updatedAt: new Date()
    }).catch(() => {});
  }

  clearVoiceRealtimeSubscriptions({ resetParticipants: true, preserveContext: true });
  
  showVoicePreview(currentChannel);
  ensureVoicePreviewRealtimeSync().catch(() => {});
}

function toggleMic() {
  isMicMuted = !isMicMuted;
  
  // Update button state
  const btn = document.getElementById('btnMic');
  const panelBtn = document.getElementById('btnPanelMic');
  
  if (isMicMuted) {
    btn?.classList.add('muted');
    panelBtn?.classList.add('muted');
    btn.innerHTML = getMutedMicIconSvg();
    if (panelBtn) panelBtn.innerHTML = getMutedMicIconSvg();
  } else {
    btn?.classList.remove('muted');
    panelBtn?.classList.remove('muted');
    btn.innerHTML = getMicIconSvg();
    if (panelBtn) panelBtn.innerHTML = getMicIconSvg();
  }
  
  // Mute/unmute actual stream
  if (localStream) {
    localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
  }

  const local = participants.find((participant) => participant.isLocal);
  if (local && isMicMuted) {
    local.audioLevel = 0;
    syncParticipantAudioUi(local);
  }

  if (isMicMuted) {
    setLocalSpeakingState(false, true);
  } else if (inVoiceCall) {
    startMicActivityMonitor();
  }
  
  updateLocalParticipant();
  if (inVoiceCall) {
    syncLocalMediaToVoicePeers({ renegotiate: false }).catch(() => {});
    publishLocalVoiceState().catch(() => {});
  }
}

async function toggleCamera() {
  const btn = document.getElementById('btnCamera');
  
  if (isCameraOff) {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: { frameRate: { ideal: 30, max: 30 }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      
      // Add video track to local stream
      if (localStream) {
        videoStream.getVideoTracks().forEach(t => localStream.addTrack(t));
      } else {
        localStream = videoStream;
      }
      
      isCameraOff = false;
      btn?.classList.remove('muted');
      startCameraPreviewCapture();
      
    } catch (err) {
      console.error('[Coverse] Camera error:', err);
    }
  } else {
    // Stop camera
    stopCameraPreviewCapture({ publishUpdate: false });
    if (localStream) {
      localStream.getVideoTracks().forEach(t => {
        t.stop();
        localStream.removeTrack(t);
      });
    }
    
    isCameraOff = true;
    btn?.classList.add('muted');
  }
  
  updateLocalParticipant();
  if (inVoiceCall) {
    try {
      await syncLocalMediaToVoicePeers({ renegotiate: true });
    } catch (syncError) {
      console.warn('[Coverse] Failed to sync camera track to peers:', syncError);
    }
    publishLocalVoiceState().catch(() => {});
  }
}

function stopCameraPreviewCapture(options = {}) {
  const publishUpdate = options.publishUpdate !== false;

  if (cameraPreviewCaptureInterval) {
    clearInterval(cameraPreviewCaptureInterval);
    cameraPreviewCaptureInterval = null;
  }

  if (cameraPreviewVideoElement) {
    try {
      cameraPreviewVideoElement.pause?.();
    } catch (_error) {
      // no-op
    }
    cameraPreviewVideoElement.srcObject = null;
    cameraPreviewVideoElement = null;
  }

  cameraPreviewCanvasElement = null;

  if (latestCameraPreviewDataUrl) {
    latestCameraPreviewDataUrl = '';
    const localParticipant = participants.find((participant) => participant.isLocal);
    if (localParticipant) {
      localParticipant.cameraPreview = '';
    }

    if (publishUpdate && inVoiceCall) {
      publishLocalVoiceState({
        cameraPreview: '',
        cameraPreviewUpdatedAt: new Date()
      }).catch(() => {});
    }
  }
}

function captureCameraPreviewFrame() {
  if (isCameraOff || !cameraPreviewVideoElement || !cameraPreviewCanvasElement) return;
  if (cameraPreviewVideoElement.readyState < 2) return;

  const context2d = cameraPreviewCanvasElement.getContext('2d');
  if (!context2d) return;

  try {
    context2d.drawImage(
      cameraPreviewVideoElement,
      0,
      0,
      cameraPreviewCanvasElement.width,
      cameraPreviewCanvasElement.height
    );
  } catch (_error) {
    return;
  }

  let nextPreview = '';
  try {
    nextPreview = cameraPreviewCanvasElement.toDataURL('image/jpeg', 0.4);
  } catch (_error) {
    nextPreview = '';
  }

  if (!nextPreview || nextPreview === latestCameraPreviewDataUrl) return;

  latestCameraPreviewDataUrl = nextPreview;
  const localParticipant = participants.find((participant) => participant.isLocal);
  if (localParticipant) {
    localParticipant.cameraPreview = nextPreview;
  }

  if (inVoiceCall) {
    publishLocalVoiceState({
      cameraPreview: nextPreview,
      cameraPreviewUpdatedAt: new Date()
    }).catch(() => {});
  }

  renderParticipants();
}

function startCameraPreviewCapture() {
  stopCameraPreviewCapture({ publishUpdate: false });
  if (isCameraOff || !localStream || !hasVideoTracks(localStream)) return;

  cameraPreviewVideoElement = document.createElement('video');
  cameraPreviewVideoElement.muted = true;
  cameraPreviewVideoElement.playsInline = true;
  cameraPreviewVideoElement.srcObject = localStream;

  const trackSettings = localStream.getVideoTracks?.()[0]?.getSettings?.() || {};
  const width = Math.max(160, Math.min(320, Number(trackSettings.width) || 240));
  const height = Math.max(90, Math.min(240, Number(trackSettings.height) || 135));

  cameraPreviewCanvasElement = document.createElement('canvas');
  cameraPreviewCanvasElement.width = width;
  cameraPreviewCanvasElement.height = height;

  const playPromise = cameraPreviewVideoElement.play?.();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }

  captureCameraPreviewFrame();
  cameraPreviewCaptureInterval = setInterval(captureCameraPreviewFrame, CAMERA_PREVIEW_CAPTURE_INTERVAL_MS);
}

function stopScreenPreviewCapture(options = {}) {
  const publishUpdate = options.publishUpdate !== false;

  if (screenPreviewCaptureInterval) {
    clearInterval(screenPreviewCaptureInterval);
    screenPreviewCaptureInterval = null;
  }

  if (screenPreviewVideoElement) {
    try {
      screenPreviewVideoElement.pause?.();
    } catch (_error) {
      // no-op
    }
    screenPreviewVideoElement.srcObject = null;
    screenPreviewVideoElement = null;
  }

  screenPreviewCanvasElement = null;

  if (latestScreenPreviewDataUrl) {
    latestScreenPreviewDataUrl = '';
    const localParticipant = participants.find((participant) => participant.isLocal);
    if (localParticipant) {
      localParticipant.screenPreview = '';
    }

    if (publishUpdate && inVoiceCall) {
      publishLocalVoiceState({
        screenPreview: '',
        screenPreviewUpdatedAt: new Date()
      }).catch(() => {});
    }
  }
}

function captureScreenPreviewFrame() {
  if (!isScreenSharing || !screenPreviewVideoElement || !screenPreviewCanvasElement) return;
  if (screenPreviewVideoElement.readyState < 2) return;

  const context2d = screenPreviewCanvasElement.getContext('2d');
  if (!context2d) return;

  try {
    context2d.drawImage(
      screenPreviewVideoElement,
      0,
      0,
      screenPreviewCanvasElement.width,
      screenPreviewCanvasElement.height
    );
  } catch (_error) {
    return;
  }

  let nextPreview = '';
  try {
    nextPreview = screenPreviewCanvasElement.toDataURL('image/jpeg', 0.45);
  } catch (_error) {
    nextPreview = '';
  }

  if (!nextPreview || nextPreview === latestScreenPreviewDataUrl) return;

  latestScreenPreviewDataUrl = nextPreview;
  const localParticipant = participants.find((participant) => participant.isLocal);
  if (localParticipant) {
    localParticipant.screenPreview = nextPreview;
  }

  if (inVoiceCall) {
    publishLocalVoiceState({
      screenPreview: nextPreview,
      screenPreviewUpdatedAt: new Date()
    }).catch(() => {});
  }

  renderParticipants();
}

function startScreenPreviewCapture() {
  stopScreenPreviewCapture({ publishUpdate: false });
  if (!screenStream) return;

  screenPreviewVideoElement = document.createElement('video');
  screenPreviewVideoElement.muted = true;
  screenPreviewVideoElement.playsInline = true;
  screenPreviewVideoElement.srcObject = screenStream;

  const trackSettings = screenStream.getVideoTracks?.()[0]?.getSettings?.() || {};
  const width = Math.max(240, Math.min(640, Number(trackSettings.width) || 320));
  const height = Math.max(135, Math.min(360, Number(trackSettings.height) || 180));

  screenPreviewCanvasElement = document.createElement('canvas');
  screenPreviewCanvasElement.width = width;
  screenPreviewCanvasElement.height = height;

  const playPromise = screenPreviewVideoElement.play?.();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }

  captureScreenPreviewFrame();
  screenPreviewCaptureInterval = setInterval(captureScreenPreviewFrame, SCREEN_PREVIEW_CAPTURE_INTERVAL_MS);
}

async function toggleScreenShare() {
  const btn = document.getElementById('btnScreenShare');
  const stageStopBtn = document.getElementById('btnStageStopShare');
  
  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: { ideal: 30, max: 30 } },
        audio: false
      });
      
      isScreenSharing = true;
      btn?.classList.add('active');
      stageStopBtn?.classList.remove('hidden');
      startScreenPreviewCapture();
      
      // Update local participant
      const local = participants.find(p => p.isLocal);
      if (local) {
        local.isScreenSharing = true;
        local.screenPreview = latestScreenPreviewDataUrl;
      }
      renderParticipants();
      updateRemoteControlButtonState();
      if (inVoiceCall) {
        syncLocalMediaToVoicePeers({ renegotiate: true }).catch(() => {});
        publishLocalVoiceState({
          screenPreview: latestScreenPreviewDataUrl,
          screenPreviewUpdatedAt: new Date()
        }).catch(() => {});
      }
      
      // Handle stream end
      const displayTrack = screenStream.getVideoTracks?.()[0] || null;
      if (displayTrack) {
        displayTrack.onended = () => {
          stopScreenShare();
        };
      }
      
    } catch (err) {
      console.error('[Coverse] Screen share error:', err);
    }
  } else {
    stopScreenShare();
  }
}

function stopScreenShare() {
  stopScreenPreviewCapture();

  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  
  isScreenSharing = false;
  
  const btn = document.getElementById('btnScreenShare');
  btn?.classList.remove('active');
  document.getElementById('btnStageStopShare')?.classList.add('hidden');
  
  const local = participants.find(p => p.isLocal);
  if (local) {
    local.isScreenSharing = false;
    local.screenPreview = '';
  }

  if (stageSelection?.participantId === 'local' && stageSelection?.sourceType === 'screen') {
    stageSelection = null;
  }

  const context = getActiveVoiceContext();
  if (context && remoteControlState.activeRole === 'target') {
    revokeRemoteControlGrant(context, 'target-stopped-sharing').catch(() => {});
  }

  renderParticipants();
  updateRemoteControlButtonState();
  if (inVoiceCall) {
    syncLocalMediaToVoicePeers({ renegotiate: true }).catch(() => {});
    publishLocalVoiceState({
      screenPreview: '',
      screenPreviewUpdatedAt: new Date()
    }).catch(() => {});
  }
}

function toggleDeafen() {
  isDeafened = !isDeafened;
  const btn = document.getElementById('btnPanelDeafen');
  btn?.classList.toggle('muted', isDeafened);

  updateRemoteAudioMuteState();
  renderParticipants();
}

function toggleDeviceMenu(menuId) {
  const menu = document.getElementById(menuId);
  const wasOpen = menu?.classList.contains('open');
  
  document.querySelectorAll('.device-menu').forEach(m => m.classList.remove('open'));
  // Stop level meter when any menu closes
  if (micLevelMeterRaf) { cancelAnimationFrame(micLevelMeterRaf); micLevelMeterRaf = null; }
  
  if (menu && !wasOpen) {
    populateDeviceMenu(menuId);
    menu.classList.add('open');
  }
}

async function populateDeviceMenu(menuId) {
  try {
    // Prompt for permission if needed so device labels show up
    await navigator.mediaDevices.getUserMedia({ audio: menuId === 'micMenu', video: menuId === 'cameraMenu' }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});

    const devices = await navigator.mediaDevices.enumerateDevices();
    const kind = menuId === 'micMenu' ? 'audioinput' : 'videoinput';
    const filtered = devices.filter(d => d.kind === kind);

    // Determine the currently active device ID
    let activeDeviceId = null;
    if (menuId === 'micMenu') {
      activeDeviceId = localStream?.getAudioTracks()?.[0]?.getSettings?.()?.deviceId || null;
    } else {
      activeDeviceId = localStream?.getVideoTracks()?.[0]?.getSettings?.()?.deviceId || null;
    }

    const list = document.getElementById(menuId === 'micMenu' ? 'micDeviceList' : 'cameraDeviceList');
    if (!list) return;

    list.innerHTML = filtered.map((d, i) => {
      const isSelected = activeDeviceId ? d.deviceId === activeDeviceId : i === 0;
      return `
        <div class="device-menu-item${isSelected ? ' selected' : ''}" data-device-id="${d.deviceId}" data-menu="${menuId}">
          <svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>
          <span>${d.label || `${kind === 'audioinput' ? 'Microphone' : 'Camera'} ${i + 1}`}</span>
        </div>
      `;
    }).join('');

    // Wire up device selection
    list.querySelectorAll('.device-menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        const deviceId = item.dataset.deviceId;
        if (menuId === 'micMenu') {
          switchMicDevice(deviceId).catch(() => {});
        } else {
          switchCameraDevice(deviceId).catch(() => {});
        }
        list.querySelectorAll('.device-menu-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
      });
    });

    // For mic menu: add live level meter + output volume control
    if (menuId === 'micMenu') {
      const menu = document.getElementById('micMenu');
      if (menu && !menu.querySelector('.mic-level-section')) {
        const levelSection = document.createElement('div');
        levelSection.className = 'mic-level-section';
        levelSection.innerHTML = `
          <div class="mic-level-label">Input Level</div>
          <div class="mic-level-bar-track"><div class="mic-level-bar-fill" id="micLevelBarFill"></div></div>
        `;
        const title = menu.querySelector('.device-menu-title');
        if (title) {
          title.insertAdjacentElement('afterend', levelSection);
        }

        const divider = document.createElement('div');
        divider.className = 'device-menu-divider';
        menu.appendChild(divider);

        const outputSection = document.createElement('div');
        outputSection.className = 'output-volume-section';
        outputSection.innerHTML = `
          <div class="output-volume-label">Output Volume</div>
          <div class="output-volume-row">
            <svg viewBox="0 0 256 256"><path d="M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81Z"/></svg>
            <input type="range" class="output-volume-slider" id="outputVolumeSlider" min="0" max="100" value="${Math.round(masterOutputVolume * 100)}" title="Output volume">
          </div>
        `;
        outputSection.addEventListener('click', (e) => e.stopPropagation());
        outputSection.querySelector('#outputVolumeSlider')?.addEventListener('input', (e) => {
          setMasterOutputVolume(parseFloat(e.target.value) / 100);
        });
        menu.appendChild(outputSection);
      }

      // Always (re)start the level meter when the mic menu opens
      startMicLevelMeter();
    }

  } catch (err) {
    console.error('[Coverse] Device enumeration error:', err);
  }
}

let micLevelMeterRaf = null;

function setMasterOutputVolume(vol) {
  masterOutputVolume = Math.max(0, Math.min(1, vol));
  remoteAudioElements.forEach((el) => {
    const uid = el.dataset.remoteUid;
    // Respect per-participant overrides; master scales on top
    const perUser = participantVolumes.has(uid) ? participantVolumes.get(uid) : 1.0;
    el.volume = Math.max(0, Math.min(1, perUser * masterOutputVolume));
  });
}

function startMicLevelMeter() {
  if (micLevelMeterRaf) cancelAnimationFrame(micLevelMeterRaf);

  const tick = () => {
    const fill = document.getElementById('micLevelBarFill');
    if (!fill) { micLevelMeterRaf = null; return; }

    let level = 0;
    if (micMonitorAnalyser && micMonitorData) {
      micMonitorAnalyser.getByteTimeDomainData(micMonitorData);
      let sum = 0;
      for (let i = 0; i < micMonitorData.length; i++) {
        const c = (micMonitorData[i] - 128) / 128;
        sum += c * c;
      }
      level = Math.sqrt(sum / micMonitorData.length);
    }

    const pct = Math.min(100, Math.round(level * 400));
    fill.style.width = pct + '%';
    fill.classList.toggle('high', pct > 80);

    micLevelMeterRaf = requestAnimationFrame(tick);
  };

  micLevelMeterRaf = requestAnimationFrame(tick);
}

async function switchMicDevice(deviceId) {
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const newTrack = newStream.getAudioTracks()[0];
    if (!newTrack) return;

    if (localStream) {
      // Replace old audio track(s) in localStream
      localStream.getAudioTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
      localStream.addTrack(newTrack);
    } else {
      localStream = newStream;
    }

    if (inVoiceCall) {
      stopMicActivityMonitor();
      startMicActivityMonitor();
      await syncLocalMediaToVoicePeers({ renegotiate: false });
    }
  } catch (err) {
    console.warn('[Coverse] Mic switch failed:', err);
    showNotification('Could not switch microphone.', { level: 'warning' });
  }
}

async function switchCameraDevice(deviceId) {
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, frameRate: { ideal: 30, max: 30 }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    const newTrack = newStream.getVideoTracks()[0];
    if (!newTrack) return;

    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
      localStream.addTrack(newTrack);
    } else {
      localStream = newStream;
    }

    isCameraOff = false;
    document.getElementById('btnCamera')?.classList.remove('muted');
    startCameraPreviewCapture();

    if (inVoiceCall) {
      await syncLocalMediaToVoicePeers({ renegotiate: true });
    }
  } catch (err) {
    console.warn('[Coverse] Camera switch failed:', err);
    showNotification('Could not switch camera.', { level: 'warning' });
  }
}

// ============================================
// VOICE TIMER
// ============================================
function startVoiceTimer() {
  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }

  const updateTimer = () => {
    const timerEl = document.getElementById('voiceTimer');
    if (!timerEl) return;
  
    const elapsed = Date.now() - voiceStartTime;
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);

    timerEl.textContent = hours > 0 
      ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  updateTimer();
  voiceTimerInterval = setInterval(updateTimer, 1000);
}

function stopVoiceTimer() {
  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }
  const timerEl = document.getElementById('voiceTimer');
  if (timerEl) timerEl.textContent = '';
}

function setLocalSpeakingState(isSpeaking, forceRender = false) {
  const nextValue = Boolean(isSpeaking && !isMicMuted && inVoiceCall);
  if (!forceRender && localSpeakingState === nextValue) return;

  localSpeakingState = nextValue;

  const local = participants.find((participant) => participant.isLocal);
  if (local) {
    local.isSpeaking = nextValue;
    syncParticipantAudioUi(local);
  }

  const voiceUser = document.querySelector('.voice-user[data-user="local"]');
  voiceUser?.classList.toggle('speaking', nextValue);

  if (forceRender) {
    renderParticipants();
  }
}

function stopMicActivityMonitor() {
  if (micMonitorRaf) {
    cancelAnimationFrame(micMonitorRaf);
    micMonitorRaf = null;
  }

  try {
    micMonitorSource?.disconnect?.();
  } catch (_error) {
    // no-op
  }
  micMonitorSource = null;
  micMonitorAnalyser = null;
  micMonitorData = null;

  if (micMonitorContext) {
    try {
      micMonitorContext.close?.();
    } catch (_error) {
      // no-op
    }
  }
  micMonitorContext = null;
  localSpeakingHoldUntil = 0;
  setLocalSpeakingState(false, true);
}

function startMicActivityMonitor() {
  if (!localStream || !inVoiceCall) return;

  const audioTracks = localStream.getAudioTracks?.() || [];
  if (!audioTracks.length) return;

  stopMicActivityMonitor();

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    micMonitorContext = new AudioContextClass();
    micMonitorAnalyser = micMonitorContext.createAnalyser();
    micMonitorAnalyser.fftSize = 2048;
    micMonitorAnalyser.smoothingTimeConstant = 0.85;
    micMonitorData = new Uint8Array(micMonitorAnalyser.fftSize);
    micMonitorSource = micMonitorContext.createMediaStreamSource(localStream);
    micMonitorSource.connect(micMonitorAnalyser);

    const monitor = () => {
      if (!micMonitorAnalyser || !micMonitorData) return;
      micMonitorAnalyser.getByteTimeDomainData(micMonitorData);

      let sum = 0;
      for (let i = 0; i < micMonitorData.length; i += 1) {
        const centered = (micMonitorData[i] - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / micMonitorData.length);
      const now = performance.now();
      const threshold = LOCAL_SPEAKING_THRESHOLD;
      const level = isMicMuted ? 0 : normalizeAudioLevel((rms - 0.008) * 28);

      if (rms > threshold) {
        localSpeakingHoldUntil = now + 180;
      }

      const speakingNow = now < localSpeakingHoldUntil;
      const localParticipant = participants.find((participant) => participant.isLocal);
      if (localParticipant) {
        localParticipant.audioLevel = level;
        syncParticipantAudioUi(localParticipant);
      }

      setLocalSpeakingState(speakingNow, false);
      micMonitorRaf = requestAnimationFrame(monitor);
    };

    if (micMonitorContext.state === 'suspended') {
      micMonitorContext.resume?.().catch(() => {});
    }

    micMonitorRaf = requestAnimationFrame(monitor);
  } catch (error) {
    console.warn('[Coverse] Mic activity monitor unavailable:', error);
    stopMicActivityMonitor();
  }
}

// ============================================
// VOICE USERS (in channel list)
// ============================================
function renderVoiceUsersList() {
  const container = document.getElementById('voiceUsersMain');
  if (!container) return;

  const visibleParticipants = participants
    .filter((participant) => participant && (!participant.isLocal || inVoiceCall))
    .sort((a, b) => {
      if (Boolean(a.isLocal) !== Boolean(b.isLocal)) {
        return a.isLocal ? -1 : 1;
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  if (!visibleParticipants.length) {
    container.innerHTML = '<div class="voice-users-empty">No one is in voice</div>';
    return;
  }

  container.innerHTML = visibleParticipants.map((participant) => {
    const userId = String(participant.id || participant.uid || '').trim();
    const displayName = String(participant.name || 'User').trim() || 'User';
    const avatarValue = String(participant.avatar || '').trim();
    const avatarMarkup = /^https?:\/\//i.test(avatarValue)
      ? `<img src="${escapeHtml(avatarValue)}" alt="">`
      : `<span>${escapeHtml(avatarValue || getInitials(displayName || 'U'))}</span>`;
    const iconMarkup = [
      participant.isScreenSharing
        ? '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Z"/></svg>'
        : '',
      participant.isMuted
        ? '<svg class="muted" viewBox="0 0 256 256" aria-hidden="true"><path d="M214.92,205.62a8,8,0,1,1-11.84,10.76L53,51.42A8,8,0,0,1,65,40.83L95.16,74A48,48,0,0,1,176,112v16a48,48,0,0,1-13.08,33L214.92,205.62ZM80,112a8,8,0,0,0-16,0,64,64,0,0,0,44.68,61V208a8,8,0,0,0,16,0V173a63.71,63.71,0,0,0,23-11.65l-11.6-12.76A47.7,47.7,0,0,1,120,152,48.05,48.05,0,0,1,80,112Z"/></svg>'
        : ''
    ].filter(Boolean).join('');
    const levelScale = Math.max(0.04, normalizeAudioLevel(participant.audioLevel)).toFixed(3);

    return `
      <div class="voice-user${participant.isSpeaking ? ' speaking' : ''}" data-user="${escapeHtml(userId || 'participant')}">
        <div class="voice-user-avatar">${avatarMarkup}</div>
        <span class="voice-user-name">${escapeHtml(displayName)}</span>
        <div class="voice-user-icons">${iconMarkup}</div>
        <div class="voice-user-level" aria-hidden="true">
          <span class="voice-user-level-fill" style="transform: scaleX(${levelScale});"></span>
        </div>
      </div>
    `;
  }).join('');
}

function addVoiceUser(id, name, avatar) {
  const participantId = String(id || '').trim();
  if (participantId) {
    const existing = participants.find((participant) => participant.id === participantId || participant.uid === participantId);
    if (existing) {
      if (name) existing.name = String(name);
      if (avatar) existing.avatar = String(avatar);
    }
  }

  renderVoiceUsersList();
}

function removeVoiceUser(_id) {
  renderVoiceUsersList();
}

function hasVideoTracks(stream) {
  return !!(stream && stream.getVideoTracks && stream.getVideoTracks().length);
}

function getParticipantCameraStream(participant) {
  if (!participant) return null;
  if (participant.isLocal) {
    return hasVideoTracks(localStream) ? localStream : null;
  }
  return hasVideoTracks(participant.stream) ? participant.stream : null;
}

function getParticipantCameraPreview(participant) {
  if (!participant) return '';
  if (participant.isLocal) {
    return String(latestCameraPreviewDataUrl || '').trim();
  }
  return String(participant.cameraPreview || '').trim();
}

function getParticipantScreenStream(participant) {
  if (!participant) return null;
  if (participant.isLocal) {
    return hasVideoTracks(screenStream) ? screenStream : null;
  }
  return hasVideoTracks(participant.screenStream) ? participant.screenStream : null;
}

function getParticipantScreenPreview(participant) {
  if (!participant) return '';
  return String(participant.screenPreview || '').trim();
}

function getDefaultStageSource() {
  const sharingParticipant = participants.find((participant) => (
    participant.isScreenSharing && (getParticipantScreenStream(participant) || getParticipantScreenPreview(participant))
  ));
  if (sharingParticipant) {
    return {
      participantId: sharingParticipant.id,
      participantName: sharingParticipant.name,
      sourceType: 'screen',
      stream: getParticipantScreenStream(sharingParticipant),
      previewImage: getParticipantScreenPreview(sharingParticipant)
    };
  }

  const cameraParticipant = participants.find((participant) => (
    participant.isCameraOn && (getParticipantCameraStream(participant) || getParticipantCameraPreview(participant))
  ));
  if (!cameraParticipant) return null;

  return {
    participantId: cameraParticipant.id,
    participantName: cameraParticipant.name,
    sourceType: 'camera',
    stream: getParticipantCameraStream(cameraParticipant),
    previewImage: getParticipantCameraPreview(cameraParticipant)
  };
}

function resolveActiveStageSource() {
  if (stageSelection) {
    const participant = participants.find((item) => item.id === stageSelection.participantId);
    if (participant) {
      const cameraStream = getParticipantCameraStream(participant);
      const cameraPreview = getParticipantCameraPreview(participant);
      const shareStream = getParticipantScreenStream(participant);
      const sharePreview = getParticipantScreenPreview(participant);

      if (stageSelection.sourceType === 'camera' && (cameraStream || cameraPreview)) {
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'camera',
          stream: cameraStream,
          previewImage: cameraPreview
        };
      }
      if (stageSelection.sourceType === 'screen' && (shareStream || sharePreview)) {
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'screen',
          stream: shareStream,
          previewImage: sharePreview
        };
      }

      if (cameraStream || cameraPreview) {
        stageSelection = { participantId: participant.id, sourceType: 'camera' };
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'camera',
          stream: cameraStream,
          previewImage: cameraPreview
        };
      }
      if (shareStream || sharePreview) {
        stageSelection = { participantId: participant.id, sourceType: 'screen' };
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'screen',
          stream: shareStream,
          previewImage: sharePreview
        };
      }
    }

    stageSelection = null;
  }

  return getDefaultStageSource();
}

function renderCallStage() {
  const stageVideo = document.getElementById('stageVideo');
  const stageImage = document.getElementById('stageImage');
  const placeholder = document.getElementById('stagePlaceholder');
  const stageLabelName = document.getElementById('stageLabelName');
  const stageControls = document.getElementById('stageControls');
  const stageVolumeControl = document.getElementById('stageVolumeControl');
  const stageVolumeSlider = document.getElementById('stageVolumeSlider');
  const btnStagePopout = document.getElementById('btnStagePopout');
  if (!stageVideo || !placeholder) return;

  // Route remote audio only through dedicated hidden <audio> elements.
  stageVideo.muted = true;

  activeStageSource = resolveActiveStageSource();

  const hasActiveSource = !!(activeStageSource?.stream || activeStageSource?.previewImage);

  // Update stage controls visibility
  if (stageControls) {
    if (hasActiveSource) {
      stageControls.classList.remove('hidden');
      // Show volume only for non-local participants
      const stageParticipant = participants.find(p => p.id === activeStageSource.participantId);
      if (stageVolumeControl) {
        if (stageParticipant && !stageParticipant.isLocal) {
          stageVolumeControl.classList.remove('hidden');
          if (stageVolumeSlider) {
            const savedVol = participantVolumes.get(String(stageParticipant.id || stageParticipant.uid));
            stageVolumeSlider.value = String(Math.round((savedVol ?? 1) * 100));
          }
        } else {
          stageVolumeControl.classList.add('hidden');
        }
      }
    } else {
      stageControls.classList.add('hidden');
    }
  }

  if (activeStageSource?.stream) {
    if (stageVideo.srcObject !== activeStageSource.stream) {
      stageVideo.srcObject = activeStageSource.stream;
    }
    stageVideo.classList.remove('hidden');
    if (stageImage) {
      stageImage.src = '';
      stageImage.classList.add('hidden');
    }
    placeholder.classList.add('hidden');
    if (stageLabelName) {
      const suffix = activeStageSource.sourceType === 'screen' ? 'Screen' : 'Camera';
      stageLabelName.textContent = `${activeStageSource.participantName} ${suffix}`;
    }
    const playPromise = stageVideo.play?.();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    return;
  }

  if (activeStageSource?.previewImage && stageImage) {
    stageVideo.srcObject = null;
    stageVideo.classList.add('hidden');
    stageImage.src = activeStageSource.previewImage;
    stageImage.classList.remove('hidden');
    placeholder.classList.add('hidden');
    if (stageLabelName) {
      const suffix = activeStageSource.sourceType === 'camera' ? 'Camera' : 'Screen';
      stageLabelName.textContent = `${activeStageSource.participantName} ${suffix}`;
    }
    return;
  }

  stageVideo.srcObject = null;
  stageVideo.classList.add('hidden');
  if (stageImage) {
    stageImage.src = '';
    stageImage.classList.add('hidden');
  }
  placeholder.classList.remove('hidden');
  if (stageLabelName) stageLabelName.textContent = 'Screen Share';
}

function handleParticipantTileClick(participantId) {
  const participant = participants.find((item) => item.id === participantId);
  if (!participant) return;

  const hasCamera = !!(getParticipantCameraStream(participant) || getParticipantCameraPreview(participant));
  const hasScreen = !!(getParticipantScreenStream(participant) || getParticipantScreenPreview(participant));
  if (!hasCamera && !hasScreen) return;

  const isSameParticipant = stageSelection?.participantId === participantId;
  if (!isSameParticipant) {
    stageSelection = {
      participantId,
      sourceType: hasCamera ? 'camera' : 'screen'
    };
  } else if (stageSelection.sourceType === 'camera' && hasScreen) {
    stageSelection = { participantId, sourceType: 'screen' };
  } else if (stageSelection.sourceType === 'screen' && hasCamera) {
    stageSelection = { participantId, sourceType: 'camera' };
  } else {
    stageSelection = null;
  }

  renderParticipants();
}

function cycleActiveStageSource() {
  if (!activeStageSource) return;
  const participant = participants.find((item) => item.id === activeStageSource.participantId);
  if (!participant) return;

  const hasCamera = !!(getParticipantCameraStream(participant) || getParticipantCameraPreview(participant));
  const hasScreen = !!(getParticipantScreenStream(participant) || getParticipantScreenPreview(participant));
  if (hasCamera && hasScreen) {
    stageSelection = {
      participantId: participant.id,
      sourceType: activeStageSource.sourceType === 'screen' ? 'camera' : 'screen'
    };
    renderParticipants();
  }
}

function getParticipantById(participantId) {
  const normalizedId = String(participantId || '').trim();
  if (!normalizedId) return null;
  return participants.find((participant) => String(participant.id || participant.uid || '') === normalizedId) || null;
}

function resolveParticipantSource(participant, sourceType = 'camera') {
  if (!participant) {
    return {
      stream: null,
      previewImage: '',
      label: 'Camera'
    };
  }

  if (sourceType === 'screen') {
    return {
      stream: getParticipantScreenStream(participant),
      previewImage: getParticipantScreenPreview(participant),
      label: 'Screen'
    };
  }

  return {
    stream: getParticipantCameraStream(participant),
    previewImage: getParticipantCameraPreview(participant),
    label: 'Camera'
  };
}

function closeParticipantPopout(popoutKey) {
  const key = String(popoutKey || '').trim();
  if (!key) return;

  const entry = participantPopoutWindows.get(key);
  if (!entry) return;

  participantPopoutWindows.delete(key);

  try {
    entry.window?.close?.();
  } catch (_error) {
    // no-op
  }
}

function closeAllParticipantPopouts() {
  Array.from(participantPopoutWindows.keys()).forEach((key) => closeParticipantPopout(key));
}

function syncParticipantPopout(entry) {
  if (!entry) return;
  if (!entry.window || entry.window.closed) {
    participantPopoutWindows.delete(entry.key);
    return;
  }

  const participant = getParticipantById(entry.participantId);
  if (!participant) {
    closeParticipantPopout(entry.key);
    return;
  }

  const source = resolveParticipantSource(participant, entry.sourceType);
  const documentRef = entry.window.document;
  const videoEl = documentRef.getElementById('popoutVideo');
  const imageEl = documentRef.getElementById('popoutImage');
  const placeholderEl = documentRef.getElementById('popoutPlaceholder');
  const labelEl = documentRef.getElementById('popoutLabel');

  if (!videoEl || !imageEl || !placeholderEl || !labelEl) return;

  const displayName = String(participant.name || 'Participant').trim() || 'Participant';
  labelEl.textContent = `${displayName} ${source.label}`;

  if (source.stream) {
    if (videoEl.srcObject !== source.stream) {
      videoEl.srcObject = source.stream;
    }

    videoEl.muted = true;
    videoEl.classList.remove('hidden');
    imageEl.classList.add('hidden');
    imageEl.src = '';
    placeholderEl.classList.add('hidden');

    const playPromise = videoEl.play?.();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    return;
  }

  videoEl.srcObject = null;
  videoEl.classList.add('hidden');

  if (source.previewImage) {
    imageEl.src = source.previewImage;
    imageEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
    return;
  }

  imageEl.src = '';
  imageEl.classList.add('hidden');
  placeholderEl.textContent = String(participant.avatar || getInitials(displayName || 'U'));
  placeholderEl.classList.remove('hidden');
}

function syncParticipantPopouts() {
  participantPopoutWindows.forEach((entry) => syncParticipantPopout(entry));
}

function openParticipantPopout(participantId, sourceType = 'camera') {
  const participant = getParticipantById(participantId);
  if (!participant) return;

  const normalizedSourceType = sourceType === 'screen' ? 'screen' : 'camera';
  const key = `${String(participant.id || participant.uid)}::${normalizedSourceType}`;
  const existing = participantPopoutWindows.get(key);

  if (existing && existing.window && !existing.window.closed) {
    existing.window.focus?.();
    syncParticipantPopout(existing);
    return;
  }

  const popoutWindow = window.open(
    '',
    `coverse-popout-${String(participant.id || participant.uid)}-${normalizedSourceType}`,
    'width=420,height=260,resizable=yes,scrollbars=no'
  );

  if (!popoutWindow) {
    showNotification('Allow pop-up windows to open participant popouts.', { level: 'warning' });
    return;
  }

  const participantName = String(participant.name || 'Participant').trim() || 'Participant';
  const label = `${participantName} ${normalizedSourceType === 'screen' ? 'Screen' : 'Camera'}`;
  const fallbackAvatar = String(participant.avatar || getInitials(participantName || 'U'));

  popoutWindow.document.open();
  popoutWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(label)} - Coverse</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #0f172a;
        color: #f8fafc;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      }
      .popout-root {
        position: fixed;
        inset: 0;
        background: #020617;
      }
      video,
      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center center;
        display: block;
        margin: 0;
        background: #020617;
      }
      .hidden {
        display: none !important;
      }
      .placeholder {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: clamp(2rem, 7vw, 4rem);
        font-weight: 700;
        color: #cbd5e1;
      }
      .label {
        position: absolute;
        left: 12px;
        bottom: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(2, 6, 23, 0.76);
        font-size: 12px;
        letter-spacing: 0.03em;
        backdrop-filter: blur(4px);
      }
      .close-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 999px;
        background: rgba(2, 6, 23, 0.78);
        color: #f8fafc;
        cursor: pointer;
      }
      .pin-btn {
        position: absolute;
        top: 10px;
        right: 46px;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 999px;
        background: rgba(2, 6, 23, 0.78);
        color: #94a3b8;
        cursor: pointer;
        font-size: 14px;
        display: grid;
        place-items: center;
      }
      .pin-btn.active {
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.18);
      }
    </style>
  </head>
  <body>
    <div class="popout-root">
      <video id="popoutVideo" autoplay playsinline muted></video>
      <img id="popoutImage" class="hidden" alt="Participant preview">
      <div class="placeholder hidden" id="popoutPlaceholder">${escapeHtml(fallbackAvatar)}</div>
      <div class="label" id="popoutLabel">${escapeHtml(label)}</div>
      <button class="pin-btn" id="popoutPin" type="button" aria-label="Always on top" title="Always on top">📌</button>
      <button class="close-btn" id="popoutClose" type="button" aria-label="Close">x</button>
    </div>
  </body>
</html>`);
  popoutWindow.document.close();

  const entry = {
    key,
    participantId: String(participant.id || participant.uid),
    sourceType: normalizedSourceType,
    window: popoutWindow
  };

  participantPopoutWindows.set(key, entry);

  popoutWindow.addEventListener('beforeunload', () => {
    participantPopoutWindows.delete(key);
  });

  popoutWindow.document.getElementById('popoutClose')?.addEventListener('click', () => {
    closeParticipantPopout(key);
  });

  // Always-on-top pin button
  const pinBtn = popoutWindow.document.getElementById('popoutPin');
  let isPinned = false;
  pinBtn?.addEventListener('click', async () => {
    isPinned = !isPinned;
    pinBtn.classList.toggle('active', isPinned);
    if (window.coverse?.setPopoutAlwaysOnTop) {
      try {
        const popoutTitle = popoutWindow.document.title;
        await window.coverse.setPopoutAlwaysOnTop(isPinned, popoutTitle);
      } catch (_error) {
        // Fallback: no-op if IPC not available
      }
    }
  });

  syncParticipantPopout(entry);
}

// ============================================
// PARTICIPANTS
// ============================================
function renderParticipants() {
  const container = document.getElementById('callParticipants');
  if (!container) return;
  activeStageSource = resolveActiveStageSource();

  container.innerHTML = participants.map((participant) => {
    const participantId = String(participant.id || participant.uid || '').trim() || 'participant';
    const hasCameraSource = Boolean(getParticipantCameraStream(participant) || getParticipantCameraPreview(participant));
    const hasScreenSource = Boolean(getParticipantScreenStream(participant) || getParticipantScreenPreview(participant));
    const levelScale = Math.max(0.04, normalizeAudioLevel(participant.audioLevel)).toFixed(3);

    return `
      <div class="participant-tile${participant.isSpeaking ? ' speaking' : ''}${activeStageSource?.participantId === participant.id ? ' selected' : ''}" data-id="${escapeHtml(participantId)}">
        ${participant.isScreenSharing ? '<span class="tile-live-badge">LIVE</span>' : ''}
        <video autoplay playsinline muted></video>
        <div class="participant-tile-placeholder">
          <img class="participant-tile-screen-preview hidden" alt="Screen preview">
          <div class="participant-tile-avatar">${escapeHtml(String(participant.avatar || getInitials(participant.name || 'U')))}</div>
        </div>
        <div class="participant-audio-level" aria-hidden="true">
          <span class="participant-audio-level-fill" style="transform: scaleX(${levelScale});"></span>
        </div>
        <div class="participant-tile-info">
          <div class="participant-tile-name">
            ${participant.isScreenSharing ? '<svg viewBox="0 0 256 256"><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Z"/></svg>' : ''}
            <span>${escapeHtml(String(participant.name || 'User'))}</span>
          </div>
          <div class="participant-tile-actions">
            ${!participant.isLocal ? `
              <div class="participant-volume-control" title="Volume">
                <svg class="volume-icon" viewBox="0 0 256 256"><path d="M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81Z"/></svg>
                <input type="range" class="participant-volume-slider" min="0" max="100" value="100" data-participant-id="${escapeHtml(participantId)}" title="Adjust volume">
              </div>
            ` : ''}
            ${hasCameraSource ? `
              <button class="participant-popout-btn" type="button" data-action="popout" data-source-type="camera" data-participant-id="${escapeHtml(participantId)}" title="Pop out camera">
                <svg viewBox="0 0 256 256"><path d="M216,48H152a8,8,0,0,0,0,16h44.69L136,124.69,107.31,96,72,131.31a8,8,0,0,0,11.31,11.38L107.31,118.7,136,147.31,208,75.31V120a8,8,0,0,0,16,0V56A8,8,0,0,0,216,48ZM208,208H48V48h56a8,8,0,0,0,0-16H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152a8,8,0,0,0-16,0Z"/></svg>
              </button>
            ` : ''}
            ${hasScreenSource ? `
              <button class="participant-popout-btn" type="button" data-action="popout" data-source-type="screen" data-participant-id="${escapeHtml(participantId)}" title="Pop out screen">
                <svg viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V176a16,16,0,0,0,16,16h72v16H88a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16H144V192h72a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,136H40V56H216V176Z"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.participant-tile').forEach((tileEl) => {
    tileEl.addEventListener('click', () => {
      handleParticipantTileClick(tileEl.dataset.id);
    });
  });

  container.querySelectorAll('.participant-popout-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openParticipantPopout(button.dataset.participantId, button.dataset.sourceType);
    });
  });

  // Volume sliders
  container.querySelectorAll('.participant-volume-slider').forEach((slider) => {
    slider.addEventListener('input', (event) => {
      event.stopPropagation();
      const pid = slider.dataset.participantId;
      const volume = parseInt(slider.value, 10) / 100;
      setParticipantVolume(pid, volume);
    });
    slider.addEventListener('click', (e) => e.stopPropagation());
  });

  bindParticipantStreams();
  renderCallStage();
  renderVoiceUsersList();
  syncAllParticipantAudioUi();
  syncParticipantPopouts();
  refreshVoicePreviewStatus();
  updateRemoteControlButtonState();
}

function bindParticipantStreams() {
  const tilesById = new Map(
    Array.from(document.querySelectorAll('.participant-tile')).map((tileEl) => [String(tileEl.dataset.id || ''), tileEl])
  );

  participants.forEach((participant) => {
    const participantId = String(participant.id || participant.uid || '').trim();
    const tile = tilesById.get(participantId);
    const videoEl = tile?.querySelector('video');
    const placeholderEl = tile?.querySelector('.participant-tile-placeholder');
    const previewEl = tile?.querySelector('.participant-tile-screen-preview');
    const avatarEl = tile?.querySelector('.participant-tile-avatar');
    if (!videoEl) return;

    const cameraStream = getParticipantCameraStream(participant);
    const cameraPreview = getParticipantCameraPreview(participant);
    const shareStream = getParticipantScreenStream(participant);
    const sharePreview = getParticipantScreenPreview(participant);
    const isActiveStageParticipant = activeStageSource?.participantId === participant.id;

    let stream = null;
    let previewImage = '';
    let previewIsScreen = false;

    videoEl.muted = true;

    if (isActiveStageParticipant) {
      if (activeStageSource?.sourceType === 'screen') {
        // Keep face visible in tiles while the screen is on stage.
        stream = cameraStream || null;
        previewImage = stream ? '' : cameraPreview;
        if (!stream && !previewImage) {
          stream = shareStream || null;
          previewImage = stream ? '' : sharePreview;
          previewIsScreen = true;
        }
      } else {
        stream = cameraStream || null;
        previewImage = stream ? '' : cameraPreview;
        if (!stream && !previewImage) {
          stream = shareStream || null;
          previewImage = stream ? '' : sharePreview;
          previewIsScreen = true;
        }
      }
    } else if (cameraStream) {
      stream = cameraStream;
    } else if (participant.isCameraOn && cameraPreview) {
      previewImage = cameraPreview;
    } else if (participant.isScreenSharing && shareStream) {
      stream = shareStream;
      previewIsScreen = true;
    } else if (participant.isScreenSharing && sharePreview) {
      previewImage = sharePreview;
      previewIsScreen = true;
    } else if (shareStream) {
      stream = shareStream;
      previewIsScreen = true;
    } else if (sharePreview) {
      previewImage = sharePreview;
      previewIsScreen = true;
    }

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.classList.remove('hidden');
      placeholderEl?.classList.add('hidden');
      placeholderEl?.classList.remove('participant-tile-placeholder--screen');
      if (previewEl) {
        previewEl.src = '';
        previewEl.classList.add('hidden');
      }
      avatarEl?.classList.remove('hidden');
      const playPromise = videoEl.play?.();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else if (previewImage) {
      videoEl.srcObject = null;
      videoEl.classList.add('hidden');
      if (previewEl) {
        previewEl.src = previewImage;
        previewEl.classList.remove('hidden');
      }
      placeholderEl?.classList.remove('hidden');
      placeholderEl?.classList.toggle('participant-tile-placeholder--screen', previewIsScreen);
      avatarEl?.classList.add('hidden');
    } else {
      videoEl.srcObject = null;
      videoEl.classList.add('hidden');
      if (previewEl) {
        previewEl.src = '';
        previewEl.classList.add('hidden');
      }
      placeholderEl?.classList.remove('participant-tile-placeholder--screen');
      avatarEl?.classList.remove('hidden');
      placeholderEl?.classList.remove('hidden');
    }
  });
}

function updateLocalParticipant() {
  const localIdentity = getLocalVoiceIdentity();
  const local = participants.find(p => p.isLocal);
  if (local) {
    local.uid = localIdentity.uid;
    local.name = localIdentity.name;
    local.avatar = localIdentity.avatar;
    local.isMuted = isMicMuted;
    local.isCameraOn = !isCameraOff;
    local.isScreenSharing = isScreenSharing;
    local.cameraPreview = latestCameraPreviewDataUrl;
    local.screenPreview = latestScreenPreviewDataUrl;
  }
  renderParticipants();
}

// ============================================
// CHAT
// ============================================
// STATE – channel chat
// ============================================
let channelMessagesUnsubscribe = null;
let channelMessagesCache = new Map(); // channelKey → messages array

function getChannelMessagesKey() {
  if (!currentSession?.id || !currentChannel) return '';
  return `${currentSession.id}::${currentChannel}`;
}

// ============================================
function initChat() {
  const input = document.getElementById('chatInput');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      sendChannelMessage(input.value.trim());
      input.value = '';
    }
  });
  
  document.getElementById('btnAttachFile')?.addEventListener('click', attachFile);
}

async function sendChannelMessage(text) {
  if (!text) return;
  if (!currentSession?.id || !currentChannel) {
    showNotification('Select a channel to send messages.', { level: 'warning' });
    return;
  }

  const container = document.getElementById('chatMessages');
  const senderName = String(currentUser?.displayName || currentUser?.email || 'You').trim() || 'You';
  const senderAvatar = getInitials(senderName);
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Optimistic render
  if (container) {
    const msg = document.createElement('div');
    msg.className = 'chat-message';
    msg.innerHTML = `
      <div class="chat-message-avatar">${escapeHtml(senderAvatar)}</div>
      <div class="chat-message-content">
        <div class="chat-message-header">
          <span class="chat-message-author">${escapeHtml(senderName)}</span>
          <span class="chat-message-time">Today at ${time}</span>
        </div>
        <div class="chat-message-text">${escapeHtml(text)}</div>
      </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  // Persist to Firebase
  if (currentUser && window.firebaseDb && window.firebaseAddDoc && window.firebaseCollection) {
    try {
      const db = window.firebaseDb;
      const messagesRef = window.firebaseCollection(db, 'sessions', currentSession.id, 'channels', currentChannel, 'messages');
      await window.firebaseAddDoc(messagesRef, {
        text,
        senderUid: currentUser.uid,
        senderName,
        senderAvatar,
        createdAt: window.firebaseServerTimestamp ? window.firebaseServerTimestamp() : new Date(),
        sessionId: currentSession.id,
        channelId: currentChannel
      });
    } catch (error) {
      console.warn('[Coverse] Failed to save message:', error);
      showNotification('Message may not have been saved.', { level: 'warning' });
    }
  }
}

function subscribeToChannelMessages() {
  // Unsubscribe the existing listener
  if (typeof channelMessagesUnsubscribe === 'function') {
    channelMessagesUnsubscribe();
    channelMessagesUnsubscribe = null;
  }

  if (!currentSession?.id || !currentChannel) return;
  if (!currentUser || !window.firebaseDb) return;
  if (!window.firebaseCollection || !window.firebaseQuery || !window.firebaseOrderBy || !window.firebaseOnSnapshot) return;

  const db = window.firebaseDb;
  const messagesRef = window.firebaseCollection(db, 'sessions', currentSession.id, 'channels', currentChannel, 'messages');
  const q = window.firebaseQuery(messagesRef, window.firebaseOrderBy('createdAt', 'asc'), window.firebaseLimit(200));

  channelMessagesUnsubscribe = window.firebaseOnSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      messages.push({ id: docSnap.id, ...data });
    });

    const key = getChannelMessagesKey();
    if (key) channelMessagesCache.set(key, messages);

    renderChannelMessages(messages);
  }, (error) => {
    console.warn('[Coverse] Channel messages listener error:', error);
  });
}

function renderChannelMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  if (!messages || !messages.length) {
    container.innerHTML = '<div class="chat-empty">No messages yet. Say something!</div>';
    return;
  }

  container.innerHTML = messages.map((msg) => {
    const name = String(msg.senderName || 'User').trim() || 'User';
    const avatar = String(msg.senderAvatar || getInitials(name));
    const text = String(msg.text || '');
    let time = '';
    if (msg.createdAt) {
      const d = typeof msg.createdAt.toDate === 'function' ? msg.createdAt.toDate() : new Date(msg.createdAt);
      time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const today = new Date();
      if (d.toDateString() !== today.toDateString()) {
        time = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
      }
    }
    return `
      <div class="chat-message">
        <div class="chat-message-avatar">${escapeHtml(avatar)}</div>
        <div class="chat-message-content">
          <div class="chat-message-header">
            <span class="chat-message-author">${escapeHtml(name)}</span>
            <span class="chat-message-time">${escapeHtml(time)}</span>
          </div>
          <div class="chat-message-text">${escapeHtml(text)}</div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function attachFile() {
  // Create hidden file input
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Show file in chat
      const container = document.getElementById('chatMessages');
      if (!container) return;
      
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const size = formatFileSize(file.size);
      
      const msg = document.createElement('div');
      msg.className = 'chat-message';
      msg.innerHTML = `
        <div class="chat-message-avatar">Y</div>
        <div class="chat-message-content">
          <div class="chat-message-header">
            <span class="chat-message-author">You</span>
            <span class="chat-message-time">Today at ${time}</span>
          </div>
          <div class="chat-file">
            <div class="chat-file-icon">
              <svg viewBox="0 0 256 256"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/></svg>
            </div>
            <div class="chat-file-info">
              <div class="chat-file-name">${escapeHtml(file.name)}</div>
              <div class="chat-file-size">${size}</div>
            </div>
          </div>
        </div>
      `;
      container.appendChild(msg);
      container.scrollTop = container.scrollHeight;
    }
  };
  input.click();
}

// ============================================
// MODALS
// ============================================
function initModals() {
  // Session invite modal
  document.getElementById('btnCloseSessionInvite')?.addEventListener('click', () => {
    closeModal('sessionInviteModal');
  });

  document.getElementById('btnCopySessionInviteCode')?.addEventListener('click', () => {
    copyCurrentSessionInvite({ codeOnly: true }).catch((error) => {
      console.error('[Coverse] Failed to copy invite code:', error);
      showNotification('Could not copy invite code.');
    });
  });

  document.getElementById('btnCopySessionInviteText')?.addEventListener('click', () => {
    copyCurrentSessionInvite({ codeOnly: false }).catch((error) => {
      console.error('[Coverse] Failed to copy invite message:', error);
      showNotification('Could not copy invite message.');
    });
  });

  document.getElementById('sessionInviteFriendFilter')?.addEventListener('input', () => {
    renderSessionInviteFriendList();
  });

  document.getElementById('sessionInviteUserSearch')?.addEventListener('input', (event) => {
    if (sessionInviteSearchTimer) {
      clearTimeout(sessionInviteSearchTimer);
      sessionInviteSearchTimer = null;
    }

    const query = String(event.target?.value || '').trim();
    const resultsEl = document.getElementById('sessionInviteUserResults');

    if (!query) {
      renderSessionInviteUserResults([]);
      return;
    }

    if (query.length < 2) {
      if (resultsEl) {
        resultsEl.innerHTML = '<div class="session-invite-empty">Type at least 2 characters to search users.</div>';
      }
      return;
    }

    if (resultsEl) {
      resultsEl.innerHTML = '<div class="session-invite-empty">Searching...</div>';
    }

    sessionInviteSearchTimer = setTimeout(async () => {
      const results = await searchUsers(query);
      renderSessionInviteUserResults(results);
    }, 250);
  });

  const handleInviteSendClick = (event) => {
    const button = event.target?.closest?.('.session-invite-send-btn');
    if (!button) return;

    const targetUid = String(button.dataset.userId || '').trim();
    const source = String(button.dataset.source || '').trim() || 'modal';
    if (!targetUid) return;

    handleSessionInviteToUser(targetUid, source).catch((error) => {
      console.error('[Coverse] Failed to send invite from modal:', error);
      showNotification('Could not send invite. Please try again.');
    });
  };

  document.getElementById('sessionInviteFriendsList')?.addEventListener('click', handleInviteSendClick);
  document.getElementById('sessionInviteUserResults')?.addEventListener('click', handleInviteSendClick);

  // Create session modal
  document.getElementById('btnCancelSession')?.addEventListener('click', () => {
    const nameInput = document.getElementById('newSessionName');
    const joinInput = document.getElementById('joinSessionCode');
    if (nameInput) nameInput.value = '';
    if (joinInput) joinInput.value = '';
    closeModal('createSessionModal');
  });
  
  document.getElementById('btnCreateSession')?.addEventListener('click', async () => {
    const name = document.getElementById('newSessionName').value.trim();
    if (name) {
      await createSession(name);
    }
  });

  document.getElementById('btnJoinSession')?.addEventListener('click', async () => {
    const code = document.getElementById('joinSessionCode')?.value?.trim() || '';
    if (!code) {
      alert('Enter an invite code.');
      return;
    }
    await joinSessionByInvite(code);
  });
  
  // Add friend modal
  document.getElementById('btnCancelAddFriend')?.addEventListener('click', () => {
    closeAddFriendModal();
  });
  
  // Friend search input
  let searchTimeout;
  document.getElementById('friendSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      document.getElementById('btnSendFriendRequest').disabled = true;
      if (addFriendModalMode === 'dm') {
        renderAddFriendModalDefaultResults();
      } else {
        document.getElementById('friendSearchResults').innerHTML = '';
      }
      return;
    }
    
    document.getElementById('friendSearchResults').innerHTML = '<div class="search-loading">Searching...</div>';
    
    searchTimeout = setTimeout(async () => {
      const results = await searchUsers(query);
      renderSearchResults(results);
    }, 300);
  });
  
  document.getElementById('btnSendFriendRequest')?.addEventListener('click', async () => {
    const selected = document.querySelector('.search-result-item.selected');
    if (!selected) return;

    const targetUid = String(selected.dataset.userId || '').trim();
    if (!targetUid) return;

    if (addFriendModalMode === 'dm') {
      const conversation = await openDMWithUser(targetUid, { openView: true });
      if (conversation) {
        closeAddFriendModal();
      }
      return;
    }

    await sendFriendRequest(targetUid);
  });
  
  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (overlay.id === 'addFriendModal') {
          closeAddFriendModal();
        } else {
          closeModal(overlay.id);
        }
      }
    });
  });
}

function renderSearchResults(results) {
  const container = document.getElementById('friendSearchResults');
  if (!container) return;

  document.getElementById('btnSendFriendRequest').disabled = true;
  
  if (results.length === 0) {
    container.innerHTML = '<div class="search-no-results">No users found</div>';
    return;
  }
  
  let html = '';
  results.forEach(user => {
    const avatar = user.avatarUrl 
      ? `<img src="${user.avatarUrl}" alt="">` 
      : getInitials(user.displayName || 'U');
    
    html += `
      <div class="search-result-item" data-user-id="${user.uid || user.id}" onclick="selectSearchResult(this)">
        <div class="search-result-avatar">
          ${typeof avatar === 'string' && avatar.startsWith('<') ? avatar : avatar}
        </div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(user.displayName || 'User')}</div>
          <div class="search-result-email">${escapeHtml(user.email || '')}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Make this global for onclick
window.selectSearchResult = function(el) {
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.classList.remove('selected');
  });
  el.classList.add('selected');
  document.getElementById('btnSendFriendRequest').disabled = false;
};

// Make friend actions global for onclick
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.openDMWithUser = openDMWithUser;
window.startVoiceCallWith = startVoiceCallWith;
window.openConversation = openConversation;
window.inviteFriendToCurrentSession = inviteFriendToCurrentSession;
window.inviteDmUserToCurrentSession = inviteDmUserToCurrentSession;

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
  
  // Focus the input if it's the add friend modal
  if (modalId === 'addFriendModal') {
    setTimeout(() => {
      document.getElementById('friendSearchInput')?.focus();
    }, 100);
  }

  if (modalId === 'sessionInviteModal') {
    setTimeout(() => {
      document.getElementById('sessionInviteFriendFilter')?.focus();
    }, 100);
  }
}

function closeModal(modalId) {
  if (modalId === 'sessionInviteModal') {
    resetSessionInviteSearch();
  }

  document.getElementById(modalId)?.classList.remove('active');
}

async function createSession(name) {
  const cleanName = (name || '').trim();
  if (!cleanName) return;

  const icon = cleanName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  const id = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
  const inviteCode = generateInviteCode();

  if (currentUser && window.firebaseDb) {
    try {
      const db = window.firebaseDb;
      const sessionRef = window.firebaseDoc(db, 'sessions', id);
      await window.firebaseSetDoc(sessionRef, {
        id,
        name: cleanName,
        icon,
        ownerUid: currentUser.uid,
        memberIds: [currentUser.uid],
        inviteCode,
        textChannels: DEFAULT_TEXT_CHANNELS.slice(),
        voiceChannels: DEFAULT_VOICE_CHANNELS.slice(),
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });

      await persistSessionInviteCodeRecord(id, inviteCode, {
        sessionName: cleanName,
        ownerUid: currentUser.uid
      });

      await loadUserSessions();
      selectSession(id);
      closeModal('createSessionModal');
      alert(`Session created. Invite code: ${inviteCode}`);
      return;
    } catch (error) {
      console.error('[Coverse] Failed to create session in cloud, using local fallback:', error);
    }
  }

  sessions.push({
    id,
    name: cleanName,
    icon,
    inviteCode,
    textChannels: DEFAULT_TEXT_CHANNELS.slice(),
    voiceChannels: DEFAULT_VOICE_CHANNELS.slice()
  });
  saveSessionsToStorage();
  renderSessionBar();
  selectSession(id);
  closeModal('createSessionModal');
  alert(`Session created (local). Invite code: ${inviteCode}`);
}

async function joinSessionByInvite(code, options = {}) {
  const inviteCode = normalizeInviteCode(code);
  const suppressAlert = options.suppressAlert === true;
  const showSuccessNotification = options.showSuccessNotification !== false;

  const reportFailure = (message) => {
    const text = String(message || 'Could not join this session.').trim();
    showNotification(text, { level: 'warning' });
    if (!suppressAlert) {
      alert(text);
    }
  };

  if (!inviteCode) {
    reportFailure('Enter an invite code first.');
    return false;
  }

  if (!currentUser || !window.firebaseDb) {
    reportFailure('Sign in first to join sessions by invite code.');
    return false;
  }

  try {
    const db = window.firebaseDb;
    let sessionId = '';

    if (window.firebaseDoc && window.firebaseGetDoc) {
      const inviteDoc = await window.firebaseGetDoc(
        window.firebaseDoc(db, 'sessionInviteCodes', inviteCode)
      );

      if (inviteDoc.exists()) {
        const inviteData = inviteDoc.data() || {};
        sessionId = String(inviteData.sessionId || '').trim();
      }
    }

    if (!sessionId && window.firebaseCollection && window.firebaseQuery && window.firebaseWhere && window.firebaseGetDocs) {
      try {
        const invitesRef = window.firebaseCollection(db, 'sessionInvites');
        const inviteQuery = window.firebaseQuery(
          invitesRef,
          window.firebaseWhere('inviteCode', '==', inviteCode),
          window.firebaseWhere('toUid', '==', currentUser.uid)
        );
        const invitesSnapshot = await window.firebaseGetDocs(inviteQuery);
        if (!invitesSnapshot.empty) {
          const inviteData = invitesSnapshot.docs[0]?.data() || {};
          sessionId = String(inviteData.sessionId || '').trim();
        }
      } catch (_error) {
        // Secondary invite fallback can fail if no index is available.
      }
    }

    if (!sessionId && window.firebaseCollection && window.firebaseQuery && window.firebaseWhere && window.firebaseGetDocs) {
      try {
        const messagesRef = window.firebaseCollection(db, 'messages');
        const messageQuery = window.firebaseQuery(
          messagesRef,
          window.firebaseWhere('toUid', '==', currentUser.uid),
          window.firebaseWhere('inviteCode', '==', inviteCode)
        );
        const messageSnapshot = await window.firebaseGetDocs(messageQuery);
        if (!messageSnapshot.empty) {
          const messageData = messageSnapshot.docs[0]?.data() || {};
          sessionId = String(messageData.inviteSessionId || '').trim();
        }
      } catch (_error) {
        // Message fallback can fail if no index is available.
      }
    }

    if (!sessionId && window.firebaseCollection && window.firebaseQuery && window.firebaseWhere && window.firebaseGetDocs) {
      try {
        const sessionsRef = window.firebaseCollection(db, 'sessions');
        const q = window.firebaseQuery(
          sessionsRef,
          window.firebaseWhere('inviteCode', '==', inviteCode)
        );
        const snapshot = await window.firebaseGetDocs(q);
        if (!snapshot.empty) {
          sessionId = String(snapshot.docs[0]?.id || '').trim();
        }
      } catch (_error) {
        // Legacy fallback query can fail under strict rules.
      }
    }

    if (!sessionId) {
      reportFailure('Invite code not found.');
      return false;
    }

    if (!window.firebaseUpdateDoc || !window.firebaseArrayUnion) {
      throw new Error('Firebase update helpers are unavailable for invite join.');
    }

    await window.firebaseUpdateDoc(
      window.firebaseDoc(db, 'sessions', sessionId),
      {
        memberIds: window.firebaseArrayUnion(currentUser.uid),
        inviteCode,
        updatedAt: new Date()
      }
    );

    await loadUserSessions();
    selectSession(sessionId);
    closeModal('createSessionModal');

    const joinInput = document.getElementById('joinSessionCode');
    if (joinInput) {
      joinInput.value = '';
    }

    if (showSuccessNotification) {
      showNotification('Joined session successfully.', { level: 'success' });
    }

    return true;
  } catch (error) {
    console.error('[Coverse] Failed to join session:', error);
    reportFailure('Could not join session from invite code.');
    return false;
  }
}

function openSettings() {
  console.log('[Coverse] Opening settings');
  // TODO: Implement settings modal
}

// ============================================
// MEMBERS PANEL
// ============================================
let membersPanelOpen = false;

function toggleMembersPanel() {
  if (membersPanelOpen) {
    closeMembersPanel();
  } else {
    openMembersPanel();
  }
}

function openMembersPanel() {
  membersPanelOpen = true;
  const panel = document.getElementById('membersPanel');
  if (panel) panel.classList.remove('hidden');
  renderMembersPanel();
}

function closeMembersPanel() {
  membersPanelOpen = false;
  const panel = document.getElementById('membersPanel');
  if (panel) panel.classList.add('hidden');
}

async function renderMembersPanel() {
  const listEl = document.getElementById('membersPanelList');
  if (!listEl) return;

  if (!currentSession) {
    listEl.innerHTML = '<div class="members-panel-empty">No session selected</div>';
    return;
  }

  listEl.innerHTML = '<div class="members-panel-empty">Loading members...</div>';

  // Get session data from Firestore to read memberIds
  let memberIds = [];
  if (currentUser && window.firebaseDb && window.firebaseDoc && window.firebaseGetDoc) {
    try {
      const sessionDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'sessions', currentSession.id));
      if (sessionDoc.exists()) {
        const data = sessionDoc.data() || {};
        memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
      }
    } catch (error) {
      console.warn('[Coverse] Failed to load session members:', error);
    }
  }

  if (!memberIds.length) {
    listEl.innerHTML = '<div class="members-panel-empty">No members found</div>';
    return;
  }

  // Fetch profiles for each member
  const members = [];
  for (const uid of memberIds) {
    try {
      const userDoc = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDb, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data() || {};
        members.push({
          uid,
          name: String(data.displayName || data.username || data.email || uid).trim(),
          avatar: data.photoURL || '',
          isOwner: currentSession.ownerUid === uid,
          role: (currentSession.roles && currentSession.roles[uid]) || (currentSession.ownerUid === uid ? 'owner' : 'member')
        });
      } else {
        members.push({ uid, name: uid, avatar: '', isOwner: false, role: 'member' });
      }
    } catch (_error) {
      members.push({ uid, name: uid, avatar: '', isOwner: false, role: 'member' });
    }
  }

  // Sort: owner first, then admins, then members
  const roleOrder = { owner: 0, admin: 1, member: 2 };
  members.sort((a, b) => (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2));

  const isOwner = currentSession.ownerUid === currentUser?.uid;

  listEl.innerHTML = members.map((member) => {
    const initials = getInitials(member.name || 'U');
    const avatarHtml = member.avatar
      ? `<img class="member-avatar-img" src="${escapeHtml(member.avatar)}" alt="">`
      : `<span class="member-avatar-letter">${escapeHtml(initials)}</span>`;
    const roleBadge = member.role === 'owner' ? '<span class="member-role-badge owner">Owner</span>'
      : member.role === 'admin' ? '<span class="member-role-badge admin">Admin</span>'
      : '';
    const isCurrentUser = member.uid === currentUser?.uid;

    // Owner can change roles for non-owner members
    const roleControls = (isOwner && !isCurrentUser && member.role !== 'owner') ? `
      <div class="member-role-actions">
        <button class="member-role-btn" data-uid="${escapeHtml(member.uid)}" data-action="toggle-role" title="Toggle Admin">${member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</button>
      </div>
    ` : '';

    return `
      <div class="member-item${isCurrentUser ? ' is-self' : ''}" data-uid="${escapeHtml(member.uid)}">
        <div class="member-avatar">${avatarHtml}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(member.name)}${isCurrentUser ? ' <span class="member-you">(you)</span>' : ''}</div>
          ${roleBadge}
        </div>
        ${roleControls}
      </div>
    `;
  }).join('');

  // Bind role toggle buttons
  listEl.querySelectorAll('.member-role-btn[data-action="toggle-role"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const uid = btn.dataset.uid;
      await toggleMemberRole(uid);
    });
  });
}

async function toggleMemberRole(uid) {
  if (!currentSession || !currentUser || currentSession.ownerUid !== currentUser.uid) return;

  const roles = currentSession.roles || {};
  const currentRole = roles[uid] || 'member';
  const newRole = currentRole === 'admin' ? 'member' : 'admin';
  roles[uid] = newRole;
  currentSession.roles = roles;

  // Persist to Firebase
  if (window.firebaseDb && window.firebaseUpdateDoc && window.firebaseDoc) {
    try {
      await window.firebaseUpdateDoc(window.firebaseDoc(window.firebaseDb, 'sessions', currentSession.id), {
        roles,
        updatedAt: new Date()
      });
    } catch (error) {
      console.warn('[Coverse] Failed to update role:', error);
      showNotification('Could not update role.', { level: 'error' });
      return;
    }
  }

  saveSessionsToStorage();
  renderMembersPanel();
  showNotification(`Role updated to ${newRole}.`, { level: 'success' });
}

// ============================================
// UTILITIES
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================
// EXPORTS (for Electron IPC)
// ============================================
if (typeof window !== 'undefined') {
  window.coverse = {
    ...(window.coverse || {}),
    joinVoice,
    disconnectVoice,
    selectSession,
    selectChannel,
    sendChannelMessage,
    requestRemoteControl: handleRemoteControlAction
  };
}
