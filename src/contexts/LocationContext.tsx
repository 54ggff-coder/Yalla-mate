import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { arabCitiesList, foreignCitiesList } from '../constants';

const CITY_COORDINATES: Record<string, [number, number]> = {
  // Saudi Arabia
  'riyadh': [24.7136, 46.6753],
  'الرياض': [24.7136, 46.6753],
  'jeddah': [21.4858, 39.1925],
  'جدة': [21.4858, 39.1925],
  'mecca': [21.3891, 39.8579],
  'مكة المكرمة': [21.3891, 39.8579],
  'medina': [24.4672, 39.6112],
  'المدينة المنورة': [24.4672, 39.6112],
  'dammam': [26.4207, 50.0888],
  'الدمام': [26.4207, 50.0888],
  'khobar': [26.2172, 50.1971],
  'الخبر': [26.2172, 50.1971],
  'abha': [18.2164, 42.5053],
  'أبها': [18.2164, 42.5053],
  'tabuk': [28.3835, 36.5662],
  'تبوك': [28.3835, 36.5662],
  'taif': [21.2635, 40.4057],
  'الطائف': [21.2635, 40.4057],
  'buraidah': [26.3260, 43.9750],
  'بريدة': [26.3260, 43.9750],
  'al-ahsa': [25.3263, 49.5898],
  'الأحساء': [25.3263, 49.5898],
  'ha\'il': [27.5219, 41.6961],
  'حائل': [27.5219, 41.6961],
  'jazan': [16.8892, 42.5511],
  'جازان': [16.8892, 42.5511],
  'najran': [17.4933, 44.1272],
  'نجران': [17.4933, 44.1272],
  'al-jouf': [29.9539, 40.1970],
  'الجوف': [29.9539, 40.1970],
  'al-baha': [20.0129, 41.4677],
  'الباحة': [20.0129, 41.4677],
  'yanbu': [24.0891, 38.0637],
  'ينبع': [24.0891, 38.0637],
  'jubail': [26.9598, 49.6677],
  'الجبيل': [26.9598, 49.6677],
  'qatif': [26.5562, 50.0211],
  'القطيف': [26.5562, 50.0211],
  'arar': [30.9753, 41.0381],
  'عرعر': [30.9753, 41.0381],
  'sakaka': [29.9697, 40.2064],
  'سكاكا': [29.9697, 40.2064],
  'qurayyat': [31.3312, 37.3424],
  'القريات': [31.3312, 37.3424],
  'unaizah': [26.0850, 43.9900],
  'عنيزة': [26.0850, 43.9900],

  // Yemen
  'sana\'a': [15.3694, 44.1910],
  'صنعاء': [15.3694, 44.1910],
  'aden': [12.7855, 45.0186],
  'عدن': [12.7855, 45.0186],
  'taiz': [13.5794, 44.0207],
  'تعز': [13.5794, 44.0207],
  'al mukalla': [14.5425, 49.1242],
  'المكلا': [14.5425, 49.1242],
  'ibb': [13.9716, 44.1678],
  'إب': [13.9716, 44.1678],
  'al hodeidah': [14.7979, 42.9530],
  'الحديدة': [14.7979, 42.9530],
  'shibam': [15.9261, 48.6256],
  'شبام': [15.9261, 48.6256],
  'dhamar': [14.5422, 44.4058],
  'ذمار': [14.5422, 44.4058],
  'say\'un': [15.9428, 48.7884],
  'سيئون': [15.9428, 48.7884],
  'marib': [15.4611, 45.3253],
  'مأرب': [15.4611, 45.3253],

  // UAE
  'dubai': [25.2048, 55.2708],
  'دبي': [25.2048, 55.2708],
  'abu dhabi': [24.4539, 54.3773],
  'أبوظبي': [24.4539, 54.3773],
  'sharjah': [25.3463, 55.4209],
  'الشارقة': [25.3463, 55.4209],
  'al ain': [24.1302, 55.8023],
  'العين': [24.1302, 55.8023],

  // Egypt
  'cairo': [30.0444, 31.2357],
  'القاهرة': [30.0444, 31.2357],
  'alexandria': [31.2001, 29.9187],
  'الإسكندرية': [31.2001, 29.9187],
  'giza': [30.0131, 31.2089],
  'الجيزة': [30.0131, 31.2089],
  'sharm el sheikh': [27.9158, 34.3299],
  'شرم الشيخ': [27.9158, 34.3299],

  // Iraq
  'baghdad': [33.3152, 44.3661],
  'بغداد': [33.3152, 44.3661],
  'erbil': [36.1901, 44.0089],
  'أربيل': [36.1901, 44.0089],
  'basra': [30.5081, 47.7835],
  'البصرة': [30.5081, 47.7835],
};

