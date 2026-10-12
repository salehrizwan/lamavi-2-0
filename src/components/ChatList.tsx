import React, { useState } from 'react';
import { Search, SquarePen, Clock, Check, CheckCheck, Trash2, Eraser, MoreVertical, ShieldAlert } from 'lucide-react';
import { Avatar } from './Avatar';
import { BrandLogo } from './BrandLogo';
import type { Conversation, UserProfile } from '../types';

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  currentUser: UserProfile;
  onSelectConversation: (conv: Conversation) => void;
  onNewChat: () => void;
  onDeleteConversation: (convId: string) => void;
  onClearHistory: (convId: string) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  conversations,
  activeConversationId,
  currentUser,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onClearHistory
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [menuOpenConvId, setMenuOpenConvId] = useState<string | null>(null);

  // Filter conversations by contact name, username, or last message
  const filtered = conversations.filter(c => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const nameMatch = c.otherUser?.fullName.toLowerCase().includes(q);
    const userMatch = c.otherUser?.username.toLowerCase().includes(q);
    const msgMatch = c.lastMessage?.content.toLowerCase().includes(q);
    return nameMatch || userMatch || msgMatch;
  });

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderStatusTick = (status?: string, isSelf?: boolean) => {
    if (!isSelf) return null;
    if (status === 'pending') {
      return <Clock className="w-3.5 h-3.5 text-[#AEAEB2] shrink-0" />;
    }
    if (status === 'sent') {
      return <Check className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />;
    }
    if (status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />;
    }
    if (status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-[#1C1C1E] font-bold shrink-0" />;
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] border-r border-[#E5E5EA] overflow-hidden">
      {/* Top Bar */}
      <div className="px-5 pt-4 pb-3 bg-white/90 backdrop-blur-md border-b border-[#E5E5EA]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" showText={false} />
            <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">Chats</h1>
          </div>
          <button
            onClick={onNewChat}
            className="p-2 rounded-full bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] transition shadow-xs"
            title="Start New Chat"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-[#8E8E93]" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F2F2F7] border border-transparent focus:border-[#D1D1D6] focus:bg-white text-sm outline-none transition"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F2F2F7]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-[#1C1C1E]">No conversations yet</p>
            <p className="text-xs text-[#8E8E93] mt-1 max-w-xs mx-auto">
              Tap the new chat icon above or browse Contacts to start messaging.
            </p>
            <button
              onClick={onNewChat}
              className="mt-4 px-4 py-2 rounded-xl bg-[#1C1C1E] text-white text-xs font-semibold hover:bg-[#2C2C2E] transition shadow-xs"
            >
              Start a Conversation
            </button>
          </div>
        ) : (
          filtered.map(conv => {
            const other = conv.otherUser;
            const isSelected = conv.id === activeConversationId;
            const lastMsg = conv.lastMessage;
            const isLastMsgMine = lastMsg ? lastMsg.senderId === currentUser.id : false;
            const isBlocked = other ? currentUser.blockedUserIds.includes(other.id) : false;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`group relative flex items-center justify-between p-3.5 transition cursor-pointer ${
                  isSelected ? 'bg-[#E5E5EA]/50' : 'hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <Avatar
                    name={other?.fullName || 'Contact'}
                    avatarUrl={other?.avatarUrl}
                    size="md"
                    isOnline={other?.isOnline}
                    showOnlineStatus
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[#1C1C1E] truncate">
                        {other?.fullName || 'Unknown'}
                      </h4>
                      <span className="text-[11px] text-[#8E8E93] shrink-0 ml-2">
                        {formatTimestamp(lastMsg?.createdAt || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 min-w-0 pr-2 text-xs text-[#636366] truncate">
                        {renderStatusTick(lastMsg?.status, isLastMsgMine)}
                        {lastMsg ? (
                          <span className={`truncate ${conv.unreadCount > 0 ? 'font-semibold text-[#1C1C1E]' : ''}`}>
                            {lastMsg.type === 'image' ? '📷 Photo' : lastMsg.content}
                          </span>
                        ) : (
                          <span className="italic text-[#AEAEB2]">No messages yet</span>
                        )}
                      </div>

                      {/* Unread badge */}
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-[#1C1C1E] text-white text-[11px] font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions popup toggle */}
                <div className="relative ml-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenConvId(menuOpenConvId === conv.id ? null : conv.id);
                    }}
                    className="p-1 rounded-full hover:bg-[#E5E5EA] text-[#8E8E93]"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuOpenConvId === conv.id && (
                    <div 
                      className="absolute right-0 top-6 z-30 w-44 bg-white rounded-xl shadow-xl border border-[#E5E5EA] py-1 text-xs text-[#1C1C1E] animate-in fade-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setMenuOpenConvId(null);
                          onClearHistory(conv.id);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[#F2F2F7] flex items-center gap-2"
                      >
                        <Eraser className="w-3.5 h-3.5 text-[#8E8E93]" />
                        <span>Clear Chat History</span>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpenConvId(null);
                          onDeleteConversation(conv.id);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Conversation</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
