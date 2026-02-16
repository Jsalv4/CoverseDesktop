console.log('Coverse renderer loaded');

const manifestSchema = {
  version: '1.0.0',
  projectId: 'string',
  revision: 'string',
  stems: [
    {
      id: 'string',
      name: 'string',
      hash: 'sha256',
      url: 'string',
      lengthSeconds: 'number',
      sampleRate: 'number',
      channels: 'number',
      format: 'wav'
    }
  ]
};

let signalingSocket = null;
let currentRoom = null;
let configCache = null;
let pc = null;
let localStream = null;
let talkbackStream = null;
let hqStream = null;
let screenStream = null;
let remoteStream = null;
let remoteHasVideo = false;
let remoteScreenStream = null;
let isCameraOn = false;
let isMicOn = false;
let cameraDeviceId = '';
let micDeviceId = '';
let speakerDeviceId = '';
let screenSourceId = '';
let micMeterInterval = null;
let tiles = {};
let micTestStream = null;
let camTestStream = null;
let shareTestStream = null;
let externalPop = null;
let showRoster = false;
let notifications = [];
let notifyChannel = null;
let roster = [];
// track active room for invite/host/join flows
let activeRoom = '';
let shouldStartCam = true;
let shouldStartMic = true;
let inCall = false;
let inviteChannel = null;
let lobbySocket = null;
let pendingInvites = [];
let viewMode = 'camera'; // camera | screen | grid
let selectedQuality = 'low'; // low | med | high
let camTrackCache = null;
let currentLayout = 'solo'; // solo | dual | focus | grid | screen-share | presentation
let previousLayout = 'solo'; // Store previous layout for returning from focus mode
let focusedVideo = null; // Which video is currently focused ('main' or 'secondary')

function setViewMode(mode) {
  viewMode = mode;
  // When screen sharing, show screen as MAIN (big) and camera as small thumbnail
  if (mode === 'screen') {
    setCallLayout('screen-share');
  } else if (currentLayout === 'screen-share') {
    // Switch back to solo when stopping screen share
    setCallLayout('solo');
  }
  renderCallLayout();
}

// Layout system for different call views
function setCallLayout(layout) {
  currentLayout = layout;
  const videoPane = document.getElementById('callVideoPane');
  if (!videoPane) return;
  
  // Remove all layout classes
  videoPane.classList.remove('layout-solo', 'layout-dual', 'layout-focus', 'layout-grid', 'layout-screen-share', 'layout-presentation');
  
  // Add new layout class
  videoPane.classList.add(`layout-${layout}`);
  
  // Sync all video streams to their containers
  syncAllLayoutVideos();
}

// Focus on a specific video (click to fullscreen/solo)
function focusVideo(which) {
  const videoPane = document.getElementById('callVideoPane');
  const videoMain = document.getElementById('videoMain');
  const videoSecondary = document.getElementById('videoSecondary');
  const videoScreen = document.getElementById('videoScreen');
  
  if (!videoPane) return;
  
  // If already focused on this video, unfocus (return to previous layout)
  if (focusedVideo === which) {
    unfocusVideo();
    return;
  }
  
  // Store previous layout if not already in focus mode
  if (currentLayout !== 'focus') {
    previousLayout = currentLayout;
  }
  
  focusedVideo = which;
  
  // Add focus classes
  videoPane.classList.remove('layout-solo', 'layout-dual', 'layout-focus', 'layout-grid', 'layout-screen-share');
  videoPane.classList.add('layout-focus');
  
  // Clear all focus/minimized states first
  if (videoMain) videoMain.classList.remove('focused', 'minimized');
  if (videoSecondary) videoSecondary.classList.remove('focused', 'minimized');
  if (videoScreen) videoScreen.classList.remove('focused', 'minimized');
  
  if (which === 'main') {
    if (videoMain) videoMain.classList.add('focused');
    if (videoSecondary) videoSecondary.classList.add('minimized');
  } else if (which === 'secondary') {
    if (videoSecondary) videoSecondary.classList.add('focused');
    if (videoMain) videoMain.classList.add('minimized');
  } else if (which === 'screen') {
    if (videoScreen) videoScreen.classList.add('focused');
    if (videoMain) videoMain.classList.add('minimized');
  }
  
  currentLayout = 'focus';
}

// Return from focus mode to previous layout
function unfocusVideo() {
  const videoPane = document.getElementById('callVideoPane');
  const videoMain = document.getElementById('videoMain');
  const videoSecondary = document.getElementById('videoSecondary');
  const videoScreen = document.getElementById('videoScreen');
  
  if (!videoPane) return;
  
  focusedVideo = null;
  
  // Remove focus/minimized classes
  if (videoMain) {
    videoMain.classList.remove('focused', 'minimized');
  }
  if (videoSecondary) {
    videoSecondary.classList.remove('focused', 'minimized');
  }
  if (videoScreen) {
    videoScreen.classList.remove('focused', 'minimized');
  }
  
  // Return to previous layout
  setCallLayout(previousLayout);
}

// Sync video streams to all layout containers
function syncAllLayoutVideos() {
  // Main video - local camera
  const localLarge = document.getElementById('localLarge');
  if (localLarge && localStream) {
    localLarge.srcObject = localStream;
    localLarge.muted = true;
    safePlay(localLarge);
  }
  
  // Secondary video - screen share takes priority, then remote stream
  const remoteMain = document.getElementById('remoteMain');
  if (remoteMain) {
    if (shareTestStream && shareTestStream.getVideoTracks().length) {
      // Screen share goes in secondary slot
      remoteMain.srcObject = shareTestStream;
      remoteMain.muted = true;
    } else if (remoteStream) {
      remoteMain.srcObject = remoteStream;
    } else if (localStream) {
      // For testing: mirror local stream
      remoteMain.srcObject = localStream;
      remoteMain.muted = true;
    }
    safePlay(remoteMain);
  }
  
  // Screen share video (for dedicated screen-share layout)
  const screenShareVideo = document.getElementById('screenShareVideo');
  if (screenShareVideo) {
    if (shareTestStream && shareTestStream.getVideoTracks().length) {
      screenShareVideo.srcObject = shareTestStream;
      screenShareVideo.muted = true;
      safePlay(screenShareVideo);
    } else if (localStream) {
      // For testing: show local as screen share
      screenShareVideo.srcObject = localStream;
      screenShareVideo.muted = true;
      safePlay(screenShareVideo);
    }
  }
  
  // Thumbnail - local video
  const thumbLocalVideo = document.getElementById('thumbLocalVideo');
  if (thumbLocalVideo && localStream) {
    thumbLocalVideo.srcObject = localStream;
    thumbLocalVideo.muted = true;
    safePlay(thumbLocalVideo);
  }
  
  // Update labels based on call state
  updateVideoLabels();
}

function updateVideoLabels() {
  const mainLabel = document.getElementById('mainVideoLabel');
  const secondaryLabel = document.getElementById('secondaryVideoLabel');
  
  if (mainLabel) {
    mainLabel.textContent = localStream ? 'You' : 'Camera Off';
  }
  if (secondaryLabel) {
    secondaryLabel.textContent = remoteStream ? 'Remote' : 'Waiting...';
  }
}

function syncThumbnailVideos() {
  syncAllLayoutVideos();
}

function safePlay(el) {
  if (!el) return;
  try {
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  } catch (_) {}
}

function syncVideoElements() {
  const localEl = document.getElementById('localLarge');
  const pipLocal = document.getElementById('popLocal');
  const remoteEl = document.getElementById('remoteVideo');
  const pipRemote = document.getElementById('popRemote');
  const screenEl = document.getElementById('localScreen');
  const mainSrc =
    viewMode === 'screen' && shareTestStream && shareTestStream.getVideoTracks().length
      ? shareTestStream
      : localStream;
  if (localEl && mainSrc) {
    localEl.srcObject = mainSrc;
    localEl.muted = true;
    safePlay(localEl);
    localEl.style.display = 'block';
  }
  if (pipLocal && localStream) {
    pipLocal.srcObject = localStream;
    pipLocal.muted = true;
    safePlay(pipLocal);
    pipLocal.style.display = 'block';
  }
  if (screenEl && shareTestStream) {
    screenEl.srcObject = shareTestStream;
    screenEl.muted = true;
    safePlay(screenEl);
    screenEl.style.display = 'block';
  }
  if (remoteEl && remoteStream) {
    remoteEl.srcObject = remoteStream;
    safePlay(remoteEl);
    remoteEl.style.display = 'block';
  }
  if (pipRemote && remoteStream) {
    pipRemote.srcObject = remoteStream;
    safePlay(pipRemote);
    pipRemote.style.display = 'block';
  }
  
  // Also sync to layout containers
  syncAllLayoutVideos();
}

function getVideoConstraints() {
  const base = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  };
  if (selectedQuality === 'low') {
    return { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30 } };
  }
  if (selectedQuality === 'high') {
    return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
  }
  return base;
}

async function ensureLocalPreview() {
  try {
    if (localStream && localStream.getVideoTracks && localStream.getVideoTracks().length) {
      syncVideoElements();
      return;
    }
    const videoConstraints = getVideoConstraints();
    localStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false
    });
    isCameraOn = true;
    setIconState('btnToggleCamera', true);
    syncVideoElements();
    renderCallLayout();
  } catch (err) {
    console.warn('local preview failed', err);
    addNotification('Camera preview failed: ' + (err?.message || err));
  }
}

function getRosterElements() {
  return {
    rosterList: document.getElementById('rosterList'),
    rosterSearch: document.getElementById('rosterSearch'),
    connectionsBox: document.getElementById('callConnections'),
    callRosterBox: document.getElementById('callRoster'),
    stripPane: document.getElementById('stripPane')
  };
}

function upsertParticipant(participant) {
  const idx = roster.findIndex((r) => r.id === participant.id);
  if (idx >= 0) {
    roster[idx] = { ...roster[idx], ...participant };
  } else {
    roster.push({ tbMuted: false, hqEnabled: false, ...participant });
  }
  renderRoster(roster);
}

function renderStrips() {
  const { stripPane } = getRosterElements();
  if (!stripPane) return;
  stripPane.innerHTML = '';
  const all = [{ id: 'host', name: 'Host (you)', status: 'connected', tbMuted: false, hqEnabled: true }, ...roster.filter((r) => r.status === 'connected')];
  all.forEach((r) => {
    const wrap = document.createElement('div');
    wrap.className = 'strip';
    const title = document.createElement('div');
    title.className = 'strip-title';
    title.textContent = r.name || r.id;
    wrap.appendChild(title);
    stripPane.appendChild(wrap);
  });
}

function renderRoster(list = roster, filter = '') {
  const { rosterList, rosterSearch, connectionsBox, callRosterBox } = getRosterElements();
  const term = (filter || rosterSearch?.value || '').toLowerCase();
  const filtered = list.filter((r) => (r.name || r.id || '').toLowerCase().includes(term));

  if (rosterList) {
    rosterList.innerHTML = '';
    filtered.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r.name || r.id || 'Peer';
      rosterList.appendChild(li);
    });
    if (!filtered.length) rosterList.innerHTML = '<li>No participants</li>';
  }

  if (callRosterBox) {
    callRosterBox.innerHTML = '';
    filtered.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'call-roster-row';
      row.textContent = r.name || r.id || 'Participant';
      callRosterBox.appendChild(row);
    });
    if (!filtered.length) callRosterBox.textContent = 'No one in the call yet.';
  }
  renderStrips();
}

function renderCallLayout() {
  // Use the existing HTML structure - don't rebuild the DOM
  // Just update video sources and show/hide placeholders
  const pane = document.getElementById('callVideoPane');
  if (!pane) return;
  
  const localVid = document.getElementById('localLarge');
  const remoteVid = document.getElementById('remoteMain');
  const screenVid = document.getElementById('screenShareVideo');
  const mainPlaceholder = document.getElementById('mainPlaceholder');
  const secondaryPlaceholder = document.getElementById('secondaryPlaceholder');
  const screenPlaceholder = document.querySelector('#videoScreen .video-placeholder');
  
  // Check what video sources we have
  const localHasVideo = !!(localStream && localStream.getVideoTracks && localStream.getVideoTracks().length);
  const screenHas = !!(shareTestStream && shareTestStream.getVideoTracks && shareTestStream.getVideoTracks().length);
  const remoteHasVideoTrack = !!(remoteStream && remoteStream.getVideoTracks && remoteStream.getVideoTracks().length);
  
  // In screen-share mode: screen is MAIN (big), camera is thumbnail
  if (currentLayout === 'screen-share' && screenHas) {
    // Screen share goes in the main screen video element (big)
    if (screenVid && shareTestStream) {
      screenVid.srcObject = shareTestStream;
      screenVid.muted = true;
      screenVid.play().catch(() => {});
    }
    if (screenPlaceholder) screenPlaceholder.style.display = 'none';
    
    // Camera goes in the thumbnail (localLarge stays as small pip)
    if (localVid && localStream) {
      localVid.srcObject = localStream;
      localVid.muted = true;
      localVid.play().catch(() => {});
    }
    if (mainPlaceholder) mainPlaceholder.style.display = localHasVideo ? 'none' : 'flex';
  } else {
    // Normal mode: camera in main, remote in secondary
    if (localVid && localStream) {
      localVid.srcObject = localStream;
      localVid.muted = true;
      localVid.play().catch(() => {});
    }
    if (mainPlaceholder) mainPlaceholder.style.display = localHasVideo ? 'none' : 'flex';
    
    // Remote video in secondary
    if (remoteVid) {
      if (remoteHasVideoTrack && remoteStream) {
        remoteVid.srcObject = remoteStream;
        remoteVid.play().catch(() => {});
      } else {
        remoteVid.srcObject = null;
      }
    }
    if (secondaryPlaceholder) {
      secondaryPlaceholder.style.display = remoteHasVideoTrack ? 'none' : 'flex';
    }
  }
  
  // Update labels
  const mainLabel = document.getElementById('mainVideoLabel');
  const secondaryLabel = document.getElementById('secondaryVideoLabel');
  if (currentLayout === 'screen-share') {
    if (mainLabel) mainLabel.textContent = 'You';
  } else {
    if (mainLabel) mainLabel.textContent = 'You';
    if (secondaryLabel) secondaryLabel.textContent = remoteHasVideoTrack ? 'Remote' : 'Waiting...';
  }
  
  syncVideoElements();
}

