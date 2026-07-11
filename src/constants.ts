/**
 * @license
 * Copyright (c) 2026 Ali Fouad Al-Khidir Salem (علي فؤاد الخضر سالم). All rights reserved.
 * Protected Code.
 */

import { ActivityCategory } from './types';

// Activity Category descriptions and icons
export const categoryMeta: Record<ActivityCategory, { icon: string; nameAr: string; desc: string }> = {
  Restaurants: { icon: '🍽️', nameAr: 'المطاعم', desc: 'Fine dining, dynamic burger spots, traditional Arabian feasts' },
  Cafes: { icon: '☕', nameAr: 'المقاهي', desc: 'Specialty coffee, quiet study setups, board game corners' },
  'Shopping Malls': { icon: '🛍️', nameAr: 'المراكز التجارية', desc: 'Shopping expeditions, major sales, food court tours' },
  Parks: { icon: '🌳', nameAr: 'الحدائق', desc: 'Sunset talks, picnics, outdoor walking & relaxation' },
  Cinema: { icon: '🍿', nameAr: 'السينما', desc: 'Latest Blockbusters, IMAX, popcorn sessions' },
  Bowling: { icon: '🎳', nameAr: 'البولينج', desc: 'Strikes and fun competitive group matches' },
  Billiards: { icon: '🎱', nameAr: 'البلياردو', desc: 'Precision pool, chill background music, tactical play' },
  Football: { icon: '⚽', nameAr: 'كرة القدم', desc: 'Friendly match ups, pitch rentals, dynamic tournaments' },
  'Sports Activities': { icon: '🏋️', nameAr: 'الأنشطة الرياضية', desc: 'Gym sessions, running groups, paddle tennis, hiking' },
  'Supermarket Shopping': { icon: '🛒', nameAr: 'التسوق المنزلي', desc: 'Bulky household grocery hauls, smart purchasing' },
  'Clothes Shopping': { icon: '👕', nameAr: 'تسوق الملابس', desc: 'Style advice outings, trying seasonal trends together' },
  'City Tours': { icon: '🚗', nameAr: 'جولات المدينة', desc: 'Scenic sunset drives, dynamic sightseeing, road cruises' },
  'Gaming Sessions': { icon: '🎮', nameAr: 'جلسات الجيمنج', desc: 'Arcades, VR battles, cooperative PC cafe match ups' },
  'Study Sessions': { icon: '📚', nameAr: 'جلسات الدراسة', desc: 'Quiet workspaces, code pairing, exams revision' },
  'Group Gatherings': { icon: '👥', nameAr: 'تجمعات المجموعات', desc: 'Fireside camps, dynamic boardgame nights, custom themes' },
  'Custom Activities': { icon: '✨', nameAr: 'نشاط مخصص', desc: 'Any fun adventure, unique plan, or spontaneous outing' },
  'Outdoor Adventures': { icon: '🌲', nameAr: 'مغامرات خارجية', desc: 'Outdoor adventures, hiking, or camping trips' },
};

