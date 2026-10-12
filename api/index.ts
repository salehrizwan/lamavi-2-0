import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { 
  UserProfile, 
  Message, 
  Conversation, 
  StatusUpdate, 
  PublicUserProfile,
  RealtimeEvent 
} from '../src/types';
import { getSupabase } from './supabaseClient';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;

// File persistence location
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

interface DatabaseSchema {
  users: UserProfile[];
  passwords: Record<string, { salt: string; hash: string }>; // userId -> credentials
  conversations: Array<{
    id: string;
    participantIds: [string, string];
    createdAt: number;
    updatedAt: number;
    clearedTimestamps: Record<string, number>;
    deletedForUsers: string[];
    unreadCounts: Record<string, number>;
  }>;
  messages: Message[];
  statuses: StatusUpdate[];
  reports: Array<{
    id: string;
    reporterId: string;
    reportedUserId: string;
    reason: string;
    createdAt: number;
  }>;
}

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

// Password hashing helper
function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { salt: string; hash: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return hash === expectedHash;
}

function generateToken(userId: string): string {
  const timestamp = Date.now();
  const raw = `${userId}:${timestamp}`;
  const sig = crypto.createHmac('sha256', 'lamavi-secret-key-2026').update(raw).digest('hex');
  return Buffer.from(`${raw}:${sig}`).toString('base64');
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, timestampStr, sig] = decoded.split(':');
    if (!userId || !timestampStr || !sig) return null;
    const raw = `${userId}:${timestampStr}`;
    const expectedSig = crypto.createHmac('sha256', 'lamavi-secret-key-2026').update(raw).digest('hex');
    if (sig === expectedSig) {
      return userId;
    }
  } catch {
    return null;
  }
  return null;
}

// Initial seed demo users
const now = Date.now();
const initialDb: DatabaseSchema = {
  users: [
    {
      id: 'usr_sophia',
      fullName: 'Sophia Vance',
      username: 'sophia_vance',
      email: 'sophia@lamavi.luxury',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'Architect & minimalist aesthetician • Geneva',
      createdAt: now - 86400000 * 5,
      lastSeen: now - 1000 * 60 * 3,
      isOnline: true,
      recoveryCode: 'LAMAVI-SPH1-9872',
      privacy: {
        profilePhoto: 'everyone',
        lastSeen: 'everyone',
        readReceipts: true,
        statusPrivacy: 'everyone'
      },
      blockedUserIds: []
    },
    {
      id: 'usr_julian',
      fullName: 'Julian Sterling',
      username: 'julian_silver',
      email: 'julian@lamavi.luxury',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      bio: 'Curating timeless craftsmanship in silver and porcelain.',
      createdAt: now - 86400000 * 10,
      lastSeen: now - 1000 * 60 * 25,
      isOnline: false,
      recoveryCode: 'LAMAVI-JLN2-4410',
      privacy: {
        profilePhoto: 'everyone',
        lastSeen: 'everyone',
        readReceipts: true,
        statusPrivacy: 'everyone'
      },
      blockedUserIds: []
    },
    {
      id: 'usr_clara',
      fullName: 'Clara Mercier',
      username: 'clara_m',
      email: 'clara@lamavi.luxury',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      bio: 'Creative director. Paris & Kyoto.',
      createdAt: now - 86400000 * 8,
      lastSeen: now - 1000 * 60 * 60 * 2,
      isOnline: false,
      recoveryCode: 'LAMAVI-CLR3-8821',
      privacy: {
        profilePhoto: 'everyone',
        lastSeen: 'everyone',
        readReceipts: true,
        statusPrivacy: 'everyone'
      },
      blockedUserIds: []
    }
  ],
  passwords: {
    usr_sophia: hashPassword('Pass1234'),
    usr_julian: hashPassword('Silver01'),
    usr_clara: hashPassword('Clara999')
  },
  conversations: [
    {
      id: 'conv_sophia_julian',
      participantIds: ['usr_sophia', 'usr_julian'],
      createdAt: now - 86400000,
      updatedAt: now - 1000 * 60 * 20,
      clearedTimestamps: {},
      deletedForUsers: [],
      unreadCounts: {
        usr_julian: 0,
        usr_sophia: 0
      }
    }
  ],
  messages: [
    {
      id: 'msg_seed_1',
      conversationId: 'conv_sophia_julian',
      senderId: 'usr_julian',
      receiverId: 'usr_sophia',
      content: 'Good morning Sophia. Did you receive the platinum architectural blueprints for the gallery?',
      type: 'text',
      status: 'read',
      createdAt: now - 1000 * 60 * 35,
      deletedFor: []
    },
    {
      id: 'msg_seed_2',
      conversationId: 'conv_sophia_julian',
      senderId: 'usr_sophia',
      receiverId: 'usr_julian',
      content: 'Yes! The silver finishes and marble accents look magnificent. The lighting harmony is flawless.',
      type: 'text',
      status: 'read',
      createdAt: now - 1000 * 60 * 20,
      deletedFor: []
    }
  ],
  statuses: [
    {
      id: 'st_sophia_1',
      userId: 'usr_sophia',
      type: 'text',
      content: 'Simplicity is the ultimate sophistication. ✨',
      backgroundColor: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
      fontStyle: 'font-serif italic',
      createdAt: now - 1000 * 60 * 45,
      expiresAt: now + 86400000 - 1000 * 60 * 45,
      viewers: []
    },
    {
      id: 'st_julian_1',
      userId: 'usr_julian',
      type: 'image',
      content: 'New sterling silverware exhibition in Zurich.',
      mediaUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
      backgroundColor: '#1C1C1E',
      fontStyle: 'font-sans',
      createdAt: now - 1000 * 60 * 90,
      expiresAt: now + 86400000 - 1000 * 60 * 90,
      viewers: []
    }
  ],
  reports: []
};

