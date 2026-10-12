import express from 'express';
import { createServer as createViteServer } from 'vite';
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
} from './src/types';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// In-memory + JSON file persistent database
const DATA_DIR = path.resolve(process.cwd(), 'data');
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
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

// Initial seed users with elegant profiles and default status
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

// Database class
class Database {
  private data: DatabaseSchema;

  constructor() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading database file, resetting to initial seed:', err);
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

  public getUsers() {
    return this.data.users;
  }

  public getUserById(id: string) {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByUsername(username: string) {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  }

  public getUserByEmail(email: string) {
    return this.data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase().trim());
  }

  public addUser(user: UserProfile, pass: { salt: string; hash: string }) {
    this.data.users.push(user);
    this.data.passwords[user.id] = pass;
    this.save();
  }

  public getPassword(userId: string) {
    return this.data.passwords[userId];
  }

  public setPassword(userId: string, pass: { salt: string; hash: string }) {
    this.data.passwords[userId] = pass;
    this.save();
  }

  public updateUser(user: UserProfile) {
    const idx = this.data.users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      this.data.users[idx] = user;
      this.save();
    }
  }

  public deleteUser(userId: string) {
    this.data.users = this.data.users.filter(u => u.id !== userId);
    delete this.data.passwords[userId];
    this.data.conversations = this.data.conversations.filter(c => !c.participantIds.includes(userId));
    this.data.messages = this.data.messages.filter(m => m.senderId !== userId && m.receiverId !== userId);
    this.data.statuses = this.data.statuses.filter(s => s.userId !== userId);
    this.save();
  }

  public getConversationsForUser(userId: string) {
    return this.data.conversations.filter(c => c.participantIds.includes(userId) && !c.deletedForUsers.includes(userId));
  }

  public getConversationById(id: string) {
    return this.data.conversations.find(c => c.id === id);
  }

  public findOrCreateConversation(userA: string, userB: string) {
    const existing = this.data.conversations.find(c => 
      (c.participantIds[0] === userA && c.participantIds[1] === userB) ||
      (c.participantIds[0] === userB && c.participantIds[1] === userA)
    );
    if (existing) {
      // Un-delete if previously deleted for this user
      existing.deletedForUsers = existing.deletedForUsers.filter(id => id !== userA && id !== userB);
      this.save();
      return existing;
    }
    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      participantIds: [userA, userB] as [string, string],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clearedTimestamps: {},
      deletedForUsers: [],
      unreadCounts: {
        [userA]: 0,
        [userB]: 0
      }
    };
    this.data.conversations.unshift(newConv);
    this.save();
    return newConv;
  }

  public getMessagesForConversation(convId: string, userId: string) {
    const conv = this.getConversationById(convId);
    const clearedTime = (conv && conv.clearedTimestamps[userId]) || 0;
    return this.data.messages.filter(m => 
      m.conversationId === convId && 
      !m.deletedFor.includes(userId) &&
      m.createdAt > clearedTime
    );
  }

  public addMessage(msg: Message) {
    this.data.messages.push(msg);
    const conv = this.getConversationById(msg.conversationId);
    if (conv) {
      conv.updatedAt = msg.createdAt;
      conv.deletedForUsers = []; // Unhide conversation for both
      conv.unreadCounts[msg.receiverId] = (conv.unreadCounts[msg.receiverId] || 0) + 1;
    }
    this.save();
  }

  public getMessageById(id: string) {
    return this.data.messages.find(m => m.id === id);
  }

  public updateMessage(msg: Message) {
    const idx = this.data.messages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      this.data.messages[idx] = msg;
      this.save();
    }
  }

  public markMessagesRead(convId: string, readerId: string) {
    let updated = false;
    this.data.messages.forEach(m => {
      if (m.conversationId === convId && m.receiverId === readerId && m.status !== 'read') {
        m.status = 'read';
        updated = true;
      }
    });
    const conv = this.getConversationById(convId);
    if (conv) {
      conv.unreadCounts[readerId] = 0;
    }
    if (updated) {
      this.save();
    }
    return updated;
  }

  public clearConversationHistory(convId: string, userId: string) {
    const conv = this.getConversationById(convId);
    if (conv) {
      conv.clearedTimestamps[userId] = Date.now();
      conv.unreadCounts[userId] = 0;
      this.save();
    }
  }

  public deleteConversation(convId: string, userId: string) {
    const conv = this.getConversationById(convId);
    if (conv) {
      if (!conv.deletedForUsers.includes(userId)) {
        conv.deletedForUsers.push(userId);
      }
      this.save();
    }
  }

  public getStatuses() {
    const nowTime = Date.now();
    // Filter statuses younger than 24 hours
    return this.data.statuses.filter(s => s.expiresAt > nowTime);
  }

  public addStatus(status: StatusUpdate) {
    this.data.statuses.unshift(status);
    this.save();
  }

  public getStatusById(id: string) {
    return this.data.statuses.find(s => s.id === id);
  }

  public deleteStatus(id: string, userId: string) {
    const idx = this.data.statuses.findIndex(s => s.id === id && s.userId === userId);
    if (idx !== -1) {
      this.data.statuses.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addReport(reporterId: string, reportedUserId: string, reason: string) {
    const report = {
      id: `rep_${Date.now()}`,
      reporterId,
      reportedUserId,
      reason,
      createdAt: Date.now()
    };
    this.data.reports.push(report);
    this.save();
    return report;
  }
}

const db = new Database();

// Realtime SSE Manager
class RealtimeManager {
  private clients: Map<string, Set<express.Response>> = new Map();

  public subscribe(userId: string, res: express.Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(res);

    // Mark user as online
    const user = db.getUserById(userId);
    if (user && !user.isOnline) {
      user.isOnline = true;
      user.lastSeen = Date.now();
      db.updateUser(user);
      this.broadcast({
        type: 'presence:update',
        payload: { userId, isOnline: true, lastSeen: user.lastSeen }
      });
    }

    res.on('close', () => {
      const set = this.clients.get(userId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.clients.delete(userId);
          // Mark offline
          const u = db.getUserById(userId);
          if (u) {
            u.isOnline = false;
            u.lastSeen = Date.now();
            db.updateUser(u);
            this.broadcast({
              type: 'presence:update',
              payload: { userId, isOnline: false, lastSeen: u.lastSeen }
            });
          }
        }
      }
    });
  }

  public sendToUser(userId: string, event: RealtimeEvent) {
    const set = this.clients.get(userId);
    if (set && set.size > 0) {
      const payload = `data: ${JSON.stringify(event)}\n\n`;
      set.forEach(res => {
        try {
          res.write(payload);
        } catch (e) {
          console.error(`Failed to send event to user ${userId}:`, e);
        }
      });
      return true;
    }
    return false;
  }

  public isUserConnected(userId: string): boolean {
    const set = this.clients.get(userId);
    return !!(set && set.size > 0);
  }

  public broadcast(event: RealtimeEvent, excludeUserId?: string) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    this.clients.forEach((set, uId) => {
      if (excludeUserId && uId === excludeUserId) return;
      set.forEach(res => {
        try {
          res.write(payload);
        } catch {
          // ignore
        }
      });
    });
  }
}

