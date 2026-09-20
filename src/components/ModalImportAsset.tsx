import React, { useState, useEffect } from 'react';
import { 
  X, 
  Layers, 
  FolderDown, 
  Maximize2, 
  Box, 
  Tv, 
  RotateCcw, 
  Check, 
  Sliders, 
  ArrowRight, 
  Loader2,
  Plus,
  Minus,
  Info,
  Sparkles,
  Sun
} from 'lucide-react';
import { AssetItem, ImportTarget, ScaleMode, ImportPromptMode } from '../types';
import { modelDimensionService, ModelDimensions } from '../services/modelDimensionService';

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

interface ModalImportAssetProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetItem | null;
  activeCompInfo: {
    hasActiveComp: boolean;
    name?: string;
    width?: number;
    height?: number;
  } | null;
  defaultSettings: {
    defaultImportTarget: ImportPromptMode;
    default3DScaleMode: ScaleMode;
    defaultMediaScaleMode: ScaleMode;
    autoCenterInComp: boolean;
  };
  onConfirmImport: (options: {
    target: ImportTarget;
    scaleMode: ScaleMode;
    scaleValue?: number;
    scaleMultiplier?: number;
    modelDimensions?: { width: number; height: number; depth: number };
    autoCenter: boolean;
    rememberPreference?: boolean;
    saveAssetScale?: boolean;
  }) => Promise<void>;
}

