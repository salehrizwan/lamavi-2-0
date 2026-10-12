import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Shield, ShieldAlert, Check, UserX, AlertCircle, X, Flag } from 'lucide-react';
import { Avatar } from './Avatar';
import { apiRequest } from '../lib/api';
import type { PublicUserProfile, UserProfile, Conversation } from '../types';

interface ContactsTabProps {
  currentUser: UserProfile;
  onOpenConversation: (conv: Conversation) => void;
  onUpdateCurrentUser: (user: UserProfile) => void;
}

export const ContactsTab: React.FC<ContactsTabProps> = ({
  currentUser,
  onOpenConversation,
  onUpdateCurrentUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserProfile[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [contacts, setContacts] = useState<(PublicUserProfile & { isBlocked?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  // Report Modal state
  const [reportingUser, setReportingUser] = useState<PublicUserProfile | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const fetchContacts = async () => {
    try {
      const data = await apiRequest<{ contacts: (PublicUserProfile & { isBlocked?: boolean })[] }>('/api/contacts');
      setContacts(data.contacts);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await apiRequest<{ users: PublicUserProfile[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(data.users);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (targetUser: PublicUserProfile) => {
    try {
      const data = await apiRequest<{ conversation: Conversation }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ recipientId: targetUser.id })
      });
      onOpenConversation(data.conversation);
    } catch (err: any) {
      alert(err.message || 'Could not start conversation');
    }
  };

  const handleToggleBlock = async (targetUserId: string, isCurrentlyBlocked: boolean) => {
    try {
      const endpoint = isCurrentlyBlocked ? '/api/contacts/unblock' : '/api/contacts/block';
      const data = await apiRequest<{ success: boolean; blockedUserIds: string[] }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
      });

      // Update current user blocked list
      onUpdateCurrentUser({
        ...currentUser,
        blockedUserIds: data.blockedUserIds
      });

      // Update local contacts list state
      setContacts(prev => prev.map(c => c.id === targetUserId ? { ...c, isBlocked: !isCurrentlyBlocked } : c));
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingUser || !reportReason.trim()) return;

    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: reportingUser.id,
          reason: reportReason.trim()
        })
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setReportSubmitted(false);
        setReportingUser(null);
        setReportReason('');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit report');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 pt-4 pb-3 bg-white/90 backdrop-blur-md border-b border-[#E5E5EA]">
        <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E] mb-3">Contacts & Search</h1>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8E8E93]" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim().length === 0) {
                setSearchResults(null);
                setHasSearched(false);
              }
            }}
            className="w-full pl-10 pr-20 py-2 rounded-xl bg-[#F2F2F7] border border-transparent focus:border-[#D1D1D6] focus:bg-white text-sm outline-none transition"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 rounded-lg bg-[#1C1C1E] text-white text-xs font-medium hover:bg-[#2C2C2E] transition"
          >
            Find
          </button>
        </form>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">
        {/* SEARCH RESULTS SECTION */}
        {hasSearched && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider px-1">
              Search Results
            </p>
            {isSearching ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E5EA] text-xs text-[#8E8E93]">
                Searching accounts...
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] shadow-2xs overflow-hidden">
                {searchResults.map((user) => {
                  const isBlocked = currentUser.blockedUserIds.includes(user.id);
                  return (
                    <div key={user.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={user.fullName}
                          avatarUrl={user.avatarUrl}
                          size="md"
                          isOnline={user.isOnline}
                          showOnlineStatus
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#1C1C1E] truncate">{user.fullName}</h4>
                          <p className="text-xs font-mono text-[#8E8E93]">@{user.username}</p>
                          {user.bio && (
                            <p className="text-xs text-[#636366] mt-0.5 truncate max-w-xs">{user.bio}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleStartChat(user)}
                          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#1C1C1E] text-white text-xs font-medium hover:bg-[#2C2C2E] transition shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E5EA]">
                <UserX className="w-8 h-8 text-[#AEAEB2] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#1C1C1E]">No user found</p>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  Check the exact username or registered email address.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ALL REGISTERED CONTACTS DIRECTORY */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
              Community Directory ({contacts.length})
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E5EA] divide-y divide-[#F2F2F7] shadow-2xs overflow-hidden">
            {contacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8E8E93]">
                No other registered users found. Invite someone or create a second test account!
              </div>
            ) : (
              contacts.map((user) => {
                const isBlocked = currentUser.blockedUserIds.includes(user.id);
                return (
                  <div key={user.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#FDFDFE] transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar
                        name={user.fullName}
                        avatarUrl={user.avatarUrl}
                        size="md"
                        isOnline={user.isOnline}
                        showOnlineStatus
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-semibold text-[#1C1C1E] truncate">{user.fullName}</h4>
                          {isBlocked && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 rounded">
                              Blocked
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-[#8E8E93]">@{user.username}</p>
                        {user.bio && (
                          <p className="text-xs text-[#636366] mt-0.5 truncate">{user.bio}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartChat(user)}
                        className="p-2 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E] transition"
                        title="Chat"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleBlock(user.id, isBlocked)}
                        className={`p-2 rounded-xl transition ${
                          isBlocked 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : 'hover:bg-[#F2F2F7] text-[#8E8E93] hover:text-[#1C1C1E]'
                        }`}
                        title={isBlocked ? 'Unblock user' : 'Block user'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setReportingUser(user)}
                        className="p-2 rounded-xl hover:bg-[#F2F2F7] text-[#8E8E93] hover:text-red-500 transition"
                        title="Report user"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* REPORT USER MODAL */}
      {reportingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5E5EA] p-6 text-[#1C1C1E]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                <Flag className="w-4 h-4" />
                <span>Report Account</span>
              </div>
              <button onClick={() => setReportingUser(null)} className="p-1 rounded-full hover:bg-[#F2F2F7]">
                <X className="w-5 h-5 text-[#8E8E93]" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-8 text-center space-y-2">
                <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold">Report Submitted</p>
                <p className="text-xs text-[#8E8E93]">Thank you for keeping LAMAVI clean and safe.</p>
              </div>
            ) : (
              <form onSubmit={submitReport} className="pt-4 space-y-4">
                <p className="text-xs text-[#636366]">
                  Reporting user <strong className="text-[#1C1C1E]">@{reportingUser.username}</strong> ({reportingUser.fullName}).
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#636366] uppercase tracking-wider mb-1.5">
                    Reason for report
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Describe abusive behavior, spam, impersonation, or harassment..."
                    className="w-full p-3 rounded-xl bg-[#F8F9FA] border border-[#E5E5EA] text-xs focus:outline-none focus:border-[#8E8E93] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportingUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#636366] hover:bg-[#F2F2F7]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
