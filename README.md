# T2K (Twitch To Kick) — mode simple

Le streamer tape **uniquement un trigger** dans le chat Twitch pendant son live.
Les viewers avec l’extension voient une bannière puis partent sur Kick.

**Pas de clé crypto. Pas de token. Pas de .bat obligatoire.**

Tutoriel : **https://t12lve.github.io/T2K/**

## Comment ça marche

1. Le streamer est **en live** sur **sa** chaîne (source).
2. Il envoie **seulement** son trigger (ex. `#1212#`).
3. L’extension vérifie : auteur = streamer + page live + chaîne connue.
4. Redirection vers `https://kick.com/<cible>` (cible dans le registre, défaut = même login).

**Sécurité** = « seul le streamer peut taper la commande », pas la cryptographie.

## Installation viewer / streamer

1. Chrome → `chrome://extensions` → Mode développeur  
2. Charger le dossier `extension/`  
3. Cliquer l’icône **T2K** → onboarding (source, cible Kick, trigger)  
4. Envoyer la config au registre : **2hellv@gmail.com** (bouton mailto dans l’onboarding)

## Registre (`public/streamers.json`)

```json
{
  "streamers": {
    "t12lve": {
      "displayName": "t12lve",
      "trigger": "#1212#",
      "target": "t12lve"
    }
  }
}
```

## Legacy (optionnel)

Le dossier `cli/` (signatures ECDSA, wizard Node, `.bat` / `.vbs`) reste disponible
mais n’est **plus** le parcours principal.
