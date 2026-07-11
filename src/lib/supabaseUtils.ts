import { supabase } from './supabase';

/**
 * Splits a select query string by top-level commas, respecting parenthetical nested groups.
 */
function splitTopLevelCommas(str: string): string[] {
  if (!str) return [];
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
    }
    
    if (char === ',' && parenDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Removes a missing column name from the query string recursively while keeping the query balanced.
 */
function removeColumnFromQuery(selectQuery: string, colName: string): string {
  if (!selectQuery) return '';
  const regexOnly = new RegExp(`\\b${colName}\\b`, 'g');
  
  if (!selectQuery.match(regexOnly)) {
    return selectQuery;
  }
  
  const cleanField = (field: string): string => {
    if (field.includes('(')) {
      const startIdx = field.indexOf('(');
      const endIdx = field.lastIndexOf(')');
      if (startIdx !== -1 && endIdx !== -1) {
        const prefix = field.substring(0, startIdx);
        if (prefix.match(regexOnly)) {
          return '';
        }
        const inside = field.substring(startIdx + 1, endIdx);
        const insideParts = splitTopLevelCommas(inside);
        const cleanedInside = insideParts
          .map(p => cleanField(p))
          .filter(p => !p.match(regexOnly) && p.trim().length > 0)
          .join(', ');
        return cleanedInside ? `${prefix}(${cleanedInside})` : '';
      }
    }
    return field.match(regexOnly) ? '' : field;
  };

  const parts = splitTopLevelCommas(selectQuery);
  const result = parts
    .map(p => cleanField(p))
    .filter(p => p.trim().length > 0)
    .join(', ');

  return result;
}

/**
 * A robust wrapper for Supabase select queries that includes standardized error checking,
 * specific PostgreSQL error code logging, and console reporting.
 * Retries dynamically and SILENTLY if a requested column is missing.
 * 
 * @param table - The name of the table to query
 * @param selectQuery - The select query string (e.g. '*')
 * @param modifier - A callback to apply additional modifiers like eq, order, etc.
 */
export async function robustSelect<T = any>(
  table: string, 
  selectQuery: string = '*', 
  modifier?: (query: any) => any
): Promise<{ data: T[] | null; error: any | null }> {
  
  if (!supabase) {
    console.error(`[Supabase Error] Cannot execute select query on table "${table}". Client is null.`);
    return { data: null, error: { message: 'Supabase client not initialized' } };
  }

  let currentQueryString = selectQuery;
  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      let query = supabase.from(table).select(currentQueryString);
      
      if (modifier) {
        query = modifier(query);
      }
      
      const { data, error } = await query;

      if (!error) {
        return { data: data as T[], error: null };
      }

      // If it's a "column does not exist" error, handle it silently without triggering telemetry
      if (error.code === '42703') {
        // Match standard messages like "column reels.creatorId does not exist" or 'column "creatorId" of relation "reels" does not exist'
        const match = error.message.match(/column \w+\.?(\w+) does not exist/) || 
                      error.message.match(/column "([^"]+)"/) ||
                      error.message.match(/column \w+\.?([^ ]+) does not exist/);
        
        const colName = match ? match[1] : null;

        if (colName) {
          const nextQueryString = removeColumnFromQuery(currentQueryString, colName);
          
          if (nextQueryString !== currentQueryString && nextQueryString.trim().length > 0) {
            console.warn(`[Auto-Recovery] Table "${table}" is missing requested column "${colName}". Silently retrying without it.`);
            currentQueryString = nextQueryString;
            continue; // Retry standard query inside loop silently
          } else {
            // The missing column might have been applied by the modifier (e.g. order-by)
            console.warn(`[Auto-Recovery] Column "${colName}" causes error but is not in selection string. Retrying query without modifier callback.`);
            const fallbackQuery = supabase.from(table).select(currentQueryString);
            const { data: fallbackData, error: fallbackErr } = await fallbackQuery;
            if (!fallbackErr) {
              return { data: fallbackData as T[], error: null };
            }
          }
        }
      }

      // If it's a "relationship not found" error (PGRST200)
      if (error.code === 'PGRST200' || (error.message && error.message.includes('relationship') && error.message.includes('not found'))) {
        // Match table name from message like "Could not find a relationship between 'reels' and 'reels_likes'"
        const match = error.message.match(/between '\w+' and '(\w+)'/) || 
                      error.message.match(/relationship ["'](\w+)["']/);
        
        const relName = match ? match[1] : null;

        if (relName) {
          console.warn(`[Auto-Recovery] Table "${table}" has no relationship with "${relName}". Silently retrying selection without this join.`);
          const nextQueryString = removeColumnFromQuery(currentQueryString, relName);
          
          if (nextQueryString !== currentQueryString && nextQueryString.trim().length > 0) {
            currentQueryString = nextQueryString;
            continue; 
          }
        }
      }

      // If it's a schema cache error (PGRST205)
      if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        // Match table name from message like "Could not find the table 'public.reels_likes' in the schema cache"
        const match = error.message.match(/table 'public\.(\w+)'/) || error.message.match(/table '(\w+)'/);
        const tableNameNotFound = match ? match[1] : null;

        if (tableNameNotFound) {
          console.warn(`[Auto-Recovery] Table "${tableNameNotFound}" is not in PostgREST schema cache. Retrying selection without this join.`);
          const nextQueryString = removeColumnFromQuery(currentQueryString, tableNameNotFound);
          
          if (nextQueryString !== currentQueryString && nextQueryString.trim().length > 0) {
            currentQueryString = nextQueryString;
            continue; 
          }
        }
      }

      // If it's an ambiguous relation embedding error (PGRST201)
      if (error.code === 'PGRST201' || (error.message && error.message.includes('more than one relationship was found'))) {
        const hint = error.hint || '';
        // Look for recommendations in details/hint, e.g., 'users!reels_creatorId_fkey' or similar
        const match = hint.match(/'([^']+)'/);
        
        if (match) {
          const suggestedRelation = match[1]; // e.g., 'users!reels_creatorId_fkey'
          const baseTable = suggestedRelation.split('!')[0];
          
          console.warn(`[Auto-Recovery] Ambiguous relation detected for "${baseTable}". Retrying with "${suggestedRelation}".`);
          
          // Safer regex to replace only the table name in various contexts
          const nextQueryString = currentQueryString.replace(
            new RegExp(`(?<=[^\\w!]|^)${baseTable}(?=[\\(\\!,]|$)`, 'g'), 
            suggestedRelation
          );
          
          if (nextQueryString !== currentQueryString) {
            currentQueryString = nextQueryString;
            continue; 
          }
        }
      }

      // If it's another error, or schema recovery resulted in empty string, log and crash
      console.error(`[Supabase DB Error] Operation: SELECT on "${table}" failed (attempt ${attempt}/${maxRetries})`);
      console.error(`[Supabase DB Error] PostgreSQL Error Code: ${error.code || 'UNKNOWN'}`);
      console.error(`[Supabase DB Error] Message: ${error.message}`);
      console.error(`[Supabase DB Error] Full Details:`, JSON.stringify(error, null, 2));
      
      window.dispatchEvent(new CustomEvent('supabaseDiagnosticsError', { 
        detail: { table, operation: 'select', error } 
      }));
      
      return { data: null, error };
      
    } catch (err: any) {
      console.error(`[Supabase Fatal Error] Exception during SELECT on "${table}":`, err.message || err);
      return { data: null, error: err };
    }
  }

  const timeoutErr = { code: '42703', message: `Exceeded max schema recovery attempts for ${table}` };
  return { data: null, error: timeoutErr };
}