// Personality Quiz Configuration
export interface QuizQuestion {
  id: number;
  questionEn: string;
  questionAr: string;
  options: {
    textEn: string;
    textAr: string;
    archetypeScore: Record<string, number>;
  }[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    questionEn: 'How do you prefer starting your weekend outings?',
    questionAr: 'كيف تفضل أن تبدأ طلعة عطلة نهاية الأسبوع؟',
    options: [
      {
        textEn: 'Grabbing a high-quality coffee and discussing new ideas.',
        textAr: 'تناول كوب قهوة جيدة ومناقشة أفكار وتجارب جديدة.',
        archetypeScore: { 'The Coffee Connoisseur': 3, 'The Quiet Reader': 1 }
      },
      {
        textEn: 'Spontaneous night drives with upbeat music and city sights.',
        textAr: 'جولات قيادة ليلية مع موسيقى حماسية وإطلالة على معالم ومشاريع المدينة.',
        archetypeScore: { 'The Cruiser Driver': 3, 'The Social Catalyst': 1 }
      },
      {
        textEn: 'Booking a football pitch or bowling lane with high-energy friends.',
        textAr: 'حجز ملعب كرة قدم أو ممر بولينج مع أصدقاء ذوي طاقة عالية.',
        archetypeScore: { 'The Active Athlete': 3, 'The Hyperactive Gamer': 1 }
      },
      {
        textEn: 'Exploring aesthetic quiet library corners or historical venues.',
        textAr: 'استكشاف الأركان الهادئة والجميلة في المكتبات أو المواقع التاريخية.',
        archetypeScore: { 'The Quiet Reader': 3, 'The Coffee Connoisseur': 1 }
      }
    ]
  },
  {
    id: 2,
    questionEn: 'When it comes to coordination and billing splits, how do you manage?',
    questionAr: 'أثناء تجميع وتنسيق الدفع لحساب الطلعة، كيف تتصرف عادةً؟',
    options: [
      {
        textEn: 'I like a crystal-clear automatic fuel and ticket division on app.',
        textAr: 'أفضل تقسيمًا تلقائيًا واضحًا ومباشرًا لتكاليف البنزين والتذاكر.',
        archetypeScore: { 'The Cruiser Driver': 2, 'The Active Athlete': 2, 'The Coffee Connoisseur': 2 }
      },
      {
        textEn: 'I am generous - I usually volunteer to cover some extras or treat people.',
        textAr: 'أنا كريم - غالبًا ما أتطوع لتغطية بعض الإضافات أو استضافة زملائي.',
        archetypeScore: { 'The Social Catalyst': 3, 'The Coffee Connoisseur': 1 }
      },
      {
        textEn: 'Strictly split to the last penny, very organized and logical.',
        textAr: 'تقسيم دقيق وعادل للغاية حتى لآخر هللة/قرش، مُنظَم جداً وعقلاني.',
        archetypeScore: { 'The Quiet Reader': 2, 'The Hyperactive Gamer': 2 }
      }
    ]
  },
  {
    id: 3,
    questionEn: 'What is your ideal group size for an adventure out?',
    questionAr: 'ما هو حجم المجموعة المثالي لك في طلعات المغامرة؟',
    options: [
      {
        textEn: 'One-on-one or tiny circles (2-3 people max) for deep chats.',
        textAr: 'شخصين إلى ثمانية حد أقصى (تجمعات صغيرة) للنقاشات العميقة والهادئة.',
        archetypeScore: { 'The Quiet Reader': 3, 'The Coffee Connoisseur': 2 }
      },
      {
        textEn: 'Medium-sized crew (4-6 people) for energetic games like bowling or pool.',
        textAr: 'مجموعة متوسطة الحجم (4-6 أشخاص) لألعاب نشيطة مثل البولينج أو البلياردو.',
        archetypeScore: { 'The Hyperactive Gamer': 3, 'The Active Athlete': 2 }
      },
      {
        textEn: 'Large assemblies and gatherings to build massive connections.',
        textAr: 'اللقاءات والتجمعات الكبيرة لبناء شبكة واسعة جداً من العلاقات المتنوعة.',
        archetypeScore: { 'The Social Catalyst': 3, 'The Cruiser Driver': 1 }
      }
    ]
  },
  {
    id: 4,
    questionEn: 'If someone in the group is running late, what is your reaction?',
    questionAr: 'إذا تأخر أحد أفراد المجموعة عن موعد اللقاء، ما هي ردة فعلك؟',
    options: [
      {
        textEn: 'We should verify via active chat, safety and understanding is first.',
        textAr: 'يجب التأكد من سلامته عبر الشات النشط، الأمان والتفاهم أولًا.',
        archetypeScore: { 'The Cruiser Driver': 2, 'The Social Catalyst': 2 }
      },
      {
        textEn: 'Time is gold. Punctuality affects our reputation scoring.',
        textAr: 'الوقت كذهب. الالتزام بالموعد هو الأهم ويؤثر على نقاط الموثوقية.',
        archetypeScore: { 'The Active Athlete': 3, 'The Quiet Reader': 2 }
      },
      {
        textEn: 'No worries! I am sipping my coffee, enjoy the flow.',
        textAr: 'لا داعي للقلق! أستمتع بارتشاف قهوتي بانتظار الجميع دون عجلة.',
        archetypeScore: { 'The Coffee Connoisseur': 3, 'The Hyperactive Gamer': 1 }
      }
    ]
  },
  {
    id: 5,
    questionEn: 'What is your favorite pastime hobby?',
    questionAr: 'ما هي هوايتك المفضلة لقضاء وقت الفراغ؟',
    options: [
      {
        textEn: 'Specialty coffee brewing & intellectual reading.',
        textAr: 'إعداد وتذوق القهوة المختصة والقراءة الثقافية.',
        archetypeScore: { 'The Coffee Connoisseur': 3, 'The Quiet Reader': 1 }
      },
      {
        textEn: 'Desert fireside camping & road cruises.',
        textAr: 'الرحلات البرية وشبات النار وجولات القيادة الليلية.',
        archetypeScore: { 'The Cruiser Driver': 3, 'The Social Catalyst': 1 }
      },
      {
        textEn: 'Group esport matches & arcades.',
        textAr: 'تحديات الألعاب الإلكترونية الجماعية وصالات الجيمنج.',
        archetypeScore: { 'The Hyperactive Gamer': 3, 'The Active Athlete': 1 }
      }
    ]
  },
  {
    id: 6,
    questionEn: 'What is your ultimate favorite food to share with companions?',
    questionAr: 'ما هو طبقك المفضل الذي تحب مشاركته مع الرفاق في الطلعة؟',
    options: [
      {
        textEn: 'French pastries and matcha/single-origin coffee.',
        textAr: 'المخبوزات الفرنسية الفاخرة والماتشا أو القهوة المقطرة.',
        archetypeScore: { 'The Coffee Connoisseur': 3, 'The Quiet Reader': 1 }
      },
      {
        textEn: 'Traditional luxury feasts like Kabsa, Mandi, or Mansaf.',
        textAr: 'الولائم اللذيذة مثل الكبسة أو المندي أو المنسف لتجمع الرفاق.',
        archetypeScore: { 'The Cruiser Driver': 2, 'The Social Catalyst': 3 }
      },
      {
        textEn: 'Smash burgers & crispy fries.',
        textAr: 'البرجر المفضل والبطاطس المقرمشة في المقاهي والمطاعم المزدحمة بالشباب.',
        archetypeScore: { 'The Hyperactive Gamer': 2, 'The Active Athlete': 3 }
      }
    ]
  },
  {
    id: 7,
    questionEn: 'What is your favorite playground or active field space?',
    questionAr: 'ما الذي يمثل ساحتك أو ملعبك الترفيهي المفضل؟',
    options: [
      {
        textEn: 'Indoor tactical Billiards & Bowling clubs.',
        textAr: 'طاولات البلياردو الهادئة أو مسارات البولينج الجماعية.',
        archetypeScore: { 'The Hyperactive Gamer': 2, 'The Coffee Connoisseur': 2 }
      },
      {
        textEn: 'Professional grass football or padel tennis courts.',
        textAr: 'الملاعب العشبية الكبيرة لكرة القدم أو التسلية بمباريات تنس الباديل الرياضية.',
        archetypeScore: { 'The Active Athlete': 3 }
      },
      {
        textEn: 'Symmetrical study libraries & historical museum lobbies.',
        textAr: 'المكتبات الأكاديمية وصالات المتاحف التاريخية والحدائق العريقة.',
        archetypeScore: { 'The Quiet Reader': 3 }
      }
    ]
  },
  {
    id: 8,
    questionEn: 'While driving, whom do you prefer to listen to?',
    questionAr: 'من تفضل تشغيل أغانيه والاستماع له أثناء جولات السيارة؟',
    options: [
      {
        textEn: 'Rashed Al-Majed (Upbeat travel rhythms & classic vibes).',
        textAr: 'راشد الماجد (إيقاعات السفر والقيادة الحماسية والمطربة).',
        archetypeScore: { 'The Cruiser Driver': 3, 'The Social Catalyst': 1 }
      },
      {
        textEn: 'Talal Maddah (Charming oud notes & deep calm performance).',
        textAr: 'طلال مداح (عذوبة أوتار العود والهدوء الفلسفي الساحر).',
        archetypeScore: { 'The Coffee Connoisseur': 2, 'The Quiet Reader': 3 }
      }
    ]
  },
  {
    id: 9,
    questionEn: 'Are you a Madridist or Barcelonist?',
    questionAr: 'في تشجيع كلاسيكو كرة القدم، هل تميل لبرشلونة أم ريال مدريد؟',
    options: [
      {
        textEn: 'Hala Madrid (Royal dominant spirit & goal drive).',
        textAr: 'مدريدي (المشجع الملكي الروح التنافسية الشرسة وتحقيق الانتصارات).',
        archetypeScore: { 'The Active Athlete': 3, 'The Cruiser Driver': 1 }
      },
      {
        textEn: 'Visca Barca (Artistic coordination, tikitaka teamwork).',
        textAr: 'برشلوني (اللعب الفني الجميل والانسجام التكتيكي والتمريرات السريعة).',
        archetypeScore: { 'The Social Catalyst': 2, 'The Hyperactive Gamer': 2 }
      }
    ]
  }
];

