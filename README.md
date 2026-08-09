# T2K (Twitch To Kick)

Le streamer copie une **phrase discrète** depuis l’extension et la colle dans
son chat Twitch en live. Les viewers avec T2K partent vers Kick.

Tutoriel + téléchargement : https://t12lve.github.io/T2K/

## Installer (Chrome / Edge)

1. Télécharge [T2K.zip](https://t12lve.github.io/T2K/T2K.zip) et décompresse-le  
2. Ouvre `chrome://extensions` → active **Mode développeur**  
3. **Charger l’extension non empaquetée** → dossier qui contient `manifest.json`

Un `T2K.crx` signé est aussi disponible (hors Chrome Web Store, Chrome peut bloquer l’install directe du CRX — préfère le ZIP).

Repack : `npm install` puis `npm run pack` (génère `public/T2K.zip` + `public/T2K.crx`).

## Réglages (dans l’extension)

| Champ | Rôle |
|--------|------|
| **Source** | Login Twitch (chaîne en live) |
| **Cible** | Login Kick (redirect) |
| **Timer** | Secondes avant redirect (bannière) |

Modifiables à tout moment via l’onglet **Réglages** du popup.

**Viewers** : mêmes Source + Cible que le streamer.

## Flux

1. Installer via le ZIP (ci-dessus)  
2. Ouvrir T2K → onboarding Source → Cible → Timer  
3. En live : **Copier** une phrase → coller telle quelle dans le chat  
4. Viewers : bannière → `kick.com/<cible>` (Escape = annuler)

Sécurité : seul le **streamer** (pseudo / badge) sur la **source**, en **live**.
