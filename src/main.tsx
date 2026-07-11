import * as Sentry from '@sentry/react';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LocationProvider } from './contexts/LocationContext.tsx';
import { GlobalAIProvider } from './contexts/GlobalAIContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocationProvider>
      <GlobalAIProvider>
        <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}><App /></Sentry.ErrorBoundary>
      </GlobalAIProvider>
    </LocationProvider>
  </StrictMode>,
);
