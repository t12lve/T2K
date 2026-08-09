'use strict';

const T2K_DEFAULTS = {
  source: '',
  target: '',
  timerSec: 3,
  onboardingDone: false,
};

function t2kNormLogin(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com)\//i, '')
    .split(/[/?#]/)[0];
}

function t2kStorageArea() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function t2kNormalizeSettings(data) {
  const d = data || {};
  return {
    source: t2kNormLogin(d.source),
    target: t2kNormLogin(d.target),
    timerSec: Math.min(30, Math.max(1, Number(d.timerSec) || 3)),
    onboardingDone: Boolean(d.onboardingDone),
  };
}

function t2kLoadSettings() {
  return new Promise((resolve) => {
    const area = t2kStorageArea();
    if (!area) {
      resolve(t2kNormalizeSettings(T2K_DEFAULTS));
      return;
    }
    try {
      area.get(T2K_DEFAULTS, (data) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('t2k storage get:', chrome.runtime.lastError.message);
          resolve(t2kNormalizeSettings(T2K_DEFAULTS));
          return;
        }
        resolve(t2kNormalizeSettings(data));
      });
    } catch (err) {
      console.warn('t2k storage get failed:', err);
      resolve(t2kNormalizeSettings(T2K_DEFAULTS));
    }
  });
}

function t2kSaveSettings(partial) {
  return new Promise((resolve) => {
    const area = t2kStorageArea();
    if (!area) {
      resolve(false);
      return;
    }
    try {
      area.set(partial, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('t2k storage set:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (err) {
      console.warn('t2k storage set failed:', err);
      resolve(false);
    }
  });
}
