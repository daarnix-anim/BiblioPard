import { AssetItem, HostInfo, ImportOptionsPayload } from '../types';

declare global {
  interface Window {
    CSInterface?: any;
    __adobe_cep__?: any;
    require?: any;
  }
}

class HostBridge {
  private csInterface: any = null;
  private isNodeAvailable: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      if (window.CSInterface) {
        this.csInterface = new window.CSInterface();
      }
      this.isNodeAvailable = typeof window.require !== 'undefined';
    }
  }

  public isCEP(): boolean {
    return !!window.__adobe_cep__;
  }

  public getHostApp(): 'AEFT' | 'PPRO' | 'STANDALONE' {
    if (this.csInterface) {
      try {
        const hostEnv = this.csInterface.getHostEnvironment();
        if (hostEnv && hostEnv.appId) {
          if (hostEnv.appId.indexOf('AEFT') !== -1) return 'AEFT';
          if (hostEnv.appId.indexOf('PPRO') !== -1) return 'PPRO';
        }
      } catch (e) {
        console.warn('Error reading host env:', e);
      }
    }
    return 'STANDALONE';
  }

  public async evalScript<T = any>(script: string): Promise<T> {
    return new Promise((resolve) => {
      if (!this.csInterface) {
        console.warn('[DEV Mock] evalScript:', script);
        resolve({ success: true, mock: true } as unknown as T);
        return;
      }

      this.csInterface.evalScript(script, (result: string) => {
        try {
          const parsed = JSON.parse(result);
          resolve(parsed);
        } catch {
          resolve(result as unknown as T);
        }
      });
    });
  }

  public async getHostInfo(): Promise<HostInfo> {
    const host = this.getHostApp();
    if (host === 'STANDALONE') {
      return {
        app: 'STANDALONE',
        version: 'Browser Dev Mode',
        hasProject: true,
        activeComp: {
          hasActiveComp: true,
          name: 'Preview Comp 1080p',
          width: 1920,
          height: 1080,
          renderer: 'Advanced 3D'
        }
      };
    }

    if (host === 'AEFT') {
      const pingRes = await this.evalScript<{ success: boolean; data: any }>('BiblioPardAE.ping()');
      const compRes = await this.evalScript<{ success: boolean; data: any }>('BiblioPardAE.getActiveCompInfo()');
      return {
        app: 'AEFT',
        version: pingRes?.data?.version || '2026.2',
        hasProject: pingRes?.data?.hasProject ?? false,
        activeComp: compRes?.data
      };
    }

    if (host === 'PPRO') {
      const pingRes = await this.evalScript<{ success: boolean; data: any }>('BiblioPardPPro.ping()');
      return {
        app: 'PPRO',
        version: pingRes?.data?.version || '2026',
        hasProject: pingRes?.data?.hasProject ?? false
      };
    }

    return {
      app: 'STANDALONE',
      version: 'Unknown',
      hasProject: false
    };
  }

  /**
   * One-click import into After Effects or Premiere Pro
   */
  public async importAsset(
    asset: AssetItem,
    options?: ImportOptionsPayload
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const host = this.getHostApp();
    const target = options?.target || 'comp';
    const scaleMode = options?.scaleMode || (asset.type === '3d-model' ? 'fit-comp' : 'original');
    const autoCenter = options?.autoCenter !== false;

    if (host === 'AEFT') {
      // Clean path for ExtendScript (replace backslashes with forward slashes)
      const cleanPath = asset.filePath.replace(/\\/g, '/');

      if (asset.type === '3d-model') {
        let modelDims = options?.modelDimensions;
        if (!modelDims) {
          try {
            const { modelDimensionService } = await import('./modelDimensionService');
            const d = await modelDimensionService.getDimensions(asset.filePath);
            if (d) {
              modelDims = { width: d.width, height: d.height, depth: d.depth };
            }
          } catch {}
        }

        const payload = JSON.stringify({ 
          filePath: cleanPath, 
          target, 
          scaleMode, 
          scaleValue: options?.scaleValue,
          scaleMultiplier: options?.scaleMultiplier,
          modelDimensions: modelDims,
          autoCenter 
        });
        const res = await this.evalScript<{ success: boolean; data?: any; error?: string }>(
          `BiblioPardAE.import3DModel(${JSON.stringify(payload)})`
        );
        if (res && res.success) {
          const compMsg = res.data?.addedToComp 
            ? ` и добавлена в композицию "${res.data.compName}"` 
            : ` (добавлена в проект)`;
          return { success: true, message: `3D-модель "${asset.name}" импортирована${compMsg}`, data: res.data };
        } else {
          return { success: false, message: res?.error || 'Не удалось импортировать 3D-модель' };
        }
      }

      if (asset.type === 'environment-light') {
        const payload = JSON.stringify({ filePath: cleanPath, target });
        const res = await this.evalScript<{ success: boolean; data?: any; error?: string }>(
          `BiblioPardAE.importEnvironmentLight(${JSON.stringify(payload)})`
        );
        if (res && res.success) {
          return { success: true, message: `Карта света "${asset.name}" добавлена в "${res.data?.compName || 'проект'}"`, data: res.data };
        } else {
          return { success: false, message: res?.error || 'Не удалось импортировать карту света' };
        }
      }

      if (asset.type === 'pbr-material') {
        const payload = JSON.stringify({
          materialName: asset.name,
          mapPaths: asset.materialMaps || {}
        });
        const res = await this.evalScript<{ success: boolean; data?: any; error?: string }>(
          `BiblioPardAE.importMaterialSet(${JSON.stringify(payload)})`
        );
        if (res && res.success) {
          return {
            success: true,
            message: `Материал "${asset.name}" импортирован (${res.data?.importedCount || 0} карт) в папку "${res.data?.folderName}"`,
            data: res.data
          };
        } else {
          return { success: false, message: res?.error || 'Не удалось импортировать набор текстур материала' };
        }
      }

      // Default media import
      const payload = JSON.stringify({ 
        filePath: cleanPath, 
        target, 
        scaleMode, 
        scaleValue: options?.scaleValue,
        scaleMultiplier: options?.scaleMultiplier,
        autoCenter 
      });
      const res = await this.evalScript<{ success: boolean; data?: any; error?: string }>(
        `BiblioPardAE.importMedia(${JSON.stringify(payload)})`
      );
      if (res && res.success) {
        const compMsg = res.data?.addedToComp 
          ? ` в композицию "${res.data?.compName || 'активную'}"` 
          : ` в проект`;
        return {
          success: true,
          message: `Ассет "${asset.name}" импортирован${compMsg}`,
          data: res.data
        };
      }
      return {
        success: false,
        message: res?.error || 'Ошибка импорта'
      };
    }

    if (host === 'PPRO') {
      const cleanPath = asset.filePath.replace(/\\/g, '/');
      const payload = JSON.stringify({ filePath: cleanPath });
      const res = await this.evalScript<{ success: boolean; error?: string }>(
        `BiblioPardPPro.importFiles(${JSON.stringify(payload)})`
      );
      return {
        success: !!res?.success,
        message: res?.success ? `Asset "${asset.name}" imported to Premiere Pro` : (res?.error || 'Import failed')
      };
    }

    // Standalone Dev mode
    return {
      success: true,
      message: `[Dev Mode] "${asset.name}" (${asset.type}) импортирован ${target === 'comp' ? 'в композицию (масштаб: ' + scaleMode + ')' : 'только в проект'}`
    };
  }

  /**
   * Get items currently selected in After Effects project panel
   */
  public async getSelectedProjectItems(): Promise<Array<{
    id: number;
    name: string;
    typeName: string;
    filePath: string | null;
    width: number;
    height: number;
    duration: number;
  }>> {
    const host = this.getHostApp();
    if (host === 'AEFT') {
      const res = await this.evalScript<{ success: boolean; data?: any[] }>(
        'BiblioPardAE.getSelectedProjectItems()'
      );
      if (res && res.success && Array.isArray(res.data)) {
        return res.data;
      }
    }
    return [];
  }

  /**
   * Get info about currently active composition in After Effects
   */
  public async getActiveCompInfo(): Promise<{
    hasActiveComp: boolean;
    id?: number;
    name?: string;
    width?: number;
    height?: number;
    frameRate?: number;
    duration?: number;
    renderer?: string;
  }> {
    const host = this.getHostApp();
    if (host === 'AEFT') {
      const res = await this.evalScript<{ success: boolean; data?: any }>(
        'BiblioPardAE.getActiveCompInfo()'
      );
      if (res && res.success && res.data) {
        return res.data;
      }
    }
    // Dev mock when running outside Adobe CEP
    if (typeof window !== 'undefined' && !(window as any).__adobe_cep__) {
      return {
        hasActiveComp: true,
        name: 'Active_Scene_FullHD',
        width: 1920,
        height: 1080,
        frameRate: 30,
        duration: 10,
        renderer: 'Advanced 3D'
      };
    }
    return { hasActiveComp: false };
  }

  /**
   * Reveal file or directory in Windows Explorer or macOS Finder
   */
  public async revealInExplorer(filePath: string): Promise<boolean> {
    if (!filePath) return false;

    // 1. Try Node.js child_process (Windows: opens explorer with item selected)
    try {
      const w = typeof window !== 'undefined' ? (window as any) : null;
      const req = w?.require || w?.cep_node?.require || (typeof require === 'function' ? require : null);
      if (req) {
        const cp = req('child_process');
        const fs = req('fs');
        const cleanPath = filePath.replace(/^file:\/\/\/?/i, '').replace(/\//g, '\\');
        if (fs.existsSync(cleanPath)) {
          const stat = fs.statSync(cleanPath);
          if (stat.isDirectory()) {
            cp.exec(`explorer.exe "${cleanPath}"`);
          } else {
            cp.exec(`explorer.exe /select,"${cleanPath}"`);
          }
          return true;
        }
      }
    } catch (e) {
      console.warn('Node explorer reveal error:', e);
    }

    // 2. Try ExtendScript reveal in AE or PPro
    try {
      const cleanPath = filePath.replace(/^file:\/\/\/?/i, '');
      const host = this.getHostApp();
      const script = host === 'PPRO' 
        ? `BiblioPardPPro.revealFile(${JSON.stringify(cleanPath)})`
        : `BiblioPardAE.revealFile(${JSON.stringify(cleanPath)})`;
      const res = await this.evalScript<{ success: boolean; error?: string }>(script);
      if (res && res.success) return true;
    } catch (e) {
      console.warn('ExtendScript reveal error:', e);
    }

    // 3. Fallback: window.cep.util.openURLInDefaultBrowser
    try {
      const clean = filePath.replace(/^file:\/\/\/?/i, '');
      const lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
      const parentDir = lastSlash !== -1 ? clean.substring(0, lastSlash) : clean;
      if ((window as any).cep && (window as any).cep.util) {
        (window as any).cep.util.openURLInDefaultBrowser('file:///' + parentDir.replace(/\\/g, '/'));
        return true;
      }
    } catch {}

    return false;
  }

  /**
   * Copy file via ExtendScript
   */
  public async copyFile(srcPath: string, dstPath: string): Promise<{ success: boolean; message?: string }> {
    try {
      const payload = JSON.stringify({ srcPath, dstPath });
      const res = await this.evalScript<{ success: boolean; error?: string }>(
        `BiblioPardAE.copyFile(${JSON.stringify(payload)})`
      );
      return { success: !!res?.success, message: res?.error || '' };
    } catch (e: any) {
      return { success: false, message: e.toString() };
    }
  }

  /**
   * Write text file via ExtendScript
   */
  public async writeTextFile(filePath: string, content: string): Promise<{ success: boolean; message?: string }> {
    try {
      const payload = JSON.stringify({ filePath, content });
      const res = await this.evalScript<{ success: boolean; error?: string }>(
        `BiblioPardAE.writeTextFile(${JSON.stringify(payload)})`
      );
      return { success: !!res?.success, message: res?.error || '' };
    } catch (e: any) {
      return { success: false, message: e.toString() };
    }
  }

  /**
   * Ensure directory exists via ExtendScript
   */
  public async ensureFolder(folderPath: string): Promise<boolean> {
    try {
      const res = await this.evalScript<{ success: boolean }>(
        `BiblioPardAE.ensureFolder(${JSON.stringify(folderPath)})`
      );
      return !!res?.success;
    } catch {
      return false;
    }
  }
}

export const hostBridge = new HostBridge();
