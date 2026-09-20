export type AssetType = 
  | '3d-model' 
  | 'pbr-material'
  | 'environment-light' 
  | 'video-alpha' 
  | 'image-alpha' 
  | 'title-mogrt';

export interface MaterialMaps {
  baseColor?: string;
  roughness?: string;
  metallic?: string;
  normal?: string;
  height?: string;
  ao?: string;
  emission?: string;
}

export interface AssetItem {
  id: string;
  name: string;
  type: AssetType;
  format: string; // glb, gltf, obj, hdr, exr, mat, mov, png, etc.
  filePath: string;
  previewImage?: string; // data URL or relative/file URL
  previewGif?: string;   // data URL or relative/file URL
  category: string;
  tags: string[];
  fileSize: number; // in bytes
  createdAt: string;
  description?: string;
  scale?: number;
  materialMaps?: MaterialMaps;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: AssetType | 'all';
  count?: number;
}

export interface HostInfo {
  app: 'AEFT' | 'PPRO' | 'STANDALONE';
  version: string;
  hasProject: boolean;
  activeComp?: {
    hasActiveComp: boolean;
    name?: string;
    width?: number;
    height?: number;
    renderer?: string;
  };
}

export interface ProjectItem {
  id: number;
  name: string;
  typeName: string;
  filePath: string | null;
  width: number;
  height: number;
  duration: number;
}

export interface LibrarySettings {
  libraryRoot: string;
  autoSwitchToAdvanced3D: boolean;
  autoCenterInComp: boolean;
  generateGifByDefault: boolean;
  gifFramesCount: number; // e.g. 24
  githubRepo: string; // e.g. "daarnix-anim/BiblioPard"
  autoCheckUpdates: boolean;
}

export interface ReleaseInfo {
  version: string;
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  zipUrl?: string;
  publishedAt: string;
  hasUpdate: boolean;
}