// Presets of Outing Archetypes Info (Arabic and English translations)
export const OutingArchetypes: Record<string, { descEn: string; descAr: string; quoteEn: string; quoteAr: string; color: string }> = {
  'The Coffee Connoisseur': {
    descEn: 'A fan of cozy atmosphere, deep intellectual banter, and fine brew. Likes quiet, classy activities.',
    descAr: 'عاشق للجلسات والأجواء اللطيفة الدافئة، النقاشات العميقة المريحة والقهوة الفاخرة المقطرة.',
    quoteEn: '“Coffee is code for cozy memories and genuine chats.”',
    quoteAr: '«الطلعة الناجحة تبدأ من رائحة البن ونقاش يغير يومك.»',
    color: 'amber'
  },
  'The Cruiser Driver': {
    descEn: 'Enjoys nighttime drives through glowing modern avenues and likes picking up companions to share fuel costs efficiently.',
    descAr: 'يستمتع بقيادة سيارته ومشاركة جولات وتجوالات الطرق الليلية والطقس اللطيف مع منسقين ممتازين لتوفير تكلفة الوقود.',
    quoteEn: '“The road tells the best stories, fuel cost splits make it perfect.”',
    quoteAr: '«الشارع يروي أجمل القصص، وتقاسم تكلفة البنزين يجعله رائعًا ومستدامًا.»',
    color: 'blue'
  },
  'The Hyperactive Gamer': {
    descEn: 'Thrives in gaming zones, bowling, pool tables, and VR arenas. High fun, pure gaming spirit.',
    descAr: 'ينشط في صالات الألعاب والبولينج وطاولات البلياردو والواقع الافتراضي حماس لا يتوقف وأجواء ترفيهية متكاملة.',
    quoteEn: '“Life is a co-op mission. Let’s beat the high score today.”',
    quoteAr: '«الحياة مهمة تعاونية، هيا بنا نحرز أعلى الدرجات وهزيمة التحديات كفريق!»',
    color: 'emerald'
  },
  'The Quiet Reader': {
    descEn: 'Prefers serene study locations, historical museums, and calm botanical scenery. Very respectful and safe.',
    descAr: 'يفضل البيئات التعليمية والأكاديمية الهادئة والمواقع الأثرية ومصاحبة رفاق ملتزمين بالهدوء والإبداع.',
    quoteEn: '“Quiet spaces allow real connections and shared learning to grow.”',
    quoteAr: '«المساحات الهادئة تسمح بنمو الروابط الحقيقية والتعلم التبادلي.»',
    color: 'indigo'
  },
  'The Active Athlete': {
    descEn: 'Loves friendly matches (football, padel tennis), high fitness routines, and high punctuality scores.',
    descAr: 'يعشق مواعد اللياقة ومباريات كرة القدم والباديل. يلتزم تماماً بالثواني ويركز على الروح الرياضية الدقيقة.',
    quoteEn: '“Punctual arrival is the first requirement of any winning team.”',
    quoteAr: '«الوصول المنضبط في الوقت هو التكتيك الأول في أي فريق رابح.»',
    color: 'green'
  },
  'The Social Catalyst': {
    descEn: 'Master of large group vibes, full of active joy. Always proposing cinema trips, food tours, or large barbecues.',
    descAr: 'خبير في تجمعات المجموعات الكبيرة المفعمة بالمرح والسرور. كاتب سيناريوهات طلعات تجمع الأفلام والمآدب الحافلة.',
    quoteEn: '“The more the merrier! Every face is a potential long-term mate.”',
    quoteAr: '«البركة بالكثرة! كل رفيق تلتقي به اليوم قد يكون أفضل صديق لك غداً.»',
    color: 'rose'
  }
};

