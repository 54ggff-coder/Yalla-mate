import { detectLocalIntent } from '../utils/IntentEngine';
import { calculateDistance } from '../utils/geoUtils';

export interface OSMPlace {
  id: string;
  name: string;
  title: string;
  description: string;
  socialReasoning: string;
  category: string;
  avgCost: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  rating: number;
  googleMapsUrl: string;
  countryCode?: string;
}

export interface GeolocationData {
  city: string;
  country: string;
  countryCode: string; // e.g. "sa", "us"
}

/**
 * Uses Nominatim reverse geocoding to resolve city & country data from coordinates
 */
export async function getCityAndCountry(lat: number, lng: number): Promise<GeolocationData> {
  try {
    const url = `/api/location/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.address) {
      const city = data.address.city || data.address.town || data.address.village || data.address.state || 'Unknown';
      const country = data.address.country || 'Unknown';
      const countryCode = (data.address.country_code || '').toLowerCase();
      return { city, country, countryCode };
    }
  } catch (err) {
    console.warn('[getCityAndCountry] Failed to fetch geolocation details:', err);
  }

  // Safe fallback to Riyadh, Saudi Arabia
  return {
    city: 'Riyadh',
    country: 'Saudi Arabia',
    countryCode: 'sa'
  };
}

/**
 * Reverse geocodes a single specific coordinate to obtain its country code
 */
export async function getCoordCountryCode(lat: number, lng: number): Promise<string> {
  try {
    const url = `/api/location/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data && data.address && data.address.country_code) {
        return data.address.country_code.toLowerCase();
      }
    }
  } catch (e) {
    console.warn('[getCoordCountryCode] Failed:', e);
  }
  return '';
}

/**
 * Queries the Overpass API using a bounding box centered on user coordinates.
 * Strictly limits to a 10km radius and filters by detected user country code.
 */
