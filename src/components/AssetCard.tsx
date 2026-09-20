import React, { useState } from 'react';
import { Box, Sun, Film, Type, Eye, Download, Sparkles, Palette } from 'lucide-react';
import { AssetItem } from '../types';

interface AssetCardProps {
  asset: AssetItem;
  onImport: (asset: AssetItem) => Promise<void>;
  onOpenPreview: (asset: AssetItem) => void;
  isImporting: boolean;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  onImport,
  onOpenPreview,
  isImporting
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getTypeBadge = () => {
    if (asset.type === '3d-model') {
      return (
        <span className="flex items-center gap-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded">
          <Box className="w-2.5 h-2.5" /> 3D Model
        </span>
      );
    }
    if (asset.type === 'pbr-material') {
      return (
        <span className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded">
          <Palette className="w-2.5 h-2.5" /> PBR Material
        </span>
      );
    }
    if (asset.type === 'environment-light') {
      return (
        <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded">
          <Sun className="w-2.5 h-2.5" /> Env Light
        </span>
      );
    }
    if (asset.type === 'video-alpha') {
      return (
        <span className="flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded">
          <Film className="w-2.5 h-2.5" /> Alpha Video
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] font-semibold px-1.5 py-0.5 rounded">
        <Type className="w-2.5 h-2.5" /> Title / MOGRT
      </span>
    );
  };

  // Determine current preview source (GIF on hover if available)
  const currentPreview = isHovered && asset.previewGif ? asset.previewGif : asset.previewImage;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group bg-[#222222] border border-[#333333] hover:border-[#4f4f4f] rounded-lg overflow-hidden flex flex-col asset-card shadow-sm hover:shadow-lg transition-all"
    >
      {/* Thumbnail Area - Crisp, No Blur, Full Details */}
      <div className="relative aspect-[4/3] bg-[#141414] overflow-hidden flex items-center justify-center">
        {currentPreview && !imgError ? (
          <img
            src={currentPreview}
            alt={asset.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-200"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-[#555555] gap-2 p-4">
            {asset.type === '3d-model' ? (
              <Box className="w-12 h-12 text-[#3a3a3a] group-hover:text-adobe-teal transition-colors" />
            ) : asset.type === 'pbr-material' ? (
              <Palette className="w-12 h-12 text-[#3a3a3a] group-hover:text-indigo-400 transition-colors" />
            ) : (
              <Sun className="w-12 h-12 text-[#3a3a3a] group-hover:text-adobe-gold transition-colors" />
            )}
            <span className="text-[10px] text-[#666666] tracking-wider uppercase font-mono">
              .{asset.format}
            </span>
          </div>
        )}

        {/* Badges on Top */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
          {getTypeBadge()}
          <span className="bg-black/70 backdrop-blur-sm text-white text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-white/10">
            {asset.format}
          </span>
        </div>

        {/* 360 GIF indicator badge */}
        {asset.previewGif && (
          <div className="absolute top-2 right-2 bg-purple-900/80 border border-purple-500/40 text-purple-200 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10 pointer-events-none">
            <Sparkles className="w-2.5 h-2.5" /> 360°
          </div>
        )}

        {/* Corner 3D View Button (appears on hover without obscuring the model) */}
        {(asset.type === '3d-model' || asset.type === 'environment-light' || asset.type === 'pbr-material') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPreview(asset);
            }}
            title="Open Interactive 3D View"
            className={`absolute bottom-2 right-2 p-1.5 bg-[#181818]/90 hover:bg-[#2c2c2c] text-white rounded-md transition-opacity duration-150 border border-white/15 shadow-md ${
              isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Info & Bottom Action Area */}
      <div className="p-2.5 flex-1 flex flex-col justify-between bg-[#1e1e1e]">
        <div>
          <h3 className="font-semibold text-xs text-white truncate mb-0.5" title={asset.name}>
            {asset.name}
          </h3>
          <div className="flex items-center justify-between text-[10px] text-[#808080]">
            <span>{asset.category}</span>
            <span>{formatFileSize(asset.fileSize)}</span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {asset.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] bg-[#141414] text-[#888888] px-1.5 py-0.2 rounded border border-[#2e2e2e]"
              >
                #{tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[9px] text-[#666666]">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Import Bar - Clearly visible at the bottom of the card */}
        <div className="mt-2.5 pt-2 border-t border-[#2d2d2d] flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#737373] font-mono uppercase truncate">
            {asset.format}
          </span>

          <button
            onClick={() => onImport(asset)}
            disabled={isImporting}
            title="Import to After Effects"
            className="flex items-center gap-1.5 px-3 py-1 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded text-xs font-medium shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Importing...' : 'Import'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