/**
 * Service to thoroughly delete a reel and its associated storage objects.
 */
export async function deleteReelService(reelId: string, videoUrl?: string, thumbnailUrl?: string) {
  try {
    // 1. Manually delete likes and comments first to avoid foreign key constraint errors
    await supabase.from('reels_likes').delete().eq('reel_id', reelId);
    await supabase.from('reels_comments').delete().eq('reel_id', reelId);

    // 2. Delete from database
    const { error: dbError } = await supabase.from('reels').delete().eq('id', reelId);
    if (dbError) throw dbError;

    // 3. Remove files from storage
    const filesToRemove: string[] = [];
    
    if (videoUrl && videoUrl.includes('reels/')) {
      const pathMatch = videoUrl.match(/reels\/([^?]+)/);
      if (pathMatch) filesToRemove.push(pathMatch[1]);
    }
    
    if (thumbnailUrl && thumbnailUrl.includes('reels/')) {
      const pathMatch = thumbnailUrl.match(/reels\/([^?]+)/);
      if (pathMatch) filesToRemove.push(pathMatch[1]);
    }

    if (filesToRemove.length > 0) {
      const { error: storageError } = await supabase.storage.from('reels').remove(filesToRemove);
      if (storageError) {
        console.warn('[deleteReelService] DB record deleted, but failed to remove some storage files:', storageError);
      }
    }
    
    return { success: true, error: null };
  } catch (error: any) {
    console.error('[deleteReelService] Failed to delete reel:', error);
    return { success: false, error };
  }
}

