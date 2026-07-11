import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Language } from '../data/translations';

interface StaticMapPreviewProps {
  lat?: number;
  lng?: number;
  label?: string;
  lang: Language;
  isOngoing?: boolean;
}

const StaticMapPreview = React.memo(({ lat, lng, label, lang, isOngoing }: StaticMapPreviewProps) => {
  const openGoogleMaps = () => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    }
  };

  return (
    <div 
      className="relative w-full h-[300px] rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-[#0a0d14] flex flex-col items-center justify-center group cursor-pointer"
      onClick={openGoogleMaps}
    >
      {/* Abstract Map Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      
      <div className="z-10 bg-indigo-500/10 border border-indigo-500/30 p-6 rounded-full group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
        <MapPin className="w-12 h-12 text-indigo-400" />
      </div>
      
      <div className="z-10 mt-6 text-center space-y-2">
        <h4 className="text-white font-bold text-lg">{label || (lang === 'ar' ? 'عرض على الخريطة' : 'View on Map')}</h4>
        <p className="text-slate-400 text-sm max-w-[250px]">
          {lang === 'ar' ? 'انقر لفتح الخريطة في تطبيق خرائط جوجل الخارجي' : 'Click to open map interface in external Google Maps app'}
        </p>
      </div>

      <button className="absolute bottom-6 px-6 py-3 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-slate-200 transition-colors z-10 shadow-xl">
        <Navigation className="w-4 h-4" />
        {lang === 'ar' ? 'افتح خرائط جوجل' : 'Open Google Maps'}
      </button>

      {isOngoing && (
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2 z-10 shadow-lg">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
          {lang === 'ar' ? 'تتبع مباشر نشط' : 'Live Tracking Active'}
        </div>
      )}
    </div>
  );
});

StaticMapPreview.displayName = 'StaticMapPreview';

export default StaticMapPreview;
