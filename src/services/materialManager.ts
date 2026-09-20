import { MaterialMaps } from '../types';

export class MaterialManager {
  /**
   * Identify map type from filename
   */
  public identifyMapType(filename: string): keyof MaterialMaps | null {
    const name = filename.toLowerCase();

    if (/(base[_-]?color|albedo|diffuse|_col\b)/i.test(name)) return 'baseColor';
    if (/(roughness|_rough\b)/i.test(name)) return 'roughness';
    if (/(metallic|metalness|_metal\b)/i.test(name)) return 'metallic';
    if (/(normal|_norm\b|_nrm\b)/i.test(name)) return 'normal';
    if (/(height|displacement|_disp\b|_bump\b)/i.test(name)) return 'height';
    if (/(\bao\b|ambient[_-]?occlusion|_occ\b)/i.test(name)) return 'ao';
    if (/(emission|emissive|_emit\b)/i.test(name)) return 'emission';

    return null;
  }

  /**
   * Scan an array of file paths or file names and group them into a MaterialMaps object
   */
  public groupTextureMaps(files: Array<{ name: string; path: string }>): {
    isMaterial: boolean;
    maps: MaterialMaps;
    materialName: string;
  } {
    const maps: MaterialMaps = {};
    let matchedCount = 0;
    let baseName = '';

    for (const file of files) {
      const type = this.identifyMapType(file.name);
      if (type) {
        maps[type] = file.path;
        matchedCount++;
        if (!baseName) {
          // Extract base material name by stripping map suffix
          baseName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]?(base[_-]?color|albedo|diffuse|col|roughness|rough|metallic|metal|normal|norm|nrm|height|disp|bump|ao|emission|emit)/gi, '')
            .trim();
        }
      }
    }

    return {
      isMaterial: matchedCount >= 2 || !!maps.baseColor,
      maps,
      materialName: baseName || 'Custom_Material'
    };
  }
}

export const materialManager = new MaterialManager();
