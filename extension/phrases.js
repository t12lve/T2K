'use strict';

/**
 * Phrases « dog whistle » : passent pour des adieux / remerciements ordinaires.
 * Match exact (trim) uniquement.
 */
const T2K_PHRASES = [
  'Allez, prenez soin de vous',
  'Bonne fin de soirée à tous',
  'Merci d’avoir passé ce moment',
  'Je vous laisse tranquilles',
  'À plus tard les amis',
  'Faites de beaux rêves',
  'Merci pour votre présence ce soir',
  'On se dit à la prochaine',
  'Je coupe ici, prenez soin de vous',
  'Bonne continuation à tout le monde',
  'Allez, je vous libère',
  'Merci d’être restés jusqu’au bout',
  'Je vais m’arrêter là pour ce soir',
  'Passez une excellente soirée',
  'Bisous et à très vite',
  'Je vous souhaite une belle nuit',
  'Merci encore, vraiment de vous',
  'On se retrouve une prochaine fois',
  'Allez, je range tout ça',
  'Bonne soirée, et merci pour tout',
];

function t2kPickRandomPhrase() {
  const i = Math.floor(Math.random() * T2K_PHRASES.length);
  return T2K_PHRASES[i];
}

function t2kIsTriggerPhrase(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return T2K_PHRASES.some((p) => p === t);
}
