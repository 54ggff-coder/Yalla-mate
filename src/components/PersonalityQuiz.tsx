import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Award, ChevronRight, HelpCircle } from 'lucide-react';

interface Question {
  id: number;
  textEn: string;
  textAr: string;
  options: {
    textEn: string;
    textAr: string;
    archetype: string;
  }[];
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    textEn: "What's your ultimate target for a weekend afternoon?",
    textAr: "ما هو هدفك الأساسي لطلعة عطلة نهاية الأسبوع؟",
    options: [
      { textEn: "Designing a master schedule and picking optimal routes", textAr: "تصميم جدول منظم واختيار أفضل الطرق والمسارات", archetype: "The Ultimate Organizer" },
      { textEn: "Gathering as many people as possible and playing board games", textAr: "جمع أكبر عدد من الأصدقاء ولعب الألعاب الجماعية", archetype: "The Social Catalyst" },
      { textEn: "Sitting quietly in a serene park with some nice tea during sunset", textAr: "الجلوس بهدوء في منتزه طبيعي مع شاي رائع وقت الغروب", archetype: "The Scenic Wanderer" },
      { textEn: "Exploring a brand new specialty coffee corner or a burger joint", textAr: "استكشاف ركن قهوة مختصة جديد كلياً أو مطعم برجر نادراً", archetype: "The Culinary Nomad" },
    ]
  },
  {
    id: 2,
    textEn: "How do you prefer to handle outing expenses?",
    textAr: "كيف تفضل التعامل مع مصاريف وبيل الطلعة عادةً؟",
    options: [
      { textEn: "Splitting the bill strictly down to the penny via a smart ledger", textAr: "تقسيم الفاتورة بدقة وحساب الهلل عبر جداول حساب ذكية", archetype: "The Ultimate Organizer" },
      { textEn: "Covering it all and letting mates pay back spontaneously whenever", textAr: "دفع الفاتورة بالكامل وتسهيل الأمر على الرفقاء كلياً", archetype: "The Social Catalyst" },
      { textEn: "We share whatever we ordered individually, no pressure at all", textAr: "كل شخص يدفع ما طلبه تحديداً دون إحراج أو تعقيد", archetype: "The Scenic Wanderer" },
      { textEn: "Trying out gourmet dishes together and testing premium menus", textAr: "تذوق أطباق جديدة معاً بغض النظر عن السعر والتفاصيل", archetype: "The Culinary Nomad" },
    ]
  },
  {
    id: 3,
    textEn: "What is your peak socializing timezone?",
    textAr: "ما هي فترة التوقيت المفضلة والنشطة لطلعاتك؟",
    options: [
      { textEn: "Early morning breakfast gatherings with clear agendas", textAr: "فطور الصباح الباكر وبداية اليوم مع خطة واضحة", archetype: "The Ultimate Organizer" },
      { textEn: "Sunset golden hour, transitioning into bustling evening events", textAr: "ساعة الغروب الذهبية الممتدة إلى مناسبات المساء الحيوية", archetype: "The Social Catalyst" },
      { textEn: "A relaxed afternoon stroll or a desert camp under clear clouds", textAr: "مشوار مريح بالمساء أو تخييم في البر تحت الغيوم الصافية", archetype: "The Scenic Wanderer" },
      { textEn: "Late-night spontaneous walks, stargazing and 2 AM warm drinks", textAr: "المشاوير الليلية المتأخرة، تأمل النجوم ومشروبات الساعة 2 ص", archetype: "The Late-Night Legend" },
    ]
  },
  {
    id: 4,
    textEn: "How do you act when meeting complete strangers on a joint outing?",
    textAr: "كيف تتصرف عندما تلتقي بأشخاص جدد تماماً في طلعة مشتركة؟",
    options: [
      { textEn: "Reviewing their profiles & trust scores first to ensure standard match", textAr: "أتحقق من حساباتهم ومعدلات الثقة أولاً لضمان تجربة آمنة", archetype: "The Ultimate Organizer" },
      { textEn: "Starting jokes immediately and breaking the ice within 2 minutes", textAr: "أبدأ بإلقاء الدعابات مباشرةً وأكسر الجليد خلال دقيقتين فقط", archetype: "The Social Catalyst" },
      { textEn: "Listening closely to their stories and sharing deep, meaningful views", textAr: "أستمع باهتمام لقصصهم ونتبادل أطراف الأحاديث العميقة الهادئة", archetype: "The Scenic Wanderer" },
      { textEn: "Sharing best dine-out lists and suggesting exquisite food spots", textAr: "أوصي بأفضل المطاعم والمقاهي وأتبادل معهم أماكن الأكل المفضلة", archetype: "The Culinary Nomad" },
    ]
  },
  {
    id: 5,
    textEn: "Your ideal setting for an outdoor getaway is...",
    textAr: "المكان أو النشاط الخارجي المثالي والمفضل لديك هو...",
    options: [
      { textEn: "A structured city-walk tour visiting designated museums & spaces", textAr: "جولة مشي منظمة بالمدينة لزيارة المتاحف والمعالم والمساحات الفنية", archetype: "The Ultimate Organizer" },
      { textEn: "An intense group game center, bowling, or karting challenge", textAr: "تحدي كارتنج، بولينج أو صالة ألعاب جماعية تملؤها الحماسة", archetype: "The Social Catalyst" },
      { textEn: "A hillside overlook, breathing fresh air and watching city lights", textAr: "مطل جبلي رائع، استنشاق الهواء النقي ومشاهدة أضواء المدينة", archetype: "The Scenic Wanderer" },
      { textEn: "A high-end restaurant food lounge, testing culinary innovations", textAr: "ردهة مطعم عالي الطراز، لتجربة ابتكارات الطهي الفاخرة", archetype: "The Culinary Nomad" },
    ]
  }
];

