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
let currentFriendsTab = 'online';
let lastSessionId = null;

const SESSION_CACHE_KEY = 'coverse_sessions_cache';
const LAST_SESSION_KEY = 'coverse_last_session';
const LIBRARY_CACHE_KEY = 'coverse_library';
const LIBRARY_REMOTE_KEY = 'coverse_remote_library';
const LIBRARY_SITE_KEY = 'coverse_site_library';
const LIBRARY_BLOB_DB = 'coverse_library_blobs';
const LIBRARY_BLOB_STORE = 'files';
const API_BASE_KEY = 'coverse_api_base';
const DEFAULT_API_BASE = 'https://coversehq.com';
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

// Media state
let localStream = null;
let screenStream = null;
let isMicMuted = false;
let isCameraOff = true;
let isScreenSharing = false;
let isDeafened = false;
let stageSelection = null;
let activeStageSource = null;

// Participants
let participants = [
  { id: 'local', name: 'You', avatar: 'Y', isLocal: true, isMuted: false, isCameraOn: false, isScreenSharing: false, isSpeaking: false }
];

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
  initLibrary();
  initUpdaterUi();
  
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
window.addEventListener('coverse-user-ready', (e) => {
  console.log('[Coverse] User ready:', e.detail);
  currentUser = e.detail;
  updateUserPanel();
  loadUserData();
});

// ============================================
// USER PANEL & PROFILE
// ============================================
function initUserPanel() {
  // Settings button opens user menu
  document.getElementById('btnPanelSettings')?.addEventListener('click', openSettingsMenu);
  
  // Clicking on user info could open profile
  document.querySelector('.user-panel-info')?.addEventListener('click', openUserProfile);
}

function initUpdaterUi() {
  const updateWidget = document.getElementById('updateStatusWidget');
  const updateTitle = document.getElementById('updateStatusTitle');
  const updateText = document.getElementById('updateStatusText');
  const updateProgress = document.getElementById('updateStatusProgress');
  const btnCheck = document.getElementById('btnCheckUpdatesNow');
  const btnInstall = document.getElementById('btnInstallUpdate');
  const btnLater = document.getElementById('btnUpdateLater');

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

  btnCheck?.addEventListener('click', async () => {
    btnCheck.disabled = true;
    try {
      await window.coverse.checkForUpdates();
    } finally {
      setTimeout(() => {
        btnCheck.disabled = false;
      }, 1200);
    }
  });

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

  showWidget(true);
  setText('Updater', 'Ready. Click Check Now to look for updates.');
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
    await hydrateLibraryMedia();
    renderLibrary();
    
    console.log('[Coverse] User data loaded');
  } catch (error) {
    console.error('[Coverse] Error loading user data:', error);
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
          textChannels: ['general', 'files'],
          voiceChannels: ['Main', 'Studio']
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
        textChannels: data.textChannels || ['general', 'files'],
        voiceChannels: data.voiceChannels || ['Main', 'Studio'],
        inviteCode: data.inviteCode || '',
        ownerUid: data.ownerUid || ''
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
          textChannels: ['general', 'files'],
          voiceChannels: ['Main', 'Studio']
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
      textChannels: session.textChannels || ['general', 'files'],
      voiceChannels: session.voiceChannels || ['Main', 'Studio'],
      inviteCode: session.inviteCode || '',
      ownerUid: session.ownerUid || ''
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

async function ensureSessionInviteCode(session) {
  if (!session) return '';

  if (session.inviteCode) {
    return session.inviteCode;
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
  }

  return inviteCode;
}

async function copyCurrentSessionInvite() {
  const targetSession = resolveInviteTargetSession();
  if (!targetSession) {
    alert('Select a session first to copy an invite code.');
    return;
  }

  const inviteCode = await ensureSessionInviteCode(targetSession);
  if (!inviteCode) {
    alert('Unable to generate invite code.');
    return;
  }

  const inviteText = `Join my Coverse session "${targetSession.name || 'Session'}" with invite code: ${inviteCode}`;
  let copied = false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(inviteText);
      copied = true;
    } catch (error) {
      console.warn('[Coverse] Clipboard write failed:', error);
    }
  }

  if (!copied) {
    const fallbackText = `Invite code: ${inviteCode}`;
    try {
      if (window.prompt) {
        window.prompt('Copy this invite code:', inviteCode);
      } else {
        alert(fallbackText);
      }
    } catch (error) {
      alert(fallbackText);
    }
  }

  alert('Session invite copied.');
}

