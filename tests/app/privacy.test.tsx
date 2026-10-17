// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// jsdom has no matchMedia, and the app asks for it as its modules load.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import App from '../../src/App';
import { ANALYTICS_OPT_OUT_KEY, GA_MEASUREMENT_ID } from '../../src/analytics/track';

// S-020: the home screen links to the privacy notice, Settings holds the
// "Share anonymous play data" switch, and public/privacy.html carries the
// approved text.

const SWITCH_NAME = 'Share anonymous play data';

function openSettings() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  return screen.getByRole('switch', { name: SWITCH_NAME });
}

describe('the privacy notice and the opt-out (S-020)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    delete (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`];
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('the home screen links to /privacy.html in a new tab', () => {
    render(<App />);
    const link = screen.getByRole('link', { name: 'Privacy' });
    expect(link.getAttribute('href')).toBe('/privacy.html');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('the Settings switch starts on; a click turns it off and saves the opt-out', () => {
    const sw = openSettings();
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
  });

  it('with the opt-out already saved, the switch starts off', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    const sw = openSettings();
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('public/privacy.html carries the approved notice', () => {
    const html = readFileSync(join(process.cwd(), 'public', 'privacy.html'), 'utf8');
    for (const text of [
      'STACKED — Privacy',
      'Last updated: October 17, 2026',
      'Share anonymous play data',
      'Detailed activity is deleted after 2 months.',
      'deleted 14 months after your last visit.',
      'privacy@stackedthegame.com',
    ]) {
      expect(html).toContain(text);
    }
  });
});