export async function getOSMRecommendations(
  lat: number,
  lng: number,
  interests: string,
  mood: string,
  lang: 'en' | 'ar'
): Promise<OSMPlace[]> {
  const isAr = lang === 'ar';
  
  // 1. Determine user location information
  const userLoc = await getCityAndCountry(lat, lng);
  const intent = detectLocalIntent(interests, mood, lang);

  // Calculate latitude and longitude offsets for a bounding box of ~10km radius
  // 1 degree of latitude is ~111 km
  const dLat = 10 / 111;
  // 1 degree of longitude is ~111 * cos(lat) km
  const dLng = 10 / (111 * Math.cos(lat * Math.PI / 180));

  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;

  let rawElements: any[] = [];

  try {
    const overpassQuery = `
      [out:json][timeout:15];
      (
        node(${minLat},${minLng},${maxLat},${maxLng})[${intent.overpassTag}];
        way(${minLat},${minLng},${maxLat},${maxLng})[${intent.overpassTag}];
      );
      out center 15;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'YallaMate-Travel-Local-Companion'
      }
    });

    if (response.ok) {
      const data = await response.json();
      rawElements = data.elements || [];
    }
  } catch (err) {
    console.warn('[Overpass API] Failed to fetch:', err);
  }

  // Backup search: bounding box search using Nominatim
  if (rawElements.length === 0) {
    try {
      const nomSearchUrl = `/api/location/geocode?format=json&q=${encodeURIComponent(intent.searchQuery)}&limit=15&addressdetails=1&bounded=1&viewbox=${minLng},${maxLat},${maxLng},${minLat}`;
      const response = await fetch(nomSearchUrl);
      if (response.ok) {
        const data = await response.json();
        rawElements = data.map((item: any) => ({
          type: 'node',
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          tags: {
            name: item.display_name.split(',')[0],
            'addr:street': item.display_name,
            'addr:country_code': item.address?.country_code || ''
          }
        }));
      }
    } catch (err) {
      console.warn('[Nominatim Backup Search] Failed to fetch:', err);
    }
  }

  // Map elements into candidates
  const candidates = rawElements.map((el) => {
    const tags = el.tags || {};
    const pLat = el.lat || el.center?.lat || lat;
    const pLng = el.lon || el.center?.lon || lng;
    const dist = calculateDistance(lat, lng, pLat, pLng);

    return {
      name: tags.name || tags.operator || tags.brand || `${intent.searchQuery} Spot`,
      address: tags['addr:street'] ? `${tags['addr:street']} ${tags['addr:housenumber'] || ''}` : `${intent.searchQuery} Spot`,
      latitude: pLat,
      longitude: pLng,
      distanceKm: dist,
      countryFromTag: (tags['addr:country'] || tags['addr:country_code'] || '').toLowerCase().trim()
    };
  });

  // Filter 1: Strictly <= 10.0 km
  const withinRange = candidates.filter(c => c.distanceKm <= 10.0);

  // Filter 2: Strictly validate that candidate places belong to the User's country code.
  // To avoid redundant/slow requests, we only reverse geocode/verify the top 5 candidates.
  const validatedPlaces: OSMPlace[] = [];
  const topCandidates = withinRange.slice(0, 5);

  for (let i = 0; i < topCandidates.length; i++) {
    const c = topCandidates[i];
    let countryCode = c.countryFromTag;

    // If there is no country code tag, we proactively reverse geocode to verify the country code.
    if (!countryCode) {
      countryCode = await getCoordCountryCode(c.latitude, c.longitude);
    }

    // Abort if country code is present and mismatch detected
    if (userLoc.countryCode && countryCode && countryCode !== userLoc.countryCode) {
      console.log(`[OSM Validation] Excluded proposed place '${c.name}' because its country code '${countryCode}' does not match user country code '${userLoc.countryCode}'`);
      continue;
    }

    const details = generatePlaceDetails(c.name, userLoc.city, intent.category, lang);
    const rating = parseFloat((4.3 + (i % 7) * 0.1).toFixed(1));

    validatedPlaces.push({
      id: `osm_p_${i}_${Math.floor(c.latitude * 100000)}`,
      name: c.name,
      title: `${intent.emoji} ${intent.defaultPrefix} ${c.name}`,
      description: details.description,
      socialReasoning: details.socialReasoning,
      category: intent.category,
      avgCost: details.avgCost,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      distanceKm: parseFloat(c.distanceKm.toFixed(2)),
      rating,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name)}`
    });
  }

  // Sort and return ranked results based on matching weight
  return validatedPlaces.sort((a, b) => {
    const scoreA = (a.rating || 0) * 2 - (a.distanceKm || 0) * 0.5;
    const scoreB = (b.rating || 0) * 2 - (b.distanceKm || 0) * 0.5;
    return scoreB - scoreA;
  });
}