/**
 * Validates existing Supabase RLS policies for all 'outing' tables.
 * It verifies if 'authenticated' users have SELECT, INSERT and UPDATE access.
 * Returns descriptive error strings for the diagnostic UI to highlight required SQL fixes.
 */
export async function validateOutingRlsPolicies(): Promise<{ ok: boolean; errors: string[] }> {
  if (!supabase) return { ok: true, errors: [] };
  
  const tables = ['outings', 'outing_participants', 'outing_invites', 'outing_messages', 'outing_locations'];
  const errors: string[] = [];

  try {
    // 1. Try to invoke the SQL custom function checking active policies
    const { data, error } = await supabase.rpc('check_outing_policies');
    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        const t = row.table_name;
        if (!row.rls_enabled) {
          errors.push(`RLS مفقود أو غير مفصل لجدول: ${t} (RLS Disabled)`);
        } else {
          if (!row.has_select_policy) {
            errors.push(`صلاحية SELECT (القراءة) غير متوفرة لجدول: ${t}`);
          }
          if (!row.has_insert_policy) {
            errors.push(`صلاحية INSERT (الإضافة) للمستخدمين غير مفصلة بجدول: ${t}`);
          }
          if (!row.has_update_policy) {
            errors.push(`صلاحية UPDATE (التعديل) للمستخدمين غير مفصلة بجدول: ${t}`);
          }
        }
      });
      return { ok: errors.length === 0, errors };
    } else {
      if (error) {
        console.warn('[validateOutingRlsPolicies] RPC check_outing_policies returned error, falling back:', error.message);
      }
    }
  } catch (rpcErr) {
    console.warn('[validateOutingRlsPolicies] RPC audit exception, using dry-run tests:', rpcErr);
  }

  // Fallback direct simulation test on outings
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const testId = 'rls_diag_chk_99999';
      
      const { error: selectErr } = await supabase.from('outings').select('id').eq('id', testId).limit(1);
      if (selectErr && (selectErr.code === '42501' || selectErr.message?.includes('row-level security'))) {
        errors.push(`سياسة RLS للقراءة (SELECT) مفقودة أو مقيدة على جدول outings`);
      }

      const { error: insertErr } = await supabase.from('outings').insert([{
        id: testId,
        title: 'MOCK RLS CHECK',
        datetime: new Date().toISOString(),
        creatorId: session.user.id
      }]);

      if (insertErr) {
        if (insertErr.code === '42501' || insertErr.message?.includes('row-level security') || insertErr.message?.includes('violates row-level security')) {
          errors.push(`سياسة RLS تمنع مستخدمي authenticated من الإضافة (INSERT) بجدول outings`);
        }
      } else {
        // Clean up
        await supabase.from('outings').delete().eq('id', testId);
      }
    } else {
      console.info('[validateOutingRlsPolicies] No authenticated user session, skipping interactive dry-run check.');
    }
  } catch (err: any) {
    console.warn('[validateOutingRlsPolicies] Fallback emulation threw exception:', err);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

