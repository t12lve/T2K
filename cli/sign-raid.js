#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

function parseArgs(argv) {
  const args = argv.slice(2);
  let ttl = 60;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ttl') {
      ttl = Number(args[++i]);
      if (!Number.isFinite(ttl) || ttl <= 0) {
        throw new Error('Invalid --ttl');
      }
    } else {
      positional.push(args[i]);
    }
  }
  const [loginRaw, url] = positional;
  return { login: (loginRaw || '').trim().toLowerCase(), url, ttl };
}

let login, url, ttl;
try {
  ({ login, url, ttl } = parseArgs(process.argv));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

if (!login || !url) {
  console.error('Usage: node cli/sign-raid.js <streamer_login> <https_url> [--ttl 60]');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(url);
} catch {
  console.error('Invalid URL');
  process.exit(1);
}
if (parsedUrl.protocol !== 'https:') {
  console.error('URL must use https:');
  process.exit(1);
}

const pemPath = path.join(__dirname, 'keys', `${login}_private.pem`);
if (!fs.existsSync(pemPath)) {
  console.error(`Missing private key: ${pemPath}`);
  process.exit(1);
}

const privateKey = crypto.createPrivateKey(fs.readFileSync(pemPath));
const exp = Math.floor(Date.now() / 1000) + ttl;
const payloadStr = t2kCanonicalPayload({ exp, streamer: login, url: parsedUrl.toString() });
const payloadBytes = Buffer.from(payloadStr, 'utf8');

const signature = crypto.sign('SHA-384', payloadBytes, {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
});

const envelope = {
  p: t2kBase64UrlEncode(payloadBytes),
  s: t2kBase64UrlEncode(signature),
};
const token = t2kBase64UrlEncode(Buffer.from(JSON.stringify(envelope), 'utf8'));
console.log(`!raid ${token}`);
