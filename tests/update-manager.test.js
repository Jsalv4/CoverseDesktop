const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const os = require('node:os');

const { createUpdateManager, isTransientUpdaterError } = require('../src/update-manager');

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.checkCalls = 0;
    this.quitCalls = 0;
    this.autoDownload = false;
    this.autoInstallOnAppQuit = false;
    this.autoRunAppAfterInstall = false;
  }

  async checkForUpdates() {
    this.checkCalls += 1;
    this.emit('checking-for-update');
    this.emit('update-available', { version: '1.0.2' });
    this.emit('download-progress', { percent: 42.5 });
    this.emit('update-downloaded', { version: '1.0.2' });
    return { updateInfo: { version: '1.0.2' } };
  }

  quitAndInstall() {
    this.quitCalls += 1;
  }

  setFeedURL() {
    // no-op for tests
  }
}

function createMockApp() {
  const tempRoot = path.join(os.tmpdir(), 'coverse-update-tests');
  return {
    isPackaged: true,
    isQuitting: false,
    getVersion: () => '1.0.1',
    getPath: () => tempRoot
  };
}

test('isTransientUpdaterError recognizes transient errors', () => {
  assert.equal(isTransientUpdaterError(new Error('ETIMEDOUT while requesting')), true);
  assert.equal(isTransientUpdaterError(new Error('socket hang up')), true);
  assert.equal(isTransientUpdaterError(new Error('validation failed permanently')), false);
});

test('update manager emits expected state transitions and supports install/remind', async () => {
  const app = createMockApp();
  const updater = new FakeUpdater();
  const statuses = [];

  const manager = createUpdateManager({
    app,
    autoUpdater: updater,
    sendStatus: (payload) => statuses.push(payload),
    menuNotify: () => {}
  });

  manager.start();

  const check = await manager.checkForUpdates({ manual: true, source: 'test' });
  assert.equal(check.ok, true);

  const states = statuses.map((item) => item.state);
  assert.ok(states.includes('checking'));
  assert.ok(states.includes('update-available') || states.includes('downloading'));
  assert.ok(states.includes('downloaded'));

  const remind = await manager.remindLater();
  assert.equal(remind.ok, true);

  const install = await manager.installAndRestart();
  assert.equal(install.ok, true);
  assert.equal(updater.quitCalls, 1);

  manager.dispose();
});
