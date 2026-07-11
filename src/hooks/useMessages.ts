
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { getPendingMessages } from '../services/db';

export function useMessages(id: string | null, type: 'outing' | 'chat' | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !type) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Initial fetch merged with IndexedDB pending messages
    const fetchMessages = async () => {
        let remoteMsgs: Message[] = [];
        try {
          const { data, error } = await supabase
              .from('direct_messages')
              .select('*')
              .eq(type === 'outing' ? 'outingId' : 'chatId', id)
              .order('timestamp', { ascending: true });
              
          if (!error && data) {
              remoteMsgs = data as Message[];
          } else if (error) {
              console.error('Error fetching remote messages:', error);
          }
        } catch (err) {
          console.error('Exception during messages fetch:', err);
        }

        let pendingMsgs: Message[] = [];
        try {
          const pending = await getPendingMessages();
          pendingMsgs = pending.filter((m: any) => 
            type === 'outing' ? m.outingId === id : m.chatId === id
          ) as Message[];
        } catch (e) {
          console.error('Failed to retrieve IndexedDB pending messages:', e);
        }

        // Combine uniquely by ID
        const combined = [...remoteMsgs];
        pendingMsgs.forEach(pm => {
          if (!combined.some(m => m.id === pm.id)) {
            combined.push(pm);
          }
        });

        // Final safety deduplication
        const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
        setMessages(unique);
        setLoading(false);
    }
    
    fetchMessages();

    // Listen to local optimistic/pending additions and queue synchronization flushes
    const handlePendingChanged = () => {
      fetchMessages();
    };
    window.addEventListener('pending_messages_changed', handlePendingChanged);

    // Subscribe to realtime changes
    const channel = supabase
      .channel('messages_channel_' + id)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `${type === 'outing' ? 'outingId' : 'chatId'}=eq.${id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => {
            if (payload.new && prev.some(m => m.id === payload.new.id)) return prev;
            // Filter out corresponding pending mock message ID if it exists and replace
            const listData = prev.filter(m => m.id !== payload.new.id);
            return [...listData, payload.new as Message];
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? (payload.new as Message) : m));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pending_messages_changed', handlePendingChanged);
    };
  }, [id, type]);

  return { messages, loading };
}
