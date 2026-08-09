'use strict';

/**
 * T2K — phrase dog-whistle + settings (source → cible, timer).
 */

let t2kSettings = {
  source: '',
  target: '',
  timerSec: 3,
  onboardingDone: false,
};
let t2kBannerTimer = null;
let t2kCountdownTimer = null;

function t2kDebug(...args) {
  console.debug('t2k:', ...args);
}

function t2kChannelLogin() {
  const seg = window.location.pathname.split('/').filter(Boolean)[0] || '';
  return seg.toLowerCase();
}

function t2kNormalizeUser(s) {
  return String(s || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

function t2kIsChannelLive() {
  const root = document;
  if (root.querySelector('[data-a-target="offline-channel-main"]')) return false;

  const liveSelectors = [
    '[data-a-target="player-overlay-live"]',
    '[data-a-player-state="playing"]',
    '.live-indicator-container',
    'div[aria-label*="Live" i]',
    'span[aria-label*="Live" i]',
    'p[data-a-target="animated-channel-viewers-count"]',
  ];
  for (const sel of liveSelectors) {
    try {
      if (root.querySelector(sel)) return true;
    } catch {
      /* ignore */
    }
  }

  const nodes = root.querySelectorAll(
    '[class*="ChannelStatus"], [data-a-target*="live"]'
  );
  for (const el of nodes) {
    const t = (el.textContent || '').trim().toUpperCase();
    const aria = (el.getAttribute('aria-label') || '').toUpperCase();
    if (t === 'LIVE' || aria.includes('LIVE')) return true;
    if (t.includes('OFFLINE') || aria.includes('OFFLINE')) return false;
  }

  const video = root.querySelector('video');
  if (video && !video.paused && video.readyState >= 2) return true;
  return false;
}

function t2kLineHasBroadcasterBadge(line) {
  const badges = line.querySelectorAll(
    'img[alt], img[aria-label], div[aria-label], span[aria-label], [data-a-target*="badge"]'
  );
  for (const b of badges) {
    const blob = (
      (b.getAttribute('alt') || '') +
      ' ' +
      (b.getAttribute('aria-label') || '') +
      ' ' +
      (b.getAttribute('data-a-target') || '')
    ).toLowerCase();
    if (
      blob.includes('broadcaster') ||
      blob.includes('streamer') ||
      blob.includes('diffuseur')
    ) {
      return true;
    }
  }
  return false;
}

function t2kExtractAuthor(line) {
  const tagged = line.querySelector('[data-a-user]');
  if (tagged) return t2kNormalizeUser(tagged.getAttribute('data-a-user'));

  const nameEl = line.querySelector(
    '[data-a-target="chat-message-username"], .chat-author__display-name, button[data-a-target="chat-message-username"]'
  );
  if (nameEl) return t2kNormalizeUser(nameEl.textContent);

  const link = line.querySelector('a[href^="/"]');
  if (link) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/^\/([A-Za-z0-9_]{1,25})(?:\/|$)/);
    if (m) return t2kNormalizeUser(m[1]);
  }
  return '';
}

function t2kExtractMessageText(line) {
  const body = line.querySelector(
    '[data-a-target="chat-message-text"], [data-a-target="chat-line-message-body"], span.text-fragment'
  );
  if (body) return (body.textContent || '').trim();
  return (line.textContent || '').trim();
}

function t2kSeenKey(channel, author, text) {
  return `t2k_seen:${channel}:${author}:${text}`;
}

