const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { execFileSync } = require('child_process');
const { uploadApk } = require('./vercel-blob');

const root = path.resolve(__dirname, '..');
const downloadsDir = path.join(root, 'website', 'downloads');
const manifestPath = path.join(downloadsDir, 'release.json');
const expectedPackage = 'com.geckostudios.secureobs';
const blockedPermissions = [
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

function fail(message) {
  console.error(`\nRelease stopped: ${message}`);
  process.exit(1);
}

function run(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8' });
  } catch (error) {
    fail(`${path.basename(file)} failed: ${error.stderr || error.message}`);
  }
}

function findBuildTool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'Library', 'Android', 'sdk');
  const buildTools = path.join(sdk, 'build-tools');
  if (!fs.existsSync(buildTools)) fail(`Android build tools were not found at ${buildTools}`);
  const versions = fs.readdirSync(buildTools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const tool = path.join(buildTools, version, name);
    if (fs.existsSync(tool)) return tool;
  }
  fail(`${name} was not found in ${buildTools}`);
}

function parseArgs() {
  const result = { notes: [] };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (value === '--apk') result.apk = args[++i];
    else if (value === '--minimum') result.minimum = args[++i];
    else if (value === '--note') result.notes.push(args[++i]);
    else fail(`Unknown option ${value}`);
  }
  return result;
}

function versionParts(version) {
  if (!/^\d+(\.\d+)*$/.test(version)) fail(`Invalid version number: ${version}`);
  return version.split('.').map(Number);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return difference;
  }
  return 0;
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

async function main() {
  const options = parseArgs();
  const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const candidates = fs.readdirSync(downloadsDir)
    .filter((name) => name.toLowerCase().endsWith('.apk') && name !== 'SecureObs.apk');
  const source = options.apk
    ? path.resolve(root, options.apk)
    : candidates.length === 1
      ? path.join(downloadsDir, candidates[0])
      : null;

  if (!source) {
    fail(candidates.length === 0
      ? 'Place the newly generated APK in website/downloads first.'
      : 'More than one new APK was found. Use --apk followed by the required file path.');
  }
  if (!fs.existsSync(source)) fail(`APK not found: ${source}`);

  const aapt = findBuildTool('aapt');
  const apksigner = findBuildTool('apksigner');
  const badging = run(aapt, ['dump', 'badging', source]).split('\n')[0];
  const packageName = badging.match(/package: name='([^']+)'/)?.[1];
  const versionCode = Number(badging.match(/versionCode='(\d+)'/)?.[1]);
  const version = badging.match(/versionName='([^']+)'/)?.[1];
  if (!packageName || !version || !versionCode) fail('Could not read the APK package or version.');
  if (packageName !== expectedPackage) fail(`Package is ${packageName}, expected ${expectedPackage}.`);
  if (compareVersions(version, current.version) <= 0) fail(`Version ${version} must be newer than published version ${current.version}.`);
  if (current.androidVersionCode && versionCode <= current.androidVersionCode) {
    fail(`Android version code ${versionCode} must be greater than ${current.androidVersionCode}.`);
  }

  const signature = run(apksigner, ['verify', '--verbose', '--print-certs', source]);
  if (!/Verified using v2 scheme .*: true/.test(signature)) fail('APK Signature Scheme v2 verification did not pass.');
  const certificate = signature.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1]?.toLowerCase();
  if (!certificate) fail('Could not read the APK signing certificate.');
  if (certificate !== current.signingCertificateSha256.toLowerCase()) {
    fail('The signing certificate does not match the currently published app.');
  }

  const permissions = run(aapt, ['dump', 'permissions', source]);
  for (const permission of blockedPermissions) {
    if (permissions.includes(permission)) fail(`Blocked permission found: ${permission}`);
  }
  const manifest = run(aapt, ['dump', 'xmltree', source, 'AndroidManifest.xml']);
  if (!/android:allowBackup[^\n]*0x0/.test(manifest)) fail('android:allowBackup is not disabled.');

  let minimum = options.minimum;
  let notes = options.notes.filter(Boolean);
  if (process.stdin.isTTY) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    minimum ||= (await prompt.question(`Minimum supported version [${current.minimumSupportedVersion}]: `)).trim()
      || current.minimumSupportedVersion;
    if (!notes.length) {
      console.log('Enter one release note per line. Press Enter on an empty line when finished.');
      while (true) {
        const note = (await prompt.question('Release note: ')).trim();
        if (!note) break;
        notes.push(note);
      }
    }
    prompt.close();
  }
  minimum ||= current.minimumSupportedVersion;
  if (!notes.length) fail('At least one release note is required. Use --note or run interactively.');
  if (compareVersions(minimum, version) > 0) fail('Minimum supported version cannot be newer than this release.');

  const bytes = fs.statSync(source).size;
  console.log(`Uploading verified SecureObs ${version} to Vercel Blob...`);
  const downloadUrl = await uploadApk(source, version);

  const release = {
    version,
    androidVersionCode: versionCode,
    minimumSupportedVersion: minimum,
    publishedAt: new Date().toISOString().slice(0, 10),
    size: `${(bytes / 1_000_000).toFixed(1)} MB`,
    downloadUrl,
    downloadPageUrl: current.downloadPageUrl,
    sha256: sha256(source),
    signingCertificateSha256: certificate,
    releaseNotes: notes,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(release, null, 2)}\n`);
  if (path.resolve(source) !== path.join(downloadsDir, 'SecureObs.apk')) fs.unlinkSync(source);

  console.log(`\nSecureObs ${version} (Android ${versionCode}) is ready to publish.`);
  console.log(`Size: ${release.size}`);
  console.log(`SHA-256: ${release.sha256}`);
  console.log(`Certificate: ${certificate}`);
  console.log(`Download: ${downloadUrl}`);
  console.log('Next: review release.json, then commit and push it to deploy through Vercel.');
}

main().catch((error) => fail(error.message));