function mirrorSelect(sourceId, mirrorId) {
  const src = document.getElementById(sourceId);
  const mirror = document.getElementById(mirrorId);
  if (!src || !mirror) return;
  mirror.innerHTML = '';
  Array.from(src.options).forEach((opt) => {
    const m = document.createElement('option');
    m.value = opt.value;
    m.textContent = opt.textContent;
    mirror.appendChild(m);
  });
  mirror.value = src.value;
  mirror.onchange = () => {
    src.value = mirror.value;
    src.dispatchEvent(new Event('change'));
  };
}

function toggleNotificationsPanel() {
  const panel = document.getElementById('notificationsPanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    populateNotifications();
  }
}

function addNotification(text) {
  notifications.unshift({ text, ts: new Date() });
  if (notifications.length > 50) notifications.pop();
  const panel = document.getElementById('notificationsPanel');
  if (panel && !panel.classList.contains('hidden')) {
    populateNotifications();
  }
}

function populateNotifications() {
  const list = document.getElementById('notificationsList');
  if (!list) return;
  list.innerHTML = '';
  const items = notifications.length ? notifications : [{ text: 'No new notifications' }];
  items.forEach((msg, idx) => {
    const row = document.createElement('div');
    row.className = 'notif-item';
    const main = document.createElement('div');
    main.textContent = msg.text || msg;
    row.appendChild(main);
    if (msg.ts) {
      const meta = document.createElement('div');
      meta.className = 'notif-meta';
      const d = new Date(msg.ts);
      meta.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      row.appendChild(meta);
    }
    if (msg.type === 'invite' && msg.room) {
      const actions = document.createElement('div');
      actions.className = 'notif-actions';
      const accept = document.createElement('button');
      accept.className = 'pill';
      accept.textContent = 'Accept';
      accept.addEventListener('click', () => {
        const roomInput = document.getElementById('callRoom');
        if (roomInput) roomInput.value = msg.room;
        activeRoom = msg.room;
        const btnStart = document.getElementById('btnStartEnd');
        if (btnStart && !inCall) btnStart.click();
        removeNotification(idx);
      });
      const decline = document.createElement('button');
      decline.className = 'pill ghost';
      decline.textContent = 'Decline';
      decline.addEventListener('click', () => removeNotification(idx));
      actions.append(accept, decline);
      row.appendChild(actions);
    }
    list.appendChild(row);
  });
}

function removeNotification(index) {
  notifications.splice(index, 1);
  populateNotifications();
}

function stopPrejoinTests() {
  // stop mic test
  if (micTestStream) {
    micTestStream.getTracks().forEach((t) => t.stop());
    micTestStream = null;
  }
  if (micMeterInterval) {
    clearInterval(micMeterInterval);
    micMeterInterval = null;
  }
  const meterEl = document.getElementById('micMeterPreview') || document.getElementById('micMeter');
  if (meterEl) meterEl.style.width = '0%';

  // stop cam test and restore preview to current local stream
  if (camTestStream) {
    camTestStream.getTracks().forEach((t) => t.stop());
    camTestStream = null;
  }
  const preVid = document.getElementById('localVideo');
  if (preVid && localStream) preVid.srcObject = localStream;
}

function addInviteNotification(payload) {
  const selfId = getSelfId();
  if (payload.fromUid && payload.fromUid === selfId) return; // don't notify sender
  if (payload.from && payload.from === selfId) return;
  notifications.unshift({
    type: 'invite',
    room: payload.room,
    from: payload.fromName || payload.from || payload.fromUid || 'guest',
    text: `Invite from ${payload.fromName || payload.from || 'guest'} to room ${payload.room}`,
    ts: new Date()
  });
  try {
    inviteChannel?.postMessage({ type: 'invite', payload });
  } catch (_) {}
  populateNotifications();
}

function trySendInvite(payload) {
  const data = JSON.stringify(payload);
  const socketOpen = (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) ||
    (lobbySocket && lobbySocket.readyState === WebSocket.OPEN);
  if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
    signalingSocket.send(data);
    return true;
  }
  if (lobbySocket && lobbySocket.readyState === WebSocket.OPEN) {
    lobbySocket.send(data);
    return true;
  }
  return false;
}

async function sendInviteOrWs(room, target = {}, displayName = 'user') {
  const toUid = target.id || target.uid || target.userId || target.targetUid || undefined;
  const toEmail = target.email || target.toEmail || undefined;
  try {
    const payload = {
      type: 'invite',
      room,
      fromUid: getSelfId() || 'local-user',
      fromName: getSelfName(),
      toUid,
      toEmail
    };

    const sentNow = trySendInvite(payload);
    if (!sentNow) {
      showToast('Opening signaling for invites…', 'info');
      pendingInvites.push(payload);
      connectLobby();
    } else {
      showToast('Invite sent (signal)', 'success');
    }

    // local broadcast so second window on same machine gets it even if socket fails
    try {
      inviteChannel?.postMessage({ type: 'invite', payload: { ...payload, ts: Date.now() } });
    } catch (_) {}

    const msg = `Invite to ${room} sent to ${displayName}`;
    addNotification(msg);
    try {
      notifyChannel?.postMessage({ text: msg });
    } catch (_) {}
  } catch (e) {
    console.warn('Invite failed', e);
    showToast('Invite failed', 'error');
  }
}
// Point all app requests to your API host (local UI uses this, no remote site required)
const API_BASE =
  (typeof process !== 'undefined' && process?.env?.COVERSE_API_BASE) ||
  'https://coversehq.com';

// Ignore benign media play interruptions triggered during navigations/reloads
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (msg.includes('The play() request was interrupted by a new load request')) {
    event.preventDefault();
  }
});

// Auth state
let firebaseApp = null;
let firebaseAuth = null;
let authUser = null;
let authProfile = null;
let contacts = [];
let lastAuthMsg = 'none';
let conversations = [];
let messages = [];
let currentThreadUser = '';
let currentThreadId = '';
let lastThreadOther = '';
const getSelfId = () => authProfile?.uid || authUser?.uid || '';
const getSelfName = () => authProfile?.displayName || authUser?.displayName || (authUser?.email ? authUser.email.split('@')[0] : '') || 'You';

// Normalize signaling URL to ensure websocket path is present
function normalizeSignalUrl(url) {
  if (!url) return 'wss://coversehq.com/ws/signal';
  if (url.includes('/ws/signal')) return url;
  const trimmed = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${trimmed}/ws/signal`;
}

// Toggle the inline SVG icon on toolbar buttons (swap between normal and slashed versions)
const iconPaths = {
  btnToggleMic: {
    on: 'M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z',
    off: 'M213.92,218.62l-160-176A8,8,0,0,0,42.08,53.38L80,95.09V128a48,48,0,0,0,69.11,43.12l11.1,12.2A63.41,63.41,0,0,1,128,192a64.07,64.07,0,0,1-64-64,8,8,0,0,0-16,0,80.11,80.11,0,0,0,72,79.6V240a8,8,0,0,0,16,0V207.59a78.83,78.83,0,0,0,35.16-12.22l30.92,34a8,8,0,1,0,11.84-10.76ZM128,160a32,32,0,0,1-32-32V112.69l41.66,45.82A32,32,0,0,1,128,160Zm57.52-3.91A63.32,63.32,0,0,0,192,128a8,8,0,0,1,16,0,79.16,79.16,0,0,1-8.11,35.12,8,8,0,0,1-7.19,4.49,7.88,7.88,0,0,1-3.51-.82A8,8,0,0,1,185.52,156.09ZM84,44.87A48,48,0,0,1,176,64v64a49.19,49.19,0,0,1-.26,5,8,8,0,0,1-8,7.17,8.13,8.13,0,0,1-.84,0,8,8,0,0,1-7.12-8.79c.11-1.1.17-2.24.17-3.36V64A32,32,0,0,0,98.64,51.25,8,8,0,1,1,84,44.87Z'
  },
  btnToggleCamera: {
    on: 'M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z',
    off: 'M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H113.06a8,8,0,0,0,0,16H192v87.63a8,8,0,0,0,16,0V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM240,161.05l-32-21.33V116.28L240,95ZM53.92,34.62A8,8,0,1,0,42.08,45.38L51.73,56H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H182.64l19.44,21.38a8,8,0,1,0,11.84-10.76ZM32,184V72H66.28L168.1,184Z'
  },
  btnToggleHQ: {
    on: 'M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81ZM152,207.64,92.91,161.69A7.94,7.94,0,0,0,88,160H40V96H88a7.94,7.94,0,0,0,4.91-1.69L152,48.36ZM208,104v48a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm32-16v80a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0Z',
    off: 'M163.51,24.81a8,8,0,0,0-8.42.88L85.25,80H40A16,16,0,0,0,24,96v64a16,16,0,0,0,16,16H85.25l69.84,54.31A8,8,0,0,0,168,224V32A8,8,0,0,0,163.51,24.81ZM152,207.64,92.91,161.69A7.94,7.94,0,0,0,88,160H40V96H88a7.94,7.94,0,0,0,4.91-1.69L152,48.36ZM193.54,108.46a8,8,0,1,1,11.31,11.32L196,128.63l8.85,8.86a8,8,0,0,1-11.31,11.32L184.7,140l-8.85,8.81a8,8,0,0,1-11.31-11.32l8.85-8.86-8.85-8.85a8,8,0,0,1,11.31-11.32l8.85,8.86Z'
  },
  btnShareScreen: {
    on: 'M232,56V200a16,16,0,0,1-16,16H144a8,8,0,0,1,0-16h72V56H40V96a8,8,0,0,1-16,0V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM32,184a8,8,0,0,0,0,16,8,8,0,0,1,8,8,8,8,0,0,0,16,0A24,24,0,0,0,32,184Zm0-32a8,8,0,0,0,0,16,40,40,0,0,1,40,40,8,8,0,0,0,16,0A56.06,56.06,0,0,0,32,152Zm0-32a8,8,0,0,0,0,16,72.08,72.08,0,0,1,72,72,8,8,0,0,0,16,0A88.1,88.1,0,0,0,32,120Z',
    off: 'M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z'
  }
};

function setIconState(btnId, isOn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  const svg = btn.querySelector('svg.toolbar-icon');
  const pathEl = svg?.querySelector('path');
  const paths = iconPaths[btnId];
  
  if (pathEl && paths) {
    pathEl.setAttribute('d', isOn ? paths.on : paths.off);
  }
  
  // Also toggle button active/muted state for styling
  btn.classList.toggle('active', isOn);
  btn.classList.toggle('muted', !isOn);
}

// Ensure toolbar buttons only contain their icon span (prevents duplicate icons/text)
function ensureIconOnly(btnId, iconClass, ariaLabel = '') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.innerHTML = '';
  const span = document.createElement('span');
  span.className = `icon ${iconClass}`;
  btn.appendChild(span);
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
}

function showToast(msg, level = 'info') {
  console.log(`[${level}] ${msg}`);
  const bar = document.getElementById('callStatus');
  if (bar) bar.textContent = msg;
}

function getActiveRoom() {
  const inputVal = (document.getElementById('callRoom')?.value || '').trim();
  const room = activeRoom || inputVal;
  if (!room) {
    showToast('Enter a room, then Host or Join to send invites.', 'warn');
    return '';
  }
  return room;
}

function showNotifications() {
  const msgs = [
    'No new notifications',
    'Tip: Shift+click Mic/Camera to open quick device picker.',
    'Mixer button toggles between faders and connections.'
  ];
  const idx = Math.floor(Date.now() / 5000) % msgs.length;
  showToast(msgs[idx], 'info');
}

function lookupName(id) {
  if (!id) return '';
  const c = contacts.find((x) => x.id === id || x.uid === id || x.userId === id);
  return c?.displayName || c?.name || c?.email || '';
}

function lookupRole(c) {
  return (c?.role || c?.title || c?.status || '').toString().trim().toLowerCase();
}

// ---- Messages API helpers ----
async function fetchConversations() {
  try {
    return await fetchJson('/api/getConversations', { method: 'GET' });
  } catch (e) {
    handleAuthError(e);
    throw e;
  }
}

async function fetchMessages(otherUserId) {
  try {
    const q = encodeURIComponent(otherUserId || '');
    return await fetchJson(`/api/getMessages?otherUserId=${q}`, { method: 'GET' });
  } catch (e) {
    handleAuthError(e);
    throw e;
  }
}

async function sendMessage(receiverId, text) {
  try {
    const body = { receiverId, text };
    return await fetchJson('/api/sendMessage', { method: 'POST', body: JSON.stringify(body) });
  } catch (e) {
    handleAuthError(e);
    throw e;
  }
}

function handleAuthError(err) {
  if (err && err.message && err.message.includes('401')) {
    localStorage.removeItem('coverseIdToken');
    authProfile = null;
    authUser = null;
    setAuthStatus('Auth expired. Please sign in again.', true);
    updateAuthUI();
  }
}
const TRUSTED_ORIGINS = ['https://coversehq.com', 'http://coversehq.com'];
const firebaseConfig = {
  apiKey: 'AIzaSyBpMgWjeIVXYtoBn4TOlsXYPXM0FMOKE1Y',
  authDomain: 'coverse-390b0.firebaseapp.com',
  databaseURL: 'https://coverse-390b0-default-rtdb.firebaseio.com',
  projectId: 'coverse-390b0',
  storageBucket: 'coverse-390b0.firebasestorage.app',
  messagingSenderId: '129365928431',
  appId: '1:129365928431:web:e1dfee8a49db78e4026e1a',
  measurementId: 'G-FR3HWCE77R'
};

function getIdToken() {
  return localStorage.getItem('coverseIdToken') || '';
}

// Verify the stored Electron JWT is still valid
async function verifyElectronToken() {
  const token = getIdToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/electron/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.warn('[Auth] Electron token verification failed, clearing');
      localStorage.removeItem('coverseIdToken');
      return null;
    }
    const data = await res.json();
    return data.user || data;
  } catch (e) {
    console.warn('[Auth] Token verification error:', e);
    return null;
  }
}

async function fetchJson(path, opts = {}, retry = true) {
  const token = getIdToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!token && path.includes('/contacts')) {
    throw new Error('No token');
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401 && retry) {
    const newTok = await refreshIdToken();
    if (newTok) {
      return fetchJson(path, opts, false);
    }
    // token refresh failed; fall through to error
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const apiClient = {
  createRoom: (title = 'Coverse Session') => fetchJson('/api/rooms', { method: 'POST', body: JSON.stringify({ title }) }),
  joinRoom: (roomId, joinCode = '') => fetchJson(`/api/rooms/${roomId}/join`, { method: 'POST', body: JSON.stringify({ joinCode }) }),
  fetchRoster: (roomId) => fetchJson(`/api/rooms/${roomId}/roster`),
  sendInvite: (roomId, payload) => fetchJson(`/api/rooms/${roomId}/invite`, { method: 'POST', body: JSON.stringify(payload) }),
  listInvites: (roomId) => fetchJson(`/api/rooms/${roomId}/invites`),
  listContacts: () => fetchJson('/api/contacts')
};

function setAuthStatus(msg, warn = false) {
  const bar = document.getElementById('authStatus');
  if (bar) {
    bar.textContent = msg;
    bar.classList.toggle('warning', warn);
  }
  const status = document.getElementById('callStatus');
  if (status) status.textContent = msg;
  lastAuthMsg = msg;
}

// DEPRECATED: Hidden auth frame injection disabled permanently.
// Embedding causes Firebase auth failures and signout loops.
// Auth now handled via dedicated BrowserWindow + IPC.
function injectAuthFrame() {
  // No-op: embedding is architecturally unsound for Firebase auth
  return;
}


function createSignalClient(roomId, token, handlers = {}) {
  const url = `wss://coversehq.com/ws/signal?roomId=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
  let ws = null;
  let heartbeat = null;
  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 20000);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'pong') return;
        if (msg.type === 'presence') handlers.onPresence && handlers.onPresence(msg);
        if (msg.type === 'signal') handlers.onSignal && handlers.onSignal(msg);
        if (msg.type === 'producer-update') handlers.onProducer && handlers.onProducer(msg);
      } catch (e) {
        console.warn('signal parse', e);
      }
    };
    ws.onclose = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      setTimeout(connect, 2000); // auto-reconnect
    };
    ws.onerror = () => ws.close();
  };
  connect();
  return {
    sendSignal: (targetId, payload) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'signal', targetId, payload }));
    },
    send: (obj) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    },
    close: () => ws && ws.close()
  };
}

