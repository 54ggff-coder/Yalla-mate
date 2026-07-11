
import { Profile } from '../types';

export interface MapPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  photos?: string[];
  types?: string[];
  phoneNumber?: string;
  website?: string;
  openingHours?: string[];
  isGooglePlace?: boolean;
  distance?: number;
  popularityScore?: number;
  country?: string;
  city?: string;
  description?: string;
  approxPrice?: string;
}

export interface MapSearchOptions {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number;
  city?: string;
  country?: string; // Add this
  category?: string;
}

export interface IMapProvider {
  searchPlaces(options: MapSearchOptions): Promise<MapPlace[]>;
}

// OpenStreetMap (Nominatim + Overpass) Implementation
class OSMProvider implements IMapProvider {
  async searchPlaces(options: MapSearchOptions): Promise<MapPlace[]> {
    try {
      const { query, city, country, category, location, radius } = options;
      const params = new URLSearchParams({
        query,
        city: city || '',
        country: country || '',
        category: category || '',
        lat: location?.lat?.toString() || '',
        lng: location?.lng?.toString() || '',
        radius: radius?.toString() || '5000'
      });

      const response = await fetch(`/api/places/find?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Proxy failed with status ${response.status}`);
      }
      
      const data = await response.json();
      return data.places || [];
    } catch (error: any) {
      console.error('OSM Search Error:', error);
      // Removed mock fallbacks to respect user's strict real data mandate
      return [];
    }
  }
}

// Google Places Implementation
class GoogleProvider implements IMapProvider {
  private google: any;

  constructor(google: any) {
    this.google = google;
  }

  async searchPlaces(options: MapSearchOptions): Promise<MapPlace[]> {
    return new Promise((resolve) => {
      if (!this.google || !this.google.maps || !this.google.maps.places) {
        resolve([]);
        return;
      }

      // We need a map instance or header for PlacesService
      // Usually provided by CityGuide component context
      // This is a simplified facade
      resolve([]); 
    });
  }
}

export const MapProviderFactory = {
  getProvider(type: 'osm' | 'google', googleInstance?: any): IMapProvider {
    if (type === 'google' && googleInstance) {
      return new GoogleProvider(googleInstance);
    }
    return new OSMProvider();
  }
};
