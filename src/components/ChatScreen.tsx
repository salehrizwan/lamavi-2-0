import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Send, Paperclip, Smile, MoreVertical, Copy, 
  CornerUpLeft, Trash2, Check, CheckCheck, Clock, X, Image as ImageIcon,
  Eraser, Shield, Flag, Info
} from 'lucide-react';
import { Avatar } from './Avatar';
import { ImageViewerModal } from './ImageViewerModal';
import { apiRequest, compressImage } from '../lib/api';
import { addToOfflineQueue, getDraft, saveDraft } from '../lib/offlineQueue';
import type { Conversation, Message, UserProfile, MessageReplyInfo } from '../types';

interface ChatScreenProps {
  conversation: Conversation;
  currentUser: UserProfile;
  onBack: () => void;
  onClearHistory: (convId: string) => void;
  onDeleteConversation: (convId: string) => void;
  onBlockUser: (userId: string) => void;
  onReportUser: (userId: string) => void;
  onUpdateConversationLastMessage: (convId: string, msg: Message) => void;
}

const COMMON_EMOJIS = ['🤍', '✨', '🕊️', '💎', '🥂', '☕', '🌹', '🌿', '👍', '😊', '🙌', '🙏', '🔥', '💫', '🖤', '👌'];

export const ChatScreen: React.FC<ChatScreenProps> = ({
  conversation,
  currentUser,
  onBack,
  onClearHistory,
  onDeleteConversation,
  onBlockUser,
  onReportUser,
  onUpdateConversationLastMessage
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [replyTarget, setReplyTarget] = useState<MessageReplyInfo | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Image Upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isSendingImage, setIsSendingImage] = useState(false);

  // Full-screen Image Viewer
  const [activeImageModal, setActiveImageModal] = useState<{ url: string; caption?: string | null; time?: number } | null>(null);

  // Selected message for context menu (copy, reply, delete)
  const [contextMessage, setContextMessage] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const recipient = conversation.otherUser;
  const isBlocked = recipient ? currentUser.blockedUserIds.includes(recipient.id) : false;

  // Load drafted text if available
  useEffect(() => {
    const draft = getDraft(conversation.id);
    if (draft) setInputText(draft);
  }, [conversation.id]);

  // Save drafted text on unmount or input change
  const handleInputChange = (text: string) => {
    setInputText(text);
    saveDraft(conversation.id, text);
  };

  // Fetch initial messages for conversation
  const fetchMessages = async () => {
    try {
      const data = await apiRequest<{ messages: Message[] }>(`/api/conversations/${conversation.id}/messages`);
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Fast real-time sync every 2.5s to guarantee instant message delivery across separate devices and serverless instances
    const interval = setInterval(() => {
      fetchMessages();
    }, 2500);

    const handleStorageOrWindow = () => {
      fetchMessages();
    };
    window.addEventListener('storage', handleStorageOrWindow);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageOrWindow);
    };
  }, [conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content && !imagePreview) return;

    if (isBlocked) {
      alert('You have blocked this contact. Unblock to send messages.');
      return;
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowTime = Date.now();

    // Optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      clientTempId: tempId,
      conversationId: conversation.id,
      senderId: currentUser.id,
      receiverId: recipient?.id || '',
      content: content,
      type: 'text',
      replyTo: replyTarget,
      status: navigator.onLine ? 'sending' : 'pending',
      createdAt: nowTime,
      deletedFor: []
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setInputText('');
    saveDraft(conversation.id, '');
    setReplyTarget(null);
    setShowEmojiPicker(false);

    if (!navigator.onLine) {
      // Add to offline queue
      addToOfflineQueue({
        tempId,
        conversationId: conversation.id,
        content,
        type: 'text',
        replyTo: replyTarget,
        createdAt: nowTime
      });
      return;
    }

    try {
      const data = await apiRequest<{ message: Message }>(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          type: 'text',
          replyTo: replyTarget,
          clientTempId: tempId
        })
      });

      // Replace optimistic message with server message
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      onUpdateConversationLastMessage(conversation.id, data.message);
    } catch (err: any) {
      console.warn('Failed to send, queuing for offline:', err);
      // Mark as pending in queue
      addToOfflineQueue({
        tempId,
        conversationId: conversation.id,
        content,
        type: 'text',
        replyTo: replyTarget,
        createdAt: nowTime
      });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'pending' } : m));
    }
  };

  // Send Image Message
  const handleSendImage = async () => {
    if (!imagePreview) return;
    setIsSendingImage(true);

    const tempId = `temp_img_${Date.now()}`;
    const nowTime = Date.now();

    const optimisticMessage: Message = {
      id: tempId,
      conversationId: conversation.id,
      senderId: currentUser.id,
      receiverId: recipient?.id || '',
      content: imageCaption.trim() || 'Photo',
      type: 'image',
      mediaUrl: imagePreview,
      caption: imageCaption.trim() || null,
      status: 'sending',
      createdAt: nowTime,
      deletedFor: []
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setImagePreview(null);
    setImageCaption('');

    try {
      const data = await apiRequest<{ message: Message }>(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'image',
          mediaUrl: optimisticMessage.mediaUrl,
          caption: optimisticMessage.caption,
          clientTempId: tempId
        })
      });

      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      onUpdateConversationLastMessage(conversation.id, data.message);
    } catch (err: any) {
      alert('Failed to send image: ' + err.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleSelectImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      const compressed = await compressImage(file, 1280, 1280, 0.82);
      setImagePreview(compressed);
    } catch (err: any) {
      alert('Failed to load image: ' + err.message);
    }
  };

  // Message Actions
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMessage(null);
  };

  const handleReplyMessage = (msg: Message) => {
    setReplyTarget({
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderId === currentUser.id ? 'You' : (recipient?.fullName || 'User'),
      content: msg.type === 'image' ? '📷 Photo' : msg.content,
      type: msg.type
    });
    setContextMessage(null);
    textareaRef.current?.focus();
  };

  const handleDeleteMessage = async (msg: Message, forEveryone: boolean) => {
    setContextMessage(null);
    try {
      await apiRequest(`/api/messages/${msg.id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ forEveryone })
      });

      if (forEveryone) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isDeletedForEveryone: true, content: 'This message was deleted' } : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  // Render Status Ticks
  const renderTicks = (msg: Message) => {
    if (msg.senderId !== currentUser.id) return null;
    if (msg.status === 'pending') {
      return <Clock className="w-3 h-3 text-[#AEAEB2]" />;
    }
    if (msg.status === 'sending') {
      return <Clock className="w-3 h-3 text-[#AEAEB2] animate-pulse" />;
    }
    if (msg.status === 'sent') {
      return <Check className="w-3.5 h-3.5 text-[#8E8E93]" />;
    }
    if (msg.status === 'delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-[#8E8E93]" />;
    }
    if (msg.status === 'read') {
      return <CheckCheck className="w-3.5 h-3.5 text-[#1C1C1E] font-bold" />;
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-hidden select-none">
      {/* iOS CHAT HEADER */}
      <div className="px-3 py-2.5 bg-white/95 backdrop-blur-md border-b border-[#E5E5EA] flex items-center justify-between z-20 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center text-[#1C1C1E] hover:opacity-75 -ml-1 pr-1 font-medium text-sm transition"
          >
            <ChevronLeft className="w-6 h-6 -mr-1" />
            <span className="hidden sm:inline">Chats</span>
          </button>

          <Avatar
            name={recipient?.fullName || 'User'}
            avatarUrl={recipient?.avatarUrl}
            size="sm"
            isOnline={recipient?.isOnline}
            showOnlineStatus
          />

          <div className="min-w-0 ml-1">
            <h2 className="text-sm font-semibold text-[#1C1C1E] leading-tight truncate">
              {recipient?.fullName || 'Chat'}
            </h2>
            <p className="text-[11px] text-[#8E8E93] leading-tight truncate">
              {isBlocked 
                ? 'Contact Blocked' 
                : recipient?.isOnline 
                  ? 'Online' 
                  : recipient?.lastSeen 
                    ? `Last seen ${new Date(recipient.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                    : `@${recipient?.username || 'user'}`}
            </p>
          </div>
        </div>

        {/* Header Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-[#F2F2F7] text-[#636366] transition"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div 
              className="absolute right-0 top-10 z-30 w-48 bg-white rounded-2xl shadow-xl border border-[#E5E5EA] py-1.5 text-xs text-[#1C1C1E] animate-in fade-in"
              onClick={() => setShowMenu(false)}
            >
              <button
                onClick={() => onClearHistory(conversation.id)}
                className="w-full px-3.5 py-2 text-left hover:bg-[#F2F2F7] flex items-center gap-2.5"
              >
                <Eraser className="w-4 h-4 text-[#8E8E93]" />
                <span>Clear Chat History</span>
              </button>
              <button
                onClick={() => onDeleteConversation(conversation.id)}
                className="w-full px-3.5 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Chat</span>
              </button>
              {recipient && (
                <>
                  <div className="my-1 border-t border-[#F2F2F7]" />
                  <button
                    onClick={() => onBlockUser(recipient.id)}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#F2F2F7] flex items-center gap-2.5"
                  >
                    <Shield className="w-4 h-4 text-[#8E8E93]" />
                    <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                  </button>
                  <button
                    onClick={() => onReportUser(recipient.id)}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#F2F2F7] text-red-500 flex items-center gap-2.5"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Report User</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingMessages ? (
          <div className="p-8 text-center text-xs text-[#8E8E93]">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#8E8E93]">
            <Avatar name={recipient?.fullName || 'User'} avatarUrl={recipient?.avatarUrl} size="xl" />
            <h3 className="text-base font-semibold text-[#1C1C1E] mt-3">{recipient?.fullName}</h3>
            <p className="text-xs font-mono text-[#8E8E93]">@{recipient?.username}</p>
            {recipient?.bio && <p className="text-xs text-[#636366] mt-1 max-w-xs">{recipient.bio}</p>}
            <p className="text-xs text-[#AEAEB2] mt-4">This is the start of your private, refined conversation on LAMAVI.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.senderId === currentUser.id;
            const isDeleted = msg.isDeletedForEveryone;

            return (
              <div 
                key={msg.id || index} 
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}
              >
                <div
                  onClick={() => setContextMessage(contextMessage?.id === msg.id ? null : msg)}
                  className={`relative max-w-[82%] sm:max-w-[70%] rounded-2xl p-3 shadow-2xs transition-all cursor-pointer ${
                    isMine 
                      ? 'bg-gradient-to-br from-[#E2E8F0] via-[#F1F3F5] to-[#CBD5E1] text-[#1C1C1E] border border-[#CBD5E1]/60 rounded-tr-xs' 
                      : 'bg-white text-[#1C1C1E] border border-[#E5E5EA] rounded-tl-xs'
                  }`}
                >
                  {/* Quoted reply banner */}
                  {msg.replyTo && (
                    <div className="mb-2 p-2 rounded-xl bg-black/5 border-l-3 border-[#8E8E93] text-xs">
                      <p className="font-semibold text-[11px] text-[#1C1C1E]">{msg.replyTo.senderName}</p>
                      <p className="text-[11px] text-[#636366] line-clamp-1">{msg.replyTo.content}</p>
                    </div>
                  )}

                  {/* Image attachment */}
                  {msg.type === 'image' && msg.mediaUrl && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageModal({
                          url: msg.mediaUrl!,
                          caption: msg.caption,
                          time: msg.createdAt
                        });
                      }}
                      className="mb-1.5 rounded-xl overflow-hidden cursor-zoom-in"
                    >
                      <img 
                        src={msg.mediaUrl} 
                        alt="Attachment" 
                        className="max-h-64 w-full object-cover rounded-xl hover:scale-101 transition-transform" 
                      />
                    </div>
                  )}

                  {/* Message content text */}
                  {(!msg.type || msg.type === 'text' || msg.caption) && (
                    <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${isDeleted ? 'italic text-[#8E8E93]' : ''}`}>
                      {msg.type === 'image' ? msg.caption : msg.content}
                    </p>
                  )}

                  {/* Timestamp and Delivery ticks */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8E8E93]">
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {renderTicks(msg)}
                  </div>
                </div>

                {/* CONTEXT ACTIONS MENU (on message tap/click) */}
                {contextMessage?.id === msg.id && (
                  <div className="mt-1 flex items-center gap-1 bg-white border border-[#E5E5EA] shadow-md rounded-xl p-1 z-10 text-xs text-[#1C1C1E] animate-in fade-in">
                    <button
                      onClick={() => handleReplyMessage(msg)}
                      className="p-1.5 hover:bg-[#F2F2F7] rounded-lg flex items-center gap-1"
                      title="Reply"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5 text-[#636366]" />
                      <span className="text-[11px]">Reply</span>
                    </button>
                    <button
                      onClick={() => handleCopyMessage(msg.content)}
                      className="p-1.5 hover:bg-[#F2F2F7] rounded-lg flex items-center gap-1"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#636366]" />
                      <span className="text-[11px]">Copy</span>
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(msg, false)}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-1"
                      title="Delete for me"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">For me</span>
                    </button>
                    {isMine && !isDeleted && (
                      <button
                        onClick={() => handleDeleteMessage(msg, true)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-1"
                        title="Delete for everyone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Everyone</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* IMAGE PREVIEW DRAWER (before sending) */}
      {imagePreview && (
        <div className="p-3 bg-white border-t border-[#E5E5EA] flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E5E5EA] shrink-0">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Add caption..."
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-[#F2F2F7] text-xs outline-none focus:bg-white border border-transparent focus:border-[#D1D1D6]"
            />
          </div>
          <button
            onClick={handleSendImage}
            disabled={isSendingImage}
            className="p-2.5 rounded-xl bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* REPLY TARGET BANNER */}
      {replyTarget && (
        <div className="px-4 py-2 bg-[#F2F2F7] border-t border-[#E5E5EA] flex items-center justify-between text-xs">
          <div className="border-l-3 border-[#1C1C1E] pl-2.5">
            <span className="font-semibold text-[#1C1C1E]">Replying to {replyTarget.senderName}</span>
            <p className="text-[#636366] line-clamp-1 text-[11px]">{replyTarget.content}</p>
          </div>
          <button onClick={() => setReplyTarget(null)} className="p-1 text-[#8E8E93] hover:text-[#1C1C1E]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* QUICK EMOJI BAR */}
      {showEmojiPicker && (
        <div className="p-2 bg-white border-t border-[#E5E5EA] flex items-center gap-2 overflow-x-auto">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputText(prev => prev + emoji);
                saveDraft(conversation.id, inputText + emoji);
              }}
              className="text-lg p-1.5 hover:bg-[#F2F2F7] rounded-lg transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM INPUT BAR */}
      <div className="p-2.5 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] flex items-end gap-2 pb-safe">
        {/* Photo Gallery attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-full hover:bg-[#F2F2F7] text-[#636366] transition shrink-0"
          title="Attach Image"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleSelectImageFile}
          accept="image/*"
          className="hidden"
        />

        {/* Emoji trigger */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-2.5 rounded-full transition shrink-0 ${
            showEmojiPicker ? 'bg-[#1C1C1E] text-white' : 'hover:bg-[#F2F2F7] text-[#636366]'
          }`}
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Multiline expandable text input */}
        <div className="flex-1 bg-[#F2F2F7] rounded-2xl border border-transparent focus-within:border-[#D1D1D6] focus-within:bg-white transition px-3 py-1.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Message..."
            className="w-full bg-transparent text-sm text-[#1C1C1E] outline-none resize-none max-h-32 placeholder:text-[#AEAEB2]"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-2.5 rounded-full bg-[#1C1C1E] text-white hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* LIGHTBOX IMAGE VIEWER */}
      {activeImageModal && (
        <ImageViewerModal
          imageUrl={activeImageModal.url}
          senderName={recipient?.fullName}
          caption={activeImageModal.caption}
          timestamp={activeImageModal.time}
          onClose={() => setActiveImageModal(null)}
        />
      )}
    </div>
  );
};
