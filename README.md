# T2K (Twitch To Kick)

Le streamer copie une **phrase discrète** depuis l’extension et la colle dans
son chat Twitch en live. Les viewers avec T2K partent vers Kick.

Tutoriel : https://t12lve.github.io/T2K/

## Réglages (dans l’extension)

| Champ | Rôle |
|--------|------|
| **Source** | Login Twitch (chaîne en live) |
| **Cible** | Login Kick (redirect) |
| **Timer** | Secondes avant redirect (bannière) |

Modifiables à tout moment via l’onglet **Réglages** du popup.

**Viewers** : mêmes Source + Cible que le streamer (sinon pas de redirect vers la bonne chaîne).

## Flux

1. Installer `extension/` (mode développeur)  
2. Ouvrir T2K → onboarding Source → Cible → Timer  
3. En live : **Copier** une phrase → coller telle quelle dans le chat  
4. Viewers : bannière → `kick.com/<cible>` (Escape = annuler)

Sécurité : seul le **streamer** (pseudo / badge) sur la **source**, en **live**.
