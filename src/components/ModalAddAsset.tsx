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
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreePreviewEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifPromiseRef = useRef<Promise<string | null> | null>(null);

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

  /**
   * Helper to trigger 360 GIF turntable generation
   */
  const triggerAutoGifGeneration = (engine: ThreePreviewEngine, framesCount = 24): Promise<string | null> => {
    setIsGeneratingGif(true);
    const promise = (async () => {
      try {
        await new Promise((r) => setTimeout(r, 150));
        const frames = await engine.capture360Frames(framesCount, 280, 280);
        if (!frames || frames.length === 0) return null;
        const { base64 } = await createGifFromFrames(frames, 12);
        setPreviewGif(base64);
        return base64;
      } catch (err: any) {
        console.warn('Auto GIF generation error:', err);
        return null;
      } finally {
        setIsGeneratingGif(false);
      }
    })();

    gifPromiseRef.current = promise;
    return promise;
  };

  const handleSelectedFiles = async (filesList: File[]) => {
    setErrorMsg(null);
    setPreviewPng(null);
    setPreviewGif(null);
    gifPromiseRef.current = null;

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
                const snap = engineRef.current.captureSnapshot(400, 400);
                setPreviewPng(snap);

                const settings = libraryManager.getSettings();
                if (settings.generateGifByDefault !== false) {
                  triggerAutoGifGeneration(engineRef.current, settings.gifFramesCount || 24);
                }
              }
            }, 350);
          } catch (err: any) {
            setErrorMsg('Не удалось создать превью материала: ' + (err?.message || err));
          }
        }
        return;
      }
    }

    if (!is3D && !isHDR) {
      setErrorMsg('Неподдерживаемый формат. Загрузите .glb, .gltf, .obj, .hdr или текстуры PBR');
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

            // Automatically generate 360 GIF for 3D models
            const settings = libraryManager.getSettings();
            if (is3D && settings.generateGifByDefault !== false) {
              triggerAutoGifGeneration(engineRef.current, settings.gifFramesCount || 24);
            }
          }
        }, 250);
      } catch (err: any) {
        setErrorMsg('Не удалось создать 3D-превью: ' + (err?.message || err));
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
    setErrorMsg(null);
    const settings = libraryManager.getSettings();
    await triggerAutoGifGeneration(engineRef.current, settings.gifFramesCount || 24);
  };

  const handleSave = async () => {
    if (!file) {
      setErrorMsg('Пожалуйста, выберите 3D-файл или карту HDR');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Пожалуйста, введите название ассета');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSavingStatus('Подготовка превью...');

    try {
      // 1. Ensure preview snapshot exists
      let finalPng = previewPng;
      if (!finalPng && engineRef.current) {
        finalPng = engineRef.current.captureSnapshot(400, 400);
        setPreviewPng(finalPng);
      }

      // 2. Ensure 360 GIF exists for 3D models or materials
      let finalGif = previewGif;
      const settings = libraryManager.getSettings();
      if (!finalGif && (assetType === '3d-model' || assetType === 'pbr-material') && settings.generateGifByDefault !== false) {
        setSavingStatus('Создание 360° GIF...');
        if (gifPromiseRef.current) {
          finalGif = (await gifPromiseRef.current) || undefined;
        } else if (engineRef.current) {
          finalGif = (await triggerAutoGifGeneration(engineRef.current, settings.gifFramesCount || 24)) || undefined;
        }
      }

      setSavingStatus('Сохранение в библиотеку...');
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const newAsset = await libraryManager.addAsset({
        name: name.trim(),
        file,
        sourcePath: (file as any)?.path,
        type: assetType,
        category,
        tags: tagList,
        description,
        previewPngBase64: finalPng || undefined,
        previewGifBase64: finalGif || undefined
      });

      onAssetAdded(newAsset);
      onClose();
    } catch (err: any) {
      setErrorMsg('Ошибка сохранения ассета: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
      setSavingStatus(null);
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
              <h2 className="font-semibold text-sm text-white">Добавить ассет в библиотеку</h2>
              <p className="text-[10px] text-[#808080]">Форматы: GLB, GLTF, OBJ, HDR, EXR и PBR-материалы</p>
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
              <span className="text-[11px] font-medium text-[#aaaaaa]">Интерактивный 3D-просмотр</span>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="relative aspect-square w-full bg-[#121212] border border-[#333333] rounded-lg overflow-hidden flex items-center justify-center"
              >
                {/* 3D Canvas Viewport */}
                <div
                  ref={viewportRef}
                  className="w-full h-full cursor-grab active:cursor-grabbing"
                />

                {/* Dropzone Overlay when no file is selected */}
                {!file && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center cursor-pointer bg-black/50 hover:bg-black/40 transition-colors"
                  >
                    <div className="p-3 rounded-full bg-white/5 mb-2.5 border border-white/10">
                      <Upload className="w-6 h-6 text-adobe-accent" />
                    </div>
                    <p className="text-xs font-semibold text-white mb-1">
                      Перетащите сюда 3D-модель или HDR
                    </p>
                    <p className="text-[10px] text-[#aaaaaa] leading-relaxed">
                      или нажмите для выбора файла<br />(.glb, .gltf, .obj, .hdr, .exr)
                    </p>
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
                    <span>Снимок превью</span>
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
                      <span>{isGeneratingGif ? 'Рендеринг...' : '360° GIF'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Metadata Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Название ассета</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="например, Cyberpunk Hovercar"
                  className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Тип</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as AssetType)}
                    className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="3d-model">3D-модель</option>
                    <option value="pbr-material">PBR-материал</option>
                    <option value="environment-light">Окружение / Свет (HDR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Категория</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="например, SciFi, Металл, Студия"
                    className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Теги (через запятую)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="SciFi, Техника, Киберпанк"
                  className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Описание (необязательно)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Заметки, масштаб, рекомендации по материалам..."
                  className="w-full bg-[#161616] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              {/* Preview thumbnails status */}
              <div className="pt-2 border-t border-[#2e2e2e] flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa]">
                  <span className={`w-2 h-2 rounded-full ${previewPng ? 'bg-emerald-500' : (file ? 'bg-amber-500 animate-pulse' : 'bg-[#555555]')}`} />
                  <span>Превью: {previewPng ? 'Готово' : (file ? 'Создание...' : 'Ожидает')}</span>
                </div>
                {(assetType === '3d-model' || assetType === 'pbr-material') && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa]">
                    <span className={`w-2 h-2 rounded-full ${previewGif ? 'bg-emerald-500' : (isGeneratingGif ? 'bg-purple-400 animate-pulse' : 'bg-amber-500')}`} />
                    <span>360° GIF: {previewGif ? 'Готов' : (isGeneratingGif ? 'Рендеринг...' : 'Создается автоматически')}</span>
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
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!file || isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-adobe-accent hover:bg-adobe-accentHover disabled:opacity-50 disabled:pointer-events-none text-white rounded-md text-xs font-medium shadow transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>{isSaving ? (savingStatus || 'Сохранение...') : 'Сохранить в библиотеку'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
