import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/abril-fatface/400.css'
import '@fontsource/josefin-sans/400.css'
import '@fontsource/josefin-sans/600.css'
import '@fontsource/josefin-sans/700.css'
import './index.css'
import App from './App.tsx'
import { initAnalytics, trackPwaInstalled } from './analytics/track'

// Load the GA4 tag (live site only) before anything below can send an event (S-005).
initAnalytics();

// PWA install telemetry. Android/Desktop fire `appinstalled` directly. iOS
// A2HS does not — we infer it from a first-ever standalone display-mode
// launch and write a localStorage flag to avoid re-firing on every open.
(function wirePwaInstallTelemetry() {
  try {
    const FIRED_KEY = 'stacked_v2_pwa_install_fired';
    const alreadyFired = localStorage.getItem(FIRED_KEY) === 'true';

    if (!alreadyFired && window.matchMedia('(display-mode: standalone)').matches) {
      trackPwaInstalled({ source: 'standalone_first_run' });
      localStorage.setItem(FIRED_KEY, 'true');
    }

    window.addEventListener('appinstalled', () => {
      if (localStorage.getItem(FIRED_KEY) === 'true') return;
      trackPwaInstalled({ source: 'appinstalled' });
      localStorage.setItem(FIRED_KEY, 'true');
    });
  } catch {
    // matchMedia/localStorage unavailable — analytics gracefully no-op
  }
})();

// A URL helper for playing locally: `?reset` removes the saved game, then
// strips itself from the URL. It runs only behind Vite's dev flag; on the
// live site it does nothing.
if (import.meta.env.DEV) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) {
      localStorage.removeItem('stacked-v2-game');
      localStorage.removeItem('stacked-save-classic');
      params.delete('reset');
      const q = params.toString();
      const url = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
      window.history.replaceState({}, '', url);
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
