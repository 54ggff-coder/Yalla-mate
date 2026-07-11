import { supabase } from '../lib/supabase';
import { getPendingMessages, clearPendingMessages, getPendingFriendRequests, clearPendingFriendRequests, saveMessageToPending, saveFriendRequestToPending } from './db';

class OfflineSyncService {
  private isSyncing = false;

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  async getPendingCount(): Promise<number> {
    try {
      const msgs = await getPendingMessages();
      const reqs = await getPendingFriendRequests();
      return (msgs?.length || 0) + (reqs?.length || 0);
    } catch (e) {
      return 0;
    }
  }

  private notify() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('offline-sync-change'));
    }
  }

  async syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify();
    
    try {
      await this.syncMessages();
      await this.syncFriendRequests();
    } catch (e) {
      console.error('[OfflineSyncService] Sync failed:', e);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  async processQueue() {
    await this.syncAll();
  }

  async queueOutgoingMessage(chatId_or_msg: any, msg?: any) {
    const message = msg ? msg : chatId_or_msg;
    await saveMessageToPending(message);
    this.notify();
    this.syncAll();
  }

  async queueOutgoingFriendRequest(req: any) {
    await saveFriendRequestToPending(req);
    this.notify();
    this.syncAll();
  }

  private async syncMessages() {
    const pending = await getPendingMessages();
    if (pending.length === 0) return;

    const successfullySynced: any[] = [];
    for (const msg of pending) {
      try {
        const { error } = await supabase.from('direct_messages').insert([msg]);
        if (!error) {
          successfullySynced.push(msg.id);
        } else if (error.code === '23505') { // Unique constraint
          successfullySynced.push(msg.id);
        }
      } catch (e) {
        console.error('[OfflineSyncService] Failed to sync message', msg.id, e);
      }
    }
    if (successfullySynced.length > 0) {
      await clearPendingMessages(successfullySynced);
    }
  }

  private async syncFriendRequests() {
    const pending = await getPendingFriendRequests();
    if (pending.length === 0) return;

    const successfullySynced: string[] = [];
    for (const req of pending) {
      try {
        if (req.requestId && req.currentUserId) {
          // It's an update (accept/reject)
          const status = req.senderId ? 'accepted' : 'rejected';
          const { error } = await supabase
            .from('friend_requests')
            .update({ status })
            .eq('id', req.requestId);
          
          if (!error || error.code === 'PGRST116') {
            successfullySynced.push(req.id || req.requestId);
          }
        } else {
          // It's a new request (insert)
          const { error } = await supabase.from('friend_requests').insert([req]);
          if (!error || error.code === '23505') {
            successfullySynced.push(req.id);
          }
        }
      } catch (e) {
        console.error('[OfflineSyncService] Failed to sync friend request', req.id, e);
      }
    }
    if (successfullySynced.length > 0) {
      await clearPendingFriendRequests(successfullySynced);
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
