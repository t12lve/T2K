'use strict';

function paint(phrase) {
  document.getElementById('phrase').textContent = phrase;
}

function reroll() {
  const p = t2kPickRandomPhrase();
  paint(p);
  document.getElementById('msg').textContent = '';
  return p;
}

document.getElementById('reroll').addEventListener('click', reroll);

document.getElementById('copy').addEventListener('click', async () => {
  const text = document.getElementById('phrase').textContent.trim();
  const msg = document.getElementById('msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = 'Copié — colle dans le chat Twitch.';
  } catch {
    msg.textContent = 'Copie manuelle : sélectionne la phrase.';
    msg.style.color = '#ff5c7a';
  }
});

reroll();