// Database class with dual Supabase + Persistent JSON storage
class Database {
  private data: DatabaseSchema;
  private supabase = getSupabase();

  constructor() {
    this.data = initialDb;
    this.load();
    if (this.supabase) {
      this.initSupabaseSeed().catch(err => {
        console.warn('[LAMAVI DB] Supabase initial check warning:', err.message);
      });
    }
  }

  private load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        this.data = initialDb;
        this.save();
      }
    } else {
      this.data = initialDb;
      this.save();
    }
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  private async initSupabaseSeed() {
    if (!this.supabase) return;
    try {
      const { data } = await this.supabase.from('users').select('id').limit(1);
      if (!data || data.length === 0) {
        // Seed default users in Supabase
        for (const u of initialDb.users) {
          const pass = initialDb.passwords[u.id];
          await this.supabase.from('users').insert({
            id: u.id,
            full_name: u.fullName,
            username: u.username,
            email: u.email,
            avatar_url: u.avatarUrl,
            bio: u.bio,
            created_at: u.createdAt,
            last_seen: u.lastSeen,
            is_online: u.isOnline,
            recovery_code: u.recoveryCode,
            privacy: u.privacy,
            blocked_user_ids: u.blockedUserIds,
            password_salt: pass.salt,
            password_hash: pass.hash
          });
        }
      }
    } catch (_) {}
  }

  private mapDbUser(row: any): UserProfile {
    return {
      id: row.id,
      fullName: row.full_name || row.fullName,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatar_url || row.avatarUrl,
      bio: row.bio,
      createdAt: Number(row.created_at || row.createdAt),
      lastSeen: Number(row.last_seen || row.lastSeen),
      isOnline: Boolean(row.is_online !== undefined ? row.is_online : row.isOnline),
      recoveryCode: row.recovery_code || row.recoveryCode,
      privacy: typeof row.privacy === 'string' ? JSON.parse(row.privacy) : (row.privacy || { profilePhoto: 'everyone', lastSeen: 'everyone', readReceipts: true, statusPrivacy: 'everyone' }),
      blockedUserIds: Array.isArray(row.blocked_user_ids) ? row.blocked_user_ids : (row.blockedUserIds || [])
    };
  }

  private mapDbConversation(row: any) {
    return {
      id: row.id,
      participantIds: (Array.isArray(row.participant_ids) ? row.participant_ids : row.participantIds) as [string, string],
      createdAt: Number(row.created_at || row.createdAt),
      updatedAt: Number(row.updated_at || row.updatedAt),
      clearedTimestamps: typeof row.cleared_timestamps === 'string' ? JSON.parse(row.cleared_timestamps) : (row.cleared_timestamps || row.clearedTimestamps || {}),
      deletedForUsers: Array.isArray(row.deleted_for_users) ? row.deleted_for_users : (row.deletedForUsers || []),
      unreadCounts: typeof row.unread_counts === 'string' ? JSON.parse(row.unread_counts) : (row.unread_counts || row.unreadCounts || {})
    };
  }

  private mapDbMessage(row: any): Message {
    return {
      id: row.id,
      clientTempId: row.client_temp_id || row.clientTempId,
      conversationId: row.conversation_id || row.conversationId,
      senderId: row.sender_id || row.senderId,
      receiverId: row.receiver_id || row.receiverId,
      content: row.content || '',
      type: row.type || 'text',
      mediaUrl: row.media_url || row.mediaUrl,
      caption: row.caption,
      replyTo: row.reply_to || row.replyTo,
      status: row.status || 'sent',
      createdAt: Number(row.created_at || row.createdAt),
      deletedFor: Array.isArray(row.deleted_for) ? row.deleted_for : (row.deletedFor || []),
      isDeletedForEveryone: Boolean(row.is_deleted_for_everyone !== undefined ? row.is_deleted_for_everyone : row.isDeletedForEveryone)
    };
  }

  public async getUsers(): Promise<UserProfile[]> {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('users').select('*');
        if (data && data.length > 0) {
          return data.map(r => this.mapDbUser(r));
        }
      } catch (_) {}
    }
    return this.data.users;
  }

  public async getUserById(id: string): Promise<UserProfile | undefined> {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('users').select('*').eq('id', id).maybeSingle();
        if (data) return this.mapDbUser(data);
      } catch (_) {}
    }
    return this.data.users.find(u => u.id === id);
  }

  public async getUserByUsername(username: string): Promise<UserProfile | undefined> {
    const cleanU = username.toLowerCase().trim();
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('users').select('*').ilike('username', cleanU).maybeSingle();
        if (data) return this.mapDbUser(data);
      } catch (_) {}
    }
    return this.data.users.find(u => u.username.toLowerCase() === cleanU);
  }

  public async getUserByEmail(email: string): Promise<UserProfile | undefined> {
    const cleanE = email.toLowerCase().trim();
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('users').select('*').ilike('email', cleanE).maybeSingle();
        if (data) return this.mapDbUser(data);
      } catch (_) {}
    }
    return this.data.users.find(u => u.email && u.email.toLowerCase() === cleanE);
  }

  public async addUser(user: UserProfile, pass: { salt: string; hash: string }): Promise<void> {
    this.data.users.push(user);
    this.data.passwords[user.id] = pass;
    this.save();

    if (this.supabase) {
      try {
        await this.supabase.from('users').upsert({
          id: user.id,
          full_name: user.fullName,
          username: user.username,
          email: user.email,
          avatar_url: user.avatarUrl,
          bio: user.bio,
          created_at: user.createdAt,
          last_seen: user.lastSeen,
          is_online: user.isOnline,
          recovery_code: user.recoveryCode,
          privacy: user.privacy,
          blocked_user_ids: user.blockedUserIds,
          password_salt: pass.salt,
          password_hash: pass.hash
        });
      } catch (err: any) {
        console.error('[LAMAVI DB] Supabase addUser error:', err.message);
      }
    }
  }

  public async getPassword(userId: string): Promise<{ salt: string; hash: string } | undefined> {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('users').select('password_salt, password_hash').eq('id', userId).maybeSingle();
        if (data && data.password_salt && data.password_hash) {
          return { salt: data.password_salt, hash: data.password_hash };
        }
      } catch (_) {}
    }
    return this.data.passwords[userId];
  }

  public async setPassword(userId: string, pass: { salt: string; hash: string }): Promise<void> {
    this.data.passwords[userId] = pass;
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.from('users').update({
          password_salt: pass.salt,
          password_hash: pass.hash
        }).eq('id', userId);
      } catch (_) {}
    }
  }

  public async updateUser(user: UserProfile): Promise<void> {
    const idx = this.data.users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      this.data.users[idx] = user;
      this.save();
    }
    if (this.supabase) {
      try {
        await this.supabase.from('users').update({
          full_name: user.fullName,
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatar_url: user.avatarUrl,
          is_online: user.isOnline,
          last_seen: user.lastSeen,
          privacy: user.privacy,
          blocked_user_ids: user.blockedUserIds
        }).eq('id', user.id);
      } catch (_) {}
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    this.data.users = this.data.users.filter(u => u.id !== userId);
    delete this.data.passwords[userId];
    this.data.conversations = this.data.conversations.filter(c => !c.participantIds.includes(userId));
    this.data.messages = this.data.messages.filter(m => m.senderId !== userId && m.receiverId !== userId);
    this.data.statuses = this.data.statuses.filter(s => s.userId !== userId);
    this.save();

    if (this.supabase) {
      try {
        await this.supabase.from('users').delete().eq('id', userId);
      } catch (_) {}
    }
  }

  public async getConversationsForUser(userId: string) {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('conversations').select('*');
        if (data && data.length > 0) {
          const list = data.map(r => this.mapDbConversation(r));
          return list.filter(c => c.participantIds.includes(userId) && !c.deletedForUsers.includes(userId));
        }
      } catch (_) {}
    }
    return this.data.conversations.filter(c => c.participantIds.includes(userId) && !c.deletedForUsers.includes(userId));
  }

  public async getConversationById(id: string) {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('conversations').select('*').eq('id', id).maybeSingle();
        if (data) return this.mapDbConversation(data);
      } catch (_) {}
    }
    return this.data.conversations.find(c => c.id === id);
  }

  public async findOrCreateConversation(user1Id: string, user2Id: string) {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('conversations').select('*');
        if (data) {
          const list = data.map(r => this.mapDbConversation(r));
          const existing = list.find(c => 
            (c.participantIds[0] === user1Id && c.participantIds[1] === user2Id) ||
            (c.participantIds[0] === user2Id && c.participantIds[1] === user1Id)
          );
          if (existing) {
            if (existing.deletedForUsers.includes(user1Id)) {
              existing.deletedForUsers = existing.deletedForUsers.filter((id: string) => id !== user1Id);
              await this.supabase.from('conversations').update({ deleted_for_users: existing.deletedForUsers }).eq('id', existing.id);
            }
            return existing;
          }
        }
      } catch (_) {}
    }

    let existing = this.data.conversations.find(c => 
      (c.participantIds[0] === user1Id && c.participantIds[1] === user2Id) ||
      (c.participantIds[0] === user2Id && c.participantIds[1] === user1Id)
    );

    if (existing) {
      if (existing.deletedForUsers.includes(user1Id)) {
        existing.deletedForUsers = existing.deletedForUsers.filter(id => id !== user1Id);
        this.save();
      }
      return existing;
    }

    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      participantIds: [user1Id, user2Id] as [string, string],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clearedTimestamps: {},
      deletedForUsers: [],
      unreadCounts: {
        [user1Id]: 0,
        [user2Id]: 0
      }
    };

    this.data.conversations.unshift(newConv);
    this.save();

    if (this.supabase) {
      try {
        await this.supabase.from('conversations').insert({
          id: newConv.id,
          participant_ids: newConv.participantIds,
          created_at: newConv.createdAt,
          updated_at: newConv.updatedAt,
          cleared_timestamps: newConv.clearedTimestamps,
          deleted_for_users: newConv.deletedForUsers,
          unread_counts: newConv.unreadCounts
        });
      } catch (_) {}
    }

    return newConv;
  }

  public async getMessagesForConversation(convId: string, currentUserId: string): Promise<Message[]> {
    let list: Message[] = [];
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
        if (data && data.length > 0) {
          list = data.map(r => this.mapDbMessage(r));
        }
      } catch (_) {}
    }

    if (list.length === 0) {
      list = this.data.messages.filter(m => m.conversationId === convId);
    }

    const conv = await this.getConversationById(convId);
    const clearedTimestamp = conv?.clearedTimestamps?.[currentUserId] || 0;

    return list.filter(m => !m.deletedFor.includes(currentUserId) && m.createdAt > clearedTimestamp);
  }

  public async getMessageById(id: string): Promise<Message | undefined> {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('messages').select('*').eq('id', id).maybeSingle();
        if (data) return this.mapDbMessage(data);
      } catch (_) {}
    }
    return this.data.messages.find(m => m.id === id);
  }

  public async addMessage(msg: Message): Promise<void> {
    this.data.messages.push(msg);
    const conv = this.data.conversations.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.updatedAt = msg.createdAt;
      conv.unreadCounts[msg.receiverId] = (conv.unreadCounts[msg.receiverId] || 0) + 1;
      conv.deletedForUsers = [];
      this.save();
    }

    if (this.supabase) {
      try {
        await this.supabase.from('messages').insert({
          id: msg.id,
          client_temp_id: msg.clientTempId || null,
          conversation_id: msg.conversationId,
          sender_id: msg.senderId,
          receiver_id: msg.receiverId,
          content: msg.content,
          type: msg.type,
          media_url: msg.mediaUrl,
          caption: msg.caption,
          reply_to: msg.replyTo,
          status: msg.status,
          created_at: msg.createdAt,
          deleted_for: msg.deletedFor,
          is_deleted_for_everyone: msg.isDeletedForEveryone || false
        });

        if (conv) {
          await this.supabase.from('conversations').update({
            updated_at: conv.updatedAt,
            unread_counts: conv.unreadCounts,
            deleted_for_users: []
          }).eq('id', conv.id);
        }
      } catch (err: any) {
        console.error('[LAMAVI DB] Supabase addMessage error:', err.message);
      }
    }
  }

  public async markMessagesRead(convId: string, currentUserId: string): Promise<boolean> {
    let updated = false;
    for (const m of this.data.messages) {
      if (m.conversationId === convId && m.receiverId === currentUserId && m.status !== 'read') {
        m.status = 'read';
        updated = true;
      }
    }
    const conv = this.data.conversations.find(c => c.id === convId);
    if (conv) {
      conv.unreadCounts[currentUserId] = 0;
      this.save();
    }

    if (this.supabase) {
      try {
        await this.supabase.from('messages')
          .update({ status: 'read' })
          .eq('conversation_id', convId)
          .eq('receiver_id', currentUserId);
        if (conv) {
          await this.supabase.from('conversations').update({ unread_counts: conv.unreadCounts }).eq('id', convId);
        }
      } catch (_) {}
    }
    return updated;
  }

  public async updateMessage(msg: Message): Promise<void> {
    const idx = this.data.messages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      this.data.messages[idx] = msg;
      this.save();
    }
    if (this.supabase) {
      try {
        await this.supabase.from('messages').update({
          content: msg.content,
          media_url: msg.mediaUrl,
          caption: msg.caption,
          deleted_for: msg.deletedFor,
          is_deleted_for_everyone: msg.isDeletedForEveryone || false,
          status: msg.status
        }).eq('id', msg.id);
      } catch (_) {}
    }
  }

  public async clearConversationHistory(convId: string, currentUserId: string): Promise<void> {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (conv) {
      conv.clearedTimestamps[currentUserId] = Date.now();
      this.save();
    }
    if (this.supabase && conv) {
      try {
        await this.supabase.from('conversations').update({ cleared_timestamps: conv.clearedTimestamps }).eq('id', convId);
      } catch (_) {}
    }
  }

  public async deleteConversation(convId: string, currentUserId: string): Promise<void> {
    const conv = this.data.conversations.find(c => c.id === convId);
    if (conv) {
      if (!conv.deletedForUsers.includes(currentUserId)) {
        conv.deletedForUsers.push(currentUserId);
      }
      this.save();
    }
    if (this.supabase && conv) {
      try {
        await this.supabase.from('conversations').update({ deleted_for_users: conv.deletedForUsers }).eq('id', convId);
      } catch (_) {}
    }
  }

  public async getStatuses(): Promise<StatusUpdate[]> {
    const nowTime = Date.now();
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('statuses').select('*').gt('expires_at', nowTime).order('created_at', { ascending: false });
        if (data && data.length > 0) {
          return data.map(r => ({
            id: r.id,
            userId: r.user_id,
            type: r.type,
            content: r.content,
            mediaUrl: r.media_url,
            backgroundColor: r.background_color,
            fontStyle: r.font_style,
            createdAt: Number(r.created_at),
            expiresAt: Number(r.expires_at),
            viewers: Array.isArray(r.viewers) ? r.viewers : []
          }));
        }
      } catch (_) {}
    }
    return this.data.statuses.filter(s => s.expiresAt > nowTime);
  }

  public async getStatusById(id: string): Promise<StatusUpdate | undefined> {
    if (this.supabase) {
      try {
        const { data } = await this.supabase.from('statuses').select('*').eq('id', id).maybeSingle();
        if (data) {
          return {
            id: data.id,
            userId: data.user_id,
            type: data.type,
            content: data.content,
            mediaUrl: data.media_url,
            backgroundColor: data.background_color,
            fontStyle: data.font_style,
            createdAt: Number(data.created_at),
            expiresAt: Number(data.expires_at),
            viewers: Array.isArray(data.viewers) ? data.viewers : []
          };
        }
      } catch (_) {}
    }
    return this.data.statuses.find(s => s.id === id);
  }

  public async addStatus(status: StatusUpdate): Promise<void> {
    this.data.statuses.unshift(status);
    this.save();
    if (this.supabase) {
      try {
        await this.supabase.from('statuses').insert({
          id: status.id,
          user_id: status.userId,
          type: status.type,
          content: status.content,
          media_url: status.mediaUrl,
          background_color: status.backgroundColor,
          font_style: status.fontStyle,
          created_at: status.createdAt,
          expires_at: status.expiresAt,
          viewers: status.viewers
        });
      } catch (_) {}
    }
  }

  public async updateStatus(status: StatusUpdate): Promise<void> {
    const idx = this.data.statuses.findIndex(s => s.id === status.id);
    if (idx !== -1) {
      this.data.statuses[idx] = status;
      this.save();
    }
    if (this.supabase) {
      try {
        await this.supabase.from('statuses').update({ viewers: status.viewers }).eq('id', status.id);
      } catch (_) {}
    }
  }

  public async deleteStatus(statusId: string, currentUserId: string): Promise<boolean> {
    const status = this.data.statuses.find(s => s.id === statusId && s.userId === currentUserId);
    if (!status && !this.supabase) return false;

    this.data.statuses = this.data.statuses.filter(s => s.id !== statusId);
    this.save();

    if (this.supabase) {
      try {
        await this.supabase.from('statuses').delete().eq('id', statusId).eq('user_id', currentUserId);
      } catch (_) {}
    }
    return true;
  }

  public async addReport(reporterId: string, reportedUserId: string, reason: string): Promise<void> {
    const r = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reporterId,
      reportedUserId,
      reason,
      createdAt: Date.now()
    };
    this.data.reports.push(r);
    this.save();

    if (this.supabase) {
      try {
        await this.supabase.from('reports').insert({
          id: r.id,
          reporter_id: r.reporterId,
          reported_user_id: r.reportedUserId,
          reason: r.reason,
          created_at: r.createdAt
        });
      } catch (_) {}
    }
  }
}

