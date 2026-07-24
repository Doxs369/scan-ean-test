const fs = require('fs');

// Genera build timestamp
const now = new Date();
const build = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

// Incrementa patch version
let version = '1.3.0';
try {
  const v = JSON.parse(fs.readFileSync('version.json', 'utf8'));
  const parts = v.version.split('.');
  parts[2] = parseInt(parts[2]) + 1;
  version = parts.join('.');
} catch(e) {}

const versionData = { version, build };

// 1. Scrive version.json
fs.writeFileSync('version.json', JSON.stringify(versionData, null, 2));

// 2. Scrive version.js (per Service Worker)
const versionJs = `const APP_VERSION = "${version}";\nconst APP_BUILD = "${build}";`;
fs.writeFileSync('version.js', versionJs);

console.log(`Versione aggiornata: ${version} (build ${build})`);
console.log('Esegui: git add version.json version.js && git commit -m "deploy v' + version + '"');
