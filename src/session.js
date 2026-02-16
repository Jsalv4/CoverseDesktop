// ============================================
// DISCORD-STYLE SESSION UI CONTROLLER
// Matches Discord's actual call/stream view
// ============================================

// Session state
let sessionActive = false;
let sessionMicMuted = false;
let sessionCameraOff = true;
let sessionScreenSharing = false;
let isGridView = false;
let sideChatOpen = false;
let selectedParticipant = null;
let stageStream = null;

// Participants list
let participants = [
  { id: 'you', name: 'You', avatar: 'Y', isLocal: true, isMuted: false, hasCamera: false, isScreenSharing: false, isSpeaking: false },
];

// Initialize session UI
function initSessionUI() {
  console.log('[Session] Initializing Discord-style session UI...');
  
  // Session tab button
  document.getElementById('btnOpenSession')?.addEventListener('click', (e) => {
    e.preventDefault();
    openSession();
  });
  
  // Control buttons
  document.getElementById('btnMic')?.addEventListener('click', toggleMic);
  document.getElementById('btnCamera')?.addEventListener('click', toggleCamera);
  document.getElementById('btnScreenShare')?.addEventListener('click', toggleScreenShare);
  document.getElementById('btnGridView')?.addEventListener('click', toggleGridView);
  document.getElementById('btnReactions')?.addEventListener('click', showReactions);
  document.getElementById('btnMore')?.addEventListener('click', showMoreMenu);
  document.getElementById('btnChat')?.addEventListener('click', toggleSideChat);
  document.getElementById('btnDisconnect')?.addEventListener('click', disconnectFromCall);
  
  // Device dropdown buttons
  document.getElementById('btnMicDropdown')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDeviceMenu('micMenu');
  });
  document.getElementById('btnCameraDropdown')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDeviceMenu('cameraMenu');
  });
  
  // Close device menus on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.device-menu').forEach(m => m.classList.remove('open'));
  });
  
  // Bottom right controls
  document.getElementById('btnVolume')?.addEventListener('click', toggleVolume);
  document.getElementById('btnFullscreen')?.addEventListener('click', toggleFullscreen);
  
  // Side chat
  document.getElementById('btnCloseSideChat')?.addEventListener('click', () => toggleSideChat(false));
  document.getElementById('sideChatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  // Participant tile clicks
  document.getElementById('participantTiles')?.addEventListener('click', (e) => {
    const tile = e.target.closest('.participant-tile');
    if (tile && !tile.classList.contains('more')) {
      selectParticipant(tile.dataset.id);
    }
  });
  
  console.log('[Session] UI initialized');
}

// Open session view
function openSession() {
  const container = document.getElementById('sessionContainer');
  if (container) {
    container.classList.add('active');
    sessionActive = true;
    startLocalPreview();
  }
}

// Close session view
function closeSession() {
  const container = document.getElementById('sessionContainer');
  if (container) {
    container.classList.remove('active');
    sessionActive = false;
  }
}

// Toggle microphone
function toggleMic() {
  sessionMicMuted = !sessionMicMuted;
  const btn = document.getElementById('btnMic');
  if (btn) {
    btn.classList.toggle('muted', sessionMicMuted);
    btn.innerHTML = sessionMicMuted ? `
      <svg viewBox="0 0 256 256"><path d="M213.92,210.62a8,8,0,1,1-11.84,10.76L174,191.3A79.06,79.06,0,0,1,136,207.59V232a8,8,0,0,1-16,0V207.59A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,97.55,54.45L150.59,170A48,48,0,0,1,80,128V118.64l-37.92-41.7a8,8,0,1,1,11.84-10.76ZM192,128v-7.09l19.19,21.11a8,8,0,0,0,5.81,2.72h0a8,8,0,0,0,5.91-2.61,8,8,0,0,0-.09-11.31l-26-28.56A8,8,0,0,0,192,104V64a64,64,0,0,0-128,0v8a8,8,0,0,0,16,0V64a48,48,0,0,1,96,0Z"/></svg>
    ` : `
      <svg viewBox="0 0 256 256"><path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/></svg>
    `;
  }
  updateLocalParticipant();
}

// Toggle camera
function toggleCamera() {
  sessionCameraOff = !sessionCameraOff;
  const btn = document.getElementById('btnCamera');
  if (btn) {
    btn.classList.toggle('muted', sessionCameraOff);
    btn.innerHTML = sessionCameraOff ? `
      <svg viewBox="0 0 256 256"><path d="M213.92,210.62a8,8,0,1,1-11.84,10.76l-30-33A16,16,0,0,1,160,200H32A16,16,0,0,1,16,184V72A16,16,0,0,1,32,56H51.73L42.08,45.38A8,8,0,1,1,53.92,34.62ZM251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H113.06L227.31,184.22a8,8,0,0,0,5.92,2.61,7.93,7.93,0,0,0,4.56-1.44l6.22-4.32A8,8,0,0,0,248,176V80A8,8,0,0,0,251.77,73Z"/></svg>
    ` : `
      <svg viewBox="0 0 256 256"><path d="M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z"/></svg>
    `;
  }
  
  if (!sessionCameraOff) {
    startLocalCamera();
  } else {
    stopLocalCamera();
  }
}

