import { supabase } from '../lib/supabase';

/**
 * Executes operations on friend_requests table ensuring atomic, bidirectional status updates.
 */
export class FriendshipManager {
  /**
   * Diagnostic trace helper.
   */
  static async logDiagnosticState(requestId: string, senderId: string, receiverId: string, context: string) {
    try {
      console.log(`[FriendshipManager Diagnostics - ${context}] Starting trace...`);
      console.log(`- Request ID: ${requestId}`);
      console.log(`- Sender ID: ${senderId}`);
      console.log(`- Receiver ID: ${receiverId}`);

      // Query request by ID
      if (requestId) {
        const { data: reqById, error: errById } = await supabase
          .from('friend_requests')
          .select('id, "senderId", "receiverId", status, "senderName", "senderAvatar"')
          .eq('id', requestId)
          .maybeSingle();
        console.log(`- Base Request Row in DB:`, reqById, errById ? `Error: ${errById.message}` : '');
      }

      // Query bidirectional states
      const { data: bidirRows, error: bidirErr } = await supabase
        .from('friend_requests')
        .select('id, senderId, receiverId, status')
        .in('senderId', [senderId, receiverId])
        .in('receiverId', [senderId, receiverId]);
      
      console.log(`- Bidirectional Relationship Rows:`, bidirRows, bidirErr ? `Error: ${bidirErr.message}` : '');
    } catch (e) {
      console.warn('[FriendshipManager Diagnostics] Logging failed:', e);
    }
  }

  /**
   * Accepts a friend request and ensures bidirectional "accepted" status.
   * If there is an existing request, it marks it 'accepted'.
   * It also creates the inverse record as 'accepted' if it doesn't exist, using a Postgres RPC via execute_sql,
   * or a fallback approach if execute_sql fails.
   */
  static async acceptRequest(requestId: string, senderId: string, receiverId: string, senderName?: string, senderAvatar?: string, receiverName?: string, receiverAvatar?: string) {
    console.log(`[FriendshipManager] acceptRequest initiated by receiver=${receiverId} for sender=${senderId}, requestId=${requestId}`);
    await this.logDiagnosticState(requestId, senderId, receiverId, 'BEFORE_ACCEPT');

    // 1. We attempt to run an atomic execute_sql script
    try {
      console.log('[FriendshipManager] Attempting atomic execute_sql update...');
      const { error: sqlError } = await supabase.rpc('execute_sql', {
        sql_query: `
          DO $$
          BEGIN
            -- Update the original request
            UPDATE public.friend_requests
            SET status = 'accepted'
            WHERE id = '${requestId}';

            -- Update the reverse request if it exists
            UPDATE public.friend_requests
            SET status = 'accepted'
            WHERE "senderId" = '${receiverId}' AND "receiverId" = '${senderId}';

            -- If the reverse request wasn't found, insert it
            IF NOT FOUND THEN
              INSERT INTO public.friend_requests (id, "senderId", "receiverId", status, "senderName", "senderAvatar", timestamp)
              VALUES (
                gen_random_uuid()::text,
                '${receiverId}',
                '${senderId}',
                'accepted',
                ${receiverName ? `'${receiverName}'` : 'NULL'},
                ${receiverAvatar ? `'${receiverAvatar}'` : 'NULL'},
                timezone('utc'::text, now())
              );
            END IF;
          END;
          $$;
        `
      });

      if (!sqlError) {
        console.log('[FriendshipManager] Atomic execute_sql updated database successfully.');
        await this.logDiagnosticState(requestId, senderId, receiverId, 'AFTER_SQL_ACCEPT');
        return { success: true };
      }
      console.warn('[friendshipManager] execute_sql failed, falling back to client-side requests...', sqlError);
    } catch (e) {
      console.warn('[friendshipManager] execute_sql exception, falling back...', e);
    }

    // 2. Fallback to client-side operations
    console.log('[FriendshipManager] Running fallback client-side accept updates...');
    const { error: updateErr } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (updateErr) {
      console.error('[friendshipManager] Failed to update request:', updateErr);
      return { success: false, error: updateErr };
    }

    // Check if inverse exists using camelCase
    const { data: inverseData, error: invFetchErr } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('senderId', receiverId)
      .eq('receiverId', senderId)
      .limit(1);

    if (invFetchErr) {
      console.warn('[FriendshipManager] Error fetching inverse request:', invFetchErr);
    }

    if (inverseData && inverseData.length > 0) {
      console.log(`[FriendshipManager] Inverse request exists (ID: ${inverseData[0].id}), updating to accepted...`);
      const { error: invUpdateErr } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', inverseData[0].id);
      if (invUpdateErr) {
        console.error('[FriendshipManager] Failed to update inverse request:', invUpdateErr);
      }
    } else {
      console.log(`[FriendshipManager] Inverse request does not exist, inserting inverse record...`);
      const { error: invInsertErr } = await supabase
        .from('friend_requests')
        .insert([{
           id: crypto.randomUUID(),
           senderId: receiverId,
           receiverId: senderId,
           status: 'accepted',
           senderName: receiverName || 'User',
           senderAvatar: receiverAvatar || '👋',
           timestamp: new Date().toISOString()
        }]);
      if (invInsertErr) {
        console.error('[FriendshipManager] Failed to insert inverse record:', invInsertErr);
      }
    }

    await this.logDiagnosticState(requestId, senderId, receiverId, 'AFTER_CLIENT_FALLBACK');
    return { success: true };
  }

  static async rejectRequest(requestId: string) {
    console.log(`[FriendshipManager] rejectRequest triggered for requestId=${requestId}`);
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    
    if (error) {
      console.error('[friendshipManager] Failed to reject request:', error);
      return { success: false, error };
    }
    console.log(`[FriendshipManager] Successfully rejected request=${requestId}`);
    return { success: true };
  }

  static async sendRequest(sender: any, receiverId: string) {
    if (!sender || !receiverId) {
      console.warn('[FriendshipManager] Missing sender or receiverId', { sender, receiverId });
      return { success: false };
    }
    console.log(`[FriendshipManager] sendRequest from sender=${sender.id} to receiver=${receiverId}`);

    // Check if a request already exists
    const { data: existing, error: findErr } = await supabase
      .from('friend_requests')
      .select('id, status')
      .in('senderId', [sender.id, receiverId])
      .in('receiverId', [sender.id, receiverId])
      .limit(1);

    if (findErr) {
      console.error('[FriendshipManager] Error finding existing request:', findErr);
    }

    if (existing && existing.length > 0) {
      console.log(`[FriendshipManager] Existing relationship found (Status: ${existing[0].status})`);
      if (existing[0].status === 'accepted') {
        return { success: true, message: 'Already friends' };
      }
      return { success: true, message: 'Request already pending' };
    }

    const { error } = await supabase.from('friend_requests').insert([{
      id: crypto.randomUUID(),
      senderId: sender.id,
      receiverId: receiverId,
      senderName: sender.displayName || sender.name || 'Mate',
      senderAvatar: sender.avatar || '👤',
      status: 'pending',
      timestamp: new Date().toISOString()
    }]);

    if (error) {
       console.error('[friendshipManager] Failed to send request:', error);
       return { success: false, error };
    }
    console.log('[FriendshipManager] Friend request sent successfully');
    return { success: true };
  }
}

