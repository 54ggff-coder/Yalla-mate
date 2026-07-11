import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const { city } = await req.json();

  // Nominatim API: Free OSM search
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(city)}&limit=10`,
    { headers: { "User-Agent": "YallaMate-App" } }
  );
  const data = await response.json();

  // Insert/Update places in DB
  for (const place of data) {
    await supabase.from("places").upsert({
      name: place.display_name,
      latitude: place.lat,
      longitude: place.lon,
      source: "osm",
      city: city,
    });
  }

  return new Response(JSON.stringify({ success: true, count: data.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