const realtime = new RealtimeManager();

// Setup Express
const app = express();
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Helper to filter public user profile according to privacy rules
function sanitizePublicProfile(targetUser: UserProfile, viewerId?: string): PublicUserProfile {
  const isSelf = viewerId === targetUser.id;
  const isBlocked = viewerId && targetUser.blockedUserIds.includes(viewerId);

  // Profile photo privacy
  let avatarUrl = targetUser.avatarUrl;
  if (!isSelf && !isBlocked) {
    if (targetUser.privacy.profilePhoto === 'nobody') {
      avatarUrl = null;
    }
  }

  // Last seen privacy
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
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.substring(7);
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
  const user = db.getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found' });
  }
  (req as any).user = user;
  next();
}

// ======================== API ROUTES ========================

// 1. Account Creation (Register)
app.post('/api/auth/register', (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    // Validate Full Name
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Full real name is required.' });
    }

    // Validate Username
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username may only contain letters, numbers, and underscores.' });
    }
    if (db.getUserByUsername(cleanUsername)) {
      return res.status(409).json({ error: 'This username is already taken. Please choose another.' });
    }

    // Validate Email if provided
    let cleanEmail: string | null = null;
    if (email && typeof email === 'string' && email.trim().length > 0) {
      cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      if (db.getUserByEmail(cleanEmail)) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }
    }

    // Validate Password: exactly 8 characters, at least 1 alphabet, at least 1 digit
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

    // Generate unique recovery code
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
    db.addUser(newUser, passHash);

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
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username or email and password are required.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    // Try find by username first, then by email
    const user = db.getUserByUsername(cleanId) || db.getUserByEmail(cleanId);
    if (!user) {
      return res.status(401).json({ error: 'No account found with this username or email.' });
    }

    const creds = db.getPassword(user.id);
    if (!creds || !verifyPassword(password, creds.salt, creds.hash)) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    user.lastSeen = Date.now();
    user.isOnline = true;
    db.updateUser(user);

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
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  user.isOnline = false;
  user.lastSeen = Date.now();
  db.updateUser(user);
  realtime.broadcast({
    type: 'presence:update',
    payload: { userId: user.id, isOnline: false, lastSeen: user.lastSeen }
  });
  return res.json({ success: true });
});