async function inviteFriendToCurrentSession(friendUid) {
  if (!friendUid) return;

  const targetSession = resolveInviteTargetSession();
  if (!targetSession) {
    alert('Create a session first, then invite your friend.');
    return;
  }

  const inviteCode = await ensureSessionInviteCode(targetSession);
  if (!inviteCode) {
    alert('Could not prepare a session invite.');
    return;
  }

  const friend = userFriends.find((f) => (f.uid || f.id) === friendUid);
  const friendName = friend?.displayName || 'your friend';

  if (!currentUser || !window.firebaseDb) {
    alert(`Share this invite code with ${friendName}: ${inviteCode}`);
    return;
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

    alert(`Invite sent to ${friendName}.`);
  } catch (error) {
    console.error('[Coverse] Failed to send session invite:', error);
    alert(`Could not send invite. Share this code with ${friendName}: ${inviteCode}`);
  }
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
  } catch (error) {
    console.log('[Coverse] Friend requests not found');
    pendingFriendRequests = [];
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
    const avatar = otherUser.avatarUrl 
      ? `<img src="${otherUser.avatarUrl}" alt="">` 
      : `<span>${getInitials(otherUser.displayName || 'U')}</span>`;
    const isOnline = otherUser.status === 'online';
    
    html += `
      <div class="dm-item${currentConversationId === conv.id ? ' active' : ''}" data-conversation-id="${conv.id}" data-user-id="${otherUser.uid || ''}" onclick="openConversation('${conv.id}')">
        <div class="dm-item-avatar">
          ${avatar}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">${escapeHtml(otherUser.displayName || 'User')}</div>
          ${conv.lastMessage ? `<div class="dm-item-preview">${escapeHtml(conv.lastMessage)}</div>` : ''}
        </div>
        ${conv.unreadCount ? `<div class="dm-item-badge">${conv.unreadCount}</div>` : ''}
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
    const avatar = isMe 
      ? (currentUser.avatarUrl ? `<img src="${currentUser.avatarUrl}" alt="">` : getInitials(currentUser.displayName || 'Y'))
      : (currentDMUser?.avatarUrl ? `<img src="${currentDMUser.avatarUrl}" alt="">` : getInitials(currentDMUser?.displayName || 'U'));
    
    const time = formatMessageTime(msg.timestamp);
    
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
          <div class="dm-message-text">${escapeHtml(msg.text || msg.content || '')}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
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
  if (!toUid || !currentUser || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    
    // Check if already following
    const followsRef = window.firebaseCollection(db, 'follows');
    const existingQuery = window.firebaseQuery(
      followsRef,
      window.firebaseWhere('follower', '==', currentUser.uid),
      window.firebaseWhere('following', '==', toUid)
    );
    const existing = await window.firebaseGetDocs(existingQuery);
    
    if (!existing.empty) {
      alert('You are already following this user!');
      return;
    }
    
    // Create follow relationship (matches web app structure)
    await window.firebaseAddDoc(followsRef, {
      follower: currentUser.uid,
      following: toUid,
      createdAt: new Date()
    });
    
    console.log('[Coverse] Now following:', toUid);
    
    // Clear and close modal
    document.getElementById('friendSearchInput').value = '';
    document.getElementById('friendSearchResults').innerHTML = '';
    closeModal('addFriendModal');
    
    // Reload friends list
    await loadFriends();
    
    alert('Connection added!');
    
  } catch (error) {
    console.error('[Coverse] Error adding connection:', error);
    alert('Failed to add connection: ' + (error.message || 'Unknown error'));
  }
}

async function acceptFriendRequest(requestId, fromUid) {
  // With the follows model, accepting a request means following them back
  if (!fromUid || !window.firebaseDb) return;
  
  try {
    const db = window.firebaseDb;
    
    // Follow them back (creates mutual connection)
    const followsRef = window.firebaseCollection(db, 'follows');
    await window.firebaseAddDoc(followsRef, {
      follower: currentUser.uid,
      following: fromUid,
      createdAt: new Date()
    });
    
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
    await loadFriends();
    await loadPendingRequests();
    renderFriendsList();
    
    console.log('[Coverse] Connection accepted - now mutual friends with:', fromUid);
    
  } catch (error) {
    console.error('[Coverse] Error accepting connection:', error);
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
    
  } catch (error) {
    console.error('[Coverse] Error declining friend request:', error);
  }
}

// Flag to prevent duplicate conversation creation
let creatingConversationWith = null;

async function openDMWithUser(userId) {
  if (!userId || !window.firebaseDb) return;
  
  // Prevent double-click creating duplicates
  if (creatingConversationWith === userId) {
    console.log('[Coverse] Already creating conversation with this user...');
    return;
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
      alert('Failed to start conversation: ' + (error.message || 'Unknown error'));
      creatingConversationWith = null; // Clear flag on error
      return;
    }
    creatingConversationWith = null; // Clear flag after success
  }
  
  openConversation(conv.id);
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
  // TODO: Implement P2P voice call
  console.log('[Coverse] Starting voice call with:', userId);
  alert('Voice calling coming soon!');
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
  const projectExtensions = ['.als', '.flp', '.ptx', '.logic', '.rpp', '.cpr', '.zip', '.rar', '.7z'];
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
  if (section === 'downloaded') return 'Downloaded';
  return 'Local';
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
  userLibrary = Array.from(localById.values());
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
    name: data.name || data.fileName || data.title || 'Site file',
    size: Number(data.size || data.fileSize || 0),
    type,
    section: 'site',
    uploadedAt: uploadedAt || new Date(),
    mimeType,
    storagePath: data.storagePath || data.path || '',
    downloadURL: data.downloadURL || data.url || data.fileUrl || '',
    thumbnailURL: data.thumbnailURL || data.thumbnailUrl || data.thumbUrl || data.previewUrl || data.imageUrl || '',
    genre: data.genre || '',
    bpm: Number(data.bpm || 0),
    key: data.key || '',
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
    Accept: 'application/json'
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

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'GET',
        headers
      });

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        return { available: false, items: [] };
      }

      const payload = await response.json().catch(() => ({}));
      const rawItems = extractLibraryArray(payload);
      const normalized = rawItems
        .filter((item) => item && !item.isDeleted && !item.deletedAt)
        .map((item, index) => {
          const itemId = item?.id || item?._id || item?.fileId || `api_${index}`;
          return normalizeSiteLibraryItem(itemId, item);
        })
        .filter((item) => !item.isDeleted);

      return { available: true, items: normalized };
    } catch (error) {
      continue;
    }
  }

  return { available: false, items: [] };
}

async function loadSiteLibraryItems() {
  setLibraryStatus('Refreshing Site Library...', 'info', true);
  let cachedItems = [];
  let apiItems = [];
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
  if (apiResult.available) {
    apiItems = Array.isArray(apiResult.items) ? apiResult.items : [];
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
  userLibrary = Array.from(localById.values());
  setLibraryStatus(`Site Library refreshed (${siteItems.length}; cache ${cachedItems.length}, API ${apiItems.length}, cloud ${firestoreItems.length}).`, 'success');
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
  const file = userLibrary.find(f => f.id === fileId);
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
  const showPush = section !== 'site';
  const showLocal = section === 'site';
  const showCloud = section === 'site';
  const showBottomPlayer = normalizeLibraryType(file?.type, file?.mimeType || inferMimeTypeFromName(file?.name || ''), file?.name || '') === 'audio';

  document.getElementById('btnPlayInBottom')?.classList.toggle('hidden', !showBottomPlayer);
  document.getElementById('btnPushToSite')?.classList.toggle('hidden', !showPush);
  document.getElementById('btnCopyToLocal')?.classList.toggle('hidden', !showLocal);
  document.getElementById('btnCopyToAppCloud')?.classList.toggle('hidden', !showCloud);
}

function isPlayableLibraryItem(file) {
  if (!file) return false;
  const normalizedType = normalizeLibraryType(file.type, file.mimeType || inferMimeTypeFromName(file.name), file.name);
  return normalizedType === 'audio' || normalizedType === 'video';
}

function buildPlayerQueue() {
  const q = [...userLibrary].filter((item) => {
    const normalizedType = normalizeLibraryType(item.type, item.mimeType || inferMimeTypeFromName(item.name), item.name);
    return normalizedType === 'audio';
  });
  q.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0));
  return q;
}

function updateGlobalPlayerUi(file, isPlaying) {
  const player = document.getElementById('globalPlayer');
  const title = document.getElementById('globalPlayerTitle');
  const meta = document.getElementById('globalPlayerMeta');
  const toggle = document.getElementById('globalPlayerToggle');
  if (!player || !title || !meta || !toggle) return;

  if (!file) {
    player.classList.add('hidden');
    title.textContent = 'No track selected';
    meta.textContent = 'Select a sample or song to play';
    return;
  }

  player.classList.remove('hidden');
  title.textContent = file.name || 'Untitled';
  meta.textContent = `${getSectionLabel(file.section || 'local')} · ${getFileTypeLabel(file)}`;
  toggle.classList.toggle('global-player-btn--primary', !isPlaying);
  toggle.innerHTML = isPlaying
    ? '<svg viewBox="0 0 256 256"><path d="M96,48H64A16,16,0,0,0,48,64V192a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V64A16,16,0,0,0,96,48Zm96,0H160a16,16,0,0,0-16,16V192a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V64A16,16,0,0,0,192,48Z"/></svg>'
    : '<svg viewBox="0 0 256 256"><path d="M88,64V192a8,8,0,0,0,12.14,6.86l96-64a8,8,0,0,0,0-13.72l-96-64A8,8,0,0,0,88,64Z"/></svg>';
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
    if ((file.section || 'local') === 'site') {
      openFilePreview(file.id);
    }
    alert('Track source unavailable right now. If this is a Site Library metadata-only item, use the modal to copy it to Local/App Cloud once a source becomes available.');
    return;
  }

  playerCurrentIndex = index;
  playerCurrentFileId = file.id;
  audio.src = source;
  await audio.play().catch(() => {});
  updateGlobalPlayerUi(file, true);
  saveLibraryToStorage();
  await saveRemoteLibraryItems();
}

async function playLibraryItem(fileId) {
  const target = userLibrary.find((item) => item.id === fileId);
  if (!target) return;

  const normalizedType = normalizeLibraryType(target.type, target.mimeType || inferMimeTypeFromName(target.name), target.name);
  if (normalizedType !== 'audio') {
    openFilePreview(fileId, true);
    return;
  }

  playerQueue = buildPlayerQueue();
  const index = playerQueue.findIndex((item) => item.id === fileId);
  if (index === -1) {
    alert('Track is not available in the current library queue.');
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
  const btnClose = document.getElementById('globalPlayerClose');
  if (!audio || !btnToggle || !btnPrev || !btnNext || !btnClose) return;

  btnToggle.addEventListener('click', async () => {
    if (!audio.src && playerCurrentIndex >= 0) {
      await playQueueIndex(playerCurrentIndex);
      return;
    }
    if (audio.paused) {
      await audio.play().catch(() => {});
      const file = userLibrary.find((item) => item.id === playerCurrentFileId);
      updateGlobalPlayerUi(file || null, true);
    } else {
      audio.pause();
      const file = userLibrary.find((item) => item.id === playerCurrentFileId);
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
    audio.pause();
    audio.src = '';
    playerCurrentFileId = null;
    playerCurrentIndex = -1;
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
  let files = [...userLibrary];
  
  // Filter by tab
  if (currentLibraryTab !== 'all') {
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
    const canDelete = true;
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
    
    html += `
      <div class="file-card" onclick="handleLibraryItemClick('${file.id}')">
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
    const canDelete = true;
    const canPlay = isPlayableLibraryItem(file);
    
    html += `
      <div class="file-row" onclick="handleLibraryItemClick('${file.id}')">
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
          <button class="file-action-btn" onclick="event.stopPropagation(); downloadFile(userLibrary.find(f => f.id === '${file.id}'))" title="Download">
            <svg viewBox="0 0 256 256"><path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,132.69V40a8,8,0,0,0-16,0v92.69L93.66,106.34a8,8,0,0,0-11.32,11.32Z"/></svg>
          </button>
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
  document.getElementById('callView')?.classList.add('hidden');
  document.getElementById('chatView')?.classList.add('hidden');
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  
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
  
  renderLibrary();
}

function renderSessionBar() {
  const sessionBar = document.getElementById('sessionBar');
  const addBtn = document.getElementById('btnAddSession');
  
  // Remove existing session icons (keep home and dividers)
  document.querySelectorAll('.session-icon').forEach(el => el.remove());
  
  // Add session icons
  sessions.forEach(session => {
    const icon = document.createElement('div');
    icon.className = 'session-icon';
    icon.dataset.session = session.id;
    icon.title = session.name;
    icon.innerHTML = `<span>${session.icon}</span>`;
    icon.addEventListener('click', () => selectSession(session.id));
    
    sessionBar.insertBefore(icon, addBtn.previousElementSibling);
  });

  if (currentSession) {
    document.querySelectorAll('.session-icon').forEach(icon => {
      icon.classList.toggle('active', icon.dataset.session === currentSession.id);
    });
  }
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
  console.log('[Coverse] Opening user profile');
  // TODO: Implement profile modal/view
}

async function logout() {
  console.log('[Coverse] Logging out...');
  
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
  
  // Show channel list, hide home sidebar
  document.getElementById('homeSidebar')?.classList.add('hidden');
  document.getElementById('channelList')?.classList.remove('hidden');
  
  // Hide friends/DM views, show voice preview
  document.getElementById('friendsView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  
  // Select first voice channel by default
  selectChannel('main', 'voice');
}

function showHomeView() {
  currentSession = null;
  
  document.querySelectorAll('.session-icon').forEach(icon => {
    icon.classList.remove('active');
  });
  document.getElementById('btnHome')?.classList.add('active');
  
  document.getElementById('currentSessionName').textContent = 'Coverse';
  document.getElementById('btnCopySessionInvite')?.classList.add('hidden');
  
  // Show home sidebar (Friends/DMs), hide channel list
  document.getElementById('homeSidebar')?.classList.remove('hidden');
  document.getElementById('channelList')?.classList.add('hidden');
  
  // Show friends view by default
  showFriendsView();
}

function showFriendsView() {
  // Hide other views
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('dmView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  
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
  document.getElementById('libraryView')?.classList.remove('active');
  
  // Show DM view
  document.getElementById('dmView')?.classList.add('active');
  
  // Update nav items (none selected when in DM)
  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.classList.remove('active');
  });
}

// ============================================
// CHANNEL BAR
// ============================================
function initChannelBar() {
  // Channel categories (collapse/expand)
  document.querySelectorAll('.channel-category').forEach(cat => {
    cat.addEventListener('click', () => {
      cat.classList.toggle('collapsed');
    });
  });
  
  // Channel items
  document.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', () => {
      selectChannel(item.dataset.channel, item.dataset.type);
    });
  });
  
  // User panel buttons
  document.getElementById('btnPanelMic')?.addEventListener('click', toggleMic);
  document.getElementById('btnPanelDeafen')?.addEventListener('click', toggleDeafen);
  document.getElementById('btnPanelSettings')?.addEventListener('click', openSettings);
  document.getElementById('btnCopySessionInvite')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await copyCurrentSessionInvite();
  });
  
  // Home navigation items
  document.querySelectorAll('.home-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view === 'friends') {
        showFriendsView();
      } else if (view === 'library') {
        showLibraryView();
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
  
  // Add friend button
  document.getElementById('btnAddFriend')?.addEventListener('click', () => {
    openModal('addFriendModal');
  });
  
  // DM send button and input
  document.getElementById('btnDMSend')?.addEventListener('click', sendDMMessage);
  document.getElementById('dmInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendDMMessage();
    }
  });
  
  // New DM button
  document.getElementById('btnNewDM')?.addEventListener('click', () => {
    openModal('addFriendModal'); // Reuse add friend modal for now
  });
}

function selectChannel(channelId, channelType) {
  currentChannel = channelId;
  currentChannelType = channelType;
  
  // Update active state
  document.querySelectorAll('.channel-item').forEach(item => {
    item.classList.toggle('active', item.dataset.channel === channelId);
  });
  
  // Update header
  const header = document.getElementById('contentHeader');
  const title = document.getElementById('contentTitle');
  document.getElementById('libraryView')?.classList.remove('active');
  const headerIcon = header?.querySelector('svg');
  
  if (channelType === 'voice') {
    if (headerIcon) {
      headerIcon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81Z"/></svg>`;
    }
    if (title) {
      title.textContent = channelId.charAt(0).toUpperCase() + channelId.slice(1);
    }
    
    // Show voice preview or call view
    if (inVoiceCall) {
      showCallView();
    } else {
      showVoicePreview(channelId);
    }
  } else {
    if (headerIcon) {
      headerIcon.outerHTML = `<svg viewBox="0 0 256 256"><path d="M224,88H175.4l8.47-46.57a8,8,0,0,0-15.74-2.86l-9,49.43H111.4l8.47-46.57a8,8,0,0,0-15.74-2.86L95.14,88H48a8,8,0,0,0,0,16H92.23L81.14,168H32a8,8,0,0,0,0,16H78.23l-8.47,46.57a8,8,0,0,0,6.44,9.3A7.79,7.79,0,0,0,77.63,240a8,8,0,0,0,7.87-6.57l9-49.43h47.72l-8.47,46.57a8,8,0,0,0,6.44,9.3,7.79,7.79,0,0,0,1.43.13,8,8,0,0,0,7.87-6.57l9-49.43H208a8,8,0,0,0,0-16H161.77l11.09-64H224a8,8,0,0,0,0-16Zm-76.49,80H99.77l11.09-64h47.72Z"/></svg>`;
    }
    if (title) {
      title.textContent = channelId;
    }
    
    showChatView(channelId);
  }
  
  // Update chat input placeholder
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.placeholder = `Message #${channelId}`;
  }
}

