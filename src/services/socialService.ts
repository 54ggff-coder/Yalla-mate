import { supabase } from '../lib/supabase';

export interface SocialOverview {
  pending_incoming: any[];
  pending_outgoing: string[];
  friends: string[];
  active_chat_partners: string[];
}

export class SocialService {
  private static didInit = false;

  static async ensureSocialOverviewFunction() {
    if (this.didInit) return;
    this.didInit = true;

    try {
      console.log('[SocialService] Ensuring get_social_overview custom SQL function exists and securing RLS...');
      const sql = `
        -- 1. Create the unified get_social_overview getter helper
        CREATE OR REPLACE FUNCTION public.get_social_overview(p_user_id TEXT)
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_pending_incoming JSONB;
            v_pending_outgoing TEXT[];
            v_friends TEXT[];
            v_active_chat_partners TEXT[];
        BEGIN
            -- 1. Pending incoming friend requests
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'senderId', "senderId",
                    'receiverId', "receiverId",
                    'status', status,
                    'senderName', "senderName",
                    'senderAvatar', "senderAvatar",
                    'timestamp', timestamp
                )
            ), '[]'::jsonb)
            INTO v_pending_incoming
            FROM public.friend_requests
            WHERE "receiverId" = p_user_id AND status = 'pending';

            -- 2. Pending outgoing request receiver IDs
            SELECT COALESCE(array_agg(DISTINCT "receiverId"), '{}'::TEXT[])
            INTO v_pending_outgoing
            FROM public.friend_requests
            WHERE "senderId" = p_user_id AND status = 'pending';

            -- 3. Friends
            SELECT COALESCE(array_agg(DISTINCT CASE WHEN "senderId" = p_user_id THEN "receiverId" ELSE "senderId" END), '{}'::TEXT[])
            INTO v_friends
            FROM public.friend_requests
            WHERE ("senderId" = p_user_id OR "receiverId" = p_user_id) AND status = 'accepted';

            -- 4. Active chats partners (from direct_messages senderId/receiverId)
            SELECT COALESCE(array_agg(DISTINCT CASE WHEN "senderId" = p_user_id THEN "receiverId" ELSE "senderId" END), '{}'::TEXT[])
            INTO v_active_chat_partners
            FROM public.direct_messages
            WHERE "senderId" = p_user_id OR "receiverId" = p_user_id;

            RETURN jsonb_build_object(
                'pending_incoming', v_pending_incoming,
                'pending_outgoing', v_pending_outgoing,
                'friends', v_friends,
                'active_chat_partners', v_active_chat_partners
            );
        END;
        $$;

        -- 2. Self-healing Sync setup: populate public.users with any orphanedauth.users
        INSERT INTO public.users (id, auth_id, name, "displayName", avatar, username)
        SELECT 
          id::text, 
          id, 
          COALESCE(raw_user_meta_data->>'full_name', email, 'Mate'), 
          COALESCE(raw_user_meta_data->>'full_name', email, 'Mate'), 
          COALESCE(raw_user_meta_data->>'avatar_url', COALESCE(raw_user_meta_data->>'avatar', '👤')),
          COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1))
        FROM auth.users
        ON CONFLICT (id) DO NOTHING;

        -- Setup storage buckets requested
        INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', true) ON CONFLICT (id) DO NOTHING;
        INSERT INTO storage.buckets (id, name, public) VALUES ('places', 'places', true) ON CONFLICT (id) DO NOTHING;
      `;

      const { error } = await supabase.rpc('execute_sql', { sql_query: sql });
      if (error) {
        console.warn('[SocialService] execute_sql failed while registering get_social_overview:', error);
      } else {
        console.log('[SocialService] Successfully registered get_social_overview function inside DB & secure RLS.');
        
        // Notify PostgREST to reload schema cache
        await supabase.rpc('execute_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
      }
    } catch (e) {
      console.warn('[SocialService] Failed to push SQL function get_social_overview:', e);
    }
  }

  /**
   * Fetches unified relationship data via single RPC.
   */
  static async getSocialOverview(userId: string): Promise<SocialOverview> {
    // Make sure SQL function exists
    await this.ensureSocialOverviewFunction();

    try {
      console.log(`[SocialService] Fetching unified social overview for user=${userId}`);
      const { data, error } = await supabase.rpc('get_social_overview', { p_user_id: userId });

      if (error) {
        throw error;
      }

      if (data) {
        const overview = data as SocialOverview;
        console.log('[SocialService] Fetched overview successfully:', overview);
        return {
          pending_incoming: overview.pending_incoming || [],
          pending_outgoing: overview.pending_outgoing || [],
          friends: overview.friends || [],
          active_chat_partners: overview.active_chat_partners || []
        };
      }
    } catch (err) {
      console.warn('[SocialService] get_social_overview RPC failed. Falling back to client-side fetches:', err);
    }

    // Fallback: build manually if RPC fails or isn't created
    try {
      const { data: frData } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`"receiverId".eq.${userId},"senderId".eq.${userId}`);

      const pending_incoming = (frData || []).filter(r => r.receiverId === userId && r.status === 'pending');
      const pending_outgoing = (frData || []).filter(r => r.senderId === userId && r.status === 'pending').map(r => r.receiverId);
      const friends = (frData || []).filter(r => r.status === 'accepted').map(r => r.senderId === userId ? r.receiverId : r.senderId);

      const { data: dmData } = await supabase
        .from('direct_messages')
        .select('"senderId", "receiverId"')
        .or(`"senderId".eq.${userId},"receiverId".eq.${userId}`);

      const active_chat_partners = Array.from(new Set(
        (dmData || []).map(m => m.senderId === userId ? m.receiverId : m.senderId)
      ));

      return {
        pending_incoming,
        pending_outgoing,
        friends,
        active_chat_partners
      };
    } catch (fallbackErr) {
      console.error('[SocialService] Fallback fetch failed as well:', fallbackErr);
      return {
        pending_incoming: [],
        pending_outgoing: [],
        friends: [],
        active_chat_partners: []
      };
    }
  }
}
