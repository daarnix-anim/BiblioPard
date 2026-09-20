import { AssetItem, AssetType, Category, LibrarySettings, MaterialMaps } from '../types';
import { materialManager } from './materialManager';

export class LibraryManager {
  private settingsKey = 'bibliopard_settings';
  private localAssetsKey = 'bibliopard_mock_assets';
  private fs: any = null;
  private path: any = null;

  constructor() {
    if (typeof window !== 'undefined' && window.require) {
      try {
        this.fs = window.require('fs');
        this.path = window.require('path');
      } catch (e) {
        console.warn('Node.js fs/path not accessible in this context:', e);
      }
    }
  }

  public isNodeAvailable(): boolean {
    return !!(this.fs && this.path);
  }

  public getSettings(): LibrarySettings {
    const saved = localStorage.getItem(this.settingsKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    // Default settings
    return {
      libraryRoot: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library',
      autoSwitchToAdvanced3D: true,
      autoCenterInComp: true,
      generateGifByDefault: true,
      gifFramesCount: 24,
      githubRepo: 'Pard/BiblioPard',
      autoCheckUpdates: true
    };
  }

  public saveSettings(settings: LibrarySettings) {
    localStorage.setItem(this.settingsKey, JSON.stringify(settings));
  }

  public getDefaultCategories(): Category[] {
    return [
      { id: 'all', name: 'All Assets', icon: 'Layers', type: 'all' },
      { id: '3d-models', name: '3D Models', icon: 'Box', type: '3d-model' },
      { id: 'materials', name: '3D Materials', icon: 'Palette', type: 'pbr-material' },
      { id: 'env-lights', name: 'Environment Lights', icon: 'Sun', type: 'environment-light' },
      { id: 'video-alpha', name: 'Video (Alpha)', icon: 'Film', type: 'video-alpha' },
      { id: 'titles', name: 'Titles & MOGRT', icon: 'Type', type: 'title-mogrt' }
    ];
  }

  /**
   * Scan library folder for assets
   */
  public async loadAssets(): Promise<AssetItem[]> {
    const settings = this.getSettings();

    if (this.isNodeAvailable()) {
      try {
        const root = settings.libraryRoot;
        if (!this.fs.existsSync(root)) {
          this.ensureDefaultLibraryStructure(root);
        }
        return this.scanDirectory(root);
      } catch (err) {
        console.error('Error scanning library on disk:', err);
      }
    }

    // Fallback: Browser local storage (for browser dev testing)
    return this.getMockAssets();
  }

  /**
   * Creates initial directory structure on disk if not present
   */
  public ensureDefaultLibraryStructure(rootPath: string) {
    if (!this.isNodeAvailable()) return;
    try {
      if (!this.fs.existsSync(rootPath)) {
        this.fs.mkdirSync(rootPath, { recursive: true });
      }
      const dirs = [
        '3D_Models/SciFi',
        '3D_Models/Characters',
        '3D_Models/Props',
        'Materials/Metal',
        'Materials/Fabric',
        'Materials/Wood',
        'Materials/SciFi',
        'Environment_Lights/Studio',
        'Environment_Lights/Outdoor',
        'Video_Overlays',
        'Titles_MOGRT'
      ];
      for (const dir of dirs) {
        const target = this.path.join(rootPath, dir);
        if (!this.fs.existsSync(target)) {
          this.fs.mkdirSync(target, { recursive: true });
        }
      }
    } catch (e) {
      console.error('Failed to create default library dirs:', e);
    }
  }

  /**
   * Recursively scan directory on disk for 3D, HDR, and PBR material files
   */
  private scanDirectory(dirPath: string): AssetItem[] {
    const assets: AssetItem[] = [];
    if (!this.fs.existsSync(dirPath)) return assets;

    const entries = this.fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = this.path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // First check if this directory is a PBR material directory (contains baseColor/roughness/etc.)
        const subFiles = this.fs.readdirSync(fullPath, { withFileTypes: true })
          .filter((e: any) => e.isFile())
          .map((e: any) => ({ name: e.name, path: this.path.join(fullPath, e.name) }));

        const matCheck = materialManager.groupTextureMaps(subFiles);
        if (matCheck.isMaterial) {
          const previewPng = this.path.join(fullPath, 'preview.png');
          const previewJpg = this.path.join(fullPath, 'preview.jpg');
          const previewGif = this.path.join(fullPath, 'preview.gif');
          const metaPath = this.path.join(fullPath, 'meta.json');

          let meta: any = {};
          if (this.fs.existsSync(metaPath)) {
            try { meta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8')); } catch {}
          }

          let previewImage: string | undefined;
          if (this.fs.existsSync(previewPng)) {
            previewImage = 'file:///' + previewPng.replace(/\\/g, '/');
          } else if (this.fs.existsSync(previewJpg)) {
            previewImage = 'file:///' + previewJpg.replace(/\\/g, '/');
          } else if (matCheck.maps.baseColor) {
            previewImage = 'file:///' + matCheck.maps.baseColor.replace(/\\/g, '/');
          }

          let previewGifPath: string | undefined;
          if (this.fs.existsSync(previewGif)) {
            previewGifPath = 'file:///' + previewGif.replace(/\\/g, '/');
          }

          let totalSize = 0;
          for (const f of subFiles) {
            try { totalSize += this.fs.statSync(f.path).size; } catch {}
          }

          assets.push({
            id: meta.id || fullPath,
            name: meta.name || matCheck.materialName,
            type: 'pbr-material',
            format: 'mat',
            filePath: fullPath,
            previewImage,
            previewGif: previewGifPath,
            category: meta.category || this.path.basename(this.path.dirname(fullPath)),
            tags: meta.tags || ['PBR', 'Material'],
            fileSize: totalSize,
            createdAt: meta.createdAt || new Date().toISOString(),
            description: meta.description || 'PBR Material texture set for After Effects Advanced 3D',
            materialMaps: matCheck.maps
          });
        } else {
          // Regular directory, recurse into subdirectories
          const subAssets = this.scanDirectory(fullPath);
          assets.push(...subAssets);
        }
      } else if (entry.isFile()) {
        const ext = this.path.extname(entry.name).toLowerCase().replace('.', '');
        const is3D = ['glb', 'gltf', 'obj'].includes(ext);
        const isHDR = ['hdr', 'exr'].includes(ext);
        const isVideo = ['mov', 'mp4'].includes(ext);

        if (is3D || isHDR || isVideo) {
          const dir = this.path.dirname(fullPath);
          const baseName = this.path.basename(entry.name, '.' + ext);
          const metaPath = this.path.join(dir, 'meta.json');
          
          let meta: any = {};
          if (this.fs.existsSync(metaPath)) {
            try {
              meta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8'));
            } catch {}
          }

          // Check for preview image / gif
          const previewPng = this.path.join(dir, 'preview.png');
          const previewJpg = this.path.join(dir, 'preview.jpg');
          const previewGif = this.path.join(dir, 'preview.gif');

          let previewImage: string | undefined = undefined;
          let previewGifPath: string | undefined = undefined;

          if (this.fs.existsSync(previewPng)) {
            previewImage = 'file:///' + previewPng.replace(/\\/g, '/');
          } else if (this.fs.existsSync(previewJpg)) {
            previewImage = 'file:///' + previewJpg.replace(/\\/g, '/');
          }

          if (this.fs.existsSync(previewGif)) {
            previewGifPath = 'file:///' + previewGif.replace(/\\/g, '/');
          }

          const stats = this.fs.statSync(fullPath);

          let assetType: AssetType = '3d-model';
          if (isHDR) assetType = 'environment-light';
          else if (isVideo) assetType = 'video-alpha';

          assets.push({
            id: meta.id || fullPath,
            name: meta.name || baseName,
            type: meta.type || assetType,
            format: ext,
            filePath: fullPath,
            previewImage: previewImage || meta.previewImage,
            previewGif: previewGifPath || meta.previewGif,
            category: meta.category || this.path.basename(dir),
            tags: meta.tags || [ext.toUpperCase()],
            fileSize: stats.size,
            createdAt: meta.createdAt || stats.birthtime?.toISOString() || new Date().toISOString(),
            description: meta.description || '',
            scale: meta.scale || 1.0
          });
        }
      }
    }

    return assets;
  }

