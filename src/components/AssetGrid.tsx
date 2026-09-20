import React from 'react';
import { AssetCard } from './AssetCard';
import { AssetItem } from '../types';
import { FolderSearch, Plus } from 'lucide-react';

interface AssetGridProps {
  assets: AssetItem[];
  isLoading: boolean;
  onImportAsset: (asset: AssetItem) => Promise<void>;
  onOpenPreview: (asset: AssetItem) => void;
  onOpenAddModal: () => void;
  onEditAsset?: (asset: AssetItem) => void;
  onRevealAsset?: (asset: AssetItem) => void;
  importingAssetId: string | null;
}

export const AssetGrid: React.FC<AssetGridProps> = ({
  assets,
  isLoading,
  onImportAsset,
  onOpenPreview,
  onOpenAddModal,
  onEditAsset,
  onRevealAsset,
  importingAssetId
}) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-adobe-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-adobe-muted">Scanning library assets...</p>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#222222] flex items-center justify-center border border-[#333333]">
            <FolderSearch className="w-7 h-7 text-[#666666]" />
          </div>
          <h3 className="font-semibold text-sm text-white">No assets found</h3>
          <p className="text-xs text-[#888888]">
            No 3D models or environment maps match your current search or category filter.
          </p>
          <button
            onClick={onOpenAddModal}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New 3D / HDR Asset</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onImport={onImportAsset}
            onOpenPreview={onOpenPreview}
            onEdit={onEditAsset}
            onReveal={onRevealAsset}
            isImporting={importingAssetId === asset.id}
          />
        ))}
      </div>
    </div>
  );
};