// 5. Account Recovery
app.post('/api/auth/recover', (req, res) => {
  const { identifier, recoveryCode, newPassword } = req.body;
  if (!identifier || !recoveryCode || !newPassword) {
    return res.status(400).json({ error: 'Identifier, recovery code, and new password are required.' });
  }
  const cleanId = identifier.trim().toLowerCase();
  const user = db.getUserByUsername(cleanId) || db.getUserByEmail(cleanId);
  if (!user) {
    return res.status(404).json({ error: 'No matching user found.' });
  }
  if (!user.recoveryCode || user.recoveryCode.trim().toUpperCase() !== recoveryCode.trim().toUpperCase()) {
    return res.status(400).json({ error: 'Invalid recovery code for this account.' });
  }

  // Validate new password rules
  if (newPassword.length !== 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'New password must be exactly 8 characters with at least one letter and one digit.' });
  }

  const passHash = hashPassword(newPassword);
  db.setPassword(user.id, passHash);
  const token = generateToken(user.id);
  return res.json({ message: 'Password reset successfully', token, user });
});

// 6. Delete Account
app.delete('/api/auth/account', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  db.deleteUser(user.id);
  return res.json({ success: true, message: 'Account permanently deleted' });
});

// 7. Update Profile
app.put('/api/users/profile', authMiddleware, (req, res) => {
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
      const existing = db.getUserByUsername(cleanU);
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
        const existingE = db.getUserByEmail(cleanE);
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

  db.updateUser(user);
  return res.json({ user, message: 'Profile updated successfully' });
});

// 8. Search Users
app.get('/api/users/search', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const query = (req.query.q as string || '').trim().toLowerCase();
  if (!query) {
    return res.json({ users: [] });
  }

  const allUsers = db.getUsers();
  const matched = allUsers.filter(u => {
    if (u.id === currentUser.id) return false;
    // Exact or starting with match on username or exact email match
    const usernameMatch = u.username.toLowerCase() === query || u.username.toLowerCase().includes(query);
    const emailMatch = u.email && u.email.toLowerCase() === query;
    return usernameMatch || emailMatch;
  });

  const sanitized = matched.map(u => sanitizePublicProfile(u, currentUser.id));
  return res.json({ users: sanitized });
});

// 9. Contacts / Directory
app.get('/api/contacts', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const allUsers = db.getUsers().filter(u => u.id !== currentUser.id);
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
app.post('/api/contacts/block', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { targetUserId } = req.body;
  if (!targetUserId || targetUserId === currentUser.id) {
    return res.status(400).json({ error: 'Invalid user to block' });
  }
  if (!currentUser.blockedUserIds.includes(targetUserId)) {
    currentUser.blockedUserIds.push(targetUserId);
    db.updateUser(currentUser);
  }
  return res.json({ success: true, blockedUserIds: currentUser.blockedUserIds });
});

