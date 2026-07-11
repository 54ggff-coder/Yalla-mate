/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ActivityCategory, Profile, DetailedPlace } from '../types';
import { arabCitiesList, foreignCitiesList } from '../constants';
import { translations, Language } from '../data/translations';
import { validatePlace } from '../utils/mapUtils';
import { Compass, Sparkles, MapPin, Star, Share2, Plus, CornerDownRight, 
  MessageSquare, ArrowLeft, ArrowUpRight, Search, Sliders, Heart, 
  Clock, Check, RefreshCw, Eye, Landmark, User, Users, Home, 
  Tag, Shield, Trash2, Send, CloudSun, AlertCircle, HeartCrack, ChevronRight,
  ExternalLink, Car
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from '../contexts/LocationContext';
import { getPlaceholderImage } from '../utils/imageUtils';
import { MapProviderFactory } from '../services/mapProvider';
import LocationIndicator from './LocationIndicator';
import { getGoogleMapsViewUrl, getGoogleMapsDirUrl, sanitizeCoordinates } from '../utils/mapUtils';

// Extensive Database of Places with classifications requested by the user
const initialPlaces: DetailedPlace[] = [];

interface PlaceSuggesterProps {
  currentUser: Profile;
  lang: Language;
  onSelectPrefillForOuting: (prefill: {
    title: string;
    description: string;
    category: ActivityCategory;
    location: string;
    googleMapsUrl: string;
  }) => void;
}

export default function PlaceSuggester({
  currentUser,
  lang,
  onSelectPrefillForOuting,
}: PlaceSuggesterProps) {
  const isAr = lang === 'ar';
  const { coords: rawUserLocation, activeCoords, activeCity, address: ymAddress, requestLocation: requestLocationFromContext } = useLocation();
  const userLocation = activeCoords ? { lat: activeCoords[0], lng: activeCoords[1] } : null;

  // Country native flags mapper
  const countFlags: Record<string, string> = {
    'Saudi Arabia': '🇸🇦',
    'UAE': '🇦🇪',
    'Egypt': '🇪🇬',
    'Jordan': '🇯🇴',
    'Kuwait': '🇰🇼',
    'Qatar': '🇶🇦',
    'Oman': '🇴🇲',
    'Bahrain': '🇧🇭',
    'Morocco': '🇲🇦',
    'Algeria': '🇩🇿',
    'Lebanon': '🇱🇧',
    'Tunisia': '🇹🇳',
    'Palestine': '🇵🇸',
    'Sudan': '🇸🇩',
    'Yemen': '🇾🇪',
    'Iraq': '🇮🇶',
    'United Kingdom': '🇬🇧',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Spain': '🇪🇸',
    'Germany': '🇩🇪',
    'Netherlands': '🇳🇱',
    'Austria': '🇦🇹',
    'Switzerland': '🇨🇭',
    'United States': '🇺🇸',
    'Canada': '🇨🇦',
    'Mexico': '🇲🇽',
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
    'Colombia': '🇨🇴',
    'Chile': '🇨🇱',
    'Peru': '🇵🇪'
  };

  // Dynamic set of cities depending on lang preference
  const rawCitiesList = isAr
    ? [...arabCitiesList]
    : [...arabCitiesList, ...foreignCitiesList];

  // De-duplicate cities by En Name
  const uniqueCitiesMap = new Map<string, typeof rawCitiesList[0]>();
  rawCitiesList.forEach(c => {
    uniqueCitiesMap.set(c.nameEn.toLowerCase(), c);
  });

  const uniqueCities = [
    {
      nameEn: 'CurrentCity',
      nameAr: 'مدينتك الحالية 📍',
      countryEn: 'None',
      countryAr: isAr ? 'الموقع الفعلي' : 'Actual Location'
    },
    ...Array.from(uniqueCitiesMap.values()).sort((a, b) => 
      isAr ? a.nameAr.localeCompare(b.nameAr, 'ar') : a.nameEn.localeCompare(b.nameEn, 'en')
    )
  ];
  
  // Persistent DB (Pre-seeded + Custom places added via Admin dashboard)
  const [places, setPlaces] = useState<DetailedPlace[]>([]);

  // States
  const [selectedCity, setSelectedCity] = useState<string>('CurrentCity');

  const getResolvedCity = (): string => {
    if (selectedCity === 'CurrentCity') {
      if (activeCity) return activeCity;
      return isAr ? 'موقعك الحالي' : 'Current Location';
    }
    return selectedCity;
  };

  const resolvedCity = getResolvedCity();
  
  const isCityMatch = (placeCity: string, targetCity: string) => {
    if (!placeCity || !targetCity) return false;
    const p = placeCity.toLowerCase();
    const t = targetCity.toLowerCase();
    return p.includes(t) || t.includes(p);
  };
  
  // Dedicated state hooks for the empty state AI Advisor
  const [emptyAiStep, setEmptyAiStep] = useState<1 | 2 | 3 | 4>(1);
  const [emptyAiWithWho, setEmptyAiWithWho] = useState<'solo' | 'friends' | 'family' | ''>('');
  const [emptyAiBudget, setEmptyAiBudget] = useState<'low' | 'medium' | 'high' | ''>('');
  const [emptyAiCat, setEmptyAiCat] = useState<string>('');
  const [emptyAiResultSpots, setEmptyAiResultSpots] = useState<DetailedPlace[]>([]);
  const [emptyAiThinking, setEmptyAiThinking] = useState(false);

  const resetEmptyAiAdvisor = () => {
    setEmptyAiStep(1);
    setEmptyAiWithWho('');
    setEmptyAiBudget('');
    setEmptyAiCat('');
    setEmptyAiResultSpots([]);
  };

  const fetchAiPlaces = async (catKey: 'coffee' | 'food' | 'park' | 'game', isFromEmptyAdvisor: boolean) => {
    const isSpecificCity = resolvedCity !== 'CurrentCity' && resolvedCity !== 'Current Location' && resolvedCity !== 'موقعك الحالي';
    
    if (!userLocation && !isSpecificCity) {
      alert(isAr ? "يرجى السماح بالوصول لموقعك الجغرافي (GPS) أولاً للبحث عن أماكن" : "Please enable GPS location first to search for places");
      requestLocationFromContext(true);
      return;
    }

    if (isFromEmptyAdvisor) {
      setEmptyAiCat(catKey);
      setEmptyAiThinking(true);
      setEmptyAiStep(4);
    } else {
      setAiCat(catKey);
      setAiThinking(true);
      setAiStep(4);
    }

    try {
      const searchCat = catKey === 'coffee' ? 'cafe' : catKey === 'food' ? 'restaurant' : catKey === 'park' ? 'park' : 'attraction';
      
      const mapProvider = MapProviderFactory.getProvider('osm'); // Always fallback to actual map SDK
      const results = await mapProvider.searchPlaces({
        query: searchCat,
        location: isSpecificCity ? undefined : userLocation,
        city: isSpecificCity ? resolvedCity : undefined,
        category: searchCat,
        radius: 10000
      });

      const validResults = (userLocation && !isSpecificCity) 
        ? results.filter(p => validatePlace(p, userLocation.lat, userLocation.lng, ymAddress?.country))
        : results;

      if (validResults.length > 0) {
        // Map the results to DetailedPlace
        const mapped: DetailedPlace[] = validResults.slice(0, 5).map((s, idx) => {
          let categoryLabel: any = 'Cafes';
          if (catKey === 'food') categoryLabel = 'Restaurants';
          if (catKey === 'park') categoryLabel = 'Parks';
          if (catKey === 'game') categoryLabel = 'Entertainment';

          const classEn = 'Group Gathering'; // simplified
          const classAr = 'مناسب للمجموعات'; // simplified

          const coffeeImgs = [
            'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=850&q=80',
            'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=850&q=80'
          ];
          const foodImgs = [
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=850&q=80',
            'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=850&q=80'
          ];
          const parkImgs = [
            'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=850&q=80',
            'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=850&q=80'
          ];
          const gameImgs = [
            'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=850&q=80',
            'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=850&q=80'
          ];
          const selectImgs = catKey === 'coffee' ? coffeeImgs : catKey === 'food' ? foodImgs : catKey === 'park' ? parkImgs : gameImgs;

          return {
            id: s.id || `live_sdk_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
            nameEn: s.name,
            nameAr: s.name,
            city: resolvedCity,
            category: categoryLabel,
            classificationEn: classEn,
            classificationAr: classAr as any,
            budget: 'medium',
            rating: typeof s.rating === 'number' ? s.rating : 4.5,
            workingHoursEn: (s as any).workingHours || '9:00 AM - Midnight',
            workingHoursAr: '٩:٠٠ صباحاً - منتصف الليل',
            descriptionEn: (s as any).description || 'Verified local spot via Maps Platform.',
            descriptionAr: (s as any).description || 'تم التحقق من الموقع عبر مزود الخرائط.',
            lat: s.lat,
            lng: s.lng,
            images: s.photos || selectImgs,
            servicesEn: ['Accessible', 'Outdoor Seats', 'Atmospheric Interior'],
            servicesAr: ['مكان مناسب', 'جلسات خارجية', 'تنظيم وخدمة ممتازة'],
            googleMapsUrl: (s as any).googleMapsUrl,
            reviews: [
              {
                author: isAr ? 'دليل الأماكن المعتمد' : 'YallaMate Spot Guide',
                rating: 5,
                commentAr: isAr ? 'هذا المكان تم اختياره وجلب بياناته من الخرائط الواقعية.' : 'Grounded verified venue selected via live map search.',
                commentEn: 'Grounded verified venue selected via live map search.',
                avatar: '🗺️'
              }
            ]
          };
        });

        setPlaces(prev => {
          const filteredPrev = prev.filter(p => !p.id.startsWith('synth_gemini_'));
          const combined = [...mapped, ...filteredPrev];
          // De-duplicate by ID
          const uniqueMap = new Map();
          combined.forEach(p => {
            if (!uniqueMap.has(p.id)) {
              uniqueMap.set(p.id, p);
            }
          });
          return Array.from(uniqueMap.values());
        });

        if (isFromEmptyAdvisor) {
          setEmptyAiResultSpots(mapped);
          setEmptyAiThinking(false);
        } else {
          setAiResultSpots(mapped);
          setAiThinking(false);
        }
        return;
      }
    } catch (e) {
      console.warn('MapProvider search error:', e);
    }
    
    // If maps fail, just stop gracefully
    if (isFromEmptyAdvisor) {
      setEmptyAiThinking(false);
    } else {
      setAiThinking(false);
    }
  };

  const evaluateEmptyAiSelection = () => {
    fetchAiPlaces((emptyAiCat as any) || 'coffee', true);
  };
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Restaurants' | 'Cafes' | 'Parks' | 'Sights' | 'Malls' | 'Entertainment'>('All');
  const [classificationFilter, setClassificationFilter] = useState<'All' | 'Solo Friendly' | 'Group Gathering' | 'Family Optimized'>('All');
  const [budgetFilter, setBudgetFilter] = useState<'All' | 'low' | 'medium' | 'high'>('All');
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [maxDistanceFilter, setMaxDistanceFilter] = useState<number>(15); // mock distance threshold (km)
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Tab control inside component
  const [activeTab, setActiveTab] = useState<'explore' | 'favorites' | 'saved_later' | 'ai_advisor' | 'admin'>('explore');
  
  // Modal State for Full details
  const [selectedPlace, setSelectedPlace] = useState<DetailedPlace | null>(null);

  const handleNavigate = (place: { lat: number; lng: number }) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    window.open(url, '_blank');
  };
  
  // Comments input inside modal
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewScore, setNewReviewScore] = useState(5);
  
  // Favorites list saved in local storage
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('ym_favs');
    return saved ? JSON.parse(saved) : ['place_1', 'place_4'];
  });

  // "Want to visit later" saved list in local storage
  const [savedLater, setSavedLater] = useState<string[]>(() => {
    const saved = localStorage.getItem('ym_later');
    return saved ? JSON.parse(saved) : ['place_2'];
  });

  useEffect(() => {
    localStorage.setItem('ym_favs', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('ym_later', JSON.stringify(savedLater));
  }, [savedLater]);

  useEffect(() => {
    requestLocationFromContext();
  }, [requestLocationFromContext]);

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'detected' | 'failed'>(
    rawUserLocation ? 'detected' : 'idle'
  );

  const triggerGpsLookup = async () => {
    setGpsStatus('detecting');
    try {
      const coordsResult = await requestLocationFromContext();
      if (coordsResult) {
        setGpsStatus('detected');
      } else {
        setGpsStatus('failed');
      }
    } catch (err) {
      setGpsStatus('failed');
    }
  };

  useEffect(() => {
    if (rawUserLocation) {
      setGpsStatus('detected');
    }
  }, [rawUserLocation]);

  // Automatically seed some initial places based on location or selected city
  useEffect(() => {
    // Proceed if we have a user location OR a specific city selected OR activeCity is resolved from profile
    if (userLocation || selectedCity !== 'CurrentCity' || (selectedCity === 'CurrentCity' && activeCity)) {
      const cityPlaces = places.filter(p => isCityMatch(p.city, resolvedCity));
      if (cityPlaces.length === 0) {
        const seedInitialPlaces = async () => {
          try {
            const mapProvider = MapProviderFactory.getProvider('osm');
            const queries = ['cafe', 'restaurant', 'park'];
            let allMapped: DetailedPlace[] = [];
            const isExplicitOverride = selectedCity !== 'CurrentCity' || (selectedCity === 'CurrentCity' && !userLocation && activeCity);
            const cityToUse = isExplicitOverride ? resolvedCity : resolvedCity;
            const locationToUse = (selectedCity === 'CurrentCity' && userLocation) ? userLocation : undefined;
            
            for (const cat of queries) {
              const results = await mapProvider.searchPlaces({
                query: cat,
                location: locationToUse,
                city: cityToUse,
                category: cat,
                radius: 15000 // A bit larger radius to hit the specific city
              });
              
              const mapped: DetailedPlace[] = results.slice(0, 4).map((s, idx) => {
                const categoryLabel = cat === 'cafe' ? 'Cafes' : cat === 'restaurant' ? 'Restaurants' : 'Parks';
                const classEn = 'Group Gathering'; 
                const classAr = 'مناسب للمجموعات';
                
                const coffeeImgs = ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=850&q=80'];
                const foodImgs = ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=850&q=80'];
                const parkImgs = ['https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=850&q=80'];
                
                const selectImgs = cat === 'cafe' ? coffeeImgs : cat === 'restaurant' ? foodImgs : parkImgs;

                return {
                  id: s.id || `live_sdk_${cat}_${Date.now()}_${idx}`,
                  nameEn: s.name,
                  nameAr: s.name,
                  city: resolvedCity,
                  category: categoryLabel,
                  classificationEn: classEn,
                  classificationAr: classAr as any,
                  budget: 'medium',
                  rating: typeof s.rating === 'number' ? s.rating : 4.5,
                  workingHoursEn: (s as any).workingHours || '9:00 AM - Midnight',
                  workingHoursAr: '٩:٠٠ صباحاً - منتصف الليل',
                  descriptionEn: (s as any).description || 'Verified local spot via Maps Platform.',
                  descriptionAr: (s as any).description || 'تم التحقق من الموقع عبر مزود الخرائط.',
                  lat: s.lat,
                  lng: s.lng,
                  images: s.photos || selectImgs,
                  servicesEn: ['Accessible', 'Outdoor Seats', 'Atmospheric Interior'],
                  servicesAr: ['مكان مناسب', 'جلسات خارجية', 'تنظيم وخدمة ممتازة'],
                  googleMapsUrl: (s as any).googleMapsUrl,
                  reviews: []
                };
              });
              allMapped = [...allMapped, ...mapped];
            }
            
            if (allMapped.length > 0) {
              setPlaces(prev => {
                const combined = [...allMapped, ...prev];
                const uniqueMap = new Map();
                combined.forEach(p => {
                  if (!uniqueMap.has(p.id)) {
                    uniqueMap.set(p.id, p);
                  }
                });
                return Array.from(uniqueMap.values());
              });
            }
          } catch (e) {
            console.warn('[PlaceSuggester] Failed to seed initial places', e);
          }
        };
        
        seedInitialPlaces();
      }
    }
  }, [userLocation, resolvedCity, places, selectedCity, activeCity]);

  // Compute mock dynamic distance (using mock or authentic geolocation relative delta)
  const computePlaceDistance = (place: DetailedPlace): number | null => {
    if (!userLocation) return null;
    const dLat = (place.lat - userLocation.lat) * 111;
    const dLng = (place.lng - userLocation.lng) * 96;
    const distanceKm = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distanceKm > 1000) return null;
    return parseFloat(Math.max(0.1, distanceKm).toFixed(1));
  };

  // Filter and sort algorithmic pipeline
  const filteredPlaces = (places || [])
    .filter(p => {
      // City filter
      if (!isCityMatch(p.city, resolvedCity)) return false;
      // Category filter
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      // Classification filter
      if (classificationFilter !== 'All' && p.classificationEn !== classificationFilter) return false;
      // Budget filter
      if (budgetFilter !== 'All' && p.budget !== budgetFilter) return false;
      // Rating filter
      if (p.rating < ratingFilter) return false;
      // Search text query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const txt = (p.nameEn + ' ' + p.nameAr + ' ' + p.descriptionEn + ' ' + p.descriptionAr).toLowerCase();
        if (!txt.includes(q)) return false;
      }
      // Distance filter
      const dist = computePlaceDistance(p);
      if (dist !== null && dist > maxDistanceFilter) return false;

      return true;
    })
    .map(p => {
      const dist = computePlaceDistance(p);
      // Algorithmic Match Score for personal recommendations
      let matchScore = p.rating * 10; // Base on rating

      // Distance factor (shorter distance gets boost, maximum 15 points boost for being close)
      if (dist !== null) {
        matchScore += Math.max(-20, 15 - (dist * 1.2));
      }

      // Personality / Archetype Match (+15 points bonus)
      const userArch = currentUser?.archetype || '';
      let isArchMatch = false;
      if (userArch === 'The Culinary Nomad' && (p.category === 'Cafes' || p.category === 'Restaurants')) {
        isArchMatch = true;
      } else if (userArch === 'The Scenic Wanderer' && (p.category === 'Parks' || p.category === 'Sights' || p.classificationEn === 'Family Optimized')) {
        isArchMatch = true;
      } else if (userArch === 'The Social Catalyst' && (p.classificationEn === 'Group Gathering' || p.category === 'Entertainment')) {
        isArchMatch = true;
      } else if (userArch === 'The Ultimate Organizer' && p.rating >= 4.8) {
        isArchMatch = true;
      } else if (userArch === 'The Late-Night Legend' && (p.workingHoursEn?.toLowerCase().includes('midnight') || p.workingHoursEn?.toLowerCase().includes('pm') || p.workingHoursEn?.toLowerCase().includes('24'))) {
        isArchMatch = true;
      }

      if (isArchMatch) {
        matchScore += 15;
      }

      return {
        ...p,
        matchScore,
        isArchMatch,
        distance: dist
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  // Random Pick roulette solver
  const [randomSelectLoading, setRandomSelectLoading] = useState(false);
  const [randomResult, setRandomResult] = useState<DetailedPlace | null>(null);

  const triggerRandomPick = () => {
    setRandomSelectLoading(true);
    setRandomResult(null);
    setTimeout(() => {
      const available = (places || []).filter(p => isCityMatch(p.city, resolvedCity));
      if (available.length > 0) {
        const picked = available[Math.floor(Math.random() * available.length)];
        setRandomResult(picked);
      }
      setRandomSelectLoading(false);
    }, 1200);
  };

  // AI Assistant Interactive helper inside component (Questions onboarding)
  const [aiStep, setAiStep] = useState<1 | 2 | 3 | 4>(1);
  const [aiWithWho, setAiWithWho] = useState<'solo' | 'friends' | 'family' | ''>('');
  const [aiBudget, setAiBudget] = useState<'low' | 'medium' | 'high' | ''>('');
  const [aiCat, setAiCat] = useState<string>('');
  const [aiResultSpots, setAiResultSpots] = useState<DetailedPlace[]>([]);
  const [aiThinking, setAiThinking] = useState(false);

  const resetAiAdvisor = () => {
    setAiStep(1);
    setAiWithWho('');
    setAiBudget('');
    setAiCat('');
    setAiResultSpots([]);
  };

  const evaluateAiAdvisorSelection = () => {
    setAiThinking(true);
    setTimeout(() => {
      // Search matching logic
      const filtered = (places || []).filter(p => {
        if (!isCityMatch(p.city, resolvedCity)) return false;
        
        // Mode mapping
        if (aiWithWho === 'solo' && p.classificationEn !== 'Solo Friendly') return false;
        if (aiWithWho === 'friends' && p.classificationEn !== 'Group Gathering') return false;
        if (aiWithWho === 'family' && p.classificationEn !== 'Family Optimized') return false;

        // Budget matching
        if (aiBudget !== '' && p.budget !== aiBudget) return false;

        // Category preference
        if (aiCat !== '' && !p.category.toLowerCase().includes(aiCat.toLowerCase()) && !p.nameEn.toLowerCase().includes(aiCat.toLowerCase()) && !p.nameAr.toLowerCase().includes(aiCat.toLowerCase())) return false;

        return true;
      });

      // If nothing found, grab 2 closest fallback slots for that city
      if (filtered.length === 0) {
        setAiResultSpots((places || []).filter(p => isCityMatch(p.city, resolvedCity)).slice(0, 2));
      } else {
        setAiResultSpots(filtered.slice(0, 3));
      }
      setAiStep(4);
      setAiThinking(false);
    }, 1000);
  };

  // Toggle Favorite
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(item => item !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  // Toggle Saved Visit Later
  const toggleSavedLater = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (savedLater.includes(id)) {
      setSavedLater(savedLater.filter(item => item !== id));
    } else {
      setSavedLater([...savedLater, id]);
    }
  };

  // Custom Admin Inputs
  const [adminNameEn, setAdminNameEn] = useState('');
  const [adminNameAr, setAdminNameAr] = useState('');
  const [adminCategory, setAdminCategory] = useState<'Restaurants' | 'Cafes' | 'Parks' | 'Sights' | 'Malls' | 'Entertainment'>('Cafes');
  const [adminClass, setAdminClass] = useState<'Solo Friendly' | 'Group Gathering' | 'Family Optimized'>('Solo Friendly');
  const [adminBudget, setAdminBudget] = useState<'low' | 'medium' | 'high'>('medium');
  const [adminDescEn, setAdminDescEn] = useState('');
  const [adminDescAr, setAdminDescAr] = useState('');
  const [adminWorkingAr, setAdminWorkingAr] = useState('٩:٠٠ ص - ١٢:٠٠ م');
  const [adminWorkingEn, setAdminWorkingEn] = useState('9:00 AM - 12:00 PM');
  const [adminImageUrl, setAdminImageUrl] = useState('');
  const [adminAlertSuccess, setAdminAlertSuccess] = useState(false);

  const handleAdminAddPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNameEn || !adminNameAr || !adminDescEn || !adminDescAr) return;

    let classifierAr = 'مناسب للأفراد';
    if (adminClass === 'Group Gathering') classifierAr = 'مناسب للمجموعات';
    if (adminClass === 'Family Optimized') classifierAr = 'مناسب للعائلات';

    const fallbackImg = adminCategory === 'Cafes' 
      ? 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=850&q=80'
      : adminCategory === 'Restaurants'
      ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=850&q=80'
      : 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=850&q=80';

    const newPlace: DetailedPlace = {
      id: `custom_place_${Date.now()}`,
      nameEn: adminNameEn,
      nameAr: adminNameAr,
      city: selectedCity,
      category: adminCategory,
      classificationEn: adminClass,
      classificationAr: classifierAr as any,
      budget: adminBudget,
      rating: 5.0,
      workingHoursEn: adminWorkingEn,
      workingHoursAr: adminWorkingAr,
      descriptionEn: adminDescEn,
      descriptionAr: adminDescAr,
      lat: userLocation?.lat || 0,
      lng: userLocation?.lng || 0,
      images: [adminImageUrl || fallbackImg],
      servicesEn: ['AC', 'Free Wi-Fi', 'Parking'],
      servicesAr: ['تكييف هوائي', 'إنترنت مجاني', 'موافق للجميع'],
      reviews: []
    };

    setPlaces([newPlace, ...places]);
    setAdminAlertSuccess(true);
    // Reset form
    setAdminNameEn('');
    setAdminNameAr('');
    setAdminDescEn('');
    setAdminDescAr('');
    setAdminImageUrl('');
    setTimeout(() => setAdminAlertSuccess(false), 3000);
  };

  const handleAdminDeletePlace = (id: string) => {
    if (confirm(isAr ? 'هل أنت متأكد من حذف هذا المكان من لوحة التحكم؟' : 'Are you sure you want to remove this place entry?')) {
      setPlaces((places || []).filter(p => p.id !== id));
    }
  };

  // Review comment submission logic
  const handleAddReview = async () => {
    if (!newReviewText.trim() || !selectedPlace) return;
    const authorName = currentUser.name || (isAr ? 'زائر يالاميت' : 'YallaMate Guest');
    
    const newComment = {
      author: authorName,
      rating: newReviewScore,
      commentAr: isAr ? newReviewText : '',
      commentEn: isAr ? '' : newReviewText,
      avatar: currentUser.avatar || '⛺',
      timestamp: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('place_reviews')
        .insert({
          placeId: selectedPlace.id,
          reviewerId: currentUser.id,
          ...newComment
        });
      if (error) throw error;
    } catch (e) {
      console.error('Failed to post place review', e);
    }

    const updatedPls = places.map(p => {
      if (p.id === selectedPlace.id) {
        const totalRatingPoints = p.reviews.reduce((acc, r) => acc + r.rating, 0) + newReviewScore;
        const newAverageRating = parseFloat((totalRatingPoints / ((p.reviews?.length || 0) + 1)).toFixed(1));
        return {
          ...p,
          rating: newAverageRating,
          reviews: [newComment, ...p.reviews]
        };
      }
      return p;
    });

    setPlaces(updatedPls);
    setSelectedPlace({
      ...selectedPlace,
      rating: parseFloat((((selectedPlace.reviews || []).reduce((acc, r) => acc + r.rating, 0) + newReviewScore) / ((selectedPlace.reviews?.length || 0) + 1)).toFixed(1)),
      reviews: [newComment, ...selectedPlace.reviews]
    });
    setNewReviewText('');
  };

  // Helper labels translation map
  const catNames = {
    Restaurants: isAr ? 'مطاعم 🍽️' : 'Restaurants 🍽️',
    Cafes: isAr ? 'مقاهي ومشروبات ☕' : 'Cafes & Drinks ☕',
    Parks: isAr ? 'حدائق وطبيعة 🌳' : 'Parks & Greeneries 🌳',
    Sights: isAr ? 'معالم سياحية 🏰' : 'Tourist Sights 🏰',
    Malls: isAr ? 'مجمعات و تسوق 🛍️' : 'Malls & Retail 🛍️',
    Entertainment: isAr ? 'ترفيه وألعاب 🎮' : 'Entertainment & Gaming 🎮'
  };

  return (
    <div className="bg-[#0B0E14] text-white rounded-3xl border border-white/5 p-6 md:p-8 shadow-2xl space-y-8" id="places-master-container">
      
      {/* Location sync action */}
      <LocationIndicator lang={lang} className="!bg-white/5 !text-white !border-white/10" />

      {/* Cinematic Header with Tabs Navigation */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="w-8 h-8 text-emerald-400 animate-spin-slow" />
            <h1 className="text-2xl md:text-3xl font-display font-black text-white">
              {isAr ? 'المقترح ومرشد الأماكن الأقوى' : 'Intelligent Spot Engine'}
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            {isAr 
              ? 'تصفح وقارن واكتشف أكثر من ١٠٠ معبر ومكان في مدينتك. دشن طلعة مباشرة تشارك وقودها مع الرفاق.'
              : 'Browse, evaluate & bookmark spectacular places details. Propose quick shared-fuel outings in seconds.'}
          </p>
        </div>

        {/* Cities selector widget */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-2 rounded-2xl">
            <MapPin className="col-emerald-400 w-4 h-4 text-emerald-400" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-bold max-w-[170px]"
              id="global-suggester-city"
            >
              {uniqueCities.map(c => {
                const flag = c.countryEn === 'None' ? '' : (countFlags[c.countryEn] || '📍');
                return (
                  <option key={c.nameEn} value={c.nameEn} className="bg-[#0B0E14]">
                    {isAr ? `${c.nameAr} ${flag}`.trim() : `${c.nameEn} ${flag}`.trim()}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Master Tabs */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 flex-wrap">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'explore' ? 'bg-[#121620] text-emerald-400 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🔍 {isAr ? 'استكشاف الأماكن' : 'Explore Places'}
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'favorites' ? 'bg-[#121620] text-[#FF4B6E] shadow' : 'text-slate-400 hover:text-white'}`}
            >
              ❤️ {isAr ? 'المفضلة' : 'Favorites'}
            </button>
            <button
              onClick={() => setActiveTab('saved_later')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'saved_later' ? 'bg-[#121620] text-amber-400 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              📌 {isAr ? 'أريد زيارتها' : 'Want to Visit'}
            </button>
            <button
              onClick={() => setActiveTab('ai_advisor')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'ai_advisor' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🤖 {isAr ? 'مستشار الذكاء الاصطناعي' : 'AI Companion'}
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'admin' ? 'bg-[#121620] text-purple-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
              ⚙️ {isAr ? 'لوحة المشرف' : 'Admin Area'}
            </button>
          </div>
        </div>
      </div>

      {/* EXPLORE PAGE TAB CONTENT */}
      {activeTab === 'explore' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Advanced Search & Filtering Bento Area */}
          <div className="bg-[#121620] p-6 rounded-3xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                {isAr ? 'فلترة متقدمة واستقصاء دقيق' : 'Precision Atmosphere Controls'}
              </span>
              
              {/* Lucky pick button trigger */}
              <button 
                onClick={triggerRandomPick}
                disabled={randomSelectLoading}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs tracking-wide rounded-xl shadow-lg shadow-orange-500/10 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
              >
                {randomSelectLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isAr ? '🎲 اقتراح مكان عشوائي (حظي ياليلي)' : '🎲 Propose Lucky Spot'}
              </button>
            </div>

            {/* Simulated spinning roulette pick slot */}
            <AnimatePresence>
              {randomResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-gradient-to-r from-[#171430] to-[#121C2F] p-5 rounded-2xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-4xl">🔮</span>
                    <div>
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{isAr ? 'اختيار العجلة الدوارة الذكية' : 'The Intelligent Roulette Selected'}</h4>
                      <h2 className="text-lg font-black text-white">{isAr ? randomResult.nameAr : randomResult.nameEn}</h2>
                      <p className="text-xs text-slate-300 mt-1">{isAr ? randomResult.descriptionAr : randomResult.descriptionEn}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedPlace(randomResult)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {isAr ? 'تفاصيل ومعلومات' : 'View Full Details'}
                    </button>
                    <button 
                      onClick={() => setRandomResult(null)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold"
                    >
                      {isAr ? 'إغلاق' : 'Clear'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inputs & Filters Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Category selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'نوع المكان المطلوب' : 'Type Category'}</label>
                <select
                  value={categoryFilter}
                  onChange={(e: any) => setCategoryFilter(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-white/10 px-4 py-3 rounded-xl focus:outline-none text-xs text-white cursor-pointer font-bold"
                >
                  <option value="All">{isAr ? 'كل الفئات والتصنيفات' : 'All Categories'}</option>
                  <option value="Restaurants">{isAr ? 'مطاعم فاخرة ومأكولات' : 'Restaurants'}</option>
                  <option value="Cafes">{isAr ? 'مقاهي ومشروبات ساخنة' : 'Cafes'}</option>
                  <option value="Parks">{isAr ? 'حدائق ومسطحات خضراء' : 'Parks'}</option>
                  <option value="Sights">{isAr ? 'معالم أثرية وسياحية' : 'Sights'}</option>
                  <option value="Malls">{isAr ? 'مجمعات ومراكز تسوق' : 'Malls'}</option>
                  <option value="Entertainment">{isAr ? 'ترفيه، جيمنج وألعاب' : 'Entertainment'}</option>
                </select>
              </div>

              {/* Classification filter (Solo, Group, Family) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'الرفقة والترتيب المناسب' : 'Accompany Vibe'}</label>
                <select
                  value={classificationFilter}
                  onChange={(e: any) => setClassificationFilter(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-white/10 px-4 py-3 rounded-xl focus:outline-none text-xs text-white cursor-pointer font-bold"
                >
                  <option value="All">{isAr ? 'أي نوع رفقة' : 'Any Companion Fitting'}</option>
                  <option value="Solo Friendly">{isAr ? 'مناسب للأفراد والروقان 🧘‍♂️' : 'Solo Friendly 🧘‍♂️'}</option>
                  <option value="Group Gathering">{isAr ? 'سهرات ومجموعات رفاق 👥' : 'Group Gathering 👥'}</option>
                  <option value="Family Optimized">{isAr ? 'عائلي وخصوصية هادئة 👨‍👩‍👧‍👦' : 'Family Optimized 👨‍👩‍👧‍👦'}</option>
                </select>
              </div>

              {/* Budget bracket picker */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'الميزانية المتوقعة' : 'Pricing Bracket'}</label>
                <div className="grid grid-cols-4 gap-2 bg-[#0B0E14] p-1 border border-white/10 rounded-xl">
                  {(['All', 'low', 'medium', 'high'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setBudgetFilter(b)}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                        budgetFilter === b 
                          ? 'bg-emerald-500 text-black shadow' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {b === 'All' && (isAr ? 'الكل' : 'All')}
                      {b === 'low' && '💸'}
                      {b === 'medium' && '💵'}
                      {b === 'high' && '💳'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Advanced Sliders layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-white/5">
              
              {/* Rating stars slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <span>{isAr ? 'التقييم الأدنى للمكان' : 'Minimum Rating Bar'}</span>
                  <span className="text-amber-400 font-bold">★ {ratingFilter === 0 ? (isAr ? 'أي تقييم' : 'Any') : ratingFilter.toFixed(1) + '+'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 rounded-lg cursor-pointer h-2 bg-[#0B0E14]"
                />
              </div>

              {/* Distance slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <span>{isAr ? 'سقف المسافة القصوى' : 'Maximum Radius'}</span>
                  <span className="text-emerald-430 text-indigo-400 font-bold">{maxDistanceFilter} {isAr ? 'كم' : 'km'}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="50"
                  step="1"
                  value={maxDistanceFilter}
                  onChange={(e) => setMaxDistanceFilter(parseInt(e.target.value))}
                  className="w-full accent-indigo-400 rounded-lg cursor-pointer h-2 bg-[#0B0E14]"
                />
              </div>

              {/* Custom weather info panel */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-2xl">
                <CloudSun className="w-8 h-8 text-amber-400 animate-pulse" />
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'الطقس الحالي بالخارج' : 'Live Outer Weather'}</h4>
                  <p className="text-xs font-bold text-white">{isAr ? 'درجة الحرارة ٣٢°م - سماء صافية ولطيفة 🌤️' : 'Sunny Clear Skies • 32°C 🌤️'}</p>
                </div>
              </div>

            </div>
          </div>

          {/* Places Results Cards Grid */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-base font-black flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                {isAr ? `الأماكن المتاحة (${filteredPlaces.length} مكان)` : `Live Options Map (${filteredPlaces.length} locations)`}
              </h3>
              <p className="text-xs font-mono text-slate-500">
                {isAr ? 'فرز آلي حسب المسافة من إحداثياتك' : 'Autosorted by spatial proximity'}
              </p>
            </div>

            {filteredPlaces.length === 0 ? (
              <div className="bg-[#121620] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 max-w-2xl mx-auto shadow-2xl transition duration-300">
                {/* Standard warning header */}
                <div className="text-center space-y-2 pb-4 border-b border-white/5">
                  <div className="inline-flex p-3 bg-rose-500/10 text-rose-400 rounded-full mb-1">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-black text-white">
                    {isAr ? 'عفواً، لم نجد نتائج مطابقة تماماً' : 'No places found matching precise filters'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {isAr 
                      ? 'لكن لا تقلق، دع الذكاء الاصطناعي الخاص بنا يقترح مشوارك التالي بناءً على معاييرك الدقيقة!' 
                      : 'Not to worry, let our intelligent advisor dynamically curate your next ideal outing in seconds!'}
                  </p>
                  
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setCategoryFilter('All');
                        setClassificationFilter('All');
                        setBudgetFilter('All');
                        setRatingFilter(0);
                        setMaxDistanceFilter(50);
                        setSearchQuery('');
                        resetEmptyAiAdvisor();
                      }}
                      className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[11px] font-bold rounded-xl transition cursor-pointer"
                    >
                      {isAr ? '🔄 إلغاء الفلاتر الحالية' : '🔄 Reset All Filters'}
                    </button>
                    {emptyAiStep !== 1 && (
                      <button
                        onClick={resetEmptyAiAdvisor}
                        className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/45 text-indigo-300 border border-indigo-500/20 text-[11px] font-bold rounded-xl transition cursor-pointer"
                      >
                        {isAr ? '✨ البدء من جديد' : '✨ Start AI Vibe Finder'}
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Interactive Assistant Questionnaire */}
                <div className="p-1">
                  <div className="mb-4 text-center">
                    <span className="px-3 py-1 bg-gradient-to-r from-emerald-500/15 to-indigo-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-full inline-block">
                      🤖 {isAr ? 'المرشد التفاعلي الذكي' : 'Intelligent AI Outing Copilot'}
                    </span>
                    <h5 className="text-sm font-black text-white mt-2 leading-relaxed">
                      {isAr 
                        ? 'أجب على ٣ أسئلة وسيقوم ذكاء التطبيق بعمل فلترة فورية والبحث عن الأماكن الدقيقة المطابقة لاحتياجاتك وموقعك.'
                        : 'Answer 3 questions and the app intelligence will do instant filtering and search for accurate places matching your needs and location.'}
                    </h5>
                  </div>

                  {/* STEP 1: WHO */}
                  {emptyAiStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <p className="text-xs font-bold text-center text-slate-300">
                        {isAr ? '١. مع مَن ستخرُج اليوم في طلوعتك؟' : '1. Who is going out with you today?'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={() => {
                            setEmptyAiWithWho('solo');
                            setEmptyAiStep(2);
                          }}
                          className="p-4 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-emerald-500/30 text-left rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-2xl block mb-2">🙋‍♂️</span>
                          <span className="font-bold text-white block">{isAr ? 'بمفردي (رواق صامت)' : 'Solo Retreat'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{isAr ? 'هدوء وتجربة شخصية مريحة' : 'Quiet & peaceful personal time'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEmptyAiWithWho('friends');
                            setEmptyAiStep(2);
                          }}
                          className="p-4 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-emerald-500/30 text-left rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-2xl block mb-2">👥</span>
                          <span className="font-bold text-white block">{isAr ? 'مع الأصدقاء (تجمع وسوالف)' : 'With Friends'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{isAr ? 'جلسات نابضة بالحياة والمرح' : 'Vibrant, open-ended sessions'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEmptyAiWithWho('family');
                            setEmptyAiStep(2);
                          }}
                          className="p-4 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-emerald-500/30 text-left rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-2xl block mb-2">👨‍👩‍👧‍👦</span>
                          <span className="font-bold text-white block">{isAr ? 'طلعة عائلية (خصوصية وأمان)' : 'Family Optimized'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{isAr ? 'أجواء آمنة وممتعة ومريحة للأطفال' : 'Kid-friendly, spacious spaces'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: BUDGET */}
                  {emptyAiStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <p className="text-xs font-bold text-center text-slate-300">
                        {isAr ? '٢. ما هي الميزانية المناسبة للطلعة؟' : '2. What is your budget preference?'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={() => {
                            setEmptyAiBudget('low');
                            setEmptyAiStep(3);
                          }}
                          className="p-4 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-indigo-500/30 text-left rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-2xl block mb-2">💸</span>
                          <span className="font-bold text-white block">{isAr ? 'اقتصادية' : 'Budget Friendly'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{isAr ? 'أسعار ممتازة وتوفير رائع' : 'Pocket-friendly places'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEmptyAiBudget('medium');
                            setEmptyAiStep(3);
                          }}
                          className="p-4 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-indigo-500/30 text-left rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-2xl block mb-2">💵</span>
                          <span className="font-bold text-white block">{isAr ? 'متوسطة' : 'Moderate Pricing'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{isAr ? 'قيمة مذهلة مقابل السعر' : 'Great balance of quality'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEmptyAiBudget('high');
                            setEmptyAiStep(3);
                          }}
                          className="p-4 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-indigo-500/30 text-left rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-2xl block mb-2">💳</span>
                          <span className="font-bold text-white block">{isAr ? 'راقية' : 'Premium Luxury'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{isAr ? 'خدمة استثنائية وجلسات خلابة' : 'Top class hospitality'}</span>
                        </button>
                      </div>
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setEmptyAiStep(1)}
                          className="text-[11px] text-slate-500 hover:text-white inline-flex items-center gap-1 bg-white/5 px-3 py-1 rounded-lg transition"
                        >
                          {isAr ? '← السؤال السابق' : '← Back'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: VIBE/CATEGORY */}
                  {emptyAiStep === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <p className="text-xs font-bold text-center text-slate-300">
                        {isAr ? '٣. ما هو نوع النشاط والأجواء المفضلة؟' : '3. What is your preferred activity category?'}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <button
                          onClick={() => fetchAiPlaces('coffee', true)}
                          className="p-3 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-teal-500/30 text-center rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-xl block mb-1">☕</span>
                          <span className="font-bold text-white block">{isAr ? 'محمصة وقهوة' : 'Specialty Cafe'}</span>
                        </button>
                        
                        <button
                          onClick={() => fetchAiPlaces('food', true)}
                          className="p-3 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-teal-500/30 text-center rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-xl block mb-1">🍔</span>
                          <span className="font-bold text-white block">{isAr ? 'مطعم ومأكولات' : 'Restaurant'}</span>
                        </button>
                        
                        <button
                          onClick={() => fetchAiPlaces('park', true)}
                          className="p-3 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-teal-500/30 text-center rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-xl block mb-1">🌳</span>
                          <span className="font-bold text-white block">{isAr ? 'حديقة وطبيعة' : 'Scenic Park'}</span>
                        </button>
                        
                        <button
                          onClick={() => fetchAiPlaces('game', true)}
                          className="p-3 bg-[#0B0E14] hover:bg-[#151B29] border border-white/5 hover:border-teal-500/30 text-center rounded-2xl group transition text-xs cursor-pointer"
                        >
                          <span className="text-xl block mb-1">🎮</span>
                          <span className="font-bold text-white block">{isAr ? 'ألعاب وتحدي جماعي' : 'Fun & Arcade'}</span>
                        </button>
                      </div>
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setEmptyAiStep(2)}
                          className="text-[11px] text-slate-500 hover:text-white inline-flex items-center gap-1 bg-white/5 px-3 py-1 rounded-lg transition"
                        >
                          {isAr ? '← السؤال السابق' : '← Back'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: RESULTS OR LOADING */}
                  {emptyAiStep === 4 && (
                    <div className="space-y-6">
                      {emptyAiThinking ? (
                        <div className="text-center py-10 space-y-4">
                          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto animate-spin-slow" />
                          <p className="text-xs text-emerald-300 font-mono animate-pulse">
                            {isAr 
                              ? 'الذكاء الاصطناعي يقوم بتحليل الأجواء والبحث في الخيارات...' 
                              : 'Dynamic synthetic matchers finding the ultimate spots...'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
                          <h4 className="text-sm font-black text-emerald-400">
                            {isAr ? '🎉 نتائج مطابقة الذكاء الاصطناعي الجاهزة!' : '🎉 AI Magic Matchmaking Results Ready!'}
                          </h4>
                          <p className="text-xs text-slate-300">
                            {isAr ? 'الخيارات التي تحقق معاييرك بشكل مثالي:' : 'The options that perfectly meet your criteria:'}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                            {emptyAiResultSpots.map(place => {
                              const km = computePlaceDistance(place);
                              return (
                                <div
                                  key={place.id}
                                  onClick={() => setSelectedPlace(place)}
                                  className="bg-[#0B0E14] hover:bg-[#151B29] border border-white/10 hover:border-emerald-500/30 rounded-2xl p-4 transition duration-300 flex flex-col justify-between cursor-pointer space-y-3 relative overflow-hidden"
                                >
                                  <div className="flex gap-3">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                                      <img
                                        src={place.images[0]}
                                        alt={place.nameEn}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <h5 className="text-xs font-black text-white group-hover:text-emerald-400 line-clamp-1">
                                        {isAr ? place.nameAr : place.nameEn}
                                      </h5>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold">
                                          {place.rating} ⭐
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-bold uppercase">
                                          {isAr ? place.classificationAr : place.classificationEn}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-normal">
                                        {isAr ? place.descriptionAr : place.descriptionEn}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5" />
                                      {km} {isAr ? 'كم تقريباً' : 'km nearby'}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectPrefillForOuting({
                                          title: isAr ? place.nameAr : place.nameEn,
                                          description: isAr ? place.descriptionAr : place.descriptionEn,
                                          category: place.category as any,
                                          location: place.city || '',
                                          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.nameEn || '')}`
                                        });
                                      }}
                                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-[#0B0E14] text-[9px] font-black rounded-lg transition"
                                    >
                                      {isAr ? '🚀 دشن طلعة لهنا' : '🚀 Setup Outing'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                            <button
                              onClick={() => fetchAiPlaces(emptyAiCat as any, true)}
                              className="px-6 py-2 border border-white/20 bg-transparent hover:bg-white/5 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition flex justify-center items-center gap-2"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {isAr ? 'تحديث المقترحات 🔄' : 'Refresh Suggestions 🔄'}
                            </button>
                            <button
                              onClick={resetEmptyAiAdvisor}
                              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              {isAr ? '✨ طلعة أخرى؟' : '✨ Other Outings?'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredPlaces.map(place => {
                  const km = computePlaceDistance(place);
                  const isFav = favorites.includes(place.id);
                  const isLater = savedLater.includes(place.id);

                  // Cost formatter by native city cur
                  const getFormattedBudget = () => {
                    if (place.city?.toLowerCase() === 'aden') {
                      return place.budget === 'low' ? (isAr ? '💸 1,500 ريال يمني' : '💸 1,500 YER') : place.budget === 'medium' ? (isAr ? '💵 3,000 ريال يمني' : '💵 3,000 YER') : (isAr ? '💳 6,000+ ريال يمني' : '💳 6,000+ YER');
                    } else {
                      return place.budget === 'low' ? (isAr ? '💸 15-30 ريال سعودي' : '💸 15-30 SAR') : place.budget === 'medium' ? (isAr ? '💵 40-80 ريال سعودي' : '💵 40-80 SAR') : (isAr ? '💳 100+ ريال سعودي' : '💳 100+ SAR');
                    }
                  };

                  return (
                    <motion.div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      whileHover={{ scale: 1.02, y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="bg-[#0F131E] hover:bg-[#131929] rounded-3xl border border-white/5 hover:border-indigo-500/30 shadow-2xl overflow-hidden group flex flex-col justify-between cursor-pointer relative"
                    >
                      {/* Place Image Section with Overlays */}
                      <div className="relative h-56 overflow-hidden bg-gray-950">
                        <img 
                          src={place.images && place.images.length > 0 ? place.images[0] : getPlaceholderImage(place.category)} 
                          alt={place.nameEn} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-108 transition-all duration-700 ease-out" 
                        />
                        
                        {(!place.images || place.images.length === 0) && (
                          <div className="absolute top-3 left-3 bg-indigo-600/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-white/20 z-10">
                             <Sparkles className="w-2.5 h-2.5 text-white" />
                             <span className="text-[8px] font-black text-white uppercase tracking-wider">{isAr ? 'صورة توضيحية' : 'Illustrative'}</span>
                          </div>
                        )}
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0F131E] via-transparent to-black/35" />

                        {/* Category badge */}
                        <span className="absolute top-3 left-3 bg-black/70 backdrop-blur border border-white/10 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider z-10">
                          {catNames[place.category]}
                        </span>

                        {/* Top action buttons (favorite / saved) */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                          <button
                            onClick={(e) => toggleFavorite(place.id, e)}
                            className="w-8.5 h-8.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 backdrop-blur text-white flex items-center justify-center transition active:scale-90"
                            title={isAr ? 'حفظ للمفضلة' : 'Save to Favorites'}
                          >
                            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500 animate-pulse' : 'text-slate-200'}`} />
                          </button>
                          <button
                            onClick={(e) => toggleSavedLater(place.id, e)}
                            className="w-8.5 h-8.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 backdrop-blur text-white flex items-center justify-center transition active:scale-90"
                            title={isAr ? 'الرغبة بالزيارة لاحقاً' : 'Want to visit later'}
                          >
                            <Plus className={`w-4 h-4 ${isLater ? 'text-amber-400 rotate-45' : 'text-slate-200'}`} />
                          </button>
                        </div>

                        {/* Open Now Green Indicator Badge */}
                        <span className="absolute bottom-3 left-3 bg-emerald-500/90 border border-emerald-400/20 backdrop-blur text-white text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide flex items-center gap-1 z-10">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                          <span>{isAr ? 'مفتوح الآن' : 'Open Now'}</span>
                        </span>

                        {/* Additional images gallery indicators */}
                        {place.images && place.images.length > 1 && (
                          <div className="absolute bottom-3 right-3 flex gap-1 z-10">
                            {place.images.slice(1, 4).map((imgUrl, imgIndex) => (
                              <div key={imgIndex} className="w-7 h-7 rounded-lg overflow-hidden border border-white/20 shadow-md relative bg-gray-900 shrink-0">
                                <img src={imgUrl} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                {imgIndex === 2 && place.images.length > 3 && (
                                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-[7px] font-black text-white">
                                    +{place.images.length - 3}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Content Section */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                          <div className="flex items-start justify-between gap-2 flex-row-reverse">
                            <h4 className="text-base font-extrabold text-white group-hover:text-indigo-400 transition duration-300 leading-snug">
                              {isAr ? place.nameAr : place.nameEn}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0 bg-white/5 px-2 py-1 rounded-xl border border-white/5 shadow-sm">
                              <span className="text-[9px] text-slate-400 font-bold">({(place.reviews?.length || 0) + 12})</span>
                              <span className="text-xs font-black text-white">{place.rating}</span>
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 justify-start">
                            <span className="text-[8px] font-black px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/10 rounded-lg uppercase tracking-wide">
                              {isAr ? place.classificationAr : place.classificationEn}
                            </span>
                            <span className="text-[10px] text-slate-300 font-bold bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                              {getFormattedBudget()}
                            </span>
                            {(place as any).isArchMatch && (
                              <span className="text-[8px] font-black px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-400/10 rounded-lg uppercase tracking-wide animate-pulse flex items-center gap-1">
                                🧠 {isAr ? 'مطابق لنمطك' : 'Style Match'}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed pt-1 line-clamp-2 text-right">
                            {isAr ? place.descriptionAr : place.descriptionEn}
                          </p>
                        </div>

                        {/* Card metadata and buttons */}
                        <div className="pt-3 border-t border-white/5 space-y-3.5 text-xs text-right animate-in fade-in duration-300" dir={isAr ? 'rtl' : 'ltr'}>
                          <div className="flex flex-col gap-1.5 justify-start text-[10px] text-slate-400">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Clock className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              <span className="truncate">{isAr ? `ساعات العمل: ${place.workingHoursAr}` : `Hours: ${place.workingHoursEn}`}</span>
                            </div>
                            
                            {km !== null && (
                              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>{isAr ? `يبعد ${km} كم عن موقعك الحالي` : `${km} km from you`}</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-indigo-400 font-mono">🚗 {Math.max(3, Math.round(km * 1.5))} {isAr ? 'دقيقة بالسيارة' : 'min drive'}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setSelectedPlace(place)}
                            className="w-full py-2.5 bg-[#171E2D] hover:bg-indigo-600/20 text-slate-200 hover:text-indigo-300 border border-white/5 hover:border-indigo-500/20 rounded-xl transition font-black text-xs cursor-pointer shadow"
                          >
                            {isAr ? 'عرض التفاصيل والتقييمات الفورية 👁️' : 'View Live Reviews & Info 👁️'}
                          </button>

                          {/* Action Grid Buttons */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigate(place);
                              }}
                              className="py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-xl text-center font-black text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Car className="w-3 h-3" />
                              <span>{isAr ? 'بدء التنقل' : 'Navigate'}</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const placeName = isAr ? place.nameAr : place.nameEn;
                                const placeDesc = isAr ? place.descriptionAr : place.descriptionEn;
                                onSelectPrefillForOuting({
                                  title: isAr ? `سهرة ممتعة في ${placeName}` : `Outing at ${placeName}`,
                                  description: isAr 
                                    ? `دعونا نخرج معاً لاستكشاف ${placeName}! الوصف: ${placeDesc}` 
                                    : `Let's gather at ${placeName} for a magnificent session! Info: ${placeDesc}`,
                                  category: place.category === 'Cafes' ? 'Cafes' : 'Custom Activities' as any,
                                  location: `${placeName}, ${place.city}`,
                                  googleMapsUrl: place.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.nameEn + ' ' + place.city)}`,
                                });
                              }}
                              className="py-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl text-center font-black text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{isAr ? 'إنشاء طلعة' : 'Outing'}</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const placeName = isAr ? place.nameAr : place.nameEn;
                                const textToCopy = `📍 ${placeName} (${place.city})\n🌟 التقييم: ${place.rating}\n🚗 المسافة: ${km} كم (${Math.max(3, Math.round(km * 1.5))} دقيقة)\n📌 رابط الموقع: ${place.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.nameEn + ' ' + place.city)}`}`;
                                navigator.clipboard.writeText(textToCopy);
                                alert(isAr ? '✓ تم نسخ تفاصيل وموقع المكان لمشاركته مع أصدقائك!' : '✓ Copy details to share!');
                              }}
                              className="py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-[#121620] rounded-xl text-center font-black text-[10px] border border-white/5 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Share2 className="w-3 h-3 text-slate-400" />
                              <span>{isAr ? 'مشاركة' : 'Share'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAVORITES WEB CARD TAB INDEX */}
      {activeTab === 'favorites' && (
        <div className="space-y-6 animate-in fade-in duration-300 text-center py-8">
          <h2 className="text-xl font-black text-[#FF4B6E] flex items-center justify-center gap-2">
            ❤️ {isAr ? 'قائمة تفضيلات الأماكن الخاصة بك' : 'My Vaulted Favorites'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isAr ? 'الأماكن التي قمت بتفضيلها للرجوع السريع في أي وقت.' : 'All high priority places marked for rapid social referrals.'}
          </p>

          {favorites.length === 0 ? (
            <div className="py-12 bg-white/5 rounded-3xl border border-white/5">
              <HeartCrack className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-xs text-slate-400">{isAr ? 'قائمتك فارغة حالياً. اضغط قلب الحب على أي مكان لإضافته هنا!' : 'Your favorite folder is empty. Heart places to save!'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {(places || []).filter(p => favorites.includes(p.id)).map(place => (
                <div
                  key={place.id}
                  onClick={() => setSelectedPlace(place)}
                  className="bg-[#121620] p-5 rounded-2xl border border-white/10 hover:border-[#FF4B6E]/30 cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img src={place.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    <div className="truncate">
                      <h4 className="text-sm font-black text-white">{isAr ? place.nameAr : place.nameEn}</h4>
                      <span className="text-[10px] text-rose-400">{catNames[place.category]}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-[#0B0E14] px-3 py-2 rounded-xl text-xs text-slate-400">
                    <span>★ {place.rating}</span>
                    <button
                      onClick={(e) => toggleFavorite(place.id, e)}
                      className="text-slate-500 hover:text-rose-500 font-bold"
                    >
                      {isAr ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SAVED LATER LIST TAB */}
      {activeTab === 'saved_later' && (
        <div className="space-y-6 animate-in fade-in duration-300 text-center py-8">
          <h2 className="text-xl font-black text-amber-400 flex items-center justify-center gap-2 animate-pulse">
            📌 {isAr ? 'أماكن أرغب بزيارتها لاحقاً' : 'My Destination Bucket List'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isAr ? 'احفظ الأماكن التي تريد تذكرها لزياراتك القادمة.' : 'Places saved during your scrolling sessions to visit soon.'}
          </p>

          {savedLater.length === 0 ? (
            <div className="py-12 bg-white/5 rounded-3xl border border-white/5">
              <Compass className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-xs text-slate-400">{isAr ? 'لم تحفظ أي أماكن بعد.' : 'Your bucket list is currently empty!'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {(places || []).filter(p => savedLater.includes(p.id)).map(place => (
                <div
                  key={place.id}
                  onClick={() => setSelectedPlace(place)}
                  className="bg-[#121620] p-5 rounded-2xl border border-white/10 hover:border-amber-500/30 cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img src={place.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    <div className="truncate">
                      <h4 className="text-sm font-black text-white">{isAr ? place.nameAr : place.nameEn}</h4>
                      <span className="text-[10px] text-amber-400">{catNames[place.category]}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-[#0B0E14] px-3 py-2 rounded-xl text-xs text-slate-400">
                    <span>★ {place.rating}</span>
                    <button
                      onClick={(e) => toggleSavedLater(place.id, e)}
                      className="text-slate-500 hover:text-amber-400 font-bold"
                    >
                      {isAr ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI CHAT ASSISTANT HELPER TAB */}
      {activeTab === 'ai_advisor' && (
        <div className="max-w-2xl mx-auto bg-[#121620] rounded-3xl border border-white/10 p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="text-center space-y-2">
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black uppercase tracking-wider rounded-full inline-block">
              🤖 {isAr ? 'المستكشف الذكي الحواري' : 'Interactive Conversational Oracle'}
            </span>
            <h2 className="text-xl font-black text-white">{isAr ? 'دع الذكاء الاصطناعي يقترح مشوارك التالي' : 'Let AI Sculpt Your Perfect Outing'}</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isAr 
                ? 'أجب على ٣ أسئلة وسيقوم ذكاء التطبيق بعمل فلترة فورية والبحث عن الأماكن الدقيقة المطابقة لاحتياجاتك وموقعك.' 
                : 'Reply to 3 brief atmospheric prompts, and Gemini matching algorithms will filter matching targets.'}
            </p>
          </div>

          <div className="bg-[#0B0E14] p-5 rounded-2xl border border-white/5 space-y-6">
            
            {/* Step 1: Who with */}
            {aiStep === 1 && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <h3 className="text-sm font-black text-slate-200 text-center">❓ {isAr ? 'السؤال ١: مع من ستخرج اليوم؟' : 'Q1: Who is your cohort today?'}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => { setAiWithWho('solo'); setAiStep(2); }}
                    className="p-4 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold space-y-2"
                  >
                    <span className="text-2xl block">🧘‍♂️</span>
                    <span>{isAr ? 'طالع لحالي / فردي' : 'Solo Reflection'}</span>
                  </button>
                  <button 
                    onClick={() => { setAiWithWho('friends'); setAiStep(2); }}
                    className="p-4 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold space-y-2"
                  >
                    <span className="text-2xl block">👥</span>
                    <span>{isAr ? 'رفاق وأصدقاء' : 'Cohort / Companions'}</span>
                  </button>
                  <button 
                    onClick={() => { setAiWithWho('family'); setAiStep(2); }}
                    className="p-4 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold space-y-2"
                  >
                    <span className="text-2xl block">👨‍👩‍👧‍👦</span>
                    <span>{isAr ? 'العائلة والمقربين' : 'Family Gathering'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Budget */}
            {aiStep === 2 && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <h3 className="text-sm font-black text-slate-200 text-center">❓ {isAr ? 'السؤال ٢: ما هي الميزانية المناسبة للطلعة؟' : 'Q2: Select your budgetary bracket'}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => { setAiBudget('low'); setAiStep(3); }}
                    className="p-4 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold space-y-2"
                  >
                    <span className="text-2xl block">💸</span>
                    <span>{isAr ? 'اقتصادية مريحة' : 'Budget Comfort'}</span>
                  </button>
                  <button 
                    onClick={() => { setAiBudget('medium'); setAiStep(3); }}
                    className="p-4 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold space-y-2"
                  >
                    <span className="text-2xl block">💵</span>
                    <span>{isAr ? 'متوسطة / معتادة' : 'Moderate Target'}</span>
                  </button>
                  <button 
                    onClick={() => { setAiBudget('high'); setAiStep(3); }}
                    className="p-4 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold space-y-2"
                  >
                    <span className="text-2xl block">💳</span>
                    <span>{isAr ? 'راقية / فاخرة' : 'Upscale Oasis'}</span>
                  </button>
                </div>
                <div className="text-center pt-2">
                  <button onClick={() => setAiStep(1)} className="text-xs text-slate-400 hover:text-white underline">{isAr ? 'رجوع للسابق' : 'Go Back'}</button>
                </div>
              </div>
            )}

            {/* Step 3: Category Preference */}
            {aiStep === 3 && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <h3 className="text-sm font-black text-slate-200 text-center">❓ {isAr ? 'السؤال ٣: ما هو نوع النشاط والأجواء المفضلة؟' : 'Q3: What vibe style matches best?'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { setAiCat('coffee'); evaluateAiAdvisorSelection(); }}
                    className="p-3 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold flex items-center justify-between px-4"
                  >
                    <span>☕ {isAr ? 'قهوة وتأمل' : 'Coffee Therapy'}</span>
                    <span className="text-slate-500 font-mono text-[10px]">&gt;</span>
                  </button>
                  <button 
                    onClick={() => { setAiCat('food'); evaluateAiAdvisorSelection(); }}
                    className="p-3 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold flex items-center justify-between px-4"
                  >
                    <span>🍽️ {isAr ? 'عشاء لذيذ ووجبة' : 'Hearty Culinary'}</span>
                    <span className="text-slate-500 font-mono text-[10px]">&gt;</span>
                  </button>
                  <button 
                    onClick={() => { setAiCat('park'); evaluateAiAdvisorSelection(); }}
                    className="p-3 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold flex items-center justify-between px-4"
                  >
                    <span>🌳 {isAr ? 'هواء طلق وخضرة' : 'Verdant Breathe'}</span>
                    <span className="text-slate-500 font-mono text-[10px]">&gt;</span>
                  </button>
                  <button 
                    onClick={() => { setAiCat('game'); evaluateAiAdvisorSelection(); }}
                    className="p-3 bg-white/5 border border-white/10 hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition text-xs font-bold flex items-center justify-between px-4"
                  >
                    <span>🎮 {isAr ? 'ألعاب وتحدي جماعي' : 'Amusement Battle'}</span>
                    <span className="text-slate-500 font-mono text-[10px]">&gt;</span>
                  </button>
                </div>
                <div className="text-center pt-2 flex items-center justify-center gap-4">
                  <button onClick={() => setAiStep(2)} className="text-xs text-slate-400 hover:text-white underline">{isAr ? 'رجوع للخطوة السابقة' : 'Go Back'}</button>
                  <button onClick={evaluateAiAdvisorSelection} className="text-xs text-emerald-400 hover:text-emerald-300 font-bold underline">{isAr ? 'تخطي واقترح في أسرع وقت' : 'Skip Prompt'}</button>
                </div>
              </div>
            )}

            {/* Step 4: Display Matching Propped Spots */}
            {aiStep === 4 && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <div className="text-center space-y-1.5">
                  <h3 className="text-sm font-black text-emerald-400">🎉 {isAr ? 'نتائج مطابقة الذكاء الاصطناعي الجاهزة!' : 'AI Atmospheric Proposals Rendered!'}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">{isAr ? 'الخيارات التي تحقق معاييرك بشكل مثالي' : 'Best fits matching your companion and budget filters'}</p>
                </div>

                <div className="space-y-3">
                  {aiThinking ? (
                    <div className="flex justify-center items-center py-10">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                    </div>
                  ) : (
                    aiResultSpots.map(spot => (
                      <div 
                        key={spot.id}
                        onClick={() => { setSelectedPlace(spot); }}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition flex items-center justify-between gap-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <img src={spot.images[0]} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                          <div>
                            <h4 className="text-xs font-semibold text-white">{isAr ? spot.nameAr : spot.nameEn}</h4>
                            <span className="text-[9px] text-slate-400 block mt-0.5">{isAr ? spot.classificationAr : spot.classificationEn} • {spot.budget === 'low' ? '💸' : spot.budget === 'medium' ? '💵' : '💳'}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4 border-t border-white/5">
                  <button
                    onClick={() => fetchAiPlaces(aiCat as any, false)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                  >
                     <Sparkles className="w-3.5 h-3.5" />
                    {isAr ? 'تحديث المقترحات 🔄' : 'Refresh Suggestions 🔄'}
                  </button>
                  <button
                    onClick={resetAiAdvisor}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    {isAr ? 'طلعة أخرى؟' : 'Other Outings?'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN CONTROL PANEL TAB */}
      {activeTab === 'admin' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-purple-950/20 border border-purple-500/20 p-5 rounded-3xl flex items-center gap-3.5">
            <span className="text-2xl">🛡️</span>
            <div>
              <h2 className="text-base font-black text-white">{isAr ? 'لوحة تحكم المشرف لإدارة الأماكن والمحتوى' : 'Admin Control Room & Seed Console'}</h2>
              <p className="text-xs text-slate-400">{isAr ? 'تتيح لك إضافة أماكن جديدة وتحميل صور وإدارة الكتالوج العام للمستخدمين.' : 'Create, edit or purge mock places databases dynamically.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Add place */}
            <div className="bg-[#121620] p-6 rounded-3xl border border-white/5 space-y-4">
              <h3 className="text-sm font-black text-white">{isAr ? 'إضافة مكان جديد لقاعدة البيانات' : 'Seed New Place Entry'}</h3>
              
              {adminAlertSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  {isAr ? 'تم حفظ المكان الجديد بنجاح!' : 'New place database record written!'}
                </div>
              )}

              <form onSubmit={handleAdminAddPlace} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'اسم المكان (إنجليزي)' : 'Name (English)'}</label>
                  <input
                    type="text"
                    required
                    value={adminNameEn} 
                    onChange={(e) => setAdminNameEn(e.target.value)}
                    placeholder="e.g. Arabica Specialty Coffee"
                    className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'اسم المكان (عربي)' : 'Name (Arabic)'}</label>
                  <input
                    type="text"
                    required
                    value={adminNameAr} 
                    onChange={(e) => setAdminNameAr(e.target.value)}
                    placeholder="مثال: أرابيكا لـ القهوة المختصة"
                    className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'الفئة' : 'Category'}</label>
                    <select
                      value={adminCategory}
                      onChange={(e: any) => setAdminCategory(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white font-bold"
                    >
                      <option value="Cafes">{isAr ? 'مقهى' : 'Cafe'}</option>
                      <option value="Restaurants">{isAr ? 'مطعم' : 'Restaurant'}</option>
                      <option value="Parks">{isAr ? 'منتزه' : 'Park'}</option>
                      <option value="Sights">{isAr ? 'معلم سياحي' : 'Sights'}</option>
                      <option value="Malls">{isAr ? 'مجمع مائي' : 'Malls'}</option>
                      <option value="Entertainment">{isAr ? 'ترفيه وألعاب' : 'Entertainment'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'الرفقة' : 'Classification'}</label>
                    <select
                      value={adminClass}
                      onChange={(e: any) => setAdminClass(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white font-bold"
                    >
                      <option value="Solo Friendly">{isAr ? 'روقان منفرد' : 'Solo Friendly'}</option>
                      <option value="Group Gathering">{isAr ? 'تجمعات ورفاق' : 'Group Gathering'}</option>
                      <option value="Family Optimized">{isAr ? 'عائلي خاص' : 'Family Optimized'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'الميزانية' : 'Budget'}</label>
                    <select
                      value={adminBudget}
                      onChange={(e: any) => setAdminBudget(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white font-bold"
                    >
                      <option value="low">💸 low</option>
                      <option value="medium">💵 medium</option>
                      <option value="high">💳 high</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'رابط الصورة' : 'Image URL'}</label>
                    <input
                      type="url"
                      value={adminImageUrl}
                      onChange={(e) => setAdminImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
                  <textarea
                    required
                    value={adminDescAr}
                    onChange={(e) => setAdminDescAr(e.target.value)}
                    rows={2}
                    className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 pb-1.5 font-bold">{isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}</label>
                  <textarea
                    required
                    value={adminDescEn}
                    onChange={(e) => setAdminDescEn(e.target.value)}
                    rows={2}
                    className="w-full bg-[#0B0E14] border border-white/10 p-2.5 rounded-xl text-white text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 font-extrabold text-white text-xs rounded-xl uppercase tracking-wider"
                >
                  ➕ {isAr ? 'إدراج وتحديث الفهرس' : 'Write Record entry'}
                </button>
              </form>
            </div>

            {/* List and purge catalog items from live state */}
            <div className="lg:col-span-2 bg-[#121620] p-6 rounded-3xl border border-white/5 space-y-4">
              <h3 className="text-sm font-black text-white">{isAr ? 'إدارة كتالوج الأماكن الحالي وحذف العناصر' : 'Manage & Purge Catalog Live Entries'}</h3>
              <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                {places.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3.5 bg-[#0B0E14] border border-white/5 rounded-2xl gap-4">
                    <div className="flex items-center gap-3">
                      <img src={p.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-white">{isAr ? p.nameAr : p.nameEn}</h4>
                        <span className="text-[9px] text-slate-500">{p.city} • {p.category}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAdminDeletePlace(p.id)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl transition cursor-pointer"
                      title={isAr ? 'حذف العنصر' : 'Delete place'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FULL DETAILED MODAL OVERLAY FOR SINGLE CHOSEN PLACE */}
      <AnimatePresence>
        {selectedPlace && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B0E14] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col justify-between"
              id="detailed-place-modal"
            >
              
              {/* Header Carousel Gallery Mock */}
              <div className="relative h-60 bg-gray-950 shrink-0">
                <img
                  src={selectedPlace.images[0]}
                  alt={selectedPlace.nameEn}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-transparent to-black/50" />
                
                {/* Close Button overlay */}
                <button
                  onClick={() => setSelectedPlace(null)}
                  className="absolute top-4 right-4 w-9 h-9 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white font-bold hover:bg-black transition-colors"
                >
                  ✕
                </button>

                {/* Classification pill */}
                <div className="absolute bottom-4 left-4 bg-emerald-500 text-black text-[10px] sm:text-xs font-black px-3.5 py-1.5 rounded-full shadow-lg">
                  {isAr ? selectedPlace.classificationAr : selectedPlace.classificationEn}
                </div>
              </div>

              {/* Modal Core Body Content Scrollable */}
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4 flex-wrap text-right" dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="space-y-1">
                      <h2 className="text-xl md:text-2xl font-black text-rose-500">
                        {isAr ? selectedPlace.nameAr : selectedPlace.nameEn}
                      </h2>
                      <span className="text-xs text-slate-400 font-mono italic block">
                        📍 {isAr ? `نطاق مدينة ${selectedPlace.city}` : `District vicinity of ${selectedPlace.city}`}
                      </span>
                    </div>

                    {/* Google Map View & Directions Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <a
                        id="btn_view_location"
                        href={getGoogleMapsViewUrl({
                          lat: selectedPlace.lat,
                          lng: selectedPlace.lng,
                          placeId: selectedPlace.placeId,
                          name: selectedPlace.nameEn,
                          city: selectedPlace.city
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 text-center"
                      >
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        <span>{isAr ? 'عرض الموقع' : 'View Location'}</span>
                      </a>

                      <a
                        id="btn_directions"
                        href={getGoogleMapsDirUrl({
                          lat: selectedPlace.lat,
                          lng: selectedPlace.lng
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-sky-500 hover:bg-sky-450 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/20 text-center"
                      >
                        <Compass className="w-4 h-4 text-yellow-300" />
                        <span>{isAr ? 'الاتجاهات' : 'Directions'}</span>
                      </a>
                    </div>
                  </div>

                  {/* Smart dynamic distance & rating specs row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div className="bg-white/5 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] uppercase font-black text-slate-500">{isAr ? 'التقييم العام' : 'Overall Rank'}</div>
                      <div className="text-xs font-black text-amber-400 flex items-center justify-center gap-0.5 mt-0.5">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{selectedPlace.rating} ({(selectedPlace.reviews?.length || 0) + 42} {isAr ? 'رأي' : 'reviews'})</span>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] uppercase font-black text-slate-500">{isAr ? 'المسافة الجغرافية' : 'Proximity'}</div>
                      <div className="text-xs font-black text-white mt-0.5">
                        📍 {computePlaceDistance(selectedPlace).toFixed(1)} {isAr ? 'كم قريباً' : 'km away'}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] uppercase font-black text-slate-400">{isAr ? 'مدة قيادة السيارة' : 'Travel Time'}</div>
                      <div className="text-xs font-black text-indigo-300 mt-0.5">
                        🚗 {Math.max(3, Math.round(computePlaceDistance(selectedPlace) * 1.5))} {isAr ? 'دقيقة' : 'mins'}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/5 p-2 rounded-xl text-center">
                      <div className="text-[10px] uppercase font-black text-slate-500">{isAr ? 'ساعات العمل' : 'Opening Hours'}</div>
                      <div className="text-[10px] font-bold text-slate-200 mt-0.5 truncate px-1" title={isAr ? selectedPlace.workingHoursAr : selectedPlace.workingHoursEn}>
                        {isAr ? selectedPlace.workingHoursAr : selectedPlace.workingHoursEn}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-2 text-right">
                    {isAr ? selectedPlace.descriptionAr : selectedPlace.descriptionEn}
                  </p>
                </div>

                {/* Services Checkered grid */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                    {isAr ? 'الخدمات والتجهيزات المتوفرة:' : 'Included Comforts & Amenities:'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(isAr ? selectedPlace.servicesAr : selectedPlace.servicesEn).map((svc, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/5 p-2 rounded-xl text-xs text-slate-200">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{svc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submitting Comments / Live Review Form */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    {isAr ? 'شارع التعليقات وتقييم الأصدقاء' : 'Friend Reviews & Live Feedback'}
                  </h4>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'اكتب تجربتك أو تعليقك الشخصي عن المكان:' : 'Write your descriptive customer experience:'}</label>
                    
                    {/* Stars selectors */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{isAr ? 'تقييمك بالنجوم:' : 'Star Rank:'}</span>
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          type="button" 
                          onClick={() => setNewReviewScore(score)}
                          className="p-1 focus:outline-none transition active:scale-90"
                        >
                          <Star className={`w-5 h-5 ${score <= newReviewScore ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newReviewText}
                        onChange={(e) => setNewReviewText(e.target.value)}
                        placeholder={isAr ? 'مثال: مكان رائع وقهوتهم ممتازة جدا والخدمة سريعة...' : 'Great seating plans and acoustic quality...'}
                        className="flex-1 bg-[#0B0E14] border border-white/10 p-3 rounded-xl text-xs text-white"
                      />
                      <button
                        onClick={handleAddReview}
                        disabled={!newReviewText.trim()}
                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Comments loop */}
                  <div className="space-y-3 max-h-44 overflow-y-auto pr-2">
                    {(selectedPlace.reviews?.length || 0) === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-2">{isAr ? 'لا توجد تعليقات بعد. كن أول من يكتب تقييماً لمجتمع يالاميت!' : 'Be the first contributor to share feedback!'}</p>
                    ) : (
                      selectedPlace.reviews.map((rev, index) => (
                        <div key={index} className="bg-white/5 border border-white/5 p-3 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between items-center text-slate-300">
                            <span className="font-bold flex items-center gap-1.5">{rev.avatar || '⛺'} {rev.author}</span>
                            <span className="text-amber-400 font-bold">★ {rev.rating}</span>
                          </div>
                          <p className="text-slate-400 text-xs">{isAr ? (rev.commentAr || rev.commentEn) : (rev.commentEn || rev.commentAr)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom modal action trigger outings */}
              <div className="p-6 bg-white/5 border-t border-white/10 flex flex-wrap justify-between items-center gap-3 shrink-0" dir={isAr ? 'rtl' : 'ltr'}>
                <button
                  onClick={() => setSelectedPlace(null)}
                  className="px-4 py-3 bg-[#0B0E14] border border-white/10 text-slate-300 font-bold rounded-xl text-xs hover:bg-white/5 transition cursor-pointer"
                >
                  {isAr ? 'إغلاق النافذة' : 'Close'}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const placeName = isAr ? selectedPlace.nameAr : selectedPlace.nameEn;
                      const textToCopy = `📍 *${placeName}* (${selectedPlace.city})\n🌟 التقييم: ${selectedPlace.rating}\n🚗 المسافة: ${computePlaceDistance(selectedPlace).toFixed(1)} كم\n📌 الموقع على خرائط جوجل: ${selectedPlace.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.nameEn + ' ' + selectedPlace.city)}`}`;
                      navigator.clipboard.writeText(textToCopy);
                      alert(isAr ? '✓ تم نسخ كبسولة العنوان وتفاصيل المكان لجروب الرفاق!' : '✓ Copy info to clipboard!');
                    }}
                    className="px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'مشاركه مع الأصدقاء' : 'Share venue'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const placeName = isAr ? selectedPlace.nameAr : selectedPlace.nameEn;
                      const placeDesc = isAr ? selectedPlace.descriptionAr : selectedPlace.descriptionEn;
                      setSelectedPlace(null);
                      onSelectPrefillForOuting({
                        title: isAr ? `سهرة ممتعة في ${placeName}` : `Outing at ${placeName}`,
                        description: isAr 
                          ? `دعونا نخرج معاً لاستكشاف ${placeName}! الوصف: ${placeDesc}` 
                          : `Let's gather at ${placeName} for a magnificent session! Info: ${placeDesc}`,
                        category: selectedPlace.category === 'Cafes' ? 'Cafes' : 'Custom Activities' as any,
                        location: `${placeName}, ${selectedPlace.city}`,
                        googleMapsUrl: selectedPlace.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.nameEn + ' ' + selectedPlace.city)}`,
                      });
                    }}
                    className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl shadow-lg active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    🚀
                    <span>{isAr ? 'دشن طلعة لهذا المكان' : 'Schedule Outing Here'}</span>
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
