import React, { useState, useEffect } from 'react';
import { PlusCircle, Compass, Zap, Users, Sparkles, Bell, Sun, Moon, MapPin, ArrowLeft, MessageSquare, Star, Landmark, Navigation, CalendarRange, Clock, Car, Plus, Trash2, Map, Edit3, Share2 } from 'lucide-react';
import { Language } from '../data/translations';
import PlaceSuggester from './PlaceSuggester';
import AIHomePlanner from './AIHomePlanner';
import CityGuide from './CityGuide';
import ActivityStream from './ActivityStream';
import { Profile, Outing, OutingReview, PendingOperation } from '../types';
import { haptic } from '../lib/haptics';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from '../contexts/LocationContext';
import { getContextualSuggestions, ContextualRecommendation } from '../services/recommendationService';
import { OutingCardSkeleton } from './Skeleton';
import OutingCard from './OutingCard';
import SyncStatusIndicator from './SyncStatusIndicator';
import UserAvatar from './UserAvatar';

interface HomeViewProps {
  lang: Language;
  isOnline: boolean;
  onChangeTab: (tab: 'home' | 'explore' | 'create' | 'reels' | 'profile' | 'messages') => void;
  currentUser: Profile;
  outings?: Outing[];
  companionReviews?: OutingReview[];
  theme?: 'light' | 'dark';
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  notifications?: any[];
  showCityGuide?: boolean;
  onInitiateCreateOuting: (prefill: any) => void;
  onToggleNotifications?: () => void;
  onToggleSocialHub?: () => void;
  onSelectCommunity?: () => void;
  onToggleLang?: () => void;
  onToggleTheme?: () => void;
  onToggleCityGuide?: (val: boolean) => void;
  onSelectOuting?: (outingId: string) => void;
  pendingOps?: PendingOperation[];
  allProfiles?: Profile[];
  onViewProfile?: (userId: string) => void;
}

