import React, { useEffect, useState, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Language } from '../data/translations';

interface PlaceAutocompleteInputProps {
  lang: Language;
  onPlaceSelect: (place: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    url: string;
    placeId: string;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
}

export default function PlaceAutocompleteInput({
  lang,
  onPlaceSelect,
  defaultValue = '',
  placeholder
}: PlaceAutocompleteInputProps) {
  const placesLib = useMapsLibrary('places');
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  
  const [inputValue, setInputValue] = useState(defaultValue);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!placesLib) return;
    setAutocompleteService(new placesLib.AutocompleteService());
    setSessionToken(new placesLib.AutocompleteSessionToken());
    
    // We need a dummy element for PlacesService
    const dummyElement = document.createElement('div');
    setPlacesService(new placesLib.PlacesService(dummyElement));
  }, [placesLib]);

  useEffect(() => {
    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = async (input: string) => {
    if (!autocompleteService || !input.trim()) {
      setPredictions([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await autocompleteService.getPlacePredictions({
        input,
        sessionToken: sessionToken || undefined,
        language: lang === 'ar' ? 'ar' : 'en'
      });
      setPredictions(response.predictions);
      setIsOpen(true);
    } catch (e) {
      console.error('Failed to fetch predictions', e);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    fetchPredictions(val);
  };

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService) return;
    
    setInputValue(prediction.structured_formatting.main_text);
    setIsOpen(false);
    
    placesService.getDetails({
      placeId: prediction.place_id,
      fields: ['name', 'geometry', 'formatted_address', 'url', 'place_id'],
      sessionToken: sessionToken || undefined,
      language: lang === 'ar' ? 'ar' : 'en'
    }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
        onPlaceSelect({
          name: place.name || prediction.structured_formatting.main_text,
          address: place.formatted_address || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          url: place.url || `https://www.google.com/maps/search/?api=1&query=${place.geometry.location.lat()},${place.geometry.location.lng()}&query_place_id=${place.place_id}`,
          placeId: place.place_id || prediction.place_id
        });
        // Create new session token for next search
        if (placesLib) {
          setSessionToken(new placesLib.AutocompleteSessionToken());
        }
      }
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <MapPin className={`absolute ${lang === 'ar' ? 'right-3.5' : 'left-3.5'} top-3.5 w-4 h-4 text-indigo-400`} />
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { if (predictions.length > 0) setIsOpen(true); }}
        placeholder={placeholder || (lang === 'ar' ? 'ابحث عن مكان (مثل: كافيه، منتزه، مطعم)...' : 'Search for a place...')}
        className={`w-full ${lang === 'ar' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 bg-[#161B26] border border-indigo-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-white placeholder-slate-500 transition-all`}
      />
      {isLoading && (
        <Loader2 className={`absolute ${lang === 'ar' ? 'left-3.5' : 'right-3.5'} top-3.5 w-4 h-4 text-slate-400 animate-spin`} />
      )}
      
      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#161B26] border border-indigo-500/30 rounded-xl shadow-2xl overflow-hidden">
          {predictions.map((pred) => (
            <button
              key={pred.place_id}
              type="button"
              onClick={() => handleSelectPrediction(pred)}
              className="w-full px-4 py-3 text-left border-b border-slate-800/50 hover:bg-indigo-500/10 flex items-start gap-3 transition-colors last:border-0"
            >
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm text-white font-medium truncate">{pred.structured_formatting.main_text}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{pred.structured_formatting.secondary_text}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
