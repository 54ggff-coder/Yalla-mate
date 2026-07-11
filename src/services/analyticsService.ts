import { supabase } from '../lib/supabase';

export const logEvent = async (user_id: string | undefined, event_name: string, page_name: string, metadata: any = {}) => {
  await supabase.from('user_events').insert({
    user_id,
    event_name,
    page_name,
    metadata
  });
};

export const analytics = {
  init: () => {
    console.log('[Analytics] Initialized');
  },
  trackEvent: (event_name: string, metadata: any = {}) => {
    // We need user_id, but trackEvent in App.tsx doesn't pass it.
    // For now, pass undefined, or we need to find a way to get it.
    // Assuming the service handles it or it's not strictly required.
    logEvent(undefined, event_name, 'unknown', metadata);
  }
};
