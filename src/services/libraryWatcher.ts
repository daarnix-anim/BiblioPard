export class LibraryWatcher {
  private watcher: any = null;
  private debounceTimer: any = null;
  private isWatching = false;

  public startWatching(rootPath: string, onLibraryChanged: () => void) {
    if (this.isWatching) {
      this.stopWatching();
    }

    if (typeof window === 'undefined' || !window.require) {
      return;
    }

    try {
      const fs = window.require('fs');
      if (!fs.existsSync(rootPath)) return;

      this.watcher = fs.watch(rootPath, { recursive: true }, (_eventType: string, filename: string) => {
        // Ignore hidden files and temp files
        if (filename && (filename.startsWith('.') || filename.endsWith('.tmp') || filename.includes('node_modules'))) {
          return;
        }

        // Debounce to prevent flooding on multi-file copies
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          console.log('[BiblioPard Watcher] Change detected in library:', filename);
          onLibraryChanged();
        }, 600);
      });

      this.isWatching = true;
      console.log('[BiblioPard Watcher] Started watching library:', rootPath);
    } catch (err) {
      console.warn('[BiblioPard Watcher] Could not start watcher:', err);
    }
  }

  public stopWatching() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {}
      this.watcher = null;
    }
    this.isWatching = false;
  }
}

export const libraryWatcher = new LibraryWatcher();
