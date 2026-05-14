import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import App from './App.tsx'

// Dev-only URL helpers for phone playtest. Visit `?unlock` to unlock every
// Adventure level (3 stars each) + Jett in Classic. Visit `?reset` to wipe
// progress. Both strip the query param after running so the URL stays clean.
(function applyDevUrlHelpers() {
  try {
    const params = new URLSearchParams(window.location.search);
    let handled = false;

    if (params.has('unlock')) {
      localStorage.setItem('stacked_v2_adventure_progress', JSON.stringify({
        unlockedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        starsPerLevel: { 1:3, 2:3, 3:3, 4:3, 5:3, 6:3, 7:3, 8:3, 9:3, 10:3, 11:3, 12:3 },
        lastCompleted: 12,
        totalStars: 36,
      }));
      localStorage.setItem('stacked_v2_jett_unlocked_classic', 'true');
      handled = true;
    }

    if (params.has('reset')) {
      localStorage.removeItem('stacked_v2_adventure_progress');
      localStorage.removeItem('stacked_v2_jett_unlocked_classic');
      localStorage.removeItem('stacked-v2-game');
      handled = true;
    }

    if (handled) {
      params.delete('unlock');
      params.delete('reset');
      const q = params.toString();
      const url = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
      window.history.replaceState({}, '', url);
    }
  } catch {
    // localStorage unavailable — ignore
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
