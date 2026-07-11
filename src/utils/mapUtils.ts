import { calculateDistance } from './geoUtils';

/**
 * Validates if a place is within the allowed distance and matches the user's country if provided.
 */
export function validatePlace(
  place: { lat: number; lng: number; country?: string },
  userLat: number,
  userLng: number,
  userCountry?: string,
  maxDistanceKm: number = 50
): boolean {
  // 1. Distance validation
  const dist = calculateDistance(userLat, userLng, place.lat, place.lng);
  if (dist > maxDistanceKm) return false;

  // 2. Country validation
  if (userCountry && place.country && place.country.toLowerCase() !== userCountry.toLowerCase()) return false;

  return true;
}


/**
 * Returns a Google Maps Search/View URL.
 * If placeId is provided, returns: https://www.google.com/maps/search/?api=1&query_place_id=PLACE_ID
 * Else if valid lat/lng are provided, returns: https://www.google.com/maps/search/?api=1&query=LAT,LNG
 * Otherwise, returns a query-fallback.
 */
export function getGoogleMapsViewUrl(params: {
  lat?: number;
  lng?: number;
  placeId?: string;
  name?: string;
  city?: string;
}): string {
  if (params.placeId && params.placeId.trim()) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${params.placeId.trim()}`;
  }
  
  if (
    typeof params.lat === 'number' && 
    typeof params.lng === 'number' && 
    params.lat !== 0 && 
    params.lng !== 0 &&
    !isNaN(params.lat) &&
    !isNaN(params.lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${params.lat},${params.lng}`;
  }

  // Fallback to name/city text search
  const queryParts: string[] = [];
  if (params.name) queryParts.push(params.name);
  if (params.city) queryParts.push(params.city);
  const queryStr = queryParts.join(', ');
  
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr || 'Location')}`;
}

/**
 * Returns a Google Maps Directions URL from the current user location to the destination.
 * Path: https://www.google.com/maps/dir/?api=1&destination=LATITUDE,LONGITUDE
 */
export function getGoogleMapsDirUrl(params: {
  lat?: number;
  lng?: number;
  placeId?: string;
  name?: string;
}): string {
  if (params.lat && params.lng) {
    let url = `https://www.google.com/maps/dir/?api=1&destination=${params.lat},${params.lng}`;
    if (params.placeId) url += `&destination_place_id=${params.placeId}`;
    return url;
  }
  
  if (params.name) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(params.name)}`;
  }

  return `https://www.google.com/maps/dir/?api=1`;
}

/**
 * Safely parses or extracts coordinates, making sure they are not zero, empty, or invalid.
 */
export function sanitizeCoordinates(
  lat?: number | string,
  lng?: number | string
): { lat: number; lng: number } | null {
  const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;

  if (
    typeof parsedLat === 'number' &&
    typeof parsedLng === 'number' &&
    parsedLat !== 0 &&
    parsedLng !== 0 &&
    !isNaN(parsedLat) &&
    !isNaN(parsedLng)
  ) {
    return { lat: parsedLat, lng: parsedLng };
  }

  return null;
}

/**
 * Verifies the presence of coordinates (Latitude/Longitude) in any Outing or place object.
 * Returns true if valid, false if coordinates are missing, zero, or NaN.
 */
export function validateOutingCoordinates(outing: { mapCoordinates?: { lat?: number; lng?: number } } | null | undefined): boolean {
  if (!outing || !outing.mapCoordinates) {
    return false;
  }
  const { lat, lng } = outing.mapCoordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }
  if (isNaN(lat) || isNaN(lng)) {
    return false;
  }
  if (lat === 0 && lng === 0) {
    return false;
  }
  return true;
}

