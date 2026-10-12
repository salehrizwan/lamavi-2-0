import React, { useState, useEffect } from 'react';
import { Plus, Camera, Type, Image as ImageIcon, Sparkles, X, ChevronRight, Eye } from 'lucide-react';
import { Avatar } from './Avatar';
import { StatusViewerModal } from './StatusViewerModal';
import { apiRequest, compressImage } from '../lib/api';
import type { StatusUpdate, UserProfile } from '../types';

interface StatusTabProps {
  currentUser: UserProfile;
}

const BG_GRADIENTS = [
  { name: 'Pearl Silver', value: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)', textDark: true },
  { name: 'Sterling Silver', value: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)', textDark: true },
  { name: 'Champagne Silk', value: 'linear-gradient(135deg, #F5F5F0 0%, #E0DED7 100%)', textDark: true },
  { name: 'Pure Platinum', value: 'linear-gradient(135deg, #FFFFFF 0%, #E5E5EA 100%)', textDark: true },
  { name: 'Noir & Silver', value: 'linear-gradient(135deg, #27272A 0%, #09090B 100%)', textDark: false }
];

const FONT_STYLES = [
  { name: 'Sans', value: 'font-sans' },
  { name: 'Serif Italic', value: 'font-serif italic' },
  { name: 'Mono', value: 'font-mono' }
];

