import React, { useState } from 'react';
import { X, ArrowUpCircle, ExternalLink, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { ReleaseInfo } from '../types';
import { updateChecker } from '../services/updateChecker';

interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: ReleaseInfo | null;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  isOpen,
  onClose,
  updateInfo
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen || !updateInfo) return null;

  const handleUpdate = async () => {
    if (!updateInfo.zipUrl) {
      window.open(updateInfo.htmlUrl, '_blank');
      return;
    }

    setIsUpdating(true);
    setUpdateStatus('idle');

    try {
      const success = await updateChecker.applyUpdate(updateInfo.zipUrl);
      if (success) {
        setUpdateStatus('success');
      } else {
        setUpdateStatus('error');
      }
    } catch {
      setUpdateStatus('error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#383838] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2e2e2e] bg-[#161616] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white flex items-center gap-2">
                <span>Доступно новое обновление!</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                  v{updateInfo.version}
                </span>
              </h2>
              <p className="text-[10px] text-[#888888]">
                Текущая версия: v{updateChecker.CURRENT_VERSION}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-white p-1 rounded hover:bg-[#282828] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Release Notes Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">{updateInfo.name}</h3>
            <span className="text-[10px] text-[#737373]">
              Дата выпуска: {new Date(updateInfo.publishedAt).toLocaleDateString()}
            </span>
          </div>

          <div className="p-3 bg-[#141414] border border-[#2d2d2d] rounded-lg text-xs text-[#cccccc] font-sans leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
            {updateInfo.body}
          </div>

          {updateStatus === 'success' && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/50 rounded-md text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Обновление скачано! Перезапустите After Effects или обновите панель.</span>
            </div>
          )}

          {updateStatus === 'error' && (
            <div className="p-2.5 bg-red-950/40 border border-red-500/50 rounded-md text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Не удалось автоматически применить обновление. Скачайте вручную с GitHub.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2e2e2e] bg-[#161616] flex items-center justify-between">
          <a
            href={updateInfo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-adobe-accent hover:underline"
          >
            <span>Смотреть на GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#aaaaaa] hover:text-white rounded hover:bg-[#282828] transition-colors"
            >
              Позже
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded font-medium text-xs shadow transition-all active:scale-95 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isUpdating ? 'Обновление...' : 'Обновить сейчас'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