export interface CountryCode {
  code: string;
  nameEn: string;
  nameAr: string;
}

export const countryCodes: CountryCode[] = [
  { code: '+966', nameEn: 'Saudi Arabia', nameAr: 'السعودية' },
  { code: '+971', nameEn: 'UAE', nameAr: 'الإمارات' },
  { code: '+20', nameEn: 'Egypt', nameAr: 'مصر' },
  { code: '+962', nameEn: 'Jordan', nameAr: 'الأردن' },
  { code: '+965', nameEn: 'Kuwait', nameAr: 'الكويت' },
  { code: '+974', nameEn: 'Qatar', nameAr: 'قطر' },
  { code: '+968', nameEn: 'Oman', nameAr: 'عمان' },
  { code: '+973', nameEn: 'Bahrain', nameAr: 'البحرين' },
  { code: '+964', nameEn: 'Iraq', nameAr: 'العراق' },
  { code: '+212', nameEn: 'Morocco', nameAr: 'المغرب' },
  { code: '+213', nameEn: 'Algeria', nameAr: 'الجزائر' },
  { code: '+961', nameEn: 'Lebanon', nameAr: 'لبنان' },
  { code: '+216', nameEn: 'Tunisia', nameAr: 'تونس' },
  { code: '+970', nameEn: 'Palestine', nameAr: 'فلسطين' },
  { code: '+249', nameEn: 'Sudan', nameAr: 'السودان' },
  { code: '+967', nameEn: 'Yemen', nameAr: 'اليمن' },
];

export interface ArabCity {
  nameEn: string;
  nameAr: string;
  countryEn: string;
}

