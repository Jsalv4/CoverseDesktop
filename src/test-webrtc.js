if (typeof document === 'undefined') {
  console.log('[test-webrtc] browser-only harness; skipping under node --test');
  process.exit(0);
}

let pc, localStream, remoteStream, ws, currentRoom, tokenVal;

const els = {
  room: document.getElementById('room'),
  signalUrl: document.getElementById('signalUrl'),
  token: document.getElementById('token'),
  start: document.getElementById('start'),
  hangup: document.getElementById('hangup'),
  share: document.getElementById('share'),
  status: document.getElementById('status'),
  local: document.getElementById('local'),
  remote: document.getElementById('remote')
};

els.start.onclick = () => {
  const url = els.signalUrl.value.trim();
  const room = els.room.value.trim();
  tokenVal = els.token.value.trim();
  if (!url || !room) {
    setStatus('Provide signaling URL and room');
    return;
  }
  connect(url, room);
};

els.hangup.onclick = () => {
  if (ws) ws.close();
  teardown();
  setStatus('Hung up');
};

els.share.onclick = async () => {
  if (!pc) return;
  try {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screen.getTracks().forEach((t) => pc.addTrack(t, screen));
    setStatus('Sharing screen');
  } catch (e) {
    setStatus('Share failed');
  }
};

function setStatus(msg) { els.status.textContent = msg; }

function connect(url, room) {
  setStatus('Connecting...');
  ws = new WebSocket(url);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room, token: tokenVal }));
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'joined') {
      currentRoom = room;
      setStatus(`Joined ${room} as ${msg.id}`);
      startPeer();
      await makeOffer();
    } else if (msg.type === 'offer') {
      await handleOffer(msg);
    } else if (msg.type === 'answer') {
      await handleAnswer(msg);
    } else if (msg.type === 'ice') {
      if (pc) pc.addIceCandidate(msg.candidate).catch(()=>{});
    }
  };
  ws.onerror = () => setStatus('Signaling error');
  ws.onclose = () => {
    setStatus('Disconnected');
    teardown();
  };
}

async function startPeer() {
  pc = new RTCPeerConnection({
    iceServers: window.coverseIce || []
  });
  remoteStream = new MediaStream();
  els.remote.srcObject = remoteStream;

  pc.onicecandidate = (e) => {
    if (e.candidate && ws) ws.send(JSON.stringify({ type: 'ice', candidate: e.candidate }));
  };
  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
  };

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    els.local.srcObject = localStream;
  }
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
}

async function makeOffer() {
  if (!pc || !ws) return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
  setStatus('Offer sent');
}

async function handleOffer(msg) {
  if (!pc) await startPeer();
  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
  setStatus('Answer sent');
}

async function handleAnswer(msg) {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
  setStatus('Connected');
}

function teardown() {
  if (pc) { pc.close(); pc = null; }
  if (localStream) { localStream.getTracks().forEach(t=>t.stop()); localStream=null; }
  if (remoteStream) { remoteStream.getTracks().forEach(t=>t.stop()); remoteStream=null; els.remote.srcObject=null; }
  els.local.srcObject = null;
}

// Allow overriding ICE from env when opened as file: set window.coverseIce in console if needed.
