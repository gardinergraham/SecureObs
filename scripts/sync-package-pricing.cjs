const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.copyFileSync(path.join(root, 'backend/src/billing/package-pricing.js'), path.join(root, 'website/package-pricing.js'));
console.log('Website pricing catalogue updated.');
