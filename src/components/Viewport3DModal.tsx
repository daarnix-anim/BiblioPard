import React, { useEffect, useRef, useState } from 'react';
import { X, Grid, Download, Loader2, Maximize2, Sun, Box, Info, Palette, Edit3 } from 'lucide-react';
import { AssetItem } from '../types';
import { ThreePreviewEngine } from '../services/threePreview';
import { getNodeFs } from '../services/nodeBridge';

interface Viewport3DModalProps {
  asset: AssetItem | null;
  isOpen: boolean;
  onClose: () => void;
  onImport: (asset: AssetItem) => Promise<void>;
  onEdit?: (asset: AssetItem) => void;
  isImporting: boolean;
}

export const Viewport3DModal: React.FC<Viewport3DModalProps> = ({
  asset,
  isOpen,
  onClose,
  onImport,
  onEdit,
  isImporting
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ThreePreviewEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !asset || !containerRef.current) return;

    setIsLoading(true);
    setLoadError(null);

    // Create engine
    const engine = new ThreePreviewEngine(containerRef.current);
    engineRef.current = engine;

    const loadAsset = async () => {
      try {
        let fileSource: string | ArrayBuffer = asset.filePath;

        // In CEP with Node.js, we can read local file as Buffer if needed
        try {
          const fs = getNodeFs();
          if (fs) {
            const raw = asset.filePath.replace(/^file:\/\/\/?/i, '');
            const win = raw.replace(/\//g, '\\');
            let target = fs.existsSync(raw) ? raw : (fs.existsSync(win) ? win : null);

            // Auto-fallback: if path has legacy C:/BiblioPard/Library, try resolving against user's configured libraryRoot
            if (!target && /^[cC]:[/\\]BiblioPard[/\\]Library/i.test(raw)) {
              try {
                const saved = localStorage.getItem('bibliopard_settings');
                const settings = saved ? JSON.parse(saved) : null;
                if (settings && settings.libraryRoot) {
                  const migrated = raw.replace(/^[cC]:[/\\]BiblioPard[/\\]Library/i, settings.libraryRoot);
                  const migratedWin = migrated.replace(/\//g, '\\');
                  target = fs.existsSync(migrated) ? migrated : (fs.existsSync(migratedWin) ? migratedWin : null);
                }
              } catch {}
            }

            if (target) {
              const buffer = fs.readFileSync(target);
              fileSource = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            }
          }
        } catch (e) {
          console.warn('Direct file read fallback:', e);
        }

        if (asset.type === '3d-model') {
          await engine.loadModel(fileSource, asset.format);
        } else if (asset.type === 'environment-light') {
          await engine.loadHDR(fileSource);
        } else if (asset.type === 'pbr-material') {
          await engine.loadMaterial(asset.materialMaps || {});
        }
      } catch (err: any) {
        setLoadError('Failed to load 3D asset in viewport: ' + (err?.message || err));
      } finally {
        setIsLoading(false);
      }
    };

    loadAsset();

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const toggleGrid = () => {
    const next = !gridVisible;
    setGridVisible(next);
    engineRef.current?.setGridVisible(next);
  };

  const setBackground = (color: string) => {
    engineRef.current?.setBackgroundColor(color);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1c1c1e] border border-[#383838] rounded-xl w-full max-w-4xl h-[80vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-4 py-3 border-b border-[#2e2e2e] bg-[#161616] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded ${
              asset.type === '3d-model' ? 'bg-teal-500/20 text-teal-400' :
              asset.type === 'pbr-material' ? 'bg-indigo-500/20 text-indigo-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              {asset.type === '3d-model' ? <Box className="w-4 h-4" /> :
               asset.type === 'pbr-material' ? <Palette className="w-4 h-4" /> :
               <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white">{asset.name}</h2>
              <div className="flex items-center gap-2 text-[10px] text-[#888888]">
                <span>Format: .{asset.format.toUpperCase()}</span>
                <span>•</span>
                <span>Category: {asset.category}</span>
                {asset.materialMaps && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-300">
                      Maps: {Object.keys(asset.materialMaps).join(', ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Grid Toggle */}
            <button
              onClick={toggleGrid}
              title="Toggle Ground Grid"
              className={`p-1.5 rounded transition-colors ${
                gridVisible ? 'bg-adobe-accent text-white' : 'bg-[#282828] text-[#888888] hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>

            {/* Background Selector */}
            <div className="flex items-center gap-1 bg-[#252525] p-1 rounded">
              <button
                onClick={() => setBackground('#141414')}
                title="Dark BG"
                className="w-3.5 h-3.5 rounded-full bg-[#141414] border border-[#444444]"
              />
              <button
                onClick={() => setBackground('#2a2a2e')}
                title="Studio Grey BG"
                className="w-3.5 h-3.5 rounded-full bg-[#2a2a2e] border border-[#444444]"
              />
              <button
                onClick={() => setBackground('#404040')}
                title="Light Grey BG"
                className="w-3.5 h-3.5 rounded-full bg-[#404040] border border-[#444444]"
              />
            </div>

            {/* Edit Asset Button */}
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(asset);
                }}
                title="Edit Asset Details, Update from AE, or Delete"
                className="text-[#888888] hover:text-white p-1.5 rounded hover:bg-[#282828] transition-colors ml-1"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-[#888888] hover:text-white p-1.5 rounded hover:bg-[#282828] transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="flex-1 relative bg-[#121212] overflow-hidden">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 gap-3">
              <Loader2 className="w-8 h-8 text-adobe-accent animate-spin" />
              <p className="text-xs text-adobe-muted">Rendering 3D viewport...</p>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="max-w-md p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-xs">
                {loadError}
              </div>
            </div>
          )}

          {/* Quick HUD hints */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded text-[10px] text-[#888888] border border-white/10 pointer-events-none">
            Left Click: Orbit • Right Click: Pan • Scroll: Zoom
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-[#2e2e2e] bg-[#161616] flex items-center justify-between">
          <div className="text-xs text-[#888888] truncate max-w-md">
            {asset.description || 'No description provided.'}
          </div>

          <button
            onClick={() => onImport(asset)}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded-md text-xs font-semibold shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Import to After Effects</span>
          </button>
        </div>
      </div>
    </div>
  );
};