const db = new Database();

// Realtime SSE Manager
class RealtimeManager {
  private clients: Map<string, express.Response[]> = new Map();

  public subscribe(userId: string, res: express.Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(res);

    reqCloseHandler:
    res.on('close', () => {
      const active = this.clients.get(userId);
      if (active) {
        this.clients.set(userId, active.filter(c => c !== res));
        if (this.clients.get(userId)!.length === 0) {
          this.clients.delete(userId);
        }
      }
    });
  }

  public isUserConnected(userId: string): boolean {
    const conns = this.clients.get(userId);
    return !!(conns && conns.length > 0);
  }

  public sendToUser(userId: string, event: RealtimeEvent) {
    const conns = this.clients.get(userId);
    if (!conns || conns.length === 0) return;

    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of conns) {
      try {
        res.write(payload);
      } catch (_) {}
    }
  }

  public broadcast(event: RealtimeEvent) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const conns of this.clients.values()) {
      for (const res of conns) {
        try {
          res.write(payload);
        } catch (_) {}
      }
    }
  }
}

const realtime = new RealtimeManager();

// Privacy profile sanitizer
function sanitizePublicProfile(targetUser: UserProfile, viewerId?: string): PublicUserProfile {
  const isSelf = viewerId === targetUser.id;
  const isBlocked = viewerId && targetUser.blockedUserIds.includes(viewerId);

  let avatarUrl = targetUser.avatarUrl;
  if (!isSelf && !isBlocked && targetUser.privacy.profilePhoto === 'nobody') {
    avatarUrl = null;
  }

  let isOnline = targetUser.isOnline;
  let lastSeen = targetUser.lastSeen;
  if (!isSelf && (isBlocked || targetUser.privacy.lastSeen === 'nobody')) {
    isOnline = false;
    lastSeen = 0;
  }

  return {
    id: targetUser.id,
    fullName: targetUser.fullName,
    username: targetUser.username,
    email: targetUser.email,
    avatarUrl,
    bio: targetUser.bio,
    isOnline,
    lastSeen
  };
}

