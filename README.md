# T2K (Twitch To Kick)

Raid simple : le **streamer** copie une phrase depuis l’extension et la colle
dans son chat Twitch en live. Les **viewers** avec T2K sont redirigés vers
`https://kick.com/<même_pseudo>`.

Tutoriel : https://t12lve.github.io/T2K/

## Comment ça marche

1. Streamer en **live** sur **sa** chaîne Twitch  
2. Clic icône T2K → **Copier** une phrase aléatoire  
3. Coller **exactement** cette phrase dans le chat (rien d’autre sur la ligne)  
4. Viewers : bannière 3 s → Kick (Escape = annuler)

**Sécurité** : seul le compte streamer (pseudo / badge) déclenche le raid.  
Pas de clés, pas de registre, pas de token.

## Installation

1. `chrome://extensions` → Mode développeur  
2. **Charger l’extension non empaquetée** → dossier `extension/`  
3. Viewers et streamer installent la même extension

## Structure

```
extension/     ← Chrome MV3 (phrases + popup + content script)
public/        ← tutoriel GitHub Pages
logo.png
```
