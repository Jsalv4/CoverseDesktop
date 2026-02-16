const EventEmitter = require('events');

class SignalingClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.connected = false;
  }

  connect() {
    if (!this.url) {
      this.emit('error', new Error('Missing signaling URL'));
      return;
    }
    const WebSocket = require('ws');
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => {
      this.connected = true;
      this.emit('open');
    });
    this.ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        this.emit('message', parsed);
      } catch (err) {
        this.emit('error', err);
      }
    });
    this.ws.on('close', () => {
      this.connected = false;
      this.emit('close');
    });
    this.ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      this.emit('error', new Error('Signaling socket not ready'));
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = SignalingClient;
