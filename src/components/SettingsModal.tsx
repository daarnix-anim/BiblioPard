import React, { useState } from 'react';
import { X, Folder, Check, HardDrive, Cpu } from 'lucide-react';
import { LibrarySettings, HostInfo } from '../types';
import { libraryManager } from '../services/libraryManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
  hostInfo: HostInfo | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
  hostInfo
}) => {
  const [settings, setSettings] = useState<LibrarySettings>(() => libraryManager.getSettings());

  if (!isOpen) return null;

  const handleSave = () => {
    libraryManager.saveSettings(settings);
    onSettingsSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#202020] border border-[#383838] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2e2e2e] bg-[#1a1a1a] flex items-center justify-between">
          <h2 className="font-semibold text-sm text-white flex items-center gap-2">
            <span>Settings & Preferences</span>
          </h2>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white p-1 rounded-md hover:bg-[#282828] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Library Path */}
          <div>
            <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">
              Library Root Directory
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.libraryRoot}
                onChange={(e) => setSettings({ ...settings, libraryRoot: e.target.value })}
                placeholder="D:/BiblioPard/Library"
                className="flex-1 bg-[#141414] border border-[#333333] focus:border-adobe-accent rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-[#737373] mt-1">
              All 3D models, HDR maps, and preview images will be stored and indexed here.
            </p>
          </div>

          {/* After Effects Options */}
          <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
              After Effects Integration
            </span>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-white font-medium block">Switch to Advanced 3D Renderer</span>
                <span className="text-[10px] text-[#737373]">
                  Automatically enable Advanced 3D on active composition when importing GLB/GLTF
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSwitchToAdvanced3D}
                onChange={(e) => setSettings({ ...settings, autoSwitchToAdvanced3D: e.target.checked })}
                className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-white font-medium block">Auto-Center in Composition</span>
                <span className="text-[10px] text-[#737373]">
                  Center imported 3D model in active comp viewport
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCenterInComp}
                onChange={(e) => setSettings({ ...settings, autoCenterInComp: e.target.checked })}
                className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
              />
            </label>
          </div>

          {/* 360 GIF Options */}
          <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
              Preview Generation
            </span>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-white font-medium block">Auto-generate 360° GIF by default</span>
                <span className="text-[10px] text-[#737373]">
                  Creates rotating turnaround preview for hover playback
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.generateGifByDefault}
                onChange={(e) => setSettings({ ...settings, generateGifByDefault: e.target.checked })}
                className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-white font-medium">360° GIF Frame Count</span>
              <select
                value={settings.gifFramesCount}
                onChange={(e) => setSettings({ ...settings, gifFramesCount: parseInt(e.target.value, 10) })}
                className="bg-[#141414] border border-[#333333] rounded px-2 py-1 text-xs text-white"
              >
                <option value={16}>16 frames (Fastest, ~150KB)</option>
                <option value={24}>24 frames (Balanced, ~280KB)</option>
                <option value={36}>36 frames (Ultra smooth, ~450KB)</option>
              </select>
            </div>
          </div>

          {/* Diagnostics info */}
          <div className="pt-3 border-t border-[#2d2d2d] text-[10px] text-[#737373] space-y-1">
            <div className="flex justify-between">
              <span>Host Application:</span>
              <span className="text-white font-mono">{hostInfo?.app || 'STANDALONE'}</span>
            </div>
            <div className="flex justify-between">
              <span>Host Version:</span>
              <span className="text-white font-mono">{hostInfo?.version || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Node.js Filesystem:</span>
              <span className={libraryManager.isNodeAvailable() ? 'text-emerald-400' : 'text-amber-400'}>
                {libraryManager.isNodeAvailable() ? 'Active (Direct Disk Access)' : 'Dev Browser Fallback'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2e2e2e] bg-[#1a1a1a] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#aaaaaa] hover:text-white rounded-md hover:bg-[#282828] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded-md text-xs font-medium transition-colors shadow"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
