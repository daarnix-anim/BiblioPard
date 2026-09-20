import { ReleaseInfo } from '../types';

export class UpdateChecker {
  public readonly CURRENT_VERSION = '0.0.1';

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
        throw new Error(`GitHub API returned status ${response.status}`);
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
        body: data.body || 'No release notes provided.',
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
   * Auto-download and apply update (in CEP Node.js context)
   */
  public async applyUpdate(zipUrl: string): Promise<boolean> {
    if (typeof window === 'undefined' || !window.require) {
      window.open(zipUrl, '_blank');
      return true;
    }

    try {
      const fs = window.require('fs');
      const path = window.require('path');
      const https = window.require('https');
      const os = window.require('os');

      const tempZip = path.join(os.tmpdir(), `BiblioPard-update-${Date.now()}.zip`);

      // Download
      await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(tempZip);
        https.get(zipUrl, (response: any) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            https.get(response.headers.location, (redirectResponse: any) => {
              redirectResponse.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve();
              });
            }).on('error', reject);
          } else {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }
        }).on('error', reject);
      });

      return true;
    } catch (err) {
      console.error('[BiblioPard UpdateChecker] Apply update failed:', err);
      return false;
    }
  }
}

export const updateChecker = new UpdateChecker();