export const StatusTab: React.FC<StatusTabProps> = ({ currentUser }) => {
  const [statuses, setStatuses] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeViewerStatuses, setActiveViewerStatuses] = useState<StatusUpdate[] | null>(null);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // Status Creator Modal State
  const [showCreator, setShowCreator] = useState(false);
  const [creatorTab, setCreatorTab] = useState<'text' | 'image'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[1].value);
  const [selectedFont, setSelectedFont] = useState(FONT_STYLES[0].value);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const fetchStatuses = async () => {
    try {
      const data = await apiRequest<{ statuses: StatusUpdate[] }>('/api/statuses');
      setStatuses(data.statuses);
    } catch (err) {
      console.error('Failed to load statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  // Separate own statuses and others' statuses
  const ownStatuses = statuses.filter(s => s.userId === currentUser.id);
  const othersStatuses = statuses.filter(s => s.userId !== currentUser.id);

  // Group other users' statuses by user
  const groupedOthers: { [userId: string]: StatusUpdate[] } = {};
  othersStatuses.forEach(s => {
    if (!groupedOthers[s.userId]) groupedOthers[s.userId] = [];
    groupedOthers[s.userId].push(s);
  });

  const unviewedUserGroups: StatusUpdate[][] = [];
  const viewedUserGroups: StatusUpdate[][] = [];

  Object.values(groupedOthers).forEach(userStatuses => {
    const hasUnviewed = userStatuses.some(s => !s.hasViewed);
    if (hasUnviewed) {
      unviewedUserGroups.push(userStatuses);
    } else {
      viewedUserGroups.push(userStatuses);
    }
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1080, 1920, 0.85);
      setImagePreview(compressed);
    } catch (err: any) {
      alert('Failed to process image: ' + err.message);
    }
  };

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPosting(true);
    try {
      if (creatorTab === 'text') {
        if (!textContent.trim()) return;
        await apiRequest('/api/statuses', {
          method: 'POST',
          body: JSON.stringify({
            type: 'text',
            content: textContent.trim(),
            backgroundColor: selectedBg,
            fontStyle: selectedFont
          })
        });
      } else {
        if (!imagePreview) return;
        await apiRequest('/api/statuses', {
          method: 'POST',
          body: JSON.stringify({
            type: 'image',
            content: imageCaption.trim(),
            mediaUrl: imagePreview
          })
        });
      }

      // Reset and refresh
      setTextContent('');
      setImagePreview(null);
      setImageCaption('');
      setShowCreator(false);
      await fetchStatuses();
    } catch (err: any) {
      alert(err.message || 'Failed to post status');
    } finally {
      setIsPosting(false);
    }
  };

  const openOwnStory = () => {
    if (ownStatuses.length > 0) {
      setActiveViewerStatuses(ownStatuses);
      setViewerStartIndex(0);
    } else {
      setShowCreator(true);
    }
  };

  const openUserStory = (userStatuses: StatusUpdate[]) => {
    setActiveViewerStatuses(userStatuses);
    setViewerStartIndex(0);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-y-auto">
      {/* iOS Header */}
      <div className="sticky top-0 z-10 px-5 pt-4 pb-3 bg-white/90 backdrop-blur-md border-b border-[#E5E5EA]">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">Status</h1>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-[#1C1C1E] text-white text-xs font-medium hover:bg-[#2C2C2E] transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Status</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">
        {/* MY STATUS CARD */}
        <div 
          onClick={openOwnStory}
          className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-[#E5E5EA] shadow-2xs hover:bg-[#FDFDFE] transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <Avatar
                name={currentUser.fullName}
                avatarUrl={currentUser.avatarUrl}
                size="md"
                statusRing={ownStatuses.length > 0 ? 'unviewed' : 'none'}
              />
              {ownStatuses.length === 0 && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center border-2 border-white">
                  <Plus className="w-3 h-3" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#1C1C1E]">My Status</h3>
              <p className="text-xs text-[#8E8E93]">
                {ownStatuses.length > 0 
                  ? `${ownStatuses.length} active update${ownStatuses.length > 1 ? 's' : ''} • Tap to view`
                  : 'Tap to add status update'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreator(true); }}
              className="p-2 rounded-full hover:bg-[#F2F2F7] text-[#636366]"
              title="New Status"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 24-HOUR EXPIRATION BADGE */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/70 border border-slate-200/60 text-[11px] text-[#64748B]">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#94A3B8]" />
          <span>Status updates disappear automatically after 24 hours.</span>
        </div>

        {/* RECENT UPDATES SECTION */}
        {unviewedUserGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider px-1">
              Recent Updates
            </p>
            <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] shadow-2xs overflow-hidden">
              {unviewedUserGroups.map((group) => {
                const latest = group[0];
                return (
                  <div
                    key={latest.userId}
                    onClick={() => openUserStory(group)}
                    className="flex items-center justify-between p-3.5 hover:bg-[#F8F9FA] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <Avatar
                        name={latest.user?.fullName || 'User'}
                        avatarUrl={latest.user?.avatarUrl}
                        size="md"
                        statusRing="unviewed"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-[#1C1C1E]">
                          {latest.user?.fullName}
                        </h4>
                        <p className="text-xs text-[#8E8E93]">
                          {new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEWED UPDATES SECTION */}
        {viewedUserGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider px-1">
              Viewed Updates
            </p>
            <div className="bg-white/80 rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] overflow-hidden">
              {viewedUserGroups.map((group) => {
                const latest = group[0];
                return (
                  <div
                    key={latest.userId}
                    onClick={() => openUserStory(group)}
                    className="flex items-center justify-between p-3.5 hover:bg-[#F8F9FA] transition cursor-pointer opacity-75"
                  >
                    <div className="flex items-center gap-3.5">
                      <Avatar
                        name={latest.user?.fullName || 'User'}
                        avatarUrl={latest.user?.avatarUrl}
                        size="md"
                        statusRing="viewed"
                      />
                      <div>
                        <h4 className="text-sm font-medium text-[#1C1C1E]">
                          {latest.user?.fullName}
                        </h4>
                        <p className="text-xs text-[#8E8E93]">
                          {new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {unviewedUserGroups.length === 0 && viewedUserGroups.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E5EA]">
            <p className="text-sm font-medium text-[#1C1C1E]">No recent status updates</p>
            <p className="text-xs text-[#8E8E93] mt-1 max-w-xs mx-auto">
              Status updates from your connected friends will appear here for 24 hours.
            </p>
          </div>
        )}
      </div>

      {/* STATUS CREATOR MODAL */}
      {showCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreatorTab('text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    creatorTab === 'text' ? 'bg-[#1C1C1E] text-white' : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                  }`}
                >
                  <Type className="w-3.5 h-3.5 inline mr-1" /> Text Status
                </button>
                <button
                  type="button"
                  onClick={() => setCreatorTab('image')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    creatorTab === 'image' ? 'bg-[#1C1C1E] text-white' : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> Photo Status
                </button>
              </div>

              <button
                onClick={() => setShowCreator(false)}
                className="p-1.5 rounded-full hover:bg-[#F2F2F7] text-[#8E8E93]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostStatus} className="p-5 space-y-4">
              {creatorTab === 'text' ? (
                <>
                  {/* Text Canvas Preview */}
                  <div
                    className="w-full h-48 rounded-2xl p-5 flex items-center justify-center text-center shadow-inner relative"
                    style={{ background: selectedBg }}
                  >
                    <textarea
                      rows={3}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Type a status..."
                      maxLength={140}
                      className={`w-full bg-transparent text-center text-xl text-[#1C1C1E] placeholder:text-black/30 resize-none outline-none ${selectedFont}`}
                    />
                  </div>

                  {/* Gradient Palettes */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                      Metallic Themes
                    </label>
                    <div className="flex items-center gap-2">
                      {BG_GRADIENTS.map((bg, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedBg(bg.value)}
                          className={`w-8 h-8 rounded-full border-2 transition ${
                            selectedBg === bg.value ? 'border-[#1C1C1E] scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ background: bg.value }}
                          title={bg.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Font picker */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                      Typography
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {FONT_STYLES.map((f, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedFont(f.value)}
                          className={`py-1.5 px-3 rounded-xl border text-xs font-medium transition ${
                            selectedFont === f.value ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]' : 'border-[#E5E5EA] text-[#636366]'
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Photo Canvas Preview */}
                  <div className="w-full h-52 rounded-2xl bg-[#F2F2F7] border border-[#E5E5EA] overflow-hidden flex flex-col items-center justify-center relative">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer p-4 text-center">
                        <Camera className="w-8 h-8 text-[#AEAEB2] mb-2" />
                        <span className="text-xs font-semibold text-[#1C1C1E]">Choose Photo from Device</span>
                        <span className="text-[11px] text-[#8E8E93] mt-0.5">JPG, PNG, WebP supported</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {imagePreview && (
                    <div>
                      <input
                        type="text"
                        placeholder="Add a caption..."
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93]"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreator(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#636366] hover:bg-[#F2F2F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPosting || (creatorTab === 'text' ? !textContent.trim() : !imagePreview)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] disabled:opacity-40 transition shadow-sm"
                >
                  {isPosting ? 'Posting...' : 'Share Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL-SCREEN STATUS VIEWER */}
      {activeViewerStatuses && (
        <StatusViewerModal
          statuses={activeViewerStatuses}
          initialIndex={viewerStartIndex}
          currentUser={currentUser}
          onClose={() => setActiveViewerStatuses(null)}
          onStatusDeleted={(deletedId) => {
            setStatuses(prev => prev.filter(s => s.id !== deletedId));
          }}
        />
      )}
    </div>
  );
};
