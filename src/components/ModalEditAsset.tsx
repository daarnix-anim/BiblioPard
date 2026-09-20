import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Trash2, AlertTriangle, FileCode, Check, Loader2, FolderOpen } from 'lucide-react';
import { AssetItem, ProjectItem } from '../types';
import { hostBridge } from '../services/hostBridge';
import { libraryManager } from '../services/libraryManager';

interface ModalEditAssetProps {
  asset: AssetItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAssetUpdated: (updatedAsset: AssetItem) => void;
  onAssetDeleted: (deletedId: string) => void;
}

export const ModalEditAsset: React.FC<ModalEditAssetProps> = ({
  asset,
  isOpen,
  onClose,
  onAssetUpdated,
  onAssetDeleted
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  // AE replacement state
  const [aeSelection, setAeSelection] = useState<ProjectItem | null>(null);
  const [isCheckingAe, setIsCheckingAe] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (asset && isOpen) {
      setName(asset.name);
      setCategory(asset.category);
      setTags(asset.tags ? asset.tags.join(', ') : '');
      setDescription(asset.description || '');
      setConfirmDelete(false);
      setMsg(null);
      checkAeSelection();
    }
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  const checkAeSelection = async () => {
    setIsCheckingAe(true);
    try {
      const items = await hostBridge.getSelectedProjectItems();
      if (items && items.length > 0 && items[0].filePath) {
        setAeSelection(items[0]);
      } else {
        setAeSelection(null);
      }
    } catch {
      setAeSelection(null);
    } finally {
      setIsCheckingAe(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!name.trim()) {
      setMsg({ text: 'Asset name cannot be empty', type: 'error' });
      return;
    }

    setIsSaving(true);
    setMsg(null);

    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      const updated = await libraryManager.updateAssetMetadata(asset, {
        name: name.trim(),
        category: category.trim() || 'General',
        tags: tagList,
        description: description.trim()
      });

      onAssetUpdated(updated);
      setMsg({ text: 'Metadata updated successfully!', type: 'success' });
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setMsg({ text: 'Failed to update metadata: ' + (err?.message || err), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceFromAe = async () => {
    if (!aeSelection || !aeSelection.filePath) return;

    setIsReplacing(true);
    setMsg(null);

    try {
      const updated = await libraryManager.replaceAssetFile(asset, aeSelection.filePath);
      onAssetUpdated(updated);
      setMsg({
        text: `Asset file replaced with "${aeSelection.name}"!`,
        type: 'success'
      });
    } catch (err: any) {
      setMsg({ text: 'Failed to replace file: ' + (err?.message || err), type: 'error' });
    } finally {
      setIsReplacing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await libraryManager.deleteAsset(asset);
      onAssetDeleted(asset.id);
      onClose();
    } catch (err: any) {
      setMsg({ text: 'Failed to delete asset: ' + (err?.message || err), type: 'error' });
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#383838] rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2e2e2e] bg-[#161616] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-white">Edit Asset Details</h2>
            <p className="text-[10px] text-[#808080]">Format: .{asset.format.toUpperCase()} • ID: {asset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white p-1 rounded hover:bg-[#282828] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs overflow-y-auto max-h-[75vh]">
          {msg && (
            <div className={`p-2.5 rounded text-xs flex items-center gap-2 ${
              msg.type === 'success' ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300' : 'bg-red-950/60 border border-red-500/50 text-red-300'
            }`}>
              {msg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* File Location Info */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] text-[#777777] uppercase font-mono tracking-wider">File Location</span>
              <span className="block text-[11px] text-[#cccccc] font-mono truncate" title={asset.filePath}>
                {asset.filePath}
              </span>
            </div>
            <button
              type="button"
              onClick={() => hostBridge.revealInExplorer(asset.filePath)}
              title="Show in File Explorer"
              className="p-1.5 bg-[#252525] hover:bg-[#333333] text-[#aaaaaa] hover:text-white rounded text-xs transition-colors shrink-0 border border-[#3a3a3a]"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Form Fields */}
          <div>
            <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Asset Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#141414] border border-[#333333] focus:border-adobe-accent rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#141414] border border-[#333333] focus:border-adobe-accent rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-[#141414] border border-[#333333] focus:border-adobe-accent rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add notes, scale, shaders info..."
              className="w-full bg-[#141414] border border-[#333333] focus:border-adobe-accent rounded px-2.5 py-1.5 text-xs text-white focus:outline-none resize-none"
            />
          </div>

          {/* Update from AE Section */}
          <div className="pt-3 border-t border-[#2d2d2d]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-[#cccccc]">Update File from After Effects</span>
              <button
                type="button"
                onClick={checkAeSelection}
                disabled={isCheckingAe}
                className="text-[10px] text-adobe-accent hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingAe ? 'animate-spin' : ''}`} />
                <span>Check AE Selection</span>
              </button>
            </div>

            <div className="p-2.5 bg-[#141414] border border-[#2d2d2d] rounded-lg">
              {aeSelection ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="text-white font-medium block truncate">{aeSelection.name}</span>
                    <span className="text-[10px] text-[#737373] block truncate">{aeSelection.filePath}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReplaceFromAe}
                    disabled={isReplacing}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-medium transition-all shadow-sm"
                  >
                    {isReplacing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    <span>Replace File</span>
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-[#737373]">
                  Select an item in After Effects Project panel to update this asset with a newer version.
                </p>
              )}
            </div>
          </div>

          {/* Danger Zone: Delete Asset */}
          <div className="pt-3 border-t border-[#2d2d2d] flex items-center justify-between">
            <div>
              <span className="text-red-400 font-medium block">Delete from Library</span>
              <span className="text-[10px] text-[#737373]">Removes files and folder from disk</span>
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-700 text-white font-bold'
                  : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>{confirmDelete ? 'Confirm Delete?' : 'Delete'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2e2e2e] bg-[#161616] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#aaaaaa] hover:text-white rounded hover:bg-[#282828] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveMetadata}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded text-xs font-medium shadow transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
