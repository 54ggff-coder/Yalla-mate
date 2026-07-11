/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActivityCategory, Outing, OutingLogistics, Profile, BudgetEstimate } from '../types';
import { categoryMeta, arabCitiesList, foreignCitiesList, cityLandmarks } from '../constants';
import { Calendar, MapPin, Users, ShieldAlert, Car, X, Compass, Globe } from 'lucide-react';
import { translations, Language } from '../data/translations';
import PlaceAutocompleteInput from './PlaceAutocompleteInput';
import SmartSuggestionsUI from './SmartSuggestionsUI';
import { useLocation } from '../contexts/LocationContext';
import { haptic } from '../lib/haptics';
import LocationIndicator from './LocationIndicator';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface OutingCreatorProps {
  currentUserId: string;
  creatorName: string;
  creatorAvatar: string;
  creatorTrust: number;
  creatorGender: 'male' | 'female';
  city: string;
  allProfiles: Profile[];
  friendsList: string[]; // List of friend IDs
  onSave: (outing: Outing) => void;
  onCancel: () => void;
  lang: Language;
  prefill?: {
    title?: string;
    description?: string;
    category?: ActivityCategory;
    location?: string;
    googleMapsUrl?: string;
  };
}

const CITY_COORDINATES: Record<string, [number, number]> = {};

