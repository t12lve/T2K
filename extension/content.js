'use strict';

const T2K_STREAMERS_URL =
  'https://example.gitlab.io/t2k/streamers.json'; /* REPLACE at deploy */
const T2K_RAID_RE = /!raid\s+([A-Za-z0-9_-]+={0,2})/;
const T2K_TTL_SEC = 60;
const T2K_DRIFT_SEC = 120;
const T2K_BANNER_SEC = 3;
const T2K_REFRESH_MS = 5 * 60 * 1000;

const t2k_processed_raids = new Set();
let t2kStreamers = null;
let t2kBannerTimer = null;
let t2kCountdownTimer = null;

function t2kDebug(...args) {
  console.debug('t2k:', ...args);
}

function t2kBase64UrlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '==='.slice((b64.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function t2kBytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

function t2kNormalizeSignatureKey(s) {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function t2kChannelLogin() {
  const seg = window.location.pathname.split('/').filter(Boolean)[0] || '';
  return seg.toLowerCase();
}

function t2kCanonicalPayload({ exp, streamer, url }) {
  return JSON.stringify({ exp, streamer, url });
}

async function t2kFetchStreamers() {
  try {
    const res = await fetch(T2K_STREAMERS_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.streamers && typeof data.streamers === 'object') {
      t2kStreamers = data.streamers;
    }
  } catch {
    /* silent fail */
  }
}

async function t2kImportPublicKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-384' },
    false,
    ['verify']
  );
}

function t2kIsHttpsUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function t2kInReplayWindow(exp) {
  const now = Math.floor(Date.now() / 1000);
  const min = exp - (T2K_TTL_SEC + T2K_DRIFT_SEC);
  const max = exp + T2K_DRIFT_SEC;
  return now >= min && now <= max;
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

function t2kShowBanner(url) {
  if (document.getElementById('t2k-raid-banner')) return;

  const root = document.createElement('div');
  root.id = 't2k-raid-banner';
  root.setAttribute('role', 'dialog');
  root.style.cssText =
    'position:fixed;z-index:2147483647;left:0;right:0;bottom:0;' +
    'display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;' +
    'padding:14px 18px;background:#0e0e10;color:#efeff1;font:14px/1.4 sans-serif;' +
    'border-top:1px solid #3a3a3d;box-sizing:border-box;';

  const msg = document.createElement('span');
  msg.id = 't2k-raid-msg';

  const urlSpan = document.createElement('span');
  urlSpan.style.cssText = 'opacity:0.85;word-break:break-all;';
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

  let left = T2K_BANNER_SEC;
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
  }, T2K_BANNER_SEC * 1000);
}

async function t2kHandleRaidToken(token) {
  if (!t2kStreamers) return;

  let envelope;
  try {
    envelope = JSON.parse(t2kBytesToUtf8(t2kBase64UrlToBytes(token)));
  } catch {
    return;
  }
  if (!envelope || typeof envelope.p !== 'string' || typeof envelope.s !== 'string') return;

  const sigKey = t2kNormalizeSignatureKey(envelope.s);
  if (t2k_processed_raids.has(sigKey)) return;

  let payloadObj;
  let payloadBytes;
  try {
    payloadBytes = t2kBase64UrlToBytes(envelope.p);
    payloadObj = JSON.parse(t2kBytesToUtf8(payloadBytes));
  } catch {
    return;
  }

  const { exp, streamer, url } = payloadObj;
  if (typeof exp !== 'number' || typeof streamer !== 'string' || typeof url !== 'string') return;

  const channel = t2kChannelLogin();
  if (streamer.toLowerCase() !== channel) {
    t2kDebug('streamer mismatch', streamer, channel);
    return;
  }

  const entry = t2kStreamers[streamer.toLowerCase()];
  if (!entry || !entry.publicKey) return;

  const canonical = t2kCanonicalPayload({
    exp,
    streamer: streamer.toLowerCase(),
    url,
  });
  const canonicalBytes = new TextEncoder().encode(canonical);
  if (
    canonicalBytes.length !== payloadBytes.length ||
    !canonicalBytes.every((b, i) => b === payloadBytes[i])
  ) {
    t2kDebug('non-canonical payload');
    return;
  }

  // Reserve the anti-replay slot synchronously (no await between the check
  // above and this add) right before the async verify call, so a second
  // mutation observed for the same signature while this call is suspended
  // on await cannot slip past the check and double-fire the raid.
  t2k_processed_raids.add(sigKey);

  let ok = false;
  try {
    const key = await t2kImportPublicKey(entry.publicKey);
    const sig = t2kBase64UrlToBytes(envelope.s);
    ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-384' },
      key,
      sig,
      payloadBytes
    );
  } catch (e) {
    t2kDebug('verify error', e);
    t2k_processed_raids.delete(sigKey);
    return;
  }
  if (!ok) {
    t2k_processed_raids.delete(sigKey);
    return;
  }

  if (!t2kInReplayWindow(exp)) {
    t2kDebug('expired/out of window');
    return;
  }
  if (!t2kIsHttpsUrl(url)) return;

  t2kShowBanner(url);
}

function t2kScanText(text) {
  if (!text || text.indexOf('!raid') === -1) return;
  const m = text.match(T2K_RAID_RE);
  if (m) t2kHandleRaidToken(m[1]);
}

function t2kObserveChat() {
  const root = document.documentElement || document.body;
  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          t2kScanText(node.textContent);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          t2kScanText(node.textContent);
        }
      }
    }
  });
  obs.observe(root, { childList: true, subtree: true, characterData: true });
}

(async function t2kMain() {
  await t2kFetchStreamers();
  setInterval(t2kFetchStreamers, T2K_REFRESH_MS);
  t2kObserveChat();
})();
