// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_OPT_OUT_KEY,
  GA_MEASUREMENT_ID,
  initAnalytics,
  setAnalyticsOptOut,
  trackGameStart,
} from '../../src/analytics/track';

// S-020: the player's opt-out and the browser's Global Privacy Control
// signal both keep the GA4 tag from loading, and the opt-out stops a tag
// already loaded this session from sending.

const DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;
const LIVE_HOST = 'stackedthegame.com';

function gaScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll('script')).filter((s) =>
    s.src.startsWith('https://www.googletagmanager.com/gtag/js'),
  );
}

function disableFlag(): unknown {
  return (window as unknown as Record<string, unknown>)[DISABLE_FLAG];
}

afterEach(() => {
  delete window.gtag;
  delete window.dataLayer;
  gaScripts().forEach((s) => s.remove());
  localStorage.clear();
  delete (window as unknown as Record<string, unknown>)[DISABLE_FLAG];
  vi.unstubAllGlobals();
});

describe('the analytics opt-out (S-020)', () => {
  it('the tag loads on the live site by default', () => {
    initAnalytics(LIVE_HOST);
    expect(typeof window.gtag).toBe('function');
    expect(gaScripts()).toHaveLength(1);
  });

  it('nothing loads on the live site once the opt-out key is true', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    initAnalytics(LIVE_HOST);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(gaScripts()).toHaveLength(0);
  });

  it('nothing loads on the live site when the browser sends Global Privacy Control', () => {
    vi.stubGlobal('navigator', { ...navigator, globalPrivacyControl: true });
    initAnalytics(LIVE_HOST);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(gaScripts()).toHaveLength(0);
  });

  it('opting out stops events, sets the ga-disable flag and saves the key', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    setAnalyticsOptOut(true);
    trackGameStart({ mode: 'classic', resumed: false, seed: 7 });
    expect(gtag).not.toHaveBeenCalled();
    expect(disableFlag()).toBe(true);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
  });

  it('opting back in removes the key and clears the ga-disable flag', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    setAnalyticsOptOut(false);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(disableFlag()).toBe(false);
  });
});
