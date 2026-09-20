/**
 * BiblioPard - CEP Extension Installer Script for Windows
 * Automatically links this project to %APPDATA%\Adobe\CEP\extensions\BiblioPard
 * and configures Adobe PlayerDebugMode registry keys.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const appData = process.env.APPDATA;
if (!appData) {
  console.error('Error: APPDATA environment variable not found');
  process.exit(1);
}

const cepDir = path.join(appData, 'Adobe', 'CEP', 'extensions');
const targetExtensionDir = path.join(cepDir, 'BiblioPard');

console.log('----------------------------------------------------');
console.log('🚀 Installing BiblioPard extension for Adobe After Effects & Premiere Pro');
console.log('----------------------------------------------------');
console.log(`Project root: ${projectRoot}`);
console.log(`Target CEP directory: ${targetExtensionDir}`);

// 1. Ensure Adobe CEP extensions directory exists
if (!fs.existsSync(cepDir)) {
  console.log(`Creating directory: ${cepDir}`);
  fs.mkdirSync(cepDir, { recursive: true });
}

// 2. Link or copy extension directory
if (fs.existsSync(targetExtensionDir)) {
  const stat = fs.lstatSync(targetExtensionDir);
  if (stat.isSymbolicLink()) {
    console.log('Existing junction/symlink found. Removing old link...');
    fs.unlinkSync(targetExtensionDir);
  } else {
    console.log('Existing directory found. Removing old files...');
    fs.rmSync(targetExtensionDir, { recursive: true, force: true });
  }
}

try {
  // Use directory junction on Windows (mklink /J does not require admin privileges)
  console.log('Creating directory junction for live development...');
  execSync(`cmd /c mklink /J "${targetExtensionDir}" "${projectRoot}"`, { stdio: 'inherit' });
  console.log('✅ Extension linked successfully!');
} catch (err) {
  console.warn('Junction failed, attempting recursive copy fallback...');
  fs.cpSync(projectRoot, targetExtensionDir, {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.includes('.git')
  });
  console.log('✅ Extension copied successfully!');
}

// 3. Set Adobe PlayerDebugMode registry keys for CSXS 10, 11, 12, 13
const csxsVersions = ['10', '11', '12', '13'];
console.log('\nEnabling Adobe PlayerDebugMode in Windows Registry...');
for (const ver of csxsVersions) {
  try {
    execSync(`reg add "HKCU\\Software\\Adobe\\CSXS.${ver}" /v PlayerDebugMode /t REG_SZ /d 1 /f`, {
      stdio: 'ignore'
    });
    console.log(`✅ CSXS.${ver} PlayerDebugMode enabled`);
  } catch (e) {
    console.warn(`Could not set CSXS.${ver} registry key (non-critical)`);
  }
}

console.log('\n----------------------------------------------------');
console.log('🎉 BiblioPard is installed!');
console.log('How to use in After Effects 2026.2+:');
console.log('1. Restart After Effects (if open).');
console.log('2. Go to: Window -> Extensions -> BiblioPard');
console.log('----------------------------------------------------\n');