function showVoicePreview(channelId) {
  document.getElementById('voicePreview')?.classList.remove('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  
  document.getElementById('voicePreviewTitle').textContent = channelId.charAt(0).toUpperCase() + channelId.slice(1);
  
  // Check if anyone is in the channel
  const usersInChannel = participants.filter(p => !p.isLocal);
  if (usersInChannel.length > 0) {
    document.getElementById('voicePreviewStatus').textContent = `${usersInChannel.length} ${usersInChannel.length === 1 ? 'person is' : 'people are'} in voice`;
  } else {
    document.getElementById('voicePreviewStatus').textContent = 'No one is in voice';
  }
}

function showCallView() {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.add('active');
  document.getElementById('chatView')?.classList.remove('active');
  document.getElementById('libraryView')?.classList.remove('active');
  
  renderParticipants();
}

function showChatView(channelId) {
  document.getElementById('voicePreview')?.classList.add('hidden');
  document.getElementById('callView')?.classList.remove('active');
  document.getElementById('chatView')?.classList.add('active');
  document.getElementById('libraryView')?.classList.remove('active');
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
  document.getElementById('btnDisconnect')?.addEventListener('click', disconnectVoice);
  document.getElementById('callStage')?.addEventListener('click', cycleActiveStageSource);
  
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
  });
}

