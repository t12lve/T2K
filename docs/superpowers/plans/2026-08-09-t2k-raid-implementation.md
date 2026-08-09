# T2K Raid Cross-Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer T2K : CLI Node (clés ECDSA P-384 + signature `!raid`) + JSON Pages + extension Chrome MV3 (verify, anti-replay, bannière 3 s, redirect HTTPS).

**Architecture:** Monolithe minimal — `cli/` signe hors navigateur ; `public/streamers.json` expose les JWK ; `extension/content.js` observe le chat Twitch, vérifie via `crypto.subtle`, puis bannière → redirect.

**Tech Stack:** Node.js (`crypto` natif), Chrome Manifest V3, Vanilla JS ES6+, Web Crypto API (ECDSA P-384 / SHA-384), GitLab Pages CI.

## Global Constraints

- Préfixe IDs / globals / métadonnées : `t2k_` / `T2K_` ; nom extension **T2K**
- Vanilla JS uniquement dans l’extension (aucun framework)
- Crypto extension : `window.crypto.subtle` uniquement (ECDSA P-384)
- Permissions MV3 : `activeTab`, `scripting`, `host_permissions` Twitch + hôte JSON
- Zéro `innerHTML` ; zéro tracker ; clé privée jamais versionnée
- Anti-replay : `now ∈ [exp - 180, exp + 120]` (secondes)
- Bannière 3 s + Escape/Annuler ; URL cible `https:` only
- `streamer` / pathname : toujours `toLowerCase()`
- Spec : `docs/superpowers/specs/2026-08-09-t2k-raid-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `.gitignore` | Exclure clés privées, `cli/keys/`, Node, OS |
| `init.sh` | Bootstrap git + arborescence + premier commit |
| `.gitlab-ci.yml` | Deploy Pages du dossier `public/` |
| `cli/generate-keys.js` | Générer PEM privée + afficher JWK public |
| `cli/sign-raid.js` | Signer payload → imprimer `!raid <token>` |
| `cli/keys/.gitkeep` | (optionnel absent — dossier gitignored) |
| `public/streamers.json` | Registre streamer → `publicKey` JWK |
| `extension/manifest.json` | MV3 T2K |
| `extension/content.js` | Observer, verify, banner, redirect |

**Wire format (référence toutes tâches) :**
- Payload canonique : `JSON.stringify` clés triées `exp`, `streamer`, `url` (sans espace)
- Envelope : `{ "p": base64url(payloadBytes), "s": base64url(sig) }` puis `base64url(utf8(JSON.stringify(envelope)))`
- Chat : `!raid <token>`

**Helpers partagés (dupliqués CLI / extension — pas de package partagé v1) :**
- `t2kCanonicalPayload({ exp, streamer, url })` → string
- `t2kBase64UrlEncode(Uint8Array|Buffer)` / `t2kBase64UrlDecode(string)`

---

### Task 1: Scaffold Git + `streamers.json` + ignore

**Files:**
- Create: `.gitignore`
- Create: `public/streamers.json`
- Create: `cli/.gitkeep` (dossier `cli/` présent)
- Create: `extension/.gitkeep` (temporaire, retiré quand les vrais fichiers existent — ou créer dossiers via fichiers réels des tâches suivantes)

**Interfaces:**
- Consumes: rien
- Produces: modèle `streamers.json` avec clé `"example"` documentaire

- [ ] **Step 1: Créer `.gitignore`**

```
# Node
node_modules/
npm-debug.log*
yarn-error.log*

# T2K secrets — NEVER commit private keys
cli/keys/
*.pem
*private*
private_key.json
*_private.json

# Env
.env
.env.*

# OS
.DS_Store
Thumbs.db
Desktop.ini