  /**
   * Add a new asset to the library
   */
  public async addAsset(params: {
    name: string;
    file: File;
    type: AssetType;
    category: string;
    tags: string[];
    description?: string;
    previewPngBase64?: string;
    previewGifBase64?: string;
  }): Promise<AssetItem> {
    const settings = this.getSettings();
    const ext = params.file.name.split('.').pop()?.toLowerCase() || '';

    if (this.isNodeAvailable()) {
      const categoryDir = this.path.join(settings.libraryRoot, params.type === '3d-model' ? '3D_Models' : 'Environment_Lights', params.category);
      const safeName = params.name.replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_');
      const assetDir = this.path.join(categoryDir, safeName);

      if (!this.fs.existsSync(assetDir)) {
        this.fs.mkdirSync(assetDir, { recursive: true });
      }

      const targetFilePath = this.path.join(assetDir, `${safeName}.${ext}`);

      // Write original file
      const arrayBuffer = await params.file.arrayBuffer();
      this.fs.writeFileSync(targetFilePath, Buffer.from(arrayBuffer));

      let previewPngPath: string | undefined;
      let previewGifPath: string | undefined;

      // Save preview PNG
      if (params.previewPngBase64) {
        const pngPath = this.path.join(assetDir, 'preview.png');
        const base64Data = params.previewPngBase64.replace(/^data:image\/\w+;base64,/, '');
        this.fs.writeFileSync(pngPath, Buffer.from(base64Data, 'base64'));
        previewPngPath = 'file:///' + pngPath.replace(/\\/g, '/');
      }

      // Save preview GIF
      if (params.previewGifBase64) {
        const gifPath = this.path.join(assetDir, 'preview.gif');
        const base64Data = params.previewGifBase64.replace(/^data:image\/\w+;base64,/, '');
        this.fs.writeFileSync(gifPath, Buffer.from(base64Data, 'base64'));
        previewGifPath = 'file:///' + gifPath.replace(/\\/g, '/');
      }

      // Write meta.json
      const meta = {
        id: targetFilePath,
        name: params.name,
        type: params.type,
        format: ext,
        category: params.category,
        tags: params.tags,
        description: params.description || '',
        createdAt: new Date().toISOString()
      };
      this.fs.writeFileSync(this.path.join(assetDir, 'meta.json'), JSON.stringify(meta, null, 2));

      return {
        id: targetFilePath,
        name: params.name,
        type: params.type,
        format: ext,
        filePath: targetFilePath,
        previewImage: previewPngPath,
        previewGif: previewGifPath,
        category: params.category,
        tags: params.tags,
        fileSize: arrayBuffer.byteLength,
        createdAt: meta.createdAt,
        description: params.description
      };
    }

    // Mock storage fallback (in browser)
    const mockAsset: AssetItem = {
      id: 'mock-' + Date.now(),
      name: params.name,
      type: params.type,
      format: ext,
      filePath: `C:/BiblioPard/Library/${params.name}.${ext}`,
      previewImage: params.previewPngBase64,
      previewGif: params.previewGifBase64,
      category: params.category,
      tags: params.tags,
      fileSize: params.file.size,
      createdAt: new Date().toISOString(),
      description: params.description
    };

    const currentMocks = this.getMockAssets();
    currentMocks.unshift(mockAsset);
    localStorage.setItem(this.localAssetsKey, JSON.stringify(currentMocks));
    return mockAsset;
  }

