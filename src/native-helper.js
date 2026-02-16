const os = require('os');

class NativeHelper {
  constructor(config) {
    this.config = config;
    this.platform = os.platform();
    this.arch = os.arch();
    this.helperAvailable = false;
  }

  async ping() {
    return { ok: false, reason: 'not-implemented', platform: this.platform };
  }

  async startControl(targetWindowId) {
    console.warn('[helper] startControl stub', targetWindowId);
    return { ok: false, reason: 'not-implemented' };
  }

  async stopControl() {
    console.warn('[helper] stopControl stub');
    return { ok: false, reason: 'not-implemented' };
  }

  async setTargetWindow(windowId) {
    console.warn('[helper] setTargetWindow stub', windowId);
    return { ok: false, reason: 'not-implemented' };
  }

  async getFocusState() {
    return { ok: false, focused: false, reason: 'not-implemented' };
  }

  runtimeInfo() {
    return {
      platform: this.platform,
      arch: this.arch,
      helperAvailable: this.helperAvailable,
      endpoint: this.config.helper.endpoint
    };
  }
}

module.exports = NativeHelper;
