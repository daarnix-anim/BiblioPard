import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { getNodeFs } from './nodeBridge';

export interface ModelDimensions {
  width: number;
  height: number;
  depth: number;
  maxDim: number;
  min: [number, number, number];
  max: [number, number, number];
}

class ModelDimensionService {
  private cache = new Map<string, ModelDimensions>();

  /**
   * Fast extraction of 3D model real-world dimensions (bounding box)
   * Supports GLB, GLTF, OBJ
   */
  public async getDimensions(filePath: string): Promise<ModelDimensions | null> {
    if (!filePath) return null;

    const normalizedKey = filePath.replace(/\\/g, '/').toLowerCase();
    if (this.cache.has(normalizedKey)) {
      return this.cache.get(normalizedKey)!;
    }

    try {
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const buffer = this.readFileBuffer(filePath);

      if (!buffer) {
        return null;
      }

      let dims: ModelDimensions | null = null;

      if (ext === 'glb' || ext === 'gltf') {
        dims = await this.parseGLTF(buffer);
      } else if (ext === 'obj') {
        dims = await this.parseOBJ(buffer);
      }

      if (dims) {
        this.cache.set(normalizedKey, dims);
        return dims;
      }
    } catch (err) {
      console.warn('[ModelDimensionService] Failed to calculate dimensions:', err);
    }

    return null;
  }

  /**
   * Read file as ArrayBuffer using Node.js or fetch
   */
  private readFileBuffer(filePath: string): ArrayBuffer | null {
    try {
      const fs = getNodeFs();
      if (fs) {
        const clean = filePath.replace(/^file:\/\/\/?/i, '');
        const winPath = clean.replace(/\//g, '\\');
        const targetPath = fs.existsSync(clean) ? clean : (fs.existsSync(winPath) ? winPath : null);
        if (targetPath) {
          const buf = fs.readFileSync(targetPath);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        }
      }
    } catch (e) {
      console.warn('[ModelDimensionService] Node file read error:', e);
    }
    return null;
  }

  /**
   * Parse GLTF/GLB using Three.js GLTFLoader
   */
  private parseGLTF(buffer: ArrayBuffer): Promise<ModelDimensions | null> {
    return new Promise((resolve) => {
      // First attempt fast binary accessor read for GLB
      const fastResult = this.fastScanGLB(buffer);

      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => {
          try {
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = new THREE.Vector3();
            box.getSize(size);

            if (size.x > 0.0001 && size.y > 0.0001) {
              const maxDim = Math.max(size.x, size.y, size.z);
              resolve({
                width: size.x,
                height: size.y,
                depth: size.z,
                maxDim,
                min: [box.min.x, box.min.y, box.min.z],
                max: [box.max.x, box.max.y, box.max.z]
              });
              return;
            }
          } catch (e) {
            console.warn('[ModelDimensionService] Three.js GLTF box calculation error:', e);
          }
          // Fallback to fast scan if Three.js box was empty
          resolve(fastResult);
        },
        () => {
          // If GLTFLoader fails, fallback to fast accessor scanner
          resolve(fastResult);
        }
      );
    });
  }

  /**
   * Fast header and accessor scanner for GLB
   */
  private fastScanGLB(buffer: ArrayBuffer): ModelDimensions | null {
    try {
      const view = new DataView(buffer);
      const magic = view.getUint32(0, true);
      // 0x46546C67 is 'glTF'
      if (magic !== 0x46546C67) return null;

      const jsonLength = view.getUint32(12, true);
      const jsonBytes = new Uint8Array(buffer, 20, jsonLength);
      const jsonStr = new TextDecoder('utf-8').decode(jsonBytes);
      const gltf = JSON.parse(jsonStr);

      if (!gltf.accessors || !Array.isArray(gltf.accessors)) return null;

      let min = [Infinity, Infinity, Infinity];
      let max = [-Infinity, -Infinity, -Infinity];
      let found = false;

      for (const acc of gltf.accessors) {
        if (acc.type === 'VEC3' && Array.isArray(acc.min) && Array.isArray(acc.max)) {
          for (let i = 0; i < 3; i++) {
            if (acc.min[i] < min[i]) min[i] = acc.min[i];
            if (acc.max[i] > max[i]) max[i] = acc.max[i];
          }
          found = true;
        }
      }

      if (found && min[0] !== Infinity && max[0] !== -Infinity) {
        const width = Math.max(0.001, max[0] - min[0]);
        const height = Math.max(0.001, max[1] - min[1]);
        const depth = Math.max(0.001, max[2] - min[2]);
        return {
          width,
          height,
          depth,
          maxDim: Math.max(width, height, depth),
          min: [min[0], min[1], min[2]],
          max: [max[0], max[1], max[2]]
        };
      }
    } catch {}
    return null;
  }

  /**
   * Parse OBJ using Three.js OBJLoader
   */
  private parseOBJ(buffer: ArrayBuffer): Promise<ModelDimensions | null> {
    return new Promise((resolve) => {
      try {
        const text = new TextDecoder('utf-8').decode(buffer);
        const loader = new OBJLoader();
        const obj = loader.parse(text);
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);

        if (size.x > 0.0001 && size.y > 0.0001) {
          resolve({
            width: size.x,
            height: size.y,
            depth: size.z,
            maxDim: Math.max(size.x, size.y, size.z),
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z]
          });
          return;
        }
      } catch (e) {
        console.warn('[ModelDimensionService] OBJ parse error:', e);
      }
      resolve(null);
    });
  }
}

export const modelDimensionService = new ModelDimensionService();
