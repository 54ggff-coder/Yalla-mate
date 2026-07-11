export interface LocalIntent {
  category: string;
  searchQuery: string;
  overpassTag: string;
  defaultIntent: string;
  emoji: string;
  defaultPrefix: string;
}

export function detectLocalIntent(interests: string, mood: string, lang: 'en' | 'ar'): LocalIntent {
  const fullText = `${interests || ''} ${mood || ''}`.toLowerCase();
  const isAr = lang === 'ar';

  let category = 'cafe';
  let searchQuery = 'specialty coffee cafe';
  let overpassTag = 'amenity=cafe';
  let defaultIntent = isAr ? 'البحث عن أفضل مقاهي القهوة المختصة والجلسات المريحة' : 'Seeking comfortable and cozy specialty coffee cafes in the area';
  let emoji = '☕';
  let defaultPrefix = isAr ? 'جلسة روقان دافئة في' : 'Cosy gathering at';

  if (
    fullText.includes('game') || 
    fullText.includes('play') || 
    fullText.includes('billiard') || 
    fullText.includes('العاب') || 
    fullText.includes('لعب') || 
    fullText.includes('بلياردو') ||
    fullText.includes('ترفيه') ||
    fullText.includes('تسلية')
  ) {
    category = 'gaming';
    searchQuery = 'billiards gaming lounge';
    overpassTag = 'leisure=sports_centre';
    defaultIntent = isAr ? 'البحث عن صالات الألعاب والترفيه التنافسية والحماسية' : 'Looking for engaging gaming salons or billiards halls nearby';
    emoji = '🎱';
    defaultPrefix = isAr ? 'تحدي حماسي وصداقة في' : 'Exciting competitive match at';
  } else if (
    fullText.includes('park') || 
    fullText.includes('garden') || 
    fullText.includes('outdoor') || 
    fullText.includes('walk') || 
    fullText.includes('حديقة') || 
    fullText.includes('ممشى') || 
    fullText.includes('مشي') ||
    fullText.includes('طبيعة') ||
    fullText.includes('هواء')
  ) {
    category = 'park';
    searchQuery = 'public park garden';
    overpassTag = 'leisure=park';
    defaultIntent = isAr ? 'البحث عن المسطحات الخضراء والحدائق والممشى في الهواء الطلق' : 'Searching for beautiful outdoor parks and green spaces to stroll';
    emoji = '🎯';
    defaultPrefix = isAr ? 'جولة مميزة في' : 'Pleasant walks at';
  } else if (
    fullText.includes('mall') || 
    fullText.includes('shop') || 
    fullText.includes('تسوق') || 
    fullText.includes('مول') || 
    fullText.includes('مركز')
  ) {
    category = 'mall';
    searchQuery = 'shopping mall';
    overpassTag = 'shop=mall';
    defaultIntent = isAr ? 'البحث عن أفضل مراكز التسوق والمولات القريبة' : 'Looking for premier shopping malls and lifestyle destinations nearby';
    emoji = '🛍️';
    defaultPrefix = isAr ? 'جولة تسوق وترفيه في' : 'Shopping outing at';
  } else if (
    fullText.includes('cinema') || 
    fullText.includes('movie') || 
    fullText.includes('سينما') || 
    fullText.includes('فيلم') ||
    fullText.includes('افلام')
  ) {
    category = 'cinema';
    searchQuery = 'movie cinema theater';
    overpassTag = 'amenity=cinema';
    defaultIntent = isAr ? 'البحث عن صالات السينما ومسارح الأفلام القريبة' : 'Searching for movie screens and cinematic avenues nearby';
    emoji = '🎬';
    defaultPrefix = isAr ? 'عرض ممتع وأفلام في' : 'Cinematic viewing at';
  } else if (
    fullText.includes('gym') || 
    fullText.includes('fitness') || 
    fullText.includes('sport') || 
    fullText.includes('نادي') || 
    fullText.includes('لياقة') || 
    fullText.includes('رياضة') ||
    fullText.includes('تمرين')
  ) {
    category = 'gym';
    searchQuery = 'fitness gym sports center';
    overpassTag = 'amenity=gym';
    defaultIntent = isAr ? 'البحث عن الصالات الرياضية ومراكز اللياقة البدنية والأنشطة الصحية' : 'Searching for fitness venues and sports gyms nearby';
    emoji = '💪';
    defaultPrefix = isAr ? 'تمرين ونشاط صحي في' : 'Healthy workout at';
  } else if (
    fullText.includes('food') || 
    fullText.includes('restaurant') || 
    fullText.includes('eat') || 
    fullText.includes('مطعم') || 
    fullText.includes('غداء') || 
    fullText.includes('عشاء') ||
    fullText.includes('أكل')
  ) {
    category = 'restaurant';
    searchQuery = 'restaurant';
    overpassTag = 'amenity=restaurant';
    defaultIntent = isAr ? 'البحث عن المطاعم الراقية وتجربة طعام فريدة' : 'Searching for delicious restaurants and culinary experiences';
    emoji = '🍽️';
    defaultPrefix = isAr ? 'وجبة لذيذة في' : 'Culinary experience at';
  }

  return { category, searchQuery, overpassTag, defaultIntent, emoji, defaultPrefix };
}
