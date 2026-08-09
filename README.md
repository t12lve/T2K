# T2K (Twitch To Kick)

Raid cross-platform signé : le streamer génère localement `!raid <token>` ;
l’extension Chrome des viewers vérifie la signature (ECDSA P-384) et propose
une redirection HTTPS après une bannière de 3 secondes.

## Tutoriel débutant (recommandé)

Guide pas à pas sans jargon, hébergé sur GitHub Pages :

**https://t12lve.github.io/T2K/**

## Comment ça marche

1. **Clés** — chaque streamer a une paire ECDSA P-384. La **privée** reste sur
   son PC (`cli/keys/`). La **publique** (JWK) est publiée dans
   `public/streamers.json`.
2. **Signature** — l’assistant local (ou le CLI) crée un payload
   `{ url, exp, streamer }`, le signe, et copie
   `<trigger> <token>` (défaut `!raid`) dans le presse-papiers.
3. **Lecture chat** — l’extension détecte le **trigger** déclaré pour la
   chaîne dans `streamers.json` (champ `trigger`, défaut `!raid`).
4. **Vérifications** (toutes obligatoires) :
   - le login de la page = `streamer` du payload ;
   - signature valide avec **sa** clé publique ;
   - horodatage dans la fenêtre anti-replay ;
   - signature pas déjà vue (anti-spam) ;
   - URL cible en `https:` uniquement.
5. **UI** — bannière 3 s (« Raid T2K dans… ») ; Escape / Annuler = stop ;
   sinon redirection vers l’URL signée.

```
PC streamer (CLI)  --colle !raid-->  chat Twitch
        |                                  |
   clé privée                         extension viewers
        |                                  |
   streamers.json  <--- fetch HTTPS ---+
   (Pages / hébergeur statique)
```

## Pas à pas (premier lancement)

### A. Prérequis

- Node.js récent (15.9+ recommandé)
- Chrome
- Compte GitHub (ou autre hébergeur statique pour le JSON)

### B. Clés + registre

```bash
# 1. Générer les clés (login Twitch en minuscules)
node cli/generate-keys.js monpseudo

# 2. Copier le bloc JWK affiché dans public/streamers.json :
# {
#   "streamers": {
#     "monpseudo": {
#       "displayName": "MonPseudo",
#       "trigger": "!raid",
#       "publicKey": { "kty": "EC", "crv": "P-384", "x": "...", "y": "..." }
#     }
#   }
# }
```

Tu peux changer `"trigger": "!go"` (ou autre mot **sans espace**).  
Même valeur dans l’assistant local / `cli/t2k.config.json`.

La clé privée est dans `cli/keys/monpseudo_private.pem` — **jamais** commitée
(`.gitignore`).

### C. Publier `streamers.json`

Héberge le dossier `public/` (ou au moins `streamers.json`) en HTTPS, avec
CORS autorisant `https://www.twitch.tv` (ou `*`).

Exemples :

- **GitHub Pages** (ce dépôt) : le dossier `public/` est déployé
  automatiquement. URLs :
  - Tutoriel : `https://t12lve.github.io/T2K/`
  - JSON : `https://t12lve.github.io/T2K/streamers.json`
- Autre hébergeur statique (Netlify, Cloudflare Pages, etc.) : même principe

### D. Configurer l’extension (local, avant chargement)

Dans `extension/content.js`, l’URL par défaut pointe déjà vers Pages :

```js
const T2K_STREAMERS_URL =
  'https://t12lve.github.io/T2K/streamers.json';
```

Si tu forks le projet, remplace cette URL par la tienne, et adapte
`host_permissions` dans `extension/manifest.json` (`https://*.github.io/*`
couvre déjà GitHub Pages).

### E. Charger l’extension

1. Ouvre `chrome://extensions`
2. Active le **mode développeur**
3. **Charger l’extension non empaquetée** → dossier `extension/`

### F. Lancer un raid (assistant local — recommandé)

1. Double-clic sur **`T2K-Assistant.vbs`** (recommandé : **pas de fenêtre noire**)
   - Alternative debug : `T2K-Raid.bat` (console visible)
   - Ou `npm start`
2. Au **premier lancement**, un **wizard** explique tout (TTL, collage, registre…).
3. Écran **Raid** → URL Kick → **Signer & copier** → colle **une seule ligne** sur Twitch
4. Bouton **Guide** pour rejouer l’onboarding

**TTL** = durée de vie du token (défaut **60 s**, max **180**).  
**F5** sur Twitch peut rejouer le raid tant que le token n’est pas expiré.

En ligne de commande (équivalent) :

```bash
node cli/sign-raid.js monpseudo "https://kick.com/cible" --ttl 60 --trigger "!raid"
```

`--ttl` max **180** secondes.

## Checklist de vérif rapide

| Test | Attendu |
|------|---------|
| Token valide, bonne chaîne | Bannière 3 s → redirect |
| Escape / Annuler | Pas de redirect |
| Même signature rejouée / enveloppe mutée | Ignoré |
| Mauvaise chaîne Twitch | Ignoré |
| Trigger différent du JSON | Ignoré |
| Token expiré | Ignoré |
| URL `http://` | Rejeté par le CLI |
| JSON injoignable (CORS / offline) | Silence, pas de crash |

## CLI (référence)

```bash
npm start
# ou
node cli/raid-app.js

node cli/generate-keys.js <streamer_login>
node cli/sign-raid.js [login] [https_url] [--ttl 60] [--trigger "!raid"]
```

Config locale (gitignorée) : `cli/t2k.config.json` — voir
`cli/t2k.config.example.json`.

- `generate-keys` **refuse** d’écraser une clé privée déjà présente
- signature **sans** appel réseau

## Sécurité clés

- Ne jamais `git add -f` un `*.pem` / `cli/keys/`
- En cas de doute : `git status --ignored`
- L’entrée `demostreamer` dans `streamers.json` est **démo locale** uniquement :
  remplace-la avant un déploiement réel

## Docs design

- Spec : [`docs/superpowers/specs/2026-08-09-t2k-raid-design.md`](docs/superpowers/specs/2026-08-09-t2k-raid-design.md)
- Plan : [`docs/superpowers/plans/2026-08-09-t2k-raid-implementation.md`](docs/superpowers/plans/2026-08-09-t2k-raid-implementation.md)

## Hors scope v1

Page options Chrome, allowlist Kick, tests auto, Chrome Web Store,
service worker, vérif que l’auteur chat = broadcaster (la crypto suffit).
