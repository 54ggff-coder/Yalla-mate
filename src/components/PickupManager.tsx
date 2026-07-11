import React, { useState } from 'react';
import { Outing, Profile, PickupRequest } from '../types';
import { Language } from '../data/translations';
import { Car, MapPin, CheckCircle, Navigation, Compass, PhoneCall, MessageSquare } from 'lucide-react';
import PlaceAutocompleteInput from './PlaceAutocompleteInput';

interface PickupManagerProps {
  outing: Outing;
  currentUser: Profile;
  lang: Language;
  onUpdateOuting: (outing: Outing) => void;
}

export default function PickupManager({ outing, currentUser, lang, onUpdateOuting }: PickupManagerProps) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [pickupLoc, setPickupLoc] = useState('');
  const [pickupLat, setPickupLat] = useState<number | undefined>();
  const [pickupLng, setPickupLng] = useState<number | undefined>();
  const [pickupUrl, setPickupUrl] = useState('');

  const isDriver = outing.logistics?.driverId === currentUser.id || outing.logistics?.driverName === currentUser.name;
  const pickups = outing.logistics?.pickups || [];
  
  const myPickup = pickups.find(p => p.passengerId === currentUser.id);

  const togglePickupMode = () => {
    const updatedLogistics = {
      ...outing.logistics,
      isActivePickupMode: !outing.logistics?.isActivePickupMode
    };
    onUpdateOuting({ ...outing, logistics: updatedLogistics });
  };

  const handleRequestPickup = () => {
    if (!pickupLoc) return;
    
    const newRequest: PickupRequest = {
      id: Math.random().toString(),
      passengerId: currentUser.id,
      passengerName: currentUser.name,
      passengerAvatar: currentUser.avatar,
      pickupType: 'custom_location',
      customAddress: pickupLoc,
      googleMapsUrl: pickupUrl,
      lat: pickupLat,
      lng: pickupLng,
      status: 'pending'
    };

    const updatedLogistics = {
      ...outing.logistics,
      hasDriver: true,
      pickups: [...pickups, newRequest]
    };

    onUpdateOuting({ ...outing, logistics: updatedLogistics });
    setShowRequestForm(false);
  };

  const handleUpdateStatus = (pickupId: string, newStatus: 'accepted' | 'boarded') => {
    const updatedPickups = pickups.map(p => p.id === pickupId ? { ...p, status: newStatus } : p);
    onUpdateOuting({ ...outing, logistics: { ...outing.logistics!, pickups: updatedPickups } });
  };

  if (outing.status === 'completed' && isDriver) {
    const totalDistance = Math.floor(Math.random() * 40) + 15; // Fake distance between 15-55 km
    const totalCost = outing.logistics?.fuelSharingPrice || 0;
    
    return (
      <div className="bg-[#0B0E14]/80 backdrop-blur-md rounded-3xl p-5 border border-indigo-500/20 shadow-xl space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          {lang === 'ar' ? 'ملخص رحلة السائق' : 'Driver Trip Summary'}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-center">
            <span className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{lang === 'ar' ? 'المسافة المقطوعة' : 'Distance'}</span>
            <span className="text-xl font-bold text-white">{totalDistance} <span className="text-sm text-slate-400">km</span></span>
          </div>
          <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 text-center">
            <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{lang === 'ar' ? 'اجمالي تكلفة الوقود' : 'Fuel Split'}</span>
            <span className="text-xl font-bold text-white">{totalCost} <span className="text-sm text-slate-400">SAR</span></span>
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center">{lang === 'ar' ? 'تمت الرحلة بنجاح. شكراً لتوصيل رفاقك!' : 'Trip successfully completed. Thanks for driving your mates!'}</p>
      </div>
    );
  }

  const isOngoing = outing.status === 'ongoing';

  const allBoarded = pickups.length > 0 && pickups.every(p => p.status === 'boarded');
  const allLocationsSaved = pickups.every(p => p.lat && p.lng);

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5 mt-6">
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <h3 className="text-sm font-black text-indigo-400 flex items-center gap-2 uppercase tracking-widest leading-none">
          <Car className="w-5 h-5" />
          {lang === 'ar' ? 'نظام النقل والاستلام' : 'Pickup & Ride System'}
        </h3>
        {isDriver && (
          <button
            onClick={togglePickupMode}
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${outing.logistics?.isActivePickupMode ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            {outing.logistics?.isActivePickupMode ? (lang === 'ar' ? 'الوضع نشط' : 'Active') : (lang === 'ar' ? 'تفعيل الوضع' : 'Toggle Active')}
          </button>
        )}
      </div>

      {outing.logistics?.isActivePickupMode ? (
        isDriver ? (
        <div className="space-y-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {lang === 'ar' ? 'لوحة القيادة (الكابتن)' : 'Driver Dashboard'}
          </p>
          
          {isOngoing && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse">
                  <Car className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">{lang === 'ar' ? 'الوقت المقدر للوصول' : 'Estimated Time of Arrival'}</span>
                  <p className="text-xl font-bold text-white leading-none">12 <span className="text-sm font-medium text-slate-400">{lang === 'ar' ? 'دقيقة' : 'mins'}</span></p>
                </div>
              </div>
              <div className="text-right">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{lang === 'ar' ? 'المسافة' : 'Distance'}</span>
                 <p className="text-lg font-bold text-white leading-none">4.2 <span className="text-sm font-medium text-slate-400">km</span></p>
              </div>
            </div>
          )}
          
          {pickups.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">{lang === 'ar' ? 'لا يوجد طلبات استلام حتى الآن' : 'No pickup requests yet'}</p>
          ) : (
            <div className="space-y-3">
              {pickups.map(pickup => (
                <div key={pickup.id} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${pickup.status === 'boarded' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0B0E14] border-white/10'}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                      {pickup.passengerAvatar.startsWith('http') ? <img src={pickup.passengerAvatar} className="w-full h-full object-cover" alt="" /> : pickup.passengerAvatar}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">{pickup.passengerName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span className={`text-[10px] ${pickup.lat && pickup.lng ? 'text-slate-400' : 'text-rose-400'}`}>{pickup.customAddress} {!pickup.lat && (lang === 'ar' ? ' (لا توجد إحداثيات)' : '(No coords)')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors" title={lang === 'ar' ? 'رسالة' : 'Message'}>
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <a href={`tel:+1234567890`} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors" title={lang === 'ar' ? 'اتصال' : 'Call'}>
                      <PhoneCall className="w-4 h-4" />
                    </a>
                    {pickup.googleMapsUrl && (
                      <a 
                        href={pickup.googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-emerald-400 transition-colors"
                        title="Open in Maps"
                      >
                        <Navigation className="w-4 h-4" />
                      </a>
                    )}
                    
                    {pickup.status !== 'boarded' ? (
                      <button
                        onClick={() => handleUpdateStatus(pickup.id, 'boarded')}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase rounded-lg transition-colors cursor-pointer"
                      >
                        {lang === 'ar' ? 'تم الاستلام ✓' : 'Boarded ✓'}
                      </button>
                    ) : (
                      <span className="px-3 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase rounded-lg flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {lang === 'ar' ? 'معك بالسيارة' : 'In Car'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {allBoarded && (
                <div className="mt-4 p-4 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl flex flex-col items-center justify-center gap-3 text-center animate-in zoom-in-95">
                  <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Navigation className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{lang === 'ar' ? 'اكتمل جمع الركاب!' : 'All Passengers Boarded!'}</h4>
                    {!allLocationsSaved && <p className="text-[10px] text-rose-300 mt-1">{lang === 'ar' ? 'تحذير: بعض الركاب لا يملكون إحداثيات' : 'Warning: Some passengers missing coordinates'}</p>}
                  </div>
                  <a
                    href={allLocationsSaved ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(outing.location)}` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-2 px-6 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-colors inline-block ${allLocationsSaved ? 'bg-white text-indigo-900 hover:bg-indigo-50' : 'bg-gray-500 cursor-not-allowed'}`}
                    onClick={(e) => !allLocationsSaved && e.preventDefault()}
                  >
                    {lang === 'ar' ? '🚗 ابدأ الرحلة للطلعة' : '🚗 Start Journey'}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
        ) : (
          <div className="space-y-4">
            {/* Passenger view */}
            <p className="text-xs text-slate-400">{lang === 'ar' ? 'الوضع نشط، يرجى انتظار السائق.' : 'Pickup mode active, please wait for driver.'}</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {!myPickup && !showRequestForm && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="w-full py-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 border-dashed rounded-2xl text-indigo-400 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              {lang === 'ar' ? '📍 أحتاج أن يتم المرور عليّ' : '📍 I Need a Pickup'}
            </button>
          )}

          {showRequestForm && (
            <div className="bg-[#0B0E14] p-4 rounded-2xl border border-indigo-500/30 space-y-4">
              <h4 className="text-xs font-bold text-white mb-2">{lang === 'ar' ? 'حدد موقع استلامك' : 'Set your pickup location'}</h4>
              
              <PlaceAutocompleteInput
                lang={lang}
                placeholder={lang === 'ar' ? 'ابحث عن مكان الاستلام...' : 'Search pickup spot...'}
                onPlaceSelect={(place) => {
                  setPickupLoc(place.name);
                  setPickupLat(place.lat);
                  setPickupLng(place.lng);
                  setPickupUrl(place.url);
                }}
              />

              {pickupLoc && (
                <button
                  onClick={handleRequestPickup}
                  className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2 cursor-pointer transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {lang === 'ar' ? 'تأكيد الموقع' : 'Confirm Location'}
                </button>
              )}
            </div>
          )}

          {myPickup && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">
                  {lang === 'ar' ? 'موقع استلامك' : 'Your Pickup Location'}
                </span>
                <p className="text-xs font-bold text-white truncate max-w-[200px]">{myPickup.customAddress}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'ar' ? 'الحالة: ' : 'Status: '} 
                  <strong className={myPickup.status === 'boarded' ? 'text-emerald-400' : 'text-amber-400'}>
                    {myPickup.status === 'boarded' ? (lang === 'ar' ? 'تم الركوب' : 'Boarded') : (lang === 'ar' ? 'قيد الانتظار' : 'Waiting')}
                  </strong>
                </p>
              </div>
              <div className="w-12 h-12 bg-[#0B0E14] rounded-full flex items-center justify-center border border-white/5">
                <Car className={`w-5 h-5 ${myPickup.status === 'boarded' ? 'text-emerald-400' : 'text-indigo-400'}`} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
