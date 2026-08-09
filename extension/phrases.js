'use strict';

/** Phrases trigger T2K — exact match (trim). Un peu marquées pour limiter les faux positifs. */
const T2K_PHRASES = [
  'On se retrouve de l’autre côté les amis',
  'Allez, direction l’autre plateforme',
  'Merci pour le live, on continue ailleurs',
  'Bonne soirée, on se rejoint de l’autre côté',
  'Je vous emmène avec moi, suivez le mouvement',
  'C’est l’heure de changer de salle',
  'On bascule, à tout de suite de l’autre côté',
  'Merci à tous, rendez-vous sur l’autre chaîne',
  'Le stream continue juste à côté',
  'Allez hop, tout le monde de l’autre côté',
  'Fin de session ici, on se retrouve ailleurs',
  'Vous êtes les meilleurs, suivez-moi de l’autre côté',
  'Petite migration express, on y va',
  'Je ferme ici, on ouvre de l’autre côté',
  'Merci pour votre énergie, direction la suite',
  'On file, à tout de suite de l’autre côté',
  'Dernier message ici, on continue ailleurs',
  'Vous me suivez ? On change de plateforme',
  'Go l’autre côté, on vous attend',
  'Bisous et à tout de suite de l’autre côté',
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