// ---- Firebase auth helpers ----
async function loadFirebase() {
  if (window.firebase) return;
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'
  ];
  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
}

function initFirebaseAuth() {
  if (!window.firebase || firebaseApp) return;
  firebaseApp = window.firebase.initializeApp(firebaseConfig);
  firebaseAuth = window.firebase.auth();
  // Ensure persistence works under file://
  if (firebaseAuth?.setPersistence && window.firebase?.auth?.Auth?.Persistence) {
    firebaseAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch((e) => console.warn('persistence set failed', e));
  }
  firebaseAuth.onIdTokenChanged(async (user) => {
    authUser = user;
    const token = user ? await user.getIdToken() : '';
    if (token) localStorage.setItem('coverseIdToken', token);
    else localStorage.removeItem('coverseIdToken');
    updateAuthUI();
  });
}

function loginWithGoogle() {
  const status = document.getElementById('callStatus');
  const proto = window.location?.protocol || '';
  if (proto !== 'https:' && proto !== 'http:' && proto !== 'chrome-extension:') {
    status && (status.textContent = 'Google sign-in not supported in this environment. Use email login.');
    return;
  }
  if (!firebaseAuth) {
    status && (status.textContent = 'Auth not ready');
    return;
  }
  const provider = new window.firebase.auth.GoogleAuthProvider();
  firebaseAuth.signInWithPopup(provider)
    .then(() => {
      status && (status.textContent = 'Signed in');
    })
    .catch((err) => {
      console.warn('Google sign-in failed', err);
      status && (status.textContent = 'Google sign-in not supported here; use Email login');
    });
}

function updateAuthUI() {
  const btnLogin = document.getElementById('btnLoginMenu') || document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogoutMenu') || document.getElementById('btnLogout');
  const avatar = document.getElementById('authAvatar');
  const menuName = document.getElementById('authMenuName');
  const hasUser = authUser || authProfile;
  if (hasUser) {
    const name = authUser?.displayName || authUser?.email || authUser?.uid ||
                 authProfile?.displayName || authProfile?.email || authProfile?.uid || '?';
    if (avatar) avatar.textContent = name.slice(0,1).toUpperCase();
    if (menuName) menuName.textContent = name;
    btnLogin?.classList.add('hidden');
    btnLogout?.classList.add('hidden'); // hide inline controls
    const menu = document.getElementById('authMenu');
    menu?.classList.add('hidden');
    loadContacts();
    setAuthStatus('Signed in', false);
  } else {
    if (avatar) avatar.textContent = '?';
    if (menuName) menuName.textContent = 'Not signed in';
    btnLogin?.classList.add('hidden');
    btnLogout?.classList.add('hidden');
    renderContacts([], document.getElementById('contactsList'));
    setAuthStatus('Not signed in', true);
  }
  updateAuthDebug();
}

function updateAuthDebug() {
  const dbg = document.getElementById('authDebug');
  if (!dbg) return;
  const token = getIdToken();
  const shortTok = token ? `${token.slice(0, 6)}...` : 'none';
  const source = authProfile ? 'site' : authUser ? 'firebase' : 'none';
  dbg.textContent = `Auth source: ${source} | token: ${shortTok} | last: ${lastAuthMsg} | msg: ${lastMessageSeen}`;
}

// Contacts rendering/loading
function renderContacts(list = [], targetEl = null, term = '') {
  if (!targetEl) targetEl = document.getElementById('contactsList');
  if (!targetEl) return;
  const filter = term.toLowerCase();
  const roleFilter = (document.getElementById('discoverRoleFilter')?.value || 'all').toLowerCase();
  const filtered = list
    .filter((c) => (c.displayName || c.email || c.name || '').toLowerCase().includes(filter))
    .filter((c) => {
      if (roleFilter === 'all') return true;
      const r = lookupRole(c);
      return r === roleFilter;
    });
  const grid = document.getElementById('discoverGrid');
  if (grid) {
    grid.innerHTML = '';
    filtered.slice(0, 20).forEach((c) => {
      const card = document.createElement('div');
      card.className = 'discover-card';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = c.displayName || c.name || c.email || c.id;
      const role = document.createElement('div');
      role.className = 'role';
      role.textContent = lookupRole(c) || '—';
      const loc = document.createElement('div');
      loc.className = 'loc';
      loc.textContent = c.location || c.city || c.country || '';
      const actions = document.createElement('div');
      actions.className = 'actions';
      const viewBtn = document.createElement('button');
      viewBtn.className = 'pill ghost';
      viewBtn.textContent = 'View';
      const connectBtn = document.createElement('button');
      connectBtn.className = 'pill';
      connectBtn.textContent = 'Connect';
      connectBtn.addEventListener('click', async () => {
        try {
          const room = (document.getElementById('callRoom')?.value || '').trim();
          if (!room) {
            showToast('Enter a room first.', 'warn');
            return;
          }
          await sendInviteOrWs(room, { id: c.id || c.uid, email: c.email }, c.displayName || c.name || c.email || 'user');
          showToast(`Invite sent to ${c.displayName || c.name || c.email || 'user'}`, 'success');
        } catch (err) {
          showToast('Invite failed', 'error');
        }
      });
      actions.append(viewBtn, connectBtn);
      card.append(name, role, loc, actions);
      grid.appendChild(card);
    });
    if (!filtered.length) grid.innerHTML = '<div class="status">No profiles match this filter.</div>';
  }
  if (!filtered.length) {
    targetEl.innerHTML = '<div class="status">No contacts returned. Refresh after signing in.</div>';
    return;
  }
  targetEl.innerHTML = '';
  filtered.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'contact-row';
    const name = document.createElement('div');
    name.className = 'contact-name';
    name.textContent = c.displayName || c.name || c.email || c.id;
    const btn = document.createElement('button');
    btn.className = 'pill ghost';
    btn.textContent = 'Invite';
    btn.addEventListener('click', async () => {
      try {
        const room = (document.getElementById('callRoom')?.value || '').trim();
        if (!room) {
          document.getElementById('callStatus').textContent = 'Enter a room first.';
          return;
        }
        await sendInviteOrWs(room, { id: c.id || c.uid, email: c.email }, name.textContent || 'user');
        document.getElementById('callStatus').textContent = `Invite sent to ${name.textContent}`;
      } catch (err) {
        document.getElementById('callStatus').textContent = 'Invite failed';
      }
    });
    row.append(name, btn);
    targetEl.appendChild(row);
  });
}

function renderConversations() {
  const listEl = document.getElementById('convoList');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!conversations.length) {
    listEl.innerHTML = '<div class="status">No conversations.</div>';
    return;
  }
  conversations.forEach((c) => {
    let otherId = c.otherUserId || c.otherUser || c.userId || '';
    if (!otherId && Array.isArray(c.participants)) {
      const self = getSelfId();
      otherId = c.participants.find(p => p !== self) || c.participants[0] || '';
    }
    if (!otherId && Array.isArray(c.userIds)) {
      const self = getSelfId();
      otherId = c.userIds.find(p => p !== self) || c.userIds[0] || '';
    }
    let displayName = c.otherUserName || c.displayName || c.name || c.title || c.lastMessageSenderName || '';
    if (!displayName) displayName = lookupName(otherId);
    if (!displayName) displayName = otherId || 'Thread';
    const row = document.createElement('div');
    row.className = 'message-row';
    const left = document.createElement('div');
    left.innerHTML = `<div class="contact-name">${displayName}</div><div class="meta">${c.lastMessage || ''}</div>`;
    const badge = document.createElement('div');
    badge.className = 'meta';
    badge.textContent = c.unreadCount ? `${c.unreadCount} new` : '';
    row.append(left, badge);
    row.addEventListener('click', () => {
      currentThreadUser = otherId || '';
      document.getElementById('threadTitle').textContent = displayName;
      if (currentThreadUser) {
        loadMessages(currentThreadUser);
      } else {
        const msgEl = document.getElementById('messagesList');
        if (msgEl) msgEl.innerHTML = '<div class="status">Cannot load: missing user id in conversation.</div>';
      }
    });
    listEl.appendChild(row);
  });
}

