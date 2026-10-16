// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GA_MEASUREMENT_ID, initAnalytics, trackFirstCapture, trackGameEnd, trackGameStart } from '../../src/analytics/track';

// GA4 reconnect (S-005): the tag loads only on the live site, and events
// go out only when gtag is present.
function gaScripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll('script')).filter((s) =>
    s.src.startsWith('https://www.googletagmanager.com/gtag/js'),
  );
}

afterEach(() => {
  delete window.gtag;
  delete window.dataLayer;
  gaScripts().forEach((s) => s.remove());
});

describe('analytics events (S-005)', () => {
  it('sends an event when gtag is present', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackGameStart({ mode: 'classic', resumed: false, seed: 7 });
    expect(gtag).toHaveBeenCalledWith('event', 'game_start', { mode: 'classic', resumed: false, seed: 7 });
  });

  it('does nothing when gtag is absent', () => {
    expect(() => trackGameStart({ mode: 'run', level_id: 1, resumed: true, seed: 7 })).not.toThrow();
  });
});

describe('initAnalytics (S-005)', () => {
  it.each(['localhost', 'stack2-git-branch-team.vercel.app', '127.0.0.1'])(
    'loads nothing on %s',
    (host) => {
      initAnalytics(host);
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
      expect(gaScripts()).toHaveLength(0);
    },
  );

  it.each(['stackedthegame.com', 'www.stackedthegame.com'])('loads the tag on %s', (host) => {
    initAnalytics(host);
    expect(typeof window.gtag).toBe('function');
    const scripts = gaScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
    expect(scripts[0].async).toBe(true);
    const queue = window.dataLayer as ArrayLike<unknown>[];
    expect(queue).toHaveLength(2);
    expect(Array.from(queue[1])).toEqual(['config', GA_MEASUREMENT_ID]);
  });

  it('queues each command as an arguments object, as gtag.js requires', () => {
    initAnalytics('stackedthegame.com');
    trackGameStart({ mode: 'classic', resumed: false, seed: 7 });
    const queue = window.dataLayer as unknown[];
    expect(queue).toHaveLength(3);
    for (const entry of queue) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    }
    expect(Array.from(queue[2] as ArrayLike<unknown>)).toEqual([
      'event',
      'game_start',
      { mode: 'classic', resumed: false, seed: 7 },
    ]);
  });

  it('loads the tag only once', () => {
    initAnalytics('stackedthegame.com');
    initAnalytics('stackedthegame.com');
    expect(gaScripts()).toHaveLength(1);
    expect(window.dataLayer).toHaveLength(2);
  });

  it('uses the new measurement ID, not the old one', () => {
    expect(GA_MEASUREMENT_ID).toBe('G-ELM837XY9B');
  });
});

describe('the seed in analytics (S-006)', () => {
  it('game_start, first_capture and game_end each send the seed', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackGameStart({ mode: 'run', level_id: 3, resumed: true, seed: 90210 });
    trackFirstCapture({ mode: 'classic', time_to_first_capture_ms: 1200, seed: 90210 });
    trackGameEnd({ mode: 'classic', won: true, score: 310, duration_ms: 60_000, seed: 90210 });
    for (const name of ['game_start', 'first_capture', 'game_end']) {
      expect(gtag).toHaveBeenCalledWith('event', name, expect.objectContaining({ seed: 90210 }));
    }
  });
});
