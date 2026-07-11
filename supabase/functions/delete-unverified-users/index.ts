// supabase/functions/delete-unverified-users/index.ts
// Beautiful, robust Supabase Edge Function to automatically delete unverified users (48+ hours old).
// Invokes the server-side SECURITY DEFINER function delete_unconfirmed_users() for high-integrity deletion.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS Preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[Delete-Unverified-Users] Invoked at", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    // Dynamic import of Supabase JS Client for ES modules
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.12.0");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Call the postgres function delete_unconfirmed_users()
    console.log("[Delete-Unverified-Users] Triggering database purge routine...");
    const { data, error } = await supabase.rpc("delete_unconfirmed_users");

    if (error) {
      console.error("[Delete-Unverified-Users] database RPC execution failed:", error);
      
      // Fallback check: Let's do manual clean up if the function was missing or errored
      console.log("[Delete-Unverified-Users] Falling back to manual cleanup query...");
      
      // Query raw SQL or invoke users delete
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      
      // Select users who are unverified and older than 48 hours in public.users
      const { data: usersToClean, error: selectErr } = await supabase
        .from("users")
        .select("id")
        .is("email_confirmed_at", null)
        .lt("joinedAt", fortyEightHoursAgo);

      if (selectErr) {
        throw new Error(`Fallback lookup failed: ${selectErr.message}`);
      }

      let manualPurgedCount = 0;
      if (usersToClean && usersToClean.length > 0) {
        const ids = usersToClean.map((u: any) => u.id);
        console.log(`[Delete-Unverified-Users] Found ${ids.length} unverified users for manual deletion. IDs:`, ids);
        
        for (const id of ids) {
          // Delete from auth.users using Admin API (requires service role)
          const { error: deleteAuthErr } = await supabase.auth.admin.deleteUser(id);
          if (deleteAuthErr) {
            console.error(`[Delete-Unverified-Users] Failed to delete auth user ${id}:`, deleteAuthErr.message);
          } else {
            manualPurgedCount++;
          }
        }
      }

      return new Response(
        JSON.stringify({
          status: "success",
          method: "fallback_manual",
          message: `Purged ${manualPurgedCount} unverified users manually.`,
          error: error.message
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("[Delete-Unverified-Users] Purge completed successfully. RPC result:", data);

    return new Response(
      JSON.stringify({
        status: "success",
        method: "rpc",
        result: data
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err: any) {
    console.error("[Delete-Unverified-Users] Critical Exception:", err.message);
    return new Response(
      JSON.stringify({
        status: "error",
        error: err.message || "An unknown error occurred during cleanup."
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