export const arabCitiesList: ArabCity[] = [
  // Saudi Arabia
  { nameEn: 'Riyadh', nameAr: 'الرياض', countryEn: 'Saudi Arabia' },
  { nameEn: 'Jeddah', nameAr: 'جدة', countryEn: 'Saudi Arabia' },
  { nameEn: 'Mecca', nameAr: 'مكة المكرمة', countryEn: 'Saudi Arabia' },
  { nameEn: 'Medina', nameAr: 'المدينة المنورة', countryEn: 'Saudi Arabia' },
  { nameEn: 'Dammam', nameAr: 'الدمام', countryEn: 'Saudi Arabia' },
  { nameEn: 'Khobar', nameAr: 'الخبر', countryEn: 'Saudi Arabia' },
  { nameEn: 'Abha', nameAr: 'أبها', countryEn: 'Saudi Arabia' },
  { nameEn: 'Tabuk', nameAr: 'تبوك', countryEn: 'Saudi Arabia' },
  { nameEn: 'Taif', nameAr: 'الطائف', countryEn: 'Saudi Arabia' },
  { nameEn: 'Buraidah', nameAr: 'بريدة', countryEn: 'Saudi Arabia' },
  { nameEn: 'Al-Ahsa', nameAr: 'الأحساء', countryEn: 'Saudi Arabia' },
  { nameEn: 'Ha\'il', nameAr: 'حائل', countryEn: 'Saudi Arabia' },
  { nameEn: 'Jazan', nameAr: 'جازان', countryEn: 'Saudi Arabia' },
  { nameEn: 'Najran', nameAr: 'نجران', countryEn: 'Saudi Arabia' },
  { nameEn: 'Al-Jouf', nameAr: 'الجوف', countryEn: 'Saudi Arabia' },
  { nameEn: 'Al-Baha', nameAr: 'الباحة', countryEn: 'Saudi Arabia' },
  { nameEn: 'Yanbu', nameAr: 'ينبع', countryEn: 'Saudi Arabia' },
  { nameEn: 'Jubail', nameAr: 'الجبيل', countryEn: 'Saudi Arabia' },
  { nameEn: 'Qatif', nameAr: 'القطيف', countryEn: 'Saudi Arabia' },
  { nameEn: 'Arar', nameAr: 'عرعر', countryEn: 'Saudi Arabia' },
  { nameEn: 'Sakaka', nameAr: 'سكاكا', countryEn: 'Saudi Arabia' },
  { nameEn: 'Qurayyat', nameAr: 'القريات', countryEn: 'Saudi Arabia' },
  { nameEn: 'Unaizah', nameAr: 'عنيزة', countryEn: 'Saudi Arabia' },
  // UAE
  { nameEn: 'Dubai', nameAr: 'دبي', countryEn: 'UAE' },
  { nameEn: 'Abu Dhabi', nameAr: 'أبوظبي', countryEn: 'UAE' },
  { nameEn: 'Sharjah', nameAr: 'الشارقة', countryEn: 'UAE' },
  { nameEn: 'Al Ain', nameAr: 'العين', countryEn: 'UAE' },
  { nameEn: 'Ajman', nameAr: 'عجمان', countryEn: 'UAE' },
  { nameEn: 'Ras Al Khaimah', nameAr: 'رأس الخيمة', countryEn: 'UAE' },
  { nameEn: 'Fujairah', nameAr: 'الفجيرة', countryEn: 'UAE' },
  { nameEn: 'Umm Al Quwain', nameAr: 'أم القيوين', countryEn: 'UAE' },
  { nameEn: 'Khor Fakkan', nameAr: 'خورفكان', countryEn: 'UAE' },
  // Egypt (Expanded Complete List)
  { nameEn: 'Cairo', nameAr: 'القاهرة', countryEn: 'Egypt' },
  { nameEn: 'Alexandria', nameAr: 'الإسكندرية', countryEn: 'Egypt' },
  { nameEn: 'Giza', nameAr: 'الجيزة', countryEn: 'Egypt' },
  { nameEn: 'Sharm El Sheikh', nameAr: 'شرم الشيخ', countryEn: 'Egypt' },
  { nameEn: 'Hurghada', nameAr: 'الغردقة', countryEn: 'Egypt' },
  { nameEn: 'Mansoura', nameAr: 'المنصورة', countryEn: 'Egypt' },
  { nameEn: 'Luxor', nameAr: 'الأقصر', countryEn: 'Egypt' },
  { nameEn: 'Aswan', nameAr: 'أسوان', countryEn: 'Egypt' },
  { nameEn: 'Port Said', nameAr: 'بورسعيد', countryEn: 'Egypt' },
  { nameEn: 'Suez', nameAr: 'السويس', countryEn: 'Egypt' },
  { nameEn: 'Tanta', nameAr: 'طنطا', countryEn: 'Egypt' },
  { nameEn: 'Ismailia', nameAr: 'الإسماعيلية', countryEn: 'Egypt' },
  { nameEn: 'Fayoum', nameAr: 'الفيوم', countryEn: 'Egypt' },
  { nameEn: 'Asyut', nameAr: 'أسيوط', countryEn: 'Egypt' },
  { nameEn: 'Minya', nameAr: 'المنيا', countryEn: 'Egypt' },
  { nameEn: 'Damanhur', nameAr: 'دمنهور', countryEn: 'Egypt' },
  { nameEn: 'Zagazig', nameAr: 'الزقازيق', countryEn: 'Egypt' },
  { nameEn: 'Damietta', nameAr: 'دمياط', countryEn: 'Egypt' },
  // Iraq (Expanded Complete List)
  { nameEn: 'Baghdad', nameAr: 'بغداد', countryEn: 'Iraq' },
  { nameEn: 'Erbil', nameAr: 'أربيل', countryEn: 'Iraq' },
  { nameEn: 'Mosul', nameAr: 'الموصل', countryEn: 'Iraq' },
  { nameEn: 'Basra', nameAr: 'البصرة', countryEn: 'Iraq' },
  { nameEn: 'Sulaymaniyah', nameAr: 'السليمانية', countryEn: 'Iraq' },
  { nameEn: 'Najaf', nameAr: 'النجف', countryEn: 'Iraq' },
  { nameEn: 'Karbala', nameAr: 'كربلاء', countryEn: 'Iraq' },
  { nameEn: 'Kirkuk', nameAr: 'كركوك', countryEn: 'Iraq' },
  { nameEn: 'Duhok', nameAr: 'دهوك', countryEn: 'Iraq' },
  { nameEn: 'Ramadi', nameAr: 'الرمادي', countryEn: 'Iraq' },
  { nameEn: 'Hillah', nameAr: 'الحلة', countryEn: 'Iraq' },
  { nameEn: 'Nasiriyah', nameAr: 'الناصرية', countryEn: 'Iraq' },
  { nameEn: 'Amarah', nameAr: 'العمارة', countryEn: 'Iraq' },
  { nameEn: 'Diwaniyah', nameAr: 'الديوانية', countryEn: 'Iraq' },
  { nameEn: 'Kut', nameAr: 'الكوت', countryEn: 'Iraq' },
  { nameEn: 'Samarra', nameAr: 'سامراء', countryEn: 'Iraq' },
  // Yemen (Expanded Complete List)
  { nameEn: 'Sana\'a', nameAr: 'صنعاء', countryEn: 'Yemen' },
  { nameEn: 'Aden', nameAr: 'عدن', countryEn: 'Yemen' },
  { nameEn: 'Taiz', nameAr: 'تعز', countryEn: 'Yemen' },
  { nameEn: 'Al Mukalla', nameAr: 'المكلا', countryEn: 'Yemen' },
  { nameEn: 'Ibb', nameAr: 'إب', countryEn: 'Yemen' },
  { nameEn: 'Al Hodeidah', nameAr: 'الحديدة', countryEn: 'Yemen' },
  { nameEn: 'Shibam', nameAr: 'شبام', countryEn: 'Yemen' },
  { nameEn: 'Dhamar', nameAr: 'ذمار', countryEn: 'Yemen' },
  { nameEn: 'Say\'un', nameAr: 'سيئون', countryEn: 'Yemen' },
  { nameEn: 'Marib', nameAr: 'مأرب', countryEn: 'Yemen' },
  { nameEn: 'Amran', nameAr: 'عمران', countryEn: 'Yemen' },
  { nameEn: 'Sa\'dah', nameAr: 'صعدة', countryEn: 'Yemen' },
  { nameEn: 'Al Ghaydah', nameAr: 'الغيضة', countryEn: 'Yemen' },
  { nameEn: 'Zinjibar', nameAr: 'زنجبار', countryEn: 'Yemen' },
  { nameEn: 'Hajjah', nameAr: 'حجة', countryEn: 'Yemen' },
  // Jordan
  { nameEn: 'Amman', nameAr: 'عمان', countryEn: 'Jordan' },
  { nameEn: 'Irbid', nameAr: 'إربد', countryEn: 'Jordan' },
  { nameEn: 'Zarqa', nameAr: 'الزرقاء', countryEn: 'Jordan' },
  { nameEn: 'Aqaba', nameAr: 'العقبة', countryEn: 'Jordan' },
  // Kuwait
  { nameEn: 'Kuwait City', nameAr: 'مدينة الكويت', countryEn: 'Kuwait' },
  { nameEn: 'Salmiya', nameAr: 'السالمية', countryEn: 'Kuwait' },
  { nameEn: 'Hawally', nameAr: 'حولي', countryEn: 'Kuwait' },
  { nameEn: 'Jahra', nameAr: 'الجهراء', countryEn: 'Kuwait' },
  { nameEn: 'Fahaheel', nameAr: 'الفحيحيل', countryEn: 'Kuwait' },
  // Qatar
  { nameEn: 'Doha', nameAr: 'الدوحة', countryEn: 'Qatar' },
  { nameEn: 'Al Rayyan', nameAr: 'الريان', countryEn: 'Qatar' },
  { nameEn: 'Al Wakrah', nameAr: 'الوكرة', countryEn: 'Qatar' },
  { nameEn: 'Al Khor', nameAr: 'الخور', countryEn: 'Qatar' },
  { nameEn: 'Umm Salal', nameAr: 'أم صلال', countryEn: 'Qatar' },
  // Oman
  { nameEn: 'Muscat', nameAr: 'مسقط', countryEn: 'Oman' },
  { nameEn: 'Salalah', nameAr: 'صلالة', countryEn: 'Oman' },
  { nameEn: 'Sohar', nameAr: 'صحار', countryEn: 'Oman' },
  { nameEn: 'Nizwa', nameAr: 'نزوى', countryEn: 'Oman' },
  { nameEn: 'Sur', nameAr: 'صور', countryEn: 'Oman' },
  // Bahrain
  { nameEn: 'Manama', nameAr: 'المنامة', countryEn: 'Bahrain' },
  { nameEn: 'Riffa', nameAr: 'الرفاع', countryEn: 'Bahrain' },
  { nameEn: 'Muharraq', nameAr: 'المحرق', countryEn: 'Bahrain' },
  { nameEn: 'Hamad Town', nameAr: 'مدينة حمد', countryEn: 'Bahrain' },
  { nameEn: 'Isa Town', nameAr: 'مدينة عيسى', countryEn: 'Bahrain' },
  // Morocco
  { nameEn: 'Casablanca', nameAr: 'الدار البيضاء', countryEn: 'Morocco' },
  { nameEn: 'Rabat', nameAr: 'الرباط', countryEn: 'Morocco' },
  { nameEn: 'Marrakech', nameAr: 'مراكش', countryEn: 'Morocco' },
  { nameEn: 'Tangier', nameAr: 'طنجة', countryEn: 'Morocco' },
  // Lebanon
  { nameEn: 'Beirut', nameAr: 'بيروت', countryEn: 'Lebanon' },
  { nameEn: 'Tripoli', nameAr: 'طرابلس', countryEn: 'Lebanon' },
  // Tunisia
  { nameEn: 'Tunis', nameAr: 'تونس', countryEn: 'Tunisia' },
  { nameEn: 'Sousse', nameAr: 'سوسة', countryEn: 'Tunisia' },
  // Palestine
  { nameEn: 'Jerusalem', nameAr: 'القدس', countryEn: 'Palestine' },
  { nameEn: 'Ramallah', nameAr: 'رام الله', countryEn: 'Palestine' }
];