function renderMessages(msgs = [], otherUserId = '', raw = null) {
  const listEl = document.getElementById('messagesList');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!msgs.length) {
    listEl.innerHTML = '<div class="status">No messages.</div>';
    return;
  }
  // Sort by timestamp ascending so newest is at the bottom
  const ts = (m) => {
    const t = m.timestamp || m.sentAt || m.createdAt || m.created || m.time;
    const d = t ? new Date(t) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  };
  msgs = [...msgs].sort((a, b) => ts(a) - ts(b));

  const fmt = (ts) => {
    const d = ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  msgs.forEach((m) => {
    const item = document.createElement('div');
    const sender = m.senderId || m.sender || m.from || m.userId || '';
    const senderName = m.senderName || m.displayName || lookupName(sender) || sender;
    const isMe = sender && (authProfile?.uid === sender || authUser?.uid === sender);
    item.className = 'message-item' + (isMe ? ' me' : ' them');
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = m.text || m.message || m.body || JSON.stringify(m);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${senderName || ''} • ${fmt(m.timestamp || m.sentAt || m.createdAt)}`;
    item.append(body, meta);
    listEl.appendChild(item);
  });
}

async function loadContacts() {
  const statusEl = document.getElementById('contactsStatus');
  if (statusEl) statusEl.textContent = 'Loading contacts...';
  const connectionsBox = document.getElementById('callConnections');
  try {
    const res = await apiClient.listContacts();
    let merged = res.contacts || res.friends || res.following || [];

    // Try followers endpoint if available and merge
    try {
      const followersRes = await fetchJson('/api/followers');
      const followers = followersRes.followers || followersRes.contacts || [];
      const seen = new Set(merged.map((c) => c.id || c.uid || c.email));
      followers.forEach((f) => {
        const key = f.id || f.uid || f.email;
        if (key && !seen.has(key)) {
          merged.push(f);
          seen.add(key);
        }
      });
    } catch (e) {
      // silently ignore if endpoint not present
    }

    contacts = merged;
    const listEl = document.getElementById('contactsList');
    if (listEl) listEl.setAttribute('data-count', String(contacts.length));
    renderContacts(contacts, listEl, document.getElementById('contactsSearch')?.value || '');
    if (connectionsBox) {
      connectionsBox.innerHTML = '';
      contacts.forEach((c) => {
        const row = document.createElement('div');
        row.className = 'contact-row';
        const name = document.createElement('div');
        name.className = 'contact-name';
        name.textContent = c.displayName || c.name || c.email || c.id;
        const btn = document.createElement('button');
        btn.className = 'pill ghost';
        btn.textContent = 'Invite';
        btn.addEventListener('click', async () => {
          try {
            const room = getActiveRoom();
            if (!room) return;
            await sendInviteOrWs(room, { id: c.id || c.uid, email: c.email }, c.displayName || c.name || c.email || c.id || 'user');
          } catch (e) {
            console.warn('Invite failed, using local notice', e);
            showToast('Invite queued (local only)', 'info');
            const msg = 'Invite queued locally (no server)';
            addNotification(msg);
            try {
              notifyChannel?.postMessage({ text: msg });
            } catch (_) {}
          }
        });
        row.append(name, btn);
        connectionsBox.appendChild(row);
      });
      if (!contacts.length) connectionsBox.textContent = 'No connections.';
    }
    if (statusEl) statusEl.textContent = `Loaded ${contacts.length} contact(s)`;
    console.log('Contacts response', res, 'merged size', contacts.length);
  } catch (err) {
    const connectionsBox = document.getElementById('callConnections');
    console.warn('Contacts load failed, trying followers fallback', err);
    try {
      const followersRes = await fetchJson('/api/followers');
      const followers = followersRes.followers || followersRes.contacts || [];
      contacts = followers;
      renderContacts(contacts, document.getElementById('contactsList'), '');
      if (connectionsBox) {
        connectionsBox.innerHTML = '';
        contacts.forEach((c) => {
          const row = document.createElement('div');
          row.className = 'contact-row';
          const name = document.createElement('div');
          name.className = 'contact-name';
          name.textContent = c.displayName || c.name || c.email || c.id;
          row.appendChild(name);
          connectionsBox.appendChild(row);
        });
        if (!contacts.length) connectionsBox.textContent = 'No connections.';
      }
      if (statusEl) statusEl.textContent = `Loaded ${contacts.length} follower(s)`;
    } catch (err2) {
      const target = document.getElementById('contactsList');
      if (target) target.innerHTML = '<div class="status warning">Could not load contacts. Make sure you are signed in (try signing in on the CoverseHQ tab).</div>';
      if (statusEl) statusEl.textContent = 'Contacts load failed';
      console.warn('Contacts follower fallback failed', err2);
    }
  }
}

async function loadConversations() {
  const statusEl = document.getElementById('messagesStatus');
  if (statusEl) statusEl.textContent = 'Loading conversations...';
  try {
    const res = await fetchConversations();
    conversations = res.conversations || [];
    console.log('Conversations response', res);
    renderConversations();
    if (statusEl) statusEl.textContent = `Loaded ${conversations.length} conversation(s)`;
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Conversations load failed';
    console.warn('Conversations load failed', e);
  }
}

async function loadMessages(otherUserId) {
  const statusEl = document.getElementById('messagesStatus');
  if (statusEl) statusEl.textContent = 'Loading messages...';
  try {
    const primary = await fetchMessages(otherUserId || '');
    let msgs = normalizeMsgs(primary);
    renderMessages(msgs || [], otherUserId, primary);
    if (!currentThreadUser && msgs && msgs.length) {
      const selfId = getSelfId();
      const other = msgs.find(m => (m.senderId || m.sender || m.from || m.userId) && (m.senderId || m.sender || m.from || m.userId) !== selfId);
      if (other) {
        lastThreadOther = other.senderId || other.sender || other.from || other.userId || '';
      } else {
        // fallback from receiver fields
        const other2 = msgs.find(m => (m.receiverId || m.receiver || m.to) && (m.receiverId || m.receiver || m.to) !== selfId);
        lastThreadOther = other2 ? (other2.receiverId || other2.receiver || other2.to || '') : '';
      }
    }
    if (statusEl) statusEl.textContent = `Loaded ${msgs?.length || 0} message(s)`;
  } catch (e) {
    console.warn('Messages load failed', e);
    const listEl = document.getElementById('messagesList');
    if (listEl) listEl.innerHTML = `<div class="status warning">Error loading messages: ${e.message || e}</div>`;
    if (statusEl) statusEl.textContent = 'Messages load failed (server error)';
  }
}

function normalizeMsgs(res) {
  let msgs =
    res?.messages ||
    res?.thread?.messages ||
    res?.items ||
    res?.data?.messages ||
    res?.messagesByThread ||
    [];
  if (msgs && !Array.isArray(msgs)) msgs = Object.values(msgs);
  return msgs;
}
function sendProducerUpdate(targetId, data = {}) {
  try {
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
      signalingSocket.send(JSON.stringify({ type: 'producer-control', targetId, ...data }));
    }
  } catch (err) {
    console.warn('producer send failed', err);
  }
}

async function init() {
  // set up tabs early so nav works even if later steps fail
  setupTabs();

  if (!window.coverse) {
    console.warn('coverse bridge missing, init aborted');
    return;
  }

  try {
    await loadFirebase();
    initFirebaseAuth();
  } catch (err) {
    console.warn('Firebase load failed', err);
  }
  // NOTE: Hidden auth frame disabled - use dedicated BrowserWindow instead
  // injectAuthFrame();
  const cached = getIdToken();
  if (cached) {
    setAuthStatus('Signed in (cached)', false);
    updateAuthUI();
    loadContacts();
    loadConversations();
  }
  // site tab loads first; overlay removed

  const els = {
    callRoom: document.getElementById('callRoom'),
    signaling: document.getElementById('signalingUrl'),
    start: document.getElementById('btnStartCall'),
    stop: document.getElementById('btnEndCall'),
    callStatus: document.getElementById('callStatus'),
    localLarge: document.getElementById('localLarge'),
  toggleCamera: document.getElementById('btnToggleCamera'),
  toggleMic: document.getElementById('btnToggleMic'),
  toggleHQ: document.getElementById('btnToggleHQ'),
  shareScreen: document.getElementById('btnShareScreen'),
    localVideo: document.getElementById('localVideo'), // prejoin preview
    localVideoSettings: document.getElementById('localVideoSettings'),
    remoteVideo: document.getElementById('remoteVideo'),
    localScreen: document.getElementById('localScreen'),
    remoteScreen: document.getElementById('remoteScreen'),
    sharePreview: document.getElementById('sharePreview'),
    cameraSelect: document.getElementById('cameraSelect'),
    micSelect: document.getElementById('micSelect'),
    speakerSelect: document.getElementById('speakerSelect'),
    refreshDevices: document.getElementById('btnRefreshDevices'),
    testMic: document.getElementById('btnTestMic'),
    testCamPre: document.getElementById('btnTestCamPre'),
    testCamSettings: document.getElementById('btnTestCamSettings'),
    micMeter: document.getElementById('micMeter'),
    screenSelect: document.getElementById('screenSelect'),
    pickScreen: document.getElementById('btnPickScreen'),
    fullscreenLocal: document.getElementById('btnFullscreenLocal'),
    fullscreenRemote: document.getElementById('btnFullscreenRemote'),
    btnHideLocalCam: document.getElementById('btnHideLocalCam'),
    btnHideRemoteCam: document.getElementById('btnHideRemoteCam'),
    btnResetLayout: document.getElementById('btnResetLayout'),
    helperInfo: document.getElementById('helperInfo'),
    helperStatus: document.getElementById('helperStatus'),
    helperTarget: document.getElementById('helperTarget'),
    helperStart: document.getElementById('helperStart'),
    helperStop: document.getElementById('helperStop'),
    joinModal: document.getElementById('joinModal'),
    joinCodeInput: document.getElementById('joinCodeInput'),
    joinNameInput: document.getElementById('joinNameInput'),
    joinNoAudio: document.getElementById('joinNoAudio'),
    joinNoVideo: document.getElementById('joinNoVideo'),
    joinConfirm: document.getElementById('btnJoinConfirm'),
    joinCancel: document.getElementById('btnJoinCancel'),
    cameraSelectPre: document.getElementById('cameraSelectPre'),
    micSelectPre: document.getElementById('micSelectPre'),
    micMeterPreview: document.getElementById('micMeterPreview'),
    listDevices: document.getElementById('btnListDevices'),
    listSources: document.getElementById('btnListSources'),
    devices: document.getElementById('devicesList'),
    sources: document.getElementById('sourcesList'),
    manifest: document.getElementById('manifest')
  };

  let cfg = null;
  try {
    cfg = await window.coverse.getConfig();
  } catch (err) {
    console.warn('getConfig failed, using defaults', err);
    cfg = { signaling: { url: 'ws://localhost:5181', token: '' }, useLocalUi: true };
  }
  console.log('[config]', cfg);
  configCache = cfg;
  els.signaling.value = cfg.signaling?.url || 'wss://coversehq.com';
  if (els.signaling) {
    els.signaling.readOnly = true;
  }
  els.callStatus.textContent = cfg.useLocalUi ? 'Local UI active' : 'Remote site';
  if (els.manifest) {
    els.manifest.textContent = JSON.stringify(manifestSchema, null, 2);
  }
  try {
    await refreshDevices(els);
  } catch (err) {
    console.warn('refreshDevices failed', err);
  }
  await ensureLocalPreview();
  
  // Initialize layout system with default solo layout
  setCallLayout('solo');
  
  if (els.testMic) els.testMic.textContent = 'Test Mic';
  // Icons are now inline SVGs in HTML - no need to recreate them
  // drawer controls handle visibility
  mirrorSelect('micSelect', 'micSelectToolbar');
  mirrorSelect('cameraSelect', 'cameraSelectToolbar');
  mirrorSelect('speakerSelect', 'speakerSelectToolbar');
  mirrorSelect('micSelect', 'callAudioSelectToolbar');
  // toolbar dropdowns removed


  if (els.helperInfo || els.helperStatus) {
    const runtime = await window.coverse.helper.runtime();
    if (els.helperInfo) els.helperInfo.textContent = JSON.stringify(runtime, null, 2);
    if (els.helperStatus) {
      els.helperStatus.textContent = runtime.helperAvailable ? 'Helper available' : 'Helper pending install';
      els.helperStatus.classList.toggle('warning', !runtime.helperAvailable);
    }
  }

  window.coverse.onVSTMessage((message) => {
    console.log('Message from VST:', message);
    if (message.type === 'transport') {
      console.log('DAW Transport:', message.playing ? 'Playing' : 'Stopped', 'BPM:', message.bpm);
    }
  });

  els.start?.addEventListener('click', () => {
    const room = (els.callRoom.value || 'room-local').trim();
    activeRoom = room;
    if (typeof syncInviteState === 'function') syncInviteState();
    const url = normalizeSignalUrl((configCache?.signaling?.url || els.signaling?.value || '').trim());
    if (!url) {
      els.callStatus.textContent = 'Provide a signaling URL to start a call.';
      return;
    }
    if (signalingSocket) {
      els.callStatus.textContent = `Already in room ${currentRoom}`;
      return;
    }
    connectSignaling(url, room, configCache?.signaling?.token, els.callStatus);
  });

  els.stop?.addEventListener('click', () => {
    if (signalingSocket) {
      signalingSocket.close();
      signalingSocket = null;
      currentRoom = null;
    }
    teardownCall();
    els.callStatus.textContent = 'Ended';
  });
  document.getElementById('btnEndCallTop')?.addEventListener('click', () => {
    els.stop?.click();
  });

  els.helperTarget?.addEventListener('click', async () => {
    const windowId = (els.callRoom.value || '').trim();
    if (!windowId) {
      els.helperStatus.textContent = 'Set a room code first to target the helper.';
      els.helperStatus.classList.add('warning');
      return;
    }
    const res = await window.coverse.helper.setTargetWindow(windowId);
    els.helperStatus.textContent = `Target set (${res.ok ? 'ok' : res.reason || 'pending helper'})`;
  });

  els.helperStart?.addEventListener('click', async () => {
    const res = await window.coverse.helper.startControl(els.callRoom.value || 'window-id');
    els.helperStatus.textContent = res.ok ? 'Control started' : `Control unavailable: ${res.reason || 'helper missing'}`;
    els.helperStatus.classList.toggle('warning', !res.ok);
  });

  els.helperStop?.addEventListener('click', async () => {
    const res = await window.coverse.helper.stopControl();
    els.helperStatus.textContent = res.ok ? 'Control stopped' : 'Stopped (stub)';
  });

  els.listDevices?.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      if (els.devices) els.devices.textContent = 'Media devices API not available';
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (els.devices) els.devices.textContent = JSON.stringify(devices.map(d => ({ kind: d.kind, label: d.label, id: d.deviceId })), null, 2);
  });

  els.listSources?.addEventListener('click', async () => {
    const sources = await window.coverse.getSources();
    if (els.sources) els.sources.textContent = JSON.stringify(sources.map(s => ({ id: s.id, name: s.name })), null, 2);
  });

  // (Call tab handlers defined later to avoid duplicate listeners)
  els.screenSelect?.addEventListener('change', () => {
    screenSourceId = els.screenSelect.value;
  });
  els.refreshDevices?.addEventListener('click', () => refreshDevices(els));
  els.testMic?.addEventListener('click', () => testMic(els.callStatus, els.micMeterPreview || els.micMeter, els.testMic));
  if (els.micSelectPre) {
    els.micSelectPre.disabled = false;
  }
  if (els.cameraSelectPre) {
    els.cameraSelectPre.disabled = false;
  }
  if (els.speakerSelect) {
    els.speakerSelect.disabled = false;
  }
  els.testCamPre?.addEventListener('click', () => testCam(els.callStatus, els.localVideo, els.testCamPre));
  els.testCamSettings?.addEventListener('click', () => testCam(els.callStatus, els.localVideoSettings || els.localVideo, els.testCamSettings));
  els.cameraSelect?.addEventListener('change', () => {
    cameraDeviceId = els.cameraSelect.value;
    if (isCameraOn) toggleCamera(els.callStatus, els.localVideo, true);
  });
  els.micSelect?.addEventListener('change', () => {
    micDeviceId = els.micSelect.value;
    restartAudioChains(els.callStatus);
  });
  els.pickScreen?.addEventListener('click', async () => {
    const sources = await window.coverse.getSources();
    screenSourceId = sources?.[0]?.id || '';
    populateScreens(els, sources);
  });
  els.screenSelect?.addEventListener('change', () => {
    screenSourceId = els.screenSelect.value;
  });
  els.fullscreenLocal?.addEventListener('click', () => requestFullscreen(els.localVideo));
  els.fullscreenRemote?.addEventListener('click', () => requestFullscreen(els.remoteVideo));

  els.btnHideLocalCam?.addEventListener('click', () => toggleTile('localCam'));
  els.btnHideRemoteCam?.addEventListener('click', () => toggleTile('remoteCam'));
  els.btnResetLayout?.addEventListener('click', resetLayout);

  // Host/Join flow
  const hostBtn = document.getElementById('btnHostCall');
  const joinBtn = document.getElementById('btnJoinCall');
  const joinRoomPrimary = document.getElementById('btnQuickCall');
  const joinHostRow = null;
  const enterBtn = document.getElementById('btnEnterCall');
  const cancelPrejoin = document.getElementById('btnPrejoinCancel');
  const rosterList = document.getElementById('rosterList');
  const rosterSearch = document.getElementById('rosterSearch');
  const stripPane = document.getElementById('stripPane');
  const btnPopout = document.getElementById('btnPopout');
  const drawer = document.getElementById('sideDrawer');
  const drawerTitle = document.getElementById('drawerTitle');
  const drawerConnections = document.getElementById('drawerConnections');
  const drawerMixer = document.getElementById('drawerMixer');
  // auth controls (bubble only)
  const btnLogin = null;
  const btnLogout = document.getElementById('btnLogoutMenu') || document.getElementById('btnLogout');
  const authUserLabel = document.getElementById('authUser');
  const authBubble = document.getElementById('authBubble');
  const authMenu = document.getElementById('authMenu');
  const authEmail = document.getElementById('authEmail');
  const authPass = document.getElementById('authPass');
  const contactsList = document.getElementById('contactsList');
  const connectionsBox = document.getElementById('callConnections');
  const contactsSearch = document.getElementById('contactsSearch');
  const btnContactsRefresh = document.getElementById('btnContactsRefresh');
  const contactsStatus = document.getElementById('contactsStatus');
  const convoList = document.getElementById('convoList');
  const messagesList = document.getElementById('messagesList');
  const messagesStatus = document.getElementById('messagesStatus');
  const btnMessagesRefresh = document.getElementById('btnMessagesRefresh');
  const btnSendMessage = document.getElementById('btnSendMessage');
  const messageText = document.getElementById('messageText');
  const threadTitle = document.getElementById('threadTitle');
  const popLocal = document.getElementById('popLocal');
  const popRemote = document.getElementById('popRemote');
  const btnDetachLocal = document.getElementById('btnDetachLocal');
  const btnDetachRemote = document.getElementById('btnDetachRemote');
  const miniLocalBtn = document.getElementById('miniLocalBtn');
  const miniRemoteBtn = document.getElementById('miniRemoteBtn');
  const popInviteInput = document.getElementById('popInviteInput');
  const popInviteSend = document.getElementById('popInviteSend');
  const popRemoteToggle = document.getElementById('popRemoteToggle');
  const popRemoteSearch = document.getElementById('popRemoteSearch');
  const callRosterBox = document.getElementById('callRoster');

  let signalClient = null;

  renderRoster(roster);
  rosterSearch?.addEventListener('input', (e) => {
    renderRoster(roster, e.target.value || '');
  });
  renderStrips();
  renderCallLayout(false);

  // ensure modals are hidden on load
  hidePrejoin();
  hideJoinModal(els);

  // cross-window notifications (same machine)
  try {
    notifyChannel = new BroadcastChannel('coverse-notify');
    notifyChannel.onmessage = (ev) => {
      if (ev?.data?.text) addNotification(ev.data.text);
    };
    inviteChannel = new BroadcastChannel('coverse-invite');
    inviteChannel.onmessage = (ev) => {
      if (ev?.data?.type === 'invite' && ev.data.payload) {
        console.log('[invite-channel] incoming', ev.data.payload);
        addInviteNotification(ev.data.payload);
        showToast('Invite received (local)', 'info');
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel unavailable', e);
  }

  // keep a passive signaling socket in lobby to receive invites even before starting a call
  connectLobby();

  const btnStartEnd = document.getElementById('btnStartEnd');
  const setStartEndLabel = (running) => {
    const lbl = btnStartEnd?.querySelector('.label');
    const icon = btnStartEnd?.querySelector('.icon');
    if (lbl) lbl.textContent = running ? 'End Call' : 'Start Call';
    btnStartEnd?.setAttribute('aria-label', running ? 'End Call' : 'Start Call');
    if (icon) {
      icon.className = `icon ${running ? 'svg-phone-slash' : 'svg-call'}`;
    }
  };

  btnStartEnd?.addEventListener('click', () => {
    if (signalingSocket && inCall) {
      signalingSocket.close();
      teardownCall();
      inCall = false;
      setStartEndLabel(false);
      return;
    }
    const room = (els.callRoom.value || `room-${Math.random().toString(36).slice(2, 8)}`).trim();
    els.callRoom.value = room;
    activeRoom = room;
  const url = normalizeSignalUrl((configCache?.signaling?.url || els.signaling?.value || 'ws://localhost:5181').trim());
    connectSignaling(url, room, configCache?.signaling?.token, els.callStatus);
    setStartEndLabel(true);
  });
  setStartEndLabel(false);

  const invitePanel = document.getElementById('callConnections');
  const setDrawer = (mode, open) => {
    if (!drawer) return;
    drawer.classList.toggle('hidden', !open);
    drawer.classList.toggle('open', open);
    const shell = document.querySelector('.studio-shell');
    if (shell) shell.classList.toggle('drawer-open', open);
    if (drawerTitle) drawerTitle.textContent = mode === 'mixer' ? 'Mixer' : 'Connections';
    if (drawerConnections) drawerConnections.classList.toggle('hidden', mode !== 'connections');
    if (drawerMixer) drawerMixer.classList.toggle('hidden', mode !== 'mixer');
  };

  document.getElementById('btnInvite')?.addEventListener('click', () => {
    const open = !(drawer && drawer.classList.contains('open') && drawerConnections && !drawerConnections.classList.contains('hidden'));
    setDrawer('connections', open);
    if (open) addNotification(`Room: ${getActiveRoom() || 'not set'}`);
  });

  document.getElementById('btnMixer')?.addEventListener('click', () => {
    const open = !(drawer && drawer.classList.contains('open') && drawerMixer && !drawerMixer.classList.contains('hidden'));
    setDrawer('mixer', open);
  });

  document.getElementById('btnDrawerClose')?.addEventListener('click', () => setDrawer('connections', false));

  // keep Invite button disabled until room set/active
  const roomInput = document.getElementById('callRoom');
  const inviteBtn = document.getElementById('btnInvite');
  const syncInviteState = () => {
    if (!inviteBtn) return;
    const val = (roomInput?.value || '').trim() || activeRoom;
    inviteBtn.disabled = !val;
  };
  roomInput?.addEventListener('input', syncInviteState);
  syncInviteState();

  // legacy host/join modal removed for simplicity

  enterBtn?.addEventListener('click', async () => {
    if (signalingSocket) {
      els.callStatus.textContent = `Already in room ${currentRoom}`;
      return;
    }
    // not used anymore
  });

  cancelPrejoin?.addEventListener('click', () => {
    hidePrejoin();
  });

  setupDraggables();
  resetLayout();

  btnLogin?.addEventListener('click', () => {
    loginWithGoogle();
  });
  btnLogout?.addEventListener('click', () => {
    if (firebaseAuth) firebaseAuth.signOut();
  });
  authBubble?.addEventListener('click', () => {
    // menu removed; no toggle
  });
  document.addEventListener('click', (e) => {
    // menu removed
  });
  btnContactsRefresh?.addEventListener('click', () => loadContacts());
  contactsSearch?.addEventListener('input', () => renderContacts(contacts, contactsList, contactsSearch?.value || ''));
  const roleFilter = document.getElementById('discoverRoleFilter');
  roleFilter?.addEventListener('change', () => renderContacts(contacts, contactsList, contactsSearch?.value || ''));
  btnMessagesRefresh?.addEventListener('click', () => loadConversations());
  const sendCurrentMessage = async () => {
    const text = messageText?.value?.trim();
    if (!text) return;
    const targetUser = currentThreadUser || lastThreadOther;
    if (!targetUser && !currentThreadId) {
      showToast('Select a conversation before sending.', 'warn');
      return;
    }
    try {
      // require receiverId; if missing, warn
      if (!targetUser) {
        showToast('No recipient for this conversation.', 'warn');
        return;
      }
      await sendMessage(targetUser, text, currentThreadId);
      messageText.value = '';
      // optimistic append so user sees it immediately
      const nowIso = new Date().toISOString();
      messages = messages || [];
      const sender = getSelfId() || 'me';
      messages.push({
        text,
        senderId: sender,
        receiverId: targetUser,
        timestamp: nowIso,
        createdAt: nowIso,
      });
      renderMessages(messages);
      // sync with server to pull any failures/order corrections
      loadMessages(targetUser);
    } catch (e) {
      console.error('sendMessage failed', e);
      showToast('Send failed', 'error');
    }
  };
  const btnQuickInvite = document.getElementById('btnQuickInvite');
  btnQuickInvite?.addEventListener('click', async () => {
    const targetUser = currentThreadUser || lastThreadOther;
    if (!targetUser) {
      showToast('Select a conversation first.', 'warn');
      return;
    }
    const room = (document.getElementById('callRoom')?.value || '').trim();
    if (!room) {
      showToast('Enter a room before inviting.', 'warn');
      return;
    }
    try {
      await sendInviteOrWs(room, { id: targetUser }, targetUser || 'user');
    } catch (e) {
      console.warn('Invite failed', e);
      showToast('Invite failed', 'error');
    }
  });

  const deviceDropdown = document.getElementById('deviceDropdown');
  const quickSelect = document.getElementById('quickSelect');
  function showQuickSelect(sourceSelect) {
    if (!deviceDropdown || !quickSelect || !sourceSelect) return;
    if (!sourceSelect.options.length) {
      refreshDevices(els).catch(() => {});
    }
    quickSelect.innerHTML = '';
    Array.from(sourceSelect.options).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.textContent;
      quickSelect.appendChild(o);
    });
    deviceDropdown.classList.remove('hidden');
    quickSelect.onchange = () => {
      sourceSelect.value = quickSelect.value;
      const evt = new Event('change');
      sourceSelect.dispatchEvent(evt);
      deviceDropdown.classList.add('hidden');
    };
  }
  document.getElementById('btnToggleCamera')?.addEventListener('click', (e) => {
    toggleCamera(document.getElementById('callStatus'), document.getElementById('localVideo'), false)
      .then(() => {
        const lv = document.getElementById('localVideo');
        const large = document.getElementById('localLarge');
        if (large && lv?.srcObject) large.srcObject = lv.srcObject;
        setIconState('btnToggleCamera', isCameraOn);
      })
      .catch(() => {});
  });
  document.getElementById('btnToggleMic')?.addEventListener('click', (e) => {
    toggleMic(document.getElementById('callStatus'), false)
      .then(() => {
        if (els.localLarge && els.localVideo?.srcObject) els.localLarge.srcObject = els.localVideo.srcObject;
        setIconState('btnToggleMic', isMicOn);
      })
      .catch(() => {});
  });
  document.getElementById('btnShareScreen')?.addEventListener('click', () => {
    const preview = document.getElementById('sharePreview') || null;
    shareScreen(document.getElementById('callStatus'), document.getElementById('btnShareScreen'), preview);
  });
  
  // Layout menu - replaces old format menu
  const layoutMenu = document.getElementById('layoutMenu');
  document.getElementById('btnLayoutToggle')?.addEventListener('click', () => {
    if (layoutMenu) layoutMenu.classList.toggle('hidden');
  });
  layoutMenu?.querySelectorAll('button[data-layout]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-layout') || 'solo';
      setCallLayout(layout);
      // Update active state
      layoutMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      layoutMenu.classList.add('hidden');
    });
  });
  
  const qualityMenu = document.getElementById('qualityMenu');
  document.getElementById('btnQualityToggle')?.addEventListener('click', () => {
    if (qualityMenu) qualityMenu.classList.toggle('hidden');
  });
  qualityMenu?.querySelectorAll('button[data-quality]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-quality') || 'low';
      selectedQuality = q;
      // restart local preview with new constraints
      ensureLocalPreview();
      attachLocalTracks();
      bumpSenderBitrates();
      qualityMenu.classList.add('hidden');
    });
  });
  document.getElementById('btnFullscreenCam')?.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    const pane = document.getElementById('callVideoPane') || document.documentElement;
    pane.requestFullscreen?.();
  });
  document.getElementById('btnExitFullscreen')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
  });
  document.addEventListener('fullscreenchange', () => {
    const fsBtn = document.getElementById('btnExitFullscreen');
    if (!fsBtn) return;
    fsBtn.classList.toggle('hidden', !document.fullscreenElement);
  });
  document.getElementById('btnShareScreenTest')?.addEventListener('click', () => {
    const preview = document.getElementById('sharePreview') || null;
    shareScreen(document.getElementById('callStatus'), document.getElementById('btnShareScreenTest'), preview);
  });
  async function handleCallAudioToggle() {
    const statusEl = document.getElementById('callStatus');
    try {
      if (talkbackStream) {
        talkbackStream.getTracks().forEach((t) => t.stop());
        talkbackStream = null;
        attachLocalTracks();
        statusEl && (statusEl.textContent = 'Call Audio off');
        const btn = document.getElementById('btnToggleTalkback');
        if (btn) btn.setAttribute('aria-label', 'Call Audio off');
        setIconState('btnToggleTalkback', false);
        return;
      }
      await ensureTalkbackStream();
      attachLocalTracks();
      statusEl && (statusEl.textContent = 'Call Audio on');
    const btn = document.getElementById('btnToggleTalkback');
    if (btn) btn.setAttribute('aria-label', 'Call Audio on');
    setIconState('btnToggleTalkback', true);
  } catch (err) {
    console.warn('call audio error', err);
    statusEl && (statusEl.textContent = 'Call Audio error');
  }
  }

  document.getElementById('btnToggleTalkback')?.addEventListener('click', (e) => {
    handleCallAudioToggle();
  });

  btnSendMessage?.addEventListener('click', sendCurrentMessage);
  messageText?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  });
  // Quick device pick for call/system audio
  async function handleSystemAudioToggle() {
    const statusEl = document.getElementById('callStatus');
    try {
      if (hqStream) {
        hqStream.getTracks().forEach((t) => t.stop());
        hqStream = null;
        attachLocalTracks();
        statusEl && (statusEl.textContent = 'System Audio off');
        const btn = document.getElementById('btnToggleHQ');
        if (btn) btn.setAttribute('aria-label', 'System Audio off');
        setIconState('btnToggleHQ', false);
        return;
      }
      await ensureHqStream();
      attachLocalTracks();
      statusEl && (statusEl.textContent = 'System Audio on');
      const btn = document.getElementById('btnToggleHQ');
      if (btn) btn.setAttribute('aria-label', 'System Audio on');
      setIconState('btnToggleHQ', true);
    } catch (err) {
      console.warn('system audio error', err);
      statusEl && (statusEl.textContent = 'System Audio error');
    }
  }

  document.getElementById('btnToggleHQ')?.addEventListener('click', (e) => {
    handleSystemAudioToggle();
  });
  document.getElementById('btnNotifications')?.addEventListener('click', () => {
    toggleNotificationsPanel();
  });
  document.getElementById('btnRefreshNotifications')?.addEventListener('click', () => {
    populateNotifications();
  });
  document.getElementById('btnCloseNotifications')?.addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    if (panel) panel.classList.add('hidden');
  });

  // Ensure initial aria-labels exist even when text is hidden
  document.getElementById('btnToggleTalkback')?.setAttribute('aria-label', 'Call Audio');
  document.getElementById('btnToggleHQ')?.setAttribute('aria-label', 'System Audio');
  document.getElementById('btnToggleMic')?.setAttribute('aria-label', 'Mic');
  document.getElementById('btnToggleCamera')?.setAttribute('aria-label', 'Camera');
  document.getElementById('btnShareScreen')?.setAttribute('aria-label', 'Share Screen');
  document.getElementById('btnPopout')?.setAttribute('aria-label', 'PiP');
  document.getElementById('btnPopMeters')?.setAttribute('aria-label', 'Mixer');

  // Popout handling (independent window)
  function buildPopHtml() {
    return `
<!doctype html>
<html>
<head>
  <title>Coverse Call</title>
  <style>
    *{box-sizing:border-box;}
    body{margin:0;font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0c121f;color:#e8f1ff;}
    .top{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:#0f172a;border-bottom:1px solid #1d2840;}
    .brand{font-weight:700;letter-spacing:0.5px;}
    .roster{display:flex;gap:6px;align-items:center;}
    .roster input{background:#0d1726;border:1px solid #1f2c47;border-radius:6px;color:#e8f1ff;padding:6px 8px;min-width:160px;}
    .pill{padding:6px 10px;border:1px solid #1f9df5;border-radius:999px;background:#13263d;color:#e8f1ff;cursor:pointer;}
    .ghost{border-color:#2e3f63;background:#0d1726;}
    .wrap{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;}
    video{width:100%;height:100%;background:#0a0f1a;border:1px solid #1d2840;border-radius:10px;object-fit:cover;}
    .panel{background:#0f172a;border:1px solid #1d2840;border-radius:12px;padding:10px;}
    .label{font-size:12px;opacity:0.7;margin-bottom:6px;}
    .meters{display:flex;gap:6px;align-items:center;margin-top:8px;}
    .meter{flex:1;height:12px;border-radius:8px;background:#122036;overflow:hidden;}
    .meter .level{height:100%;width:0;background:linear-gradient(90deg,#1ae0a8,#1e9ff7);}
    .list{max-height:120px;overflow:auto;margin-top:8px;font-size:13px;}
    .list div{padding:4px 6px;border-bottom:1px solid #1c2c46;}
  </style>
</head>
<body>
  <div class="top">
    <div class="brand">Coverse Call</div>
    <div class="roster">
      <input id="popInvite" placeholder="Invite email or link">
      <button class="pill" id="popInviteSend">Send</button>
      <input id="popSearch" placeholder="Search guests">
    </div>
  </div>
  <div class="wrap">
    <div class="panel">
      <div class="label">You</div>
      <video id="popLocal" autoplay playsinline muted></video>
      <div class="meters">
        <div class="meter mono"><div class="level"></div></div>
        <div class="meter stereo"><div class="level"></div></div>
      </div>
    </div>
    <div class="panel">
      <div class="label">Guest / Remote</div>
      <video id="popRemote" autoplay playsinline></video>
      <div class="meters">
        <div class="meter mono"><div class="level"></div></div>
        <div class="meter stereo"><div class="level"></div></div>
      </div>
      <div class="list" id="popRoster"></div>
    </div>
  </div>
</body>
</html>`;
  }

  function syncPopStreams() {
    if (!externalPop || externalPop.closed) return;
    const pDoc = externalPop.document;
    const pLocal = pDoc.getElementById('popLocal');
    const pRemote = pDoc.getElementById('popRemote');
    if (pLocal && els.localVideo?.srcObject) pLocal.srcObject = els.localVideo.srcObject;
    if (pRemote) {
      pRemote.srcObject = els.remoteVideo?.srcObject || els.localVideo?.srcObject || null;
    }
  }

  function syncPopRoster(list = roster) {
    if (!externalPop || externalPop.closed) return;
    const box = externalPop.document.getElementById('popRoster');
    const search = externalPop.document.getElementById('popSearch');
    if (!box) return;
    const term = (search?.value || '').toLowerCase();
    box.innerHTML = '';
    list
      .filter((r) => r.name.toLowerCase().includes(term))
      .forEach((r) => {
        const row = externalPop.document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        const left = externalPop.document.createElement('span');
        left.textContent = `${r.name} • ${r.status}`;
        const actions = externalPop.document.createElement('span');
        actions.style.display = 'flex';
        actions.style.gap = '6px';

        const admit = externalPop.document.createElement('button');
        admit.className = 'pill';
        admit.textContent = r.status === 'waiting' ? 'Admit' : 'Connected';
        admit.disabled = r.status !== 'waiting';
        admit.addEventListener('click', () => {
          r.status = 'connected';
          r.info = 'joined';
          renderRoster(roster, rosterSearch?.value || '');
        });

        const tb = externalPop.document.createElement('button');
        tb.className = 'pill ghost';
        tb.textContent = r.tbMuted ? 'Call Audio Off' : 'Call Audio On';
        tb.addEventListener('click', () => {
          r.tbMuted = !r.tbMuted;
          renderRoster(roster, rosterSearch?.value || '');
          sendProducerUpdate(r.id, { tbMuted: r.tbMuted });
        });

        const hq = externalPop.document.createElement('button');
        hq.className = 'pill ghost';
        hq.textContent = r.hqEnabled ? 'System Audio On' : 'System Audio Off';
        hq.addEventListener('click', () => {
          r.hqEnabled = !r.hqEnabled;
          renderRoster(roster, rosterSearch?.value || '');
          sendProducerUpdate(r.id, { hqEnabled: r.hqEnabled });
        });

        actions.append(admit, tb, hq);
        row.append(left, actions);
        box.appendChild(row);
      });
  }

  function openPopWindow() {
    const w = window.open('', 'coverse-pop', 'width=1100,height=760');
    if (!w) {
      els.callStatus.textContent = 'Pop-out blocked by browser';
      return;
    }
    w.document.write(buildPopHtml());
    w.document.close();
    externalPop = w;
    externalPop.onbeforeunload = () => {
      externalPop = null;
    };
    setTimeout(() => {
      syncPopStreams();
      syncPopRoster();
      startMeters();
      const invBtn = externalPop.document.getElementById('popInviteSend');
      const invInput = externalPop.document.getElementById('popInvite');
      invBtn?.addEventListener('click', () => {
        const val = invInput?.value || '';
        if (val) els.callStatus.textContent = `Invite sent to ${val}`;
      });
      const search = externalPop.document.getElementById('popSearch');
      search?.addEventListener('input', () => syncPopRoster());
    }, 50);
  }

  btnPopout?.addEventListener('click', () => {
    if (externalPop && !externalPop.closed) {
      externalPop.focus();
      syncPopStreams();
      syncPopRoster();
      startMeters();
      return;
    }
    openPopWindow();
  });
  document.getElementById('btnPopMeters')?.addEventListener('click', () => {
    showRoster = !showRoster;
    updateMixerRosterView();
  });

  function openMiniFrame(label, stream) {
    if (!stream) return;
    const frame = document.createElement('div');
    frame.className = 'popout';
    frame.style.width = '320px';
    frame.style.height = '240px';
    frame.style.left = '40px';
    frame.style.top = '40px';
    frame.style.display = 'block';
    const header = document.createElement('div');
    header.className = 'popout-header';
    header.textContent = label;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pill ghost';
    closeBtn.style.padding = '4px 8px';
    closeBtn.textContent = 'Close';
    header.appendChild(closeBtn);
    const body = document.createElement('div');
    body.className = 'popout-body';
    const vid = document.createElement('video');
    vid.autoplay = true;
    vid.playsInline = true;
    vid.srcObject = stream;
    vid.muted = true;
    vid.style.width = '100%';
    vid.style.height = '100%';
    vid.style.objectFit = 'cover';
    body.appendChild(vid);
    frame.append(header, body);
    document.body.appendChild(frame);

    closeBtn.addEventListener('click', () => frame.remove());

    // simple drag
    let dragging = false, ox = 0, oy = 0;
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      ox = e.clientX - frame.offsetLeft;
      oy = e.clientY - frame.offsetTop;
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    const mv = (e) => {
      if (!dragging) return;
      frame.style.left = `${e.clientX - ox}px`;
      frame.style.top = `${e.clientY - oy}px`;
    };
    const up = () => {
      dragging = false;
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
    };
  }

  btnDetachLocal?.addEventListener('click', () => {
    openMiniFrame('Local', els.localVideo?.srcObject || popLocal?.srcObject);
  });

  btnDetachRemote?.addEventListener('click', () => {
    openMiniFrame('Remote', els.remoteVideo?.srcObject || popRemote?.srcObject || els.localVideo?.srcObject);
  });

  miniLocalBtn?.addEventListener('click', () => {
    openMiniFrame('Local', els.localVideo?.srcObject || popLocal?.srcObject);
  });

  miniRemoteBtn?.addEventListener('click', () => {
    openMiniFrame('Remote', els.remoteVideo?.srcObject || popRemote?.srcObject || els.localVideo?.srcObject);
  });

  popRemoteToggle?.addEventListener('click', () => {
    alert('Remote list would open here'); // placeholder
  });

  popRemoteSearch?.addEventListener('input', () => {
    // placeholder search filter hook
  });
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', hidePrejoin);
document.addEventListener('DOMContentLoaded', () => {
  const els = {
    joinModal: document.getElementById('joinModal')
  };
  hideJoinModal(els);
});

// Click-to-focus handlers for video containers
document.addEventListener('DOMContentLoaded', () => {
  const videoMain = document.getElementById('videoMain');
  const videoSecondary = document.getElementById('videoSecondary');
  const videoScreen = document.getElementById('videoScreen');
  
  // Click on main video to focus/unfocus
  if (videoMain) {
    videoMain.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons inside
      if (e.target.closest('button')) return;
      // In screen-share mode, clicking camera thumbnail does nothing (already focused on screen)
      if (currentLayout === 'screen-share') return;
      focusVideo('main');
    });
  }
  
  // Click on secondary video to focus/unfocus
  if (videoSecondary) {
    videoSecondary.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons inside
      if (e.target.closest('button')) return;
      focusVideo('secondary');
    });
  }
  
  // Click on screen share to focus/unfocus
  if (videoScreen) {
    videoScreen.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons inside
      if (e.target.closest('button')) return;
      focusVideo('screen');
    });
  }
  
  // Escape key to unfocus
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focusedVideo) {
      unfocusVideo();
    }
  });
});

// Listen for auth messages from CoverseHQ site (embedded iframe, dedicated window, or external)
// Supports both legacy format and new electron-bridge format
window.addEventListener('message', (event) => {
  lastMessageSeen = `${event.origin} | ${JSON.stringify(event.data || {})}`;
  updateAuthDebug();
  if (!TRUSTED_ORIGINS.includes(event.origin)) {
    console.warn('Ignored postMessage from origin', event.origin);
    return;
  }
  const data = event.data || {};
  
  // Handle NEW electron-bridge login format: { type: 'coverse-auth', action: 'login', token, user }
  if (data.type === 'coverse-auth' && data.action === 'login' && data.token) {
    localStorage.setItem('coverseIdToken', data.token);
    authProfile = data.user || null;
    updateAuthUI();
    setAuthStatus('Signed in via CoverseHQ', false);
    loadContacts();
    loadConversations();
    console.log('[Auth] Electron JWT received via electron-bridge');
    updateAuthDebug();
    return;
  }
  
  // Handle LEGACY format: { type: 'coverse-auth', idToken, user }
  if (data.type === 'coverse-auth' && data.idToken) {
    localStorage.setItem('coverseIdToken', data.idToken);
    authProfile = data.user || null;
    updateAuthUI();
    setAuthStatus('Signed in via CoverseHQ', false);
    loadContacts();
    loadConversations();
    console.log('[Auth] Token received via postMessage (legacy)');
    updateAuthDebug();
    return;
  }
  
  // Handle NEW electron-bridge logout format: { type: 'coverse-auth', action: 'logout' }
  if (data.type === 'coverse-auth' && data.action === 'logout') {
    localStorage.removeItem('coverseIdToken');
    authProfile = null;
    authUser = null;
    updateAuthUI();
    setAuthStatus('Signed out', true);
    console.log('[Auth] Logout received via electron-bridge');
    updateAuthDebug();
    return;
  }
  
  // IGNORE legacy signout messages - they can cause loops from iframe context issues
  // The new electron-bridge uses action: 'logout' which is handled above
  if (data.type === 'coverse-signout') {
    console.debug('Ignored legacy coverse-signout postMessage');
    return;
  }
});

function connectSignaling(url, room, token, statusEl) {
  statusEl.textContent = 'Connecting...';
  try {
    const ws = new WebSocket(url);
    signalingSocket = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room, token, uid: getSelfId() || null, name: getSelfName() }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'invite') {
          const selfId = getSelfId();
          if (msg.fromUid && msg.fromUid === selfId) return;
          if (msg.from && msg.from === selfId) return;
          console.log('[signal] invite received', msg);
          addInviteNotification(msg);
          const roomInput = document.getElementById('callRoom');
          if (roomInput && msg.room) {
            roomInput.value = msg.room;
            activeRoom = msg.room;
          }
          showToast(`Invite from ${msg.fromName || msg.from || 'guest'} for ${msg.room}`, 'info');
          return;
        }
        if (msg.type === 'joined') {
          currentRoom = room;
          activeRoom = room;
          if (typeof syncInviteState === 'function') syncInviteState();
          statusEl.textContent = `Joined ${room} (client ${msg.id})`;
          inCall = true;
          const btnLabel = document.querySelector('#btnStartEnd .label');
          if (btnLabel) btnLabel.textContent = 'End Call';
          const badge = document.getElementById('callStatusOverlay');
          if (badge) badge.textContent = `In call: ${room}`;
          const meta = document.getElementById('callMeta');
          if (meta) meta.textContent = `Room: ${room} | Server: ${url}`;
          addNotification(`Joined room ${room}`);
          upsertParticipant({ id: getSelfId() || 'you', name: getSelfName(), status: 'connected', info: 'you' });
          startPeer(statusEl);
          return;
        }
        if (msg.type === 'offer') {
          handleOffer(msg, statusEl);
          return;
        }
        if (msg.type === 'answer') {
          handleAnswer(msg, statusEl);
          return;
        }
        if (msg.type === 'ice') {
          handleIce(msg);
          return;
        }
        if (msg.type === 'producer-update') {
          const { targetId, tbMuted, hqEnabled } = msg;
          const p = roster.find((r) => r.id === targetId);
          if (p) {
            if (typeof tbMuted === 'boolean') p.tbMuted = tbMuted;
            if (typeof hqEnabled === 'boolean') p.hqEnabled = hqEnabled;
            renderRoster(roster, rosterSearch?.value || '');
          }
          return;
        }
        if (msg.type === 'presence') {
          const id = msg.userId || msg.id;
          if (id) {
            const name = msg.name || id;
            if (msg.status === 'left') {
              roster = roster.filter((r) => r.id !== id);
              if (id !== getSelfId()) {
                remoteHasVideo = false;
                if (remoteStream) {
                  remoteStream.getTracks().forEach((t) => remoteStream.removeTrack(t));
                }
              }
            } else {
              upsertParticipant({ id, name, status: 'connected', info: msg.status || 'joined' });
            }
            if (id === getSelfId() && !roster.find((r) => r.id === id)) {
              upsertParticipant({ id, name, status: 'connected', info: 'you' });
            }
            renderRoster(roster);
            const hasRemote = roster.some((r) => r.id !== getSelfId() && r.status === 'connected');
            renderCallLayout(hasRemote || remoteHasVideo);
          }
          return;
        }
        if (msg.type === 'roster') {
          const members = msg.members || [];
          const next = members.map((m) => {
            const id = typeof m === 'string' ? m : m.id;
            const name = typeof m === 'string' ? m : (m.name || m.id);
            const existing = roster.find((r) => r.id === id);
            return existing || { id, name, status: 'connected', info: 'joined', tbMuted: false, hqEnabled: false };
          });
          roster = next;
          renderRoster(roster);
          const hasRemote = roster.some((r) => r.id !== getSelfId() && r.status === 'connected');
          renderCallLayout(hasRemote || remoteHasVideo);
          return;
        }
        console.log('[signal] message', msg);
      } catch (err) {
        console.warn('[signal] parse error', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[signal] error', err);
      statusEl.textContent = 'Signaling error';
    };

    ws.onclose = () => {
      statusEl.textContent = 'Disconnected';
      signalingSocket = null;
      currentRoom = null;
      inCall = false;
       roster = [];
       renderRoster(roster, rosterSearch?.value || '');
      const btnLabel = document.querySelector('#btnStartEnd .label');
      if (btnLabel) btnLabel.textContent = 'Start Call';
      const badge = document.getElementById('callStatusOverlay');
      if (badge) badge.textContent = 'Disconnected';
      const meta = document.getElementById('callMeta');
      if (meta) meta.textContent = 'Room: -- | Server: --';
    };
  } catch (err) {
    console.error('[signal] connect failed', err);
    statusEl.textContent = 'Failed to connect';
  }
}

function connectLobby() {
  if (lobbySocket && (lobbySocket.readyState === WebSocket.OPEN || lobbySocket.readyState === WebSocket.CONNECTING)) return;
  const url = normalizeSignalUrl((configCache?.signaling?.url || 'ws://localhost:5181').trim());
  try {
    const ws = new WebSocket(url);
    lobbySocket = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room: 'lobby', uid: getSelfId() || null, name: getSelfName() }));
      // flush queued invites
      if (pendingInvites.length) {
        pendingInvites.forEach((p) => ws.send(JSON.stringify(p)));
        pendingInvites = [];
      }
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'invite') {
          console.log('[lobby] invite received', msg);
          addInviteNotification(msg);
        }
      } catch (err) {
        console.warn('[lobby] parse error', err);
      }
    };
    ws.onclose = () => {
      lobbySocket = null;
    };
  } catch (err) {
    console.warn('lobby connect failed', err);
  }
}

async function startPeer(statusEl) {
  if (pc) return;
  pc = new RTCPeerConnection({
    iceServers: (configCache?.signaling?.iceServers && configCache.signaling.iceServers.length ? configCache.signaling.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }])
  });

  remoteStream = new MediaStream();
  remoteScreenStream = new MediaStream();
  document.getElementById('remoteVideo').srcObject = remoteStream;
  document.getElementById('remoteScreen').srcObject = remoteScreenStream;
  renderCallLayout(false);

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((t) => {
      if (t.kind === 'video' && (t.label || '').toLowerCase().includes('screen')) {
        remoteScreenStream.addTrack(t);
      } else if (t.kind === 'video' && !remoteStream.getVideoTracks().length) {
        remoteStream.addTrack(t);
        remoteHasVideo = true;
      } else if (t.kind === 'video') {
        remoteScreenStream.addTrack(t);
      } else if (t.kind === 'audio') {
        remoteStream.addTrack(t);
      }
    });
    const hasRemote = remoteStream && remoteStream.getVideoTracks().length > 0;
    renderCallLayout(hasRemote);
    syncVideoElements();
  };

  pc.onicecandidate = (event) => {
    if (event.candidate && signalingSocket) {
      signalingSocket.send(JSON.stringify({ type: 'ice', candidate: event.candidate }));
    }
  };
  pc.onnegotiationneeded = () => {
    createAndSendOffer(statusEl);
  };

  if (shouldStartCam) {
    try { await toggleCamera(statusEl, document.getElementById('localVideo'), true); } catch (_) {}
  } else {
    setIconState('btnToggleCamera', false);
  }
  if (shouldStartMic) {
    try { await toggleMic(statusEl, true); } catch (_) {}
  } else {
    setIconState('btnToggleMic', false);
  }

  // ensure tracks added before first offer
  await createAndSendOffer(statusEl);
}

async function createAndSendOffer(statusEl) {
  if (!pc || !signalingSocket) return;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signalingSocket.send(JSON.stringify({ type: 'offer', sdp: offer }));
    statusEl.textContent = 'Offer sent...';
  } catch (err) {
    console.warn('offer failed', err);
  }
}

async function handleOffer(msg, statusEl) {
  if (!pc) startPeer(statusEl);
  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  signalingSocket.send(JSON.stringify({ type: 'answer', sdp: answer }));
  statusEl.textContent = 'Answer sent...';
}

async function handleAnswer(msg, statusEl) {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
  statusEl.textContent = 'Connected';
  syncVideoElements();
}

function handleIce(msg) {
  if (!pc || !msg.candidate) return;
  pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
}

async function toggleCamera(statusEl, videoEl, autoStart = false, buttonEl = null) {
  try {
    if (isCameraOn && !autoStart) {
      removeTrackKind('video');
      if (!localStream || !localStream.getVideoTracks().length) {
        videoEl.srcObject = null;
        const large = document.getElementById('localLarge');
        if (large) large.srcObject = null;
      }
      isCameraOn = false;
      statusEl.textContent = 'Camera off';
      setIconState('btnToggleCamera', false);
      if (buttonEl) buttonEl.setAttribute('aria-label', 'Turn Camera On');
      return;
    }

    const videoConstraints = cameraDeviceId
      ? { deviceId: { exact: cameraDeviceId }, ...getVideoConstraints() }
      : getVideoConstraints();

    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
    } else {
      const tracks = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      tracks.getVideoTracks().forEach((t) => localStream.addTrack(t));
    }

    setTrackEnabled(localStream, 'video', true);
    camTrackCache = localStream.getVideoTracks()[0] || camTrackCache;
    attachLocalTracks();
    videoEl.srcObject = localStream;
    try { videoEl.play(); } catch (_) {}
    const large = document.getElementById('localLarge');
    if (large) {
      large.srcObject = localStream;
      try { large.play(); } catch (_) {}
    }
    const pipLocal = document.getElementById('popLocal');
    if (pipLocal) {
      pipLocal.srcObject = localStream;
      pipLocal.muted = true;
      try { pipLocal.play(); } catch (_) {}
    }
    isCameraOn = true;
    statusEl.textContent = 'Camera on';
    setIconState('btnToggleCamera', true);
    setViewMode('camera');
    if (buttonEl) buttonEl.setAttribute('aria-label', 'Turn Camera Off');
  } catch (err) {
    console.error('camera error', err);
    statusEl.textContent = 'Camera error';
  }
}

async function toggleMic(statusEl, autoStart = false, buttonEl = null) {
  try {
    if (isMicOn && !autoStart) {
      setTrackEnabled(talkbackStream, 'audio', false);
      isMicOn = false;
      statusEl.textContent = 'Mic off';
      setIconState('btnToggleMic', false);
      if (buttonEl) buttonEl.setAttribute('aria-label', 'Turn Mic On');
      return;
    }

    await ensureTalkbackStream();
    setTrackEnabled(talkbackStream, 'audio', true);
    // also unmute any existing sender tracks
    if (talkbackStream) {
      talkbackStream.getAudioTracks().forEach((t) => (t.enabled = true));
    }
    attachLocalTracks();
    isMicOn = true;
    statusEl.textContent = 'Mic on';
    setIconState('btnToggleMic', true);
    if (buttonEl) buttonEl.setAttribute('aria-label', 'Turn Mic Off');
  } catch (err) {
    console.error('mic error', err);
    statusEl.textContent = 'Mic error';
  }
}

async function shareScreen(statusEl, buttonEl = null, previewEl = null) {
  try {
    if (shareTestStream) {
      shareTestStream.getTracks().forEach((t) => t.stop());
      shareTestStream = null;
      // Clear the remoteMain video (where screen share displays)
      const remoteMain = document.getElementById("remoteMain");
      if (remoteMain) remoteMain.srcObject = null;
      statusEl.textContent = "Screen share stopped";
      setIconState('btnShareScreen', false);
      if (buttonEl) buttonEl.setAttribute('aria-label', 'Share Screen Off');
      setViewMode('camera');
      await restoreCameraTrack();
      renderCallLayout();
      return;
    }

    let stream;
    if (navigator.mediaDevices.getDisplayMedia) {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    shareTestStream = stream;
    
    // Set screen share to remoteMain (secondary video in dual layout)
    const remoteMain = document.getElementById("remoteMain");
    if (remoteMain) {
      remoteMain.srcObject = stream;
      remoteMain.muted = true;
      remoteMain.play().catch(() => {});
    }
    
    setTrackEnabled(stream, 'video', true);
    attachLocalTracks();
    // replace any existing video sender with screen track only while sharing
    if (pc) {
      const screenTrack = stream.getVideoTracks()[0];
      pc.getSenders()
        .filter((s) => s.track && s.track.kind === 'video')
        .forEach((s) => s.replaceTrack(screenTrack));
    }
    statusEl.textContent = "Screen share on";
    setIconState('btnShareScreen', true);
    if (buttonEl) buttonEl.setAttribute('aria-label', 'Stop Share Screen');
    setViewMode('screen');
    renderCallLayout();
    stream.getVideoTracks()[0].addEventListener("ended", async () => {
      const remoteMain = document.getElementById("remoteMain");
      if (remoteMain) remoteMain.srcObject = null;
      shareTestStream = null;
      statusEl.textContent = "Screen share stopped";
      setIconState('btnShareScreen', false);
      await restoreCameraTrack();
      setViewMode('camera');
      renderCallLayout();
      syncVideoElements();
    });
  } catch (err) {
    console.error("share screen error", err);
    statusEl.textContent = "Screen share error";
    if (buttonEl) buttonEl.textContent = "Share Screen Off";
  }
}

function attachLocalTracks() {
  if (!pc || !localStream) return;
  const addTracks = (stream) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      const senders = pc.getSenders().filter((s) => s.track && s.track.kind === track.kind);
      if (senders.length > 0) {
        senders[0].replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    });
  };
  addTracks(localStream);
  addTracks(talkbackStream);
  addTracks(hqStream);
  bumpSenderBitrates();
  startMeters();
}

async function restoreCameraTrack() {
  // ensure we have a camera track
  if (!localStream || !localStream.getVideoTracks().length) {
    try {
      await toggleCamera(document.getElementById('callStatus'), document.getElementById('localVideo'), true);
    } catch (_) {}
  }
  if (pc && localStream && localStream.getVideoTracks().length) {
    const camTrack = localStream.getVideoTracks()[0];
    const videoSenders = pc.getSenders().filter((s) => s.track && s.track.kind === 'video');
    if (videoSenders.length === 0) {
      pc.addTrack(camTrack, localStream);
    } else {
      videoSenders.forEach((s) => s.replaceTrack(camTrack));
    }
    setTrackEnabled(localStream, 'video', true);
  }
  isCameraOn = !!(localStream && localStream.getVideoTracks().length);
  setIconState('btnToggleCamera', isCameraOn);
  syncVideoElements();
}

function bumpSenderBitrates() {
  if (!pc) return;
  const presets = {
    low: { video: 800000, audio: 64000 },
    med: { video: 1500000, audio: 128000 },
    high: { video: 3000000, audio: 192000 }
  };
  const sel = presets[selectedQuality] || presets.low;
  const setBps = (kind, max) => {
    pc.getSenders()
      .filter((s) => s.track && s.track.kind === kind)
      .forEach((s) => {
        const params = s.getParameters();
        if (!params.encodings || !params.encodings.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = max;
        s.setParameters(params).catch(() => {});
      });
  };
  setBps('audio', sel.audio);
  setBps('video', sel.video);
}

function stopTracks(stream, kind) {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    if (!kind || t.kind === kind) t.stop();
  });
}

function removeTrackKind(kind) {
  if (!localStream) return;
  const tracks = localStream.getTracks().filter((t) => t.kind === kind);
  tracks.forEach((t) => {
    if (pc) {
      pc.getSenders().forEach((s) => {
        if (s.track === t) pc.removeTrack(s);
      });
    }
    t.stop();
    localStream.removeTrack(t);
  });
  if (localStream.getTracks().length === 0) {
    localStream = null;
  }
}

function restartAudioChains(statusEl) {
  // stop TB/HQ/test streams and rebuild with current device
  if (talkbackStream) {
    talkbackStream.getTracks().forEach((t) => t.stop());
    talkbackStream = null;
  }
  if (hqStream) {
    hqStream.getTracks().forEach((t) => t.stop());
    hqStream = null;
  }
  if (micTestStream) {
    micTestStream.getTracks().forEach((t) => t.stop());
    micTestStream = null;
  }
  stopMeters();
  if (isMicOn) {
    toggleMic(statusEl, true);
  }
}

function setTrackEnabled(stream, kind, enabled) {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    if (t.kind === kind) t.enabled = enabled;
  });
}

function teardownCall() {
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (talkbackStream) {
    talkbackStream.getTracks().forEach((t) => t.stop());
    talkbackStream = null;
  }
  if (hqStream) {
    hqStream.getTracks().forEach((t) => t.stop());
    hqStream = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach((t) => t.stop());
    remoteStream = null;
  }
  if (remoteScreenStream) {
    remoteScreenStream.getTracks().forEach((t) => t.stop());
    remoteScreenStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
    const localScreen = document.getElementById('localScreen');
    if (localScreen) localScreen.srcObject = null;
  }
  isCameraOn = false;
  isMicOn = false;
  pendingOffer = false;
  stopMeters();
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo) remoteVideo.srcObject = null;
  const localVideo = document.getElementById('localVideo');
  if (localVideo) localVideo.srcObject = null;
  renderCallLayout(false);
  if (micMeterInterval) {
    clearInterval(micMeterInterval);
    micMeterInterval = null;
  }
  resetLayout();
  hidePrejoin();
  stopPrejoinTests();
}

async function refreshDevices(els) {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === 'videoinput');
  const mics = devices.filter((d) => d.kind === 'audioinput');
  const speakers = devices.filter((d) => d.kind === 'audiooutput');
  populateSelect(els.cameraSelect, cams, cameraDeviceId);
  populateSelect(els.cameraSelectPre, cams, cameraDeviceId);
  populateSelect(els.micSelect, mics, micDeviceId);
  populateSelect(els.micSelectPre, mics, micDeviceId);
  populateSelect(els.speakerSelect, speakers, speakerDeviceId);
  if (!cameraDeviceId && cams[0]) cameraDeviceId = cams[0].deviceId;
  if (!micDeviceId && mics[0]) micDeviceId = mics[0].deviceId;
  if (!speakerDeviceId && speakers[0]) speakerDeviceId = speakers[0].deviceId;

  const sources = await window.coverse.getSources();
  populateScreens(els, sources);
  if (!screenSourceId && sources[0]) screenSourceId = sources[0].id;

  // keep toolbar dropdowns in sync
  mirrorSelect('micSelect', 'micSelectToolbar');
  mirrorSelect('cameraSelect', 'cameraSelectToolbar');
  mirrorSelect('speakerSelect', 'speakerSelectToolbar');
  mirrorSelect('micSelect', 'callAudioSelectToolbar');
}

function populateSelect(selectEl, items, current) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.deviceId;
    opt.textContent = item.label || item.kind;
    if (item.deviceId === current) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function populateScreens(els, sources) {
  if (!els.screenSelect) return;
  els.screenSelect.innerHTML = '';
  sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    els.screenSelect.appendChild(opt);
  });
  if (sources.length > 0) {
    screenSourceId = screenSourceId || sources[0].id;
    els.screenSelect.value = screenSourceId;
  }
}

// ---- Metering ----
let meterAudioCtx = null;
let meterNodes = [];
let meterTimer = null;

function startMeters() {
  if (meterTimer) return;
  const hasMeters =
    document.querySelectorAll('.meter .level').length ||
    (externalPop && !externalPop.closed && externalPop.document.querySelectorAll('.meter .level').length);
  if (!hasMeters) return;
  if (!meterAudioCtx) {
    meterAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  meterNodes.forEach((n) => n.src?.disconnect());
  meterNodes = [];

  const sources = [];
  if (talkbackStream) sources.push(talkbackStream);
  if (hqStream) sources.push(hqStream);
  if (micTestStream) sources.push(micTestStream);

  sources.forEach((stream) => {
    const src = meterAudioCtx.createMediaStreamSource(stream);
    const analyser = meterAudioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    meterNodes.push({ analyser, data: new Uint8Array(analyser.fftSize) });
  });

  meterTimer = setInterval(() => {
    let level = 0;
    meterNodes.forEach(({ analyser, data }) => {
      analyser.getByteTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + Math.pow(v - 128, 2), 0) / data.length);
      level = Math.max(level, rms);
    });
    const pct = Math.min(100, Math.max(0, (level / 20) * 100));
    const docs = [document];
    if (externalPop && !externalPop.closed) docs.push(externalPop.document);
    docs.forEach((d) => {
      d.querySelectorAll('.meter.mono .level').forEach((el) => (el.style.width = `${pct}%`));
      d.querySelectorAll('.meter.stereo .level').forEach((el) => (el.style.width = `${pct}%`));
    });
  }, 200);
}

function stopMeters() {
  if (meterTimer) {
    clearInterval(meterTimer);
    meterTimer = null;
  }
  const docs = [document];
  if (externalPop && !externalPop.closed) docs.push(externalPop.document);
  docs.forEach((d) => d.querySelectorAll('.meter .level').forEach((el) => (el.style.width = '0%')));
}

async function testMic(statusEl, meterEl, buttonEl = null) {
  try {
    if (micTestStream) {
      micTestStream.getTracks().forEach((t) => t.stop());
      micTestStream = null;
      if (micMeterInterval) {
        clearInterval(micMeterInterval);
        micMeterInterval = null;
      }
      if (meterEl) meterEl.style.width = '0%';
      statusEl.textContent = 'Mic test stopped';
      if (buttonEl) buttonEl.textContent = 'Test Mic';
      return;
    }

    const testStream = await navigator.mediaDevices.getUserMedia({
      audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      video: false
    });
    micTestStream = testStream;
    startMeters();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(testStream);
    source.connect(analyser);
    const monitor = audioCtx.createGain();
    monitor.gain.value = 0.6;
    source.connect(monitor).connect(audioCtx.destination);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    micMeterInterval = setInterval(() => {
      analyser.getByteTimeDomainData(dataArray);
      const rms = Math.sqrt(dataArray.reduce((s, v) => s + Math.pow(v - 128, 2), 0) / dataArray.length);
      const level = Math.min(100, Math.max(0, (rms / 20) * 100));
      if (meterEl) meterEl.style.width = `${level}%`;
    }, 100);
    statusEl.textContent = 'Mic test active';
    if (buttonEl) buttonEl.textContent = 'Stop Mic Test';
    micTestStream.oninactive = () => {
      clearInterval(micMeterInterval);
      micMeterInterval = null;
      micTestStream = null;
      monitor.disconnect();
      source.disconnect();
      analyser.disconnect();
      audioCtx.close();
      if (meterEl) meterEl.style.width = '0%';
      statusEl.textContent = 'Mic test stopped';
      if (buttonEl) buttonEl.textContent = 'Test Mic';
    };
  } catch (err) {
    console.error('mic test error', err);
    statusEl.textContent = 'Mic test error';
    if (buttonEl) buttonEl.textContent = 'Test Mic';
  }
}

async function testCam(statusEl, videoEl, buttonEl = null) {
  try {
    if (camTestStream) {
      camTestStream.getTracks().forEach((t) => t.stop());
      camTestStream = null;
      videoEl.srcObject = localStream || null;
      statusEl.textContent = 'Camera test stopped';
      if (buttonEl) buttonEl.textContent = 'Test Camera';
      return;
    }

    const testStream = await navigator.mediaDevices.getUserMedia({
      video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
      audio: false
    });
    camTestStream = testStream;
    videoEl.srcObject = testStream;
    statusEl.textContent = 'Camera test on';
    if (buttonEl) buttonEl.textContent = 'Stop Camera Test';
    testStream.getVideoTracks()[0].addEventListener('ended', () => {
      camTestStream = null;
      videoEl.srcObject = localStream || null;
      statusEl.textContent = 'Camera test stopped';
      if (buttonEl) buttonEl.textContent = 'Test Camera';
    });
  } catch (err) {
    console.error('cam test error', err);
    statusEl.textContent = 'Camera test error';
    if (buttonEl) buttonEl.textContent = 'Test Camera';
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-content');
  const siteTab = document.querySelector('.tab-btn[data-tab="site"]');
  const brand = document.getElementById('brandLogo');
  if (!tabs.length || !sections.length) return;

  const activateTab = (tabName) => {
    tabs.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
    sections.forEach((s) => s.classList.toggle('active', s.getAttribute('data-tab-content') === tabName));
    
    // Show/hide embedded CoverseHQ BrowserView based on tab
    if (window.coverse) {
      if (tabName === 'site') {
        window.coverse.showSiteView?.();
      } else {
        window.coverse.hideSiteView?.();
      }
    }
  };

  // set default active tab if none
  if (!document.querySelector('.tab-btn.active')) {
    activateTab('call');
  }

  if (brand && siteTab) {
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activateTab('site');
    });
  }

  tabs.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tab = btn.getAttribute('data-tab');
      activateTab(tab);
    });
  });

  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;
      e.preventDefault();
      e.stopPropagation();
      activateTab(tab);
    },
    true
  );

  // settings sub-nav
  const settingBtns = document.querySelectorAll('.setting-btn');
  const settingSections = document.querySelectorAll('.settings-section');
  settingBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      settingBtns.forEach((b) => b.classList.remove('active'));
      settingSections.forEach((s) => s.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-setting');
      document.querySelectorAll(`[data-setting-content="${target}"]`).forEach((el) => el.classList.add('active'));
    });
  });
}

function setupDraggables() {
  const container = document.getElementById('videoCanvas');
  if (!container) return;
  const tilesEls = container.querySelectorAll('.draggable');
  tilesEls.forEach((tile) => {
    const key = tile.getAttribute('data-tile');
    tiles[key] = tile;
    let isDragging = false;
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let startLeft = 0;
    let startTop = 0;

    const handleMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        tile.style.left = `${startLeft + dx}px`;
        tile.style.top = `${startTop + dy}px`;
      } else if (isResizing) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        tile.style.width = `${Math.max(160, startW + dx)}px`;
        tile.style.height = `${Math.max(120, startH + dy)}px`;
      }
    };

    const handleUp = () => {
      isDragging = false;
      isResizing = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    tile.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-handle')) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = tile.offsetWidth;
        startH = tile.offsetHeight;
      } else {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = tile.offsetLeft;
        startTop = tile.offsetTop;
      }
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    });
  });
}

function resetLayout() {
  const presets = {
    localCam: { top: '5%', left: '5%', width: '45%', height: '45%' },
    localScreen: { top: '5%', right: '5%', width: '45%', height: '45%' },
    remoteCam: { bottom: '5%', left: '5%', width: '45%', height: '45%' },
    remoteScreen: { bottom: '5%', right: '5%', width: '45%', height: '45%' }
  };
  Object.entries(presets).forEach(([key, val]) => {
    const tile = tiles[key];
    if (!tile) return;
    tile.style.top = val.top || '';
    tile.style.left = val.left || '';
    tile.style.right = val.right || '';
    tile.style.bottom = val.bottom || '';
    tile.style.width = val.width;
    tile.style.height = val.height;
    tile.style.display = '';
  });
}

function toggleTile(key) {
  const tile = tiles[key];
  if (!tile) return;
  tile.style.display = tile.style.display === 'none' ? '' : 'none';
}

function requestFullscreen(el) {
  if (!el) return;
  const parent = el.closest('.video-tile') || el;
  if (parent.requestFullscreen) parent.requestFullscreen();
}

function showPrejoin() {
  const pre = document.getElementById('prejoin');
  if (pre) pre.style.display = 'block';
  // mirror current local preview into the prejoin modal
  const preVid = document.getElementById('localVideo');
  const mainVid = document.getElementById('localLarge');
  if (preVid && mainVid && mainVid.srcObject) {
    preVid.srcObject = mainVid.srcObject;
  }
}

function hidePrejoin() {
  const pre = document.getElementById('prejoin');
  if (pre) pre.style.display = 'none';
  stopPrejoinTests();
}

function updateMixerRosterView() {
  const meterBlock = document.querySelector('.meter-block');
  const connections = document.getElementById('callConnections');
  const mixer = document.getElementById('mixerPanel');
  if (mixer) mixer.style.display = showRoster ? 'none' : '';
  if (connections) connections.style.display = showRoster ? '' : 'none';
  if (meterBlock) meterBlock.style.display = '';
  setIconState('btnPopMeters', !showRoster);
}

function showJoinModal(els) {
  if (els.joinModal) {
    els.joinModal.style.display = 'flex';
    els.joinCodeInput?.focus();
  }
}

function hideJoinModal(els) {
  if (els.joinModal) {
    els.joinModal.style.display = 'none';
  }
}



async function ensureTalkbackStream() {
  if (talkbackStream) return talkbackStream;
  talkbackStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: { ideal: 48000 },
      echoCancellation: true,
      noiseSuppression: true,
      deviceId: micDeviceId ? { exact: micDeviceId } : undefined
    },
    video: false
  });
  return talkbackStream;
}

async function ensureHqStream() {
  if (hqStream) return hqStream;
  hqStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 2,
      sampleRate: { ideal: 48000 },
      echoCancellation: false,
      noiseSuppression: false,
      deviceId: micDeviceId ? { exact: micDeviceId } : undefined
    },
    video: false
  });
  startMeters();
  return hqStream;
}




async function refreshIdToken() {
  try {
    if (firebaseAuth?.currentUser) {
      const tok = await firebaseAuth.currentUser.getIdToken(true);
      if (tok) {
        localStorage.setItem('coverseIdToken', tok);
        authUser = firebaseAuth.currentUser;
        updateAuthUI();
        return tok;
      }
    }
  } catch (e) {
    console.warn('Token refresh failed', e);
  }
  return null;
}







// CoverseHQ window status listener
document.addEventListener('DOMContentLoaded', () => {
  const btnSiteOpenExternal = document.getElementById('btnSiteOpenExternal');
  const siteStatus = document.getElementById('siteWindowStatus');
  
  // Listen for site window status updates
  if (window.coverse?.onSiteViewStatus) {
    window.coverse.onSiteViewStatus((status) => {
      if (status.external) {
        if (siteStatus) {
          siteStatus.textContent = 'CoverseHQ opened in your browser';
          siteStatus.className = 'site-launcher-status success';
        }
      } else if (status.error) {
        if (siteStatus) {
          siteStatus.textContent = `Error: ${status.error}`;
          siteStatus.className = 'site-launcher-status error';
        }
      } else if (status.visible === false) {
        if (siteStatus) {
          siteStatus.textContent = 'Click the CoverseHQ.com tab to open in browser';
          siteStatus.className = 'site-launcher-status';
        }
      }
    });
  }
  
  btnSiteOpenExternal?.addEventListener('click', () => {
    if (window.coverse?.openExternal) {
      window.coverse.openExternal('https://coversehq.com');
    } else {
      window.open('https://coversehq.com', '_blank');
    }
  });
});


// Swallow benign media play interruptions triggered during navigations/reloads
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (msg.includes('The play() request was interrupted by a new load request')) {
    event.preventDefault();
  }
});

// NOTE: Signout messages are now handled (ignored) in the main message listener above.
// No duplicate handler needed.