async function joinVoice() {
  console.log('[Coverse] Joining voice channel:', currentChannel);
  
  try {
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
    voiceStartTime = Date.now();
    startVoiceTimer();
    
    // Add self to voice users
    addVoiceUser('local', 'You', 'Y');
    
    showCallView();
    renderParticipants();
    
  } catch (err) {
    console.error('[Coverse] Failed to join voice:', err);
    alert('Could not access microphone. Please check permissions.');
  }
}

function disconnectVoice() {
  console.log('[Coverse] Disconnecting from voice');
  
  // Stop all streams
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  
  inVoiceCall = false;
  isScreenSharing = false;
  isCameraOff = true;
  stageSelection = null;
  activeStageSource = null;
  
  stopVoiceTimer();
  removeVoiceUser('local');
  
  showVoicePreview(currentChannel);
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
  
  updateLocalParticipant();
}

async function toggleCamera() {
  const btn = document.getElementById('btnCamera');
  
  if (isCameraOff) {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Add video track to local stream
      if (localStream) {
        videoStream.getVideoTracks().forEach(t => localStream.addTrack(t));
      }
      
      isCameraOff = false;
      btn?.classList.remove('muted');
      
    } catch (err) {
      console.error('[Coverse] Camera error:', err);
    }
  } else {
    // Stop camera
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
}

