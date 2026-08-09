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

function t2kLoadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(T2K_DEFAULTS, (data) => {
      resolve({
        source: t2kNormLogin(data.source),
        target: t2kNormLogin(data.target),
        timerSec: Math.min(30, Math.max(1, Number(data.timerSec) || 3)),
        onboardingDone: Boolean(data.onboardingDone),
      });
    });
  });
}

function t2kSaveSettings(partial) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(partial, () => resolve());
  });
}
