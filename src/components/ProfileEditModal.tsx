import React, { useState, useRef } from 'react';
import { X, Camera, Trash2, Check, ZoomIn, ZoomOut, AlertCircle, Sparkles } from 'lucide-react';
import { Avatar } from './Avatar';
import { apiRequest, compressImage } from '../lib/api';
import type { UserProfile } from '../types';

interface ProfileEditModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onUpdate: (updated: UserProfile) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  currentUser,
  onClose,
  onUpdate
}) => {
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [username, setUsername] = useState(currentUser.username);
  const [email, setEmail] = useState(currentUser.email || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl || null);
  const [zoomScale, setZoomScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    try {
      setLoading(true);
      const compressed = await compressImage(file, 600, 600, 0.85);
      setAvatarUrl(compressed);
      setZoomScale(1);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage('Failed to process image: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!username.trim() || username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim() || null,
          bio: bio.trim(),
          avatarUrl
        })
      });

      onUpdate(data.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] overflow-hidden text-[#1C1C1E]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EA]">
          <h2 className="text-base font-semibold">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#F2F2F7] text-[#8E8E93] hover:text-[#1C1C1E] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div 
                className="w-28 h-28 rounded-full overflow-hidden border-2 border-[#E5E5EA] shadow-md flex items-center justify-center bg-gradient-to-br from-[#F8F9FA] to-[#E9ECEF]"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Preview"
                    style={{ transform: `scale(${zoomScale})` }}
                    className="w-full h-full object-cover transition-transform"
                  />
                ) : (
                  <Avatar name={fullName || 'User'} size="2xl" />
                )}
              </div>

              {/* Upload trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2.5 rounded-full bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] shadow-md transition"
                title="Change Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Avatar controls */}
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-[#1C1C1E] hover:underline"
              >
                Upload Photo
              </button>
              {avatarUrl && (
                <>
                  <span className="text-[#D1D1D6]">•</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    Remove Photo
                  </button>
                </>
              )}
            </div>

            {/* Zoom slider if photo exists */}
            {avatarUrl && (
              <div className="w-48 mt-3 flex items-center gap-2 text-xs text-[#8E8E93]">
                <ZoomOut className="w-3.5 h-3.5" />
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={zoomScale}
                  onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                  className="w-full accent-[#1C1C1E] h-1 bg-[#E5E5EA] rounded-lg"
                />
                <ZoomIn className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                Username (@)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm font-mono focus:outline-none focus:border-[#8E8E93] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                Registered Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                placeholder="optional@domain.com"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider">
                  Bio
                </label>
                <span className="text-[11px] text-[#8E8E93]">{bio.length}/160</span>
              </div>
              <textarea
                rows={2}
                maxLength={160}
                value={bio}
                placeholder="Share a short bio..."
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-sm focus:outline-none focus:border-[#8E8E93] focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#636366] hover:bg-[#F2F2F7] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
