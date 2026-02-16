const path = require('path');

function parseJsonEnv(name, fallback = null) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[config] Failed to parse ${name} JSON, using fallback`, err);
    return fallback;
  }
}

const defaultIceServers = [
  { urls: 'stun:stun.l.google.com:19302' }
];

module.exports = {
  useLocalUi: process.env.COVERSE_LOCAL_UI === '1',
  protocolVersion: '1.0.0',
  signaling: {
    url: process.env.COVERSE_SIGNALING_URL || 'wss://coversehq.com/ws/signal',
    token: process.env.COVERSE_SIGNALING_TOKEN || '',
    iceServers: parseJsonEnv('COVERSE_ICE_SERVERS', defaultIceServers)
  },
  helper: {
    endpoint: process.env.COVERSE_HELPER_ENDPOINT || 'http://localhost:5210',
    expectedPlatforms: ['darwin', 'win32']
  },
  storage: {
    endpoint: process.env.COVERSE_STORAGE_ENDPOINT || '',
    bucket: process.env.COVERSE_STORAGE_BUCKET || ''
  },
  paths: {
    appRoot: __dirname,
    assets: path.join(__dirname, 'assets')
  }
};
