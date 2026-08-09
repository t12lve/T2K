'use strict';

/**
 * Pack T2K for distribution:
 * - public/T2K.zip  → upload Chrome Web Store / install « non empaquetée »
 * - public/T2K.crx  → CRXv3 signed with keys/t2k.pem (self-signed; not Google)
 */
const path = require('path');
const fs = require('fs');
const crx3 = require('crx3');

const root = path.join(__dirname, '..');
const extDir = path.join(root, 'extension');
const keysDir = path.join(root, 'keys');
const publicDir = path.join(root, 'public');
const keyPath = path.join(keysDir, 't2k.pem');
const zipPath = path.join(publicDir, 'T2K.zip');
const crxPath = path.join(publicDir, 'T2K.crx');

fs.mkdirSync(keysDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const manifest = path.join(extDir, 'manifest.json');
if (!fs.existsSync(manifest)) {
  console.error('Missing extension/manifest.json');
  process.exit(1);
}

crx3([manifest], {
  keyPath,
  crxPath,
  zipPath,
})
  .then(() => {
    const ver = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
    console.log(`Packed T2K v${ver}`);
    console.log(`  ZIP: ${zipPath} (${fs.statSync(zipPath).size} bytes)`);
    console.log(`  CRX: ${crxPath} (${fs.statSync(crxPath).size} bytes)`);
    console.log(`  Key: ${keyPath} (keep private — not for git)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
