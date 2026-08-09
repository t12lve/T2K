#!/usr/bin/env node
'use strict';

const {
  t2kLoadConfig,
  t2kSignRaidCommand,
  t2kNormalizeTrigger,
  T2K_MAX_TTL_SEC,
} = require('./t2k-common');

function parseArgs(argv) {
  const args = argv.slice(2);
  let ttl;
  let trigger;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ttl') {
      ttl = Number(args[++i]);
      if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('Invalid --ttl');
      if (ttl > T2K_MAX_TTL_SEC) {
        throw new Error(
          `--ttl too large: ${ttl}s exceeds max ${T2K_MAX_TTL_SEC}s ` +
            `(extension anti-replay window rejects raids expiring further in ` +
            `the future than this)`
        );
      }
    } else if (args[i] === '--trigger') {
      trigger = t2kNormalizeTrigger(args[++i]);
    } else {
      positional.push(args[i]);
    }
  }
  const [loginRaw, url] = positional;
  return {
    login: (loginRaw || '').trim().toLowerCase(),
    url,
    ttl,
    trigger,
  };
}

let login, url, ttl, trigger;
try {
  ({ login, url, ttl, trigger } = parseArgs(process.argv));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const cfg = t2kLoadConfig();
login = login || cfg.streamer;
url = url || cfg.lastUrl;
ttl = ttl != null ? ttl : cfg.ttl;
trigger = trigger || cfg.trigger;

if (!login || !url) {
  console.error(
    'Usage: node cli/sign-raid.js [streamer_login] [https_url] [--ttl 60] [--trigger "!raid"]\n' +
      '       (defaults from cli/t2k.config.json if present)\n' +
      'Or open the UI: npm start  /  T2K-Raid.bat'
  );
  process.exit(1);
}

try {
  const { command } = t2kSignRaidCommand({ login, url, ttl, trigger });
  console.log(command);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