export const ModalImportAsset: React.FC<ModalImportAssetProps> = ({
  isOpen,
  onClose,
  asset,
  activeCompInfo,
  defaultSettings,
  onConfirmImport
}) => {
  const [target, setTarget] = useState<ImportTarget>('comp');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit-comp');
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(1);
  const [customScaleInput, setCustomScaleInput] = useState<string>('1');
  const [modelDimensions, setModelDimensions] = useState<ModelDimensions | null>(null);
  const [isLoadingDims, setIsLoadingDims] = useState<boolean>(false);
  const [autoCenter, setAutoCenter] = useState<boolean>(true);
  const [saveAssetScale, setSaveAssetScale] = useState<boolean>(false);
  const [rememberPreference, setRememberPreference] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const hasComp = !!activeCompInfo?.hasActiveComp;
  const is3D = asset?.type === '3d-model';
  const isEnv = asset?.type === 'environment-light';
  const compW = activeCompInfo?.width || 1920;
  const compH = activeCompInfo?.height || 1080;

  // Calculate standard scale multiplier for a given mode and dimensions
  const calculateMultiplierForMode = (
    mode: ScaleMode, 
    dims: ModelDimensions | null
  ): number => {
    if (is3D && dims && dims.width > 0.0001 && dims.height > 0.0001) {
      const fitW = compW / dims.width;
      const fitH = compH / dims.height;

      switch (mode) {
        case 'fit-width':
          return Math.round(fitW * 10) / 10;
        case 'fit-height':
          return Math.round(fitH * 10) / 10;
        case 'fit-comp':
          return Math.round(Math.min(fitW, fitH) * 0.85 * 10) / 10;
        case 'fit-fullhd': {
          const fhdW = 1920 / dims.width;
          const fhdH = 1080 / dims.height;
          return Math.round(Math.min(fhdW, fhdH) * 0.85 * 10) / 10;
        }
        case 'original':
          return 1;
        default:
          return 1;
      }
    } else {
      // 2D media or fallback
      switch (mode) {
        case 'fit-width':
          return 1;
        case 'fit-height':
          return 1;
        case 'fit-comp':
        case 'fit-fullhd':
          return 1;
        case 'original':
        default:
          return 1;
      }
    }
  };

  // Initialize defaults and load dimensions when modal opens
  useEffect(() => {
    if (isOpen && asset) {
      const hasActive = !!activeCompInfo?.hasActiveComp;
      if (!hasActive || defaultSettings.defaultImportTarget === 'always-project') {
        setTarget('project');
      } else {
        setTarget('comp');
      }

      const initialMode = is3D 
        ? (defaultSettings.default3DScaleMode || 'fit-comp')
        : (defaultSettings.defaultMediaScaleMode || 'fit-comp');

      setScaleMode(initialMode);
      setAutoCenter(defaultSettings.autoCenterInComp ?? true);
      setRememberPreference(false);
      setSaveAssetScale(false);
      setIsSubmitting(false);

      // Check if asset has a saved scale in metadata
      if (asset.scale && asset.scale > 0) {
        setScaleMultiplier(asset.scale);
        setCustomScaleInput(String(asset.scale));
      }

      if (is3D) {
        setIsLoadingDims(true);
        modelDimensionService.getDimensions(asset.filePath)
          .then((dims) => {
            setModelDimensions(dims);
            setIsLoadingDims(false);

            if (dims && (!asset.scale || asset.scale <= 0)) {
              const computed = calculateMultiplierForMode(initialMode, dims);
              setScaleMultiplier(computed);
              setCustomScaleInput(String(computed));
            }
          })
          .catch((err) => {
            console.warn('[ModalImportAsset] Dimension load error:', err);
            setIsLoadingDims(false);
          });
      } else {
        setModelDimensions(null);
        if (!asset.scale) {
          setScaleMultiplier(1);
          setCustomScaleInput('1');
        }
      }
    }
  }, [isOpen, asset, activeCompInfo, defaultSettings]);

  if (!isOpen || !asset) return null;

  // Handle clicking one of the predefined scale modes
  const handleSelectMode = (mode: ScaleMode) => {
    setScaleMode(mode);
    const mult = calculateMultiplierForMode(mode, modelDimensions);
    setScaleMultiplier(mult);
    setCustomScaleInput(String(mult));
  };

  // Handle direct manual input of scale multiplier number
  const handleMultiplierChange = (valStr: string) => {
    setCustomScaleInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num > 0) {
      setScaleMultiplier(num);
      setScaleMode('custom');
    }
  };

  // Step adjustments (+10%, -10%, x2, /2)
  const handleStepMultiplier = (factor: number) => {
    const next = Math.max(0.01, Math.round(scaleMultiplier * factor * 100) / 100);
    setScaleMultiplier(next);
    setCustomScaleInput(String(next));
    setScaleMode('custom');
  };

  // Preset quick chips (1x, 10x, 50x, 100x, 500x, 1000x)
  const handlePresetSelect = (val: number) => {
    setScaleMultiplier(val);
    setCustomScaleInput(String(val));
    setScaleMode('custom');
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const finalScaleValue = Math.round(scaleMultiplier * 100 * 10) / 10;

      await onConfirmImport({
        target,
        scaleMode,
        scaleValue: finalScaleValue,
        scaleMultiplier,
        modelDimensions: modelDimensions ? {
          width: modelDimensions.width,
          height: modelDimensions.height,
          depth: modelDimensions.depth
        } : undefined,
        autoCenter,
        rememberPreference,
        saveAssetScale
      });
      onClose();
    } catch (e) {
      console.error('Import confirmation error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estimated pixel dimensions in comp for 3D model
  const estimatedWidth = modelDimensions 
    ? Math.round(modelDimensions.width * scaleMultiplier) 
    : null;
  const estimatedHeight = modelDimensions 
    ? Math.round(modelDimensions.height * scaleMultiplier) 
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#1a1a1a] border border-[#2f2f2f] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#e0e0e0] select-none max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#222222] border-b border-[#2e2e2e] shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-adobe-accent" />
            <h2 className="text-sm font-semibold text-white">Параметры импорта</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white p-1 rounded-md hover:bg-[#333333] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {/* Asset Summary Card */}
          <div className="flex items-center gap-3 p-3 bg-[#222222]/70 border border-[#2e2e2e] rounded-lg">
            <div className="w-10 h-10 rounded-md bg-[#2d2d2d] border border-[#3d3d3d] flex items-center justify-center overflow-hidden shrink-0">
              {(asset.previewGif || asset.previewImage) ? (
                <img src={asset.previewGif || asset.previewImage} alt="" className="w-full h-full object-cover" />
              ) : is3D ? (
                <Box className="w-5 h-5 text-teal-400" />
              ) : isEnv ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Layers className="w-5 h-5 text-adobe-accent" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-xs truncate">{asset.name}</h3>
              <div className="flex items-center gap-2 text-[10px] text-[#888888] mt-0.5">
                <span className="uppercase px-1.5 py-0.5 bg-[#181818] rounded text-[9px] font-mono border border-[#333333]">
                  {asset.format || 'Asset'}
                </span>
                <span>{formatFileSize(asset.fileSize || 0)}</span>
                {is3D && modelDimensions && (
                  <span className="text-teal-400/90 font-mono">
                    3D: {modelDimensions.width.toFixed(2)} × {modelDimensions.height.toFixed(2)} ед.
                  </span>
                )}
                {is3D && isLoadingDims && (
                  <span className="flex items-center gap-1 text-[#a0a0a0]">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> расчёт сетки...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Import Destination Target */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
              Куда импортировать
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTarget('comp')}
                disabled={!hasComp}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  target === 'comp'
                    ? 'bg-adobe-accent/15 border-adobe-accent text-white shadow-sm'
                    : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                } ${!hasComp ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-adobe-accent" />
                    В композицию
                  </span>
                  {target === 'comp' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
                </div>
                <span className="text-[10px] text-[#737373] leading-tight">
                  {hasComp ? `«${activeCompInfo?.name}» (${compW}×${compH})` : 'Нет активной композиции'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('project')}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  target === 'project'
                    ? 'bg-adobe-accent/15 border-adobe-accent text-white shadow-sm'
                    : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs flex items-center gap-1.5">
                    <FolderDown className="w-3.5 h-3.5 text-[#888888]" />
                    Только в проект
                  </span>
                  {target === 'project' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
                </div>
                <span className="text-[10px] text-[#737373] leading-tight">
                  В панель Project без добавления на таймлайн
                </span>
              </button>
            </div>
          </div>

          {/* Environment Light Setup Notice (for HDR / EXR) */}
          {target === 'comp' && hasComp && isEnv && (
            <div className="space-y-2 pt-2 border-t border-[#262626]">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                  <Sun className="w-4 h-4" />
                  <span>Свет окружения (Environment Light)</span>
                </div>
                <p className="text-[11px] text-[#b8b8b8] leading-relaxed">
                  При импорте в активную композицию:
                </p>
                <ul className="text-[11px] text-[#9e9e9e] space-y-1 pl-3.5 list-disc">
                  <li>Создаётся слой <b>«Env Light: {asset.name}»</b> со светом окружения.</li>
                  <li>Файл карты HDR добавляется на таймлайн в <b>выключенном виде</b> (глаз отключен) в самом низу слоёв.</li>
                  <li>В настройках света (Source) файл HDR <b>сразу автоматически привязывается</b> в качестве источника освещения.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Scale Mode & Factor Controls (only for 3D models and media, if target is comp) */}
          {target === 'comp' && hasComp && !isEnv && (
            <div className="space-y-3 pt-2 border-t border-[#262626]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
                  Масштабирование {is3D ? '3D-модели в кадре' : 'медиа'}
                </label>
                {is3D && (
                  <span className="text-[10px] text-adobe-accent font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Равномерно по X, Y, Z
                  </span>
                )}
              </div>

              {/* Quick Fitting Presets */}
              <div className="grid grid-cols-2 gap-1.5">
                {/* Fit Comp */}
                <button
                  type="button"
                  onClick={() => handleSelectMode('fit-comp')}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    scaleMode === 'fit-comp'
                      ? 'bg-adobe-accent/20 border-adobe-accent text-white font-medium'
                      : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Maximize2 className={`w-3.5 h-3.5 ${scaleMode === 'fit-comp' ? 'text-adobe-accent' : 'text-[#777777]'}`} />
                    <div>
                      <span className="text-xs block">Вписать в кадр</span>
                      <span className="text-[9px] text-[#737373]">С полями (85%)</span>
                    </div>
                  </div>
                  {scaleMode === 'fit-comp' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
                </button>

                {/* Full HD 1080p */}
                <button
                  type="button"
                  onClick={() => handleSelectMode('fit-fullhd')}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    scaleMode === 'fit-fullhd'
                      ? 'bg-adobe-accent/20 border-adobe-accent text-white font-medium'
                      : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Tv className={`w-3.5 h-3.5 ${scaleMode === 'fit-fullhd' ? 'text-adobe-accent' : 'text-[#777777]'}`} />
                    <div>
                      <span className="text-xs block">Стандарт Full HD</span>
                      <span className="text-[9px] text-[#737373]">Базовый 1920×1080</span>
                    </div>
                  </div>
                  {scaleMode === 'fit-fullhd' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
                </button>

                {/* Fit Width */}
                <button
                  type="button"
                  onClick={() => handleSelectMode('fit-width')}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    scaleMode === 'fit-width'
                      ? 'bg-adobe-accent/20 border-adobe-accent text-white font-medium'
                      : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 flex items-center justify-center font-mono text-[10px] text-adobe-accent font-bold">W</span>
                    <div>
                      <span className="text-xs block">По ширине кадра</span>
                      <span className="text-[9px] text-[#737373]">{compW} px</span>
                    </div>
                  </div>
                  {scaleMode === 'fit-width' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
                </button>

                {/* Fit Height */}
                <button
                  type="button"
                  onClick={() => handleSelectMode('fit-height')}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    scaleMode === 'fit-height'
                      ? 'bg-adobe-accent/20 border-adobe-accent text-white font-medium'
                      : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 flex items-center justify-center font-mono text-[10px] text-adobe-accent font-bold">H</span>
                    <div>
                      <span className="text-xs block">По высоте кадра</span>
                      <span className="text-[9px] text-[#737373]">{compH} px</span>
                    </div>
                  </div>
                  {scaleMode === 'fit-height' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
                </button>
              </div>

              {/* Original 100% Option */}
              <button
                type="button"
                onClick={() => handleSelectMode('original')}
                className={`w-full p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                  scaleMode === 'original'
                    ? 'bg-adobe-accent/20 border-adobe-accent text-white font-medium'
                    : 'bg-[#181818] border-[#2c2c2c] text-[#a0a0a0] hover:bg-[#222222] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className={`w-3.5 h-3.5 ${scaleMode === 'original' ? 'text-adobe-accent' : 'text-[#777777]'}`} />
                  <div>
                    <span className="text-xs block">Оригинальный масштаб файла (1x / 100%)</span>
                    <span className="text-[9px] text-[#737373]">Без подгонки под габариты композиции</span>
                  </div>
                </div>
                {scaleMode === 'original' && <Check className="w-3.5 h-3.5 text-adobe-accent" />}
              </button>

              {/* Interactive Numeric Scale Factor Input (Как в окне импорта GLB After Effects) */}
              <div className="p-3 bg-[#1e1e1e] border border-[#333333] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#cccccc] flex items-center gap-1.5">
                    Число масштабирования (множитель)
                  </span>
                  <span className="text-[10px] font-mono text-adobe-accent">
                    {Math.round(scaleMultiplier * 100).toLocaleString('ru-RU')}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Stepper Down */}
                  <div className="flex items-center bg-[#282828] border border-[#3a3a3a] rounded-md overflow-hidden">
                    <button
                      type="button"
                      title="Уменьшить в 2 раза"
                      onClick={() => handleStepMultiplier(0.5)}
                      className="px-2 py-1 text-[10px] font-mono hover:bg-[#383838] text-[#cccccc] border-r border-[#3a3a3a]"
                    >
                      /2
                    </button>
                    <button
                      type="button"
                      title="Уменьшить на 10%"
                      onClick={() => handleStepMultiplier(0.9)}
                      className="p-1.5 hover:bg-[#383838] text-[#cccccc]"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Direct Number Input */}
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={customScaleInput}
                      onChange={(e) => handleMultiplierChange(e.target.value)}
                      placeholder="Множитель масштаба"
                      className="w-full px-2.5 py-1.5 bg-[#141414] border border-[#383838] focus:border-adobe-accent rounded-md text-xs font-mono text-white text-right pr-6 outline-none transition-colors"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#777777] font-mono pointer-events-none">
                      ×
                    </span>
                  </div>

                  {/* Stepper Up */}
                  <div className="flex items-center bg-[#282828] border border-[#3a3a3a] rounded-md overflow-hidden">
                    <button
                      type="button"
                      title="Увеличить на 10%"
                      onClick={() => handleStepMultiplier(1.1)}
                      className="p-1.5 hover:bg-[#383838] text-[#cccccc] border-r border-[#3a3a3a]"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="Увеличить в 2 раза"
                      onClick={() => handleStepMultiplier(2)}
                      className="px-2 py-1 text-[10px] font-mono hover:bg-[#383838] text-[#cccccc]"
                    >
                      ×2
                    </button>
                  </div>
                </div>

                {/* Quick Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-[#666666] mr-1">Быстро:</span>
                  {[1, 5, 10, 50, 100, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePresetSelect(val)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                        Math.abs(scaleMultiplier - val) < 0.01 && scaleMode === 'custom'
                          ? 'bg-adobe-accent/30 border-adobe-accent text-white font-bold'
                          : 'bg-[#252525] border-[#333333] text-[#999999] hover:text-white hover:bg-[#303030]'
                      }`}
                    >
                      {val}×
                    </button>
                  ))}
                </div>

                {/* Real-time size prediction info */}
                {estimatedWidth !== null && estimatedHeight !== null && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#2a2a2a] text-[10px] text-[#888888]">
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3 text-[#666666]" />
                      Размер в кадре:
                    </span>
                    <span className="font-mono text-emerald-400">
                      ~{estimatedWidth} × {estimatedHeight} px
                    </span>
                  </div>
                )}
              </div>

              {/* Asset Specific Scale Memory Checkbox */}
              <label className="flex items-center justify-between cursor-pointer pt-1 group">
                <span className="text-xs text-[#b0b0b0] group-hover:text-white transition-colors">
                  Сохранить масштаб ({scaleMultiplier}×) для этого ассета
                </span>
                <input
                  type="checkbox"
                  checked={saveAssetScale}
                  onChange={(e) => setSaveAssetScale(e.target.checked)}
                  className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
                />
              </label>

              {/* Auto Center Toggle */}
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-[#b0b0b0] group-hover:text-white transition-colors">
                  Отцентрировать в активной композиции
                </span>
                <input
                  type="checkbox"
                  checked={autoCenter}
                  onChange={(e) => setAutoCenter(e.target.checked)}
                  className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* Remember Global Preference Checkbox */}
          <div className="pt-2 border-t border-[#262626]">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberPreference}
                onChange={(e) => setRememberPreference(e.target.checked)}
                className="w-3.5 h-3.5 accent-adobe-accent rounded cursor-pointer"
              />
              <span className="text-[11px] text-[#888888] group-hover:text-[#cccccc] transition-colors">
                Запомнить режим по умолчанию в настройках
              </span>
            </label>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#222222] border-t border-[#2e2e2e] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs text-[#cccccc] hover:text-white hover:bg-[#2f2f2f] rounded-md transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded-md text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Импорт...</span>
              </>
            ) : (
              <>
                <span>Импортировать</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
