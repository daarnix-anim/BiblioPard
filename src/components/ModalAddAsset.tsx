import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Camera, Film, Check, AlertCircle, Loader2, Box, Sun } from 'lucide-react';
import { AssetType, AssetItem } from '../types';
import { ThreePreviewEngine } from '../services/threePreview';
import { createGifFromFrames } from '../services/gifGenerator';
import { libraryManager } from '../services/libraryManager';

interface ModalAddAssetProps {
  isOpen: boolean;
  onClose: () => void;
  onAssetAdded: (asset: AssetItem) => void;
  initialFiles?: File[] | null;
}

export const ModalAddAsset: React.FC<ModalAddAssetProps> = ({
  isOpen,
  onClose,
  onAssetAdded,
  initialFiles
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [assetType, setAssetType] = useState<AssetType>('3d-model');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('SciFi');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [previewPng, setPreviewPng] = useState<string | null>(null);
  const [previewGif, setPreviewGif] = useState<string | null>(null);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreePreviewEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Three.js viewport when modal opens and container is available
  useEffect(() => {
    if (isOpen && viewportRef.current && !engineRef.current) {
      engineRef.current = new ThreePreviewEngine(viewportRef.current);
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [isOpen]);

  // If opened via global drag-and-drop, immediately process the dropped files
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      // Small timeout to ensure Three.js canvas is mounted
      setTimeout(() => {
        handleSelectedFiles(initialFiles);
      }, 100);
    }
  }, [isOpen, initialFiles]);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSelectedFiles = async (filesList: File[]) => {
    setErrorMsg(null);
    if (filesList.length === 0) return;

    const firstFile = filesList[0];
    const ext = firstFile.name.split('.').pop()?.toLowerCase() || '';
    const is3D = ['glb', 'gltf', 'obj'].includes(ext);
    const isHDR = ['hdr', 'exr'].includes(ext);
    const isImage = ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'tga', 'webp'].includes(ext);

    // If multiple files or texture images, check if it's a PBR material
    if (filesList.length > 1 || (isImage && !isHDR)) {
      const fileEntries = filesList.map(f => ({ name: f.name, path: URL.createObjectURL(f) }));
      const matCheck = (await import('../services/materialManager')).materialManager.groupTextureMaps(fileEntries);

      if (matCheck.isMaterial || isImage) {
        setFile(firstFile);
        setName(matCheck.materialName.replace(/[_-]/g, ' '));
        setAssetType('pbr-material');
        setCategory('Metal');
        setTags('PBR, Material, Texture');

        if (engineRef.current) {
          try {
            await engineRef.current.loadMaterial(matCheck.maps);
            setTimeout(() => {
              if (engineRef.current) {
                setPreviewPng(engineRef.current.captureSnapshot(400, 400));
              }
            }, 300);
          } catch (err: any) {
            setErrorMsg('Failed to render Material preview: ' + (err?.message || err));
          }
        }
        return;
      }
    }

    if (!is3D && !isHDR) {
      setErrorMsg('Unsupported format. Please upload .glb, .gltf, .obj, .hdr, or PBR texture images');
      return;
    }

    setFile(firstFile);
    const baseName = firstFile.name.substring(0, firstFile.name.lastIndexOf('.'));
    setName(baseName.replace(/[_-]/g, ' '));

    const detectedType: AssetType = isHDR ? 'environment-light' : '3d-model';
    setAssetType(detectedType);
    setCategory(isHDR ? 'Studio' : 'SciFi');
    setTags(`${ext.toUpperCase()}, ${detectedType === '3d-model' ? '3D' : 'Environment'}`);

    // Load into Three.js viewport
    if (engineRef.current) {
      try {
        const buffer = await firstFile.arrayBuffer();
        if (is3D) {
          await engineRef.current.loadModel(buffer, ext as 'glb' | 'gltf' | 'obj');
        } else if (isHDR) {
          await engineRef.current.loadHDR(buffer);
        }
        setTimeout(() => {
          if (engineRef.current) {
            const initialSnapshot = engineRef.current.captureSnapshot(400, 400);
            setPreviewPng(initialSnapshot);
          }
        }, 300);
      } catch (err: any) {
        setErrorMsg('Failed to render 3D preview: ' + (err?.message || err));
      }
    }
  };

  const handleCaptureSnapshot = () => {
    if (engineRef.current) {
      const snap = engineRef.current.captureSnapshot(512, 512);
      setPreviewPng(snap);
    }
  };

  const handleGenerate360Gif = async () => {
    if (!engineRef.current || !file) return;
    setIsGeneratingGif(true);
    setErrorMsg(null);
    try {
      const frames = await engineRef.current.capture360Frames(24, 280, 280);
      const { base64 } = await createGifFromFrames(frames, 20);
      setPreviewGif(base64);
    } catch (err: any) {
      setErrorMsg('GIF generation error: ' + (err?.message || err));
    } finally {
      setIsGeneratingGif(false);
    }
  };

  const handleSave = async () => {
    if (!file) {
      setErrorMsg('Please select a 3D or HDR file');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Please enter an asset name');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const newAsset = await libraryManager.addAsset({
        name: name.trim(),
        file,
        sourcePath: (file as any)?.path,
        type: assetType,
        category,
        tags: tagList,
        description,
        previewPngBase64: previewPng || undefined,
        previewGifBase64: previewGif || undefined
      });

      onAssetAdded(newAsset);
      onClose();
    } catch (err: any) {
      setErrorMsg('Failed to save asset: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#202020] border border-[#383838] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-[#2e2e2e] flex items-center justify-between bg-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-adobe-accent/20 text-adobe-accent">
              {assetType === '3d-model' ? <Box className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white">Add Asset to Library</h2>
              <p className="text-[10px] text-[#808080]">Support GLB, GLTF, OBJ, HDR, EXR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white p-1 rounded-md hover:bg-[#282828] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-2.5 bg-red-900/40 border border-red-500/50 rounded-md text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dropzone & 3D Viewport Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Left: 3D Preview Viewport */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-[#aaaaaa]">Interactive 3D Viewport</span>
              <div
                ref={viewportRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="relative aspect-square w-full bg-[#121212] border border-[#333333] rounded-lg overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
              >
                {!file && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <Upload className="w-8 h-8 text-[#555555] mb-2" />
                    <p className="text-xs font-medium text-white mb-1">Drag & Drop 3D or HDR file</p>
                    <p className="text-[10px] text-[#777777]">or click to browse (.glb, .gltf, .obj, .hdr)</p>
                  </div>
                )}
              </div>

              {/* Viewport Action Buttons */}
              {file && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#2a2a2a] hover:bg-[#383838] text-white rounded text-xs transition-colors border border-[#3d3d3d]"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snapshot</span>
                  </button>

                  {assetType === '3d-model' && (
                    <button
                      type="button"
                      onClick={handleGenerate360Gif}
                      disabled={isGeneratingGif}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#2a2a2a] hover:bg-[#383838] text-white rounded text-xs transition-colors border border-[#3d3d3d]"
                    >
                      {isGeneratingGif ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      ) : (
                        <Film className="w-3.5 h-3.5 text-purple-400" />
                      )}
                      <span>{isGeneratingGif ? 'Rendering...' : '360° GIF'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Metadata Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Asset Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cyberpunk Hovercar"
                  className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Type</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as AssetType)}
                    className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="3d-model">3D Model</option>
                    <option value="pbr-material">PBR Material</option>
                    <option value="environment-light">Environment Light (HDR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. SciFi, Metal, Studio"
                    className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="SciFi, Vehicle, Cyberpunk"
                  className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Notes, scale suggestions, materials info..."
                  className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              {/* Preview thumbnails status */}
              <div className="pt-2 border-t border-[#2e2e2e] flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa]">
                  <span className={`w-2 h-2 rounded-full ${previewPng ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>Snapshot: {previewPng ? 'Ready' : 'Pending'}</span>
                </div>
                {(assetType === '3d-model' || assetType === 'pbr-material') && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa]">
                    <span className={`w-2 h-2 rounded-full ${previewGif ? 'bg-emerald-500' : 'bg-[#555555]'}`} />
                    <span>360° GIF: {previewGif ? 'Generated' : 'Optional'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".glb,.gltf,.obj,.hdr,.exr,.png,.jpg,.jpeg,.tif,.tiff"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleSelectedFiles(Array.from(e.target.files));
              }
            }}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-[#2e2e2e] bg-[#1a1a1a] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#aaaaaa] hover:text-white rounded-md hover:bg-[#282828] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!file || isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-adobe-accent hover:bg-adobe-accentHover disabled:opacity-50 disabled:pointer-events-none text-white rounded-md text-xs font-medium shadow transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Saving...' : 'Save to Library'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
