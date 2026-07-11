import { supabase } from '../lib/supabase';

export const reelsService = {
  async editReel(reelId: string, caption: string) {
    const { data, error } = await supabase
      .from('reels')
      .update({ caption })
      .eq('id', reelId);
    if (error) throw error;
    return data;
  },

  async deleteReel(reelId: string) {
    const { data, error } = await supabase
      .from('reels')
      .delete()
      .eq('id', reelId);
    if (error) throw error;
    return data;
  }
};