export const foreignCitiesList: ArabCity[] = [
  // Europe
  { nameEn: 'London', nameAr: 'لندن', countryEn: 'United Kingdom' },
  { nameEn: 'Paris', nameAr: 'باريس', countryEn: 'France' },
  { nameEn: 'Rome', nameAr: 'روما', countryEn: 'Italy' },
  { nameEn: 'Madrid', nameAr: 'مدريد', countryEn: 'Spain' },
  { nameEn: 'Berlin', nameAr: 'برلين', countryEn: 'Germany' },
  { nameEn: 'Amsterdam', nameAr: 'أمستردام', countryEn: 'Netherlands' },
  { nameEn: 'Frankfurt', nameAr: 'فرانكفورت', countryEn: 'Germany' },
  { nameEn: 'Vienna', nameAr: 'فيينا', countryEn: 'Austria' },
  { nameEn: 'Zurich', nameAr: 'زيورخ', countryEn: 'Switzerland' },
  
  // North America
  { nameEn: 'New York', nameAr: 'نيويورك', countryEn: 'United States' },
  { nameEn: 'Los Angeles', nameAr: 'لوس أنجلوس', countryEn: 'United States' },
  { nameEn: 'Toronto', nameAr: 'تورونتو', countryEn: 'Canada' },
  { nameEn: 'Vancouver', nameAr: 'فانكوفر', countryEn: 'Canada' },
  { nameEn: 'Mexico City', nameAr: 'مكسيكو سيتي', countryEn: 'Mexico' },
  { nameEn: 'Chicago', nameAr: 'شيكاغو', countryEn: 'United States' },
  { nameEn: 'Miami', nameAr: 'ميامي', countryEn: 'United States' },

  // Latin America
  { nameEn: 'Rio de Janeiro', nameAr: 'ريو دي جانيرو', countryEn: 'Brazil' },
  { nameEn: 'Sao Paulo', nameAr: 'ساو باولو', countryEn: 'Brazil' },
  { nameEn: 'Buenos Aires', nameAr: 'بوينس آيرس', countryEn: 'Argentina' },
  { nameEn: 'Bogota', nameAr: 'بوغوتا', countryEn: 'Colombia' },
  { nameEn: 'Santiago', nameAr: 'سانتياغو', countryEn: 'Chile' },
  { nameEn: 'Lima', nameAr: 'ليما', countryEn: 'Peru' }
];

