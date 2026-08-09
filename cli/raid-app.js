#!/usr/bin/env node
'use strict';

/**
 * T2K local assistant — onboarding wizard + raid screen.
 * Serves UI at http://127.0.0.1:<port>/  (opens browser).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const {
  t2kLoadConfig,
  t2kSaveConfig,
  t2kSignRaidCommand,
  t2kGenerateKeys,
  t2kKeyExists,
  T2K_MAX_TTL_SEC,
} = require('./t2k-common');

const ROOT = path.join(__dirname, '..');
const WIZARD_DIR = path.join(__dirname, 'wizard');
const LOGO_PATH = path.join(ROOT, 'logo.png');

function t2kReadBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function t2kSend(res, status, data, type = 'application/json; charset=utf-8') {
  const body = Buffer.isBuffer(data)
    ? data
    : typeof data === 'string'
      ? data
      : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function t2kContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function t2kSafeJoin(base, reqPath) {
  const cleaned = decodeURIComponent(reqPath.split('?')[0]).replace(/^\/+/, '');
  const full = path.normalize(path.join(base, cleaned));
  if (!full.startsWith(path.normalize(base))) return null;
  return full;
}

function t2kOpenBrowser(url) {
  if (process.platform === 'win32') exec(`start "" "${url}"`);
  else if (process.platform === 'darwin') exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
}

function t2kParseUrl(reqUrl) {
  try {
    return new URL(reqUrl, 'http://127.0.0.1');
  } catch {
    return null;
  }
}

const cfg0 = t2kLoadConfig();
const port = cfg0.port || 3847;

const server = http.createServer(async (req, res) => {
  try {
    const u = t2kParseUrl(req.url || '/');
    if (!u) return t2kSend(res, 400, { error: 'Bad request' });

    if (req.method === 'GET' && u.pathname === '/api/config') {
      return t2kSend(res, 200, t2kLoadConfig());
    }

    if (req.method === 'POST' && u.pathname === '/api/config') {
      const body = await t2kReadBody(req);
      const cur = t2kLoadConfig();
      const saved = t2kSaveConfig({
        ...cur,
        ...body,
        port,
      });
      return t2kSend(res, 200, saved);
    }

    if (req.method === 'GET' && u.pathname === '/api/key-status') {
      const streamer = u.searchParams.get('streamer') || '';
      return t2kSend(res, 200, {
        streamer: streamer.toLowerCase(),
        exists: t2kKeyExists(streamer),
      });
    }

    if (req.method === 'POST' && u.pathname === '/api/generate-keys') {
      const body = await t2kReadBody(req);
      const out = t2kGenerateKeys(body.streamer);
      const cur = t2kLoadConfig();
      t2kSaveConfig({ ...cur, streamer: out.streamer, port });
      return t2kSend(res, 200, out);
    }

    if (req.method === 'POST' && u.pathname === '/api/sign') {
      const body = await t2kReadBody(req);
      const signed = t2kSignRaidCommand({
        login: body.streamer,
        url: body.url,
        ttl: body.ttl,
        trigger: body.trigger,
      });
      const cur = t2kLoadConfig();
      t2kSaveConfig({
        ...cur,
        streamer: signed.streamer,
        trigger: signed.trigger,
        ttl: body.ttl,
        lastUrl: signed.url,
        port,
      });
      return t2kSend(res, 200, signed);
    }

    if (req.method === 'GET' && u.pathname === '/logo.png') {
      if (!fs.existsSync(LOGO_PATH)) {
        return t2kSend(res, 404, { error: 'logo.png missing' });
      }
      return t2kSend(res, 200, fs.readFileSync(LOGO_PATH), 'image/png');
    }

    if (req.method === 'GET') {
      let filePath;
      if (u.pathname === '/' || u.pathname === '/index.html') {
        filePath = path.join(WIZARD_DIR, 'index.html');
      } else {
        filePath = t2kSafeJoin(WIZARD_DIR, u.pathname);
      }
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return t2kSend(res, 404, { error: 'Not found' });
      }
      return t2kSend(
        res,
        200,
        fs.readFileSync(filePath),
        t2kContentType(filePath)
      );
    }

    t2kSend(res, 404, { error: 'Not found' });
  } catch (e) {
    t2kSend(res, 400, { error: e.message || String(e) });
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`T2K wizard: ${url}`);
  console.log(`TTL max: ${T2K_MAX_TTL_SEC}s — close this window to stop.`);
  t2kOpenBrowser(url);
});