  /**
   * Update asset metadata (name, category, tags, description)
   */
  public async updateAssetMetadata(
    asset: AssetItem,
    updates: { name: string; category: string; tags: string[]; description?: string }
  ): Promise<AssetItem> {
    const updatedAsset: AssetItem = {
      ...asset,
      name: updates.name.trim(),
      category: updates.category.trim(),
      tags: updates.tags,
      description: updates.description
    };

    if (this.isNodeAvailable()) {
      try {
        const rawPath = asset.filePath.replace(/^file:\/\/\/?/i, '');
        const assetDir = asset.type === 'pbr-material' ? rawPath : this.path.dirname(rawPath);
        const metaPath = this.path.join(assetDir, 'meta.json');

        let currentMeta: any = {};
        if (this.fs.existsSync(metaPath)) {
          try {
            currentMeta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8'));
          } catch {}
        }

        const newMeta = {
          ...currentMeta,
          name: updatedAsset.name,
          category: updatedAsset.category,
          tags: updatedAsset.tags,
          description: updatedAsset.description || '',
          updatedAt: new Date().toISOString()
        };

        this.fs.writeFileSync(metaPath, JSON.stringify(newMeta, null, 2));
      } catch (err) {
        console.error('Failed to update meta.json on disk:', err);
      }
    } else {
      const mocks = this.getMockAssets().map(a => a.id === asset.id ? updatedAsset : a);
      localStorage.setItem(this.localAssetsKey, JSON.stringify(mocks));
    }

    return updatedAsset;
  }

