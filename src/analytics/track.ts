// Centralized GA4 event wrappers. Single source of truth for event names and
// param shapes so renames don't drift across the codebase — renaming a GA4
// event after launch breaks data continuity in the funnel.
//
// The GA4 tag is loaded here by initAnalytics(), called first thing in
// main.tsx, and only on the live site (S-005). Everywhere else window.gtag
// stays undefined and every event below is a no-op.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// GA4 property "STACKED 2026", web stream "STACKED Live" (S-005, 2026-10-15).
// A measurement ID is public by design; it is not a secret.
export const GA_MEASUREMENT_ID = 'G-ELM837XY9B';

// The live site's hostnames. Previews, localhost and tests send nothing.
export const LIVE_HOSTS: readonly string[] = ['stackedthegame.com', 'www.stackedthegame.com'];

export function initAnalytics(hostname?: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!LIVE_HOSTS.includes(hostname ?? window.location.hostname)) return;
  if (typeof window.gtag === 'function') return;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the arguments object itself; pushing an array instead breaks it.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

type GameMode = 'classic' | 'run';

function emit(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

export function trackGameStart(params: {
  mode: GameMode;
  level_id?: number;
  resumed: boolean;
  seed: number;
}): void {
  emit('game_start', params);
}

export function trackTutorialComplete(params: {
  step_reached: number;
  method: 'dismiss' | 'complete';
  duration_ms: number;
}): void {
  emit('tutorial_complete', params);
}

export function trackFirstCapture(params: {
  mode: GameMode;
  level_id?: number;
  time_to_first_capture_ms: number;
  seed: number;
}): void {
  emit('first_capture', params);
}

export function trackGameEnd(params: {
  mode: GameMode;
  won: boolean;
  score: number;
  seed: number;
  duration_ms: number;
  level_id?: number;
  stars?: 0 | 1 | 2 | 3;
  margin?: number;
}): void {
  emit('game_end', params);
}

export function trackRunComplete(params: { total_stars: number }): void {
  emit('run_complete', params);
}

export function trackPwaInstalled(params: { source: 'appinstalled' | 'standalone_first_run' }): void {
  emit('pwa_installed', params);
}
