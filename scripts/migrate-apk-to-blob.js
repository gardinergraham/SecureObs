const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { uploadApk } = require('./vercel-blob');

const root = path.resolve(__dirname, '..');
const apkPath = path.join(root, 'website', 'downloads', 'SecureObs.apk');
const manifestPath = path.join(root, 'website', 'downloads', 'release.json');

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function fail(message) {
  console.error(`\nMigration stopped: ${message}`);
  process.exit(1);
}

async function main() {
  if (!fs.existsSync(apkPath)) fail(`APK not found at ${apkPath}`);
  const release = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const actualHash = sha256(apkPath);
  if (actualHash !== release.sha256) {
    fail(`APK SHA-256 is ${actualHash}, expected ${release.sha256}.`);
  }

  console.log(`Uploading verified SecureObs ${release.version} to Vercel Blob...`);
  const downloadUrl = await uploadApk(apkPath, release.version);
  release.downloadUrl = downloadUrl;
  fs.writeFileSync(manifestPath, `${JSON.stringify(release, null, 2)}\n`);

  console.log(`\nSecureObs ${release.version} migrated successfully.`);
  console.log(`Download: ${downloadUrl}`);
  console.log('The local APK has been retained, but is now ignored by Git.');
}

main().catch((error) => fail(error.message));
