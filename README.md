# T2K (Twitch To Kick)

Système de raid cross-platform sécurisé : un streamer signe localement une
commande `!raid` (ECDSA P-384) ; une extension Chrome lue le chat Twitch,
vérifie la signature avec la clé publique du streamer hébergée sur GitLab
Pages, applique un anti-replay / anti-spam / isolation multi-streamer, puis
affiche une bannière de confirmation avant de rediriger le viewer en HTTPS.

## Architecture

```
cli/ (local)  --signe-->  chat Twitch  --observe-->  extension/content.js
     |                              ^                         |
     | JWK publique                |                         v
     +----------> public/streamers.json <--- fetch --- GitLab Pages
     |
     +--> cli/keys/*_private.pem  (JAMAIS commité)
```

## Déploiement

### 1. Publier `streamers.json` via GitLab Pages

`public/streamers.json` est déployé par le job `pages` de
`.gitlab-ci.yml` (artifact `public/`, déclenché sur la branche par défaut).
Une fois le pipeline passé, l'URL publique ressemble à :

```
https://<namespace>.gitlab.io/<project>/streamers.json
```

**CORS** : GitLab Pages sert les réponses avec `Access-Control-Allow-Origin: *`
par défaut, ce qui autorise les requêtes `fetch` faites depuis
`https://www.twitch.tv`. Si `streamers.json` est hébergé ailleurs, l'origine
qui sert le fichier **doit** répondre avec un en-tête CORS autorisant
l'origine `https://www.twitch.tv` (ou `*`), sinon `t2kFetchStreamers()`
échouera silencieusement et aucun raid ne sera possible.

### 2. Configurer l'extension

`extension/content.js` contient un placeholder explicite à remplacer avant
tout déploiement réel :

```js
const T2K_STREAMERS_URL =
  'https://example.gitlab.io/t2k/streamers.json'; /* REPLACE at deploy */
```

Remplacez cette valeur par l'URL réelle de votre `streamers.json` publié à
l'étape précédente, **puis** mettez à jour `host_permissions` dans
`extension/manifest.json` pour qu'il corresponde exactement à l'origine de
cette URL (le manifest contient déjà `https://*.gitlab.io/*` par défaut ; si
vous hébergez ailleurs, ajoutez/adaptez l'entrée en conséquence).

Ne jamais committer une URL réelle de production à la place du placeholder
dans ce dépôt public — chaque déploiement doit faire ce remplacement
localement (ou via un pipeline de build dédié).

### 3. Charger l'extension dans Chrome

1. `chrome://extensions` → activer le mode développeur.
2. « Charger l'extension non empaquetée » → sélectionner le dossier
   `extension/`.

## CLI

### Générer une paire de clés pour un streamer

```bash
node cli/generate-keys.js <streamer_login>
```

- Génère une paire ECDSA P-384.
- Écrit la clé privée dans `cli/keys/<login>_private.pem` (jamais commitée,
  voir `.gitignore`).
- Affiche le fragment `publicKey` (JWK) à coller dans
  `public/streamers.json` sous `streamers.<login>`.
- **Refuse d'écraser une clé privée existante** : si
  `cli/keys/<login>_private.pem` existe déjà, la commande échoue avec un
  message d'erreur (code de sortie 1) plutôt que de régénérer silencieusement
  une nouvelle clé qui invaliderait la `publicKey` déjà publiée.

### Signer un raid

```bash
node cli/sign-raid.js <streamer_login> <https_url> [--ttl 60]
```

- Valide que l'URL cible est bien en `https:`.
- Charge la clé privée locale `cli/keys/<login>_private.pem`.
- Imprime une ligne prête à coller dans le chat Twitch : `!raid <token>`.
- Aucun appel réseau.
- `--ttl` (secondes, défaut `60`) est plafonné à **180s** : l'extension
  applique une fenêtre anti-replay `[exp - (60 + 120), exp + 120]`, donc tout
  `ttl` supérieur à 180s produirait un raid immédiatement rejeté (expiration
  hors fenêtre) dès son affichage dans le chat. La commande échoue avec un
  message clair si `--ttl` dépasse cette limite.

## Ne jamais committer les clés privées

`.gitignore` exclut déjà `cli/keys/`, `*.pem` et tout fichier `*private*`.
Ne forcez jamais l'ajout (`git add -f`) d'une clé privée, et vérifiez
`git status --ignored` avant de committer si vous avez un doute.

## `demostreamer`

`public/streamers.json` contient une entrée `demostreamer` dont la clé
privée correspondante (`cli/keys/demostreamer_private.pem`) existe
uniquement en local pour les tests/démos (vérification crypto de bout en
bout, `node cli/sign-raid.js demostreamer ...`). C'est une entrée **de démo
uniquement** : remplacez-la (ou ajoutez vos streamers réels à côté) avant tout
déploiement en production, et ne publiez jamais la clé privée `demostreamer`
en dehors de cet environnement local.

## Hors scope v1

Page options Chrome, allowlist de domaines Kick, tests automatisés,
packaging Chrome Web Store, service worker/messaging, vérification que
l'auteur du message chat est bien le broadcaster (la vérification
cryptographique de la signature suffit).