export interface Landmark {
  nameEn: string;
  nameAr: string;
  category: string;
  lat?: number;
  lng?: number;
}

export const cityLandmarks: Record<string, Landmark[]> = {
  'Riyadh': [
    { nameEn: 'Draft Cafe, Olaya District', nameAr: 'مقهى درافت، حي العليا', category: 'Cafes', lat: 24.7075, lng: 46.6781 },
    { nameEn: 'Al Olaya Cue Club', nameAr: 'نادي بلياردو العليا', category: 'Billiards', lat: 24.6983, lng: 46.6745 },
    { nameEn: 'Vox Cinemas, Riyadh Park Mall', nameAr: 'سينما فوكس، رياض بارك', category: 'Cinema', lat: 24.7709, lng: 46.6433 },
    { nameEn: 'Al-Bujairi Terrace, Diriyah', nameAr: 'مطل البجيري، الدرعية التاريخية', category: 'Restaurants', lat: 24.7431, lng: 46.5741 },
    { nameEn: 'King Abdullah Park', nameAr: 'منتزه الملك عبد الله', category: 'Parks', lat: 24.6433, lng: 46.7118 },
  ],
  'Jeddah': [
    { nameEn: 'Jeddah Promenade', nameAr: 'بروميناد جدة', category: 'City Tours' },
    { nameEn: 'Historic Al-Balad District', nameAr: 'منطقة البلد التاريخية', category: 'City Tours' },
    { nameEn: 'Andalus Mall Bowling', nameAr: 'بولينج الأندلس مول', category: 'Bowling' },
  ],
  'Cairo': [
    { nameEn: 'Giza Pyramids Plaza', nameAr: 'ساحة أهرامات الجيزة', category: 'City Tours' },
    { nameEn: 'Khan El-Khalili Bazaar', nameAr: 'خان الخليلي التراثي', category: 'Shopping Malls' },
    { nameEn: 'Cairo Tower Viewpoint', nameAr: 'برج القاهرة والممشى السياحي', category: 'City Tours' },
    { nameEn: 'Al-Azhar Park Gardens', nameAr: 'حديقة الأزهر المفتوحة', category: 'Parks' },
    { nameEn: 'American University Plaza Cafes', nameAr: 'مقاهي ساحة الجامعة الأمريكية', category: 'Cafes' },
  ],
  'Alexandria': [
    { nameEn: 'Citadel of Qaitbay', nameAr: 'قلعة قايتباي والبحر', category: 'City Tours' },
    { nameEn: 'Bibliotheca Alexandrina', nameAr: 'مكتبة الإسكندرية وصالة القراءة', category: 'Study Sessions' },
    { nameEn: 'Montaza Palace Gardens', nameAr: 'حدائق قصر المنتزه الفاخرة', category: 'Parks' },
  ],
  'Mansoura': [
    { nameEn: 'El-Mergany Sports Pitch', nameAr: 'ملعب المرغني الرياضي', category: 'Football' },
    { nameEn: 'Mansoura Corniche Walkway', nameAr: 'ممشى كورنيش المنصورة', category: 'Parks' },
  ],
  'Sana\'a': [
    { nameEn: 'Bab Al-Yaman Old Quarter', nameAr: 'حي باب اليمن التاريخي القديم', category: 'City Tours' },
    { nameEn: 'Dar Al-Hajar Stone Palace', nameAr: 'قصر دار الحجر الأثري', category: 'City Tours' },
    { nameEn: 'Great Mosque of Sana\'a', nameAr: 'الجامع الكبير الأثري بصنعاء', category: 'Group Gatherings' },
  ],
  'Aden': [
    { nameEn: 'Elephant Nose Beach Cafe', nameAr: 'مقهى ساحل ساحل الفيل', category: 'Cafes' },
    { nameEn: 'Historic Cisterns of Tawahi', nameAr: 'صهاريج التواهي الأثرية', category: 'City Tours' },
    { nameEn: 'Crater Sira Fort View', nameAr: 'قلعة صيرة وجبل كريتر', category: 'City Tours' },
  ],
  'Taiz': [
    { nameEn: 'Cairo Castle Overlook', nameAr: 'قلعة القاهرة وصبر المطلة', category: 'City Tours' },
    { nameEn: 'Sabir Mountain Peak Park', nameAr: 'منتزه قمة جبل صبر والضباب', category: 'Parks' },
  ],
  'Al Mukalla': [
    { nameEn: 'Al-Ghawizi Historical Castle', nameAr: 'حصن الغويزي الشامخ بالمكلا', category: 'City Tours' },
    { nameEn: 'Mukalla Harbour Corniche', nameAr: 'كورنيش خور المكلا الساحر', category: 'Cafes' },
  ],
  'Baghdad': [
    { nameEn: 'Al-Mutanabbi Street Book Cafes', nameAr: 'مقاهي وكتب شارع المتنبي التراثي', category: 'Study Sessions' },
    { nameEn: 'Al-Zawraa Amusement Park', nameAr: 'مدينة ألعاب ومنتزه الزوراء', category: 'Parks' },
    { nameEn: 'Al-Mansour Mall Bowling', nameAr: 'صالة بولينج المنصور مول', category: 'Bowling' },
    { nameEn: 'Tigris River Corniche Walk', nameAr: 'ممشى كورنيش نهر دجلة الجميل', category: 'City Tours' },
  ],
  'Erbil': [
    { nameEn: 'Erbil Citadel Square', nameAr: 'ساحة قلعة أربيل والتراث', category: 'City Tours' },
    { nameEn: 'Sami Abdulrahman Botanical Park', nameAr: 'حديقة سامي عبد الرحمن الوطنية', category: 'Parks' },
    { nameEn: 'Machko Traditional Teahouse', nameAr: 'مقهى مجكو التراثي للشاي والقهوة', category: 'Cafes' },
  ],
  'Basra': [
    { nameEn: 'Shatt al-Arab Scenic Corniche', nameAr: 'كورنيش شط العرب المفتوح', category: 'City Tours' },
    { nameEn: 'Basra Sports City Stadium', nameAr: 'ملعب مدينة البصرة الرياضية (جذع النخلة)', category: 'Football' },
  ],
  'Dubai': [
    { nameEn: 'Cue Club, Al Barsha', nameAr: 'نادي كيو كلوب، البرشا', category: 'Billiards' },
    { nameEn: 'Glitch VR Arena, Dubai Mall', nameAr: 'صالة جيمنج جليتش، دبي مول', category: 'Gaming Sessions' },
    { nameEn: 'Kite Beach Walking Path', nameAr: 'ممشى كايت بيتش', category: 'Parks' },
  ],
  'Amman': [
    { nameEn: 'Citadel Park Viewpoint', nameAr: 'مطل جبل القلعة الأثري وعمان القديمة', category: 'Parks' },
    { nameEn: 'Books@Cafe, Rainbow Street', nameAr: 'مقهى بوكس آت كافيه، شارع الرينبو', category: 'Cafes' },
  ],
  'Taif': [
    { nameEn: 'Taif Rose Factory & Cafe', nameAr: 'مصنع ومقهى الورد الطائفي التراثي', category: 'Cafes' },
    { nameEn: 'Al-Hada Cable Car & Peak Overlook', nameAr: 'تلفريك الهدا ومطل الجبل والضباب', category: 'City Tours' },
    { nameEn: 'King Abdullah Park, Taif', nameAr: 'منتزه الملك عبد الله بالنسيم', category: 'Parks' },
    { nameEn: 'Al-Shada Highland Hiking Trail', nameAr: 'مسار مطل الشفا الجبلي وممشى الضباب', category: 'Parks' },
  ]
};

export const PREDEFINED_HOBBIES = [
  'Reading', 'Gaming', 'Football', 'Photography', 'Travel', 'Cooking', 'Hiking', 'Swimming', 'Music', 'Drawing', 'Volunteering', 'Fitness', 'Coding', 'Movies', 'Board Games', 'Padel', 'Cycling'
];