  /**
   * Replace source file with a newer version (e.g. from After Effects project)
   */
  public async replaceAssetFile(asset: AssetItem, newSourcePath: string): Promise<AssetItem> {
    const rawNewPath = newSourcePath.replace(/^file:\/\/\/?/i, '');

    if (this.isNodeAvailable()) {
      if (!this.fs.existsSync(rawNewPath)) {
        throw new Error(`Source file does not exist: ${rawNewPath}`);
      }

      const rawOldPath = asset.filePath.replace(/^file:\/\/\/?/i, '');
      const assetDir = asset.type === 'pbr-material' ? rawOldPath : this.path.dirname(rawOldPath);
      const newExt = this.path.extname(rawNewPath).toLowerCase().replace('.', '');
      const safeName = asset.name.replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_');
      const targetPath = this.path.join(assetDir, `${safeName}.${newExt}`);

      // Copy new file over target
      this.fs.copyFileSync(rawNewPath, targetPath);

      // If old file had a different path, remove it
      if (targetPath !== rawOldPath && this.fs.existsSync(rawOldPath)) {
        try { this.fs.unlinkSync(rawOldPath); } catch {}
      }

      const stat = this.fs.statSync(targetPath);
      const metaPath = this.path.join(assetDir, 'meta.json');
      let meta: any = {};
      if (this.fs.existsSync(metaPath)) {
        try { meta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8')); } catch {}
      }
      meta.format = newExt;
      meta.updatedAt = new Date().toISOString();
      this.fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

      return {
        ...asset,
        filePath: targetPath,
        format: newExt,
        fileSize: stat.size
      };
    }

    return asset;
  }

  /**
   * Delete asset from library and disk
   */
  public async deleteAsset(asset: AssetItem): Promise<boolean> {
    if (this.isNodeAvailable()) {
      try {
        const settings = this.getSettings();
        const rawPath = asset.filePath.replace(/^file:\/\/\/?/i, '');
        const assetDir = asset.type === 'pbr-material' ? rawPath : this.path.dirname(rawPath);

        // Security check: ensure assetDir is inside libraryRoot
        const normalizedRoot = this.path.resolve(settings.libraryRoot).toLowerCase();
        const normalizedDir = this.path.resolve(assetDir).toLowerCase();

        if (normalizedDir.startsWith(normalizedRoot) && normalizedDir !== normalizedRoot) {
          if (this.fs.existsSync(assetDir)) {
            this.fs.rmSync(assetDir, { recursive: true, force: true });
            return true;
          }
        }
      } catch (err) {
        console.error('Failed to delete asset directory:', err);
        throw err;
      }
    } else {
      const mocks = this.getMockAssets().filter(a => a.id !== asset.id);
      localStorage.setItem(this.localAssetsKey, JSON.stringify(mocks));
      return true;
    }
    return false;
  }

  /**
   * Browser dev mock assets
   */
  private getMockAssets(): AssetItem[] {
    const saved = localStorage.getItem(this.localAssetsKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }

    // Initial starter mock assets
    const sampleAssets: AssetItem[] = [
      {
        id: 'sample-1',
        name: 'Futuristic Drone Mk.II',
        type: '3d-model',
        format: 'glb',
        filePath: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/3D_Models/SciFi/Drone_01.glb',
        category: 'SciFi',
        tags: ['SciFi', 'Vehicle', 'Cyberpunk', 'GLB'],
        fileSize: 4250000,
        createdAt: new Date().toISOString(),
        description: 'Detailed quad-rotor drone with PBR materials for After Effects 3D workspace'
      },
      {
        id: 'sample-2',
        name: 'Studio Softbox 3-Point',
        type: 'environment-light',
        format: 'hdr',
        filePath: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Environment_Lights/Studio/Studio_Softbox.hdr',
        category: 'Studio',
        tags: ['Studio', 'Clean', 'Commercial', 'HDR'],
        fileSize: 8400000,
        createdAt: new Date().toISOString(),
        description: 'Clean high dynamic range studio environment for Advanced 3D lighting'
      },
      {
        id: 'sample-3',
        name: 'Cyberpunk Neon Street',
        type: 'environment-light',
        format: 'exr',
        filePath: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Environment_Lights/Outdoor/Neon_Street.exr',
        category: 'Outdoor',
        tags: ['Neon', 'Night', 'Reflections', 'EXR'],
        fileSize: 12500000,
        createdAt: new Date().toISOString(),
        description: 'Vibrant night city lighting with colorful specular highlights'
      },
      {
        id: 'sample-4',
        name: 'Mechanical Robot Arm',
        type: '3d-model',
        format: 'gltf',
        filePath: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/3D_Models/Props/Robot_Arm.gltf',
        category: 'Props',
        tags: ['Industrial', 'Robotics', 'PBR', 'GLTF'],
        fileSize: 3100000,
        createdAt: new Date().toISOString(),
        description: 'Industrial assembly robotic arm with metallic/roughness textures'
      },
      {
        id: 'sample-5',
        name: 'Brushed Titanium PBR',
        type: 'pbr-material',
        format: 'mat',
        filePath: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Materials/Metal/Brushed_Titanium',
        category: 'Metal',
        tags: ['Metal', 'Titanium', 'PBR', 'Brushed'],
        fileSize: 18500000,
        createdAt: new Date().toISOString(),
        description: 'Realistic brushed titanium metal material with roughness and normal maps for AE 3D',
        materialMaps: {
          baseColor: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Materials/Metal/Brushed_Titanium/Titanium_BaseColor.png',
          roughness: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Materials/Metal/Brushed_Titanium/Titanium_Roughness.png',
          metallic: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Materials/Metal/Brushed_Titanium/Titanium_Metallic.png',
          normal: 'd:/Yandex.Disk/MyPrograms/Plugins After effets/BiblioPard/Library/Materials/Metal/Brushed_Titanium/Titanium_Normal.png'
        }
      }
    ];

    localStorage.setItem(this.localAssetsKey, JSON.stringify(sampleAssets));
    return sampleAssets;
  }
}

export const libraryManager = new LibraryManager();
