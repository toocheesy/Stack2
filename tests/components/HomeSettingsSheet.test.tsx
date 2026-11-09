// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// jsdom has no matchMedia, and the motion presets ask for it as their module loads.
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

import { HomeSettingsSheet } from '../../src/components/HomeSettingsSheet';
import { ANALYTICS_OPT_OUT_KEY, GA_MEASUREMENT_ID } from '../../src/analytics/track';

// Settings at home, ST3 Card phones B and C (D-007 release 3, rulings 81 and
// 82): the words, Done, the "Share anonymous play data" switch on S-020's
// storage, no Tutorial row, and the locked state under the browser's Global
// Privacy Control signal.

const SWITCH = 'Share anonymous play data';

function setSignal(on: boolean) {
  if (on) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  else delete (navigator as unknown as Record<string, unknown>).globalPrivacyControl;
}

function open(onDone: () => void = () => {}) {
  render(<HomeSettingsSheet open onDone={onDone} />);
  return screen.getByRole('switch', { name: SWITCH });
}

describe('the home Settings (ST3 phones B and C)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSignal(false);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    setSignal(false);
    delete (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`];
  });

  it('the words from the board: Settings, Done, the switch, its helper line and Privacy; no Tutorial, no PAUSED line', () => {
    const onDone = vi.fn();
    open(onDone);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText(SWITCH)).toBeTruthy();
    expect(screen.getByText(/Anonymous counts of how the game is played\. No names, no accounts, never sold or used for ads\./)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Privacy' });
    expect(link.getAttribute('href')).toBe('/privacy.html');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.queryByText('Tutorial')).toBeNull();
    expect(screen.queryByText(/PAUSED/)).toBeNull();
    expect(screen.queryByText("Your browser's privacy setting turned this off.")).toBeNull();
    // Done is the only button; the switch is a switch.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Done']);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('the switch starts On; a tap turns it Off and saves the opt-out; another turns it back On', () => {
    const sw = open();
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('On')).toBeTruthy();
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off')).toBeTruthy();
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('On')).toBeTruthy();
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
  });

  it('with the opt-out already saved, the switch starts Off', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    const sw = open();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it("under Global Privacy Control the switch shows Off, can't be turned on, and the locked line shows (phone C)", () => {
    setSignal(true);
    const sw = open();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Off')).toBeTruthy();
    expect(screen.getByText("Your browser's privacy setting turned this off.")).toBeTruthy();
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off')).toBeTruthy();
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
  });

  it('closed: nothing is in the page', () => {
    render(<HomeSettingsSheet open={false} onDone={() => {}} />);
    expect(screen.queryByText('Settings')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
