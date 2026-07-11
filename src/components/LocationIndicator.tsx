import React from 'react';
import { useLocation } from '../contexts/LocationContext';
import { MapPin, RefreshCw } from 'lucide-react';

export default function LocationIndicator({ lang, className = '' }: { lang: 'en' | 'ar', className?: string }) {
  const { address, lastUpdated, loading, error, requestLocation } = useLocation();
  const isAr = lang === 'ar';

  if (loading) {
    return (
      <div className={`flex items-center justify-center text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1 w-max mx-auto shadow-sm ${className}`}>
        <RefreshCw className="w-3 h-3 mr-1 ml-1 animate-spin text-primary-500" />
        <span>{isAr ? 'جاري تحديد الموقع...' : 'Detecting location...'}</span>
      </div>
    );
  }

  if (error || !address) {
    return (
      <div 
        onClick={() => requestLocation()}
        className={`flex items-center justify-center text-xs text-rose-500 bg-rose-50 rounded-full px-3 py-1 w-max mx-auto shadow-sm cursor-pointer hover:bg-rose-100 ${className}`}
      >
        <MapPin className="w-3 h-3 mr-1 ml-1" />
        <span>{isAr ? 'انقر لتحديث الموقع' : 'Tap to update location'}</span>
      </div>
    );
  }

  const city = address.city || address.town || address.village || (address as any).state || (isAr ? 'موقع التقريبي' : 'Approximate Location');
  const timeString = lastUpdated ? new Date(lastUpdated).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div 
      onClick={() => requestLocation()}
      className={`flex items-center justify-center text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 w-max mx-auto shadow-sm cursor-pointer hover:bg-slate-50 transition-colors ${className}`}
    >
      <MapPin className="w-3 h-3 mr-1.5 ml-1.5 text-primary-500" />
      <span className="font-semibold mx-1">{city}</span>
      {timeString && (
        <>
          <span className="opacity-50 mx-1.5">•</span>
          <span className="opacity-70 tracking-tight">{timeString}</span>
        </>
      )}
    </div>
  );
}