export default function OutingCreator({
  currentUserId,
  creatorName,
  creatorAvatar,
  creatorTrust,
  creatorGender,
  city,
  allProfiles,
  friendsList,
  onSave,
  onCancel,
  lang,
  prefill,
}: OutingCreatorProps) {
  const currentCityOption = { nameEn: 'Current Location', nameAr: 'موقعك الحالي', countryEn: 'Auto-detect' };
  const displayCitiesList = lang === 'ar' 
    ? [currentCityOption, ...arabCitiesList]
    : [currentCityOption, ...foreignCitiesList];

  const t = translations[lang];

  const [title, setTitle] = useState(prefill?.title || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [category, setCategory] = useState<ActivityCategory>(prefill?.category || 'Cafes');
  const [location, setLocation] = useState(prefill?.location || '');
  const [selectedCity, setSelectedCity] = useState(city || displayCitiesList[0].nameEn);
  const [datetime, setDatetime] = useState('');
  const [maxAttendees, setMaxAttendees] = useState<number | ''>(4);
  const [minTrustScore, setMinTrustScore] = useState(8.0);
  const [genderRestriction, setGenderRestriction] = useState<'men_only' | 'women_only' | 'co_ed'>(
    creatorGender === 'female' ? 'women_only' : 'men_only'
  );
  const [pickupPoint, setPickupPoint] = useState('');

  // Private outings state
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [isSoloOuting, setIsSoloOuting] = useState(false);

  const { coords: liveCoords, address: liveAddress, requestLocation } = useLocation();

  // Map Coordinates simulation
  const [mapLat, setMapLat] = useState<number>(() => {
    return liveCoords?.[0] || 0;
  });
  const [mapLng, setMapLng] = useState<number>(() => {
    return liveCoords?.[1] || 0;
  });
  const [showMap, setShowMap] = useState<boolean>(true);

  React.useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  React.useEffect(() => {
    if (liveCoords && !prefill?.location && !location && !googleMapsUrl) {
      setMapLat(liveCoords[0]);
      setMapLng(liveCoords[1]);
    }
  }, [liveCoords, prefill]);

  React.useEffect(() => {
    if (!googleMapsUrl && liveCoords && !prefill?.location && !location) {
      setMapLat(liveCoords[0]);
      setMapLng(liveCoords[1]);
    }
  }, [selectedCity, liveCoords, prefill]);

  const geocodingLib = useMapsLibrary('geocoding');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [autoPopulated, setAutoPopulated] = useState(false);
  const [locationStatusMsg, setLocationStatusMsg] = useState<string | null>(null);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [budgetEstimate, setBudgetEstimate] = useState<BudgetEstimate | null>(null);
  const [isEstimatingBudget, setIsEstimatingBudget] = useState(false);

  const fetchBudgetEstimate = async () => {
    if (!selectedCity || !category) return;
    setIsEstimatingBudget(true);
    try {
      const res = await fetch('/api/budget-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: selectedCity,
          country: lang === 'ar' ? 'السعودية' : 'Saudi Arabia',
          category,
          attendees: typeof maxAttendees === 'number' ? maxAttendees : 2,
          lang
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.estimate) setBudgetEstimate(data.estimate);
      }
    } catch (e) {
      console.error('Failed to estimate budget:', e);
    } finally {
      setIsEstimatingBudget(false);
    }
  };

  const doReverseGeocode = async (lat: number, lng: number, isAutoPrefill = false) => {
    setMapLat(lat);
    setMapLng(lng);
    if (!geocodingLib) return;
    try {
      setIsGeocoding(true);
      setLocationStatusMsg(null);
      const geocoder = new geocodingLib.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results && response.results.length > 0) {
        const best = response.results[0];
        setLocation(best.formatted_address);
        if (isAutoPrefill) {
          setAutoPopulated(true);
        }
      } else {
        setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
      setLocationStatusMsg(lang === 'ar' ? 'تم تحديد الإحداثيات، لكن تعذر جلب اسم العنوان عبر الخرائط.' : 'Coordinates locked, but street address lookup failed.');
      setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  React.useEffect(() => {
    if (liveCoords && geocodingLib && !prefill?.location && !autoPopulated && !location) {
      doReverseGeocode(liveCoords[0], liveCoords[1], true);
    }
  }, [liveCoords, geocodingLib, prefill, autoPopulated, location]);

  const handleSnapToCurrent = () => {
    setIsGeocoding(true);
    setLocationStatusMsg(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMapLat(lat);
          setMapLng(lng);
          setAutoPopulated(true);

          if (geocodingLib) {
            try {
              const geocoder = new geocodingLib.Geocoder();
              const response = await geocoder.geocode({ location: { lat, lng } });
              if (response.results && response.results.length > 0) {
                setLocation(response.results[0].formatted_address);
              } else {
                setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
              }
            } catch (err) {
              console.error('Snap geocode failed:', err);
              setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
              setLocationStatusMsg(lang === 'ar' ? 'تم جلب الإحداثيات الجديدة، لكن تعذر تحويلها لاسم عنوان.' : 'New GPS locked, but street address lookup failed.');
            } finally {
              setIsGeocoding(false);
            }
          } else {
            setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            setIsGeocoding(false);
          }
        },
        (err) => {
          console.error('Geolocation snap error:', err);
          setIsGeocoding(false);
          setLocationStatusMsg(lang === 'ar' ? 'تعذر الوصول للموقع الـ GPS. يرجى التأكد من إعطاء إذن الموقع.' : 'Could not access GPS. Please verify location permissions.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsGeocoding(false);
      setLocationStatusMsg(lang === 'ar' ? 'متصفحك لا يدعم تحديد الموقع.' : 'Geolocation is not supported by your browser.');
    }
  };

  // Google Maps External URL Integration
  const [googleMapsUrl, setGoogleMapsUrl] = useState(prefill?.googleMapsUrl || '');
  const [extractionStatus, setExtractionStatus] = useState<'none' | 'success' | 'unsupported_short'>('none');

  React.useEffect(() => {
    if (prefill) {
      if (prefill.title) setTitle(prefill.title);
      if (prefill.description) setDescription(prefill.description);
      if (prefill.category) setCategory(prefill.category);
      if (prefill.location) setLocation(prefill.location);
      if (prefill.googleMapsUrl) {
        setGoogleMapsUrl(prefill.googleMapsUrl);
        const coords = parseGoogleMapsUrl(prefill.googleMapsUrl);
        if (coords) {
          setMapLat(coords.lat);
          setMapLng(coords.lng);
          setExtractionStatus('success');
        }
      }
    }
    if (liveAddress?.city && !prefill?.location) {
      setSelectedCity(liveAddress.city);
    }
  }, [prefill, liveAddress]);

  const parseGoogleMapsUrl = (url: string) => {
    if (!url) return null;
    try {
      // 1. Check for standard @lat,lng
      const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const atMatch = url.match(atRegex);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }

      // 2. Check for query q=lat,lng
      const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const qMatch = url.match(qRegex);
      if (qMatch) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
      }

      // 3. Check for ll=lat,lng
      const llRegex = /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const llMatch = url.match(llRegex);
      if (llMatch) {
        return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
      }
    } catch (err) {
      console.error("Error parsing Google Maps URL:", err);
    }
    return null;
  };

  const handleGoogleMapsUrlChange = (value: string) => {
    setGoogleMapsUrl(value);
    if (!value) {
      setExtractionStatus('none');
      return;
    }

    const coords = parseGoogleMapsUrl(value);
    if (coords) {
      setMapLat(coords.lat);
      setMapLng(coords.lng);
      setExtractionStatus('success');
    } else if (value.includes('maps.app.goo.gl') || value.includes('goo.gl/maps')) {
      // Short URLs are shared URLs; they can be stored directly for mates but don't expose coordinates directly
      setExtractionStatus('unsupported_short');
    } else {
      setExtractionStatus('none');
    }
  };

  // Logistics & Driving State
  const [hasDriver, setHasDriver] = useState(false);
  const [vehicleCapacity, setVehicleCapacity] = useState<number | ''>(4);
  const [fuelSharingPrice, setFuelSharingPrice] = useState<number | ''>(0);
  const [pickupPointType, setPickupPointType] = useState<'current' | 'custom'>('current');
  const [customPickupPoint, setCustomPickupPoint] = useState('');
  const [isBlindOuting, setIsBlindOuting] = useState(false);

  // AI Transport Optimization States
  const [isOptimizingTransport, setIsOptimizingTransport] = useState(false);
  const [transportOptimizationData, setTransportOptimizationData] = useState<{
    optimizedFuelPrice: number;
    savingsPercentage: number;
    suggestions: string[];
    optimizedRoute: string;
  } | null>(null);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [showOptimizationResult, setShowOptimizationResult] = useState(false);

  const handleOptimizeTransport = async () => {
    setIsOptimizingTransport(true);
    setOptimizationError(null);
    setTransportOptimizationData(null);
    try {
      const res = await fetch('/api/yallamate/optimize-transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: location || 'Riyadh',
          fuelSharingPrice: fuelSharingPrice || 0,
          vehicleCapacity: vehicleCapacity || 4,
          title: title || 'Outing',
          category: category || 'Hangout',
          lang
        })
      });

      if (!res.ok) throw new Error('Optimization failed');
      const data = await res.json();
      setTransportOptimizationData(data);
      setShowOptimizationResult(true);
    } catch (err: any) {
      console.error('Transport optimization error:', err);
      setOptimizationError(lang === 'ar' ? 'فشل الاتصال بمُحسّن المسارات البيني.' : 'Failed to connect with logistics optimizer.');
    } finally {
      setIsOptimizingTransport(false);
    }
  };

  const numMaxAttendees = typeof maxAttendees === 'number' ? maxAttendees : 0;
  const numFuel = typeof fuelSharingPrice === 'number' ? fuelSharingPrice : 0;
  const computedCostPerPerson = numFuel > 0 && numMaxAttendees > 1
    ? parseFloat((numFuel / numMaxAttendees).toFixed(2))
    : 0;

  const applyQuickTemplate = (templateType: 'coffee' | 'gaming' | 'drive' | 'dinner') => {
    if (templateType === 'coffee') {
      setTitle(lang === 'ar' ? 'تجمعة قهوة مختصة وسوالف' : 'Casual Coffee & Chat Break');
      setDescription(lang === 'ar' ? 'جلسة قهوة راقية في كافيه مميز، سوالف وتغيير جو بعد ضغط الأسبوع.' : 'Relaxed coffee break at a specialty cafe. Great conversations & vibes.');
      setCategory('Cafes');
      setMaxAttendees(4);
      setHasDriver(false);
      setFuelSharingPrice(0);
    } else if (templateType === 'gaming') {
      setTitle(lang === 'ar' ? 'تحدي قيمينق وبلياردو حماسي' : 'Intense Gaming & Billiards Match');
      setDescription(lang === 'ar' ? 'سهرة ألعاب وبلياردو وتحديات، اللي يخسر يدفع حق العصير!' : 'Thrilling gaming & pool match. Loser pays for drinks!');
      setCategory('Gaming Sessions');
      setMaxAttendees(4);
      setHasDriver(false);
      setFuelSharingPrice(0);
    } else if (templateType === 'drive') {
      setTitle(lang === 'ar' ? 'كشتة وفرة سيارة ليلية مع عشا' : 'Scenic Night Drive & Late Dinner');
      setDescription(lang === 'ar' ? 'تجمعة في السيارة، فرة بالمدينة مع تشغيل أغاني رايقة وعشا سريعة.' : 'Night cruising around the city with good music and late night takeout.');
      setCategory('City Tours');
      setMaxAttendees(4);
      setHasDriver(true);
      setVehicleCapacity(4);
      setFuelSharingPrice(20);
    } else if (templateType === 'dinner') {
      setTitle(lang === 'ar' ? 'تجربة مطعم جديد وتقييم الأكل' : 'New Restaurant Dinner Experience');
      setDescription(lang === 'ar' ? 'طلعة عشا جماعية لتجربة مطعم جديد وتقييم الأكل والأجواء مع بعض.' : 'Group dinner outing to try a hyped new spot and rate the food.');
      setCategory('Restaurants');
      setMaxAttendees(5);
      setHasDriver(false);
      setFuelSharingPrice(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !location || !datetime || typeof maxAttendees !== 'number' || maxAttendees < 1) return;

    const logistics: OutingLogistics = {
      hasDriver,
      driverName: hasDriver ? creatorName : undefined,
      driverId: hasDriver ? currentUserId : undefined,
      vehicleCapacity: hasDriver && typeof vehicleCapacity === 'number' ? vehicleCapacity : undefined,
      fuelSharingPrice: hasDriver && typeof fuelSharingPrice === 'number' ? fuelSharingPrice : undefined,
      isCalculated: hasDriver && typeof fuelSharingPrice === 'number' && fuelSharingPrice > 0,
      costPerPerson: hasDriver && typeof fuelSharingPrice === 'number' && fuelSharingPrice > 0 ? computedCostPerPerson : undefined,
      pickupPoint: hasDriver ? (pickupPointType === 'current' ? 'Current Location' : customPickupPoint) : undefined,
    };

    let coverImage = '';
    if (category === 'Cafes') coverImage = 'arab_cafe_night';
    else if (category === 'Billiards' || category === 'Gaming Sessions') coverImage = 'gaming_pool_lounge';
    else coverImage = 'scenic_night_drive'; // fallbacks

    const mapLocationUrl = googleMapsUrl.trim() || `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}`;

    const newOuting: Outing = {
      id: `outing_${Date.now()}`,
      title,
      description,
      category,
      location,
      city: selectedCity,
      datetime: new Date(datetime).toISOString(),
      creatorId: currentUserId,
      creatorName,
      creatorAvatar,
      creatorTrust,
      maxAttendees: isSoloOuting ? 1 : (typeof maxAttendees === 'number' ? maxAttendees : 4),
      attendeeIds: [currentUserId],
      minTrustScore,
      genderRestriction,
      mapCoordinates: { lat: mapLat, lng: mapLng },
      mapLocationUrl,
      status: 'upcoming',
      logistics,
      coverImage,
      isBlindOuting,
      isPrivate: isSoloOuting ? true : isPrivate,
      invitedUserIds: isPrivate ? invitedUserIds : undefined,
      isSoloOuting,
      budgetEstimate: budgetEstimate || undefined
    };

    onSave(newOuting);
  };

  return (
    <div className="bg-[#0D111A] text-[#F3F4F6] rounded-3xl border border-slate-800/80 p-5 md:p-8 shadow-2xl relative max-w-6xl mx-auto overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Decorative colored glow shapes */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Top Bar */}
      <div className="relative flex justify-between items-start border-b border-slate-800/80 pb-5 mb-6">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🚀</span>
            {t.createTitle}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">{t.createSubtitle}</p>
        </div>
        <button 
          id="btn_close_creator"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
        
      {/* Quick Start Templates Section */}
      <div className="bg-[#161B26] border border-slate-800/60 p-4 rounded-2xl mb-6">
        <div className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5 mb-2.5 tracking-widest uppercase">
          <Globe className="w-3.5 h-3.5 animate-pulse" />
          <span>{lang === 'ar' ? '⚡ نماذج جاهزة للتعبئة السريعة (Quick Start):' : '⚡ Quick Start Templates:'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { id: 'coffee', emoji: '☕', nameAr: 'جلسة قهوة وسوالف', nameEn: 'Coffee Break', color: 'hover:border-amber-500/40 hover:bg-amber-500/10' },
            { id: 'gaming', emoji: '🎮', nameAr: 'تحدي قيمينق وبلياردو', nameEn: 'Gaming Session', color: 'hover:border-indigo-500/40 hover:bg-indigo-500/10' },
            { id: 'drive', emoji: '🚗', nameAr: 'كشتة وفرة ليلية', nameEn: 'Night Drive', color: 'hover:border-sky-500/40 hover:bg-sky-500/10' },
            { id: 'dinner', emoji: '🍔', nameAr: 'تجربة مطعم جديد', nameEn: 'Foodie Meetup', color: 'hover:border-rose-500/40 hover:bg-rose-500/10' }
          ].map((tmpl) => (
            <button
              type="button"
              key={tmpl.id}
              onClick={() => applyQuickTemplate(tmpl.id as 'coffee' | 'gaming' | 'drive' | 'dinner')}
              className={`px-3 py-2.5 bg-[#0D111A] border border-slate-800/70 rounded-xl text-xs font-bold transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 ${tmpl.color} cursor-pointer`}
            >
              <span className="text-sm">{tmpl.emoji}</span>
              <span className="truncate">{lang === 'ar' ? tmpl.nameAr : tmpl.nameEn}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-6 lg:space-y-0 relative z-10">
        
        {/* LEFT COLUMN: Configuration Details */}
        <div className="lg:col-span-7 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.activityTitleLabel}</label>
            <input
              id="input_outing_title"
              type="text"
              required
              placeholder={t.activityTitlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[#161B26] border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.descriptionLabel}</label>
            <textarea
              id="input_outing_desc"
              rows={2}
              placeholder={t.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-[#161B26] border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-white placeholder-slate-500 transition-all"
            />
          </div>

          {/* Category & DateTime Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.categoryLabel}</label>
              <select
                id="select_outing_cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                className="w-full px-3 py-3 bg-[#161B26] border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-white transition-all cursor-pointer"
              >
                {Object.keys(categoryMeta).map((cat) => (
                  <option key={cat} value={cat} className="bg-[#161B26] text-white">
                    {lang === 'ar' ? categoryMeta[cat as ActivityCategory]?.nameAr : cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.dateTimeLabel}</label>
              <div className="relative">
                <Calendar className={`absolute ${lang === 'ar' ? 'right-3.5' : 'left-3.5'} top-3.5 w-4 h-4 text-slate-400`} />
                <input
                  id="input_outing_time"
                  type="datetime-local"
                  required
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className={`w-full ${lang === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-[#161B26] border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-white transition-all`}
                />
              </div>
            </div>
          </div>

          {/* City & Attendees Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.cityLabel}</label>
              <input
                id="select_create_city"
                type="text"
                list="cities_list"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                placeholder={lang === 'ar' ? "أدخل اسم مدينتك..." : "Enter your city..."}
                className="w-full px-4 py-3 bg-[#161B26] border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-white"
              />
              <datalist id="cities_list">
                {displayCitiesList.map((ac) => (
                  <option key={ac.nameEn} value={lang === 'ar' ? ac.nameAr : ac.nameEn}>
                    {lang === 'ar' ? ac.nameAr : ac.nameEn} ({lang === 'ar' ? ac.countryEn === 'Saudi Arabia' ? 'السعودية' : ac.countryEn : ac.countryEn})
                  </option>
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.maxAttendeesLabel}</label>
              <div className="relative">
                <Users className={`absolute ${lang === 'ar' ? 'right-3.5' : 'left-3.5'} top-3.5 w-4 h-4 text-slate-400 ${isSoloOuting ? 'opacity-50' : ''}`} />
                <input
                  id="input_outing_slots"
                  type="number"
                  min={2}
                  max={15}
                  required
                  disabled={isSoloOuting}
                  value={isSoloOuting ? 1 : maxAttendees}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxAttendees(val === '' ? '' : parseInt(val, 10));
                  }}
                  className={`w-full ${lang === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-[#161B26] border border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-white disabled:bg-[#0D111A] disabled:text-slate-500 transition-all`}
                />
              </div>
            </div>
          </div>

          {/* Solo Outing Toggle */}
          <div className="bg-indigo-950/20 border border-indigo-900/50 p-4 rounded-2xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSoloOuting}
                onChange={(e) => setIsSoloOuting(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-700 bg-[#161B26] focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-black text-indigo-300 block">
                  {lang === 'ar' ? '🎯 طلعة شخصية (اخرج لوحدي)' : '🎯 Solo Outing (Go out alone)'}
                </span>
                <span className="text-[10px] text-indigo-400/80 block mt-0.5 leading-relaxed">
                  {lang === 'ar' 
                    ? 'سيتم تفعيل الذكاء الاصطناعي لاقتراح مسار الرحلة، ومراقبة تقدّمك، وتوجيهك باحترافية.' 
                    : 'AI will suggest an itinerary, monitor your progress, and guide your trip.'}
                </span>
              </div>
            </label>
          </div>

          {/* Logistics & Safety Sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Gender restriction selection */}
            <div className="p-4 bg-[#161B26]/60 rounded-2xl border border-slate-800/80">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-widest mb-2">
                {t.genderRestrictionLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  id="restrict_men_btn"
                  disabled={creatorGender === 'female'}
                  onClick={() => setGenderRestriction('men_only')}
                  className={`flex flex-col items-center gap-1 py-1.5 px-1 border rounded-xl transition-all cursor-pointer text-center ${
                    genderRestriction === 'men_only'
                      ? 'border-blue-500/80 bg-blue-500/10 text-blue-400 font-bold'
                      : creatorGender === 'female'
                        ? 'opacity-25 bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                        : 'border-slate-850 bg-[#0D111A] hover:bg-slate-800/50 text-slate-300 font-bold'
                  }`}
                >
                  <span className="text-sm">🧔</span>
                  <span className="text-[8px] tracking-wider uppercase">{lang === 'ar' ? 'الرجال' : 'Men'}</span>
                </button>

                <button
                  type="button"
                  id="restrict_women_btn"
                  disabled={creatorGender === 'male'}
                  onClick={() => setGenderRestriction('women_only')}
                  className={`flex flex-col items-center gap-1 py-1.5 px-1 border rounded-xl transition-all cursor-pointer text-center ${
                    genderRestriction === 'women_only'
                      ? 'border-purple-500/80 bg-purple-500/10 text-purple-400 font-bold'
                      : creatorGender === 'male'
                        ? 'opacity-25 bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                        : 'border-slate-850 bg-[#0D111A] hover:bg-slate-800/50 text-slate-300 font-bold'
                  }`}
                >
                  <span className="text-sm">👩</span>
                  <span className="text-[8px] tracking-wider uppercase">{lang === 'ar' ? 'الإناث' : 'Women'}</span>
                </button>

                <button
                  type="button"
                  id="restrict_co_ed_btn"
                  onClick={() => {
                    if (creatorTrust < 9.0) {
                      alert(lang === 'ar' ? t.coEdDeniedError : t.coEdDeniedError);
                      return;
                    }
                    setGenderRestriction('co_ed');
                  }}
                  className={`flex flex-col items-center gap-1 py-1 px-1 border rounded-xl transition-all cursor-pointer text-center relative overflow-hidden ${
                    genderRestriction === 'co_ed'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold'
                      : 'border-slate-850 bg-[#0D111A] hover:bg-slate-800/50 text-slate-300 font-bold'
                  }`}
                >
                  {creatorTrust < 9.0 && (
                    <div className="absolute top-0 right-0 bg-red-500 text-[6px] text-white font-bold px-0.5 py-0.2 rounded-bl">🔒</div>
                  )}
                  <span className="text-sm">✨</span>
                  <span className="text-[8px] tracking-wider uppercase leading-none">{lang === 'ar' ? 'مشترك' : 'Joint'}</span>
                </button>
              </div>
            </div>

            {/* Trust score requirement */}
            <div className="p-4 bg-[#161B26]/60 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">
                    ★ {t.minTrustRatingFilter}
                  </h4>
                  <p className="text-[8px] text-slate-400">{t.minTrustScoreDesc}</p>
                </div>
                <div className="px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-400 font-mono text-xs font-black">
                  ★ {minTrustScore.toFixed(1)}
                </div>
              </div>
              <input
                id="range_outing_trust"
                type="range"
                min={5.0}
                max={10.0}
                step={0.1}
                value={minTrustScore}
                onChange={(e) => setMinTrustScore(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer my-1.5"
              />
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>★ 5.0</span>
                <span>★ 10.0</span>
              </div>
            </div>
          </div>

          {/* Blind Outing Toggle */}
          <div className="p-4 bg-[#161B26]/40 rounded-2xl border border-slate-800/60">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                id="checkbox_blind_outing"
                type="checkbox"
                checked={isBlindOuting}
                onChange={(e) => setIsBlindOuting(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-800 border-slate-750"
              />
              <div>
                <span className="text-xs font-black text-slate-250 flex items-center gap-1.5">
                  <span>🕶️</span>
                  <span>{lang === 'ar' ? 'طلعة مغلقة / غامضة (Blind Outing)' : 'Blind Outing (Mystery Trip)'}</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                  {lang === 'ar' 
                    ? 'لن يعلم الرفاق بالوجهة مسبقاً، وسيتم توجيههم تباعاً للوجهة عند الاقتراب.' 
                    : 'Destination remains a surprise. Companions receive automated waypoint tips live.'}</p>
              </div>
            </label>
          </div>

          {/* Private Outings Config */}
          <div className="p-4 bg-purple-950/10 border border-purple-900/30 rounded-2xl space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                id="checkbox_private_outing"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => {
                  setIsPrivate(e.target.checked);
                  if (e.target.checked && invitedUserIds.length === 0) {
                    setInvitedUserIds(friendsList);
                  }
                }}
                className="rounded text-purple-500 focus:ring-purple-500 h-4 w-4 bg-slate-800 border-slate-750"
              />
              <div>
                <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                  <span>🔒</span>
                  <span>{lang === 'ar' ? 'دعوات خاصة فقط (للأصدقاء المحددين)' : 'Private Outing (Invited Circle Only)'}</span>
                </span>
                <p className="text-[10px] text-purple-400/80 mt-0.5 leading-normal">
                  {lang === 'ar' 
                    ? 'لن تظهر هذه الطلعة في التغذية العامة للجميع، فقط الأصدقاء المدعوون سيتمكنون من حضورها.' 
                    : 'Hidden from public feed. Only explicitly selected friends can view and participate.'}
                </p>
              </div>
            </label>

            {isPrivate && (
              <div className="pt-2 border-t border-purple-900/30 animate-fadeIn space-y-2">
                <span className="block text-[10px] font-black text-purple-450 uppercase tracking-widest">
                  {lang === 'ar' ? 'اختر الأصدقاء المدعوين:' : 'Select Invited Friends:'}
                </span>
                {friendsList.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">
                    {lang === 'ar' ? 'لم تقم بإضافة رفقاء لدائرتك بعد.' : 'Your friend circle is currently empty.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                    {friendsList.map(friendId => {
                      const friendProfile = allProfiles.find(p => p.id === friendId);
                      if (!friendProfile) return null;
                      const isChecked = invitedUserIds.includes(friendId);
                      return (
                        <label 
                          key={friendId} 
                          className={`flex items-center gap-2 p-1.5 rounded-xl border cursor-pointer transition-all ${
                            isChecked 
                              ? 'bg-purple-650/10 border-purple-800 text-purple-400' 
                              : 'bg-[#161B26]/40 border-slate-800 text-slate-300 hover:bg-[#161B26]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setInvitedUserIds(prev => prev.filter(id => id !== friendId));
                              } else {
                                setInvitedUserIds(prev => [...prev, friendId]);
                              }
                            }}
                            className="rounded text-purple-600 h-3 w-3"
                          />
                          <span className="text-xs select-none">{friendProfile.avatar}</span>
                          <span className="text-[10px] font-black truncate">{friendProfile.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transportation sharing */}
          <div className="p-4 bg-[#161B26]/40 rounded-2xl border border-slate-800/60">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                id="checkbox_outing_driver"
                type="checkbox"
                checked={hasDriver}
                onChange={(e) => setHasDriver(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-slate-800 border-slate-750"
              />
              <div>
                <span className="text-xs font-black text-slate-205 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-emerald-400" />
                  <span>{t.driverCoordinationHeading}</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{t.driverCoordinationDesc}</p>
              </div>
            </label>

            {hasDriver && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800/80 animate-fadeIn">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.riderCapacityLabel}</label>
                  <input
                    id="input_driver_capacity"
                    type="number"
                    min={1}
                    max={7}
                    value={vehicleCapacity}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVehicleCapacity(val === '' ? '' : parseInt(val, 10));
                    }}
                    className="w-full px-2 py-1.5 bg-[#0D111A] border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.fuelCostLabel}</label>
                  <input
                    id="input_driver_fuel"
                    type="number"
                    min={0}
                    value={fuelSharingPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFuelSharingPrice(val === '' ? '' : parseFloat(val));
                    }}
                    className="w-full px-2 py-1.5 bg-[#0D111A] border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.dividedSharingLabel}</label>
                  <div className="px-1.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg text-center mt-0.5">
                    ~ {computedCostPerPerson}
                  </div>
                </div>

                <div className="col-span-3">
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.pickupCoordinatesLabel}</label>
                  <input
                    id="input_driver_pickup"
                    type="text"
                    placeholder={t.pickupPlaceholder}
                    value={pickupPoint}
                    onChange={(e) => setPickupPoint(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0D111A] border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>

                {/* AI Transport Optimizer Interface */}
                <div className="col-span-3 pt-3 border-t border-slate-800/80 mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[9px] font-black text-indigo-400 block tracking-wider uppercase">
                        ⚡ {lang === 'ar' ? 'مُحسّن ومُقسّم البنزين بالذكاء الاصطناعي' : 'AI CO-SHARING & ROUTE OPTIMIZER'}
                      </span>
                      <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                        {lang === 'ar' 
                          ? 'يقوم المُرشد بتحسين توزيع تكاليف البنزين واقتراح مسارات carpool مثالية.' 
                          : 'Al-Murshed analyzes fuel pricing, capacity, and suggests adjustments & express routes.'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleOptimizeTransport}
                      disabled={isOptimizingTransport}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-50 shrink-0 cursor-pointer active:scale-95"
                    >
                      {isOptimizingTransport ? (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 border border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                          {lang === 'ar' ? 'تحليل...' : 'Analyzing...'}
                        </span>
                      ) : (
                        `✨ ${lang === 'ar' ? 'تحسين ذكي' : 'Optimize'}`
                      )}
                    </button>
                  </div>

                  {optimizationError && (
                    <p className="text-[9px] text-rose-400 font-bold mt-2 animate-fadeIn">{optimizationError}</p>
                  )}

                  {showOptimizationResult && transportOptimizationData && (
                    <div className="mt-3 p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[9.5px] font-black text-white uppercase tracking-wider">
                          📋 {lang === 'ar' ? 'نتائج التوصيات والمحاذاة' : 'OPTIMIZER REPORT'}
                        </span>
                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                          -{transportOptimizationData.savingsPercentage}% {lang === 'ar' ? 'توفير' : 'Savings'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2 bg-[#0D111A] rounded-lg border border-white/5">
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">{lang === 'ar' ? 'سعر البنزين الحالي' : 'CURRENT FUEL SHARE'}</span>
                          <span className="text-xs font-black text-slate-300 block mt-0.5">{fuelSharingPrice || 0} SAR</span>
                        </div>
                        <div className="p-2 bg-[#0D111A] rounded-lg border border-indigo-500/20">
                          <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider block">{lang === 'ar' ? 'السعر المقترح للمُرشد' : 'AI RECOMMENDED'}</span>
                          <span className="text-xs font-black text-emerald-400 block mt-0.5">{transportOptimizationData.optimizedFuelPrice} SAR</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black text-indigo-300 uppercase block tracking-wider">{lang === 'ar' ? 'المسار الأمثل المقترح:' : 'OPTIMIZED EXPRESS ROUTE:'}</span>
                        <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                          🛣️ {transportOptimizationData.optimizedRoute}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-amber-400 uppercase block tracking-wider">{lang === 'ar' ? 'نصائح لوجستية ذكية لتقليل الهدر:' : 'AI SMART TIPS TO MINIMIZE WASTAGE:'}</span>
                        <ul className="space-y-1 pl-1">
                          {transportOptimizationData.suggestions.map((s, i) => (
                            <li key={i} className="text-[10px] text-slate-400 leading-relaxed font-semibold flex items-start gap-1">
                              <span>•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => setShowOptimizationResult(false)}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-400 text-[9px] font-black uppercase rounded-lg transition-colors cursor-pointer"
                        >
                          {lang === 'ar' ? 'تجاهل' : 'Dismiss'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFuelSharingPrice(transportOptimizationData.optimizedFuelPrice);
                            setShowOptimizationResult(false);
                            haptic([10, 30, 10]);
                          }}
                          className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer"
                        >
                          ⚡ {lang === 'ar' ? 'تطبيق سعر المُرشد' : 'Apply AI Recommended Price'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Destination Map & Automatic Suggested Venues Selection */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* CRITICAL: PROPOSED MEETING PLACE (Destination) Explanatory Badge */}
          <div className="bg-[#101F20] border border-[#23584E]/50 p-4 rounded-2xl relative overflow-hidden shadow-md">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="flex items-start gap-2.5">
              <span className="text-base">📍</span>
              <div>
                <span className="text-xs font-black text-emerald-400 block uppercase tracking-wider">
                  {lang === 'ar' ? 'موقع الفعالية والمكان المقترح' : 'PROPOSED MEETING DESTINATION'}
                </span>
                <span className="text-[10px] text-[#A7F3D0] block mt-1 leading-relaxed">
                  {lang === 'ar' 
                    ? 'هذا هو موقع المقهى أو الفعالية المقترحة للجميع للالتقاء فيه، وليس موقع بيتك أو موقعك الحالي!' 
                    : 'This is the coordinates & address of the venue where the group gathers, NOT your personal home position!'}
                </span>
              </div>
            </div>
          </div>

          {/* Smart Suggestions UI */}
          <SmartSuggestionsUI
            lang={lang}
            userLat={liveCoords?.[0]}
            userLng={liveCoords?.[1]}
            city={selectedCity}
            country={displayCitiesList.find(c => (lang === 'ar' ? c.nameAr : c.nameEn) === selectedCity)?.countryEn || 'Saudi Arabia'}
            category={category}
            attendees={maxAttendees || 2}
            onSelectPlace={(place) => {
              setLocation(place.name);
              setGoogleMapsUrl(place.url);
              setExtractionStatus('unsupported_short');
              setTitle(lang === 'ar' ? `طلعة ودردشة في ${place.name}` : `Meetup at ${place.name}`);
            }}
          />

          {/* Location / Destination Address Form Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-widest">{t.locationLabel}</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn_snap_to_current"
                  onClick={handleSnapToCurrent}
                  disabled={isGeocoding}
                  className="px-2 py-1 text-[9px] font-black bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg flex items-center gap-1 transition-all border border-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Compass className={`w-3 h-3 ${isGeocoding ? 'animate-spin' : ''}`} />
                  {isGeocoding ? (lang === 'ar' ? 'تحديد...' : 'Locating...') : (lang === 'ar' ? 'موقعي' : 'My Loc')}
                </button>
              </div>
            </div>

            <div className="bg-[#161B26]/60 border border-slate-800/80 p-3 rounded-2xl space-y-3">
              <PlaceAutocompleteInput
                lang={lang}
                defaultValue={location}
                placeholder={lang === 'ar' ? 'ابحث عن مكان (مثل: كافيه، منتزه)...' : 'Search for a place...'}
                onPlaceSelect={(place) => {
                  setLocation(place.name);
                  setMapLat(place.lat);
                  setMapLng(place.lng);
                  setGoogleMapsUrl(place.url);
                  setExtractionStatus('success');
                }}
              />
              
              <div className="flex items-center gap-2 justify-between border-t border-slate-800/80 pt-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location ? (location + ', ' + selectedCity) : selectedCity)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center px-2 py-2 text-[10px] font-black text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 rounded-lg border border-emerald-500/20 transition-all block"
                >
                  🌐 {lang === 'ar' ? 'البحث بخريطة جوجل ↗' : 'Open in Google Maps ↗'}
                </a>
                
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text && (text.includes('google.com/maps') || text.includes('maps.app.goo.gl') || text.includes('goo.gl/maps'))) {
                        handleGoogleMapsUrlChange(text);
                        setLocationStatusMsg(lang === 'ar' ? 'تم جلب الرابط من الحافظة بنجاح!' : 'Link pasted from clipboard!');
                      } else {
                        setLocationStatusMsg(lang === 'ar' ? 'لا يوجد رابط خرائط في الحافظة' : 'No maps link found in clipboard');
                      }
                    } catch (err) {
                      setLocationStatusMsg(lang === 'ar' ? 'يرجى السماح بالوصول للحافظة' : 'Please allow clipboard access');
                    }
                  }}
                  className="flex-1 px-2 py-2 text-[10px] font-black text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 rounded-lg border border-indigo-500/20 transition-all cursor-pointer"
                >
                  📋 {lang === 'ar' ? 'لصق الرابط المنسوخ' : 'Paste Copied Link'}
                </button>
              </div>

              {googleMapsUrl && (
                <div className="mt-2 text-[9px] break-all bg-[#0D111A] p-2 rounded-lg border border-slate-800 text-slate-400">
                  <span className="font-bold text-slate-300 block mb-1">🔗 {lang === 'ar' ? 'الرابط المرفق:' : 'Attached Link:'}</span>
                  {googleMapsUrl}
                </div>
              )}

              {extractionStatus === 'success' && (
                <p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                  ✅ {lang === 'ar' ? 'تم استخلاص الإحداثيات بنجاح!' : 'Coordinates extracted successfully!'}
                </p>
              )}
              {extractionStatus === 'unsupported_short' && (
                <p className="text-[9px] text-indigo-400 font-bold flex items-center gap-1">
                  📌 {lang === 'ar' ? 'تم ربط الرابط المختصر!' : 'Short link attached!'}
                </p>
              )}
            </div>

            {locationStatusMsg && (
              <p className="text-[10px] text-amber-500 font-bold mt-1 flex items-center gap-1">
                ⚠️ {locationStatusMsg}
              </p>
            )}
          </div>

          {/* AI Budget Estimator */}
          <div className="bg-[#161B26] border border-emerald-500/30 rounded-2xl p-4 mb-2 shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <div>
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">{lang === 'ar' ? 'مقدّر الميزانية الذكي' : 'Smart Budget Estimator'}</h4>
                  <p className="text-[9px] text-emerald-500/70">{lang === 'ar' ? 'تقدير ذكي بناءً على المدينة والنشاط وعدد الأشخاص' : 'AI estimation based on city, activity & attendees'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchBudgetEstimate}
                disabled={isEstimatingBudget || !selectedCity || !category}
                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold hover:bg-emerald-500/30 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isEstimatingBudget ? (
                  <Compass className="w-3 h-3 animate-spin" />
                ) : (
                  <span>✨ {lang === 'ar' ? 'احسب الآن' : 'Estimate'}</span>
                )}
              </button>
            </div>

            {budgetEstimate && (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-emerald-500/10">
                <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                  <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'المطاعم' : 'Food'}</span>
                  <span className="text-[10px] font-bold text-white">{budgetEstimate.foodCost}</span>
                </div>
                <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                  <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'القهوة/المشروبات' : 'Drinks'}</span>
                  <span className="text-[10px] font-bold text-white">{budgetEstimate.drinksCost}</span>
                </div>
                <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                  <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'الترفيه' : 'Entertainment'}</span>
                  <span className="text-[10px] font-bold text-white">{budgetEstimate.entertainmentCost}</span>
                </div>
                <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                  <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'الوقود/التنقل' : 'Transit'}</span>
                  <span className="text-[10px] font-bold text-white">{budgetEstimate.fuelCost}</span>
                </div>
                <div className="col-span-2 mt-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex justify-between items-center">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">{lang === 'ar' ? 'الإجمالي التقديري' : 'Estimated Total'}</span>
                  <span className="text-xs font-black text-emerald-300">{budgetEstimate.totalCost}</span>
                </div>
              </div>
            )}
          </div>

          {/* Form Action buttons */}
          <div className="flex items-center gap-3 pt-4">
            <button
              id="btn_cancel_create"
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-xl transition text-center text-xs cursor-pointer border border-slate-700/60"
            >
              {t.cancelProposalBtn}
            </button>
            <button
              id="btn_confirm_create"
              type="submit"
              className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-400 text-black font-black rounded-xl transition text-center text-xs shadow-lg shadow-emerald-500/10 active:scale-95 cursor-pointer"
            >
              {t.confirmProposalBtn}
            </button>
          </div>

        </div>

      </form>
    </div>
  );
}
