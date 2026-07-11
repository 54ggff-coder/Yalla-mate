import { useLocation } from '../contexts/LocationContext';
import { useMemo } from 'react';
import { arabCitiesList, foreignCitiesList } from '../constants';

const allCities = [...arabCitiesList, ...foreignCitiesList];

export function useCountryValidation() {
  const { address, activeCity } = useLocation();
  
  const userCountry = useMemo(() => {
    if (address && address.country) return address.country;
    if (activeCity) {
      const normalizedCity = activeCity.trim().toLowerCase();
      const city = allCities.find(c => c.nameEn.toLowerCase() === normalizedCity || c.nameAr.toLowerCase() === normalizedCity);
      if (city) return city.countryEn;
    }
    return null;
  }, [address, activeCity]);

  const validate = useMemo(() => {
    return (outingCountry: string | undefined) => {
      if (!userCountry || !outingCountry) return true; // Cannot validate if info is missing
      return userCountry.toLowerCase() === outingCountry.toLowerCase();
    };
  }, [userCountry]);

  return { validate, userCountry };
}