async function toggleScreenShare() {
  const btn = document.getElementById('btnScreenShare');
  
  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
      
      isScreenSharing = true;
      btn?.classList.add('active');
      
      // Update local participant
      const local = participants.find(p => p.isLocal);
      if (local) local.isScreenSharing = true;
      renderParticipants();
      
      // Handle stream end
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
    } catch (err) {
      console.error('[Coverse] Screen share error:', err);
    }
  } else {
    stopScreenShare();
  }
}

function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  
  isScreenSharing = false;
  
  const btn = document.getElementById('btnScreenShare');
  btn?.classList.remove('active');
  
  const local = participants.find(p => p.isLocal);
  if (local) local.isScreenSharing = false;

  if (stageSelection?.participantId === 'local' && stageSelection?.sourceType === 'screen') {
    stageSelection = null;
  }
  renderParticipants();
}

function toggleDeafen() {
  isDeafened = !isDeafened;
  const btn = document.getElementById('btnPanelDeafen');
  btn?.classList.toggle('muted', isDeafened);
  
  // TODO: Implement audio output muting
}

function toggleDeviceMenu(menuId) {
  const menu = document.getElementById(menuId);
  const wasOpen = menu?.classList.contains('open');
  
  document.querySelectorAll('.device-menu').forEach(m => m.classList.remove('open'));
  
  if (menu && !wasOpen) {
    populateDeviceMenu(menuId);
    menu.classList.add('open');
  }
}

