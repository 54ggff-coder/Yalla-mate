/**
 * @license
 * Copyright (c) 2026 Ali Fouad Al-Khidir Salem (علي فؤاد الخضر سالم). All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Fuel, Coins, Users, Info, Copy, Check, RotateCcw, 
  MapPin, ShieldAlert, ArrowRight, UserCheck, Globe, PieChart as PieIcon
} from 'lucide-react';
import { Language } from '../data/translations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLocation } from '../contexts/LocationContext';

interface ExpenseSplitterProps {
  lang: Language;
  defaultDistance?: number;
  defaultAttendees?: number;
  defaultCity?: string;
}

interface CountryConfig {
  code: string;
  nameAr: string;
  nameEn: string;
  currencyAr: string;
  currencyEn: string;
  defaultPrice91: number;
  defaultPrice95: number;
  cities: Array<{ nameAr: string; nameEn: string; value: string }>;
}

const countriesList: CountryConfig[] = [
  {
    code: 'SA',
    nameAr: 'المملكة العربية السعودية 🇸🇦',
    nameEn: 'Saudi Arabia 🇸🇦',
    currencyAr: 'ريال سعودي',
    currencyEn: 'SAR',
    defaultPrice91: 2.18,
    defaultPrice95: 2.33,
    cities: [
      { nameAr: 'الرياض', nameEn: 'Riyadh', value: 'Riyadh' },
      { nameAr: 'جدة', nameEn: 'Jeddah', value: 'Jeddah' },
      { nameAr: 'الدمام', nameEn: 'Dammam', value: 'Dammam' },
      { nameAr: 'مكة المكرمة', nameEn: 'Mecca', value: 'Mecca' },
      { nameAr: 'المدينة المنورة', nameEn: 'Medina', value: 'Medina' },
    ]
  },
  {
    code: 'AE',
    nameAr: 'الإمارات العربية المتحدة 🇦🇪',
    nameEn: 'United Arab Emirates 🇦🇪',
    currencyAr: 'درهم إماراتي',
    currencyEn: 'AED',
    defaultPrice91: 2.95,
    defaultPrice95: 3.12,
    cities: [
      { nameAr: 'دبي', nameEn: 'Dubai', value: 'Dubai' },
      { nameAr: 'أبوظبي', nameEn: 'Abu Dhabi', value: 'Abu Dhabi' },
      { nameAr: 'الشارقة', nameEn: 'Sharjah', value: 'Sharjah' },
    ]
  },
  {
    code: 'KW',
    nameAr: 'الكويت 🇰🇼',
    nameEn: 'Kuwait 🇰🇼',
    currencyAr: 'دينار كويتي',
    currencyEn: 'KWD',
    defaultPrice91: 0.085,
    defaultPrice95: 0.105,
    cities: [
      { nameAr: 'مدينة الكويت', nameEn: 'Kuwait City', value: 'Kuwait City' },
      { nameAr: 'السالمية', nameEn: 'Salmiya', value: 'Salmiya' },
    ]
  },
  {
    code: 'QA',
    nameAr: 'قطر 🇶🇦',
    nameEn: 'Qatar 🇶🇦',
    currencyAr: 'ريال قطري',
    currencyEn: 'QAR',
    defaultPrice91: 1.90,
    defaultPrice95: 2.10,
    cities: [
      { nameAr: 'الدوحة', nameEn: 'Doha', value: 'Doha' },
      { nameAr: 'الريان', nameEn: 'Al Rayyan', value: 'Al Rayyan' },
    ]
  },
  {
    code: 'OM',
    nameAr: 'عمان 🇴🇲',
    nameEn: 'Oman 🇴🇲',
    currencyAr: 'ريال عماني',
    currencyEn: 'OMR',
    defaultPrice91: 0.229,
    defaultPrice95: 0.239,
    cities: [
      { nameAr: 'مسقط', nameEn: 'Muscat', value: 'Muscat' },
      { nameAr: 'صلالة', nameEn: 'Salalah', value: 'Salalah' },
    ]
  },
  {
    code: 'BH',
    nameAr: 'البحرين 🇧🇭',
    nameEn: 'Bahrain 🇧🇭',
    currencyAr: 'دينار بحريني',
    currencyEn: 'BHD',
    defaultPrice91: 0.140,
    defaultPrice95: 0.200,
    cities: [
      { nameAr: 'المنامة', nameEn: 'Manama', value: 'Manama' },
      { nameAr: 'المحرق', nameEn: 'Muharraq', value: 'Muharraq' },
    ]
  },
  {
    code: 'EG',
    nameAr: 'مصر 🇪🇬',
    nameEn: 'Egypt 🇪🇬',
    currencyAr: 'جنيه مصري',
    currencyEn: 'EGP',
    defaultPrice91: 11.00,
    defaultPrice95: 13.50,
    cities: [
      { nameAr: 'القاهرة', nameEn: 'Cairo', value: 'Cairo' },
      { nameAr: 'الإسكندرية', nameEn: 'Alexandria', value: 'Alexandria' },
      { nameAr: 'المنصورة', nameEn: 'Mansoura', value: 'Mansoura' },
    ]
  },
  {
    code: 'JO',
    nameAr: 'الأردن 🇯🇴',
    nameEn: 'Jordan 🇯🇴',
    currencyAr: 'دينار أردني',
    currencyEn: 'JOD',
    defaultPrice91: 0.910,
    defaultPrice95: 1.150,
    cities: [
      { nameAr: 'عمان', nameEn: 'Amman', value: 'Amman' },
      { nameAr: 'إربد', nameEn: 'Irbid', value: 'Irbid' },
    ]
  },
  {
    code: 'MA',
    nameAr: 'المغرب 🇲🇦',
    nameEn: 'Morocco 🇲🇦',
    currencyAr: 'درهم مغربي',
    currencyEn: 'MAD',
    defaultPrice91: 13.50,
    defaultPrice95: 14.80,
    cities: [
      { nameAr: 'الدار البيضاء', nameEn: 'Casablanca', value: 'Casablanca' },
      { nameAr: 'الرباط', nameEn: 'Rabat', value: 'Rabat' },
      { nameAr: 'مراكش', nameEn: 'Marrakech', value: 'Marrakech' },
    ]
  },
  {
    code: 'US',
    nameAr: 'الولايات المتحدة الامريكية 🇺🇸',
    nameEn: 'United States 🇺🇸',
    currencyAr: 'دولار أمريكي',
    currencyEn: 'USD',
    defaultPrice91: 0.92,
    defaultPrice95: 1.08,
    cities: [
      { nameAr: 'نيويورك', nameEn: 'New York', value: 'New York' },
      { nameAr: 'لوس أنجلوس', nameEn: 'Los Angeles', value: 'Los Angeles' },
      { nameAr: 'شيكاغو', nameEn: 'Chicago', value: 'Chicago' },
      { nameAr: 'هيوستن', nameEn: 'Houston', value: 'Houston' },
    ]
  },
  {
    code: 'GB',
    nameAr: 'المملكة المتحدة 🇬🇧',
    nameEn: 'United Kingdom 🇬🇧',
    currencyAr: 'جنيه إسترليني',
    currencyEn: 'GBP',
    defaultPrice91: 1.42,
    defaultPrice95: 1.55,
    cities: [
      { nameAr: 'لندن', nameEn: 'London', value: 'London' },
      { nameAr: 'مانشستر', nameEn: 'Manchester', value: 'Manchester' },
      { nameAr: 'برمنغهام', nameEn: 'Birmingham', value: 'Birmingham' },
    ]
  },
  {
    code: 'DE',
    nameAr: 'ألمانيا 🇩🇪',
    nameEn: 'Germany 🇩🇪',
    currencyAr: 'يورو',
    currencyEn: 'EUR',
    defaultPrice91: 1.72,
    defaultPrice95: 1.88,
    cities: [
      { nameAr: 'برلين', nameEn: 'Berlin', value: 'Berlin' },
      { nameAr: 'ميونخ', nameEn: 'Munich', value: 'Munich' },
      { nameAr: 'فرانكفورت', nameEn: 'Frankfurt', value: 'Frankfurt' },
    ]
  },
  {
    code: 'FR',
    nameAr: 'فرنسا 🇫🇷',
    nameEn: 'France 🇫🇷',
    currencyAr: 'يورو',
    currencyEn: 'EUR',
    defaultPrice91: 1.75,
    defaultPrice95: 1.90,
    cities: [
      { nameAr: 'باريس', nameEn: 'Paris', value: 'Paris' },
      { nameAr: 'ليون', nameEn: 'Lyon', value: 'Lyon' },
      { nameAr: 'مرسيليا', nameEn: 'Marseille', value: 'Marseille' },
    ]
  },
  {
    code: 'CA',
    nameAr: 'كندا 🇨🇦',
    nameEn: 'Canada 🇨🇦',
    currencyAr: 'دولار كندي',
    currencyEn: 'CAD',
    defaultPrice91: 1.55,
    defaultPrice95: 1.75,
    cities: [
      { nameAr: 'تورونتو', nameEn: 'Toronto', value: 'Toronto' },
      { nameAr: 'فانكوفر', nameEn: 'Vancouver', value: 'Vancouver' },
      { nameAr: 'مونتريال', nameEn: 'Montreal', value: 'Montreal' },
    ]
  },
  {
    code: 'AU',
    nameAr: 'أستراليا 🇦🇺',
    nameEn: 'Australia 🇦🇺',
    currencyAr: 'دولار أسترالي',
    currencyEn: 'AUD',
    defaultPrice91: 1.75,
    defaultPrice95: 1.95,
    cities: [
      { nameAr: 'سيدني', nameEn: 'Sydney', value: 'Sydney' },
      { nameAr: 'ملبورن', nameEn: 'Melbourne', value: 'Melbourne' },
      { nameAr: 'بريسبان', nameEn: 'Brisbane', value: 'Brisbane' },
    ]
  },
  {
    code: 'TR',
    nameAr: 'تركيا 🇹🇷',
    nameEn: 'Turkey 🇹🇷',
    currencyAr: 'ليرة تركية',
    currencyEn: 'TRY',
    defaultPrice91: 42.50,
    defaultPrice95: 44.00,
    cities: [
      { nameAr: 'إسطنبول', nameEn: 'Istanbul', value: 'Istanbul' },
      { nameAr: 'أنقرة', nameEn: 'Ankara', value: 'Ankara' },
      { nameAr: 'إزمير', nameEn: 'Izmir', value: 'Izmir' },
    ]
  },
  {
    code: 'LB',
    nameAr: 'لبنان 🇱🇧',
    nameEn: 'Lebanon 🇱🇧',
    currencyAr: 'ليرة لبنانية',
    currencyEn: 'LBP',
    defaultPrice91: 850000,
    defaultPrice95: 890000,
    cities: [
      { nameAr: 'بيروت', nameEn: 'Beirut', value: 'Beirut' },
      { nameAr: 'طرابلس', nameEn: 'Tripoli', value: 'Tripoli' },
      { nameAr: 'صيدا', nameEn: 'Sidon', value: 'Sidon' },
    ]
  },
  {
    code: 'MY',
    nameAr: 'ماليزيا 🇲🇾',
    nameEn: 'Malaysia 🇲🇾',
    currencyAr: 'رينغيت',
    currencyEn: 'MYR',
    defaultPrice91: 2.05,
    defaultPrice95: 3.47,
    cities: [
      { nameAr: 'كوالالمبور', nameEn: 'Kuala Lumpur', value: 'Kuala Lumpur' },
      { nameAr: 'بينانغ', nameEn: 'Penang', value: 'Penang' },
      { nameAr: 'جوهر بهرو', nameEn: 'Johor Bahru', value: 'Johor Bahru' },
    ]
  },
  {
    code: 'ID',
    nameAr: 'إندونيسيا 🇮🇩',
    nameEn: 'Indonesia 🇮🇩',
    currencyAr: 'روبية',
    currencyEn: 'IDR',
    defaultPrice91: 10000,
    defaultPrice95: 14000,
    cities: [
      { nameAr: 'جاكرتا', nameEn: 'Jakarta', value: 'Jakarta' },
      { nameAr: 'بالي', nameEn: 'Bali', value: 'Bali' },
      { nameAr: 'سورابايا', nameEn: 'Surabaya', value: 'Surabaya' },
    ]
  },
  {
    code: 'IT',
    nameAr: 'إيطاليا 🇮🇹',
    nameEn: 'Italy 🇮🇹',
    currencyAr: 'يورو',
    currencyEn: 'EUR',
    defaultPrice91: 1.85,
    defaultPrice95: 2.00,
    cities: [
      { nameAr: 'روما', nameEn: 'Rome', value: 'Rome' },
      { nameAr: 'ميلانو', nameEn: 'Milan', value: 'Milan' },
      { nameAr: 'نابولي', nameEn: 'Naples', value: 'Naples' },
    ]
  },
  {
    code: 'ES',
    nameAr: 'إسبانيا 🇪🇸',
    nameEn: 'Spain 🇪🇸',
    currencyAr: 'يورو',
    currencyEn: 'EUR',
    defaultPrice91: 1.65,
    defaultPrice95: 1.80,
    cities: [
      { nameAr: 'مدريد', nameEn: 'Madrid', value: 'Madrid' },
      { nameAr: 'برشلونة', nameEn: 'Barcelona', value: 'Barcelona' },
      { nameAr: 'فالنسيا', nameEn: 'Valencia', value: 'Valencia' },
    ]
  },
  {
    code: 'CH',
    nameAr: 'سويسرا 🇨🇭',
    nameEn: 'Switzerland 🇨🇭',
    currencyAr: 'فرنك سويسري',
    currencyEn: 'CHF',
    defaultPrice91: 1.80,
    defaultPrice95: 1.95,
    cities: [
      { nameAr: 'زيورخ', nameEn: 'Zurich', value: 'Zurich' },
      { nameAr: 'جنيف', nameEn: 'Geneva', value: 'Geneva' },
      { nameAr: 'بازل', nameEn: 'Basel', value: 'Basel' },
    ]
  },
  {
    code: 'GLOBAL',
    nameAr: '🌍 دول أخرى (جميع دول العالم)',
    nameEn: '🌍 Other Countries (Global)',
    currencyAr: 'عملة محلية',
    currencyEn: 'Local Currency',
    defaultPrice91: 1.00,
    defaultPrice95: 1.20,
    cities: [
      { nameAr: 'عاصمة / منطقة مركزية', nameEn: 'Capital / Central', value: 'Capital' },
      { nameAr: 'منطقة أخرى 1', nameEn: 'Other Region 1', value: 'Region1' },
      { nameAr: 'منطقة أخرى 2', nameEn: 'Other Region 2', value: 'Region2' },
    ]
  }
];

export default function ExpenseSplitter({
  lang,
  defaultDistance = 85,
  defaultAttendees = 4,
  defaultCity = ''
}: ExpenseSplitterProps) {
  const isAr = lang === 'ar';
  const { address } = useLocation();
  
  // Custom Bill (Food / Other) State
  const [splitMode, setSplitMode] = useState<'fuel_trip' | 'food_custom'>('fuel_trip');
  const [customBillTotal, setCustomBillTotal] = useState<number>(0);
  const [billTitle, setBillTitle] = useState<string>('');

  // State variables for inputs
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('SA');
  const [distance, setDistance] = useState<number>(defaultDistance);
  const [efficiency, setEfficiency] = useState<number>(8.5); // Liter per 100 KM
  const [gasType, setGasType] = useState<'91' | '95'>('91');
  const [city, setCity] = useState<string>(defaultCity);

  // Auto-detect country and city from location context
  useEffect(() => {
    if (address?.countryCode) {
      const country = countriesList.find(c => c.code === address.countryCode);
      if (country) {
        setSelectedCountryCode(country.code);
        if (address.city || address.town) {
          setCity(address.city || address.town || '');
        }
      }
    }
  }, [address]);
  const [attendees, setAttendees] = useState<number>(defaultAttendees);
  const [driverPaidExempt, setDriverPaidExempt] = useState<boolean>(true); // Arab hospitality: driver is exempt as thanks!

  // Active country config
  const activeCountry = countriesList.find(c => c.code === selectedCountryCode) || countriesList[0];
  const activeCurrency = isAr ? activeCountry.currencyAr : activeCountry.currencyEn;

  // API query state
  const [fuelPrice, setFuelPrice] = useState<number>(activeCountry.defaultPrice91);
  const [rateSource, setRateSource] = useState<string>('Official National Rate');
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // UI state
  const [copied, setCopied] = useState<boolean>(false);

  // Hardcoded standard default fallbacks that are immediately loaded based on selected options
  const defaultBasePrice = gasType === '95' ? activeCountry.defaultPrice95 : activeCountry.defaultPrice91;

  // Preset fuel efficiency buttons
  const efficiencyPresets = [
    { labelAr: '🚗 سيدان اقتصادي (6.5ل)', labelEn: '🚗 Eco Sedan (6.5L)', value: 6.5 },
    { labelAr: '🚙 كروس أوفر (8.5ل)', labelEn: '🚙 Crossover (8.5L)', value: 8.5 },
    { labelAr: '🚘 عائلية SUV كبير (11.5ل)', labelEn: '🚘 Large SUV (11.5L)', value: 11.5 },
    { labelAr: '🚚 بيك أب V8 (14.5ل)', labelEn: '🚚 V8 Truck (14.5L)', value: 14.5 }
  ];

  // Fetch fuel prices from Search Grounding API
  const fetchFuelCost = async () => {
    setIsLoadingPrice(true);
    setApiError(null);
    try {
      const response = await fetch('/api/fuel-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          city, 
          gasType, 
          country: activeCountry.nameEn, 
          defaultPrice: defaultBasePrice 
        })
      });
      if (!response.ok) {
        throw new Error('API server returned error status');
      }
      const data = await response.json();
      if (data && typeof data.price === 'number') {
        setFuelPrice(data.price);
        setRateSource(data.source || 'Official grounded rate');
      }
    } catch (err: any) {
      console.warn('Could not query real-time fuel, falling back to country defaults:', err);
      // Fallback
      setFuelPrice(defaultBasePrice);
      setRateSource(isAr ? `الأسعار الرسمية المعتمدة لـ ${activeCountry.nameAr}` : `Official standard rates in ${activeCountry.nameEn}`);
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Trigger loading when country, city or gasType is updated
  useEffect(() => {
    fetchFuelCost();
  }, [selectedCountryCode, city, gasType]);

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountryCode(countryCode);
    const country = countriesList.find(c => c.code === countryCode) || countriesList[0];
    if (country.cities.length > 0) {
      setCity(country.cities[0].value);
    }
    // Instantly apply static default price matching new country to avoid blinking delay
    setFuelPrice(gasType === '95' ? country.defaultPrice95 : country.defaultPrice91);
    setRateSource(isAr ? `معايير أسعار ${country.nameAr}` : `Standard rates of ${country.nameEn}`);
  };

  // Calculations
  const totalLitersRequired = splitMode === 'fuel_trip' ? (distance * efficiency) / 100 : 0;
  const totalCost = splitMode === 'fuel_trip' ? totalLitersRequired * fuelPrice : customBillTotal;
  
  // Custom split ratio mathematically:
  // If driver is exempt (and it's a fuel trip), we divide by (attendees - 1). If attendees count is 1, driver must cover him/herself.
  const billingSplitDenominator = (splitMode === 'fuel_trip' && driverPaidExempt) ? Math.max(1, attendees - 1) : attendees;
  const individualShare = totalCost / billingSplitDenominator;

  // Render text translations
  const textDict = {
    titleAr: 'حاسبة تقاسم وقود الرحلات الدولية ⛽🗺️',
    titleEn: 'International Trip Fuel Splitter ⛽🗺️',
    subAr: 'احسب التكلفة التقديرية للبنزين آلياً في الدول العربية والغربية بناءً على أسعار الوقود والعملات الحية، ووزّع المشوار عادلاً بين الرفاق.',
    subEn: 'Estimate fuel bills dynamically in Arab & Western countries using search-grounded gas rates and local currencies, splitting fairly among companions.',
    countryLabelAr: 'اختر الدولة',
    countryLabelEn: 'Select Country',
    distanceLabelAr: 'مسافة الرحلة الكلية الإجمالية',
    distanceLabelEn: 'Total Trip Outing Distance',
    efficiencyLabelAr: 'معدل استهلاك وقود المركبة (لتر / 100 كم)',
    efficiencyLabelEn: 'Vehicle Fuel Economy (Liters / 100 KM)',
    efficiencyPresetsAr: 'تسهيل: اختر فئة حجم ومعدل تقريبي للسيارة',
    efficiencyPresetsEn: 'Presets: Choose approximate car class',
    cityLabelAr: 'مدينة انطلاق أو تجمع الرحلة',
    cityLabelEn: 'Origin Departure Location City',
    gasTypeAr: 'تصنيف وقود المحرك المعبّأ',
    gasTypeEn: 'Select Motor Fuel Grade',
    attendeesCountAr: 'إجمالي عدد رفاق الرحلة (بالسائق)',
    attendeesCountEn: 'Total Companions Joining (with Driver)',
    hospOptionAr: '💡 إعفاء قائد المركبة كشكر له (ضيافة عربية وعالمية)',
    hospOptionEn: "💡 Drivers ride free! Exempt leader as thank you (Driver Courtesy)",
    hospNoticeAr: 'سيتم تقسيم تكلفة الوقود بالتساوي بين الركاب المنضمين فقط كشكر للسائق المتطوع بسيارته.',
    hospNoticeEn: 'Fuel charges are split evenly among riders only, driver is excluded as courtesy.',
    normalNoticeAr: 'سيتم تقسيم التكاليف الإجمالية للمشوار بالتساوي على جميع الأعضاء بمن فيهم قائد السيارة.',
    normalNoticeEn: 'Charges are split raw-evenly across all members including the driver.',
    rateTitleAr: 'سعر المحروقات المحلي للدولة',
    rateTitleEn: 'Validated Local Fuel Sourcing Price',
    litersNeededAr: 'كمية الوقود اللازمة',
    litersNeededEn: 'Total Liters Required',
    totalTripBillAr: 'الفاتورة الكلية لرحلتنا',
    totalTripBillEn: 'Grand Fuel Cost Bill',
    perPassengerShareAr: 'حصة الرفيق الراكب للاستحقاق',
    perPassengerShareEn: 'Individual Mates Share',
    shareButtonAr: 'نسخ نشرة التنسيق ومشاركتها مع الرفاق 💬',
    shareButtonEn: 'Copy Splits to Clipboard 💬',
    successCopyAr: '✓ تم نسخ رسالة التنسيق بنجاح! جاهزة للصق في الشات.',
    successCopyEn: '✓ Text copied successfully! Ready to paste in chat.',
    singleRiderAr: 'أنت منضم بمفردك كقائد، لا يوجد ركاب لتقسيم الكلفة.',
    singleRiderEn: 'Solo drive, no riders to split expenses.',
    driverCoverMsgAr: 'الدفع بالكامل على القائد',
    driverCoverMsgEn: 'Driver covers full amount',
    driverExemptTitleAr: 'سائق متطوع معفي 👑',
    driverExemptTitleEn: 'Volunteer Driver (Exempt) 👑',
    riderTitleAr: 'مشتريات وقود رفيق راكب',
    riderTitleEn: 'Rider Share Due',
    recalBtnAr: 'تحديث الأسعار مع محرك البحث ⚡',
    recalBtnEn: 'Search Grounding Refresh ⚡'
  };

  // Generate beautiful shareable summary message for Whatsapp/Chats
  const handleCopySummary = () => {
    const cityName = activeCountry.cities.find(c => c.value === city)?.[isAr ? 'nameAr' : 'nameEn'] || city;
    const countryName = isAr ? activeCountry.nameAr : activeCountry.nameEn;
    
    const arabicMsg = `⛽ *تفاصيل تقاسم كلفة البنزين لطلعتنا - يلا طلعنا* 🚗\n` +
      `----------------------------------------\n` +
      `📍 الدولة: ${countryName}\n` +
      `📍 المدينة: ${cityName}\n` +
      `📏 المسافة المحددة: ${distance.toFixed(0)} كم\n` +
      `⚙️ كفاءة المركبة: ${efficiency.toFixed(1)} لتر/100كم\n` +
      `⛽ فئة الوقود: بنزين ${gasType === '95' ? '95 (ممتاز)' : '91 (عادي)'}\n` +
      `👥 رفاق الرحلة: ${attendees} أشخاص\n` +
      `👑 السائق معفي من الدفع؟ ${driverPaidExempt ? 'نعم (شكر وتقدير لمشاركته سيارته)' : 'لا (التقسيم يشمل الجميع)'}\n\n` +
      `💸 *إجمالي الوقود:* ${totalLitersRequired.toFixed(1)} لتر\n` +
      `💰 *التكلفة الكلية للرحلة:* ${totalCost.toFixed(2)} ${activeCurrency}\n` +
      `👤 *الحصة المقدرة لكل راكب:* ${individualShare.toFixed(2)} ${activeCurrency}\n` +
      `----------------------------------------\n` +
      `*_تم الحساب بنجاح وموثوقية عالية عبر يلا طلعنا 🐪_*`;

    const englishMsg = `⛽ *Trip Fuel Split Details - YallaMate* 🚗\n` +
      `----------------------------------------\n` +
      `📍 Country: ${countryName}\n` +
      `📍 Hub/City: ${cityName}\n` +
      `📏 Outing Distance: ${distance.toFixed(0)} km\n` +
      `⚙️ Vehicle Economy: ${efficiency.toFixed(1)} L/100km\n` +
      `⛽ Fuel Type: Gasoline ${gasType}\n` +
      `👥 Companions: ${attendees} mates\n` +
      `👑 Drivers Exempt? ${driverPaidExempt ? 'Yes (Driver Appreciation)' : 'No (Raw split)'}\n\n` +
      `💸 *Total Fuel:* ${totalLitersRequired.toFixed(1)} Liters\n` +
      `💰 *Grand Fuel Cost Bill:* ${totalCost.toFixed(2)} ${activeCurrency}\n` +
      `👤 *Share Per Companion:* ${individualShare.toFixed(2)} ${activeCurrency}\n` +
      `----------------------------------------\n` +
      `*_Calculated with trust and transparency via Yalla Mate 🐪_*`;

    navigator.clipboard.writeText(isAr ? arabicMsg : englishMsg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-6 animate-in slide-in-from-bottom-4 duration-500 text-white leading-relaxed">
      
      {/* Header section & Mode Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1.5 flex-1">
          <h2 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-400" /> 
            {isAr ? 'تقسيم التكاليف' : 'Split Bill'}
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl font-medium">
            {isAr ? 'احسب تكلفة مشتريات الطلعة من طعام ووقود لتقسيمها بإنصاف بين أفراد المجموعة.' : 'Calculate and fairly divide fuel, food, or custom outing expenses across participants.'}
          </p>
        </div>

        <div className="flex bg-white/5 rounded-xl border border-white/10 select-none overflow-hidden shrink-0">
          <button 
            onClick={() => setSplitMode('fuel_trip')}
            className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 ${splitMode === 'fuel_trip' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}
          >
            <Fuel className="w-4 h-4" /> {isAr ? 'الوقود والمواصلات' : 'Trip Fuel'}
          </button>
          <button 
            onClick={() => setSplitMode('food_custom')}
            className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-2 ${splitMode === 'food_custom' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}
          >
            🍔 {isAr ? 'طعام/مخصص' : 'Food/Other'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* INPUT PANEL COLUMN */}
        <div className="md:col-span-7 space-y-5">
          
          {splitMode === 'fuel_trip' ? (
            <>
              {/* Country Selection Dropdown */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  {isAr ? textDict.countryLabelAr : textDict.countryLabelEn}
                </label>
                <select
                  value={selectedCountryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0F131C] border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
                >
                  {countriesList.map((country) => (
                    <option key={country.code} value={country.code} className="bg-[#0F131C]">
                      {isAr ? country.nameAr : country.nameEn} ({country.currencyEn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* City Selection */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    {isAr ? textDict.cityLabelAr : textDict.cityLabelEn}
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F131C] border border-white/10 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  >
                    {activeCountry.cities.map((c) => (
                      <option key={c.value} value={c.value} className="bg-[#0F131C]">
                        {isAr ? c.nameAr : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gasoline Octane */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    {isAr ? textDict.gasTypeAr : textDict.gasTypeEn}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGasType('91')}
                      className={`py-1.5 rounded-xl border text-xs font-black transition-all ${
                        gasType === '91' 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {isAr ? 'عادي / Octane 91' : 'Regular 91'}
                    </button>
                    <button
                      onClick={() => setGasType('95')}
                      className={`py-1.5 rounded-xl border text-xs font-black transition-all ${
                        gasType === '95' 
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {isAr ? 'ممتاز / Octane 95' : 'Premium 95'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Distance Input */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">📍 {isAr ? textDict.distanceLabelAr : textDict.distanceLabelEn}</span>
                  <span className="font-mono text-emerald-400 font-extrabold text-sm">{distance} {isAr ? 'كم' : 'KM'}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="600"
                  step="5"
                  value={distance}
                  onChange={(e) => setDistance(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Efficiency Input */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">⚙️ {isAr ? textDict.efficiencyLabelAr : textDict.efficiencyLabelEn}</span>
                  <span className="font-mono text-indigo-400 font-extrabold text-sm">{efficiency.toFixed(1)} {isAr ? 'لتر/100كم' : 'L/100KM'}</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="22"
                  step="0.5"
                  value={efficiency}
                  onChange={(e) => setEfficiency(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />

                {/* Presets Grid Slider */}
                <div className="space-y-1.5 pt-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                    {isAr ? textDict.efficiencyPresetsAr : textDict.efficiencyPresetsEn}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {efficiencyPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setEfficiency(preset.value)}
                        className={`px-2.5 py-1.5 rounded-xl border transition-all text-left text-[10px] font-bold ${
                          Math.abs(efficiency - preset.value) < 0.1 
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isAr ? preset.labelAr : preset.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white/5 p-6 rounded-2xl border border-purple-500/30 space-y-5 animate-in slide-in-from-top-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    {isAr ? 'وصف أو اسم الفاتورة' : 'Bill Title / Description'}
                  </label>
                  <input
                    type="text"
                    value={billTitle}
                    onChange={(e) => setBillTitle(e.target.value)}
                    placeholder={isAr ? 'مثال: عشاء تشيليز، تذاكر سينما...' : 'e.g. Cinema tickets, Dinner...'}
                    className="w-full px-4 py-3 bg-[#0F131C] border border-white/10 rounded-xl text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    {isAr ? 'القيمة الإجمالية المدفوعة' : 'Total Amount Paid'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">{activeCurrency}</span>
                    <input
                      type="number"
                      value={customBillTotal || ''}
                      onChange={(e) => setCustomBillTotal(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-16 pr-4 py-3 bg-[#0D121D] border border-purple-500/30 rounded-xl text-xl font-black font-mono text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors appearance-none"
                    />
                  </div>
               </div>
            </div>
          )}

          {/* Attendees Split parameters */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300">👥 {isAr ? textDict.attendeesCountAr : textDict.attendeesCountEn}</span>
              <span className="font-mono text-purple-400 font-extrabold text-sm">{attendees} {isAr ? 'بالمجموعة' : 'Mates'}</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={attendees}
              onChange={(e) => setAttendees(parseInt(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />

            {/* Arab hospitality Driver exempt selection */}
            <div className="pt-2 border-t border-white/5">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={driverPaidExempt}
                  onChange={(e) => setDriverPaidExempt(e.target.checked)}
                  className="w-4.5 h-4.5 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-black text-amber-300 hover:opacity-90 transition-opacity">
                  {splitMode === 'food_custom' ? (isAr ? 'إعفاء المنسق لأنه المضيف' : 'Exempt leader (Host treats themselves)') : (isAr ? textDict.hospOptionAr : textDict.hospOptionEn)}
                </span>
              </label>

              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                {driverPaidExempt 
                  ? (isAr ? textDict.hospNoticeAr : textDict.hospNoticeEn)
                  : (isAr ? textDict.normalNoticeAr : textDict.normalNoticeEn)
                }
              </p>
            </div>
          </div>

        </div>

        {/* DETAILED COMPUTATION BREAKDOWN COLUMN */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-5">
          
          {splitMode === 'fuel_trip' ? (
            <div className="bg-[#0D121D]/80 rounded-2xl p-4 border border-white/10 relative overflow-hidden space-y-3 flex-1 flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-emerald-400 tracking-widest uppercase block flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  {isAr ? textDict.rateTitleAr : textDict.rateTitleEn}
                </span>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={fuelPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFuelPrice(isNaN(val) ? 0 : val);
                      setRateSource(isAr ? 'سعر مخصص (مدخل يدوياً)' : 'Custom Rate (Manual entry)');
                    }}
                    className="text-3xl font-black text-white font-mono bg-[#0D121D] border-b-2 border-dashed border-white/20 focus:border-emerald-400 focus:outline-none w-36 px-1 appearance-none"
                    style={{ MozAppearance: 'textfield' }}
                  />
                  <span className="text-xs font-bold text-slate-400">{activeCurrency} / {isAr ? 'لتر' : 'L'}</span>
                </div>
                
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span className="truncate max-w-[200px] font-medium font-mono">{rateSource}</span>
                </div>
              </div>

              {/* Core Statistics calculations readout */}
              <div className="border-t border-white/5 pt-3.5 mt-3 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{isAr ? textDict.litersNeededAr : textDict.litersNeededEn}</span>
                  <span className="font-mono font-bold text-white">{totalLitersRequired.toFixed(1)} {isAr ? 'لتر' : 'L'}</span>
                </div>
                
                <div className="flex justify-between items-center border-t border-white/5 pt-2.5">
                  <span className="text-slate-400 font-medium">{isAr ? textDict.totalTripBillAr : textDict.totalTripBillEn}</span>
                  <span className="font-mono font-black text-amber-400 text-lg">{totalCost.toFixed(1)} {activeCurrency}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0D121D]/80 rounded-2xl p-4 border border-white/10 relative overflow-hidden space-y-3 flex-1 flex flex-col justify-center items-center">
               <span className="text-xl">🍔</span>
               <p className="text-sm font-bold text-purple-400">{isAr ? 'تم تقسيم الفاتورة' : 'Bill split configured'}</p>
            </div>
          )}

          {/* Passenger split output display board */}
          <div className="bg-gradient-to-br from-[#121A28] to-[#0A0E15] p-5 rounded-2xl border border-white/10 space-y-4">
            
            <div>
              <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block">
                {isAr ? textDict.perPassengerShareAr : textDict.perPassengerShareEn}
              </span>
              
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="text-4xl font-black text-emerald-400 font-mono drop-shadow-md">
                  {individualShare.toFixed(2)}
                </span>
                <span className="text-xs font-black text-slate-300 ml-1">
                  {activeCurrency}
                </span>
              </div>
            </div>

            {/* Visual Breakdown Chart */}
            {totalCost > 0 && (
              <div className="bg-[#0D121D] p-4 rounded-2xl border border-white/10 h-48 relative group">
                <div className="absolute top-2 left-4 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <PieIcon className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'توزيع التكاليف' : 'Cost Distribution'}</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: isAr ? 'السائق' : 'Driver', value: driverPaidExempt ? 0 : individualShare },
                        ...Array.from({ length: attendees - 1 }).map((_, idx) => ({
                          name: isAr ? `مرافق ${idx + 1}` : `Mate ${idx + 1}`,
                          value: individualShare
                        }))
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'Driver', color: '#10b981' },
                        ...Array.from({ length: attendees - 1 }).map((_, idx) => ({ name: `Mate ${idx + 1}`, color: `#${Math.floor(Math.random() * 16777215).toString(16)}` }))
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 && !driverPaidExempt ? '#10b981' : index === 0 && driverPaidExempt ? '#6366f1' : `hsl(${index * (360 / attendees)}, 70%, 60%)`} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F131C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* List representatives preview */}
            <div className="space-y-2 pt-2 border-t border-white/5 max-h-[140px] overflow-y-auto">
              
              {/* Leader position */}
              <div className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white/5 border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-base select-none">👑</span>
                  <span className="font-bold text-slate-200">
                    {isAr ? 'المنسق (قائد المشوار)' : 'Leader (Designated Driver)'}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-black text-slate-400">
                  {driverPaidExempt 
                    ? (isAr ? textDict.driverExemptTitleAr : textDict.driverExemptTitleEn) 
                    : `${individualShare.toFixed(1)} ${activeCurrency}`
                  }
                </span>
              </div>

              {/* Companions loop */}
              {Array.from({ length: attendees - 1 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 font-bold font-mono">#{idx + 1}</span>
                    <span className="font-bold text-slate-300">
                      {isAr ? `الرفيق الراكب ${idx + 1}` : `Companions Rider ${idx + 1}`}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-black text-emerald-400">
                    {individualShare.toFixed(1)} {activeCurrency}
                  </span>
                </div>
              ))}

              {/* Handlers warnings for single user */}
              {attendees === 1 && (
                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center text-[10px] text-indigo-300 font-bold">
                  ⚠️ {isAr ? textDict.singleRiderAr : textDict.singleRiderEn}
                </div>
              )}
            </div>

            {/* Copy Action Button */}
            <button
              onClick={handleCopySummary}
              className={`w-full py-3.5 rounded-xl font-black text-xs transition-all tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                copied 
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/10'
              }`}
            >
              {copied ? <Check className="w-4 h-4 animate-bounce" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? (isAr ? textDict.successCopyAr : textDict.successCopyEn) : (isAr ? textDict.shareButtonAr : textDict.shareButtonEn)}</span>
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
