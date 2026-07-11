import * as Sentry from "@sentry/react";

export let sentryStatus: 'active' | 'mocked' | 'error' = 'mocked';

export const initSentry = () => {
  try {
    let dsn = '';
    if (typeof process !== 'undefined' && process.env && process.env.VITE_SENTRY_DSN) {
        dsn = process.env.VITE_SENTRY_DSN;
    } else if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SENTRY_DSN) {
        dsn = (import.meta as any).env.VITE_SENTRY_DSN;
    }

    if (dsn) {
      Sentry.init({
        dsn: dsn,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0, 
        tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      });
      console.log('[Sentry] Initialized with DSN');
      sentryStatus = 'active';
    } else {
      console.warn('[Sentry] DSN not found, running in mock mode for development.');
      sentryStatus = 'mocked';
    }
  } catch (e) {
    console.error('[Sentry] Initialization error:', e);
    sentryStatus = 'error';
  }
};

export const captureException = (error: any, context?: any) => {
  console.error('[Sentry] Capturing exception:', error, context);
  if (sentryStatus === 'active') {
    Sentry.captureException(error, { extra: context });
  }
};

export const captureMessage = (message: string, context?: any) => {
  console.log('[Sentry] Capturing message:', message, context);
  if (sentryStatus === 'active') {
    Sentry.captureMessage(message, { extra: context });
  }
};

export const startTransaction = (name: string, op: string) => {
  if (sentryStatus === 'active') {
    // Return a mock object if we don't want to use callback API, or use startSpan
    // Wait, startSpan takes a callback. Let's make startTransaction return a span-like object.
    const span = Sentry.startInactiveSpan({ name, op });
    return {
      finish: () => {
        if (span) span.end();
      },
      startChild: () => ({ finish: () => {} })
    };
  }
  return {
    finish: () => {},
    startChild: () => ({ finish: () => {} })
  };
};