async function populateDeviceMenu(menuId) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const kind = menuId === 'micMenu' ? 'audioinput' : 'videoinput';
    const filtered = devices.filter(d => d.kind === kind);
    
    const list = document.getElementById(menuId === 'micMenu' ? 'micDeviceList' : 'cameraDeviceList');
    if (!list) return;
    
    list.innerHTML = filtered.map((d, i) => `
      <div class="device-menu-item${i === 0 ? ' selected' : ''}" data-id="${d.deviceId}">
        <svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>
        <span>${d.label || `Device ${i + 1}`}</span>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('[Coverse] Device enumeration error:', err);
  }
}

// ============================================
// VOICE TIMER
// ============================================
function startVoiceTimer() {
  const timerEl = document.getElementById('voiceTimer');
  if (!timerEl) return;
  
  voiceTimerInterval = setInterval(() => {
    const elapsed = Date.now() - voiceStartTime;
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    
    timerEl.textContent = hours > 0 
      ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopVoiceTimer() {
  if (voiceTimerInterval) {
    clearInterval(voiceTimerInterval);
    voiceTimerInterval = null;
  }
  const timerEl = document.getElementById('voiceTimer');
  if (timerEl) timerEl.textContent = '';
}

// ============================================
// VOICE USERS (in channel list)
// ============================================
function addVoiceUser(id, name, avatar) {
  const container = document.getElementById('voiceUsersMain');
  if (!container) return;
  
  const userEl = document.createElement('div');
  userEl.className = 'voice-user';
  userEl.dataset.user = id;
  userEl.innerHTML = `
    <div class="voice-user-avatar">${avatar}</div>
    <span class="voice-user-name">${name}</span>
    <div class="voice-user-icons"></div>
  `;
  container.appendChild(userEl);
}

function removeVoiceUser(id) {
  const userEl = document.querySelector(`.voice-user[data-user="${id}"]`);
  if (userEl) userEl.remove();
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

function getParticipantScreenStream(participant) {
  if (!participant) return null;
  if (participant.isLocal) {
    return hasVideoTracks(screenStream) ? screenStream : null;
  }
  return hasVideoTracks(participant.screenStream) ? participant.screenStream : null;
}

function getDefaultStageSource() {
  const sharingParticipant = participants.find((participant) => participant.isScreenSharing && getParticipantScreenStream(participant));
  if (!sharingParticipant) return null;
  return {
    participantId: sharingParticipant.id,
    participantName: sharingParticipant.name,
    sourceType: 'screen',
    stream: getParticipantScreenStream(sharingParticipant)
  };
}

function resolveActiveStageSource() {
  if (stageSelection) {
    const participant = participants.find((item) => item.id === stageSelection.participantId);
    if (participant) {
      const cameraStream = getParticipantCameraStream(participant);
      const shareStream = getParticipantScreenStream(participant);

      if (stageSelection.sourceType === 'camera' && cameraStream) {
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'camera',
          stream: cameraStream
        };
      }
      if (stageSelection.sourceType === 'screen' && shareStream) {
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'screen',
          stream: shareStream
        };
      }

      if (cameraStream) {
        stageSelection = { participantId: participant.id, sourceType: 'camera' };
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'camera',
          stream: cameraStream
        };
      }
      if (shareStream) {
        stageSelection = { participantId: participant.id, sourceType: 'screen' };
        return {
          participantId: participant.id,
          participantName: participant.name,
          sourceType: 'screen',
          stream: shareStream
        };
      }
    }

    stageSelection = null;
  }

  return getDefaultStageSource();
}

function renderCallStage() {
  const stageVideo = document.getElementById('stageVideo');
  const placeholder = document.getElementById('stagePlaceholder');
  const stageLabelName = document.getElementById('stageLabelName');
  if (!stageVideo || !placeholder) return;

  activeStageSource = resolveActiveStageSource();

  if (activeStageSource?.stream) {
    if (stageVideo.srcObject !== activeStageSource.stream) {
      stageVideo.srcObject = activeStageSource.stream;
    }
    stageVideo.classList.remove('hidden');
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

  stageVideo.srcObject = null;
  stageVideo.classList.add('hidden');
  placeholder.classList.remove('hidden');
  if (stageLabelName) stageLabelName.textContent = 'Screen Share';
}

function handleParticipantTileClick(participantId) {
  const participant = participants.find((item) => item.id === participantId);
  if (!participant) return;

  const hasCamera = !!getParticipantCameraStream(participant);
  const hasScreen = !!getParticipantScreenStream(participant);
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

  const hasCamera = !!getParticipantCameraStream(participant);
  const hasScreen = !!getParticipantScreenStream(participant);
  if (hasCamera && hasScreen) {
    stageSelection = {
      participantId: participant.id,
      sourceType: activeStageSource.sourceType === 'screen' ? 'camera' : 'screen'
    };
    renderParticipants();
  }
}

// ============================================
// PARTICIPANTS
// ============================================
function renderParticipants() {
  const container = document.getElementById('callParticipants');
  if (!container) return;
  activeStageSource = resolveActiveStageSource();
  
  container.innerHTML = participants.map(p => `
    <div class="participant-tile${p.isSpeaking ? ' speaking' : ''}${activeStageSource?.participantId === p.id ? ' selected' : ''}" data-id="${p.id}">
      ${p.isScreenSharing ? '<span class="tile-live-badge">LIVE</span>' : ''}
      <video autoplay playsinline ${p.isLocal ? 'muted' : ''}></video>
      <div class="participant-tile-placeholder">
        <div class="participant-tile-avatar">${p.avatar}</div>
      </div>
      <div class="participant-tile-info">
        <div class="participant-tile-name">
          ${p.isScreenSharing ? '<svg viewBox="0 0 256 256"><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Z"/></svg>' : ''}
          <span>${p.name}</span>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.participant-tile').forEach((tileEl) => {
    tileEl.addEventListener('click', () => {
      handleParticipantTileClick(tileEl.dataset.id);
    });
  });

  bindParticipantStreams();
  renderCallStage();
}

