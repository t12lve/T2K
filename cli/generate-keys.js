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

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-384',
});

const pemPath = path.join(keysDir, `${login}_private.pem`);
fs.writeFileSync(pemPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
  mode: 0o600,
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
        publicKey: publicKeyOut,
      },
    },
    null,
    2
  )
);