# Editors
.idea/
.vscode/
*.swp
```

- [ ] **Step 2: Créer `public/streamers.json`**

```json
{
  "streamers": {
    "example": {
      "displayName": "ExampleStreamer",
      "publicKey": {
        "kty": "EC",
        "crv": "P-384",
        "x": "REPLACE_AFTER_generate-keys",
        "y": "REPLACE_AFTER_generate-keys"
      }
    }
  }
}
```

- [ ] **Step 3: Vérifier que `cli/keys` est ignoré**

```bash
mkdir -p cli/keys
echo test > cli/keys/demo_private.pem
git check-ignore -v cli/keys/demo_private.pem
rm cli/keys/demo_private.pem
```

Expected: ligne de `.gitignore` matchant `cli/keys/` ou `*.pem`.

- [ ] **Step 4: Commit (si dépôt déjà init ; sinon Task 6 `init.sh`)**

```bash
git add .gitignore public/streamers.json
git commit -m "chore: add gitignore and streamers.json template"
```

---

### Task 2: CLI `generate-keys.js`

**Files:**
- Create: `cli/generate-keys.js`

**Interfaces:**
- Consumes: `process.argv[2]` = streamer login
- Produces: `cli/keys/<login>_private.pem` (PKCS8 PEM) ; stdout = fragment JWK à coller dans `streamers.json`

- [ ] **Step 1: Écrire `cli/generate-keys.js`**

```js
#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const login = (process.argv[2] || '').trim().toLowerCase();
if (!login || !/^[a-z0-9_]{1,25}$/.test(login)) {
  console.error('Usage: node cli/generate-keys.js <streamer_login>');
  process.exit(1);
}

const keysDir = path.join(__dirname, 'keys');
fs.mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-384',
});

const pemPath = path.join(keysDir, `${login}_private.pem`);
fs.writeFileSync(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
  mode: 0o600,
});

const jwk = publicKey.export({ format: 'jwk' });
const publicKeyOut = {
  kty: jwk.kty,
  crv: jwk.crv,
  x: jwk.x,
  y: jwk.y,
};

