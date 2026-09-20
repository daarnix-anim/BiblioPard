import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { getNodeFs } from './nodeBridge';

export class ThreePreviewEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private currentModel: THREE.Object3D | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  private pmremGenerator: THREE.PMREMGenerator;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1c1c1e');

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 1000);
    this.camera.position.set(2.5, 2, 3);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lighting setup (Clean Studio 3-point light)
    this.setupLights();

    // Grid Helper
    this.gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x2a2a2a);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    // PMREM Generator for HDR environment
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    // Start render loop
    this.animate = this.animate.bind(this);
    this.animate();

    // Handle resize
    window.addEventListener('resize', this.handleResize);
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0ff, 0.8);
    dirLight2.position.set(-5, -2, -5);
    this.scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffd0a0, 0.6);
    dirLight3.position.set(0, 5, -5);
    this.scene.add(dirLight3);
  }

  private handleResize = () => {
    if (!this.container || this.isDisposed) return;
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 300;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate() {
    if (this.isDisposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Load 3D Model from URL, Blob or ArrayBuffer
   */
  public async loadModel(source: string | ArrayBuffer, format: string): Promise<void> {
    this.clearModel();

    return new Promise((resolve, reject) => {
      const fmt = (format || '').toLowerCase().replace('.', '').trim();
      const isGLTF = fmt === 'glb' || fmt === 'gltf' || fmt === 'gbl';

      // Check if source is a local file path string
      let effectiveSource: string | ArrayBuffer = source;
      if (typeof source === 'string') {
        if (!source.startsWith('http://') && !source.startsWith('https://') && !source.startsWith('data:')) {
          try {
            const fs = getNodeFs();
            if (fs) {
              const clean = source.replace(/^file:\/\/\/?/i, '');
              const winPath = clean.replace(/\//g, '\\');
              let targetPath = fs.existsSync(clean) ? clean : (fs.existsSync(winPath) ? winPath : null);

              // Auto-fallback: if path has legacy C:/BiblioPard/Library, try resolving against user's configured libraryRoot
              if (!targetPath && /^[cC]:[/\\]BiblioPard[/\\]Library/i.test(clean)) {
                try {
                  const saved = localStorage.getItem('bibliopard_settings');
                  const settings = saved ? JSON.parse(saved) : null;
                  if (settings && settings.libraryRoot) {
                    const migrated = clean.replace(/^[cC]:[/\\]BiblioPard[/\\]Library/i, settings.libraryRoot);
                    const migratedWin = migrated.replace(/\//g, '\\');
                    targetPath = fs.existsSync(migrated) ? migrated : (fs.existsSync(migratedWin) ? migratedWin : null);
                  }
                } catch {}
              }

              if (targetPath) {
                const buf = fs.readFileSync(targetPath);
                effectiveSource = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
              }
            }
          } catch (e) {
            console.warn('[ThreePreview] Local file read error:', e);
          }
        }
      }

      if (isGLTF) {
        const loader = new GLTFLoader();
        const onLoad = (gltf: any) => {
          const model = gltf.scene;
          this.fitModelToView(model);
          this.scene.add(model);
          this.currentModel = model;
          resolve();
        };

        if (typeof effectiveSource === 'string') {
          loader.load(effectiveSource, onLoad, undefined, reject);
        } else {
          loader.parse(effectiveSource, '', onLoad, reject);
        }
      } else if (fmt === 'obj') {
        const loader = new OBJLoader();
        const onLoad = (obj: THREE.Group) => {
          this.fitModelToView(obj);
          this.scene.add(obj);
          this.currentModel = obj;
          resolve();
        };

        if (typeof effectiveSource === 'string') {
          loader.load(effectiveSource, onLoad, undefined, reject);
        } else {
          const text = new TextDecoder().decode(effectiveSource);
          const obj = loader.parse(text);
          onLoad(obj);
        }
      } else {
        reject(new Error(`Unsupported format: ${format}`));
      }
    });
  }

  /**
   * Load HDR / EXR Environment Map for lighting & background preview
   */
  public async loadHDR(source: string | ArrayBuffer): Promise<void> {
    this.clearModel();

    return new Promise((resolve, reject) => {
      const loader = new RGBELoader();
      const onLoad = (texture: THREE.DataTexture) => {
        const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
        this.scene.environment = envMap;
        this.scene.background = envMap;
        texture.dispose();

        // Add a reflective preview sphere to demonstrate the environment lighting
        const geometry = new THREE.SphereGeometry(1, 64, 32);
        const material = new THREE.MeshStandardMaterial({
          roughness: 0.1,
          metalness: 0.9,
          color: 0xcccccc
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(0, 1, 0);
        this.scene.add(sphere);
        this.currentModel = sphere;

        this.camera.position.set(0, 1, 3.5);
        this.controls.target.set(0, 1, 0);
        this.controls.update();

        resolve();
      };

      let effectiveSource: string | ArrayBuffer = source;
      if (typeof source === 'string' && !source.startsWith('http://') && !source.startsWith('https://') && !source.startsWith('data:')) {
        try {
          const fs = getNodeFs();
          if (fs) {
            const clean = source.replace(/^file:\/\/\/?/i, '');
            const winPath = clean.replace(/\//g, '\\');
            const targetPath = fs.existsSync(clean) ? clean : (fs.existsSync(winPath) ? winPath : null);
            if (targetPath) {
              const buf = fs.readFileSync(targetPath);
              effectiveSource = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            }
          }
        } catch (e) {
          console.warn('[ThreePreview] Local HDR file read error:', e);
        }
      }

      if (typeof effectiveSource === 'string') {
        loader.load(effectiveSource, onLoad, undefined, reject);
      } else {
        try {
          const blob = new Blob([effectiveSource]);
          const blobUrl = URL.createObjectURL(blob);
          loader.load(
            blobUrl,
            (texture) => {
              URL.revokeObjectURL(blobUrl);
              onLoad(texture);
            },
            undefined,
            (err) => {
              URL.revokeObjectURL(blobUrl);
              reject(err);
            }
          );
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  /**
   * Load PBR Material Maps and render on a Shader Ball
   */
  public async loadMaterial(maps: {
    baseColor?: string;
    roughness?: string;
    metallic?: string;
    normal?: string;
    height?: string;
    ao?: string;
    emission?: string;
  }): Promise<void> {
    this.clearModel();

    return new Promise((resolve) => {
      const textureLoader = new THREE.TextureLoader();
      const material = new THREE.MeshPhysicalMaterial({
        color: maps.baseColor ? 0xffffff : 0xaaaaaa,
        roughness: maps.roughness ? 1.0 : 0.4,
        metalness: maps.metallic ? 1.0 : 0.0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.1
      });

      const configureTexture = (tex: THREE.Texture, isColor = false) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        if (isColor) {
          tex.colorSpace = THREE.SRGBColorSpace;
        }
      };

      if (maps.baseColor) {
        textureLoader.load(maps.baseColor, (tex) => {
          configureTexture(tex, true);
          material.map = tex;
          material.needsUpdate = true;
        });
      }

      if (maps.roughness) {
        textureLoader.load(maps.roughness, (tex) => {
          configureTexture(tex);
          material.roughnessMap = tex;
          material.needsUpdate = true;
        });
      }

      if (maps.metallic) {
        textureLoader.load(maps.metallic, (tex) => {
          configureTexture(tex);
          material.metalnessMap = tex;
          material.needsUpdate = true;
        });
      }

      if (maps.normal) {
        textureLoader.load(maps.normal, (tex) => {
          configureTexture(tex);
          material.normalMap = tex;
          material.normalScale.set(1, 1);
          material.needsUpdate = true;
        });
      }

      if (maps.ao) {
        textureLoader.load(maps.ao, (tex) => {
          configureTexture(tex);
          material.aoMap = tex;
          material.aoMapIntensity = 1.0;
          material.needsUpdate = true;
        });
      }

      if (maps.emission) {
        textureLoader.load(maps.emission, (tex) => {
          configureTexture(tex, true);
          material.emissiveMap = tex;
          material.emissive = new THREE.Color(0xffffff);
          material.needsUpdate = true;
        });
      }

      // Create Shader Ball: compound mesh with a sphere and a pedestal
      const group = new THREE.Group();

      // Main sphere
      const sphereGeo = new THREE.SphereGeometry(1, 64, 32);
      sphereGeo.setAttribute('uv2', sphereGeo.attributes.uv);
      const sphereMesh = new THREE.Mesh(sphereGeo, material);
      sphereMesh.position.y = 1.1;
      sphereMesh.castShadow = true;
      sphereMesh.receiveShadow = true;
      group.add(sphereMesh);

      // Pedestal stand
      const pedestalGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.2, 32);
      const pedestalMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2
      });
      const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
      pedestalMesh.position.y = 0.1;
      pedestalMesh.castShadow = true;
      pedestalMesh.receiveShadow = true;
      group.add(pedestalMesh);

      this.scene.add(group);
      this.currentModel = group;

      this.camera.position.set(2, 2, 2.5);
      this.controls.target.set(0, 1.1, 0);
      this.controls.update();

      resolve();
    });
  }

  /**
   * Automatically centers and scales the model to comfortably fit the viewport
   */
  private fitModelToView(model: THREE.Object3D) {
    // Enable shadows for meshes
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Center model at origin
    model.position.x = -center.x;
    model.position.y = -box.min.y; // Sit on the ground grid
    model.position.z = -center.z;

    // Adjust camera distance to object size
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    if (cameraDistance < 1) cameraDistance = 2;

    this.camera.position.set(cameraDistance * 0.8, cameraDistance * 0.6, cameraDistance);
    this.controls.target.set(0, size.y / 2, 0);
    this.controls.update();
  }

  public clearModel() {
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
      this.currentModel = null;
    }
  }

  public setGridVisible(visible: boolean) {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  public setBackgroundColor(colorHex: string) {
    this.scene.background = new THREE.Color(colorHex);
  }

  /**
   * Take a high-resolution snapshot (PNG)
   */
  public captureSnapshot(width = 512, height = 512): string {
    const originalWidth = this.renderer.domElement.width;
    const originalHeight = this.renderer.domElement.height;
    const originalAspect = this.camera.aspect;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');

    // Restore original size
    this.renderer.setSize(originalWidth, originalHeight, false);
    this.camera.aspect = originalAspect;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    return dataUrl;
  }

  /**
   * Capture 360-degree rotation frames for GIF generation
   */
  public async capture360Frames(
    numFrames = 24,
    width = 300,
    height = 300
  ): Promise<ImageData[]> {
    if (!this.currentModel) return [];

    const originalWidth = this.renderer.domElement.width;
    const originalHeight = this.renderer.domElement.height;
    const originalAspect = this.camera.aspect;
    const originalRotationY = this.currentModel.rotation.y;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Create a 2D canvas to capture frames as ImageData
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

    const frames: ImageData[] = [];
    const step = (Math.PI * 2) / numFrames;

    for (let i = 0; i < numFrames; i++) {
      this.currentModel.rotation.y = originalRotationY + i * step;
      this.renderer.render(this.scene, this.camera);

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(this.renderer.domElement, 0, 0, width, height);
      frames.push(ctx.getImageData(0, 0, width, height));
    }

    // Restore
    this.currentModel.rotation.y = originalRotationY;
    this.renderer.setSize(originalWidth, originalHeight, false);
    this.camera.aspect = originalAspect;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    return frames;
  }

  public dispose() {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);

    this.clearModel();
    this.pmremGenerator.dispose();
    this.controls.dispose();
    this.renderer.dispose();

    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
