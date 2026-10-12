import type { Message } from '../types';
import { apiRequest } from './api';

const QUEUE_KEY = 'lamavi_offline_queue';
const DRAFTS_KEY = 'lamavi_chat_drafts';

export interface QueuedMessage {
  tempId: string;
  conversationId: string;
  content: string;
  type: 'text' | 'image';
  mediaUrl?: string | null;
  caption?: string | null;
  replyTo?: any;
  createdAt: number;
}

export function getOfflineQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(item: QueuedMessage): void {
  const queue = getOfflineQueue();
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromOfflineQueue(tempId: string): void {
  const queue = getOfflineQueue().filter(q => q.tempId !== tempId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

// Conversation Drafts
export function getDraft(conversationId: string): string {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const drafts = raw ? JSON.parse(raw) : {};
    return drafts[conversationId] || '';
  } catch {
    return '';
  }
}

export function saveDraft(conversationId: string, text: string): void {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const drafts = raw ? JSON.parse(raw) : {};
    if (text.trim().length === 0) {
      delete drafts[conversationId];
    } else {
      drafts[conversationId] = text;
    }
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
}

// Process and sync queued messages when connection is restored
export async function syncOfflineQueue(onMessageSent?: (msg: Message, tempId: string) => void): Promise<number> {
  if (!navigator.onLine) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  for (const item of queue) {
    try {
      const response = await apiRequest<{ message: Message }>(`/api/conversations/${item.conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: item.content,
          type: item.type,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          replyTo: item.replyTo,
          clientTempId: item.tempId
        })
      });
      removeFromOfflineQueue(item.tempId);
      syncedCount++;
      if (onMessageSent) {
        onMessageSent(response.message, item.tempId);
      }
    } catch (err) {
      console.warn('Could not sync message in offline queue:', item.tempId, err);
      // Stop or continue next
      break;
    }
  }
  return syncedCount;
}
