'use strict';

function $(id) {
  return document.getElementById(id);
}

function paintPhrase(p) {
  $('phrase').textContent = p;
}

function reroll() {
  paintPhrase(t2kPickRandomPhrase());
  $('msg').textContent = '';
  $('msg').className = 'msg';
}

function paintFlow(cfg) {
  const src = cfg.source || '…';
  const tgt = cfg.target || cfg.source || '…';
  const tw = `twitch.tv/${src}`;
  const ki = `kick.com/${tgt}`;
  ['flowTw', 'obFlowTw'].forEach((id) => {
    if ($(id)) $(id).textContent = tw;
  });
  ['flowKi', 'obFlowKi'].forEach((id) => {
    if ($(id)) $(id).textContent = ki;
  });
  if ($('flowTimer')) {
    $('flowTimer').textContent = `${cfg.timerSec || 3}s`;
  }
}

function showMain(cfg) {
  $('viewOnboard').classList.add('hidden');
  $('viewMain').classList.remove('hidden');
  $('source').value = cfg.source || '';
  $('target').value = cfg.target || '';
  $('timer').value = String(cfg.timerSec || 3);
  paintFlow(cfg);
  reroll();
}

function showOnboard(cfg) {
  $('viewOnboard').classList.remove('hidden');
  $('viewMain').classList.add('hidden');
  $('obSource').value = cfg.source || '';
  $('obTarget').value = cfg.target || '';
  $('obTimer').value = String(cfg.timerSec || 3);
  paintFlow(cfg);
}

function bindTabs() {
  const setTab = (name) => {
    $('tabRaid').classList.toggle('on', name === 'raid');
    $('tabSettings').classList.toggle('on', name === 'settings');
    $('panelRaid').classList.toggle('hidden', name !== 'raid');
    $('panelSettings').classList.toggle('hidden', name !== 'settings');
  };
  $('tabRaid').onclick = () => setTab('raid');
  $('tabSettings').onclick = () => setTab('settings');
}

async function init() {
  const cfg = await t2kLoadSettings();
  bindTabs();

  ['obSource', 'obTarget', 'obTimer'].forEach((id) => {
    $(id).addEventListener('input', () => {
      paintFlow({
        source: t2kNormLogin($('obSource').value),
        target: t2kNormLogin($('obTarget').value),
        timerSec: Number($('obTimer').value) || 3,
      });
    });
  });

  $('obSave').onclick = async () => {
    const source = t2kNormLogin($('obSource').value);
    const target = t2kNormLogin($('obTarget').value) || source;
    const timerSec = Math.min(30, Math.max(1, Number($('obTimer').value) || 3));
    if (!source) {
      $('obMsg').textContent = 'Indique la chaîne source Twitch.';
      $('obMsg').className = 'msg err';
      return;
    }
    await t2kSaveSettings({
      source,
      target,
      timerSec,
      onboardingDone: true,
    });
    showMain({ source, target, timerSec, onboardingDone: true });
  };

  $('save').onclick = async () => {
    const source = t2kNormLogin($('source').value);
    const target = t2kNormLogin($('target').value) || source;
    const timerSec = Math.min(30, Math.max(1, Number($('timer').value) || 3));
    if (!source) {
      $('setMsg').textContent = 'Source Twitch requise.';
      $('setMsg').className = 'msg err';
      return;
    }
    await t2kSaveSettings({ source, target, timerSec, onboardingDone: true });
    paintFlow({ source, target, timerSec });
    $('setMsg').textContent = 'Réglages enregistrés.';
    $('setMsg').className = 'msg';
  };

  $('redoOnboard').onclick = async () => {
    await t2kSaveSettings({ onboardingDone: false });
    const c = await t2kLoadSettings();
    showOnboard(c);
  };

  $('reroll').onclick = reroll;
  $('copy').onclick = async () => {
    const text = $('phrase').textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      $('msg').textContent = 'Copié — colle dans le chat (ligne entière).';
      $('msg').className = 'msg';
    } catch {
      $('msg').textContent = 'Sélectionne et copie manuellement.';
      $('msg').className = 'msg err';
    }
  };

  if (cfg.onboardingDone && cfg.source) showMain(cfg);
  else showOnboard(cfg);
}

init();
