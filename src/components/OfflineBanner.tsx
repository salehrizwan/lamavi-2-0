import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  isOffline: boolean;
  queuedCount: number;
  isSyncing?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  queuedCount,
  isSyncing = false
}) => {
  if (!isOffline && queuedCount === 0 && !isSyncing) return null;

  return (
    <div className="bg-[#1C1C1E] text-white text-xs px-4 py-2 flex items-center justify-between shadow-md transition-all">
      <div className="flex items-center gap-2">
        {isOffline ? (
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
        )}
        <span>
          {isOffline
            ? `Offline mode • Messages will send automatically when connected (${queuedCount} queued)`
            : isSyncing
              ? 'Synchronizing queued messages...'
              : `${queuedCount} messages synced!`}
        </span>
      </div>
    </div>
  );
};