app.post('/api/contacts/unblock', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { targetUserId } = req.body;
  currentUser.blockedUserIds = currentUser.blockedUserIds.filter(id => id !== targetUserId);
  db.updateUser(currentUser);
  return res.json({ success: true, blockedUserIds: currentUser.blockedUserIds });
});

// 11. Report User
app.post('/api/reports', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { targetUserId, reason } = req.body;
  if (!targetUserId || !reason) {
    return res.status(400).json({ error: 'Target user and reason are required.' });
  }
  db.addReport(currentUser.id, targetUserId, reason);
  return res.json({ success: true, message: 'Report submitted. Thank you for keeping LAMAVI safe.' });
});

// 12. Get Conversations List
app.get('/api/conversations', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const rawConvs = db.getConversationsForUser(currentUser.id);

  const formattedConvs: Conversation[] = rawConvs.map(c => {
    const otherUserId = c.participantIds.find(id => id !== currentUser.id) || currentUser.id;
    const otherUserRaw = db.getUserById(otherUserId);
    const otherUser = otherUserRaw ? sanitizePublicProfile(otherUserRaw, currentUser.id) : undefined;
    
    // Get last non-deleted message
    const msgs = db.getMessagesForConversation(c.id, currentUser.id);
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
  });

  // Sort latest updated first
  formattedConvs.sort((a, b) => b.updatedAt - a.updatedAt);
  return res.json({ conversations: formattedConvs });
});

// 13. Create or Get Conversation with a user
app.post('/api/conversations', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { recipientId } = req.body;
  if (!recipientId || recipientId === currentUser.id) {
    return res.status(400).json({ error: 'Cannot start conversation with yourself.' });
  }
  const recipient = db.getUserById(recipientId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient account not found.' });
  }

  const conv = db.findOrCreateConversation(currentUser.id, recipientId);
  const msgs = db.getMessagesForConversation(conv.id, currentUser.id);
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
app.get('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participantIds.includes(currentUser.id)) {
    return res.status(403).json({ error: 'Access to this conversation is denied.' });
  }

  const messages = db.getMessagesForConversation(convId, currentUser.id);

  // If there are unread messages sent to current user, mark them read
  const updated = db.markMessagesRead(convId, currentUser.id);
  if (updated && currentUser.privacy.readReceipts) {
    // Notify the other user that messages were read
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
app.post('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  const conv = db.getConversationById(convId);
  if (!conv || !conv.participantIds.includes(currentUser.id)) {
    return res.status(403).json({ error: 'Access to this conversation is denied.' });
  }

  const otherUserId = conv.participantIds.find(id => id !== currentUser.id)!;
  const recipient = db.getUserById(otherUserId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient account no longer exists.' });
  }

  // Check if either party blocked the other
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

  // Determine delivery status: if other user is currently connected to SSE, mark as 'delivered'
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

  db.addMessage(newMsg);

  // Send realtime SSE to recipient
  realtime.sendToUser(otherUserId, {
    type: 'message:new',
    payload: {
      message: newMsg,
      conversationId: convId,
      sender: sanitizePublicProfile(currentUser, otherUserId)
    }
  });

  // Also broadcast to other active sessions of the sender
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
app.post('/api/messages/:id/delete', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const msgId = req.params.id;
  const { forEveryone } = req.body;

  const msg = db.getMessageById(msgId);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  if (forEveryone) {
    // Only author can delete for everyone
    if (msg.senderId !== currentUser.id) {
      return res.status(403).json({ error: 'Only the sender can delete this message for everyone.' });
    }
    msg.isDeletedForEveryone = true;
    msg.content = 'This message was deleted';
    msg.mediaUrl = null;
    msg.caption = null;
    db.updateMessage(msg);

    realtime.sendToUser(msg.receiverId, {
      type: 'message:deleted',
      payload: { messageId: msg.id, conversationId: msg.conversationId, forEveryone: true }
    });
    realtime.sendToUser(msg.senderId, {
      type: 'message:deleted',
      payload: { messageId: msg.id, conversationId: msg.conversationId, forEveryone: true }
    });
  } else {
    // Delete for me
    if (!msg.deletedFor.includes(currentUser.id)) {
      msg.deletedFor.push(currentUser.id);
      db.updateMessage(msg);
    }
    realtime.sendToUser(currentUser.id, {
      type: 'message:deleted',
      payload: { messageId: msg.id, conversationId: msg.conversationId, forEveryone: false }
    });
  }

  return res.json({ success: true, message: msg });
});

// 17. Clear Conversation History
app.post('/api/conversations/:id/clear', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  db.clearConversationHistory(convId, currentUser.id);
  realtime.sendToUser(currentUser.id, {
    type: 'conversation:clear',
    payload: { conversationId: convId }
  });
  return res.json({ success: true, message: 'Chat history cleared' });
});

// 18. Delete Conversation
app.delete('/api/conversations/:id', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const convId = req.params.id;
  db.deleteConversation(convId, currentUser.id);
  return res.json({ success: true, message: 'Conversation deleted' });
});

