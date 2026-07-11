/**
 * Utility for Web Vibration / Haptic Feedback
 * Provides clean, safe tactile vibration pulses on supported devices
 */
export const Haptics = {
  vibrate: (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Suppress any sandboxed iframe blocks
        console.warn('[Haptics] vibration blocked or unsupported:', e);
      }
    }
  },

  light: () => {
    Haptics.vibrate(12);
  },

  medium: () => {
    Haptics.vibrate(25);
  },

  heavy: () => {
    Haptics.vibrate(50);
  },

  success: () => {
    Haptics.vibrate([35, 30, 35]);
  },

  error: () => {
    Haptics.vibrate([80, 50, 80]);
  }
};
