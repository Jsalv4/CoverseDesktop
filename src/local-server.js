const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

class LocalServer {
  constructor(rootDir, port = 0) {
    this.rootDir = rootDir;
    this.port = port;
    this.server = null;
    this.actualPort = null;
    this.pendingExternalAuth = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        console.error('[LocalServer] Error:', err);
        reject(err);
      });

      // Port 0 = pick any available port
      this.server.listen(this.port, '127.0.0.1', () => {
        this.actualPort = this.server.address().port;
        console.log(`[LocalServer] Running at http://127.0.0.1:${this.actualPort}`);
        resolve(this.actualPort);
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getUrl(relativePath = '') {
    if (!this.actualPort) return null;
    return `http://127.0.0.1:${this.actualPort}/${relativePath}`;
  }

  getAuthCallbackUrl() {
    if (!this.actualPort) return null;
    return `http://127.0.0.1:${this.actualPort}/auth/callback`;
  }

  consumeExternalAuth() {
    const payload = this.pendingExternalAuth;
    this.pendingExternalAuth = null;
    return payload;
  }

  handleRequest(req, res) {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');

    if (requestUrl.pathname === '/auth/callback') {
      const token = requestUrl.searchParams.get('token') || '';
      const tokenType = requestUrl.searchParams.get('tokenType') || '';
      const username = requestUrl.searchParams.get('username') || '';
      if (token) {
        this.pendingExternalAuth = {
          token,
          tokenType,
          username,
          receivedAt: Date.now()
        };
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Coverse</title></head><body style="font-family: Arial, sans-serif; background:#0f0f12; color:#e5e7eb; display:flex; align-items:center; justify-content:center; min-height:100vh;"><div style="text-align:center;"><h2 style="margin:0 0 8px 0;">Sign-in complete</h2><p style="margin:0; color:#a0a0aa;">You can close this browser tab and return to Coverse.</p></div></body></html>`);
      return;
    }

    // Parse URL and remove query string
    let urlPath = req.url.split('?')[0];
    
    // Default to index.html
    if (urlPath === '/') {
      urlPath = '/pages/login.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(this.rootDir, safePath);

    // Ensure we're still within root directory
    if (!filePath.startsWith(this.rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Check if file exists
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      // Get MIME type
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Read and serve file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Internal Server Error');
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      });
    });
  }
}

module.exports = LocalServer;