// 19. Statuses: Get all unexpired statuses
app.get('/api/statuses', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const activeStatuses = db.getStatuses();

  // Filter based on privacy and blocked list
  const visible = activeStatuses.filter(s => {
    const author = db.getUserById(s.userId);
    if (!author) return false;
    // Don't show statuses from users who blocked current user or current user blocked
    if (author.blockedUserIds.includes(currentUser.id) || currentUser.blockedUserIds.includes(author.id)) {
      return false;
    }
    if (s.userId !== currentUser.id && author.privacy.statusPrivacy === 'nobody') {
      return false;
    }
    return true;
  });

  const formatted: StatusUpdate[] = visible.map(s => {
    const author = db.getUserById(s.userId)!;
    const isAuthor = s.userId === currentUser.id;
    const hasViewed = s.viewers.some(v => v.userId === currentUser.id);
    return {
      ...s,
      user: sanitizePublicProfile(author, currentUser.id),
      // Only author sees detailed list of viewers
      viewers: isAuthor ? s.viewers : [],
      hasViewed
    };
  });

  return res.json({ statuses: formatted });
});

// 20. Post Status
app.post('/api/statuses', authMiddleware, (req, res) => {
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
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours lifespan
    viewers: []
  };

  db.addStatus(newStatus);
  realtime.broadcast({
    type: 'status:new',
    payload: { status: { ...newStatus, user: sanitizePublicProfile(currentUser, currentUser.id) } }
  });

  return res.status(201).json({ status: newStatus });
});

// 21. Mark Status as Viewed
app.post('/api/statuses/:id/view', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const statusId = req.params.id;
  const status = db.getStatusById(statusId);
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
    db.save();

    // Inform author in realtime
    realtime.sendToUser(status.userId, {
      type: 'status:new',
      payload: { statusId, viewer: { userId: currentUser.id, userName: currentUser.fullName, viewedAt: Date.now() } }
    });
  }

  return res.json({ success: true });
});

// 22. Delete Status
app.delete('/api/statuses/:id', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const statusId = req.params.id;
  const deleted = db.deleteStatus(statusId, currentUser.id);
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

  // Send initial connected acknowledgement
  res.write(`data: ${JSON.stringify({ type: 'connected', payload: { userId } })}\n\n`);

  realtime.subscribe(userId, res);

  // Keep-alive ping every 25 seconds
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
app.post('/api/typing', authMiddleware, (req, res) => {
  const currentUser = (req as any).user as UserProfile;
  const { conversationId, isTyping } = req.body;
  const conv = db.getConversationById(conversationId);
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

// Server boot and Vite middleware setup
async function startServer() {
  const server = http.createServer(app);

  if (!isProd) {
    // In dev: mount Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // In prod: serve dist files
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[LAMAVI Messenger] Server running on http://0.0.0.0:${PORT} (env: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
