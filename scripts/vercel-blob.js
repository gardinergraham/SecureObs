const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');

const root = path.resolve(__dirname, '..');

function readEnvironment(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      let value = line.slice(separator + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [key, value.replace(/\\n/g, '\n')];
    }));
}

function blobEnvironment() {
  console.log('Refreshing Vercel Blob credentials...');
  execFileSync('npx', [
    'vercel',
    'env',
    'pull',
    '.env.local',
    '--yes',
  ], { cwd: root, stdio: 'inherit' });

  const environment = readEnvironment(path.join(root, '.env.local'));
  if (!environment.VERCEL_OIDC_TOKEN || !environment.BLOB_STORE_ID) {
    throw new Error('The Vercel project is not connected to a production Blob store.');
  }
  return environment;
}

async function uploadApk(file, version, channel = 'android') {
  const environment = blobEnvironment();
  const names = ['VERCEL_OIDC_TOKEN', 'BLOB_STORE_ID', 'VERCEL_ENV', 'VERCEL_TARGET_ENV'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) {
    if (environment[name]) process.env[name] = environment[name];
  }

  try {
    const filename = channel === 'android-demo' ? `SecureObs-Demo-${version}.apk` : `SecureObs-${version}.apk`;
    const blob = await put(`${channel}/${filename}`, fs.createReadStream(file), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
      contentType: 'application/vnd.android.package-archive',
      multipart: true,
    });
    return blob.url;
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

module.exports = { uploadApk };
