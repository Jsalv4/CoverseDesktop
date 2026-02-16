const fs = require('fs');
const path = require('path');

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 15000;
const RETRY_BASE_MS = 30000;
const RETRY_MAX_MS = 5 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function isTransientUpdaterError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enetunreach') ||
    message.includes('enotfound') ||
    message.includes('net::err_') ||
    message.includes('socket hang up') ||
    message.includes('temporarily unavailable')
  );
}

function createUpdaterLogger(app) {
  let logFilePath = null;

  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, 'updater.log');
  } catch (_error) {
    logFilePath = null;
  }

  return {
    log(level, event, data = {}) {
      const entry = {
        time: nowIso(),
        level,
        event,
        ...data
      };

      const line = JSON.stringify(entry);
      if (level === 'error') {
        console.error('[updater]', line);
      } else if (level === 'warn') {
        console.warn('[updater]', line);
      } else {
        console.log('[updater]', line);
      }

      if (logFilePath) {
        try {
          fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
        } catch (_error) {
          // no-op
        }
      }
    }
  };
}

function createUpdateManager({ app, autoUpdater, sendStatus, menuNotify }) {
  const logger = createUpdaterLogger(app);

  let started = false;
  let updaterEnabled = false;
  let updateCheckInProgress = false;
  let periodicTimer = null;
  let startupTimer = null;
  let retryTimer = null;
  let manualCheckPending = false;
  let downloadReady = false;
  let transientFailures = 0;
  let remindUntil = 0;

  const state = {
    state: 'idle',
    percent: 0,
    message: '',
    version: app.getVersion(),
    timestamp: nowIso()
  };

  const notify = (payload = {}) => {
    const next = {
      ...state,
      ...payload,
      timestamp: nowIso()
    };
    Object.assign(state, next);
    sendStatus(next);
  };

  const clearTimers = () => {
    if (periodicTimer) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleTransientRetry = () => {
    const delay = Math.min(RETRY_BASE_MS * Math.pow(2, transientFailures - 1), RETRY_MAX_MS);
    logger.log('warn', 'retry_scheduled', { delayMs: delay, transientFailures });
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      checkForUpdates({ manual: false, source: 'auto-retry' });
    }, delay);
  };

  const applyRuntimeFeedOverride = () => {
    const overrideUrl = String(process.env.COVERSE_UPDATE_URL || '').trim().replace(/\/+$/, '');
    if (!overrideUrl) return;

    if (!overrideUrl.startsWith('https://')) {
      logger.log('warn', 'insecure_feed_url_ignored', { overrideUrl });
      return;
    }

    try {
      autoUpdater.setFeedURL({ provider: 'generic', url: overrideUrl });
      logger.log('info', 'feed_override_applied', { overrideUrl });
    } catch (error) {
      logger.log('error', 'feed_override_failed', { message: error?.message || String(error) });
    }
  };

  const onError = (error, source = 'event') => {
    const message = error?.message || 'Updater error';
    notify({ state: 'error', message });
    logger.log('error', 'updater_error', { source, message });

    if (manualCheckPending) {
      manualCheckPending = false;
      menuNotify?.('Update check failed', message);
    }

    if (isTransientUpdaterError(error)) {
      transientFailures += 1;
      scheduleTransientRetry();
    } else {
      transientFailures = 0;
    }
  };

  const attachEvents = () => {
    autoUpdater.on('checking-for-update', () => {
      notify({ state: 'checking', message: 'Checking for updates...' });
      logger.log('info', 'checking_for_update');
    });

    autoUpdater.on('update-available', (info) => {
      const nextVersion = info?.version || 'new';
      notify({
        state: 'update-available',
        message: `Update ${nextVersion} available. Downloading...`,
        nextVersion,
        percent: 0
      });
      logger.log('info', 'update_available', { nextVersion });
      transientFailures = 0;
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));
      notify({
        state: 'downloading',
        percent,
        message: `Downloading update... ${percent.toFixed(1)}%`
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      downloadReady = true;
      const nextVersion = info?.version || 'new';
      const shouldRemindLater = Date.now() < remindUntil;
      notify({
        state: shouldRemindLater ? 'remind-later' : 'downloaded',
        nextVersion,
        percent: 100,
        message: shouldRemindLater
          ? `Update ${nextVersion} downloaded. Reminder is snoozed.`
          : `Update ${nextVersion} downloaded. Install and restart when ready.`
      });
      logger.log('info', 'update_downloaded', { nextVersion, remindLater: shouldRemindLater });
      transientFailures = 0;
    });

    autoUpdater.on('update-not-available', (info) => {
      notify({
        state: 'up-to-date',
        message: `You're up to date (${info?.version || app.getVersion()}).`,
        percent: 0
      });
      logger.log('info', 'update_not_available', { version: info?.version || app.getVersion() });
      transientFailures = 0;

      if (manualCheckPending) {
        manualCheckPending = false;
        menuNotify?.('No updates found', `You are on the latest version (${app.getVersion()}).`);
      }
    });

    autoUpdater.on('error', (error) => onError(error, 'event'));
  };

  async function checkForUpdates({ manual = false, source = 'manual' } = {}) {
    if (!updaterEnabled) {
      const message = 'Updater is disabled for this run.';
      logger.log('warn', 'check_skipped_disabled', { manual, source });
      if (manual) menuNotify?.('Updater disabled', message);
      return { ok: false, error: message };
    }

    if (updateCheckInProgress) {
      if (manual) menuNotify?.('Update check in progress', 'Please wait for the current check to finish.');
      return { ok: false, error: 'Update check already in progress.' };
    }

    updateCheckInProgress = true;
    manualCheckPending = manual;

    try {
      await autoUpdater.checkForUpdates();
      logger.log('info', 'check_requested', { manual, source });
      return { ok: true };
    } catch (error) {
      onError(error, source);
      return { ok: false, error: error?.message || 'Failed to check for updates.' };
    } finally {
      updateCheckInProgress = false;
    }
  }

  async function installAndRestart() {
    if (!updaterEnabled || !downloadReady) {
      return { ok: false, error: 'No downloaded update is ready to install.' };
    }

    logger.log('info', 'install_requested');
    app.isQuitting = true;
    autoUpdater.quitAndInstall();
    return { ok: true };
  }

  async function remindLater() {
    if (!downloadReady) {
      return { ok: false, error: 'No downloaded update is available to postpone.' };
    }

    remindUntil = Date.now() + (2 * 60 * 60 * 1000);
    notify({
      state: 'remind-later',
      message: 'Update reminder snoozed for 2 hours.'
    });
    logger.log('info', 'remind_later', { remindUntil: new Date(remindUntil).toISOString() });
    return { ok: true };
  }

  function start() {
    if (started) return;
    started = true;

    const allowDevUpdater = process.env.COVERSE_ENABLE_DEV_UPDATER === '1';
    updaterEnabled = !!autoUpdater && (app.isPackaged || allowDevUpdater);

    if (!updaterEnabled) {
      logger.log('info', 'updater_disabled', {
        appIsPackaged: app.isPackaged,
        allowDevUpdater,
        hasAutoUpdater: !!autoUpdater
      });
      return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoRunAppAfterInstall = true;

    applyRuntimeFeedOverride();
    attachEvents();

    startupTimer = setTimeout(() => {
      startupTimer = null;
      checkForUpdates({ manual: false, source: 'startup' });
    }, INITIAL_CHECK_DELAY_MS);

    periodicTimer = setInterval(() => {
      checkForUpdates({ manual: false, source: 'interval' });
    }, SIX_HOURS_MS);

    logger.log('info', 'updater_started', { intervalMs: SIX_HOURS_MS });
  }

  function dispose() {
    clearTimers();
    started = false;
  }

  return {
    start,
    dispose,
    checkForUpdates,
    installAndRestart,
    remindLater,
    getState: () => ({ ...state }),
    isEnabled: () => updaterEnabled
  };
}

module.exports = {
  createUpdateManager,
  isTransientUpdaterError
};
