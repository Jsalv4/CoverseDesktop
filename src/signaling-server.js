const WebSocket = require('ws');

const PORT = parseInt(process.env.SIGNALING_PORT || '7000', 10);
const TOKEN = process.env.SIGNALING_TOKEN || '';

const rooms = new Map(); // room -> Set of clients
const userSockets = new Map(); // uid -> Set of clients

function roomRoster(room) {
  const clients = rooms.get(room);
  if (!clients) return [];
  return Array.from(clients).map((c) => ({
    id: c.uid || c.id,
    name: c.name || c.uid || c.id
  }));
}

function broadcast(room, payload, exclude) {
  const clients = rooms.get(room);
  if (!clients) return;
  const data = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[signal] listening on ws://0.0.0.0:${PORT}`);
});

wss.on('connection', (ws) => {
  ws.id = Math.random().toString(36).slice(2);
  ws.room = null;
  ws.uid = null;
  ws.name = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      console.warn('[signal] invalid JSON', err);
      return;
    }

    if (msg.type === 'join') {
      if (TOKEN && msg.token !== TOKEN) {
        ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
        ws.close();
        return;
      }
      ws.room = msg.room;
      ws.uid = msg.uid || null;
      ws.name = msg.name || null;
      if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
      rooms.get(msg.room).add(ws);
      if (ws.uid) {
        if (!userSockets.has(ws.uid)) userSockets.set(ws.uid, new Set());
        userSockets.get(ws.uid).add(ws);
      }
      ws.send(JSON.stringify({ type: 'joined', room: msg.room, id: ws.id }));
      // presence + roster
      broadcast(ws.room, { type: 'presence', userId: ws.uid || ws.id, name: ws.name || ws.uid || ws.id, status: 'joined' });
      const rosterPayload = { type: 'roster', members: roomRoster(ws.room) };
      broadcast(ws.room, rosterPayload);
      ws.send(JSON.stringify(rosterPayload));
      console.log(`[signal] ${ws.id} joined room ${msg.room}`);
      return;
    }

    if (!ws.room) {
      ws.send(JSON.stringify({ type: 'error', error: 'join-first' }));
      return;
    }

    if (msg.type === 'invite') {
      const payload = { ...msg, from: ws.uid || ws.id, fromName: ws.name || ws.uid || ws.id, ts: Date.now() };
      // send to everyone connected
      const data = JSON.stringify(payload);
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) client.send(data);
      });
      // and explicitly to target uid sockets if specified
      if (msg.toUid && userSockets.has(msg.toUid)) {
        userSockets.get(msg.toUid).forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(data);
        });
      }
      return;
    }

    // Relay everything else within the room
    broadcast(ws.room, { ...msg, from: ws.id }, ws);
  });

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) {
        rooms.delete(ws.room);
      } else {
        broadcast(ws.room, { type: 'presence', userId: ws.uid || ws.id, name: ws.name || ws.uid || ws.id, status: 'left' });
        broadcast(ws.room, { type: 'roster', members: roomRoster(ws.room) });
      }
    }
    if (ws.uid && userSockets.has(ws.uid)) {
      userSockets.get(ws.uid).delete(ws);
      if (userSockets.get(ws.uid).size === 0) {
        userSockets.delete(ws.uid);
      }
    }
  });
});

// Heartbeat to drop dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

process.on('SIGINT', () => {
  console.log('\n[signal] shutting down');
  clearInterval(interval);
  wss.close();
  process.exit(0);
});
