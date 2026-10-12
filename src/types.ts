/**
 * Shared Type Definitions for LAMAVI Messenger
 */

export interface UserPrivacySettings {
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  statusPrivacy: 'everyone' | 'contacts' | 'nobody';
}

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  bio: string;
  createdAt: number;
  lastSeen: number;
  isOnline: boolean;
  recoveryCode?: string;
  privacy: UserPrivacySettings;
  blockedUserIds: string[];
}

export interface PublicUserProfile {
  id: string;
  fullName: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: number;
}

export interface MessageReplyInfo {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image';
}

export interface Message {
  id: string;
  clientTempId?: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image';
  mediaUrl?: string | null;
  caption?: string | null;
  replyTo?: MessageReplyInfo | null;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'read';
  createdAt: number;
  deletedFor: string[];
  isDeletedForEveryone?: boolean;
}

export interface Conversation {
  id: string;
  participantIds: [string, string];
  otherUser?: PublicUserProfile;
  createdAt: number;
  updatedAt: number;
  lastMessage?: Message | null;
  unreadCount: number;
  clearedAt?: number;
}

export interface StatusViewer {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  viewedAt: number;
}

export interface StatusUpdate {
  id: string;
  userId: string;
  user?: PublicUserProfile;
  type: 'text' | 'image';
  content: string;
  mediaUrl?: string | null;
  backgroundColor: string;
  fontStyle: string;
  createdAt: number;
  expiresAt: number;
  viewers: StatusViewer[];
  hasViewed?: boolean;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

export interface RealtimeEvent {
  type: 
    | 'message:new' 
    | 'message:update' 
    | 'message:deleted' 
    | 'presence:update' 
    | 'status:new' 
    | 'status:delete'
    | 'typing'
    | 'conversation:clear';
  payload: any;
}
