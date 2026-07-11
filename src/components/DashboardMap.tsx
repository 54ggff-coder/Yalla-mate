import React from 'react';
import { Outing } from '../types';
import { categoryMeta } from '../constants';
import { Language } from '../data/translations';
import { 
  Sparkles, 
  Map as MapIcon, 
  Navigation
} from 'lucide-react';

interface DashboardMapProps {
  outings: Outing[];
  currentUserTrustScore: number;
  onSelectOuting: (outingId: string) => void;
  lang: Language;
  userCoordinates?: { lat: number; lng: number } | null;
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Camp': return 'bg-orange-500';
    case 'Coffee': return 'bg-amber-600';
    case 'Restaurant': return 'bg-rose-500';
    case 'Desert Trip': return 'bg-yellow-600';
    case 'Cinema': return 'bg-purple-500';
    case 'Bowling': return 'bg-pink-500';
    case 'Billiards': return 'bg-blue-500';
    case 'Football': return 'bg-green-600';
    case 'Sports Activities': return 'bg-teal-500';
    default: return 'bg-indigo-500';
  }
};

export default function DashboardMap({ outings, onSelectOuting, lang, userCoordinates }: DashboardMapProps) {
  const isAr = lang === 'ar';
  const outingsWithCoords = (outings || []).filter(o => o.mapCoordinates);

  return (
    <div className="space-y-4">
      {/* Dynamic Map Heading / Indicator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-gray-100 px-4 py-3 rounded-2xl gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span className="text-xs font-bold text-gray-700">
            {isAr ? '🗺️ استكشف أماكن ومواقع الطلعات' : '🗺️ Explore Outing Locations'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {userCoordinates && (
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
               <div className="w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md text-lg">
                 📍
               </div>
               <div>
                 <h4 className="font-black text-slate-800 text-sm">{isAr ? 'موقعك الحالي' : 'Your Location'}</h4>
               </div>
            </div>
            <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${userCoordinates.lat},${userCoordinates.lng}`, '_blank')}
              className="w-full py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <Navigation className="w-3.5 h-3.5" />
              {isAr ? 'عرض على الخريطة' : 'View on Map'}
            </button>
          </div>
        )}
        
        {outingsWithCoords.map((outing) => {
          const meta = categoryMeta[outing.category as any] || { icon: '📍' };
          const colorClass = getCategoryColor(outing.category);
          return (
            <div key={outing.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 ${colorClass} text-white rounded-full flex items-center justify-center shadow-md shrink-0 text-lg`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-800 text-sm truncate">{outing.title}</h4>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider truncate">
                    {isAr ? categoryMeta[outing.category as any]?.nameAr || outing.category : outing.category}
                  </p>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{outing.location}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <button 
                  onClick={() => onSelectOuting(outing.id)}
                  className="py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  {isAr ? 'تفاصيل' : 'Details'}
                </button>
                <button 
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${outing.mapCoordinates!.lat},${outing.mapCoordinates!.lng}`, '_blank')}
                  className="py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                >
                  <MapIcon className="w-3 h-3" />
                  {isAr ? 'الخريطة' : 'Map'}
                </button>
              </div>
            </div>
          );
        })}
        {outingsWithCoords.length === 0 && !userCoordinates && (
          <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
             <MapIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
             <p className="text-sm font-bold text-slate-500">{isAr ? 'لا توجد مواقع لعرضها' : 'No locations to display'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
