import type { 
  UserProfile, 
  Message, 
  Conversation, 
  StatusUpdate, 
  PublicUserProfile 
} from '../types';

const CLIENT_DB_KEY = 'lamavi_client_database_v2';
const CLIENT_TOKEN_KEY = 'lamavi_client_session_user';

interface ClientDatabaseSchema {
  users: UserProfile[];
  passwords: Record<string, string>; // userId -> password plain/hashed
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

const now = Date.now();
const initialSeed: ClientDatabaseSchema = {
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
    usr_sophia: 'Pass1234',
    usr_julian: 'Silver01',
    usr_clara: 'Clara999'
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

function getDb(): ClientDatabaseSchema {
  try {
    const raw = localStorage.getItem(CLIENT_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  saveDb(initialSeed);
  return initialSeed;
}

function saveDb(db: ClientDatabaseSchema) {
  try {
    localStorage.setItem(CLIENT_DB_KEY, JSON.stringify(db));
  } catch (_) {}
}

function sanitizeProfile(target: UserProfile, viewerId?: string): PublicUserProfile {
  const isSelf = viewerId === target.id;
  const isBlocked = viewerId && target.blockedUserIds.includes(viewerId);

  let avatarUrl = target.avatarUrl;
  if (!isSelf && !isBlocked && target.privacy.profilePhoto === 'nobody') {
    avatarUrl = null;
  }

  let isOnline = target.isOnline;
  let lastSeen = target.lastSeen;
  if (!isSelf && (isBlocked || target.privacy.lastSeen === 'nobody')) {
    isOnline = false;
    lastSeen = 0;
  }

  return {
    id: target.id,
    fullName: target.fullName,
    username: target.username,
    email: target.email,
    avatarUrl,
    bio: target.bio,
    isOnline,
    lastSeen
  };
}

export function clientHandleRegister(body: any): { token: string; user: UserProfile } {
  const { fullName, username, email, password } = body;
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw new Error('Full real name is required.');
  }
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    throw new Error('Username must be at least 3 characters.');
  }
  const cleanUsername = username.trim().toLowerCase();
  const db = getDb();

  if (db.users.some(u => u.username.toLowerCase() === cleanUsername)) {
    throw new Error('This username is already taken. Please choose another.');
  }

  let cleanEmail: string | null = null;
  if (email && typeof email === 'string' && email.trim()) {
    cleanEmail = email.trim().toLowerCase();
    if (db.users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }
  }

  if (!password || password.length !== 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must be exactly 8 characters with at least 1 letter and 1 number.');
  }

  const recoveryCode = `LAMAVI-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newUser: UserProfile = {
    id: userId,
    fullName: fullName.trim(),
    username: cleanUsername,
    email: cleanEmail,
    avatarUrl: null,
    bio: 'Hey there! Let’s connect each other on LAMAVI.',
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

  db.users.push(newUser);
  db.passwords[userId] = password;
  saveDb(db);

  const token = `token_${userId}_${Date.now()}`;
  localStorage.setItem(CLIENT_TOKEN_KEY, userId);

  return { token, user: newUser };
}

export function clientHandleLogin(body: any): { token: string; user: UserProfile } {
  const { identifier, password } = body;
  if (!identifier || !password) {
    throw new Error('Username or email and password are required.');
  }
  const cleanId = identifier.trim().toLowerCase();
  const db = getDb();

  const user = db.users.find(u => u.username.toLowerCase() === cleanId || (u.email && u.email.toLowerCase() === cleanId));
  if (!user) {
    throw new Error('No account found with this username or email.');
  }

  if (db.passwords[user.id] !== password) {
    throw new Error('Incorrect password. Please try again.');
  }

  user.isOnline = true;
  user.lastSeen = Date.now();
  saveDb(db);

  const token = `token_${user.id}_${Date.now()}`;
  localStorage.setItem(CLIENT_TOKEN_KEY, user.id);

  return { token, user };
}

export function clientHandleGetMe(): { user: UserProfile } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) {
    throw new Error('Authentication required');
  }
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    throw new Error('User account not found');
  }
  return { user };
}

export function clientHandleRecover(body: any): { message: string; token: string; user: UserProfile } {
  const { identifier, recoveryCode, newPassword } = body;
  const cleanId = (identifier || '').trim().toLowerCase();
  const db = getDb();
  const user = db.users.find(u => u.username.toLowerCase() === cleanId || (u.email && u.email.toLowerCase() === cleanId));
  if (!user) {
    throw new Error('No matching user found.');
  }
  if (!user.recoveryCode || user.recoveryCode.toUpperCase() !== (recoveryCode || '').trim().toUpperCase()) {
    throw new Error('Invalid recovery code for this account.');
  }
  if (!newPassword || newPassword.length !== 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new Error('New password must be exactly 8 characters with letter and number.');
  }
  db.passwords[user.id] = newPassword;
  saveDb(db);

  const token = `token_${user.id}_${Date.now()}`;
  localStorage.setItem(CLIENT_TOKEN_KEY, user.id);

  return { message: 'Password reset successfully', token, user };
}

export function clientHandleUpdateProfile(body: any): { user: UserProfile } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) throw new Error('Authentication required');
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');

  if (body.fullName) user.fullName = body.fullName.trim();
  if (body.username) {
    const cu = body.username.trim().toLowerCase();
    if (db.users.some(u => u.id !== user.id && u.username.toLowerCase() === cu)) {
      throw new Error('This username is already taken.');
    }
    user.username = cu;
  }
  if (body.email !== undefined) user.email = body.email ? body.email.trim().toLowerCase() : null;
  if (body.bio !== undefined) user.bio = body.bio.trim();
  if (body.avatarUrl !== undefined) user.avatarUrl = body.avatarUrl;
  if (body.privacy) user.privacy = { ...user.privacy, ...body.privacy };

  saveDb(db);
  return { user };
}

export function clientHandleSearch(query: string): { users: PublicUserProfile[] } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  const q = (query || '').trim().toLowerCase();
  if (!q) return { users: [] };
  const db = getDb();
  const matches = db.users.filter(u => u.id !== userId && (u.username.toLowerCase().includes(q) || (u.email && u.email.toLowerCase() === q)));
  return { users: matches.map(u => sanitizeProfile(u, userId || undefined)) };
}

export function clientHandleGetContacts(): { contacts: (PublicUserProfile & { isBlocked?: boolean })[] } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  const db = getDb();
  const currentUser = db.users.find(u => u.id === userId);
  const others = db.users.filter(u => u.id !== userId);
  return {
    contacts: others.map(u => ({
      ...sanitizeProfile(u, userId || undefined),
      isBlocked: currentUser ? currentUser.blockedUserIds.includes(u.id) : false
    }))
  };
}

export function clientHandleGetConversations(): { conversations: Conversation[] } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) return { conversations: [] };
  const db = getDb();
  const list = db.conversations.filter(c => c.participantIds.includes(userId) && !c.deletedForUsers.includes(userId));

  const convs: Conversation[] = list.map(c => {
    const otherId = c.participantIds.find(id => id !== userId) || userId;
    const otherUser = db.users.find(u => u.id === otherId);
    const msgs = db.messages.filter(m => m.conversationId === c.id && !m.deletedFor.includes(userId));
    const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

    return {
      id: c.id,
      participantIds: c.participantIds,
      otherUser: otherUser ? sanitizeProfile(otherUser, userId) : undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMessage: lastMsg,
      unreadCount: c.unreadCounts[userId] || 0
    };
  });

  convs.sort((a, b) => b.updatedAt - a.updatedAt);
  return { conversations: convs };
}

export function clientHandleCreateConversation(recipientId: string): { conversation: Conversation } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) throw new Error('Authentication required');
  const db = getDb();
  const recipient = db.users.find(u => u.id === recipientId);
  if (!recipient) throw new Error('Recipient not found');

  let conv = db.conversations.find(c => 
    (c.participantIds[0] === userId && c.participantIds[1] === recipientId) ||
    (c.participantIds[0] === recipientId && c.participantIds[1] === userId)
  );

  if (!conv) {
    conv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      participantIds: [userId, recipientId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      clearedTimestamps: {},
      deletedForUsers: [],
      unreadCounts: { [userId]: 0, [recipientId]: 0 }
    };
    db.conversations.unshift(conv);
    saveDb(db);
  } else {
    conv.deletedForUsers = conv.deletedForUsers.filter(id => id !== userId);
    saveDb(db);
  }

  const msgs = db.messages.filter(m => m.conversationId === conv!.id && !m.deletedFor.includes(userId));
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

  return {
    conversation: {
      id: conv.id,
      participantIds: conv.participantIds,
      otherUser: sanitizeProfile(recipient, userId),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessage: lastMsg,
      unreadCount: conv.unreadCounts[userId] || 0
    }
  };
}

export function clientHandleGetMessages(convId: string): { messages: Message[] } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) return { messages: [] };
  const db = getDb();
  const conv = db.conversations.find(c => c.id === convId);
  if (!conv) return { messages: [] };

  conv.unreadCounts[userId] = 0;
  saveDb(db);

  const cleared = conv.clearedTimestamps[userId] || 0;
  const msgs = db.messages.filter(m => m.conversationId === convId && !m.deletedFor.includes(userId) && m.createdAt > cleared);
  return { messages: msgs };
}

export function clientHandleSendMessage(convId: string, body: any): { message: Message } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) throw new Error('Authentication required');
  const db = getDb();
  const conv = db.conversations.find(c => c.id === convId);
  if (!conv) throw new Error('Conversation not found');

  const otherId = conv.participantIds.find(id => id !== userId)!;
  const newMsg: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    clientTempId: body.clientTempId,
    conversationId: convId,
    senderId: userId,
    receiverId: otherId,
    content: (body.content || '').trim(),
    type: body.type || 'text',
    mediaUrl: body.mediaUrl || null,
    caption: body.caption || null,
    replyTo: body.replyTo || null,
    status: 'delivered',
    createdAt: Date.now(),
    deletedFor: []
  };

  db.messages.push(newMsg);
  conv.updatedAt = newMsg.createdAt;
  conv.unreadCounts[otherId] = (conv.unreadCounts[otherId] || 0) + 1;
  saveDb(db);

  return { message: newMsg };
}

export function clientHandleGetStatuses(): { statuses: StatusUpdate[] } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  const db = getDb();
  const nowTime = Date.now();
  const active = db.statuses.filter(s => s.expiresAt > nowTime);

  const formatted = active.map(s => {
    const author = db.users.find(u => u.id === s.userId);
    return {
      ...s,
      user: author ? sanitizeProfile(author, userId || undefined) : undefined,
      hasViewed: s.viewers.some(v => v.userId === userId)
    };
  });
  return { statuses: formatted };
}

export function clientHandleAddStatus(body: any): { status: StatusUpdate } {
  const userId = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!userId) throw new Error('Authentication required');
  const db = getDb();
  const author = db.users.find(u => u.id === userId);

  const newStatus: StatusUpdate = {
    id: `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    user: author ? sanitizeProfile(author, userId) : undefined,
    type: body.type || 'text',
    content: (body.content || '').trim(),
    mediaUrl: body.mediaUrl || null,
    backgroundColor: body.backgroundColor || '#E5E5EA',
    fontStyle: body.fontStyle || 'font-sans',
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    viewers: []
  };

  db.statuses.unshift(newStatus);
  saveDb(db);
  return { status: newStatus };
}