// Authentication Middleware
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.substring(7);
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
  const user = await db.getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found' });
  }
  (req as any).user = user;
  next();
}

// Express app initialization
const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health endpoint
app.get('/api/health', async (_req, res) => {
  return res.json({ status: 'ok', timestamp: Date.now() });
});

// 1. Account Creation (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Full real name is required.' });
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores.' });
    }

    const existingUser = await db.getUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'This username is already taken. Please choose another.' });
    }

    let cleanEmail: string | null = null;
    if (email && typeof email === 'string' && email.trim().length > 0) {
      cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      const existingEmail = await db.getUserByEmail(cleanEmail);
      if (existingEmail) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (password.length !== 8) {
      return res.status(400).json({ error: 'Password must be exactly 8 characters long.' });
    }
    if (!/[a-zA-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one alphabet letter.' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one numerical digit.' });
    }

    const recoveryCode = `LAMAVI-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser: UserProfile = {
      id: userId,
      fullName: fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      avatarUrl: null,
      bio: 'Hey there! I am using LAMAVI.',
      createdAt: Date.now(),
      lastSeen: Date.now(),
      isOnline: true,
      recoveryCode,
      privacy: {
        profilePhoto: 'everyone',
        lastSeen: 'everyone',
        readReceipts: true,
        statusPrivacy: 'everyone'
      },
      blockedUserIds: []
    };

    const passHash = hashPassword(password);
    await db.addUser(newUser, passHash);

    const token = generateToken(userId);
    return res.status(201).json({
      token,
      user: newUser,
      message: 'Account created successfully'
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error creating account' });
  }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username or email and password are required.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = (await db.getUserByUsername(cleanId)) || (await db.getUserByEmail(cleanId));
    if (!user) {
      return res.status(401).json({ error: 'No account found with this username or email.' });
    }

    const creds = await db.getPassword(user.id);
    if (!creds || !verifyPassword(password, creds.salt, creds.hash)) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    user.lastSeen = Date.now();
    user.isOnline = true;
    await db.updateUser(user);

    const token = generateToken(user.id);
    return res.json({
      token,
      user,
      message: 'Logged in successfully'
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error logging in' });
  }
});

// 3. Current User Profile
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  return res.json({ user });
});

// 4. Logout
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const user = (req as any).user as UserProfile;
  user.isOnline = false;
  user.lastSeen = Date.now();
  await db.updateUser(user);
  realtime.broadcast({
    type: 'presence:update',
    payload: { userId: user.id, isOnline: false, lastSeen: user.lastSeen }
  });
  return res.json({ success: true });
});

// 5. Account Recovery
app.post('/api/auth/recover', async (req, res) => {
  const { identifier, recoveryCode, newPassword } = req.body;
  if (!identifier || !recoveryCode || !newPassword) {
    return res.status(400).json({ error: 'Identifier, recovery code, and new password are required.' });
  }
  const cleanId = identifier.trim().toLowerCase();
  const user = (await db.getUserByUsername(cleanId)) || (await db.getUserByEmail(cleanId));
  if (!user) {
    return res.status(404).json({ error: 'No matching user found.' });
  }
  if (!user.recoveryCode || user.recoveryCode.trim().toUpperCase() !== recoveryCode.trim().toUpperCase()) {
    return res.status(400).json({ error: 'Invalid recovery code for this account.' });
  }

  if (newPassword.length !== 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'New password must be exactly 8 characters with at least one letter and one digit.' });
  }

  const passHash = hashPassword(newPassword);
  await db.setPassword(user.id, passHash);
  const token = generateToken(user.id);
  return res.json({ message: 'Password reset successfully', token, user });
});

// 6. Delete Account
app.delete('/api/auth/account', authMiddleware, async (req, res) => {
  const user = (req as any).user as UserProfile;
  await db.deleteUser(user.id);
  return res.json({ success: true, message: 'Account permanently deleted' });
});

// 7. Update Profile
app.put('/api/users/profile', authMiddleware, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const { fullName, username, email, bio, avatarUrl, privacy } = req.body;

  if (fullName && typeof fullName === 'string' && fullName.trim().length > 0) {
    user.fullName = fullName.trim();
  }

  if (username && typeof username === 'string') {
    const cleanU = username.trim().toLowerCase();
    if (cleanU !== user.username) {
      if (cleanU.length < 3 || !/^[a-zA-Z0-9_]+$/.test(cleanU)) {
        return res.status(400).json({ error: 'Invalid username format' });
      }
      const existing = await db.getUserByUsername(cleanU);
      if (existing && existing.id !== user.id) {
        return res.status(409).json({ error: 'This username is already taken.' });
      }
      user.username = cleanU;
    }
  }

  if (email !== undefined) {
    if (email && typeof email === 'string' && email.trim().length > 0) {
      const cleanE = email.trim().toLowerCase();
      if (cleanE !== user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanE)) {
          return res.status(400).json({ error: 'Invalid email address' });
        }
        const existingE = await db.getUserByEmail(cleanE);
        if (existingE && existingE.id !== user.id) {
          return res.status(409).json({ error: 'This email is already in use.' });
        }
        user.email = cleanE;
      }
    } else {
      user.email = null;
    }
  }

  if (bio !== undefined && typeof bio === 'string') {
    user.bio = bio.trim().slice(0, 160);
  }

  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl;
  }

  if (privacy && typeof privacy === 'object') {
    user.privacy = {
      ...user.privacy,
      ...privacy
    };
  }

  await db.updateUser(user);
  return res.json({ user, message: 'Profile updated successfully' });
});

// 8. Search Users
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const query = (req.query.q as string || '').trim().toLowerCase();
  if (!query) {
    return res.json({ users: [] });
  }

  const allUsers = await db.getUsers();
  const matched = allUsers.filter(u => {
    if (u.id === currentUser.id) return false;
    const usernameMatch = u.username.toLowerCase() === query || u.username.toLowerCase().includes(query);
    const emailMatch = u.email && u.email.toLowerCase() === query;
    return usernameMatch || emailMatch;
  });

  const sanitized = matched.map(u => sanitizePublicProfile(u, currentUser.id));
  return res.json({ users: sanitized });
});

// 9. Contacts / Directory
app.get('/api/contacts', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const allUsers = (await db.getUsers()).filter(u => u.id !== currentUser.id);
  const contacts = allUsers.map(u => {
    const isBlocked = currentUser.blockedUserIds.includes(u.id);
    return {
      ...sanitizePublicProfile(u, currentUser.id),
      isBlocked
    };
  });
  return res.json({ contacts });
});

// 10. Block / Unblock User
app.post('/api/contacts/block', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { targetUserId } = req.body;
  if (!targetUserId || targetUserId === currentUser.id) {
    return res.status(400).json({ error: 'Invalid user to block' });
  }
  if (!currentUser.blockedUserIds.includes(targetUserId)) {
    currentUser.blockedUserIds.push(targetUserId);
    await db.updateUser(currentUser);
  }
  return res.json({ success: true, blockedUserIds: currentUser.blockedUserIds });
});

app.post('/api/contacts/unblock', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { targetUserId } = req.body;
  currentUser.blockedUserIds = currentUser.blockedUserIds.filter(id => id !== targetUserId);
  await db.updateUser(currentUser);
  return res.json({ success: true, blockedUserIds: currentUser.blockedUserIds });
});

// 11. Report User
app.post('/api/reports', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { targetUserId, reason } = req.body;
  if (!targetUserId || !reason) {
    return res.status(400).json({ error: 'Target user and reason are required.' });
  }
  await db.addReport(currentUser.id, targetUserId, reason);
  return res.json({ success: true, message: 'Report submitted. Thank you for keeping LAMAVI safe.' });
});

// 12. Get Conversations List
app.get('/api/conversations', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const rawConvs = await db.getConversationsForUser(currentUser.id);

  const formattedConvs: Conversation[] = await Promise.all(rawConvs.map(async c => {
    const otherUserId = c.participantIds.find(id => id !== currentUser.id) || currentUser.id;
    const otherUserRaw = await db.getUserById(otherUserId);
    const otherUser = otherUserRaw ? sanitizePublicProfile(otherUserRaw, currentUser.id) : undefined;
    
    const msgs = await db.getMessagesForConversation(c.id, currentUser.id);
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

    return {
      id: c.id,
      participantIds: c.participantIds,
      otherUser,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMessage: lastMsg,
      unreadCount: c.unreadCounts[currentUser.id] || 0
    };
  }));

  formattedConvs.sort((a, b) => b.updatedAt - a.updatedAt);
  return res.json({ conversations: formattedConvs });
});

// 13. Create or Get Conversation with a user
app.post('/api/conversations', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { recipientId } = req.body;
  if (!recipientId || recipientId === currentUser.id) {
    return res.status(400).json({ error: 'Cannot start conversation with yourself.' });
  }
  const recipient = await db.getUserById(recipientId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient account not found.' });
  }

  const conv = await db.findOrCreateConversation(currentUser.id, recipientId);
  const msgs = await db.getMessagesForConversation(conv.id, currentUser.id);
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

  const formatted: Conversation = {
    id: conv.id,
    participantIds: conv.participantIds,
    otherUser: sanitizePublicProfile(recipient, currentUser.id),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    lastMessage: lastMsg,
    unreadCount: conv.unreadCounts[currentUser.id] || 0
  };

  return res.json({ conversation: formatted });
});

// 14. Get Messages for a conversation
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  const conv = await db.getConversationById(convId);
  if (!conv || !conv.participantIds.includes(currentUser.id)) {
    return res.status(403).json({ error: 'Access to this conversation is denied.' });
  }

  const messages = await db.getMessagesForConversation(convId, currentUser.id);

  const updated = await db.markMessagesRead(convId, currentUser.id);
  if (updated && currentUser.privacy.readReceipts) {
    const otherUserId = conv.participantIds.find(id => id !== currentUser.id);
    if (otherUserId) {
      realtime.sendToUser(otherUserId, {
        type: 'message:update',
        payload: { conversationId: convId, status: 'read' }
      });
    }
  }

  return res.json({ messages });
});

// 15. Send a Message
app.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  const conv = await db.getConversationById(convId);
  if (!conv || !conv.participantIds.includes(currentUser.id)) {
    return res.status(403).json({ error: 'Access to this conversation is denied.' });
  }

  const otherUserId = conv.participantIds.find(id => id !== currentUser.id)!;
  const recipient = await db.getUserById(otherUserId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient account no longer exists.' });
  }

  if (recipient.blockedUserIds.includes(currentUser.id) || currentUser.blockedUserIds.includes(recipient.id)) {
    return res.status(403).json({ error: 'Cannot send message to this user.' });
  }

  const { content, type = 'text', mediaUrl, caption, replyTo, clientTempId } = req.body;
  if (type === 'text' && (!content || content.trim().length === 0)) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }
  if (type === 'image' && !mediaUrl) {
    return res.status(400).json({ error: 'Image file or URL is required.' });
  }

  const isRecipientOnline = realtime.isUserConnected(otherUserId);
  const status = isRecipientOnline ? 'delivered' : 'sent';

  const newMsg: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    clientTempId,
    conversationId: convId,
    senderId: currentUser.id,
    receiverId: otherUserId,
    content: (content || '').trim(),
    type: type as 'text' | 'image',
    mediaUrl: mediaUrl || null,
    caption: caption ? caption.trim() : null,
    replyTo: replyTo || null,
    status,
    createdAt: Date.now(),
    deletedFor: []
  };

  await db.addMessage(newMsg);

  realtime.sendToUser(otherUserId, {
    type: 'message:new',
    payload: {
      message: newMsg,
      conversationId: convId,
      sender: sanitizePublicProfile(currentUser, otherUserId)
    }
  });

  realtime.sendToUser(currentUser.id, {
    type: 'message:new',
    payload: {
      message: newMsg,
      conversationId: convId
    }
  });

  return res.status(201).json({ message: newMsg });
});

// 16. Delete a Message
app.post('/api/messages/:id/delete', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const msgId = req.params.id;
  const { forEveryone } = req.body;

  const msg = await db.getMessageById(msgId);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  if (forEveryone) {
    if (msg.senderId !== currentUser.id) {
      return res.status(403).json({ error: 'Only the sender can delete this message for everyone.' });
    }
    msg.isDeletedForEveryone = true;
    msg.content = 'This message was deleted';
    msg.mediaUrl = null;
    msg.caption = null;
    await db.updateMessage(msg);

    realtime.sendToUser(msg.receiverId, {
      type: 'message:deleted',
      payload: { messageId: msg.id, conversationId: msg.conversationId, forEveryone: true }
    });
    realtime.sendToUser(msg.senderId, {
      type: 'message:deleted',
      payload: { messageId: msg.id, conversationId: msg.conversationId, forEveryone: true }
    });
  } else {
    if (!msg.deletedFor.includes(currentUser.id)) {
      msg.deletedFor.push(currentUser.id);
      await db.updateMessage(msg);
    }
    realtime.sendToUser(currentUser.id, {
      type: 'message:deleted',
      payload: { messageId: msg.id, conversationId: msg.conversationId, forEveryone: false }
    });
  }

  return res.json({ success: true, message: msg });
});

// 17. Clear Conversation History
app.post('/api/conversations/:id/clear', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  await db.clearConversationHistory(convId, currentUser.id);
  realtime.sendToUser(currentUser.id, {
    type: 'conversation:clear',
    payload: { conversationId: convId }
  });
  return res.json({ success: true, message: 'Chat history cleared' });
});

// 18. Delete Conversation
app.delete('/api/conversations/:id', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  await db.deleteConversation(convId, currentUser.id);
  return res.json({ success: true, message: 'Conversation deleted' });
});

// 19. Statuses: Get active statuses
app.get('/api/statuses', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const activeStatuses = await db.getStatuses();

  const visible = [];
  for (const s of activeStatuses) {
    const author = await db.getUserById(s.userId);
    if (!author) continue;
    if (author.blockedUserIds.includes(currentUser.id) || currentUser.blockedUserIds.includes(author.id)) {
      continue;
    }
    if (s.userId !== currentUser.id && author.privacy.statusPrivacy === 'nobody') {
      continue;
    }
    visible.push({ s, author });
  }

  const formatted: StatusUpdate[] = visible.map(({ s, author }) => {
    const isAuthor = s.userId === currentUser.id;
    const hasViewed = s.viewers.some(v => v.userId === currentUser.id);
    return {
      ...s,
      user: sanitizePublicProfile(author, currentUser.id),
      viewers: isAuthor ? s.viewers : [],
      hasViewed
    };
  });

  return res.json({ statuses: formatted });
});

// 20. Post Status
app.post('/api/statuses', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { type = 'text', content = '', mediaUrl, backgroundColor = '#E5E5EA', fontStyle = 'font-sans' } = req.body;

  if (type === 'text' && (!content || content.trim().length === 0)) {
    return res.status(400).json({ error: 'Status text cannot be empty.' });
  }

  const newStatus: StatusUpdate = {
    id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: currentUser.id,
    type: type as 'text' | 'image',
    content: (content || '').trim(),
    mediaUrl: mediaUrl || null,
    backgroundColor,
    fontStyle,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    viewers: []
  };

  await db.addStatus(newStatus);
  realtime.broadcast({
    type: 'status:new',
    payload: { status: { ...newStatus, user: sanitizePublicProfile(currentUser, currentUser.id) } }
  });

  return res.status(201).json({ status: newStatus });
});

// 21. Mark Status as Viewed
app.post('/api/statuses/:id/view', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const statusId = req.params.id;
  const status = await db.getStatusById(statusId);
  if (!status) {
    return res.status(404).json({ error: 'Status not found or expired.' });
  }

  if (status.userId !== currentUser.id && !status.viewers.some(v => v.userId === currentUser.id)) {
    status.viewers.push({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userAvatar: currentUser.avatarUrl,
      viewedAt: Date.now()
    });
    await db.updateStatus(status);

    realtime.sendToUser(status.userId, {
      type: 'status:new',
      payload: { statusId, viewer: { userId: currentUser.id, userName: currentUser.fullName, viewedAt: Date.now() } }
    });
  }

  return res.json({ success: true });
});

// 22. Delete Status
app.delete('/api/statuses/:id', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const statusId = req.params.id;
  const deleted = await db.deleteStatus(statusId, currentUser.id);
  if (deleted) {
    realtime.broadcast({
      type: 'status:delete',
      payload: { statusId }
    });
    return res.json({ success: true });
  }
  return res.status(404).json({ error: 'Status not found or unauthorized' });
});

// 23. Realtime Server-Sent Events (SSE)
app.get('/api/realtime', (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    return res.status(401).send('Missing token');
  }
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).send('Invalid token');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'connected', payload: { userId } })}\n\n`);

  realtime.subscribe(userId, res);

  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(pingInterval);
  });
});

// 24. Typing Indicator
app.post('/api/typing', authMiddleware, async (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { conversationId, isTyping } = req.body;
  const conv = await db.getConversationById(conversationId);
  if (conv) {
    const otherUserId = conv.participantIds.find(id => id !== currentUser.id);
    if (otherUserId) {
      realtime.sendToUser(otherUserId, {
        type: 'typing',
        payload: { conversationId, userId: currentUser.id, isTyping }
      });
    }
  }
  return res.json({ success: true });
});

export default app;
export { app };
