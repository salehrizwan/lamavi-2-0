import React, { useState } from 'react';
import { 
  User, Shield, Eye, Bell, Lock, KeyRound, Database, HelpCircle, 
  LogOut, Trash2, ChevronRight, Check, AlertTriangle, X, ShieldAlert 
} from 'lucide-react';
import { Avatar } from './Avatar';
import { ProfileEditModal } from './ProfileEditModal';
import { apiRequest, clearStoredToken } from '../lib/api';
import type { UserProfile, UserPrivacySettings } from '../types';

interface SettingsTabProps {
  currentUser: UserProfile;
  onUpdateCurrentUser: (user: UserProfile) => void;
  onLogout: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  onUpdateCurrentUser,
  onLogout
}) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Privacy Settings Local State
  const [privacyState, setPrivacyState] = useState<UserPrivacySettings>(currentUser.privacy);

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      const data = await apiRequest<{ user: UserProfile }>('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ privacy: privacyState })
      });
      onUpdateCurrentUser(data.user);
      setShowPrivacyModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update privacy');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      alert('Please type DELETE to confirm.');
      return;
    }
    setIsDeleting(true);
    try {
      await apiRequest('/api/auth/account', { method: 'DELETE' });
      clearStoredToken();
      onLogout();
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 pt-4 pb-3 bg-white/90 backdrop-blur-md border-b border-[#E5E5EA]">
        <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">Settings</h1>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-12">
        {/* PROFILE CARD */}
        <div 
          onClick={() => setShowEditProfile(true)}
          className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#E5E5EA] shadow-2xs hover:bg-[#FDFDFE] transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <Avatar
              name={currentUser.fullName}
              avatarUrl={currentUser.avatarUrl}
              size="lg"
            />
            <div>
              <h2 className="text-base font-semibold text-[#1C1C1E]">{currentUser.fullName}</h2>
              <p className="text-xs font-mono text-[#8E8E93]">@{currentUser.username}</p>
              <p className="text-xs text-[#636366] mt-0.5 line-clamp-1">{currentUser.bio}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#C7C7CC]" />
        </div>

        {/* SETTINGS GROUP 1: ACCOUNT & PRIVACY */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider px-2">
            Account & Security
          </p>
          <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] shadow-2xs overflow-hidden">
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-[#F8F9FA] transition text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#F2F2F7] text-[#1C1C1E]">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Privacy</p>
                  <p className="text-xs text-[#8E8E93]">Last seen, read receipts, photo</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
            </button>

            <button
              onClick={() => setShowBlockedModal(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-[#F8F9FA] transition text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#F2F2F7] text-[#1C1C1E]">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Blocked Contacts</p>
                  <p className="text-xs text-[#8E8E93]">{currentUser.blockedUserIds.length} blocked</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
            </button>

            <button
              onClick={() => setShowRecoveryModal(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-[#F8F9FA] transition text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#F2F2F7] text-[#1C1C1E]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Account Recovery Code</p>
                  <p className="text-xs text-[#8E8E93]">View key for password reset</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#C7C7CC]" />
            </button>
          </div>
        </div>

        {/* SETTINGS GROUP 2: PREFERENCES */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider px-2">
            Preferences & Data
          </p>
          <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#F2F2F7] text-[#1C1C1E]">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Notifications</p>
                  <p className="text-xs text-[#8E8E93]">In-app alerts enabled</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#F2F2F7] text-[#1C1C1E]">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Offline Storage</p>
                  <p className="text-xs text-[#8E8E93]">Persistent cache & sync queue enabled</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#1C1C1E] bg-[#F2F2F7] px-2.5 py-1 rounded-full">
                Indexed
              </span>
            </div>
          </div>
        </div>

        {/* SETTINGS GROUP 3: ACTIONS */}
        <div className="space-y-1.5">
          <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] shadow-2xs overflow-hidden">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-[#F8F9FA] transition text-left text-amber-700"
            >
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Log Out</span>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-red-50/50 transition text-left text-red-600"
            >
              <div className="p-2 rounded-xl bg-red-50 text-red-600">
                <Trash2 className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">Delete Account</span>
            </button>
          </div>
        </div>

        {/* BRAND FOOTER */}
        <div className="text-center pt-4">
          <p className="text-xs font-semibold tracking-widest text-[#8E8E93]">LET'S CONNECT EACH OTHER</p>
          <p className="text-[11px] text-[#AEAEB2] mt-0.5">Version 2.4.0 (iOS 18 Theme)</p>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {showEditProfile && (
        <ProfileEditModal
          currentUser={currentUser}
          onClose={() => setShowEditProfile(false)}
          onUpdate={onUpdateCurrentUser}
        />
      )}

      {/* PRIVACY SETTINGS MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] p-6 text-[#1C1C1E]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
              <h3 className="text-base font-semibold">Privacy Settings</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="p-1 rounded-full hover:bg-[#F2F2F7]">
                <X className="w-5 h-5 text-[#8E8E93]" />
              </button>
            </div>

            <div className="pt-4 space-y-4">
              {/* Profile Photo Visibility */}
              <div>
                <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                  Who can see my profile photo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['everyone', 'contacts', 'nobody'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPrivacyState(p => ({ ...p, profilePhoto: option }))}
                      className={`py-2 px-3 rounded-xl border text-xs capitalize font-medium transition ${
                        privacyState.profilePhoto === option
                          ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                          : 'border-[#E5E5EA] text-[#636366] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Last Seen Visibility */}
              <div>
                <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                  Who can see my Last Seen & Online
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['everyone', 'contacts', 'nobody'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPrivacyState(p => ({ ...p, lastSeen: option }))}
                      className={`py-2 px-3 rounded-xl border text-xs capitalize font-medium transition ${
                        privacyState.lastSeen === option
                          ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                          : 'border-[#E5E5EA] text-[#636366] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read Receipts */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm font-medium">Read Receipts</p>
                  <p className="text-xs text-[#8E8E93]">Show double silver ticks when messages are read</p>
                </div>
                <input
                  type="checkbox"
                  checked={privacyState.readReceipts}
                  onChange={(e) => setPrivacyState(p => ({ ...p, readReceipts: e.target.checked }))}
                  className="w-5 h-5 accent-[#1C1C1E] rounded cursor-pointer"
                />
              </div>

              {/* Status Privacy */}
              <div>
                <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                  Status Privacy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['everyone', 'contacts', 'nobody'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPrivacyState(p => ({ ...p, statusPrivacy: option }))}
                      className={`py-2 px-3 rounded-xl border text-xs capitalize font-medium transition ${
                        privacyState.statusPrivacy === option
                          ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                          : 'border-[#E5E5EA] text-[#636366] hover:bg-[#F2F2F7]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-6">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#636366] hover:bg-[#F2F2F7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrivacy}
                disabled={savingPrivacy}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] disabled:opacity-50 transition"
              >
                {savingPrivacy ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECOVERY CODE MODAL */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] p-6 text-[#1C1C1E]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#1C1C1E]" />
                <h3 className="text-base font-semibold">Account Recovery Code</h3>
              </div>
              <button onClick={() => setShowRecoveryModal(false)} className="p-1 rounded-full hover:bg-[#F2F2F7]">
                <X className="w-5 h-5 text-[#8E8E93]" />
              </button>
            </div>

            <div className="pt-4 space-y-4">
              <p className="text-xs text-[#636366]">
                Your recovery code allows you to securely reset your password if you ever forget it. Keep this code stored securely offline.
              </p>

              <div className="p-4 rounded-2xl bg-[#F2F2F7] border border-[#D1D1D6] text-center select-all">
                <p className="text-xs text-[#8E8E93] font-medium uppercase mb-1">Recovery Code</p>
                <p className="text-lg font-mono font-bold tracking-widest text-[#1C1C1E]">
                  {currentUser.recoveryCode || 'LAMAVI-SECURE-KEY'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentUser.recoveryCode || '');
                  alert('Recovery code copied to clipboard!');
                }}
                className="w-full py-2.5 rounded-xl bg-[#1C1C1E] text-white text-xs font-semibold hover:bg-[#2C2C2E] transition"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-200 p-6 text-[#1C1C1E]">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold">Permanently Delete Account</h3>
            </div>

            <p className="text-xs text-[#636366] leading-relaxed mb-4">
              This action will completely delete your account, chats, and messages. This action cannot be undone.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#1C1C1E]">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-300 bg-red-50/40 text-sm font-mono focus:outline-none focus:border-red-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[#636366] hover:bg-[#F2F2F7]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText.toLowerCase() !== 'delete'}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
