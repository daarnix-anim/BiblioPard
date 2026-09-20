import { ReleaseInfo } from '../types';
import { unzipSync } from 'fflate';
import { getNodeFs, getNodePath, isNodeAvailable, getNodeModule } from './nodeBridge';
import { APP_VERSION } from '../version';

export class UpdateChecker {
  public readonly CURRENT_VERSION = APP_VERSION;

  /**
   * Compare two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  public compareSemver(v1: string, v2: string): number {
    const clean = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts1 = clean(v1);
    const parts2 = clean(v2);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * Resolve the active extension installation folder
   */
  public getExtensionPath(): string {
    // 1. Try Adobe CSInterface
    if (typeof window !== 'undefined' && (window as any).CSInterface) {
      try {
        const cs = new (window as any).CSInterface();
        const p = cs.getSystemPath('extension');
        if (p) return p.replace(/\\/g, '/');
      } catch {}
    }

    // 2. Try Node.js process / directory
    try {
      const path = getNodePath();
      if (path) {
        if (typeof __dirname !== 'undefined' && __dirname) return __dirname.replace(/\\/g, '/');
        if (typeof process !== 'undefined' && process.cwd) return process.cwd().replace(/\\/g, '/');
      }
    } catch {}

    // 3. Fallback to standard CEP extensions directory on Windows
    try {
      const path = getNodePath();
      const os = getNodeModule('os');
      if (path && os) {
        const appData = (typeof process !== 'undefined' && process.env?.APPDATA) || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'Adobe', 'CEP', 'extensions', 'BiblioPard').replace(/\\/g, '/');
      }
    } catch {}

    return '';
  }

  /**
   * Check GitHub Releases for updates
   */
  public async checkForUpdates(repo = 'daarnix-anim/BiblioPard'): Promise<ReleaseInfo | null> {
    try {
      const url = `https://api.github.com/repos/${repo}/releases/latest`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Repo or release doesn't exist yet on GitHub
          return null;
        }
        throw new Error(`GitHub API вернул статус ${response.status}`);
      }

      const data = await response.json();
      const latestTag = data.tag_name || data.name || '';
      const hasUpdate = this.compareSemver(latestTag, this.CURRENT_VERSION) > 0;

      // Find zip asset if available or use zipball_url
      let zipUrl = data.zipball_url;
      if (data.assets && data.assets.length > 0) {
        const zipAsset = data.assets.find((a: any) => a.name.endsWith('.zip') || a.name.endsWith('.zxp'));
        if (zipAsset) {
          zipUrl = zipAsset.browser_download_url;
        }
      }

      return {
        version: latestTag.replace(/^v/, ''),
        tagName: latestTag,
        name: data.name || latestTag,
        body: data.body || 'Описание релиза отсутствует.',
        htmlUrl: data.html_url,
        zipUrl: zipUrl,
        publishedAt: data.published_at || '',
        hasUpdate
      };
    } catch (err) {
      console.warn('[BiblioPard UpdateChecker] Check failed:', err);
      return null;
    }
  }

  /**
   * Auto-download, unpack, and apply update in-place
   */
  public async applyUpdate(
    zipUrl: string,
    onProgress?: (status: string, percent?: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      onProgress?.('Подключение к GitHub...', 5);

      // Download archive with progress tracking
      const response = await fetch(zipUrl);
      if (!response.ok) {
        throw new Error(`Ошибка загрузки обновления (${response.status}: ${response.statusText})`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let receivedBytes = 0;
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            if (totalBytes > 0 && onProgress) {
              const pct = Math.min(85, Math.round(5 + (receivedBytes / totalBytes) * 80));
              onProgress(`Скачивание обновления (${pct}%)...`, pct);
            }
          }
        }
      } else {
        const arrayBuffer = await response.arrayBuffer();
        chunks.push(new Uint8Array(arrayBuffer));
      }

      // Combine chunks into a single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const zipBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        zipBytes.set(chunk, offset);
        offset += chunk.length;
      }

      onProgress?.('Распаковка файлов обновления...', 88);

      // Unpack in memory using fflate
      const unzipped = unzipSync(zipBytes);

      // Determine target destination folder
      const targetDir = this.getExtensionPath();
      if (!targetDir) {
        throw new Error('Не удалось определить путь к директории расширения');
      }

      const fs = getNodeFs();
      const path = getNodePath();

      if (!fs || !path) {
        // If Node is not available, download as file in browser
        window.open(zipUrl, '_blank');
        return { success: true };
      }

      // Check if archive contains a common top-level directory (e.g. from GitHub zipball)
      const filePaths = Object.keys(unzipped);
      let prefix = '';
      if (filePaths.length > 0) {
        const firstSlash = filePaths[0].indexOf('/');
        if (firstSlash !== -1) {
          const possibleRoot = filePaths[0].substring(0, firstSlash + 1);
          if (filePaths.every(p => p.startsWith(possibleRoot))) {
            prefix = possibleRoot;
          }
        }
      }

      onProgress?.('Установка обновленных файлов...', 92);

      // Write files to target extension folder
      for (const [rawRelPath, data] of Object.entries(unzipped)) {
        const relPath = prefix ? rawRelPath.slice(prefix.length) : rawRelPath;
        if (!relPath) continue;

        // Skip root or directory-only entries
        if (relPath.endsWith('/')) {
          const dirToCreate = path.join(targetDir, relPath);
          if (!fs.existsSync(dirToCreate)) {
            fs.mkdirSync(dirToCreate, { recursive: true });
          }
          continue;
        }

        const destFile = path.join(targetDir, relPath);
        const destDir = path.dirname(destFile);

        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        fs.writeFileSync(destFile, Buffer.from(data));
      }

      onProgress?.('Обновление успешно установлено!', 100);
      return { success: true };
    } catch (err: any) {
      console.error('[BiblioPard UpdateChecker] Apply update error:', err);
      return {
        success: false,
        error: err?.message || 'Не удалось применить обновление автоматически'
      };
    }
  }
}

export const updateChecker = new UpdateChecker();
