#!/usr/bin/env node
'use strict';

/**
 * Local T2K raid app — double-click / `npm start`.
 * Opens a tiny UI in the browser; private key never leaves this PC.
 */

const http = require('http');
const { exec } = require('child_process');
const {
  t2kLoadConfig,
  t2kSaveConfig,
  t2kSignRaidCommand,
  T2K_MAX_TTL_SEC,
} = require('./t2k-common');

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
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function t2kHtmlPage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>T2K — Assistant Raid</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Fraunces:wght@700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #eef2f0; --ink: #14201a; --muted: #45534c; --card: #fbfcfb;
      --line: #c5d0c9; --accent: #0b6e4f; --code: #152019;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; font-family: "DM Sans", system-ui, sans-serif;
      color: var(--ink); background: radial-gradient(900px 400px at 0% 0%, #d5e6de, transparent), var(--bg);
      display: grid; place-items: center; padding: 1.5rem;
    }
    .card {
      width: min(100%, 28rem); background: var(--card); border: 1px solid var(--line);
      border-radius: 14px; padding: 1.4rem 1.5rem; box-shadow: 0 16px 40px rgba(20,32,26,.08);
    }
    h1 { font-family: Fraunces, Georgia, serif; margin: 0 0 .35rem; font-size: 1.85rem; }
    .sub { color: var(--muted); margin: 0 0 1.25rem; font-size: .95rem; }
    label { display: block; font-weight: 600; font-size: .85rem; margin: .85rem 0 .35rem; }
    input {
      width: 100%; padding: .65rem .75rem; border: 1px solid var(--line); border-radius: 8px;
      font: inherit; background: #fff;
    }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    button {
      margin-top: 1.1rem; width: 100%; border: 0; border-radius: 8px; padding: .8rem 1rem;
      background: var(--accent); color: #fff; font: inherit; font-weight: 700; cursor: pointer;
    }
    button:disabled { opacity: .55; cursor: wait; }
    .hint { font-size: .82rem; color: var(--muted); margin: .4rem 0 0; }
    .out {
      margin-top: 1rem; padding: .75rem; background: var(--code); color: #e7f0ea;
      border-radius: 8px; font: 12px/1.4 ui-monospace, Consolas, monospace;
      word-break: break-all; display: none;
    }
    .msg { margin-top: .75rem; font-size: .9rem; min-height: 1.2em; }
    .ok { color: var(--accent); font-weight: 600; }
    .err { color: #a33; font-weight: 600; }
    .warn {
      margin-top: 1rem; padding: .7rem .8rem; background: #eef6f2; border-left: 3px solid var(--accent);
      border-radius: 0 8px 8px 0; font-size: .82rem; color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>T2K Raid</h1>
    <p class="sub">Signe un raid et copie la commande. La clé privée reste sur ce PC.</p>

    <label for="streamer">Login Twitch</label>
    <input id="streamer" autocomplete="off" placeholder="monpseudo" />

    <div class="row">
      <div>
        <label for="trigger">Mot-clé (trigger)</label>
        <input id="trigger" autocomplete="off" placeholder="!raid" />
      </div>
      <div>
        <label for="ttl">Durée (sec, max ${T2K_MAX_TTL_SEC})</label>
        <input id="ttl" type="number" min="1" max="${T2K_MAX_TTL_SEC}" value="60" />
      </div>
    </div>
    <p class="hint">Même trigger que dans <code>streamers.json</code> (champ <code>trigger</code>), sinon l’extension ignore le message.</p>

    <label for="url">URL cible (https)</label>
    <input id="url" autocomplete="off" placeholder="https://kick.com/cible" />

    <button id="go" type="button">Signer &amp; copier</button>
    <div id="msg" class="msg"></div>
    <pre id="out" class="out"></pre>

    <div class="warn">
      Après un changement de trigger, mets à jour <strong>public/streamers.json</strong>
      (<code>"trigger": "!tonmot"</code>) et republie Pages pour que les viewers matchent.
    </div>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    async function load() {
      const cfg = await fetch('/api/config').then((r) => r.json());
      $('streamer').value = cfg.streamer || '';
      $('trigger').value = cfg.trigger || '!raid';
      $('ttl').value = cfg.ttl || 60;
      $('url').value = cfg.lastUrl || 'https://kick.com/';
    }
    async function sign() {
      const msg = $('msg');
      const out = $('out');
      msg.textContent = '';
      msg.className = 'msg';
      out.style.display = 'none';
      $('go').disabled = true;
      try {
        const body = {
          streamer: $('streamer').value.trim(),
          trigger: $('trigger').value.trim(),
          ttl: Number($('ttl').value),
          url: $('url').value.trim(),
        };
        const res = await fetch('/api/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        out.textContent = data.command;
        out.style.display = 'block';
        try {
          await navigator.clipboard.writeText(data.command);
          msg.textContent = 'Copié ! Colle (Ctrl+V) dans le chat Twitch.';
        } catch {
          msg.textContent = 'Signé — copie manuellement la commande ci-dessous.';
        }
        msg.className = 'msg ok';
      } catch (e) {
        msg.textContent = e.message || String(e);
        msg.className = 'msg err';
      } finally {
        $('go').disabled = false;
      }
    }
    $('go').addEventListener('click', sign);
    load();
  </script>
</body>
</html>`;
}

function t2kOpenBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

const cfg0 = t2kLoadConfig();
const port = cfg0.port || 3847;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      return t2kSend(res, 200, t2kHtmlPage(), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && req.url === '/api/config') {
      return t2kSend(res, 200, t2kLoadConfig());
    }
    if (req.method === 'POST' && req.url === '/api/sign') {
      const body = await t2kReadBody(req);
      const signed = t2kSignRaidCommand({
        login: body.streamer,
        url: body.url,
        ttl: body.ttl,
        trigger: body.trigger,
      });
      t2kSaveConfig({
        ...t2kLoadConfig(),
        streamer: signed.streamer,
        trigger: signed.trigger,
        ttl: body.ttl,
        lastUrl: signed.url,
        port,
      });
      return t2kSend(res, 200, signed);
    }
    t2kSend(res, 404, { error: 'Not found' });
  } catch (e) {
    t2kSend(res, 400, { error: e.message || String(e) });
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`T2K raid app: ${url}`);
  console.log('Ferme cette fenêtre pour arrêter l’assistant.');
  t2kOpenBrowser(url);
});
