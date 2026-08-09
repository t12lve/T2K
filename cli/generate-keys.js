#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const login = (process.argv[2] || '').trim().toLowerCase();
if (!login || !/^[a-z0-9_]{1,25}$/.test(login)) {
  console.error('Usage: node cli/generate-keys.js <streamer_login>');
  process.exit(1);
}

const keysDir = path.join(__dirname, 'keys');
fs.mkdirSync(keysDir, { recursive: true });

const pemPath = path.join(keysDir, `${login}_private.pem`);
if (fs.existsSync(pemPath)) {
  console.error(
    `Refusing to overwrite existing private key: ${pemPath}\n` +
      'Remove it manually first if you really want to regenerate it ' +
      '(this will invalidate the matching publicKey in streamers.json).'
  );
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-384',
});

fs.writeFileSync(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
  mode: 0o600,
  flag: 'wx',
});

const jwk = publicKey.export({ format: 'jwk' });
const publicKeyOut = {
  kty: jwk.kty,
  crv: jwk.crv,
  x: jwk.x,
  y: jwk.y,
};

console.log(`Private key written: ${pemPath}`);
console.log('Add this entry to public/streamers.json under streamers:');
console.log(
  JSON.stringify(
    {
      [login]: {
        displayName: login,
        trigger: '!raid',
        publicKey: publicKeyOut,
      },
    },
    null,
    2
  )
);

const cfgPath = path.join(__dirname, 't2k.config.json');
if (!fs.existsSync(cfgPath)) {
  fs.writeFileSync(
    cfgPath,
    JSON.stringify(
      {
        streamer: login,
        trigger: '!raid',
        ttl: 60,
        lastUrl: 'https://kick.com/',
        port: 3847,
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );
  console.log(`Created ${cfgPath} — edit "trigger" if you want another keyword.`);
}
console.log('UI: double-click T2K-Raid.bat  or  npm start');
