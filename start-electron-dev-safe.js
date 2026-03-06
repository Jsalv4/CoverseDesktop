const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const projectRoot = __dirname;

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (_error) {
    // continue with best effort
  }
}

const safeUserDataDir = process.env.ELECTRON_USER_DATA_DIR
  || path.join(os.tmpdir(), 'coverse-electron-userdata-dev');

ensureDir(safeUserDataDir);

const env = {
  ...process.env,
  ELECTRON_USER_DATA_DIR: safeUserDataDir,
  COVERSE_DISABLE_GPU: process.env.COVERSE_DISABLE_GPU || '1',
  COVERSE_SKIP_WSS: process.env.COVERSE_SKIP_WSS || '1',
  COVERSE_ALLOW_MULTI_INSTANCE: process.env.COVERSE_ALLOW_MULTI_INSTANCE || '1'
};

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(true));
    });
  });
}

function resolveElectronCommand() {
  try {
    const electronPath = require('electron');
    if (typeof electronPath === 'string' && electronPath.trim()) {
      return { command: electronPath, args: ['.'] };
    }
  } catch (_error) {
    // fallback below
  }

  if (process.platform === 'win32') {
    return {
      command: 'node',
      args: [path.join(projectRoot, 'node_modules', 'electron', 'cli.js'), '.']
    };
  }

  return { command: path.join(projectRoot, 'node_modules', '.bin', 'electron'), args: ['.'] };
}

const launch = resolveElectronCommand();

async function applySafeWssSettings() {
  if (process.env.COVERSE_SKIP_WSS === '1') {
    env.COVERSE_SKIP_WSS = '1';
    return;
  }

  const requestedPort = Number.parseInt(process.env.COVERSE_WSS_PORT || '5181', 10);
  if (!Number.isFinite(requestedPort) || requestedPort <= 0) {
    return;
  }

  const available = await isPortAvailable(requestedPort);
  if (!available) {
    env.COVERSE_SKIP_WSS = '1';
    console.warn(`[coverse:start-safe] Port ${requestedPort} is in use. Starting with COVERSE_SKIP_WSS=1.`);
  }
}

applySafeWssSettings().then(() => {
  const child = spawn(launch.command, launch.args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    windowsHide: false
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });

  child.on('error', (error) => {
    console.error('[coverse:start-safe] Failed to launch Electron:', error?.message || error);
    process.exit(1);
  });
}).catch((error) => {
  console.error('[coverse:start-safe] Startup preflight failed:', error?.message || error);
  process.exit(1);
});
