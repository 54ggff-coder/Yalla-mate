/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Outing, OutingReview } from '../types';
import { categoryMeta } from '../constants';
import { Users, Car, ShieldAlert, Award, ArrowRight, Star } from 'lucide-react';
import { translations, Language } from '../data/translations';

interface OutingCardProps {
  outing: Outing;
  currentUserTrustScore: number;
  onSelect: (outingId: string) => void;
  onCategoryClick?: (category: string) => void;
  lang: Language;
  key?: string;
  companionReviews?: OutingReview[];
  index?: number;
}

const resolveCoverImage = (img?: string) => {
  if (!img) return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop';
  if (img === 'arab_cafe_night') return '/src/assets/images/arab_cafe_night_1780873407256.png';
  if (img === 'scenic_night_drive') return '/src/assets/images/scenic_night_drive_1780873420312.png';
  if (img === 'gaming_pool_lounge') return '/src/assets/images/gaming_pool_lounge_1780873435319.png';
  return img; // remote URL fallbacks
};

export default function OutingCard({ 
  outing, 
  currentUserTrustScore, 
  onSelect, 
  onCategoryClick, 
  lang, 
  companionReviews = [],
  index = 0
}: OutingCardProps) {
  const meta = categoryMeta[outing.category];
  const isTooLowTrust = currentUserTrustScore < outing.minTrustScore;
  const t = translations[lang];
  const isFull = (outing.attendeeIds?.length || 0) >= outing.maxAttendees;

  const getGenderBadge = () => {
    const restriction = outing.genderRestriction || 'co_ed';
    switch (restriction) {
      case 'men_only':
        return {
          text: lang === 'ar' ? 'للرجال فقط 🧔' : 'Men Only 🧔',
          style: 'bg-blue-50/70 border-blue-100 text-blue-700'
        };
      case 'women_only':
        return {
          text: lang === 'ar' ? 'للإناث فقط 👩' : 'Women Only 👩',
          style: 'bg-purple-50/70 border-purple-100 text-purple-700'
        };
      default:
        return {
          text: lang === 'ar' ? 'مشتركة ★9.0+' : 'Co-Ed ★9.0+',
          style: 'bg-amber-50/70 border-amber-100 text-amber-800'
        };
    }
  };

  const getStatusColor = () => {
    switch (outing.status) {
      case 'ongoing': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'cancelled': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-105';
    }
  };

  const statusLabel = () => {
    if (lang === 'ar') {
      switch (outing.status) {
        case 'ongoing': return 'جارية الآن ⚡';
        case 'completed': return 'مكتملة مسبقاً ✓';
        case 'cancelled': return 'ملغية ✕';
        default: return 'قادمة قريباً';
      }
    }
    return outing.status.charAt(0).toUpperCase() + outing.status.slice(1);
  };

  return (
    <motion.div 
      id={`card_${outing.id}`}
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.15)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        type: "spring", 
        stiffness: 260, 
        damping: 20, 
        delay: Math.min(index * 0.05, 0.5) 
      }}
      className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm transition-all duration-300 hover:border-green-300 flex flex-col justify-between group/card"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div>
        {/* Aesthetic Cover Art Block */}
        <div className="relative h-44 rounded-2xl overflow-hidden mb-4 shadow-inner group cursor-pointer" onClick={() => onSelect(outing.id)}>
          <img
            src={resolveCoverImage(outing.coverImage)}
            alt={outing.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent pointer-events-none" />
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onCategoryClick?.(outing.category); }}
            className={`absolute bottom-3 ${lang === 'ar' ? 'right-3' : 'left-3'} px-2.5 py-1 bg-white/80 hover:bg-white backdrop-blur-md text-green-700 hover:text-green-800 border border-green-100 text-[10px] font-black rounded-lg transition-all shadow-sm cursor-pointer hover:scale-105`}
          >
            {meta?.icon || '✨'} {lang === 'ar' ? meta?.nameAr : outing.category}
          </button>
          <span className={`absolute top-3 ${lang === 'ar' ? 'left-3' : 'right-3'} px-2.5 py-1 bg-gray-900/60 border border-white/10 backdrop-blur-md text-white text-[9px] font-bold rounded-lg uppercase tracking-widest`}>
            ★ {outing.minTrustScore.toFixed(1)} Min Trust
          </span>
          {isFull && (
            <span className={`absolute top-3 ${lang === 'ar' ? 'right-3' : 'left-3'} px-2.5 py-1 bg-rose-500/90 backdrop-blur-md text-white text-[9px] font-bold rounded-lg uppercase tracking-widest`}>
               {lang === 'ar' ? 'ممتلئة' : 'Full'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {outing.isBlindOuting && (
            <span className="px-2.5 py-0.5 border rounded-full text-[9px] font-extrabold bg-blue-50 border-blue-100 text-blue-700 uppercase tracking-widest">
              🕶️ {lang === 'ar' ? 'رحلة عمياء' : 'Blind Outing'}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCategoryClick?.(outing.category); }}
            className={`px-2.5 py-0.5 border rounded-full text-[9px] font-extrabold uppercase tracking-widest ${outing.isBlindOuting ? 'opacity-0 scale-0 w-0 h-0 p-0 overflow-hidden absolute' : 'bg-green-50 border-green-100 text-green-700 hover:bg-green-100 transition-colors cursor-pointer'}`}
          >
            {meta?.icon || '✨'} {lang === 'ar' ? meta?.nameAr : outing.category}
          </button>
          <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-extrabold uppercase tracking-widest ${
            outing.status === 'ongoing' ? 'bg-amber-50 border-amber-100 text-amber-700' :
            outing.status === 'completed' ? 'bg-gray-100 border-gray-200 text-gray-600' :
            outing.status === 'cancelled' ? 'bg-red-50 border-red-100 text-red-700' :
            'bg-blue-50 border-blue-100 text-blue-700'
          }`}>
            {statusLabel()}
          </span>
          <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-extrabold uppercase tracking-widest ${
             outing.genderRestriction === 'men_only' ? 'bg-sky-50 border-sky-100 text-sky-700' :
             outing.genderRestriction === 'women_only' ? 'bg-pink-50 border-pink-100 text-pink-700' :
             'bg-amber-50 border-amber-100 text-amber-800'
          }`}>
            {getGenderBadge().text}
          </span>
        </div>

        <h3 className="font-display font-black text-gray-900 leading-snug text-base tracking-tight group-hover/card:text-green-600 transition-colors truncate cursor-pointer" onClick={() => onSelect(outing.id)}>
          {outing.isBlindOuting ? (lang === 'ar' ? 'الوجهة مجهولة حتى اللقاء' : 'Destination Revealed at Meetup') : outing.title}
        </h3>

        {/* Average Rating Stars */}
        {(() => {
          const outingReviews = (companionReviews || []).filter(r => r.outingId === outing.id);
          const hasReviews = outingReviews.length > 0;
          const averageRating = hasReviews
            ? outingReviews.reduce((sum, r) => sum + (r.respectfulRating + r.punctualRating + r.paymentRating + (r.friendlyRating || 5)) / 4, 0) / outingReviews.length
            : undefined;

          if (averageRating !== undefined && averageRating > 0) {
            return (
              <div className="flex items-center gap-1.5 mt-1.5" title={`${averageRating.toFixed(1)} / 5 (${outingReviews.length} ${lang === 'ar' ? 'تقييمات' : 'reviews'})`}>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= Math.round(averageRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-200 dark:text-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-amber-500 font-extrabold mt-0.5">
                  {averageRating.toFixed(1)} <span className="text-gray-400 font-medium">({outingReviews.length})</span>
                </span>
              </div>
            );
          }
          
          return null;
        })()}

        <p className="text-[11px] text-gray-600 line-clamp-2 mt-2 leading-loose">
          {outing.isBlindOuting ? (lang === 'ar' ? 'التفاصيل مخفية للتشويق' : 'Details hidden for excitement.') : (outing.description || 'No description provided.')}
        </p>

        {/* Location & Time details */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            📍 <span className="text-gray-800 font-black">{lang === 'ar' ? outing.city : outing.city}</span>, {outing.isBlindOuting ? '???' : outing.location}
          </span>
          <span className="flex items-center gap-1.5">
            📅 {new Date(outing.datetime).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-2">
        {/* Creator Info */}
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl shadow-inner select-none">
            {outing.creatorAvatar}
          </span>
          <div>
            <div className="text-xs font-black text-gray-900 flex items-center gap-1.5 leading-none">
              {outing.creatorName}
              {outing.creatorTrust >= 4.8 && (
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
              )}
            </div>
            <span className="text-[9px] text-gray-500 block mt-1 tracking-widest uppercase font-bold">
              <span className="text-amber-500">★ {outing.creatorTrust.toFixed(1)}</span> {t.trustScore}
            </span>
          </div>
        </div>

        {/* Action controls */}
        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1 justify-end mb-1.5 tracking-widest uppercase">
            <Users className="w-3.5 h-3.5 text-green-500" />
            <span>{outing.attendeeIds?.length || 0} / {outing.maxAttendees} {t.membersCountText}</span>
          </div>

          {outing.logistics.hasDriver && (
            <div className={`flex items-center justify-end gap-1.5 text-[9px] text-green-600 font-bold mb-2 tracking-widest uppercase`}>
              <Car className="w-3.5 h-3.5" />
              <span>{t.driverNoticeActive}</span>
            </div>
          )}

          {isTooLowTrust ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-red-700 bg-red-50 border border-red-100 shadow-inner rounded-xl font-bold leading-none uppercase tracking-widest">
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              <span>★ {outing.minTrustScore.toFixed(1)}+</span>
            </div>
          ) : (
            <button
              id={`btn_join_view_${outing.id}`}
              onClick={() => onSelect(outing.id)}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 group cursor-pointer uppercase tracking-widest"
            >
              <span>{t.viewOutingBtn}</span> <ArrowRight className={`w-3.5 h-3.5 group-hover:translate-x-1 transition-transform ${lang === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
