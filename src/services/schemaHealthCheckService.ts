import { supabase } from '../lib/supabase';

class SchemaHealthCheckService {
  private isChecking = false;
  private intervalId: any = null;

  start(intervalMs: number = 30000) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.checkHealth(), intervalMs);
    // Initial check
    this.checkHealth();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async reloadSchema() {
    try {
      console.log('[SchemaHealthCheck] Triggering NOTIFY pgrst, reload schema...');
      await supabase.rpc('execute_sql', {
        sql_query: "NOTIFY pgrst, 'reload schema';"
      });
    } catch (e) {
      console.error('[SchemaHealthCheck] Failed to reload schema:', e);
    }
  }

  private async checkHealth() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const tablesToCheck = ['reels_likes', 'direct_messages', 'friend_requests'];
      let needsReload = false;

      for (const table of tablesToCheck) {
        // We only fetch 1 row just to see if the table responds or returns PGRST205
        const { error } = await supabase.from(table).select('id').limit(1);
        
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            console.warn(`[SchemaHealthCheck] PGRST205 detected on ${table}. Marking for reload...`);
            needsReload = true;
            break;
          }
        }
      }

      if (needsReload) {
        await this.reloadSchema();
      }

    } catch (e) {
      console.error('[SchemaHealthCheck] Health check failed:', e);
    } finally {
      this.isChecking = false;
    }
  }
}

export const schemaHealthCheckService = new SchemaHealthCheckService();
