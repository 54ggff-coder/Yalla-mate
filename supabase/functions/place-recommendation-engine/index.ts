import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const { userId, userLat, userLon } = await req.json();

  // Get all places
  const { data: places } = await supabase.from("places").select("*");

  // Simple Ranking Logic
  const recommendations = places!.map(place => {
    // Distance (very rough calculation)
    const dist = Math.sqrt(Math.pow(place.latitude - userLat, 2) + Math.pow(place.longitude - userLon, 2));
    const distanceScore = Math.max(0, 1 - dist);
    const ratingScore = (place.rating || 0) / 5;
    const finalScore = (ratingScore * 0.7) + (distanceScore * 0.3);

    return {
      user_id: userId,
      place_id: place.id,
      score: finalScore
    };
  });

  // Sort and pick top 10
  recommendations.sort((a, b) => b.score - a.score);
  const topRecommendations = recommendations.slice(0, 10);

  // Save to ai_place_recommendations
  await supabase.from("ai_place_recommendations").upsert(topRecommendations);

  return new Response(JSON.stringify({ success: true, count: topRecommendations.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
