/**
 * Utility for providing illustrative AI placeholders for places without images.
 */
export const getPlaceholderImage = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('coffee') || cat.includes('cafe')) {
    return 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('restaur')) {
    return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('park') || (cat.includes('حدي')) || (cat.includes('منتز'))) {
    return 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('mall') || cat.includes('مول')) {
    return 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('stadium') || cat.includes('ملعب')) {
    return 'https://images.unsplash.com/photo-1521533845262-3865d3291eb6?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('sight') || cat.includes('tourist') || cat.includes('سياح')) {
    return 'https://images.unsplash.com/photo-1548345680-f5475ea5df84?auto=format&fit=crop&w=800&q=80';
  }
  return 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80'; // Nature/Travel fallback
};
