// Centralized GA4 event wrappers. Single source of truth for event names and
// param shapes so renames don't drift across the codebase — renaming a GA4
// event after launch breaks data continuity in the funnel.
//
// gtag is loaded synchronously in index.html as `window.gtag`. The guard
// keeps unit tests, SSR, and the rare "GA blocked" case from throwing.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
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
}): void {
  emit('first_capture', params);
}

export function trackGameEnd(params: {
  mode: GameMode;
  won: boolean;
  score: number;
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