function t2kAlreadySeen(key) {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function t2kMarkSeen(key) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

function t2kRemoveBanner() {
  if (t2kBannerTimer) {
    clearTimeout(t2kBannerTimer);
    t2kBannerTimer = null;
  }
  if (t2kCountdownTimer) {
    clearInterval(t2kCountdownTimer);
    t2kCountdownTimer = null;
  }
  const el = document.getElementById('t2k-raid-banner');
  if (el) el.remove();
  document.removeEventListener('keydown', t2kOnEscape, true);
}

function t2kOnEscape(ev) {
  if (ev.key === 'Escape') {
    ev.preventDefault();
    t2kRemoveBanner();
  }
}

function t2kShowBanner(url, seconds) {
  if (document.getElementById('t2k-raid-banner')) return;

  const sec = Math.min(30, Math.max(1, Number(seconds) || 3));
  const root = document.createElement('div');
  root.id = 't2k-raid-banner';
  root.setAttribute('role', 'dialog');
  root.style.cssText =
    'position:fixed;z-index:2147483647;left:0;right:0;bottom:0;' +
    'display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;' +
    'padding:14px 18px;background:#0e0e10;color:#efeff1;font:14px/1.4 sans-serif;' +
    'border-top:2px solid #53fc18;box-sizing:border-box;';

  const msg = document.createElement('span');
  msg.id = 't2k-raid-msg';

  const urlSpan = document.createElement('span');
  urlSpan.style.cssText = 'opacity:0.9;word-break:break-all;color:#53fc18;';
  urlSpan.textContent = url;

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Annuler';
  cancel.style.cssText =
    'cursor:pointer;padding:6px 12px;border:1px solid #adadb8;border-radius:4px;' +
    'background:transparent;color:#efeff1;font:inherit;';
  cancel.addEventListener('click', t2kRemoveBanner);

  root.appendChild(msg);
  root.appendChild(urlSpan);
  root.appendChild(cancel);
  document.documentElement.appendChild(root);
  document.addEventListener('keydown', t2kOnEscape, true);

  let left = sec;
  const paint = () => {
    msg.textContent = `Raid T2K dans ${left}… `;
  };
  paint();
  t2kCountdownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(t2kCountdownTimer);
      t2kCountdownTimer = null;
      return;
    }
    paint();
  }, 1000);

  t2kBannerTimer = setTimeout(() => {
    t2kRemoveBanner();
    window.location.assign(url);
  }, sec * 1000);
}

function t2kHandleChatLine(line) {
  if (!line || line.nodeType !== 1) return;
  if (!t2kSettings.source) {
    t2kDebug('no source configured');
    return;
  }

  const login = t2kChannelLogin();
  if (login !== t2kSettings.source) return;

  const text = t2kExtractMessageText(line);
  if (typeof t2kIsTriggerPhrase !== 'function' || !t2kIsTriggerPhrase(text)) {
    return;
  }

  const author = t2kExtractAuthor(line);
  const isBroadcaster =
    author === login || t2kLineHasBroadcasterBadge(line);
  if (!isBroadcaster) {
    t2kDebug('ignored: not broadcaster', author);
    return;
  }

  if (!t2kIsChannelLive()) {
    t2kDebug('ignored: not live');
    return;
  }

  const seen = t2kSeenKey(login, author, text);
  if (t2kAlreadySeen(seen)) return;
  t2kMarkSeen(seen);

  const target = t2kSettings.target || t2kSettings.source;
  const url = `https://kick.com/${target}`;
  t2kDebug('raid →', url);
  t2kShowBanner(url, t2kSettings.timerSec);
}

function t2kScanNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  if (
    node.matches &&
    (node.matches('[data-a-target="chat-line-message"]') ||
      node.matches('.chat-line__message'))
  ) {
    t2kHandleChatLine(node);
  }
  const lines = node.querySelectorAll
    ? node.querySelectorAll(
        '[data-a-target="chat-line-message"], .chat-line__message'
      )
    : [];
  for (const line of lines) t2kHandleChatLine(line);
}

function t2kObserveChat() {
  const root = document.documentElement || document.body;
  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) t2kScanNode(node);
    }
  });
  obs.observe(root, { childList: true, subtree: true });
}

async function t2kRefreshSettings() {
  t2kSettings = await t2kLoadSettings();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  t2kRefreshSettings();
});

(async function t2kMain() {
  await t2kRefreshSettings();
  t2kObserveChat();
})();
