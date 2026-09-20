import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SidebarCategories } from './components/SidebarCategories';
import { AssetGrid } from './components/AssetGrid';
import { ModalAddAsset } from './components/ModalAddAsset';
import { ModalEditAsset } from './components/ModalEditAsset';
import { Viewport3DModal } from './components/Viewport3DModal';
import { SettingsModal } from './components/SettingsModal';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { AssetItem, Category, HostInfo, ReleaseInfo } from './types';
import { hostBridge } from './services/hostBridge';
import { libraryManager } from './services/libraryManager';
import { libraryWatcher } from './services/libraryWatcher';
import { updateChecker } from './services/updateChecker';
import { CheckCircle2, AlertCircle, Info, X, Upload } from 'lucide-react';

export const App: React.FC = () => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => libraryManager.getDefaultCategories());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [importingAssetId, setImportingAssetId] = useState<string | null>(null);
  const [isImportingFromAE, setIsImportingFromAE] = useState<boolean>(false);

  // Global Drag and Drop
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);

  // Host, Update & Toast
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<ReleaseInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const info = await hostBridge.getHostInfo();
        setHostInfo(info);
      } catch (e) {
        console.warn('Host info error:', e);
      }

      await loadLibraryAssets();

      // Start Auto-Watcher on the library directory
      const settings = libraryManager.getSettings();
      libraryWatcher.startWatching(settings.libraryRoot, () => {
        loadLibraryAssets();
        showToast('Библиотека автоматически синхронизирована с диском', 'info');
      });

      // Check for updates via GitHub
      if (settings.autoCheckUpdates) {
        try {
          const update = await updateChecker.checkForUpdates(settings.githubRepo);
          if (update && update.hasUpdate) {
            setUpdateInfo(update);
          }
        } catch (err) {
          console.warn('Update check failed:', err);
        }
      }
    };

    init();

    return () => {
      libraryWatcher.stopWatching();
    };
  }, []);

  const loadLibraryAssets = async () => {
    setIsLoading(true);
    try {
      const items = await libraryManager.loadAssets();
      setAssets(items);
    } catch (err) {
      showToast('Ошибка при загрузке ассетов библиотеки', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const items = await libraryManager.loadAssets();
      setAssets(items);
      showToast('Библиотека обновлена', 'info');
    } catch {
      showToast('Не удалось обновить библиотеку', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleImportAsset = async (asset: AssetItem) => {
    setImportingAssetId(asset.id);
    try {
      const res = await hostBridge.importAsset(asset);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Ошибка импорта: ' + (err?.message || err), 'error');
    } finally {
      setImportingAssetId(null);
    }
  };

  const handleRevealAsset = async (asset: AssetItem) => {
    try {
      const ok = await hostBridge.revealInExplorer(asset.filePath);
      if (!ok) {
        showToast(`Не удалось открыть расположение файла: ${asset.filePath}`, 'error');
      }
    } catch (err: any) {
      showToast('Ошибка при открытии расположения файла: ' + (err?.message || err), 'error');
    }
  };

  /**
   * Import selected items from After Effects Project Panel directly
   */
  const handleImportFromAE = async () => {
    setIsImportingFromAE(true);
    try {
      const items = await hostBridge.getSelectedProjectItems();
      if (!items || items.length === 0) {
        showToast('Сначала выделите элемент в панели Project After Effects', 'info');
        return;
      }

      const first = items[0];
      if (first.filePath) {
        showToast(`Найден "${first.name}". Открываем добавление ассета...`, 'info');
        setIsAddModalOpen(true);
      } else {
        showToast(`У выбранного "${first.name}" (${first.typeName}) нет исходного файла на диске`, 'error');
      }
    } catch (err: any) {
      showToast('Ошибка чтения выделения в AE: ' + (err?.message || err), 'error');
    } finally {
      setIsImportingFromAE(false);
    }
  };

  const handleAssetAdded = (newAsset: AssetItem) => {
    setAssets((prev) => [newAsset, ...prev]);
    showToast(`"${newAsset.name}" добавлен в библиотеку!`, 'success');
  };

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = categories.find((c) => c.id === selectedCategory);
        if (cat && cat.type !== 'all' && asset.type !== cat.type) {
          return false;
        }
      }

      // Tag filter
      if (selectedTag && !asset.tags.includes(selectedTag)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = asset.name.toLowerCase().includes(query);
        const matchesCategory = asset.category.toLowerCase().includes(query);
        const matchesTags = asset.tags.some((t) => t.toLowerCase().includes(query));
        const matchesFormat = asset.format.toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesTags && !matchesFormat) {
          return false;
        }
      }

      return true;
    });
  }, [assets, selectedCategory, selectedTag, searchQuery, categories]);

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setDroppedFiles(files);
      setIsAddModalOpen(true);
    }
  };

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragEnter={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="relative flex flex-col h-screen w-screen bg-[#181818] text-[#e6e6e6] select-none overflow-hidden"
    >
      {/* Global Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-[#141414]/90 border-2 border-dashed border-adobe-accent backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="p-6 bg-[#202020] border border-adobe-accent/40 rounded-2xl shadow-2xl flex flex-col items-center gap-3 text-center max-w-sm">
            <div className="p-3 bg-adobe-accent/20 text-adobe-accent rounded-full animate-bounce">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-white">Перетащите для добавления в BiblioPard</h3>
            <p className="text-xs text-[#999999]">
              3D-модели (.glb, .gltf, .obj), HDR-карты (.hdr, .exr) или PBR-текстуры
            </p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hostInfo={hostInfo}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onImportFromAE={handleImportFromAE}
        isImportingFromAE={isImportingFromAE}
        updateInfo={updateInfo}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <SidebarCategories
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          assets={assets}
        />

        {/* Center/Right Asset Grid */}
        <main className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
          <AssetGrid
            assets={filteredAssets}
            isLoading={isLoading}
            onImportAsset={handleImportAsset}
            onOpenPreview={(asset) => setPreviewAsset(asset)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onEditAsset={(asset) => setEditingAsset(asset)}
            onRevealAsset={handleRevealAsset}
            importingAssetId={importingAssetId}
          />
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-xl text-xs backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 border bg-[#242424]/95 border-[#3d3d3d] text-white">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-adobe-accent shrink-0" />}
          <span className="pr-1">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-0.5 hover:bg-white/10 rounded text-[#888888] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modals */}
      <ModalAddAsset
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setDroppedFiles(null);
        }}
        onAssetAdded={handleAssetAdded}
        initialFiles={droppedFiles}
      />

      <ModalEditAsset
        asset={editingAsset}
        isOpen={!!editingAsset}
        onClose={() => setEditingAsset(null)}
        onAssetUpdated={(updated) => {
          setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setEditingAsset(null);
          showToast(`"${updated.name}" успешно обновлен!`, 'success');
        }}
        onAssetDeleted={(deletedId) => {
          setAssets((prev) => prev.filter((a) => a.id !== deletedId));
          setEditingAsset(null);
          showToast('Ассет удален из библиотеки', 'info');
        }}
      />

      <Viewport3DModal
        asset={previewAsset}
        isOpen={!!previewAsset}
        onClose={() => setPreviewAsset(null)}
        onImport={handleImportAsset}
        onEdit={(asset) => setEditingAsset(asset)}
        isImporting={importingAssetId === previewAsset?.id}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={loadLibraryAssets}
        hostInfo={hostInfo}
      />

      <UpdateNotificationModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
      />
    </div>
  );
};

export default App;