const getCoordsForCity = (city: string): [number, number] | null => {
  const normalized = city.trim().toLowerCase();
  if (CITY_COORDINATES[normalized]) {
    return CITY_COORDINATES[normalized];
  }
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return coords;
    }
  }
  return null;
};

interface LocationState {
  coords: [number, number] | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  isOffline: boolean;
  address: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    road?: string;
    country?: string;
    countryCode?: string;
    district?: string;
    exactLat?: number;
    exactLng?: number;
  } | null;
  detectedCountry?: string;
  activeCountry: string;
  diagnosticWarning: string | null;
  requestLocation: (force?: boolean) => Promise<[number, number] | null>;
  verifyCountryAgainstAccount: (accountCountry: string) => boolean;

  // Unified location and city resolution properties
  activeCity: string | null;
  activeCoords: [number, number] | null;
  gpsActive: boolean;
  setProfileCity: (city: string | null) => void;
  interactedPlaces: string[];
  trackPlaceInteraction: (placeId: string) => void;
}

const LocationContext = createContext<LocationState | undefined>(undefined);

const STORAGE_KEY = 'yallamate_last_location';
const STORAGE_ADDR_KEY = 'yallamate_last_address';
const DEFAULT_LOCATION: [number, number] | null = null; // Removed mock Riyadh location

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coords, setCoords] = useState<[number, number] | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_LOCATION;
  });
  const [address, setAddress] = useState<{
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    road?: string;
    country?: string;
    countryCode?: string;
    district?: string;
    exactLat?: number;
    exactLng?: number;
  } | null>(() => {
    const saved = localStorage.getItem(STORAGE_ADDR_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [detectedCountry, setDetectedCountry] = useState<string | undefined>();
  const [activeCountry, setActiveCountry] = useState<string>('SA'); // Default to SA
  const [diagnosticWarning, setDiagnosticWarning] = useState<string | null>(null);

  const [lowPowerMode, setLowPowerMode] = useState(() => {
    return localStorage.getItem('yallamate_low_power_mode') === 'true';
  });

  useEffect(() => {
    const handleLowPowerChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled !== 'undefined') {
        setLowPowerMode(customEvent.detail.enabled);
      } else {
        setLowPowerMode(localStorage.getItem('yallamate_low_power_mode') === 'true');
      }
    };
    window.addEventListener('yallamate_low_power_mode_change', handleLowPowerChange);
    return () => {
      window.removeEventListener('yallamate_low_power_mode_change', handleLowPowerChange);
    };
  }, []);

  // New Unified State & Callbacks
  const [profileCity, setProfileCityState] = useState<string | null>(() => {
    return localStorage.getItem('yallamate_profile_city');
  });
  const [geocodedCoords, setGeocodedCoords] = useState<[number, number] | null>(null);

  const setProfileCity = useCallback((city: string | null) => {
    setProfileCityState(city);
    if (city) {
      localStorage.setItem('yallamate_profile_city', city);
    } else {
      localStorage.removeItem('yallamate_profile_city');
    }
  }, []);

  // Geocode profileCity dynamically or offline
  useEffect(() => {
    if (!profileCity) {
      setGeocodedCoords(null);
      return;
    }
    const coordsOffline = getCoordsForCity(profileCity);
    if (coordsOffline) {
      setGeocodedCoords(coordsOffline);
    } else {
      fetch(`/api/location/geocode?q=${encodeURIComponent(profileCity)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data[0]) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lng)) {
              setGeocodedCoords([lat, lng]);
            }
          }
        })
        .catch(err => console.warn('Nominatim geocoding failed for:', profileCity, err));
    }
  }, [profileCity]);

  // Sync country code from profileCity if GPS is not available
  useEffect(() => {
    if (coords || !profileCity) return;
    const normalized = profileCity.trim().toLowerCase();
    const foundArab = arabCitiesList.find(c => 
      c.nameEn.toLowerCase() === normalized || 
      c.nameAr.toLowerCase() === normalized
    );
    if (foundArab) {
      const code = foundArab.countryEn === 'Saudi Arabia' ? 'SA' : 
                   foundArab.countryEn === 'Yemen' ? 'YE' :
                   foundArab.countryEn === 'UAE' ? 'AE' :
                   foundArab.countryEn === 'Egypt' ? 'EG' :
                   foundArab.countryEn === 'Iraq' ? 'IQ' : 'SA';
      setActiveCountry(code);
      setDetectedCountry(code);
      return;
    }
    const foundForeign = foreignCitiesList.find(c =>
      c.nameEn.toLowerCase() === normalized ||
      c.nameAr.toLowerCase() === normalized
    );
    if (foundForeign) {
      const code = foundForeign.countryEn === 'United States' ? 'US' :
                   foundForeign.countryEn === 'United Kingdom' ? 'GB' :
                   foundForeign.countryEn === 'Canada' ? 'CA' : 'SA';
      setActiveCountry(code);
      setDetectedCountry(code);
    }
  }, [profileCity, coords]);

  // Capital coords fallback helper
  const getCapitalCoords = (countryCode: string): [number, number] => {
    const code = (countryCode || 'SA').toUpperCase();
    if (code === 'EG') return [30.0444, 31.2357]; // Cairo
    if (code === 'AE') return [25.2048, 55.2708]; // Dubai
    if (code === 'YE') return [15.3694, 44.1910]; // Sana'a
    if (code === 'IQ') return [33.3152, 44.3661]; // Baghdad
    return [24.7136, 46.6753]; // Riyadh (SA)
  };

  const resolvedCityFromGps = address?.city || address?.town || address?.village || address?.suburb;
  
  const isCityMatch = (c1?: string | null, c2?: string | null) => {
    if (!c1 || !c2) return false;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
    return norm(c1) === norm(c2) || norm(c1).includes(norm(c2)) || norm(c2).includes(norm(c1));
  };

  // State for previously interacted places tracking (returning users)
  const [interactedPlaces, setInteractedPlaces] = useState<string[]>(() => {
    const saved = localStorage.getItem('yallamate_interacted_places');
    return saved ? JSON.parse(saved) : [];
  });

  const trackPlaceInteraction = useCallback((placeId: string) => {
    setInteractedPlaces(prev => {
      const updated = [placeId, ...prev.filter(id => id !== placeId)].slice(0, 50);
      localStorage.setItem('yallamate_interacted_places', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Determine if returning or new user
  const isReturningUser = localStorage.getItem('yallamate_last_used_city') !== null || interactedPlaces.length > 0;

  // 1. Resolve Active City according to the rules
  const lastUsedCity = localStorage.getItem('yallamate_last_used_city');
  const activeCity = resolvedCityFromGps || (isReturningUser ? (lastUsedCity || profileCity) : profileCity) || null;

  // 2. Resolve Active Coordinates according to the rules
  const offlineCoords = activeCity ? getCoordsForCity(activeCity) : null;
  const activeCoords = coords !== null 
    ? coords 
    : (offlineCoords || (activeCountry ? getCapitalCoords(activeCountry) : [24.7136, 46.6753]));

  const gpsActive = coords !== null;

  // Save last used city when activeCity updates
  useEffect(() => {
    if (activeCity) {
      localStorage.setItem('yallamate_last_used_city', activeCity);
    }
  }, [activeCity]);

  useEffect(() => {
    fetch('/api/location/ip-lookup')
      .then(res => res.json())
      .then(data => {
        if (data.country_code) {
          setDetectedCountry(data.country_code);
          setActiveCountry(data.country_code);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const coordsRef = React.useRef<[number, number] | null>(coords);
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const freshAddress = {
          city: addr.city || addr.town || addr.village || addr.municipality || addr.state_district,
          town: addr.town,
          village: addr.village,
          suburb: addr.suburb,
          road: addr.road,
          country: addr.country,
          countryCode: addr.country_code?.toUpperCase(),
          district: addr.suburb || addr.city_district || addr.state_district || addr.county || addr.neighbourhood || '',
          exactLat: lat,
          exactLng: lng
        };
        setAddress(freshAddress);
        localStorage.setItem(STORAGE_ADDR_KEY, JSON.stringify(freshAddress));
      }
    } catch (e) {
      console.warn("Failed to reverse geocode:", e);
    }
  };

  const updateLocation = useCallback((lat: number, lng: number) => {
    const newCoords: [number, number] = [lat, lng];
    setCoords(newCoords);
    setLastUpdated(Date.now());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCoords));
    fetchAddress(lat, lng);
  }, []);

  const requestLocation = useCallback((force = false): Promise<[number, number] | null> => {
    return new Promise((resolve) => {
      // If we already have coordinates and aren't forcing, return immediately
      if (coordsRef.current && !force) {
        resolve(coordsRef.current);
        return;
      }

      if (!navigator.geolocation) {
        setError('Geolocation not supported by this browser.');
        resolve(null);
        return;
      }

      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          updateLocation(lat, lng);
          setLoading(false);
          setError(null);
          resolve([lat, lng]);
        },
        (err) => {
          let errorMessage = "Failed to get location.";
          switch(err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please enable GPS access in your browser settings.";
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable. Ensure your GPS is turned on.";
              break;
            case err.TIMEOUT:
              errorMessage = "The request to get user location timed out.";
              break;
          }
          console.warn('Geolocation failed:', errorMessage);
          setError(errorMessage);
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [updateLocation]);

  // Initial check on mount if we don't have location yet
  useEffect(() => {
    if (!coordsRef.current) {
      requestLocation();
    }
  }, [requestLocation]);

  // Continuously watch position in background
  useEffect(() => {
    if (!navigator.geolocation || lowPowerMode) {
      console.log('[LocationContext] GPS real-time tracking (watchPosition) is disabled (Low-Power Mode active or unsupported).');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const current = coordsRef.current;
        if (!current || Math.abs(current[0] - lat) > 0.0001 || Math.abs(current[1] - lng) > 0.0001) {
          updateLocation(lat, lng);
        }
      },
      (err) => {
        console.warn('Geolocation watch failed:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [updateLocation, lowPowerMode]);

  const verifyCountryAgainstAccount = useCallback((accountCountry: string) => {
    if (detectedCountry && accountCountry && detectedCountry.toLowerCase() !== accountCountry.toLowerCase()) {
      const warning = `[Location-Mismatch] Detected ${detectedCountry} but account set to ${accountCountry}`;
      console.warn(warning);
      setDiagnosticWarning(warning);
      return false;
    }
    setDiagnosticWarning(null);
    return true;
  }, [detectedCountry]);

  return (
    <LocationContext.Provider value={{
      coords,
      loading,
      error,
      lastUpdated,
      isOffline,
      address,
      detectedCountry,
      activeCountry,
      diagnosticWarning,
      requestLocation,
      verifyCountryAgainstAccount,
      activeCity,
      activeCoords,
      gpsActive,
      setProfileCity,
      interactedPlaces,
      trackPlaceInteraction
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within LocationProvider');
  return context;
};
