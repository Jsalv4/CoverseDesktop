const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const os = require('node:os');

const { createUpdateManager } = require('../src/update-manager');

class ShapeUpdater extends EventEmitter {
  async checkForUpdates() {
    this.emit('checking-for-update');
    this.emit('update-not-available', { version: '1.0.1' });
    return { updateInfo: { version: '1.0.1' } };
  }

  setFeedURL() {}
  quitAndInstall() {}
}

function createMockApp() {
  const tempRoot = path.join(os.tmpdir(), 'coverse-update-tests-shape');
  return {
    isPackaged: true,
    isQuitting: false,
    getVersion: () => '1.0.1',
    getPath: () => tempRoot
  };
}

test('IPC payload shape contains required fields', async () => {
  const payloads = [];
  const manager = createUpdateManager({
    app: createMockApp(),
    autoUpdater: new ShapeUpdater(),
    sendStatus: (payload) => payloads.push(payload),
    menuNotify: () => {}
  });

  manager.start();
  await manager.checkForUpdates({ manual: true, source: 'shape-test' });

  assert.ok(payloads.length >= 1);
  payloads.forEach((payload) => {
    assert.equal(typeof payload.state, 'string');
    assert.equal(typeof payload.timestamp, 'string');
    assert.equal(typeof payload.message, 'string');
    assert.ok(Object.prototype.hasOwnProperty.call(payload, 'percent'));
  });

  manager.dispose();
});
