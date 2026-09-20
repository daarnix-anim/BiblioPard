#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Read current version from package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '0.0.1';

// 2. Parse arguments: bump type or explicit version
const arg = (process.argv[2] || 'patch').trim().toLowerCase();

function computeNextVersion(current, type) {
  const parts = current.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    return `${parts[0] + 1}.0.0`;
  }
  if (type === 'minor') {
    return `${parts[0]}.${parts[1] + 1}.0`;
  }
  if (type === 'patch') {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }

  // Check if explicit version string provided
  if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  }

  console.error(`Unknown bump type or invalid version: "${type}". Use patch, minor, major, or e.g. 0.0.2`);
  process.exit(1);
}

const nextVersion = computeNextVersion(currentVersion, arg);
console.log(`\n📦 Bumping BiblioPard version: v${currentVersion} -> v${nextVersion}\n`);

// 3. Update package.json
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ Updated package.json -> ${nextVersion}`);

// 4. Update package-lock.json if exists
const pkgLockPath = path.join(rootDir, 'package-lock.json');
if (fs.existsSync(pkgLockPath)) {
  try {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLock.version = nextVersion;
    if (pkgLock.packages && pkgLock.packages['']) {
      pkgLock.packages[''].version = nextVersion;
    }
    fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n');
    console.log(`✓ Updated package-lock.json -> ${nextVersion}`);
  } catch (e) {
    console.warn('Could not update package-lock.json:', e);
  }
}

// 5. Update CSXS/manifest.xml
const manifestPath = path.join(rootDir, 'CSXS', 'manifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(
    /ExtensionBundleVersion="[^"]*"/,
    `ExtensionBundleVersion="${nextVersion}"`
  );
  manifest = manifest.replace(
    /<Extension Id="com\.bibliopard\.extension\.panel" Version="[^"]*"/,
    `<Extension Id="com.bibliopard.extension.panel" Version="${nextVersion}"`
  );
  fs.writeFileSync(manifestPath, manifest);
  console.log(`✓ Updated CSXS/manifest.xml -> ${nextVersion}`);
}

// 6. Update src/version.ts
const versionTsPath = path.join(rootDir, 'src', 'version.ts');
fs.writeFileSync(versionTsPath, `export const APP_VERSION = '${nextVersion}';\n`);
console.log(`✓ Updated src/version.ts -> ${nextVersion}`);

console.log(`\n🎉 Версия успешно обновлена до v${nextVersion}!`);
console.log(`\nСледующие шаги для выпуска релиза на GitHub:`);
console.log(`  1. npm run build`);
console.log(`  2. git commit -am "release: v${nextVersion}"`);
console.log(`  3. git tag v${nextVersion}`);
console.log(`  4. git push origin main --tags\n`);
