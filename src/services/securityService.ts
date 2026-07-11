import { supabase } from '../lib/supabase';

export const logSecurityEvent = async (user_id: string | undefined, event_type: string, risk_level: string, description: string, metadata: any = {}) => {
  await supabase.from('security_events').insert({
    user_id,
    event_type,
    risk_level,
    description,
    metadata
  });
};
