const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function readArgValue(flags) {
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!flags.includes(current)) continue;
    const value = args[index + 1];
    if (!value || value.startsWith('-')) return '';
    return value;
  }
  return '';
}

function printHelp() {
  console.log('Usage: npm run start:client -- [--profile NAME] [--user-data-dir PATH]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run start:client -- --profile userA');
  console.log('  npm run start:client -- --profile userB');
  console.log('  npm run start:client -- --user-data-dir .userB2');
}

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const requestedProfile = readArgValue(['--profile', '-p']);
const requestedUserDataDir = readArgValue(['--user-data-dir', '--userDataDir']);

const normalizedProfile = String(requestedProfile || 'clientA').replace(/[^a-zA-Z0-9_-]/g, '') || 'clientA';
const resolvedUserDataDir = requestedUserDataDir
  ? (path.isAbsolute(requestedUserDataDir)
    ? requestedUserDataDir
    : path.resolve(projectRoot, requestedUserDataDir))
  : path.resolve(projectRoot, `.${normalizedProfile}`);

fs.mkdirSync(resolvedUserDataDir, { recursive: true });

const childEnv = {
  ...process.env,
  ELECTRON_USER_DATA_DIR: resolvedUserDataDir,
  COVERSE_ALLOW_MULTI_INSTANCE: process.env.COVERSE_ALLOW_MULTI_INSTANCE || '1'
};

console.log(`[start:client] profile=${normalizedProfile} userDataDir=${resolvedUserDataDir}`);

const launcherPath = path.resolve(projectRoot, 'start-electron-dev-safe.js');
const child = spawn(process.execPath, [launcherPath], {
  cwd: projectRoot,
  env: childEnv,
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
  console.error('[start:client] Failed to launch client:', error?.message || error);
  process.exit(1);
});
