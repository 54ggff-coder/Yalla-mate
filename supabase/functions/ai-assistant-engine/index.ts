
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const { action, userId, userLat, userLon, ...params } = await req.json();

  if (action === 'admin_report') return await getAdminReport();
  
  // Log location
  if (userLat && userLon && userId) {
    await supabase.from("user_location_logs").insert({
        user_id: userId,
        latitude: userLat,
        longitude: userLon,
        source: "GPS"
    });
  }

  // Check usage limit
  const isLimited = await checkUsageLimit(userId);
  
  // Router
  switch (action) {
    case 'recommend_places':
      return await recommendPlaces(userLat, userLon, userId, isLimited);
    default:
      return new Response("Invalid action", { status: 400 });
  }
});

async function checkUsageLimit(userId: string) {
    if (!userId) return false;
    const { data, error } = await supabase.from("ai_usage_limits")
        .select("requests_count")
        .eq("user_id", userId)
        .eq("date", new Date().toISOString().split('T')[0])
        .single();
        
    if (error || !data) return false;
    return data.requests_count >= 5;
}

async function getAdminReport() {
    const { data: errors } = await supabase.from("system_errors").select("*").limit(10);
    const { data: suggestions } = await supabase.from("ai_admin_reports").select("*").limit(10);
    return new Response(JSON.stringify({ errors, suggestions }), { headers: { "Content-Type": "application/json" } });
}

async function recommendPlaces(lat: number, lon: number, userId: string, isLimited: boolean) {
    const { data: places } = await supabase.from("places").select("*");
    
    if (isLimited) {
        // Fallback: Simple distance-based
        const sorted = places!.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.latitude - lat, 2) + Math.pow(a.longitude - lon, 2));
            const distB = Math.sqrt(Math.pow(b.latitude - lat, 2) + Math.pow(b.longitude - lon, 2));
            return distA - distB;
        });
        return new Response(JSON.stringify(sorted.slice(0, 10)), { headers: { "Content-Type": "application/json" } });
    }

    // Weighted ranking
    // 40% Distance, 25% Interest, 15% Rating, 10% Activity, 10% recency
    const ranked = await Promise.all(places!.map(async (place) => {
        const dist = Math.sqrt(Math.pow(place.latitude - lat, 2) + Math.pow(place.longitude - lon, 2));
        const distanceScore = Math.max(0, 1 - dist) * 0.40;
        const ratingScore = ((place.rating || 0) / 5) * 0.15;
        
        // Mock interest/activity/recency scores for now
        const interestScore = 0.25; 
        const activityScore = 0.10;
        const recencyScore = 0.10;
        
        return { ...place, finalScore: distanceScore + ratingScore + interestScore + activityScore + recencyScore };
    }));

    ranked.sort((a, b) => b.finalScore - a.finalScore);
    
    return new Response(JSON.stringify(ranked.slice(0, 10)), {
        headers: { "Content-Type": "application/json" }
    });
}