console.log(`Private key written: ${pemPath}`);
console.log('Add this entry to public/streamers.json under streamers:');
console.log(
  JSON.stringify(
    {
      [login]: {
        displayName: login,
        publicKey: publicKeyOut,
      },
    },
    null,
    2
  )
);
```

- [ ] **Step 2: Exécuter et vérifier**

```bash
node cli/generate-keys.js demostreamer
```

Expected: fichier `cli/keys/demostreamer_private.pem` créé ; JWK `crv: P-384` affiché ; `git status` ne liste **pas** le `.pem` comme fichier à committer (ignoré).

- [ ] **Step 3: Commit**

```bash
git add cli/generate-keys.js
git commit -m "feat: add ECDSA P-384 key generation CLI"
```

---

### Task 3: CLI `sign-raid.js`

**Files:**
- Create: `cli/sign-raid.js`

**Interfaces:**
- Consumes: `cli/keys/<login>_private.pem` ; args `<login> <https_url> [--ttl 60]`
- Produces: stdout une ligne `!raid <token>` ; même wire format que `content.js`

- [ ] **Step 1: Écrire `cli/sign-raid.js`**

```js
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
```

- [ ] **Step 2: Smoke test round-trip Node**

```bash
node cli/sign-raid.js demostreamer "https://kick.com/demo" --ttl 60
```

Expected: une ligne commençant par `!raid ` suivie d’un token base64url (sans `+` ni `/`).

Vérification crypto rapide (coller en one-shot après génération de clés) :

```bash
node -e "
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const login='demostreamer';
const line=require('child_process').execSync('node cli/sign-raid.js demostreamer https://kick.com/demo',{encoding:'utf8'}).trim();
const token=line.slice(6).trim();
const b64=token.replace(/-/g,'+').replace(/_/g,'/');
const pad=b64+( '===').slice((b64.length+3)%4);
const env=JSON.parse(Buffer.from(pad,'base64').toString('utf8'));
const payload=Buffer.from(env.p.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-env.p.length%4)%4),'base64');
const sig=Buffer.from(env.s.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-env.s.length%4)%4),'base64');
const pub=crypto.createPublicKey(crypto.createPrivateKey(fs.readFileSync('cli/keys/demostreamer_private.pem')));
const ok=crypto.verify('SHA-384',payload,{key:pub,dsaEncoding:'ieee-p1363'},sig);
console.log(ok?'VERIFY_OK':'VERIFY_FAIL');
console.log(JSON.parse(payload.toString('utf8')));
"
```

Expected: `VERIFY_OK` et JSON avec `url`, `exp`, `streamer: demostreamer`.

- [ ] **Step 3: Commit**

```bash
git add cli/sign-raid.js
git commit -m "feat: add signed !raid token CLI"
```

---

### Task 4: Extension `manifest.json`

**Files:**
- Create: `extension/manifest.json`

**Interfaces:**
- Consumes: rien
- Produces: MV3 chargeant `content.js` sur Twitch ; host permission placeholder Pages

- [ ] **Step 1: Écrire `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "T2K",
  "version": "1.0.0",
  "description": "Twitch To Kick — signed cross-platform raid redirects",
  "permissions": ["activeTab", "scripting"],
  "host_permissions": [
    "https://www.twitch.tv/*",
    "https://*.gitlab.io/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.twitch.tv/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

Note: `https://*.gitlab.io/*` couvre le placeholder Pages ; si l’hôte final diffère, ajuster `host_permissions` et `T2K_STREAMERS_URL` ensemble.

- [ ] **Step 2: Valider JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8')); console.log('MANIFEST_OK')"
```

Expected: `MANIFEST_OK`

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.json
git commit -m "feat: add T2K Manifest V3"
```

---

### Task 5: Extension `content.js` (cœur)

**Files:**
- Create: `extension/content.js`

**Interfaces:**
- Consumes: `T2K_STREAMERS_URL` → JSON `{ streamers: { [login]: { publicKey: JWK } } }` ; wire format Task 3
- Produces: bannière `#t2k-raid-banner` ; redirect ; `t2k_processed_raids` Set

- [ ] **Step 1: Écrire `extension/content.js` complet**

```js
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
  if (t2k_processed_raids.has(token)) return;
  if (!t2kStreamers) return;

  let envelope;
  try {
    envelope = JSON.parse(t2kBytesToUtf8(t2kBase64UrlToBytes(token)));
  } catch {
    return;
  }
  if (!envelope || typeof envelope.p !== 'string' || typeof envelope.s !== 'string') return;

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

  if (!t2kInReplayWindow(exp)) {
    t2kDebug('expired/out of window');
    return;
  }
  if (!t2kIsHttpsUrl(url)) return;

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
    return;
  }
  if (!ok) return;

  t2k_processed_raids.add(token);
  t2kShowBanner(url);
}

function t2kScanText(text) {
  if (!text || text.indexOf('!raid') === -1) return;
  const m = text.match(T2K_RAID_RE);
  if (m) t2kHandleRaidToken(m[1]);
}

function t2kObserveChat() {
  const root = document.querySelector('main') || document.body;
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
```

- [ ] **Step 2: Sanity syntax**

```bash
node --check extension/content.js
```

Expected: exit 0, aucun output d’erreur.

- [ ] **Step 3: Commit**

```bash
git add extension/content.js
git commit -m "feat: add T2K content script with ECDSA verify and banner"
```

---

### Task 6: `.gitlab-ci.yml` + `init.sh`

**Files:**
- Create: `.gitlab-ci.yml`
- Create: `init.sh`

**Interfaces:**
- Consumes: dossier `public/`
- Produces: job Pages ; script bootstrap reproductible

- [ ] **Step 1: Écrire `.gitlab-ci.yml`**

```yaml
stages:
  - deploy

pages:
  stage: deploy
  image: alpine:latest
  script:
    - echo "Deploying public/ to GitLab Pages"
    - ls -la public
    - test -f public/streamers.json
  artifacts:
    paths:
      - public
    expire_in: 1 hour
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Note GitLab Pages : l’artifact doit s’appeler le job `pages` et contenir `public/` — correct ci-dessus.

- [ ] **Step 2: Écrire `init.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

mkdir -p cli/keys public extension docs/superpowers/specs docs/superpowers/plans

if [[ ! -f .gitignore ]]; then
  echo "Missing .gitignore — create project files first" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  git init
fi

git add -A
# Ensure secrets stay out even if force-added by mistake later
git status --ignored || true

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Repo already has commits; skipping initial commit."
else
  git add .gitignore .gitlab-ci.yml init.sh public extension cli docs
  git status
  git commit -m "chore: initial T2K scaffold"
fi

echo "T2K init done."
echo "Next: node cli/generate-keys.js <login>"
echo "Then update public/streamers.json and T2K_STREAMERS_URL in extension/content.js"
```

- [ ] **Step 3: Rendre exécutable (Git Bash / WSL) et smoke CI YAML**

```bash
chmod +x init.sh
# optional: bash -n init.sh
```

Expected: `bash -n init.sh` silencieux (exit 0).

- [ ] **Step 4: Commit**

```bash
git add .gitlab-ci.yml init.sh
git commit -m "chore: add GitLab Pages CI and init.sh"
```

---

### Task 7: Vérification bout-en-bout manuelle

**Files:**
- Modify: `public/streamers.json` (insérer vraie clé de `demostreamer` — **ne pas committer** de clé de test si login réel ; OK pour `example`/`demostreamer` de démo)
- Modify: `extension/content.js` — pour test local uniquement, option temporaire : servir `streamers.json` via extension… **Non** (hors design). Pour test local sans Pages :

**Test local sans Pages :** charger temporairement via `chrome-extension://` n’autorise pas file://. Deux options acceptables pour cette tâche :
1. Héberger `public/` sur un static server local `npx serve public` et mettre `T2K_STREAMERS_URL` à `http://127.0.0.1:3000/streamers.json` + ajouter host_permission `http://127.0.0.1:3000/*` **uniquement en local** (revenir à HTTPS Pages avant merge).
2. Ou mock : dans DevTools, coller un message simulé après avoir forcé `t2kStreamers` — hors chemin prod.

**Procédure recommandée (option 1 locale) :**

- [ ] **Step 1: Générer clés + maj JSON**

```bash
node cli/generate-keys.js demostreamer
# Copier le JWK dans public/streamers.json sous la clé "demostreamer"
```

- [ ] **Step 2: Signer**

```bash
node cli/sign-raid.js demostreamer "https://kick.com/demostreamer"
```

- [ ] **Step 3: Charger l’extension**

Chrome → `chrome://extensions` → Mode développeur → Charger l’extension non empaquetée → dossier `extension/`.

- [ ] **Step 4: Ouvrir `https://www.twitch.tv/demostreamer` (ou chaîne dont le login matche), injecter via console si besoin un nœud texte `!raid <token>` dans `main`, ou coller en chat (si on est broadcaster).

Expected:
- Bannière « Raid T2K dans 3… » + URL
- Escape annule
- Sans cancel → redirect vers l’URL HTTPS
- Rejouer le même token → ignoré
- Token sur une autre chaîne → ignoré
- `http://` signé (si on force en bidouillant) → rejeté côté CLI déjà ; côté extension aussi

- [ ] **Step 5: Remettre `T2K_STREAMERS_URL` et `host_permissions` pour Pages avant commit final**

```bash
git add extension/manifest.json extension/content.js public/streamers.json
git commit -m "chore: point T2K_STREAMERS_URL at Pages host"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `init.sh` | Task 6 |
| `.gitignore` secrets | Task 1 |
| `.gitlab-ci.yml` Pages | Task 6 |
| `generate-keys.js` | Task 2 |
| `sign-raid.js` | Task 3 |
| `public/streamers.json` | Task 1 (+7) |
| `manifest.json` T2K MV3 | Task 4 |
| `content.js` observer/crypto/banner | Task 5 |
| ECDSA P-384 / ieee-p1363 | Task 2–3–5 |
| Anti-replay window | Task 5 |
| Anti-spam Set | Task 5 |
| Isolation streamer/pathname | Task 5 |
| HTTPS only | Task 3 + 5 |
| Silent fetch fail | Task 5 |
| No innerHTML | Task 5 |

**Placeholder scan:** aucun TBD ; URL Pages = constante explicite `example.gitlab.io` à remplacer.

**Type consistency:** `t2kCanonicalPayload({ exp, streamer, url })` identique CLI/extension ; envelope `{p,s}` ; signature `ieee-p1363` / WebCrypto raw ECDSA.