// Toggle screen share
function toggleScreenShare() {
  if (sessionScreenSharing) {
    stopScreenShare();
  } else {
    startScreenShare();
  }
}

// Start screen share
async function startScreenShare() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: true
    });
    
    sessionScreenSharing = true;
    stageStream = stream;
    
    // Show on stage
    const stageVideo = document.getElementById('stageVideo');
    const placeholder = document.getElementById('stagePlaceholder');
    const stageLabel = document.getElementById('stageLabel');
    const stageLabelName = document.getElementById('stageLabelName');
    
    if (stageVideo) {
      stageVideo.srcObject = stream;
      stageVideo.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (stageLabel) stageLabel.classList.add('visible');
    if (stageLabelName) stageLabelName.textContent = 'Your Screen';
    
    // Update button
    const btn = document.getElementById('btnScreenShare');
    if (btn) btn.classList.add('active');
    
    // Update top bar
    updateStreamInfo('Your Screen', true);
    
    // Update local participant
    const local = participants.find(p => p.isLocal);
    if (local) local.isScreenSharing = true;
    renderParticipants();
    
    // Handle stream end
    stream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };
    
  } catch (err) {
    console.error('[Session] Screen share error:', err);
  }
}

// Stop screen share
function stopScreenShare() {
  if (stageStream) {
    stageStream.getTracks().forEach(t => t.stop());
    stageStream = null;
  }
  
  sessionScreenSharing = false;
  
  const stageVideo = document.getElementById('stageVideo');
  const placeholder = document.getElementById('stagePlaceholder');
  const stageLabel = document.getElementById('stageLabel');
  
  if (stageVideo) {
    stageVideo.srcObject = null;
    stageVideo.classList.add('hidden');
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (stageLabel) stageLabel.classList.remove('visible');
  
  const btn = document.getElementById('btnScreenShare');
  if (btn) btn.classList.remove('active');
  
  updateStreamInfo(null, false);
  
  const local = participants.find(p => p.isLocal);
  if (local) local.isScreenSharing = false;
  renderParticipants();
}

// Update stream info in top bar
function updateStreamInfo(streamName, isLive) {
  const breadcrumbStream = document.getElementById('breadcrumbStream');
  const liveBadge = document.getElementById('liveBadge');
  const qualityBadge = document.getElementById('qualityBadge');
  
  if (breadcrumbStream) {
    breadcrumbStream.style.display = streamName ? 'flex' : 'none';
    const nameEl = breadcrumbStream.querySelector('.breadcrumb-stream-name');
    if (nameEl) nameEl.textContent = streamName || '';
  }
  
  if (liveBadge) liveBadge.style.display = isLive ? 'flex' : 'none';
  if (qualityBadge) qualityBadge.style.display = isLive ? 'flex' : 'none';
}

// Toggle grid view
function toggleGridView() {
  isGridView = !isGridView;
  const container = document.getElementById('sessionContainer');
  const btn = document.getElementById('btnGridView');
  
  if (container) container.classList.toggle('grid-view', isGridView);
  if (btn) btn.classList.toggle('active', isGridView);
}

// Show reactions menu
function showReactions() {
  console.log('[Session] Reactions menu');
  // TODO: Implement reactions popup
}

// Show more options menu
function showMoreMenu() {
  console.log('[Session] More options menu');
  // TODO: Implement more options popup
}

// Toggle side chat
function toggleSideChat(open = null) {
  sideChatOpen = open !== null ? open : !sideChatOpen;
  const panel = document.getElementById('sideChatPanel');
  const btn = document.getElementById('btnChat');
  
  if (panel) panel.classList.toggle('open', sideChatOpen);
  if (btn) btn.classList.toggle('active', sideChatOpen);
}

// Disconnect from call
function disconnectFromCall() {
  stopScreenShare();
  stopLocalCamera();
  closeSession();
}

// Toggle device menu
function toggleDeviceMenu(menuId) {
  const menu = document.getElementById(menuId);
  const wasOpen = menu?.classList.contains('open');
  
  document.querySelectorAll('.device-menu').forEach(m => m.classList.remove('open'));
  
  if (menu && !wasOpen) {
    populateDeviceMenu(menuId);
    menu.classList.add('open');
  }
}

// Populate device menu
async function populateDeviceMenu(menuId) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const menu = document.getElementById(menuId);
    if (!menu) return;
    
    const list = menu.querySelector('.device-list');
    if (!list) return;
    
    const kind = menuId === 'micMenu' ? 'audioinput' : 'videoinput';
    const filtered = devices.filter(d => d.kind === kind);
    
    list.innerHTML = filtered.map((d, i) => `
      <div class="device-menu-item${i === 0 ? ' selected' : ''}" data-id="${d.deviceId}">
        <svg viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z"/></svg>
        <span>${d.label || `Device ${i + 1}`}</span>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('[Session] Device enumeration error:', err);
  }
}

// Toggle volume
function toggleVolume() {
  console.log('[Session] Volume toggle');
  // TODO: Implement volume slider
}

// Toggle fullscreen
function toggleFullscreen() {
  const container = document.getElementById('sessionContainer');
  if (!container) return;
  
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen();
  }
}

// Select participant
function selectParticipant(id) {
  selectedParticipant = id;
  
  document.querySelectorAll('.participant-tile').forEach(tile => {
    tile.classList.toggle('selected', tile.dataset.id === id);
  });
  
  const participant = participants.find(p => p.id === id);
  if (participant?.isScreenSharing && !participant.isLocal) {
    // Show their screen on stage
    // TODO: Implement remote screen display
  }
}

// Start local preview
async function startLocalPreview() {
  // Just show avatar for now, camera starts when toggled
  renderParticipants();
}

// Start local camera
async function startLocalCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const localTile = document.querySelector('.participant-tile[data-id="you"]');
    if (localTile) {
      const video = localTile.querySelector('.participant-tile-video');
      const placeholder = localTile.querySelector('.participant-tile-placeholder');
      
      if (video) {
        video.srcObject = stream;
        video.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    }
    
    const local = participants.find(p => p.isLocal);
    if (local) local.hasCamera = true;
    
  } catch (err) {
    console.error('[Session] Camera error:', err);
  }
}

// Stop local camera
function stopLocalCamera() {
  const localTile = document.querySelector('.participant-tile[data-id="you"]');
  if (localTile) {
    const video = localTile.querySelector('.participant-tile-video');
    const placeholder = localTile.querySelector('.participant-tile-placeholder');
    
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      video.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
  }
  
  const local = participants.find(p => p.isLocal);
  if (local) local.hasCamera = false;
}

// Update local participant state
function updateLocalParticipant() {
  const local = participants.find(p => p.isLocal);
  if (local) {
    local.isMuted = sessionMicMuted;
    local.hasCamera = !sessionCameraOff;
  }
  renderParticipants();
}

// Render participants
function renderParticipants() {
  const container = document.getElementById('participantTiles');
  if (!container) return;
  
  container.innerHTML = participants.map(p => `
    <div class="participant-tile${p.id === selectedParticipant ? ' selected' : ''}${p.isSpeaking ? ' speaking' : ''}" data-id="${p.id}">
      ${p.isScreenSharing ? '<span class="tile-live-badge">LIVE</span>' : ''}
      ${p.hasCamera ? '' : `
        <div class="tile-corner-icons">
          ${p.isSpeaking ? '<div class="tile-corner-icon green"><svg viewBox="0 0 256 256"><path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176Z"/></svg></div>' : ''}
        </div>
      `}
      <video class="participant-tile-video${p.hasCamera ? '' : ' hidden'}" autoplay playsinline ${p.isLocal ? 'muted' : ''}></video>
      <div class="participant-tile-placeholder${p.hasCamera ? ' hidden' : ''}">
        <div class="participant-tile-avatar">${p.avatar}</div>
      </div>
      <div class="participant-tile-info">
        <div class="participant-tile-name">
          ${p.isScreenSharing ? '<svg viewBox="0 0 256 256"><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Z"/></svg>' : ''}
          <span>${p.name}</span>
        </div>
        <div class="participant-tile-icons">
          ${p.isMuted ? '<svg class="muted" viewBox="0 0 256 256"><path d="M213.92,210.62a8,8,0,1,1-11.84,10.76L174,191.3A79.06,79.06,0,0,1,136,207.59V232a8,8,0,0,1-16,0V207.59A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,97.55,54.45L150.59,170A48,48,0,0,1,80,128V118.64l-37.92-41.7a8,8,0,1,1,11.84-10.76Z"/></svg>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// Send chat message
function sendChatMessage() {
  const input = document.getElementById('sideChatInput');
  const messages = document.getElementById('sideChatMessages');
  
  if (!input || !input.value.trim() || !messages) return;
  
  const msg = document.createElement('div');
  msg.className = 'side-chat-message';
  msg.innerHTML = `
    <div class="side-chat-avatar">Y</div>
    <div class="side-chat-content">
      <div class="side-chat-author">You</div>
      <div class="side-chat-text">${input.value}</div>
    </div>
  `;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
  input.value = '';
}

// Add a participant (for remote participants)
function addParticipant(id, name, avatar = null) {
  if (participants.find(p => p.id === id)) return;
  
  participants.push({
    id,
    name,
    avatar: avatar || name.charAt(0).toUpperCase(),
    isLocal: false,
    isMuted: false,
    hasCamera: false,
    isScreenSharing: false,
    isSpeaking: false
  });
  
  renderParticipants();
}

// Remove a participant
function removeParticipant(id) {
  participants = participants.filter(p => p.id !== id);
  renderParticipants();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initSessionUI);

// Export for use in main renderer
if (typeof window !== 'undefined') {
  window.sessionUI = {
    open: openSession,
    close: closeSession,
    addParticipant,
    removeParticipant,
    isActive: () => sessionActive
  };
}
