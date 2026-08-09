# T2K (Twitch To Kick) — Design Spec

**Date :** 2026-08-09  
**Statut :** Validé en session (sections 1–4) — en attente de revue fichier  
**Approche :** Monolithe minimal (CLI Node + extension Vanilla JS MV3 + JSON Pages)

## 1. Objectif

Système de raid cross-platform sécurisé : un streamer génère localement une commande `!raid` signée (ECDSA P-384) ; l’extension Chrome des viewers lit le chat Twitch, vérifie la signature avec la clé publique du streamer hébergée à distance, applique anti-replay / anti-spam / isolation multi-streamer, puis affiche une bannière de confirmation avant redirection HTTPS.

## 2. Décisions figées

| Sujet | Choix |
|-------|--------|
| Algorithme | ECDSA P-384 + SHA-384 |
| Redirection | Bannière 3 s + Escape / Annuler, puis `location.assign` |
| `streamers.json` | Constante `T2K_STREAMERS_URL` dans `content.js` (placeholder GitLab Pages à remplacer au déploiement, ex. `https://<namespace>.gitlab.io/<project>/streamers.json`) |
| URL cible | HTTPS uniquement (pas d’allowlist Kick en v1) |
| Architecture | Monolithe : un `content.js`, pas de SW, pas de modules ES |

## 3. Architecture

```
cli/ (local)  --signale-->  chat Twitch  --observe-->  extension/content.js
     |                              ^                         |
     | public JWK                   |                         v
     +----------> public/streamers.json <--- fetch --- GitLab Pages
     |
     +--> cli/keys/*_private.pem  (JAMAIS versionné)
```

### Arborescence livrable

```
T2K/
├── init.sh
├── .gitignore
├── .gitlab-ci.yml
├── cli/
│   ├── generate-keys.js
│   ├── sign-raid.js
│   └── keys/                 # gitignored
├── public/
│   └── streamers.json
├── extension/
│   ├── manifest.json
│   └── content.js
└── docs/superpowers/specs/   # ce document
```

## 4. Format crypto & wire

### 4.1 Payload métier (JSON canonique)

Clés triées, sérialisation sans espace (`JSON.stringify` sur objet aux clés ordonnées) :

```json
{"exp":1735689600,"streamer":"monpseudo","url":"https://kick.com/exemple"}
```

- `url` : cible HTTPS absolue  
- `exp` : Unix seconds = `now + ttl` (défaut `ttl = 60`)  
- `streamer` : login Twitch lowercase (doit matcher le pathname de la page)

### 4.2 Enveloppe chat

1. `payloadBytes` = UTF-8 du JSON canonique  
2. `signature` = ECDSA-P384-SHA384(payloadBytes) avec clé privée du streamer  
3. Objet envelope : `{ "p": base64url(payloadBytes), "s": base64url(signature) }`  
4. Token = `base64url(UTF-8(JSON.stringify(envelope)))`  
5. Message : `!raid <token>`

### 4.3 Clés

- Privée : PEM PKCS8 dans `cli/keys/<streamer>_private.pem`  
- Publique : JWK EC (`kty: EC`, `crv: P-384`, `x`, `y`) dans `streamers.json`

### 4.4 `streamers.json`

```json
{
  "streamers": {
    "monpseudo": {
      "displayName": "MonPseudo",
      "publicKey": {
        "kty": "EC",
        "crv": "P-384",
        "x": "...",
        "y": "..."
      }
    }
  }
}
```

Clé d’objet = login lowercase = segment pathname Twitch.

## 5. Extension Chrome

### 5.1 Manifest V3

- `name` / métadonnées : **T2K**  
- `content_scripts` : `https://www.twitch.tv/*` → `content.js`  
- Permissions : `activeTab`, `scripting`  
- `host_permissions` : `https://www.twitch.tv/*` + origine exacte de `T2K_STREAMERS_URL`  
- Pas de background service worker en v1  
- Préfixe globals / IDs : `t2k_` / `T2K_`

### 5.2 Pipeline de vérification (ordre strict)

1. `MutationObserver` sur conteneur chat parent stable ; analyser `textContent`  
2. Regex : `!raid\s+([A-Za-z0-9_-]+={0,2})`  
3. Decode token → envelope `{p,s}` → parse payload JSON  
4. Isolation : `payload.streamer === location.pathname` (lowercase, strip `/`)  
5. Lookup clé dans cache `streamers.json` pour ce login  
6. `crypto.subtle.verify` ECDSA P-384 / SHA-384  
7. Anti-replay (secondes) : `ttl = 60`, `drift = 120` → accepter ssi `now ∈ [exp - (ttl + drift), exp + drift]` soit `[exp - 180, exp + 120]`. Interprétation : expiration nominale 60 s + tolérance d’horloge ±2 min.  
8. Anti-spam : si signature (ou token) ∈ `t2k_processed_raids` (`Set`) → ignore ; sinon ajouter  
9. Sanitization URL : schéma `https:` uniquement ; rejeter sinon  
10. Afficher bannière ; après 3 s sans cancel → `window.location.assign(url)`

### 5.3 UI bannière

- DOM via `createElement` / `textContent` uniquement (zéro `innerHTML`)  
- Countdown visible 3 → 2 → 1  
- Escape ou bouton Annuler → clear timeout, retire le nœud  
- Une seule bannière active

### 5.4 Fetch clés

- Au load + refresh ~5 min  
- Échec réseau/CORS/HTTP → silence total ; pas de raid possible tant que le cache est vide/stale invalide

### 5.5 Observer

- Ne pas dépendre de classes CSS obscures Twitch  
- Conteneur parent large (ex. zone chat / `main`) + regex sur texte  
- Pseudos / login : toujours `toLowerCase()` sur pathname

## 6. CLI Node.js

### 6.1 `generate-keys.js`

```bash
node cli/generate-keys.js <streamer_login>
```

- Génère paire ECDSA P-384  
- Écrit `cli/keys/<streamer>_private.pem`  
- Affiche le fragment `publicKey` JWK à coller dans `streamers.json`

### 6.2 `sign-raid.js`

```bash
node cli/sign-raid.js <streamer_login> <https_url> [--ttl 60]
```

- Valide HTTPS avant signature  
- Charge la PEM privée locale  
- Imprime une ligne : `!raid <token>`  
- Aucun appel réseau

## 7. Git & CI

### 7.1 `.gitignore` (strict)

- `node_modules/`, `cli/keys/`, `*.pem`, `*private*`, `.env`, `.env.*`, OS (`Thumbs.db`, `.DS_Store`)

### 7.2 `init.sh`

- `git init`, création dossiers, fichiers de base si absents, premier commit message conventionnel

### 7.3 `.gitlab-ci.yml`

- Job `pages` : artifact `public/`  
- `rules: if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH`  
- Déploie uniquement le JSON statique (pas l’extension ni les clés)

## 8. Hors scope v1

- Page options Chrome / override URL JSON  
- Allowlist domaines Kick  
- Tests automatisés  
- Packaging Chrome Web Store  
- Service Worker / messaging  
- Vérification que l’auteur du message chat est le broadcaster (la crypto suffit)

## 9. Critères d’acceptation

1. Génération de clés sans committer la privée  
2. `sign-raid` produit un `!raid` collable  
3. Extension ignore les messages non signés / mauvaise chaîne / expiré / rejoués / HTTP  
4. Signature valide sur la bonne chaîne → bannière 3 s → redirect HTTPS  
5. Escape annule  
6. Fetch JSON en échec → aucun crash UI  
7. Pipeline Pages publie `public/streamers.json`
