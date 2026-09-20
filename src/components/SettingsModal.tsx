import React, { useState } from 'react';
import { X, Folder, Check, HardDrive, Cpu, RefreshCw } from 'lucide-react';
import { LibrarySettings, HostInfo, ReleaseInfo } from '../types';
import { libraryManager } from '../services/libraryManager';
import { updateChecker } from '../services/updateChecker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
  hostInfo: HostInfo | null;
  onOpenUpdateModal?: (update: ReleaseInfo) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
  hostInfo,
  onOpenUpdateModal
}) => {
  const [settings, setSettings] = useState<LibrarySettings>(() => libraryManager.getSettings());
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'update-found' | 'error'>('idle');
  const [checkResult, setCheckResult] = useState<ReleaseInfo | null>(null);

  if (!isOpen) return null;

  const handleManualCheckUpdate = async () => {
    setCheckStatus('checking');
    setCheckResult(null);
    try {
      const info = await updateChecker.checkForUpdates(settings.githubRepo);
      if (info && info.hasUpdate) {
        setCheckStatus('update-found');
        setCheckResult(info);
      } else {
        setCheckStatus('up-to-date');
      }
    } catch {
      setCheckStatus('error');
    }
  };

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
            <span>Настройки библиотеки</span>
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
              Корневая папка библиотеки
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
              Все 3D-модели, карты HDR и превью сохраняются и индексируются здесь.
            </p>
          </div>

          {/* After Effects Options */}
          <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
              Интеграция с After Effects
            </span>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-white font-medium block">Включать Advanced 3D рендерер</span>
                <span className="text-[10px] text-[#737373]">
                  Автоматически переключать композицию на Advanced 3D при импорте GLB/GLTF
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
                <span className="text-white font-medium block">Авто-центрирование в композиции</span>
                <span className="text-[10px] text-[#737373]">
                  Размещать импортированную 3D-модель по центру активной композиции
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCenterInComp}
                onChange={(e) => setSettings({ ...settings, autoCenterInComp: e.target.checked })}
                className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
              />
            </label>

            {/* Default Import Target */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-white font-medium block">Режим импорта ассетов</span>
                <span className="text-[10px] text-[#737373]">
                  При наличии открытой композиции в After Effects
                </span>
              </div>
              <select
                value={settings.defaultImportTarget || 'always-ask'}
                onChange={(e) => setSettings({ ...settings, defaultImportTarget: e.target.value as any })}
                className="bg-[#141414] border border-[#333333] rounded px-2 py-1 text-xs text-white"
              >
                <option value="always-ask">Всегда спрашивать (показывать выбор)</option>
                <option value="always-comp">Сразу в активную композицию</option>
                <option value="always-project">Только в проект (без слоя)</option>
              </select>
            </div>

            {/* Default 3D Scale Mode */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-white font-medium block">Масштаб 3D-моделей по умолчанию</span>
                <span className="text-[10px] text-[#737373]">
                  Равномерное пропорциональное 3D-масштабирование [X, Y, Z]
                </span>
              </div>
              <select
                value={settings.default3DScaleMode || 'fit-comp'}
                onChange={(e) => setSettings({ ...settings, default3DScaleMode: e.target.value as any })}
                className="bg-[#141414] border border-[#333333] rounded px-2 py-1 text-xs text-white"
              >
                <option value="fit-comp">По размеру композиции (Автомасштаб)</option>
                <option value="fit-fullhd">Стандарт Full HD (1920×1080)</option>
                <option value="original">Оригинальный масштаб (100%)</option>
                <option value="fit-width">По ширине композиции</option>
                <option value="fit-height">По высоте композиции</option>
              </select>
            </div>

            {/* Default Media Scale Mode */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-white font-medium block">Масштаб 2D-медиа по умолчанию</span>
                <span className="text-[10px] text-[#737373]">
                  Для видео, секвенций, текстур и картинок
                </span>
              </div>
              <select
                value={settings.defaultMediaScaleMode || 'fit-comp'}
                onChange={(e) => setSettings({ ...settings, defaultMediaScaleMode: e.target.value as any })}
                className="bg-[#141414] border border-[#333333] rounded px-2 py-1 text-xs text-white"
              >
                <option value="fit-comp">По размеру композиции (Автомасштаб)</option>
                <option value="original">Оригинальный масштаб (100%)</option>
                <option value="fit-fullhd">Стандарт Full HD (1920×1080)</option>
                <option value="fit-width">По ширине композиции</option>
                <option value="fit-height">По высоте композиции</option>
              </select>
            </div>
          </div>

          {/* 360 GIF Options */}
          <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
              Генерация превью
            </span>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-white font-medium block">Автоматически создавать 360° GIF по умолчанию</span>
                <span className="text-[10px] text-[#737373]">
                  Создает круговую анимацию 360° для просмотра при наведении
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
              <span className="text-white font-medium">Количество кадров в 360° GIF</span>
              <select
                value={settings.gifFramesCount}
                onChange={(e) => setSettings({ ...settings, gifFramesCount: parseInt(e.target.value, 10) })}
                className="bg-[#141414] border border-[#333333] rounded px-2 py-1 text-xs text-white"
              >
                <option value={16}>16 кадров (Быстрее, ~150 КБ)</option>
                <option value={24}>24 кадра (Оптимально, ~280 КБ)</option>
                <option value={36}>36 кадров (Максимальная плавность, ~450 КБ)</option>
              </select>
            </div>
          </div>

          {/* GitHub & Updates */}
          <div className="pt-3 border-t border-[#2d2d2d] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
                Обновления и GitHub
              </span>
              <span className="text-[10px] text-[#888888] font-mono">
                Версия: v{updateChecker.CURRENT_VERSION}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#aaaaaa] mb-1">
                Репозиторий GitHub
              </label>
              <input
                type="text"
                value={settings.githubRepo}
                onChange={(e) => setSettings({ ...settings, githubRepo: e.target.value })}
                placeholder="daarnix-anim/BiblioPard"
                className="w-full bg-[#141414] border border-[#333333] focus:border-adobe-accent rounded px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
              />
              <p className="text-[10px] text-[#737373] mt-1">
                Отсюда расширение автоматически скачивает новые версии и релизы.
              </p>
            </div>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-white font-medium block">Автоматически проверять обновления</span>
                <span className="text-[10px] text-[#737373]">
                  Уведомлять при появлении новой версии на GitHub при запуске
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCheckUpdates}
                onChange={(e) => setSettings({ ...settings, autoCheckUpdates: e.target.checked })}
                className="w-4 h-4 accent-adobe-accent rounded cursor-pointer"
              />
            </label>

            <div className="pt-1 flex items-center justify-between gap-2 bg-[#171717] p-2.5 rounded-lg border border-[#2b2b2b]">
              <div className="text-[11px] text-[#aaaaaa]">
                {checkStatus === 'checking' && (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    Проверка обновлений на GitHub...
                  </span>
                )}
                {checkStatus === 'up-to-date' && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> У вас установлена актуальная версия
                  </span>
                )}
                {checkStatus === 'update-found' && checkResult && (
                  <div className="space-y-0.5">
                    <span className="text-amber-300 font-medium block">
                      Доступна новая версия: v{checkResult.version}!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenUpdateModal?.(checkResult);
                      }}
                      className="text-[10px] text-adobe-accent hover:underline font-medium"
                    >
                      Открыть окно обновления →
                    </button>
                  </div>
                )}
                {checkStatus === 'error' && (
                  <span className="text-red-400">
                    Не удалось проверить обновления
                  </span>
                )}
                {checkStatus === 'idle' && (
                  <span>Проверьте наличие новых релизов</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleManualCheckUpdate}
                disabled={checkStatus === 'checking'}
                className="px-2.5 py-1 bg-[#282828] hover:bg-[#353535] text-white rounded text-[11px] font-medium transition-colors border border-[#3d3d3d] shrink-0 disabled:opacity-50"
              >
                Проверить сейчас
              </button>
            </div>
          </div>

          {/* Diagnostics info */}
          <div className="pt-3 border-t border-[#2d2d2d] text-[10px] text-[#737373] space-y-1">
            <div className="flex justify-between">
              <span>Хост-приложение:</span>
              <span className="text-white font-mono">{hostInfo?.app || 'STANDALONE'}</span>
            </div>
            <div className="flex justify-between">
              <span>Версия хоста:</span>
              <span className="text-white font-mono">{hostInfo?.version || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Файловая система Node.js:</span>
              <span className={libraryManager.isNodeAvailable() ? 'text-emerald-400' : 'text-amber-400'}>
                {libraryManager.isNodeAvailable() ? 'Активна (Прямой доступ к диску)' : 'Режим браузера (Эмуляция)'}
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
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-adobe-accent hover:bg-adobe-accentHover text-white rounded-md text-xs font-medium transition-colors shadow"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Сохранить настройки</span>
          </button>
        </div>
      </div>
    </div>
  );
};
