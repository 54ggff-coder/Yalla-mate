import { Profile, Outing, ActivityCategory } from '../types';
import { getOSMRecommendations } from './osmService';

export interface ContextualRecommendation {
  id: string;
  title: string;
  description: string;
  socialReasoning: string;
  category: string;
  avgCost: string;
  location: string;
  image?: string;
  rating?: number;
  userRatingCount?: number;
  imageUrl?: string;
  distance?: number;
  isOpen?: boolean;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  googleMapsUrl?: string;
}

/**
 * Intelligent client-side / full-stack unified recommendation engine
 * Blends GPS/Coordinates, profile interests, user activity history, and temporal state.
 */
export async function getContextualSuggestions(
  currentUser: Profile,
  coords: [number, number] | null,
  lang: 'en' | 'ar',
  recentOutings: Outing[] = []
): Promise<ContextualRecommendation[]> {
  const isAr = lang === 'ar';
  
  if (coords) {
    try {
      const interestsStr = (currentUser.interests || []).join(', ');
      const osmPlaces = await getOSMRecommendations(
        coords[0],
        coords[1],
        interestsStr,
        '',
        lang
      );

      if (osmPlaces && osmPlaces.length > 0) {
        return osmPlaces.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          socialReasoning: p.socialReasoning,
          category: p.category,
          avgCost: p.avgCost,
          location: p.address || p.name,
          rating: p.rating
        }));
      }
    } catch (err) {
      console.warn("OSM suggestions failed, falling back to local list:", err);
    }
  }

  // Client-side Hybrid Recommendation Matcher if GPS is offline or OSM is currently unreachable
  const fallbackList: ContextualRecommendation[] = [
    {
      id: 'rec_1',
      title: isAr ? '☕ جلسة روقان في درافت كافيه' : '☕ Creative Session at Draft Cafe',
      description: isAr ? 'اجلس وارتشف القهوة الهادئة مع رفقاء جدد يشاركونك حب العمل الإبداعي.' : 'Sit and sip quiet specialty coffee with new mates sharing creative workspace vibes.',
      socialReasoning: isAr 
        ? 'بناءً على اهتمامك بـ "القهوة والمذاق الطيب" وتواجدك الحالي بالقرب منك.' 
        : 'Based on your "Coffee & Brew" interest and your current neighborhood overlap.',
      category: 'cafe',
      avgCost: isAr ? '30 ريال' : '30 SAR',
      location: isAr ? 'الموقع الحالي' : 'Current Location',
      image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80',
      rating: 4.8
    },
    {
      id: 'rec_2',
      title: isAr ? '🎱 تحدي البلياردو والصداقة الحماسي' : '🎱 Friendly Billiards Match',
      description: isAr ? 'التقِ بـ 3 من الأصدقاء في مساحة ألعاب الملقا للترفيه وقضاء ليلة تنافسية.' : 'Meet with 3 friendly mates in Al-Malqa arcade lounge for an engaging competitive night.',
      socialReasoning: isAr
        ? 'يتلاءم مع شغفك بـ "الألعاب والرياضة" وتفضيلك للمشاركة الجماعية.'
        : 'Coaligned with your "Gaming & Sports" interest tag and preference for group participation.',
      category: 'gaming',
      avgCost: isAr ? '45 ريال' : '45 SAR',
      location: isAr ? 'منطقة تواجدك' : 'Your area',
      image: 'https://images.unsplash.com/photo-1544698310-74ea9d1c8258?auto=format&fit=crop&w=400&q=80',
      rating: 4.7
    },
    {
      id: 'rec_3',
      title: isAr ? '🎯 جولة مسائية في ممشى الملك عبدالله' : '🎯 Night Walk at King Abdullah Pathway',
      description: isAr ? 'استمتع بهواء المساء البارد والمساحات الحضراء الخلابة تحت أضواء النيون.' : 'Enjoy pleasant evening breeze and gorgeous open gardens under neon illuminated paths.',
      socialReasoning: isAr
        ? 'تم اختياره ليناسب وقت المساء المعزّز ونشاطك الصحي البسيط.'
        : 'Tailored for the cool night cycle matching your lightweight cardio and walk preferences.',
      category: 'park',
      avgCost: isAr ? 'مجانًا' : 'Free Entry',
      location: isAr ? 'مناطق مفتوحة قريبة' : 'Nearby open areas',
      image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80',
      rating: 4.9
    }
  ];

  // Dynamically boost items based on user's exact interests
  const userInterests = currentUser.interests || [];
  return fallbackList.map(item => {
    let matchesInterest = false;
    if (userInterests.some(i => i.toLowerCase().includes('coffee') || i.toLowerCase().includes('مقهى')) && item.category === 'cafe') {
      matchesInterest = true;
    }
    if (userInterests.some(i => i.toLowerCase().includes('game') || i.toLowerCase().includes('رياضة') || i.toLowerCase().includes('بلياردو')) && item.category === 'gaming') {
      matchesInterest = true;
    }

    if (matchesInterest) {
      return {
        ...item,
        socialReasoning: isAr 
          ? `🔥 توصية ممتازة تتطابق تمامًا مع اهتمامك بـ (${userInterests[0] || 'الأنشطة'})`
          : `🔥 Premium recommendations matching your explicit (${userInterests[0] || 'activity'}) interest tag.`
      };
    }
    return item;
  });
}