function generatePlaceDetails(placeName: string, city: string, category: string, lang: 'en' | 'ar') {
  const isAr = lang === 'ar';
  let description = '';
  let socialReasoning = '';
  let avgCost = isAr ? '٢٥-٤٥ ريال' : '25-45 SAR';

  if (category === 'cafe') {
    description = isAr
      ? `استمتع بجلسة هادئة ورائعة في ${placeName}؛ المكان المثالي لارتشاف قهوتك والتواصل مع الآخرين.`
      : `Enjoy a peaceful and great session at ${placeName}; the perfect place to sip your coffee and connect with others.`;
    socialReasoning = isAr
      ? `تم اختياره خصيصاً لأنه يتناسب مع حبك للجلسات الهادئة والأوقات اللطيفة في ${city || 'مدينتك'}.`
      : `Specially selected to match your love for cozy coffee sessions and pleasant times in ${city || 'your city'}.`;
    avgCost = isAr ? '١٥-٣٥ ريال' : '15-35 SAR';
  } else if (category === 'gaming') {
    description = isAr
      ? `عش تجربة ترفيهية مليئة بالبهجة والتسلية الحماسية في ${placeName} مع الأصدقاء.`
      : `Live a fun-filled entertainment experience with exciting companion play at ${placeName}.`;
    socialReasoning = isAr
      ? `وجهة ممتازة تلبي شغفك بالألعاب والرياضة التنافسية وسط أجواء تفاعلية حية في ${city || 'مدينتك'}.`
      : `An excellent venue matching your taste for competitive gaming and sports in ${city || 'your city'}.`;
    avgCost = isAr ? '٣٠-٥٠ ريال' : '30-50 SAR';
  } else if (category === 'park') {
    description = isAr
      ? `تمشى واستنشق الهواء النقي في ${placeName}، حيث الطبيعة المفتوحة والمسارات الجميلة.`
      : `Walk and breathe fresh air at ${placeName}, featuring open nature and gorgeous pathways.`;
    socialReasoning = isAr
      ? `مناسب جداً للترويح عن النفس وممارسة رياضة خفيفة في بيئة طبيعية هادئة في ${city || 'مدينتك'}.`
      : `Very suitable for physical recreation and enjoying crisp breeze in a peaceful environment in ${city || 'your city'}.`;
    avgCost = isAr ? 'مجانًا' : 'Free Entry';
  } else if (category === 'mall') {
    description = isAr
      ? `تسوق واستفسر عن أحدث الصيحات والخيارات المتنوعة في ${placeName} الحافلة بالأنشطة.`
      : `Shop and explore the latest trends and diverse choices at the lively ${placeName}.`;
    socialReasoning = isAr
      ? `يتوافق مع تفضيلك للأماكن الحيوية والأنشطة المتعددة والمريحة تحت سقف واحد في ${city || 'مدينتك'}.`
      : `Matches your preference for vibrant settings and diverse lifestyle spots under one roof in ${city || 'your city'}.`;
    avgCost = isAr ? 'حسب المشتريات' : 'Variable';
  } else if (category === 'cinema') {
    description = isAr
      ? `شاهد أحدث الأفلام والإنتاجات العالمية مع عائلتك أو أصدقائك في صالة ${placeName}.`
      : `Watch the latest movies and cinematic creations at ${placeName} comfort screens.`;
    socialReasoning = isAr
      ? `موصى به لتجربة بصرية فريدة لقضاء وقت ترفيهي مسائي ممتع في ${city || 'مدينتك'}.`
      : `Recommended for a premium viewing experience to spend an amazing evening in ${city || 'your city'}.`;
    avgCost = isAr ? '٤٥-٧٠ ريال' : '45-70 SAR';
  } else if (category === 'gym') {
    description = isAr
      ? `عزز نشاطك وصحتك البدنية مع أفضل التجهيزات والتمارين الرياضية في ${placeName}.`
      : `Boost your activity and health with top equipment and energy workouts at ${placeName}.`;
    socialReasoning = isAr
      ? `يدعم روتينك الصحي ولياقتك في بيئة تشجع على الاستمرارية والطاقة في ${city || 'مدينتك'}.`
      : `Supports your wellness routine in an inspiring, energetic community environment in ${city || 'your city'}.`;
    avgCost = isAr ? 'يومي ٥٠ ريال' : '50 SAR Day Pass';
  } else {
    description = isAr
      ? `تذوق أشهى المأكولات والأطباق المتميزة وسط أجواء دافئة ومرحبة في مطعم ${placeName}.`
      : `Savor delicious cuisines and premium dishes in a warm, welcoming atmosphere at ${placeName}.`;
    socialReasoning = isAr
      ? `تم اختياره ليناسب طلبك للتلذذ بوجبة طعام ممتازة ومثالية للمشاركة الاجتماعية في ${city || 'مدينتك'}.`
      : `Chosen to suit your desire for fine dining and excellent social gastronomy in ${city || 'your city'}.`;
    avgCost = isAr ? '٤٠-٨٥ ريال' : '40-85 SAR';
  }

  return { description, socialReasoning, avgCost };
}
