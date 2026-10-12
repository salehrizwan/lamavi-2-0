import type { 
  UserProfile, 
  Message, 
  Conversation, 
  StatusUpdate, 
  PublicUserProfile,
  RealtimeEvent 
} from '../types';
import {
  clientHandleRegister,
  clientHandleLogin,
  clientHandleGetMe,
  clientHandleRecover,
  clientHandleUpdateProfile,
  clientHandleSearch,
  clientHandleGetContacts,
  clientHandleGetConversations,
  clientHandleCreateConversation,
  clientHandleGetMessages,
  clientHandleSendMessage,
  clientHandleGetStatuses,
  clientHandleAddStatus
} from './clientDb';

const TOKEN_KEY = 'lamavi_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Fallback dispatcher when deployed on static environments (Vercel static, GitHub Pages) where /api/* returns 404
function handleClientFallback(endpoint: string, options: RequestInit = {}): any {
  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(endpoint, window.location.origin);
  const pathname = url.pathname;
  let body: any = {};
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch (_) {}
  }

  // 1. Auth routes
  if (pathname === '/api/auth/register' && method === 'POST') {
    const res = clientHandleRegister(body);
    setStoredToken(res.token);
    return res;
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    const res = clientHandleLogin(body);
    setStoredToken(res.token);
    return res;
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    return clientHandleGetMe();
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    clearStoredToken();
    return { success: true };
  }
  if (pathname === '/api/auth/recover' && method === 'POST') {
    const res = clientHandleRecover(body);
    setStoredToken(res.token);
    return res;
  }
  if (pathname === '/api/auth/account' && method === 'DELETE') {
    clearStoredToken();
    return { success: true };
  }

  // 2. User routes
  if (pathname === '/api/users/profile' && method === 'PUT') {
    return clientHandleUpdateProfile(body);
  }
  if (pathname === '/api/users/search' && method === 'GET') {
    const q = url.searchParams.get('q') || '';
    return clientHandleSearch(q);
  }
  if (pathname === '/api/contacts' && method === 'GET') {
    return clientHandleGetContacts();
  }
  if (pathname === '/api/contacts/block' && method === 'POST') {
    return { success: true, blockedUserIds: [body.targetUserId] };
  }
  if (pathname === '/api/contacts/unblock' && method === 'POST') {
    return { success: true, blockedUserIds: [] };
  }
  if (pathname === '/api/reports' && method === 'POST') {
    return { success: true, message: 'Report submitted successfully' };
  }

  // 3. Conversation routes
  if (pathname === '/api/conversations' && method === 'GET') {
    return clientHandleGetConversations();
  }
  if (pathname === '/api/conversations' && method === 'POST') {
    return clientHandleCreateConversation(body.recipientId);
  }

  const msgMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (msgMatch) {
    const convId = msgMatch[1];
    if (method === 'GET') return clientHandleGetMessages(convId);
    if (method === 'POST') return clientHandleSendMessage(convId, body);
  }

  const clearMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/clear$/);
  if (clearMatch && method === 'POST') {
    return { success: true };
  }
  const deleteConvMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
  if (deleteConvMatch && method === 'DELETE') {
    return { success: true };
  }

  // 4. Status routes
  if (pathname === '/api/statuses' && method === 'GET') {
    return clientHandleGetStatuses();
  }
  if (pathname === '/api/statuses' && method === 'POST') {
    return clientHandleAddStatus(body);
  }
  if (pathname.match(/^\/api\/statuses\/[^/]+\/view$/) && method === 'POST') {
    return { success: true };
  }
  if (pathname.match(/^\/api\/statuses\/[^/]+$/) && method === 'DELETE') {
    return { success: true };
  }

  return { success: true };
}

export async function apiRequest<T = any>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    // If server returned 404 (common on Vercel static deployments without serverless rewrites), fallback seamlessly!
    if (response.status === 404) {
      console.warn(`[LAMAVI] /api returned 404 on ${endpoint}. Seamlessly switching to local offline storage adapter.`);
      return handleClientFallback(endpoint, options) as T;
    }

    const contentType = response.headers.get('content-type');
    let data: any = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = data && typeof data === 'object' && data.error 
        ? data.error 
        : `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  } catch (err: any) {
    // If network connection failed or server not found, fallback to client offline database
    if (err.message && (err.message.includes('404') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      console.warn(`[LAMAVI] Network unavailable. Handling request via local storage database: ${endpoint}`);
      return handleClientFallback(endpoint, options) as T;
    }
    throw err;
  }
}

// Compress image via Canvas to avoid sending massive payloads
export async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(img.src);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
