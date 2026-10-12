import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Eye, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Avatar } from './Avatar';
import { apiRequest } from '../lib/api';
import type { StatusUpdate, UserProfile } from '../types';

interface StatusViewerModalProps {
  statuses: StatusUpdate[];
  initialIndex?: number;
  currentUser: UserProfile;
  onClose: () => void;
  onStatusDeleted: (id: string) => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  statuses,
  initialIndex = 0,
  currentUser,
  onClose,
  onStatusDeleted
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersSheet, setShowViewersSheet] = useState(false);

  const currentStatus = statuses[currentIndex];
  const isOwnStatus = currentStatus && currentStatus.userId === currentUser.id;

  // Mark status as viewed when displayed
  useEffect(() => {
    if (currentStatus && !isOwnStatus) {
      apiRequest(`/api/statuses/${currentStatus.id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [currentIndex, currentStatus?.id, isOwnStatus]);

  // Story auto-advancing progress timer
  useEffect(() => {
    if (!currentStatus || isPaused || showViewersSheet) return;

    setProgress(0);
    const duration = 5000; // 5 seconds per story
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Advance to next or close
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex(c => c + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, showViewersSheet, statuses.length, onClose]);

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(c => c + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(c => c - 1);
      setProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!currentStatus) return;
    if (confirm('Are you sure you want to delete this status?')) {
      try {
        await apiRequest(`/api/statuses/${currentStatus.id}`, { method: 'DELETE' });
        onStatusDeleted(currentStatus.id);
        if (statuses.length <= 1) {
          onClose();
        } else {
          handleNext();
        }
      } catch (err: any) {
        alert(err.message || 'Failed to delete status');
      }
    }
  };

  if (!currentStatus) return null;

  const authorName = isOwnStatus ? 'My Status' : (currentStatus.user?.fullName || 'User');
  const uploadTimeStr = new Date(currentStatus.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Segmented Progress Bars */}
      <div className="absolute top-2 left-0 right-0 z-20 flex gap-1 px-3">
        {statuses.map((s, idx) => {
          let fill = '0%';
          if (idx < currentIndex) fill = '100%';
          else if (idx === currentIndex) fill = `${progress}%`;

          return (
            <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all ease-linear" 
                style={{ width: fill }}
              />
            </div>
          );
        })}
      </div>

      {/* Top Header Bar */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-6 pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-3">
          <Avatar 
            name={authorName} 
            avatarUrl={isOwnStatus ? currentUser.avatarUrl : currentStatus.user?.avatarUrl} 
            size="sm" 
          />
          <div>
            <p className="text-sm font-semibold">{authorName}</p>
            <p className="text-[11px] text-white/70">{uploadTimeStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnStatus && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-red-400 transition"
              title="Delete status"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Status Display Canvas */}
      <div 
        className="flex-1 relative flex items-center justify-center p-6 text-center cursor-pointer"
        style={{
          background: currentStatus.type === 'text' 
            ? currentStatus.backgroundColor 
            : '#0A0A0C'
        }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Navigation tap overlays */}
        <div 
          className="absolute inset-y-0 left-0 w-1/3 z-10" 
          onClick={(e) => { e.stopPropagation(); handlePrev(); }} 
        />
        <div 
          className="absolute inset-y-0 right-0 w-1/3 z-10" 
          onClick={(e) => { e.stopPropagation(); handleNext(); }} 
        />

        {currentStatus.type === 'text' ? (
          <div className="max-w-md px-6 z-0">
            <p className={`text-2xl sm:text-3xl font-medium tracking-wide drop-shadow-md text-[#1C1C1E] ${currentStatus.fontStyle}`}>
              {currentStatus.content}
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative z-0">
            {currentStatus.mediaUrl && (
              <img
                src={currentStatus.mediaUrl}
                alt="Status"
                className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            )}
            {currentStatus.content && (
              <div className="absolute bottom-6 px-6 py-2.5 rounded-2xl bg-black/60 backdrop-blur-md max-w-lg">
                <p className="text-sm font-light text-white">{currentStatus.content}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Info / Viewers Drawer for Author */}
      {isOwnStatus && (
        <div className="relative z-20 bg-gradient-to-t from-black/80 to-transparent p-4 flex flex-col items-center">
          <button
            onClick={() => {
              setIsPaused(true);
              setShowViewersSheet(true);
            }}
            className="flex items-center gap-2 py-2 px-4 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-xs font-medium text-white transition shadow-sm"
          >
            <Eye className="w-4 h-4" />
            <span>{currentStatus.viewers?.length || 0} views</span>
          </button>
        </div>
      )}

      {/* Viewers Sheet Modal */}
      {showViewersSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#1C1C1E] text-white rounded-t-3xl border-t border-white/10 p-5 max-h-[60vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#AEAEB2]" />
                <h4 className="text-sm font-semibold">Viewed by ({currentStatus.viewers?.length || 0})</h4>
              </div>
              <button
                onClick={() => {
                  setShowViewersSheet(false);
                  setIsPaused(false);
                }}
                className="p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 py-2">
              {(!currentStatus.viewers || currentStatus.viewers.length === 0) ? (
                <p className="text-xs text-white/50 py-8 text-center">No views yet.</p>
              ) : (
                currentStatus.viewers.map((v, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={v.userName} avatarUrl={v.userAvatar} size="xs" />
                      <span className="text-sm font-medium">{v.userName}</span>
                    </div>
                    <span className="text-[11px] text-white/50">
                      {new Date(v.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
