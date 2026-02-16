const WebSocket = require('ws');

class WebSocketServer {
  constructor(port) {
    this.port = port;
    this.clients = new Set();
    this.rooms = new Map(); // roomId -> { members: Set<ws> }
    this.onMessage = null;
    this.wss = null;
    this.start();
  }

  joinRoom(ws, room) {
    if (!room) return;
    if (!this.rooms.has(room)) this.rooms.set(room, { members: new Set() });
    this.rooms.get(room).members.add(ws);
    ws.__room = room;
    this.broadcastRoster(room);
  }

  leaveRoom(ws) {
    const room = ws.__room;
    if (!room) return;
    const data = this.rooms.get(room);
    if (data) {
      data.members.delete(ws);
      if (data.members.size === 0) {
        this.rooms.delete(room);
      } else {
        this.broadcastRoster(room);
      }
    }
    ws.__room = null;
  }

  broadcastRoster(room) {
    const data = this.rooms.get(room);
    if (!data) return;
    const payload = {
      type: 'roster',
      room,
      members: Array.from(data.members).map((c) => c.__clientId || 'peer')
    };
    this.broadcastToRoom(room, payload);
  }

  broadcastToRoom(room, message) {
    const data = this.rooms.get(room);
    if (!data) return;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    data.members.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  start() {
    try {
      this.wss = new WebSocket.Server({ port: this.port });
    } catch (err) {
      console.error('[WSS] Failed to bind port', this.port, err);
      throw err;
    }

    this.wss.on('connection', (ws) => {
      console.log('[WSS] VST plugin connected');
      this.clients.add(ws);
      ws.__clientId = Math.random().toString(36).slice(2, 10);
      ws.__room = null;

      ws.send(JSON.stringify({ 
        type: 'connected', 
        clientId: ws.__clientId,
        message: 'Connected to Coverse' 
      }));
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[WSS] Received:', message.type);
          
          if (this.onMessage) {
            this.onMessage(message);
          }
          
          this.handleMessage(ws, message);
        } catch (e) {
          console.error('[WSS] Invalid message:', e);
        }
      });
      
      ws.on('close', () => {
        console.log('[WSS] VST plugin disconnected');
        this.clients.delete(ws);
        this.leaveRoom(ws);
      });
      
      ws.on('error', (error) => {
        console.error('[WSS] Error:', error);
        this.clients.delete(ws);
        this.leaveRoom(ws);
      });
    });
    
    this.wss.on('error', (error) => {
      console.error('[WSS] Server error:', error);
    });
    
    console.log(`[WSS] WebSocket server started on port ${this.port}`);
  }
  
  handleMessage(ws, message) {
    switch (message.type) {
      case 'join':
      case 'session-join':
        this.joinRoom(ws, message.room);
        ws.send(JSON.stringify({ type: 'joined', id: ws.__clientId, room: message.room }));
        this.broadcastRoster(message.room);
        if (this.onMessage) this.onMessage(message);
        break;

      case 'transport':
        this.broadcast(message, ws);
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      // Producer control from host to all guests
      case 'producer-control':
        // fan-out to everyone (including origin) as update
        if (ws.__room) {
          this.broadcastToRoom(ws.__room, { type: 'producer-update', targetId: message.targetId, tbMuted: message.tbMuted, hqEnabled: message.hqEnabled });
        } else {
          this.broadcast({ type: 'producer-update', targetId: message.targetId, tbMuted: message.tbMuted, hqEnabled: message.hqEnabled });
        }
        break;
        
      default:
        if (this.onMessage) {
          this.onMessage(message);
        }
    }
  }
  
  broadcast(message, exclude = null) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
  
  send(message) {
    this.broadcast(message);
  }
  
  close() {
    if (this.wss) {
      this.wss.close();
      console.log('[WSS] Server closed');
    }
  }
}

module.exports = WebSocketServer;