interface PersonalityQuizProps {
  lang: 'en' | 'ar';
  currentArchetype?: string;
  onComplete: (archetype: string) => void;
  onClose: () => void;
}

export default function PersonalityQuiz({ lang, currentArchetype, onComplete, onClose }: PersonalityQuizProps) {
  const isAr = lang === 'ar';
  const [currentStep, setCurrentStep] = useState<number>(-1); // -1 = Welcome screen
  const [answers, setAnswers] = useState<string[]>([]);

  const handleStart = () => {
    setAnswers([]);
    setCurrentStep(0);
  };

  const handleSelectOption = (archetype: string) => {
    const nextAnswers = [...answers, archetype];
    setAnswers(nextAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Calculate most selected archetype
      const freq: Record<string, number> = {};
      nextAnswers.forEach(ans => frequencyIncrement(freq, ans));

      let bestArchetype = nextAnswers[0];
      let maxCount = 0;
      Object.entries(freq).forEach(([key, value]) => {
        if (value > maxCount) {
          maxCount = value;
          bestArchetype = key;
        }
      });

      onComplete(bestArchetype);
      setCurrentStep(QUESTIONS.length); // Completion screen
    }
  };

  const frequencyIncrement = (freq: Record<string, number>, key: string) => {
    freq[key] = (freq[key] || 0) + 1;
  };

  // Archetype localized desc
  const getArchetypeMeta = (arch: string) => {
    switch (arch) {
      case "The Ultimate Organizer":
        return {
          emoji: "📋",
          titleAr: "المنسّق المتميز",
          descEn: "You love structure, planning, and ensuring everyone stays synchronized on every outing. A true legendary planner!",
          descAr: "عاشق للنظام والترتيب، تحرص على تنسيق المواعيد والمسارات بدقة لتضمن للرفقاء تجربة متكاملة وأوقات رائعة!"
        };
      case "The Social Catalyst":
        return {
          emoji: "🎉",
          titleAr: "شعلة الحماسة واللقاء",
          descEn: "You are the absolute life of the gathering! You connect souls, ignite positivity, and break ice effortlessly.",
          descAr: "أنت القلب النابض لأي تجمع! تملك كاريزما استثنائية لصناعة الفرح وجمع الرفقاء وكسر الجليد بثوانٍ!"
        };
      case "The Scenic Wanderer":
        return {
          emoji: "🌲",
          titleAr: "المستكشف الحالم",
          descEn: "You love tranquil nature spots, scenic overlooks, sunsets, and deep soul-stirring conversations with friends.",
          descAr: "من محبي الهدوء وجمال الطبيعة، تستهويك المطلات والحدائق ومحادثات الروح العميقة بعيداً عن صخب الحياة."
        };
      case "The Culinary Nomad":
        return {
          emoji: "☕",
          titleAr: "رحّالة المذاق والأكل",
          descEn: "You are on a constant adventure to taste the finest coffee blends, exotic cuisines, and gourmet meals with companions.",
          descAr: "شغوف باستكشاف الجديد في عالم القهوة والمطالعم، وتجيد اختيار الأطباق المميزة لتجعل كل طلعة وليمة حقيقية!"
        };
      case "The Late-Night Legend":
      default:
        return {
          emoji: "🌙",
          titleAr: "أسطورة المشاوير الليلية",
          descEn: "Spontaneous night hours, quiet starry walks, and cozy midnight gatherings are where your high vibes thrive.",
          descAr: "تتحلى بقمة نشاطك وراحتك في اللقاءات المتأخرة، وتفضل المشي تحت النجوم ومجالس السمر الهادئة بالليل!"
        };
    }
  };

  const currentQuestion = QUESTIONS[currentStep];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden text-gray-950 dark:text-white" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Wave Background Element */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {currentStep === -1 ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex flex-col items-center justify-center text-center py-6 space-y-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Brain className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {isAr ? 'اختبار تكتشف فيه نمط شخصيتك' : 'What is your Outing Archetype?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mx-auto">
                {isAr 
                  ? 'أجب على 5 أسئلة سريعة لنحدد طابعك الفريد وإضافة وسم مميز يظهر للرفقاء بملفك الشخصي!' 
                  : 'Answer 5 quick questions to identify your unique social personality archetype and pin it as a legendary badge of vibe!'}
              </p>
            </div>

            {currentArchetype && (
              <div className="bg-slate-50 dark:bg-slate-800/65 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isAr ? 'نمطك الحالي:' : 'Your current style:'} <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{currentArchetype}</span>
              </div>
            )}

            <div className="flex w-full gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-205 dark:bg-slate-805 text-slate-600 dark:text-slate-300 font-black text-xs py-3 rounded-2xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Close'}
              </button>
              <button
                onClick={handleStart}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-2xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-350 animate-pulse" />
                {isAr ? 'ابدأ الاختبار السريع' : 'Start Quick Assessment'}
              </button>
            </div>
          </motion.div>
        ) : currentStep < QUESTIONS.length ? (
          <motion.div
            key={`question_${currentStep}`}
            initial={{ opacity: 0, x: isAr ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 30 : -30 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="space-y-5 py-2"
          >
            {/* Header progress info */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {isAr ? 'اختبار النمط الاجتماعي' : 'Archetype Assessment'}
              </span>
              <span className="text-xs font-extrabold text-indigo-550 dark:text-indigo-400 font-mono">
                {currentStep + 1} / {QUESTIONS.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 105}%` }}
              />
            </div>

            {/* Question Text */}
            <div className="space-y-1 pt-1.5">
              <div className="text-[10px] font-black text-indigo-500 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                {isAr ? 'سؤال تفاعلي' : 'Interactive Inquiry'}
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white leading-relaxed">
                {isAr ? currentQuestion.textAr : currentQuestion.textEn}
              </h4>
            </div>

            {/* Options List */}
            <div className="space-y-2.5">
              {currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectOption(opt.archetype)}
                  className="w-full bg-slate-50 hover:bg-indigo-50/50 dark:bg-slate-850 dark:hover:bg-slate-800 border-2 border-slate-100/50 hover:border-indigo-450 dark:border-slate-800 dark:hover:border-indigo-550 rounded-2xl p-3.5 text-right sm:text-left transition-all text-xs font-semibold leading-relaxed flex items-center justify-between group cursor-pointer"
                >
                  <span className="text-slate-800 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white">
                    {isAr ? opt.textAr : opt.textEn}
                  </span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-350 dark:text-slate-500 group-hover:text-indigo-500 ${isAr ? 'rotate-180' : ''} shrink-0`} />
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="finish"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center text-center py-6 space-y-5"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-150 shadow-inner">
              <Award className="w-8 h-8 text-amber-400 animate-bounce" />
            </div>

            <div className="space-y-1.5 max-w-sm">
              <span className="text-[9px] font-black tracking-widest text-emerald-500 uppercase">
                {isAr ? '¡تم تحليل النمط الاجتماعي!' : 'Assessment Complete!'}
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {isAr ? getArchetypeMeta(answers[0] || '').titleAr : answers[0]} {getArchetypeMeta(answers[0] || '').emoji}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-1">
                {isAr ? getArchetypeMeta(answers[0] || '').descAr : getArchetypeMeta(answers[0] || '').descEn}
              </p>
            </div>

            <div className="w-full bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 border border-indigo-150/40 dark:border-indigo-950 p-4 rounded-2xl text-right sm:text-left text-[11px] leading-relaxed relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="font-extrabold text-slate-800 dark:text-white mb-1">
                {isAr ? '✨ إضافة وسم نمطك للملف' : '✨ Pinned archetype profile badge'}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {isAr 
                  ? 'سيتم عرض هذا الوسام الرائع بجانب اسمك، ليتمكن المنظمون والمشاركون بالطلعات من معرفة أجواءك الرائعة مسبقاً.'
                  : 'This badge is now proudly pinned underneath your avatar so other mates can appreciate your unique social vibe on future meetups!'}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 font-black text-xs py-3.5 rounded-2xl transition-opacity cursor-pointer shadow-md"
            >
              {isAr ? 'العودة للملف' : 'Return to Profile'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
