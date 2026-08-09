'use strict';

const REGISTRY_EMAIL = '2hellv@gmail.com';

function $(id) {
  return document.getElementById(id);
}

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com)\//i, '')
    .split('/')[0];
}

function paint() {
  const source = norm($('source').value) || 'tonpseudo';
  const target = norm($('target').value) || source;
  const trigger = ($('trigger').value || '#t2k#').trim() || '#t2k#';
  $('preview').textContent =
    `twitch.tv/${source} (LIVE) → tape « ${trigger} » → kick.com/${target}`;
  $('exTrigger').textContent = trigger;

  const json = JSON.stringify(
    {
      [source]: {
        displayName: source,
        trigger,
        target,
      },
    },
    null,
    2
  );
  const subject = `[T2K] Inscription simple — ${source}`;
  const body =
`Bonjour,

Inscription T2K mode simple (sans clé crypto).

Chaîne source Twitch : ${source}
Chaîne cible Kick : ${target}
Trigger (commande seule) : ${trigger}

Sécurité attendue : seul le streamer en live sur sa chaîne peut déclencher.

JSON à fusionner dans public/streamers.json :

${json}

Merci.
`;
  $('mailto').href =
    `mailto:${REGISTRY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function load() {
  const data = await chrome.storage.sync.get({
    source: '',
    target: '',
    trigger: '#t2k#',
  });
  $('source').value = data.source || '';
  $('target').value = data.target || '';
  $('trigger').value = data.trigger || '#t2k#';
  paint();
}

async function saveLocal() {
  const source = norm($('source').value);
  const target = norm($('target').value) || source;
  const trigger = ($('trigger').value || '#t2k#').trim();
  if (!source) {
    $('msg').hidden = false;
    $('msg').textContent = 'Indique la chaîne source Twitch.';
    $('msg').style.color = '#ff5c7a';
    return;
  }
  await chrome.storage.sync.set({ source, target, trigger });
  $('msg').hidden = false;
  $('msg').style.color = '';
  $('msg').textContent =
    'Sauvé en local. Envoie aussi au registre pour que les viewers reçoivent ta config.';
  paint();
}

['source', 'target', 'trigger'].forEach((id) => {
  $(id).addEventListener('input', paint);
});
$('saveLocal').addEventListener('click', saveLocal);

const logo = $('logo');
if (logo) {
  logo.onerror = () => {
    logo.style.display = 'none';
  };
}

load();