function bindParticipantStreams() {
  participants.forEach((participant) => {
    const tile = document.querySelector(`.participant-tile[data-id="${participant.id}"]`);
    const videoEl = tile?.querySelector('video');
    const placeholderEl = tile?.querySelector('.participant-tile-placeholder');
    if (!videoEl) return;

    const cameraStream = getParticipantCameraStream(participant);
    const shareStream = getParticipantScreenStream(participant);
    const isActiveStageParticipant = activeStageSource?.participantId === participant.id;

    let stream = cameraStream;
    if (isActiveStageParticipant) {
      stream = activeStageSource?.sourceType === 'camera'
        ? (shareStream || null)
        : (cameraStream || null);
    } else if (participant.isScreenSharing && shareStream) {
      stream = shareStream;
    }

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.classList.remove('hidden');
      placeholderEl?.classList.add('hidden');
      const playPromise = videoEl.play?.();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      videoEl.srcObject = null;
      videoEl.classList.add('hidden');
      placeholderEl?.classList.remove('hidden');
    }
  });
}

function updateLocalParticipant() {
  const local = participants.find(p => p.isLocal);
  if (local) {
    local.isMuted = isMicMuted;
    local.isCameraOn = !isCameraOff;
    local.isScreenSharing = isScreenSharing;
  }
  renderParticipants();
}

