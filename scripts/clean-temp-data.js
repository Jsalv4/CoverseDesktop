const fs = require('fs');
const path = require('path');

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const removeProfiles = args.has('--profiles');

function safeRemove(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  } catch (_error) {
    return false;
  }
}

function shouldDelete(name) {
  if (name === '.tmp-electron-userdata' || name.startsWith('.tmp-electron-userdata-')) {
    return true;
  }

  if (removeProfiles && (name === '.userA' || name === '.userB' || name === '.userB2')) {
    return true;
  }

  return false;
}

const entries = fs.readdirSync(root, { withFileTypes: true });
const targets = entries
  .filter((entry) => entry.isDirectory() && shouldDelete(entry.name))
  .map((entry) => entry.name);

if (!targets.length) {
  console.log('No temp runtime folders found.');
  process.exit(0);
}

const removed = [];
const failed = [];

for (const name of targets) {
  const fullPath = path.join(root, name);
  if (safeRemove(fullPath)) {
    removed.push(name);
  } else {
    failed.push(name);
  }
}

if (removed.length) {
  console.log(`Removed: ${removed.join(', ')}`);
}

if (failed.length) {
  console.warn(`Failed: ${failed.join(', ')}`);
  process.exitCode = 1;
}
