import React from 'react';
import { Search, Plus, RefreshCw, Settings, Box, Layers, DownloadCloud, Sparkles, ArrowUpCircle } from 'lucide-react';
import { HostInfo, ReleaseInfo } from '../types';
import { APP_VERSION } from '../version';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  hostInfo: HostInfo | null;
  onOpenAddModal: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onImportFromAE: () => void;
  isImportingFromAE: boolean;
  updateInfo: ReleaseInfo | null;
  onOpenUpdateModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  hostInfo,
  onOpenAddModal,
  onOpenSettings,
  onRefresh,
  isRefreshing,
  onImportFromAE,
  isImportingFromAE,
  updateInfo,
  onOpenUpdateModal
}) => {
  const getHostBadge = () => {
    if (!hostInfo) return null;
    if (hostInfo.app === 'AEFT') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-purple-900/50 text-purple-300 border border-purple-700/60" title={`After Effects v${hostInfo.version}`}>
          AE {hostInfo.version}
        </span>
      );
    }
    if (hostInfo.app === 'PPRO') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-blue-900/50 text-blue-300 border border-blue-700/60" title={`Premiere v${hostInfo.version}`}>
          Pr {hostInfo.version}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-700/60">
        DEV Mode
      </span>
    );
  };

  return (
    <header className="h-14 border-b border-[#2d2d2d] bg-[#1e1e1e] px-3 flex items-center justify-between gap-3 shrink-0">
      {/* Logo & Host badge */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-adobe-accent via-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
          <Box className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-xs tracking-wide text-white">BiblioPard</h1>
            <span className="text-[9px] font-mono text-[#888888] bg-[#252525] px-1 py-0.2 rounded">v{APP_VERSION}</span>
            {getHostBadge()}
          </div>
          <p className="text-[9px] text-adobe-muted leading-none">Библиотека 3D и медиа-ассетов</p>
        </div>
      </div>

      {/* GitHub Update Notification Pill */}
      {updateInfo?.hasUpdate && (
        <button
          onClick={onOpenUpdateModal}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-medium hover:scale-105 transition-transform"
        >
          <ArrowUpCircle className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>Обновление v{updateInfo.version}</span>
        </button>
      )}

      {/* Search Bar */}
      <div className="relative flex-1 max-w-xs">
        <Search className="w-3.5 h-3.5 text-[#737373] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск 3D-моделей, материалов, HDR..."
          className="w-full bg-[#141414] border border-[#333333] hover:border-[#444444] focus:border-adobe-accent rounded-md py-1 pl-8 pr-3 text-xs text-white placeholder-[#737373] focus:outline-none transition-colors"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Import from AE project selection */}
        <button
          onClick={onImportFromAE}
          disabled={isImportingFromAE}
          title="Добавить выделенный файл из проекта After Effects в библиотеку"
          className="flex items-center gap-1 bg-[#282828] hover:bg-[#333333] text-[#cccccc] hover:text-white px-2 py-1.5 rounded-md font-medium text-xs transition-colors border border-[#3c3c3c] active:scale-95"
        >
          <DownloadCloud className={`w-3.5 h-3.5 text-purple-400 ${isImportingFromAE ? 'animate-bounce' : ''}`} />
          <span className="hidden sm:inline">Из проекта AE</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Обновить библиотеку"
          className="p-1.5 text-[#9a9a9a] hover:text-white hover:bg-[#2a2a2a] rounded-md transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-adobe-accent' : ''}`} />
        </button>

        <button
          onClick={onOpenSettings}
          title="Настройки библиотеки"
          className="p-1.5 text-[#9a9a9a] hover:text-white hover:bg-[#2a2a2a] rounded-md transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-1 bg-adobe-accent hover:bg-adobe-accentHover text-white px-2.5 py-1.5 rounded-md font-medium text-xs transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить ассет</span>
        </button>
      </div>
    </header>
  );
};