// ============================================
// CHAT
// ============================================
function initChat() {
  const input = document.getElementById('chatInput');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      sendMessage(input.value);
      input.value = '';
    }
  });
  
  document.getElementById('btnAttachFile')?.addEventListener('click', attachFile);
}

function sendMessage(text) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  
  const msg = document.createElement('div');
  msg.className = 'chat-message';
  msg.innerHTML = `
    <div class="chat-message-avatar">Y</div>
    <div class="chat-message-content">
      <div class="chat-message-header">
        <span class="chat-message-author">You</span>
        <span class="chat-message-time">Today at ${time}</span>
      </div>
      <div class="chat-message-text">${escapeHtml(text)}</div>
    </div>
  `;
  container.appendChild(msg);
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
    closeModal('addFriendModal');
    document.getElementById('friendSearchInput').value = '';
    document.getElementById('friendSearchResults').innerHTML = '';
  });
  
  // Friend search input
  let searchTimeout;
  document.getElementById('friendSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      document.getElementById('friendSearchResults').innerHTML = '';
      return;
    }
    
    document.getElementById('friendSearchResults').innerHTML = '<div class="search-loading">Searching...</div>';
    
    searchTimeout = setTimeout(async () => {
      const results = await searchUsers(query);
      renderSearchResults(results);
    }, 300);
  });
  
  document.getElementById('btnSendFriendRequest')?.addEventListener('click', () => {
    const selected = document.querySelector('.search-result-item.selected');
    if (selected) {
      sendFriendRequest(selected.dataset.userId);
    }
  });
  
  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

function renderSearchResults(results) {
  const container = document.getElementById('friendSearchResults');
  if (!container) return;
  
  if (results.length === 0) {
    container.innerHTML = '<div class="search-no-results">No users found</div>';
    document.getElementById('btnSendFriendRequest').disabled = true;
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

function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
  
  // Focus the input if it's the add friend modal
  if (modalId === 'addFriendModal') {
    setTimeout(() => {
      document.getElementById('friendSearchInput')?.focus();
    }, 100);
  }
}

function closeModal(modalId) {
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
        textChannels: ['general', 'files'],
        voiceChannels: ['Main', 'Studio'],
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });

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
    textChannels: ['general', 'files'],
    voiceChannels: ['Main', 'Studio']
  });
  saveSessionsToStorage();
  renderSessionBar();
  selectSession(id);
  closeModal('createSessionModal');
  alert(`Session created (local). Invite code: ${inviteCode}`);
}

async function joinSessionByInvite(code) {
  const inviteCode = (code || '').trim().toUpperCase();
  if (!inviteCode) {
    alert('Enter an invite code first.');
    return;
  }

  if (!currentUser || !window.firebaseDb) {
    alert('Sign in first to join sessions by invite code.');
    return;
  }

  try {
    const db = window.firebaseDb;
    const sessionsRef = window.firebaseCollection(db, 'sessions');
    const q = window.firebaseQuery(
      sessionsRef,
      window.firebaseWhere('inviteCode', '==', inviteCode)
    );
    const snapshot = await window.firebaseGetDocs(q);

    if (snapshot.empty) {
      alert('Invite code not found.');
      return;
    }

    const target = snapshot.docs[0];
    const data = target.data() || {};
    const existingMembers = Array.isArray(data.memberIds) ? data.memberIds : [];
    const memberIds = existingMembers.includes(currentUser.uid)
      ? existingMembers
      : [...existingMembers, currentUser.uid];

    await window.firebaseSetDoc(
      window.firebaseDoc(db, 'sessions', target.id),
      {
        memberIds,
        updatedAt: new Date()
      },
      { merge: true }
    );

    await loadUserSessions();
    selectSession(target.id);
    closeModal('createSessionModal');
  } catch (error) {
    console.error('[Coverse] Failed to join session:', error);
    alert('Could not join session from invite code.');
  }
}

function openSettings() {
  console.log('[Coverse] Opening settings');
  // TODO: Implement settings modal
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
    joinVoice,
    disconnectVoice,
    selectSession,
    selectChannel,
    sendMessage
  };
}
