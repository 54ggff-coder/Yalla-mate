/**
 * Convert any string deterministically to a valid RFC-compatible UUID for safe database consumption.
 */
export function toUUID(str: string): string {
  if (!str) return '00000000-0000-4000-8000-000000000000';
  
  // Check if it's already a valid UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (isUUID) return str.toLowerCase();

  // Deterministically hash the string to generate 32 hex characters
  let h1 = 1540483477;
  let h2 = 2246822507;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 597399067);
    h2 = Math.imul(h2 ^ char, 2869860233);
  }
  
  const part1 = Math.abs(h1).toString(16).padStart(8, '0').slice(0, 8);
  const part2 = Math.abs(h2).toString(16).padStart(8, '0').slice(0, 8);
  const part3 = Math.abs(h1 ^ h2).toString(16).padStart(8, '0').slice(0, 8);
  const part4 = Math.abs(h1 & h2).toString(16).padStart(8, '0').slice(0, 8);
  
  const combined = (part1 + part2 + part3 + part4).slice(0, 32);
  
  // Build a RFC4122 v4-compliant UUID
  // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const timeLow = combined.slice(0, 8);
  const timeMid = combined.slice(8, 12);
  const timeHiAndVersion = '4' + combined.slice(13, 16); // Set version to 4
  const clockSeqHiAndReserved = '8' + combined.slice(17, 20); // Set variant to 10xx (8)
  const node = combined.slice(20, 32);
  
  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeqHiAndReserved}-${node}`;
}
