import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Sparkles, Users, Settings as SettingsIcon,
  WifiOff, RefreshCw, LogIn, ChevronLeft 
} from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { ChatList } from './components/ChatList';
import { ChatScreen } from './components/ChatScreen';
import { StatusTab } from './components/StatusTab';
import { ContactsTab } from './components/ContactsTab';
import { SettingsTab } from './components/SettingsTab';
import { OfflineBanner } from './components/OfflineBanner';
import { BrandLogo } from './components/BrandLogo';
import { Avatar } from './components/Avatar';
import { apiRequest, getStoredToken, clearStoredToken } from './lib/api';
import { getOfflineQueue, syncOfflineQueue } from './lib/offlineQueue';
import type { UserProfile, Conversation, Message, RealtimeEvent } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'contacts' | 'settings'>('chats');
  
  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Network & Offline Status
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedMessagesCount, setQueuedMessagesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // SSE connection ref
  const eventSourceRef = useRef<EventSource | null>(null);

  // 1. Initial Authentication Check
  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setLoadingAuth(false);
        return;
      }
      try {
        const data = await apiRequest<{ user: UserProfile }>('/api/auth/me');
        setCurrentUser(data.user);
      } catch (err) {
        console.warn('Session expired or invalid:', err);
        clearStoredToken();
      } finally {
        setLoadingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // 2. Fetch Conversations
  const fetchConversations = async () => {
    if (!currentUser) return;
    try {
      const data = await apiRequest<{ conversations: Conversation[] }>('/api/conversations');
      setConversations(data.conversations);
      
      // Update active conversation object if it exists
      if (activeConversation) {
        const updated = data.conversations.find(c => c.id === activeConversation.id);
        if (updated) {
          setActiveConversation(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser]);

  // 3. Realtime SSE Connection
  useEffect(() => {
    const token = getStoredToken();
    if (!currentUser || !token || isOffline) return;

    const sse = new EventSource(`/api/realtime?token=${encodeURIComponent(token)}`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data: RealtimeEvent = JSON.parse(event.data);
        if (data.type === 'message:new') {
          const { message, conversationId } = data.payload;
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === conversationId);
            if (idx !== -1) {
              const updatedConv = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt };
              if (activeConversation?.id !== conversationId && message.senderId !== currentUser.id) {
                updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
              }
              const rest = prev.filter((_, i) => i !== idx);
              return [updatedConv, ...rest];
            } else {
              // Refresh full list if it's a new conversation
              fetchConversations();
              return prev;
            }
          });
        } else if (data.type === 'message:update' || data.type === 'message:deleted') {
          fetchConversations();
        } else if (data.type === 'presence:update') {
          const { userId, isOnline } = data.payload;
          setConversations(prev => prev.map(c => {
            if (c.otherUser && c.otherUser.id === userId) {
              return {
                ...c,
                otherUser: { ...c.otherUser, isOnline }
              };
            }
            return c;
          }));
        }
      } catch (e) {
        // ping or comment
      }
    };

    sse.onerror = () => {
      // Auto reconnects by browser standard
    };

    return () => {
      sse.close();
      eventSourceRef.current = null;
    };
  }, [currentUser, isOffline, activeConversation?.id]);

  // Periodic background conversations sync across devices
  useEffect(() => {
    if (!currentUser || isOffline) return;
    const interval = setInterval(() => {
      fetchConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser, isOffline]);

  // 4. Offline / Online Event Listeners & Auto-Sync
  useEffect(() => {
    const updateQueueCount = () => {
      setQueuedMessagesCount(getOfflineQueue().length);
    };
    updateQueueCount();

    const handleOnline = async () => {
      setIsOffline(false);
      setIsSyncing(true);
      try {
        await syncOfflineQueue();
        updateQueueCount();
        fetchConversations();
      } catch (err) {
        console.error('Queue sync error:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      updateQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearStoredToken();
    setCurrentUser(null);
    setActiveConversation(null);
    setConversations([]);
  };

  // Clear Chat History
  const handleClearHistory = async (convId: string) => {
    if (confirm('Are you sure you want to clear this chat history?')) {
      try {
        await apiRequest(`/api/conversations/${convId}/clear`, { method: 'POST' });
        fetchConversations();
      } catch (err: any) {
        alert(err.message || 'Failed to clear history');
      }
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (convId: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      try {
        await apiRequest(`/api/conversations/${convId}`, { method: 'DELETE' });
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (activeConversation?.id === convId) {
          setActiveConversation(null);
        }
      } catch (err: any) {
        alert(err.message || 'Failed to delete conversation');
      }
    }
  };

  // Block User
  const handleBlockUser = async (userId: string) => {
    if (!currentUser) return;
    const isCurrentlyBlocked = currentUser.blockedUserIds.includes(userId);
    const endpoint = isCurrentlyBlocked ? '/api/contacts/unblock' : '/api/contacts/block';
    try {
      const data = await apiRequest<{ success: boolean; blockedUserIds: string[] }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ targetUserId: userId })
      });
      setCurrentUser({
        ...currentUser,
        blockedUserIds: data.blockedUserIds
      });
    } catch (err: any) {
      alert(err.message || 'Failed to block/unblock');
    }
  };

  // Report User
  const handleReportUser = async (userId: string) => {
    const reason = prompt('Please enter the reason for reporting this account:');
    if (reason && reason.trim()) {
      try {
        await apiRequest('/api/reports', {
          method: 'POST',
          body: JSON.stringify({ targetUserId: userId, reason: reason.trim() })
        });
        alert('Thank you. The report has been received.');
      } catch (err: any) {
        alert(err.message || 'Failed to report user');
      }
    }
  };

  if (loadingAuth) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8F9FA] text-[#1C1C1E]">
        <BrandLogo size="lg" />
        <p className="mt-4 text-xs tracking-widest text-[#8E8E93] animate-pulse">CONNECTING TO LAMAVI...</p>
      </div>
    );
  }

  // If not logged in, render AuthModal
  if (!currentUser) {
    return <AuthModal onSuccess={(user) => setCurrentUser(user)} />;
  }

  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8F9FA] text-[#1C1C1E] overflow-hidden select-none">
      {/* Offline Status Top Alert */}
      <OfflineBanner 
        isOffline={isOffline} 
        queuedCount={queuedMessagesCount} 
        isSyncing={isSyncing} 
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* DESKTOP / TABLET SPLIT-SCREEN LAYOUT or MOBILE ADAPTIVE VIEW */}
        <div className="flex-1 flex w-full h-full overflow-hidden">
          
          {/* Main Sidebar: Chats, Status, Contacts, or Settings */}
          <div className={`flex flex-col h-full bg-white border-r border-[#E5E5EA] transition-all ${
            activeConversation ? 'hidden md:flex md:w-80 lg:w-96 shrink-0' : 'w-full md:w-80 lg:w-96 shrink-0'
          }`}>
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'chats' && (
                <ChatList
                  conversations={conversations}
                  activeConversationId={activeConversation?.id || null}
                  currentUser={currentUser}
                  onSelectConversation={(conv) => setActiveConversation(conv)}
                  onNewChat={() => setActiveTab('contacts')}
                  onDeleteConversation={handleDeleteConversation}
                  onClearHistory={handleClearHistory}
                />
              )}

              {activeTab === 'status' && (
                <StatusTab currentUser={currentUser} />
              )}

              {activeTab === 'contacts' && (
                <ContactsTab
                  currentUser={currentUser}
                  onOpenConversation={(conv) => {
                    setActiveConversation(conv);
                    setActiveTab('chats');
                    fetchConversations();
                  }}
                  onUpdateCurrentUser={setCurrentUser}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  currentUser={currentUser}
                  onUpdateCurrentUser={setCurrentUser}
                  onLogout={handleLogout}
                />
              )}
            </div>

            {/* iOS BOTTOM NAVIGATION BAR */}
            <div className="bg-white/95 backdrop-blur-xl border-t border-[#E5E5EA] px-2 py-1.5 flex items-center justify-around z-10 pb-safe">
              {/* Chats Tab */}
              <button
                onClick={() => { setActiveTab('chats'); }}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                  activeTab === 'chats' ? 'text-[#1C1C1E]' : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                <div className="relative">
                  <MessageCircle className="w-5 h-5 stroke-[2.2]" />
                  {totalUnreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1.5 min-w-4 h-4 rounded-full bg-[#1C1C1E] text-white text-[10px] font-bold flex items-center justify-center">
                      {totalUnreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium mt-0.5">Chats</span>
              </button>

              {/* Status Tab */}
              <button
                onClick={() => { setActiveTab('status'); }}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                  activeTab === 'status' ? 'text-[#1C1C1E]' : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-medium mt-0.5">Status</span>
              </button>

              {/* Contacts Tab */}
              <button
                onClick={() => { setActiveTab('contacts'); }}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                  activeTab === 'contacts' ? 'text-[#1C1C1E]' : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                <Users className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-medium mt-0.5">Contacts</span>
              </button>

              {/* Settings Tab */}
              <button
                onClick={() => { setActiveTab('settings'); }}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
                  activeTab === 'settings' ? 'text-[#1C1C1E]' : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                }`}
              >
                <SettingsIcon className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] font-medium mt-0.5">Settings</span>
              </button>
            </div>
          </div>

          {/* Right Main Panel: Active Chat Screen or Empty State */}
          <div className={`flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-hidden ${
            activeConversation ? 'flex' : 'hidden md:flex'
          }`}>
            {activeConversation ? (
              <ChatScreen
                conversation={activeConversation}
                currentUser={currentUser}
                onBack={() => setActiveConversation(null)}
                onClearHistory={handleClearHistory}
                onDeleteConversation={handleDeleteConversation}
                onBlockUser={handleBlockUser}
                onReportUser={handleReportUser}
                onUpdateConversationLastMessage={(convId, msg) => {
                  setConversations(prev => prev.map(c => c.id === convId ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c));
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#8E8E93]">
                <div className="p-4 rounded-3xl bg-white border border-[#E5E5EA] shadow-xs mb-2">
                  <BrandLogo size="lg" />
                </div>
                <h2 className="text-2xl font-bold text-[#1C1C1E] mt-3 tracking-tight">
                  Let's Connect Each Other
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-[#64748B] mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Pure White & Silver Elegance</span>
                </div>
                <p className="text-xs text-[#8E8E93] mt-2 max-w-sm">
                  Select a conversation from the sidebar or explore contacts to begin messaging in style.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('contacts')}
                    className="py-2.5 px-5 rounded-2xl bg-[#1C1C1E] text-white text-xs font-semibold hover:bg-[#2C2C2E] transition shadow-xs"
                  >
                    Explore Contacts
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
