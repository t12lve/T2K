'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const T2K_TTL_SEC = 60;
const T2K_DRIFT_SEC = 120;
const T2K_MAX_TTL_SEC = T2K_TTL_SEC + T2K_DRIFT_SEC;
const T2K_DEFAULT_TRIGGER = '!raid';
const T2K_CONFIG_PATH = path.join(__dirname, 't2k.config.json');

function t2kBase64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function t2kCanonicalPayload({ exp, streamer, url }) {
  return JSON.stringify({ exp, streamer, url });
}

function t2kNormalizeTrigger(raw) {
  const t = String(raw || '').trim();
  if (!t) return T2K_DEFAULT_TRIGGER;
  if (/\s/.test(t)) {
    throw new Error('Trigger word cannot contain spaces');
  }
  if (t.length > 32) {
    throw new Error('Trigger word max length is 32');
  }
  return t;
}

function t2kDefaultConfig() {
  return {
    streamer: '',
    trigger: T2K_DEFAULT_TRIGGER,
    ttl: T2K_TTL_SEC,
    lastUrl: 'https://kick.com/',
    port: 3847,
  };
}

function t2kLoadConfig() {
  const base = t2kDefaultConfig();
  if (!fs.existsSync(T2K_CONFIG_PATH)) return base;
  try {
    const raw = JSON.parse(fs.readFileSync(T2K_CONFIG_PATH, 'utf8'));
    return {
      ...base,
      ...raw,
      trigger: t2kNormalizeTrigger(raw.trigger || base.trigger),
      streamer: String(raw.streamer || '')
        .trim()
        .toLowerCase(),
      ttl: Number(raw.ttl) > 0 ? Number(raw.ttl) : base.ttl,
      port: Number(raw.port) > 0 ? Number(raw.port) : base.port,
    };
  } catch {
    return base;
  }
}

function t2kSaveConfig(cfg) {
  const next = {
    streamer: String(cfg.streamer || '')
      .trim()
      .toLowerCase(),
    trigger: t2kNormalizeTrigger(cfg.trigger),
    ttl: Math.min(
      T2K_MAX_TTL_SEC,
      Math.max(1, Number(cfg.ttl) || T2K_TTL_SEC)
    ),
    lastUrl: String(cfg.lastUrl || 'https://kick.com/'),
    port: Number(cfg.port) > 0 ? Number(cfg.port) : 3847,
  };
  fs.writeFileSync(T2K_CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', {
    mode: 0o600,
  });
  return next;
}

function t2kSignRaidCommand({ login, url, ttl, trigger }) {
  const streamer = String(login || '')
    .trim()
    .toLowerCase();
  if (!streamer || !/^[a-z0-9_]{1,25}$/.test(streamer)) {
    throw new Error('Invalid streamer login');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('URL must use https:');
  }

  const ttlNum = Number(ttl);
  if (!Number.isFinite(ttlNum) || ttlNum <= 0) {
    throw new Error('Invalid ttl');
  }
  if (ttlNum > T2K_MAX_TTL_SEC) {
    throw new Error(
      `--ttl too large: ${ttlNum}s exceeds max ${T2K_MAX_TTL_SEC}s`
    );
  }

  const trig = t2kNormalizeTrigger(trigger);
  const pemPath = path.join(__dirname, 'keys', `${streamer}_private.pem`);
  if (!fs.existsSync(pemPath)) {
    throw new Error(`Missing private key: ${pemPath}`);
  }

  const privateKey = crypto.createPrivateKey(fs.readFileSync(pemPath));
  const exp = Math.floor(Date.now() / 1000) + ttlNum;
  const payloadStr = t2kCanonicalPayload({
    exp,
    streamer,
    url: parsedUrl.toString(),
  });
  const payloadBytes = Buffer.from(payloadStr, 'utf8');
  const signature = crypto.sign('SHA-384', payloadBytes, {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  const envelope = {
    p: t2kBase64UrlEncode(payloadBytes),
    s: t2kBase64UrlEncode(signature),
  };
  const token = t2kBase64UrlEncode(
    Buffer.from(JSON.stringify(envelope), 'utf8')
  );
  return {
    command: `${trig} ${token}`,
    trigger: trig,
    token,
    exp,
    url: parsedUrl.toString(),
    streamer,
  };
}

module.exports = {
  T2K_TTL_SEC,
  T2K_MAX_TTL_SEC,
  T2K_DEFAULT_TRIGGER,
  T2K_CONFIG_PATH,
  t2kBase64UrlEncode,
  t2kCanonicalPayload,
  t2kNormalizeTrigger,
  t2kLoadConfig,
  t2kSaveConfig,
  t2kSignRaidCommand,
};