export default function HomeView({ lang, isOnline, onChangeTab, currentUser, outings = [], companionReviews = [], theme = 'light', unreadMessagesCount = 0, unreadNotificationsCount = 0, notifications = [], showCityGuide = false, onInitiateCreateOuting, onToggleNotifications, onToggleSocialHub, onSelectCommunity, onToggleLang, onToggleTheme,  onToggleCityGuide, 
  onSelectOuting,
  pendingOps = [],
  allProfiles = [],
  onViewProfile
}: HomeViewProps) {
  const isAr = lang === 'ar';
  const [showPlaceSuggester, setShowPlaceSuggester] = useState(false);
  const [showAIOutings, setShowAIOutings] = useState(false);
  const [filterType, setFilterType] = useState<'closest' | 'newest' | 'trust' | 'best_match'>('best_match');
  const [outingFilter, setOutingFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');
  const [trustSafeguardEnabled, setTrustSafeguardEnabled] = useState(false);
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');

  const matchingProfiles = React.useMemo(() => {
    if (!allProfiles || allProfiles.length === 0) return [];
    const myInterests = (currentUser.interests || []).map(i => i.toLowerCase());
    return allProfiles
      .filter(p => p.id !== currentUser.id)
      .map(p => {
        const theirInterests = (p.interests || []).map(i => i.toLowerCase());
        const shared = theirInterests.filter(i => myInterests.includes(i));
        return {
          profile: p,
          sharedCount: shared.length,
          sharedInterests: (p.interests || []).filter(i => myInterests.includes(i.toLowerCase()))
        };
      })
      .filter(item => item.sharedCount > 0)
      .sort((a, b) => b.sharedCount - a.sharedCount)
      .slice(0, 10);
  }, [allProfiles, currentUser]);
  
  const { coords, activeCoords, activeCity, activeCountry, diagnosticWarning, verifyCountryAgainstAccount, error: gpsError, loading: gpsLoading, requestLocation } = useLocation();
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState<boolean>(true);

  useEffect(() => {
    if (currentUser.preferences?.country) {
      verifyCountryAgainstAccount(currentUser.preferences.country);
    }
  }, [currentUser.preferences, verifyCountryAgainstAccount]);

  useEffect(() => {
    let active = true;
    async function loadRecs() {
      // Wait until active coordinates are resolved (GPS or Profile city)
      if (!activeCoords) {
        if (active) setLoadingRecs(false);
        return;
      }
      
      setLoadingRecs(true);
      try {
        let results: ContextualRecommendation[] = [];
        
        try {
          const res = await fetch('/api/outings/smart-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              interests: (currentUser.interests || []).join(', '),
              lang: lang === 'ar' ? 'ar' : 'en',
              lat: activeCoords[0],
              lng: activeCoords[1],
              country: activeCountry,
              locationString: activeCity || currentUser.city || currentUser.location,
              userId: currentUser.id,
              pastOutings: outings.filter(o => o.creatorId === currentUser.id || o.attendeeIds?.includes(currentUser.id))
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (active && data && data.ok && Array.isArray(data.results)) {
              results = data.results.map((p: any) => ({
                id: p.id,
                title: p.title,
                description: p.description,
                socialReasoning: p.socialReasoning,
                category: p.category,
                avgCost: p.avgCost,
                location: p.address || p.name,
                rating: p.rating,
                userRatingCount: p.userRatingCount,
                imageUrl: p.imageUrl,
                distance: p.distanceKm,
                isOpen: p.isOpen,
                lat: p.lat,
                lng: p.lng,
                mapsUrl: p.mapsUrl,
                googleMapsUrl: p.googleMapsUrl
              }));
            }
          }
        } catch (apiErr) {
          console.warn('[HomeView] smart-suggestions API fetch failed, trying local OSM provider:', apiErr);
        }
        
        // 2. Direct client-side osmService fallback if API failed or was unreachable
        if (results.length === 0 && activeCoords) {
          try {
            const { getOSMRecommendations } = await import('../services/osmService');
            const osmPlaces = await getOSMRecommendations(
              activeCoords[0],
              activeCoords[1],
              (currentUser.interests || []).join(', '),
              '',
              lang === 'ar' ? 'ar' : 'en'
            );
            
            results = osmPlaces.map(p => ({
              id: p.id,
              title: p.title,
              description: p.description,
              socialReasoning: p.socialReasoning,
              category: p.category,
              avgCost: p.avgCost,
              location: p.address || p.name,
              rating: p.rating,
              lat: p.latitude,
              lng: p.longitude,
              distance: p.distanceKm
            }));
          } catch (osmErr) {
            console.warn('[HomeView] Local OSM service integration failed:', osmErr);
          }
        }

        if (active) {
          setRecommendations(results);
          setLoadingRecs(false);
        }
      } catch (err) {
        console.error('[HomeView] Load recommendations error:', err);
        if (active) {
          setLoadingRecs(false);
        }
      }
    }

    loadRecs();
    return () => {
      active = false;
    };
  }, [currentUser, activeCoords, activeCity, activeCountry, lang]);

  const [personalizedRecs, setPersonalizedRecs] = useState<any[]>([]);
  const [loadingPersonalized, setLoadingPersonalized] = useState<boolean>(true);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [selectedMood, setSelectedMood] = useState<string>('cozy');

  const fetchPersonalized = async (moodStr?: string) => {
    setLoadingPersonalized(true);
    try {
      const past = (outings || []).filter(o => 
        (o.attendeeIds?.includes(currentUser.id) || o.creatorId === currentUser.id) &&
        new Date(o.datetime) < new Date()
      ).map(o => ({ title: o.title, description: o.description }));

      console.log('[HomeView] Fetching interactive suggestions:', { archetype: currentUser.archetype, mood: moodStr });
      const res = await fetch('/api/outings/personalized-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archetype: currentUser.archetype,
          pastOutings: past,
          lang: lang === 'ar' ? 'ar' : 'en',
          mood: moodStr || ''
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setPersonalizedRecs(data.recommendations || []);
          setActiveSlide(0);
        }
      }
    } catch (err) {
      console.error('Failed to load personalized dynamic suggestions:', err);
    } finally {
      setLoadingPersonalized(false);
    }
  };

  useEffect(() => {
    fetchPersonalized();
  }, [currentUser.archetype, lang, outings]);

  // Haptic Feedback
  const triggerHaptic = (pattern: number | number[] = 20) => {
    try {
      haptic(pattern);
    } catch (e) {
      navigator.vibrate?.(pattern);
    }
  };

  // Day Trip / Itinerary Planner State
  const [plannedItineraries, setPlannedItineraries] = useState<any[]>(() => {
    const cached = localStorage.getItem(`mates_itineraries_${currentUser.id}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.warn('Failed to parse cached itineraries, fallback to default', e);
      }
    }
    const defaultItinerariesEn = [
      {
        id: 'itinerary-1',
        name: 'Dammam Corniche Leisure',
        date: '2026-07-04',
        steps: [
          { time: '10:00 AM', activity: 'Breakfast at Coastal Cafe', location: 'Dammam Corniche', notes: 'Enjoying sea views' },
          { time: '02:00 PM', activity: 'Art Exhibition Visit', location: 'Cultural Center', notes: 'Viewing local paintings' },
          { time: '06:00 PM', activity: 'Sunset Coastal Walk', location: 'Corniche Pathway', notes: 'Golden hour stroll' }
        ],
        transport: {
          type: 'carpool',
          provider: 'Ahmed\'s SUV',
          costSplit: 'Fuel split (approx 15 SAR each)',
          notes: 'Meeting at Corniche Parking Lot A'
        }
      },
      {
        id: 'itinerary-2',
        name: 'Riyadh Boulevard Fun Day',
        date: '2026-07-10',
        steps: [
          { time: '04:00 PM', activity: 'Sightseeing & Photography', location: 'Diriyah ruins', notes: 'Historical Najdi style structures' },
          { time: '07:30 PM', activity: 'Retro Arcade & Gaming', location: 'Boulevard City', notes: 'Fun competition' },
          { time: '10:00 PM', activity: 'Traditional Najdi Dinner', location: 'Najd Village Restaurant', notes: 'Shared family style dining' }
        ],
        transport: {
          type: 'rideshare',
          provider: 'Uber XL',
          costSplit: 'Fare split via app (approx 25 SAR each)',
          notes: 'Pickup at Diriyah gate 1'
        }
      }
    ];

    const defaultItinerariesAr = [
      {
        id: 'itinerary-1',
        name: 'جولة كورنيش الدمام المريحة',
        date: '2026-07-04',
        steps: [
          { time: '10:00 ص', activity: 'فطور في مقهى الكورنيش', location: 'كورنيش الدمام', notes: 'استمتاع بإطلالة البحر الجميلة' },
          { time: '02:00 م', activity: 'زيارة المعرض الفني والمتحف', location: 'المركز الثقافي بالدمام', notes: 'مشاهدة اللوحات التشكيلية المحلية' },
          { time: '06:00 م', activity: 'نزهة الغروب على الممشى البحرى', location: 'ممشى كورنيش الدمام الرئيسي', notes: 'جلسة هادئة أثناء وقت الغروب' }
        ],
        transport: {
          type: 'carpool',
          provider: 'سيارة أحمد الرياضية',
          costSplit: 'تقسيم الوقود بالتساوي (حوالي ١٥ ريال للشخص)',
          notes: 'اللقاء عند مواقف الكورنيش - البوابة أ'
        }
      },
      {
        id: 'itinerary-2',
        name: 'مغامرة البوليفارد والتاريخ بالرياض',
        date: '2026-07-10',
        steps: [
          { time: '04:00 م', activity: 'جولة واستكشاف الدرعية التاريخية', location: 'حي الطريف الأثري بالدرعية', notes: 'التقاط صور ومقاطع للمشروع الأثري الفخم' },
          { time: '07:30 م', activity: 'ألعاب الأركيد الكلاسيكية والبولينج', location: 'بوليفارد سيتي الرياض', notes: 'تحديات حماسية بين الأصدقاء' },
          { time: '10:00 م', activity: 'عشاء نجدي تقليدي لذيذ', location: 'مطعم القرية النجدية الشهير', notes: 'تناول أكلات الكبسة والجريش في جلسة تراثية' }
        ],
        transport: {
          type: 'rideshare',
          provider: 'سيارة أجرة عائلية أو أوبر XL',
          costSplit: 'تقسيم التكلفة عبر التطبيق (حوالي ٢٥ ريال للشخص)',
          notes: 'اللقاء عند البوابة الأولى لحي الطريف بالدرعية'
        }
      }
    ];
    return isAr ? defaultItinerariesAr : defaultItinerariesEn;
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(`mates_itineraries_${currentUser.id}`, JSON.stringify(plannedItineraries));
  }, [plannedItineraries, currentUser.id]);

  const [showItineraryCreator, setShowItineraryCreator] = useState(false);
  const [newItineraryName, setNewItineraryName] = useState('');
  const [newItineraryDate, setNewItineraryDate] = useState('');
  const [newItinerarySteps, setNewItinerarySteps] = useState<any[]>([
    { time: '10:00 AM', activity: '', location: '', notes: '' }
  ]);
  const [newItineraryTransport, setNewItineraryTransport] = useState({
    type: 'carpool',
    provider: '',
    costSplit: '',
    notes: ''
  });

  const handleAddItineraryStep = () => {
    triggerHaptic(15);
    setNewItinerarySteps([...newItinerarySteps, { time: '12:00 PM', activity: '', location: '', notes: '' }]);
  };

  const handleRemoveItineraryStep = (index: number) => {
    triggerHaptic(15);
    setNewItinerarySteps(newItinerarySteps.filter((_, idx) => idx !== index));
  };

  const handleSaveItinerary = () => {
    if (!newItineraryName.trim()) {
      alert(isAr ? 'يرجى إدخال اسم مسار الرحلة.' : 'Please enter a name for the itinerary.');
      return;
    }
    triggerHaptic([30, 80, 30]);
    const nextItinerary = {
      id: 'itinerary-' + Date.now(),
      name: newItineraryName,
      date: newItineraryDate || new Date().toISOString().split('T')[0],
      steps: newItinerarySteps,
      transport: newItineraryTransport
    };
    setPlannedItineraries([nextItinerary, ...plannedItineraries]);
    // Reset Creator
    setNewItineraryName('');
    setNewItineraryDate('');
    setNewItinerarySteps([{ time: '10:00 AM', activity: '', location: '', notes: '' }]);
    setNewItineraryTransport({ type: 'carpool', provider: '', costSplit: '', notes: '' });
    setShowItineraryCreator(false);
  };

  const handleDeleteItinerary = (id: string) => {
    triggerHaptic([40, 40]);
    setPlannedItineraries(plannedItineraries.filter(it => it.id !== id));
  };

  const handleLaunchItinerary = (itinerary: any) => {
    triggerHaptic([50, 100]);
    // format description
    const stepsText = itinerary.steps.map((step: any, index: number) => 
      `${index + 1}. [${step.time}] ${step.activity} @ ${step.location}${step.notes ? ` (${step.notes})` : ''}`
    ).join('\n');
    
    const transTypeStr = itinerary.transport.type === 'carpool' ? (isAr ? 'توصيل مشترك (Carpool)' : 'Carpool (Split fuel)')
                        : itinerary.transport.type === 'rideshare' ? (isAr ? 'سيارة أجرة (Rideshare)' : 'Rideshare / Taxi')
                        : itinerary.transport.type === 'public' ? (isAr ? 'نقل عام (Metro/Bus)' : 'Public Transit')
                        : (isAr ? 'مشي (Walking)' : 'Walking / Active');

    const transportText = `${isAr ? 'المواصلات المشتركة:' : 'Shared Transport:'} ${transTypeStr} - ${itinerary.transport.provider || (isAr ? 'غير محدد' : 'Not specified')} (${itinerary.transport.costSplit || (isAr ? 'مجاني' : 'Free')})`;
    
    const fullDesc = `${isAr ? 'مسار يوم متكامل مسبق التخطيط بالتنسيق المتبادل:' : 'Custom Day Itinerary Outline:'}\n\n${stepsText}\n\n🚙 ${transportText}\n${itinerary.transport.notes ? `${isAr ? 'ملاحظات النقل:' : 'Transport Notes:'} ${itinerary.transport.notes}` : ''}`;
    
    onInitiateCreateOuting({
      title: itinerary.name,
      description: fullDesc,
      category: 'Entertainment',
      location: itinerary.steps[0]?.location || '',
      datetime: itinerary.date ? `${itinerary.date}T12:00` : ''
    });
  };

  // Calendar logic
  const [activeMonth, setActiveMonth] = useState(new Date());
  const myUpcomingOutings = (outings || []).filter(o => 
    (o.attendeeIds?.includes(currentUser.id) || o.creatorId === currentUser.id) && 
    new Date(o.datetime) >= new Date(new Date().setHours(0, 0, 0, 0))
  ).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const { firstDay, daysInMonth } = getDaysInMonth(activeMonth);
  const monthName = activeMonth.toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });

  const changeMonth = (offset: number) => {
    const newDate = new Date(activeMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setActiveMonth(newDate);
  };

  // Process General Outings Feed
  const getDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const availableCities = Array.from(new Set(
    (outings || []).map(o => o.location).filter(Boolean)
  ));

  const currentOutingsIter = [...(outings || [])].filter(o => {
    const now = new Date();
    const outingDate = new Date(o.datetime);
    
    if (trustSafeguardEnabled && (o.minTrustScore || 0) > (currentUser.trustScore || 0)) return false;
    
    if (selectedCityFilter !== 'all' && o.location !== selectedCityFilter) return false;

    if (outingFilter === 'all') return o.status !== 'cancelled';
    
    if (outingFilter === 'upcoming') {
      return o.status === 'upcoming' && outingDate > now;
    }
    if (outingFilter === 'ongoing') {
      return o.status === 'ongoing' || (o.status !== 'completed' && o.status !== 'cancelled' && outingDate <= now);
    }
    if (outingFilter === 'completed') {
      return o.status === 'completed' || outingDate < now;
    }
    return o.status === outingFilter;
  });
  const feedOutings = currentOutingsIter.sort((a, b) => {
    if (filterType === 'newest') {
      const dateA = (a as any).createdAt || a.datetime;
      const dateB = (b as any).createdAt || b.datetime;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    } else if (filterType === 'trust') {
      return (b.creatorTrust || 0) - (a.creatorTrust || 0);
    } else if (filterType === 'closest' && coords) {
      const latA = a.mapCoordinates?.lat || (a as any).latitude;
      const lonA = a.mapCoordinates?.lng || (a as any).longitude;
      const latB = b.mapCoordinates?.lat || (b as any).latitude;
      const lonB = b.mapCoordinates?.lng || (b as any).longitude;
      const distA = getDistance(coords[0], coords[1], latA, lonA);
      const distB = getDistance(coords[0], coords[1], latB, lonB);
      return distA - distB;
    } else if (filterType === 'best_match') {
      let scoreA = getRecommendationScore(a);
      let scoreB = getRecommendationScore(b);
      
      // Also consider distance for best match if coords exist
      if (coords) {
        const latA = a.mapCoordinates?.lat || (a as any).latitude;
        const lonA = a.mapCoordinates?.lng || (a as any).longitude;
        const latB = b.mapCoordinates?.lat || (b as any).latitude;
        const lonB = b.mapCoordinates?.lng || (b as any).longitude;
        const distA = getDistance(coords[0], coords[1], latA, lonA);
        const distB = getDistance(coords[0], coords[1], latB, lonB);
        
        // Closer distance gets higher score boost
        if (distA < 10) scoreA += 10;
        else if (distA < 25) scoreA += 5;
        
        if (distB < 10) scoreB += 10;
        else if (distB < 25) scoreB += 5;
      }
      
      return scoreB - scoreA;
    }
    return 0;
  });

  function getRecommendationScore(outing: Outing) {
    let score = 0;
    const userInterests = (currentUser.interests || []).map(i => i.toLowerCase());
    const archetype = (currentUser.archetype || '').toLowerCase();
    
    // Add score if category matches interests
    if (userInterests.includes((outing.category || '').toLowerCase())) {
      score += 10;
    }
    
    // Add score if description or title matches interests
    const searchString = `${outing.title} ${outing.description}`.toLowerCase();
    userInterests.forEach(interest => {
      if (searchString.includes(interest)) {
        score += 5;
      }
    });

    // Add score for archetype matches
    if (archetype) {
      if (searchString.includes(archetype)) {
        score += 8;
      }
    }
    
    return score;
  };

  const recommendedOutings = [...(outings || [])]
    .filter(o => o.status === 'upcoming' && new Date(o.datetime) > new Date() && o.creatorId !== currentUser.id)
    .sort((a, b) => getRecommendationScore(b) - getRecommendationScore(a))
    .slice(0, 3);

  return (
    <div className="space-y-6 pb-16 top-0 mt-4 px-4" dir={isAr ? 'rtl' : 'ltr'}>
      {diagnosticWarning && (
        <div className="bg-amber-100 border border-amber-200 text-amber-800 p-3 rounded-2xl text-xs font-bold shadow-sm">
          {isAr ? 'تنبيه: تم اكتشاف اختلاف بين موقعك الحالي ودولتك المسجلة.' : 'Alert: Mismatch detected between current location and registered country.'}
        </div>
      )}
      {/* Social / Chat / Requests Top Section */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-4">
        <button onClick={() => onToggleSocialHub?.()} className="flex flex-col items-center gap-1 text-gray-600 hover:text-indigo-600">
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-bold">{isAr ? 'الأصدقاء' : 'Friends'}</span>
        </button>
        <button onClick={() => onToggleSocialHub?.()} className="flex flex-col items-center gap-1 text-gray-600 hover:text-indigo-600 relative">
          <MessageSquare className="w-6 h-6" />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {unreadMessagesCount}
            </span>
          )}
          <span className="text-[10px] font-bold">{isAr ? 'الدردشات' : 'Chats'}</span>
        </button>
        <button onClick={() => onToggleSocialHub?.()} className="flex flex-col items-center gap-1 text-gray-600 hover:text-indigo-600 relative">
          <Bell className="w-6 h-6" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold animate-pulse">
              {unreadNotificationsCount}
            </span>
          )}
          <span className="text-[10px] font-bold">{isAr ? 'الطلبات' : 'Requests'}</span>
        </button>
      </div>

      <div className="flex justify-between items-center mb-8 relative z-10 p-2">
        <div className="text-[12px] font-black text-green-600 font-mono tracking-widest flex items-center gap-2">
          {isAr ? 'يلا طلعنا' : 'YallaMate'}
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}/>
          <SyncStatusIndicator isOnline={isOnline} lang={lang} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-full border border-gray-200 shadow-slate-200/50 hover:shadow-md hover:border-indigo-300 transition-all duration-300 ease-out cursor-pointer">
            <button 
              onClick={onToggleTheme}
              className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-indigo-600 active:scale-95 transition-transform"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </motion.div>
              </AnimatePresence>
            </button>
            <div className="w-[1px] h-5 my-auto bg-gray-200/80"></div>
            <button 
              onClick={onToggleLang}
              className="relative w-9 h-9 flex items-center justify-center text-gray-500 font-bold text-xs hover:text-indigo-600 active:scale-95 transition-all outline-none"
              style={{ perspective: 1000 }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={lang}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  style={{ display: 'inline-block' }}
                >
                  {isAr ? 'EN' : 'AR'}
                </motion.span>
              </AnimatePresence>
              
              <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-[16px] rounded bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[9px] font-mono font-black text-indigo-700 shadow-xs tracking-tighter">
                {isAr ? 'AR' : 'EN'}
              </span>
            </button>
          </div>
          <button 
            onClick={onToggleNotifications}
            className="relative w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
            )}
          </button>
        </div>
      </div>

      {/* AI Archetype & History Smart Suggestions Tool */}
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-5 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/20">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black text-indigo-300 font-mono tracking-widest uppercase block">{isAr ? 'موجّه الماتشينج الذكي' : 'AI SMART OUTING SUGGESTER'}</span>
              <h3 className="text-xs font-black text-white">{isAr ? 'تحليل نمطك وسجل الأنشطة' : 'Archetype & History Analyzer'}</h3>
            </div>
          </div>
          <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-black font-mono">
            {currentUser.archetype ? (currentUser.archetype.split(' (')[0]) : (isAr ? 'مستكشف' : 'Explorer')}
          </span>
        </div>

        {/* Mood Selector Chips */}
        <div className="mb-4">
          <span className="text-[10px] font-black text-indigo-300 font-mono tracking-widest uppercase block mb-2">
            {isAr ? '١. اختر طابع الفعالية المفضل:' : '1. SELECT PREFERRED VIBE:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'cozy', labelAr: "☕ هادئ ومريح", labelEn: "☕ Cozy & Calm" },
              { id: 'active', labelAr: "🎮 حماس وألعاب", labelEn: "🎮 Gaming & Fun" },
              { id: 'nature', labelAr: "🌳 طبيعة وهواء", labelEn: "🌳 Nature & Park" },
              { id: 'dining', labelAr: "🍽️ عشاء وأكل", labelEn: "🍽️ Food & Dining" },
              { id: 'intellectual', labelAr: "💡 نقاش وفكر", labelEn: "💡 Brainy Talk" }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  triggerHaptic();
                  setSelectedMood(m.id);
                }}
                className={`text-[10px] font-bold py-1.5 px-3 rounded-full transition-all cursor-pointer ${
                  selectedMood === m.id
                    ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300'
                    : 'bg-white/10 text-indigo-100 hover:bg-white/15'
                }`}
              >
                {isAr ? m.labelAr : m.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Trigger */}
        <div className="mb-4 flex items-center justify-between border-t border-white/5 pt-3">
          <p className="text-[10px] text-indigo-200 font-medium">
            {isAr ? '٢. استشير مدرب علاقات الذكاء الاصطناعي:' : '2. CONSULT AI SOCIAL COACH:'}
          </p>
          <button
            onClick={() => {
              triggerHaptic();
              fetchPersonalized(selectedMood);
            }}
            disabled={loadingPersonalized}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-black px-4.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isAr ? 'توليد فكرة طلعة 🪄' : 'Generate Concept 🪄'}
          </button>
        </div>

        {loadingPersonalized ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3 border-t border-white/5">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] text-indigo-300 font-medium">
              {isAr ? 'جارٍ تحليل توافقات نمطك وسجلك...' : 'Analyzing your archetype history...'}
            </p>
          </div>
        ) : personalizedRecs.length === 0 ? (
          <div className="py-4 text-center border-t border-white/5">
            <p className="text-xs text-indigo-200">
              {isAr ? 'لم نجد طلعات كافية في السجل للتحليل بعد.' : 'Not enough outing history to run dynamic analysis.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 border-t border-white/5 pt-4">
            <AnimatePresence mode="wait">
              {personalizedRecs.map((rec, idx) => {
                if (idx !== activeSlide) return null;
                return (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300 bg-amber-400/15 py-0.5 px-2 rounded-lg border border-amber-400/20 flex items-center gap-1.5">
                        🌟 {rec.matchScore} {isAr ? 'توافق' : 'Match Score'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">
                        ⏱️ {rec.duration} • {rec.category}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white">{rec.title}</h4>
                      <p className="text-xs text-indigo-100/95 leading-relaxed">{rec.concept}</p>
                    </div>

                    <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-[10.5px] text-indigo-200/95 leading-relaxed font-semibold">
                      <p>✨ <strong className="text-white">{isAr ? 'رؤية المدرب الذكي:' : 'Smart Coach Insight:'}</strong> {rec.analysisInsight}</p>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-1">
                        {personalizedRecs.map((_, dotIdx) => (
                          <button 
                            key={dotIdx}
                            onClick={() => setActiveSlide(dotIdx)}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${dotIdx === activeSlide ? 'bg-indigo-400 w-3' : 'bg-white/20'}`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          triggerHaptic();
                          onInitiateCreateOuting({
                            title: rec.title.replace(/^[^\w\s\u0600-\u06FF]+/g, '').trim(),
                            category: rec.category === 'Cafe' ? 'Cafes' : rec.category === 'Park' ? 'Parks' : 'Entertainment',
                            description: rec.concept
                          });
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 text-[10.5px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                      >
                        🚀 {isAr ? 'خطط هذه الطلعة' : 'Launch Outing'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Multi-Activity Day Trip & Transport Planner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden mt-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/20">
              <Map className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-black text-emerald-400 font-mono tracking-widest uppercase block">
                {isAr ? 'منظم جولات اليوم المتكاملة' : 'MULTI-ACTIVITY TRIP PLANNER'}
              </span>
              <h3 className="text-xs font-black text-white">
                {isAr ? 'مسارات الفعاليات والتنقل المشترك' : 'Day Itinerary & Shared Transport'}
              </h3>
            </div>
          </div>
          
          {!showItineraryCreator && (
            <button
              onClick={() => {
                triggerHaptic();
                setShowItineraryCreator(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-black py-1.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? 'إنشاء مسار يوم' : 'New Day Trip'}
            </button>
          )}
        </div>

        {showItineraryCreator ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <h4 className="text-[10px] font-black text-indigo-300 font-mono tracking-widest uppercase">
                {isAr ? '١. تفاصيل الرحلة الأساسية:' : '1. GENERAL TRIP INFO:'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {isAr ? 'اسم الرحلة / اليوم:' : 'Trip/Day Name:'}
                  </label>
                  <input
                    type="text"
                    value={newItineraryName}
                    onChange={(e) => setNewItineraryName(e.target.value)}
                    placeholder={isAr ? 'مثال: نزهة الجمعة العائلية' : 'e.g. Friday Coast Crawl'}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {isAr ? 'تاريخ اليوم:' : 'Target Date:'}
                  </label>
                  <input
                    type="date"
                    value={newItineraryDate}
                    onChange={(e) => setNewItineraryDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-indigo-300 font-mono tracking-widest uppercase">
                  {isAr ? '٢. الفعاليات والأنشطة المتتالية:' : '2. SEQUENTIAL ACTIVITIES:'}
                </h4>
                <button
                  onClick={handleAddItineraryStep}
                  className="bg-white/10 hover:bg-white/20 text-white text-[9px] font-black px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  {isAr ? 'إضافة محطة' : 'Add Stop'}
                </button>
              </div>

              <div className="space-y-3">
                {newItinerarySteps.map((step, idx) => (
                  <div key={idx} className="bg-black/30 p-3 rounded-xl border border-white/5 relative space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-black px-2 py-0.5 rounded-full">
                        {isAr ? `المحطة ${idx + 1}` : `STOP #${idx + 1}`}
                      </span>
                      {newItinerarySteps.length > 1 && (
                        <button
                          onClick={() => handleRemoveItineraryStep(idx)}
                          className="text-rose-400 hover:text-rose-300 text-[10px] font-bold p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-0.5">{isAr ? 'الوقت المقدر:' : 'Time Estimate:'}</label>
                        <input
                          type="text"
                          value={step.time}
                          onChange={(e) => {
                            const updated = [...newItinerarySteps];
                            updated[idx].time = e.target.value;
                            setNewItinerarySteps(updated);
                          }}
                          placeholder="e.g. 10:00 AM"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-0.5">{isAr ? 'النشاط/الفعالية:' : 'Activity Title:'}</label>
                        <input
                          type="text"
                          value={step.activity}
                          onChange={(e) => {
                            const updated = [...newItinerarySteps];
                            updated[idx].activity = e.target.value;
                            setNewItinerarySteps(updated);
                          }}
                          placeholder={isAr ? 'فطور، مقهى، ألعاب، إلخ' : 'e.g. Traditional Najdi Lunch'}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-0.5">{isAr ? 'اسم المكان / اللوكيشن:' : 'Location name:'}</label>
                        <input
                          type="text"
                          value={step.location}
                          onChange={(e) => {
                            const updated = [...newItinerarySteps];
                            updated[idx].location = e.target.value;
                            setNewItinerarySteps(updated);
                          }}
                          placeholder={isAr ? 'مثال: مطعم القرية النجدية' : 'e.g. Najd Village, Riyadh'}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={step.notes}
                        onChange={(e) => {
                          const updated = [...newItinerarySteps];
                          updated[idx].notes = e.target.value;
                          setNewItinerarySteps(updated);
                        }}
                        placeholder={isAr ? 'ملاحظات إضافية لهذه المحطة...' : 'Optional notes (e.g. reserve a table in advance)...'}
                        className="w-full bg-black/20 border border-white/5 rounded-lg px-2.5 py-1 text-[10.5px] text-slate-300 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
              <h4 className="text-[10px] font-black text-indigo-300 font-mono tracking-widest uppercase">
                {isAr ? '٣. خطة المواصلات والنقل المشترك:' : '3. SHARED TRANSPORT PLANNING:'}
              </h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'carpool', label: isAr ? '🚗 سيارة مشتركة' : '🚗 Carpool' },
                  { id: 'rideshare', label: isAr ? '🚕 تكسي / أوبر' : '🚕 Rideshare' },
                  { id: 'public', label: isAr ? '🚌 نقل عام' : '🚌 Transit' },
                  { id: 'walking', label: isAr ? '🚶‍♂️ مشي' : '🚶‍♂️ Walking' }
                ].map((tOpt) => (
                  <button
                    key={tOpt.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setNewItineraryTransport({ ...newItineraryTransport, type: tOpt.id });
                    }}
                    className={`text-[10px] font-bold py-2 px-3 rounded-xl transition-all cursor-pointer border ${
                      newItineraryTransport.type === tOpt.id
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-black/40 text-slate-300 border-white/5 hover:bg-black/60'
                    }`}
                  >
                    {tOpt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[9px] text-slate-400 font-bold block mb-1">
                    {isAr ? 'السائق / وسيلة النقل المسؤولة:' : 'Driver/Vehicle Host or Line name:'}
                  </label>
                  <input
                    type="text"
                    value={newItineraryTransport.provider}
                    onChange={(e) => setNewItineraryTransport({ ...newItineraryTransport, provider: e.target.value })}
                    placeholder={isAr ? 'مثال: سيارة أحمد، أو قطار المسار الأخضر' : 'e.g. Khalid\'s SUV or Metro Line 3'}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 font-bold block mb-1">
                    {isAr ? 'طريقة تقسيم التكاليف البترولية/الأجرة:' : 'Fuel / Fare Split Arrangement:'}
                  </label>
                  <input
                    type="text"
                    value={newItineraryTransport.costSplit}
                    onChange={(e) => setNewItineraryTransport({ ...newItineraryTransport, costSplit: e.target.value })}
                    placeholder={isAr ? 'مثال: تقسيم البنزين بالتساوي، مجاني' : 'e.g. Split equally (approx 15 SAR each)'}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[9px] text-slate-400 font-bold block mb-1">
                  {isAr ? 'تعليمات لقاء التنقل وملاحظات هامة:' : 'Meeting/Pickup notes & guidelines:'}
                </label>
                <input
                  type="text"
                  value={newItineraryTransport.notes}
                  onChange={(e) => setNewItineraryTransport({ ...newItineraryTransport, notes: e.target.value })}
                  placeholder={isAr ? 'مثال: اللقاء عند المواقف العامة في الكورنيش البوابة أ الساعة ٩:٤٥' : 'e.g. Meet at general parking lot A by 9:45 AM before taking off'}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  triggerHaptic();
                  setShowItineraryCreator(false);
                }}
                className="bg-white/10 hover:bg-white/15 text-white text-[10px] font-black px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveItinerary}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-black px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                {isAr ? 'حفظ مسار اليوم 💾' : 'Save Itinerary 💾'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {plannedItineraries.length === 0 ? (
              <div className="py-6 text-center text-slate-500">
                <p className="text-xs italic">{isAr ? 'لا توجد مسارات مخططة حالياً. ابدأ بإضافة مسارك الأول!' : 'No custom itineraries planned yet. Create your first sequential day trip!'}</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                {plannedItineraries.map((itinerary: any) => (
                  <div key={itinerary.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3.5 relative hover:border-emerald-500/20 transition-all">
                    <button
                      onClick={() => handleDeleteItinerary(itinerary.id)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                      title={isAr ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div>
                      <span className="text-[9px] bg-slate-800 text-slate-300 font-mono px-2.5 py-1 rounded-full font-black uppercase">
                        📅 {itinerary.date}
                      </span>
                      <h4 className="text-sm font-black text-white mt-1.5">{itinerary.name}</h4>
                    </div>

                    {/* Timeline stops */}
                    <div className="space-y-3 pl-2.5 border-l-2 border-emerald-500/40 relative ml-1.5">
                      {itinerary.steps?.map((step: any, stepIdx: number) => (
                        <div key={stepIdx} className="relative">
                          {/* Dot */}
                          <div className="absolute -left-[16px] top-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-slate-900" />
                          
                          <div className="text-[11px]">
                            <span className="font-mono text-emerald-400 font-black">{step.time}</span>
                            <span className="text-slate-400 mx-1.5">•</span>
                            <strong className="text-white font-black">{step.activity}</strong>
                            <span className="text-slate-400 text-[10px] block font-medium">📍 {step.location}</span>
                            {step.notes && (
                              <p className="text-[10px] text-indigo-200 mt-0.5 leading-relaxed italic">
                                "{step.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Transport details box */}
                    <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                          <Car className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-wider">
                            {isAr ? 'المواصلات والنقل المشترك' : 'SHARED TRANSPORT'}
                          </span>
                          <span className="text-[10px] font-black text-indigo-300">
                            {itinerary.transport?.type?.toUpperCase()} : {itinerary.transport?.provider || (isAr ? 'غير محدد' : 'No driver')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right sm:text-right text-[10px] font-semibold text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                        <span className="text-slate-400 text-[9px] block uppercase font-mono">{isAr ? 'تقسيم التكلفة' : 'COST SPLIT'}</span>
                        {itinerary.transport?.costSplit || (isAr ? 'مجاني / تطوعي' : 'Free')}
                      </div>
                    </div>

                    {itinerary.transport?.notes && (
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed bg-white/5 p-2 rounded-xl">
                        💡 <strong className="text-slate-300">{isAr ? 'تعليمات:' : 'Guidelines:'}</strong> {itinerary.transport.notes}
                      </p>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleLaunchItinerary(itinerary)}
                        className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black px-4.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        {isAr ? 'إطلاق كطلعة جماعية مشروطة 🚀' : 'Launch Joint Outing 🚀'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Suggested Outings Section */}
      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>{isAr ? 'مقترحات ذكية مخصصة' : 'Contextual Suggestions'}</span>
          </h2>
          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
            {isAr ? 'محدث حيّاً' : 'Live Matches'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {gpsError && !activeCoords ? (
            <div className="bg-red-50 border border-red-100 p-6 rounded-3xl text-center space-y-3">
               <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-xs text-red-700 font-bold max-w-[250px] mx-auto leading-relaxed">
                {isAr ? 'عذرًا، يرجى تفعيل الموقع (GPS) أو تحديد مدينتك في الملف الشخصي للحصول على اقتراحات' : 'Please enable GPS or set your profile city to receive suggestions.'}
                <br /><span className="font-normal opacity-80 mt-1 block">{gpsError}</span>
              </p>
              <button 
                onClick={() => requestLocation(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm shadow-red-200 mt-2"
              >
                {isAr ? 'تحديث الموقع الجغرافي' : 'Update Location'}
              </button>
            </div>
          ) : !activeCoords ? (
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl text-center space-y-3">
               <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500 animate-pulse">
                <Navigation className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-black text-slate-800">
                {isAr ? 'الرجاء تحديد مدينة أو تفعيل الـ GPS' : 'Please select a city or enable GPS'}
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                {isAr ? 'لتزويدك بأفضل الأماكن والأنشطة المقترحة، يرجى تفعيل الموقع أو تحديد مدينتك المفضلة من حسابك الشخصي.' : 'To get custom suggestions, please enable GPS or choose your preferred city in your profile.'}
              </p>
            </div>
          ) : loadingRecs ? (
            <>
              <OutingCardSkeleton />
              <OutingCardSkeleton />
            </>
          ) : recommendations.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl text-center">
              <p className="text-xs text-slate-500">
                {isAr ? 'لا توجد مقترحات ذكية متاحة حاليا.' : 'No suggestions available at the moment.'}
              </p>
            </div>
          ) : (
            recommendations.map((rec, i) => (
              <motion.div 
                key={rec.id || `rec-${i}`} 
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-4"
                whileHover={{ scale: 1.01 }}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-full font-black text-slate-700 uppercase tracking-wider">
                      📍 {rec.category}
                    </span>
                    {rec.rating && (
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5 fill-current" /> {rec.rating.toFixed(1)} 
                        {rec.userRatingCount && ` (${rec.userRatingCount})`}
                      </span>
                    )}
                    {rec.distance && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Navigation className="w-2.5 h-2.5" /> {(rec.distance / 1000).toFixed(1)} km
                      </span>
                    )}
                    {rec.isOpen !== undefined && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rec.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {rec.isOpen ? (lang === 'ar' ? 'مفتوح' : 'Open') : (lang === 'ar' ? 'مغلق' : 'Closed')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-4 items-start">
                    {rec.imageUrl && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-100 shadow-sm relative">
                        <img src={rec.imageUrl} alt={rec.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-black text-slate-900">{rec.title}</h3>
                      <p className="text-[10px] text-slate-500 font-medium mb-1"><MapPin className="w-2.5 h-2.5 inline" /> {rec.location}</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">{rec.description}</p>
                    </div>
                  </div>

                  {rec.socialReasoning && (
                    <div className="text-[10px] text-indigo-700 bg-indigo-50/70 py-1.5 px-3 rounded-xl inline-flex items-center gap-1.5 font-bold border border-indigo-100/30">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>{rec.socialReasoning}</span>
                    </div>
                  )}
                </div>

                <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 min-w-[120px]">
                  <span className="text-[11px] font-black text-emerald-600 font-mono bg-emerald-50 px-2.5 py-1 rounded-full">
                    {rec.avgCost}
                  </span>
                  
                  <div className="flex flex-col gap-1.5 w-full">
                    <button 
                      onClick={() => { 
                        triggerHaptic(); 
                        onInitiateCreateOuting({
                          title: rec.title.replace(/^[^\w\s\u0600-\u06FF]+/g, '').trim(),
                          location: rec.title,
                          category: rec.category === 'cafe' ? 'Cafes' : rec.category === 'park' ? 'Parks' : 'Entertainment',
                          description: rec.description
                        }); 
                      }} 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs shadow-indigo-100 flex-1 w-full flex items-center justify-center gap-1"
                    >
                      🚀 {lang === 'ar' ? 'خطط طلعة' : 'Plan Outing'}
                    </button>
                    {(rec.mapsUrl || rec.googleMapsUrl) && (
                      <a 
                        href={rec.googleMapsUrl || rec.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black px-4 py-1.5 rounded-xl transition-all cursor-pointer flex-1 w-full flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPin className="w-3 h-3" /> {lang === 'ar' ? 'الموقع' : 'Maps'}
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Activity Stream Component */}
      <ActivityStream 
        notifications={notifications}
        outings={outings}
        currentUser={currentUser}
        lang={lang}
        onSelectOuting={onSelectOuting}
      />

      {/* Monthly Calendar View */}
      <div className="mb-8 overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 rounded-full transition-colors cursor-pointer text-gray-500">
               {isAr ? '›' : '‹'}
            </button>
            <h2 className="text-sm font-black text-gray-900 min-w-[120px] text-center">
               {monthName}
            </h2>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 rounded-full transition-colors cursor-pointer text-gray-500">
               {isAr ? '‹' : '›'}
            </button>
          </div>
          <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">{isAr ? 'جدول المواعيد' : 'Outing Tracker'}</span>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {(isAr ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, i) => (
              <div key={`weekday-${i}`} className="text-center text-[10px] font-black text-gray-400 uppercase py-1">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${activeMonth.getFullYear()}-${String(activeMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasOuting = outings.some(o => o.datetime?.startsWith(dateStr));
              const isToday = new Date().toISOString().startsWith(dateStr);
              
              return (
                <div 
                  key={day}
                  onClick={() => {
                    if (hasOuting) {
                      // Maybe set a filter or scroll to next upcoming
                    } else {
                      onInitiateCreateOuting({ datetime: dateStr });
                    }
                  }}
                  className={`h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer relative group ${
                    isToday 
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-100 ring-offset-2' 
                      : hasOuting 
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {day}
                  {hasOuting && (
                    <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-400'}`} />
                  )}
                  
                  {/* Subtle Tooltip style popover on hover if outing exists */}
                  {hasOuting && (
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 bg-slate-900 text-white p-2 rounded-lg text-[9px] w-24 pointer-events-none animate-in fade-in slide-in-from-bottom-1">
                       {(outings || []).filter(o => o.datetime?.startsWith(dateStr)).map(o => o.title).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {myUpcomingOutings.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{isAr ? 'أقرب نشاط' : 'Up Next'}</h3>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 flex justify-between items-center cursor-pointer hover:bg-indigo-100/50 transition">
              <div>
                <h4 className="text-sm font-black text-indigo-900">{myUpcomingOutings[0].title}</h4>
                <p className="text-[10px] text-indigo-700/80 font-bold mt-0.5">{new Date(myUpcomingOutings[0].datetime).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', {hour: '2-digit', minute: '2-digit'})} • {myUpcomingOutings[0].location}</p>
              </div>
              <span className="bg-white text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black border border-indigo-100">
                {isAr ? 'التفاصيل' : 'View'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {/* Explore Outings */}
        <button 
          onClick={() => onChangeTab('explore')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-6 text-right transition-all flex flex-col items-start text-left cursor-pointer group shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-gray-900 mb-2">{isAr ? 'استكشف الطلعات' : 'Explore Outings'}</h3>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            {isAr ? 'تصفح الطلعات المتاحة، ابحث بالفلاتر واكتشف أنشطة جديدة في مدينتك.' : 'Browse available outings, search with filters, and discover new activities in your city.'}
          </p>
        </button>

        {/* Suggest a Place */}
        <button 
          onClick={() => setShowPlaceSuggester(true)}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-6 text-right transition-all flex flex-col items-start text-left cursor-pointer group shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
            {isAr ? 'اقترح مكان للطلعه' : "Suggest a Place"}
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">AI</span>
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            {isAr ? 'دع الذكاء الاصطناعي يقترح لك أفضل الأماكن والرفقاء للطلعة بضغطة زر.' : 'Let AI suggest the best spots and buddies for your outing instantly.'}
          </p>
        </button>

        {/* City Guide */}
        <button 
          onClick={() => onToggleCityGuide?.(true)}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-6 text-right transition-all flex flex-col items-start text-left cursor-pointer group shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
            {isAr ? 'دليل مدينتك' : 'City Explorer'}
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">AI</span>
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            {isAr ? 'استكشف المقاهي، السينمات والملاعب في مدينتك المدعومة بالذكاء الاصطناعي وخرائط جوجل.' : 'Explore cafes, cinemas, and gyms in your city powered by AI and Google Maps.'}
          </p>
        </button>
      </div>

      {/* Mates with Shared Interests Section */}
      {matchingProfiles.length > 0 && (
        <section className="mt-8 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-black text-slate-800 dark:text-white">
                {isAr ? 'أشخاص لديهم اهتمامات مشتركة' : 'Mates with Shared Interests'}
              </h2>
            </div>
            <span className="text-[10px] text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-full font-bold">
              {isAr ? 'متوافقين معك' : 'Perfect Match'}
            </span>
          </div>

          <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            {matchingProfiles.map(({ profile, sharedCount, sharedInterests }) => (
              <motion.div
                key={profile.id}
                whileHover={{ scale: 1.02 }}
                className="min-w-[240px] sm:min-w-[260px] snap-center bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 p-4 rounded-3xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between"
                onClick={() => onViewProfile?.(profile.id)}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar avatar={profile.avatar} className="w-12 h-12 border-2 border-indigo-100 dark:border-indigo-950" />
                    <div className="text-right sm:text-left">
                      <h4 className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1">
                        {profile.name}
                        {profile.verified && <span className="text-[10px] text-blue-500">✓</span>}
                      </h4>
                      <span className="text-[10px] text-gray-400 block">{profile.location || (isAr ? 'المملكة العربية السعودية' : 'Saudi Arabia')}</span>
                    </div>
                  </div>

                  {profile.archetype && (
                    <div className="text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md w-fit uppercase">
                      💡 {profile.archetype.split(' (')[0]}
                    </div>
                  )}

                  {/* Shared Interests badges */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 block font-bold">
                      {isAr ? `اهتمامات مشتركة (${sharedCount}):` : `Mutual Interests (${sharedCount}):`}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sharedInterests.slice(0, 3).map((interest, idx) => (
                        <span key={idx} className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg font-bold">
                          {interest}
                        </span>
                      ))}
                      {sharedInterests.length > 3 && (
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-lg font-bold">
                          +{sharedInterests.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/40 flex items-center justify-between">
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline flex items-center gap-1">
                    {isAr ? 'عرض الحساب 👤' : 'View Profile 👤'}
                  </div>
                  {profile.trustScore && (
                    <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md">
                      ★ {profile.trustScore.toFixed(1)}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended for You Section */}
      {recommendedOutings.length > 0 && (
        <section className="mt-8 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-black text-slate-800 dark:text-white">
              {isAr ? 'موصى بها لك' : 'Recommended for You'}
            </h2>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-none">
            {recommendedOutings.map((outing, idx) => (
              <div key={outing.id} className="min-w-[85vw] sm:min-w-[300px] snap-center">
                <OutingCard
                  outing={outing}
                  currentUserTrustScore={currentUser.trustScore || 5}
                  onSelect={() => onSelectOuting?.(outing.id)}
                  onCategoryClick={() => setFilterType('newest')}
                  lang={lang}
                  companionReviews={companionReviews}
                  index={idx}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* General Browse / Feed area directly embedded below the tiles */}
      <section className="mt-8 pt-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-500" />
              {isAr ? 'الطلعات الحالية المتاحة' : 'Current Open Outings'}
            </h2>
            <select
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              className="ml-2 px-3 py-1.5 text-xs font-bold rounded-lg border bg-white border-slate-200 text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">{isAr ? 'كل المدن' : 'All Cities'}</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <button
              onClick={() => setTrustSafeguardEnabled(!trustSafeguardEnabled)}
              className={`ml-2 px-3 py-1.5 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${trustSafeguardEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              title={isAr ? 'إخفاء الطلعات التي تفوق موثوقيتك' : 'Hide outings that exceed your trust score'}
            >
              <span className={`w-2 h-2 rounded-full ${trustSafeguardEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
              {isAr ? 'درع الموثوقية' : 'Trust Safeguard'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              {['all', 'upcoming', 'ongoing', 'completed'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setOutingFilter(filter as any)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap ${outingFilter === filter ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setFilterType('best_match')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${filterType === 'best_match' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                {isAr ? 'التطابق الذكي' : 'Smart Match'}
              </button>
              <button
                onClick={() => setFilterType('newest')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${filterType === 'newest' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                {isAr ? 'الأحدث' : 'Newest'}
              </button>
              <button
                onClick={() => setFilterType('closest')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${filterType === 'closest' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                {isAr ? 'الأقرب' : 'Closest'}
              </button>
              <button
                onClick={() => setFilterType('trust')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${filterType === 'trust' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                {isAr ? 'الموثوقية' : 'Trust'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {feedOutings.length === 0 ? (
            <div className="col-span-full py-12 px-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 border-dashed">
              <Compass className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-base font-black text-slate-800 dark:text-slate-200 mb-2">
                {isAr ? 'لا توجد نتائج' : 'No outings found'}
              </h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {outingFilter === 'upcoming' 
                  ? (isAr ? 'لا توجد طلعات قادمة حالياً. كن أول من يخطط واحدة!' : 'No upcoming outings yet. Be the first to plan one!')
                  : outingFilter === 'ongoing'
                    ? (isAr ? 'لا توجد طلعات جارية الآن.' : 'No ongoing outings at this moment.')
                    : outingFilter === 'completed'
                      ? (isAr ? 'لا توجد طلعات مكتملة في السجل.' : 'No completed outings in your history.')
                      : (isAr ? 'لا توجد طلعات حالية بهذا التصنيف.' : 'No outings found for this filter.')
                }
              </p>
            </div>
          ) : (
            feedOutings.map((outing, idx) => (
              <OutingCard
                key={outing.id}
                outing={outing}
                currentUserTrustScore={currentUser.trustScore || 5}
                onSelect={() => onSelectOuting?.(outing.id)}
                onCategoryClick={() => setFilterType('newest')}
                lang={lang}
                companionReviews={companionReviews}
                index={idx}
              />
            ))
          )}
        </div>
      </section>

      {showPlaceSuggester && (
        <div className="fixed inset-0 bg-[#0B0E14]/90 backdrop-blur-md z-[60] overflow-y-auto">
          <div className="max-w-xl mx-auto my-10 p-4 relative animate-in fade-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowPlaceSuggester(false)}
              className="absolute top-6 left-6 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors z-[70] cursor-pointer"
            >
              ✕
            </button>
            <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 relative overflow-hidden">
               <PlaceSuggester 
                 currentUser={currentUser} 
                 lang={lang} 
                 onSelectPrefillForOuting={(prefill) => {
                   setShowPlaceSuggester(false);
                   onInitiateCreateOuting(prefill);
                 }} 
               />
            </div>
          </div>
        </div>
      )}

      {showCityGuide && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full flex justify-between items-center bg-white border-b px-4 py-4 sticky top-0 z-[70] shadow-sm">
            <button 
              onClick={() => onToggleCityGuide?.(false)}
              className="bg-gray-100 px-4 py-2 rounded-full flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-200 transition-colors font-bold text-sm cursor-pointer"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              {isAr ? 'رجوع' : 'Back'}
            </button>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-500" />
              {isAr ? 'دليل مدينتك' : 'City Explorer'}
            </h2>
          </div>
          <div className="flex-1 overflow-hidden relative bg-gray-50 flex">
             <CityGuide 
               currentUser={currentUser} 
               lang={lang} 
               outings={outings}
               companionReviews={companionReviews}
               onSelectOuting={onSelectOuting || (() => {})}
             />
          </div>
        </div>
      )}
    </div>
  );
}
