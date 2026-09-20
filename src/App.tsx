import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SidebarCategories } from './components/SidebarCategories';
import { AssetGrid } from './components/AssetGrid';
import { ModalAddAsset } from './components/ModalAddAsset';
import { Viewport3DModal } from './components/Viewport3DModal';
import { SettingsModal } from './components/SettingsModal';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { AssetItem, Category, HostInfo, ReleaseInfo } from './types';
import { hostBridge } from './services/hostBridge';
import { libraryManager } from './services/libraryManager';
import { libraryWatcher } from './services/libraryWatcher';
import { updateChecker } from './services/updateChecker';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

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

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);

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
        showToast('Library auto-updated from disk', 'info');
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
      showToast('Error loading library assets', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const items = await libraryManager.loadAssets();
      setAssets(items);
      showToast('Library refreshed', 'info');
    } catch {
      showToast('Refresh failed', 'error');
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
      showToast('Import failed: ' + (err?.message || err), 'error');
    } finally {
      setImportingAssetId(null);
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
        showToast('Please select an item in After Effects Project panel first', 'info');
        return;
      }

      const first = items[0];
      if (first.filePath) {
        showToast(`Found "${first.name}". Opening Add Asset wizard...`, 'info');
        setIsAddModalOpen(true);
      } else {
        showToast(`Selected "${first.name}" (${first.typeName}) has no source file`, 'error');
      }
    } catch (err: any) {
      showToast('Error reading AE selection: ' + (err?.message || err), 'error');
    } finally {
      setIsImportingFromAE(false);
    }
  };

  const handleAssetAdded = (newAsset: AssetItem) => {
    setAssets((prev) => [newAsset, ...prev]);
    showToast(`"${newAsset.name}" added to library!`, 'success');
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#181818] text-[#e6e6e6] select-none overflow-hidden">
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
        onClose={() => setIsAddModalOpen(false)}
        onAssetAdded={handleAssetAdded}
      />

      <Viewport3DModal
        asset={previewAsset}
        isOpen={!!previewAsset}
        onClose={() => setPreviewAsset(null)}
        onImport={handleImportAsset}
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
