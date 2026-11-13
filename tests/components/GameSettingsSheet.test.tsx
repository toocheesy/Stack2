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

import { GameSettingsSheet } from '../../src/components/GameSettingsSheet';
import { ANALYTICS_OPT_OUT_KEY, GA_MEASUREMENT_ID } from '../../src/analytics/track';

// ST3 Card phone A (D-007 rulings 81 and 82): the words, Done, the Tutorial
// row, the "Share anonymous play data" switch on S-020's storage, and the
// locked state under the browser's Global Privacy Control signal (phone C).

const SWITCH = 'Share anonymous play data';

function setSignal(on: boolean) {
  if (on) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  else delete (navigator as unknown as Record<string, unknown>).globalPrivacyControl;
}

function open(over: Partial<{ onDone(): void; onTutorial(): void; modeWord: string; round: number; hand: number }> = {}) {
  render(
    <GameSettingsSheet
      open
      modeWord={over.modeWord ?? 'CLASSIC'}
      round={over.round ?? 2}
      hand={over.hand ?? 3}
      onDone={over.onDone ?? (() => {})}
      onTutorial={over.onTutorial ?? (() => {})}
    />,
  );
  return screen.getByRole('switch', { name: SWITCH });
}

describe('the in-game Settings (ST3)', () => {
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

  it('the words from the board, with the mode, round and hand from the game', () => {
    const onDone = vi.fn();
    const onTutorial = vi.fn();
    open({ onDone, onTutorial });
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('PAUSED · CLASSIC · ROUND 2 · HAND 3')).toBeTruthy();
    expect(screen.getByText('Tutorial')).toBeTruthy();
    expect(screen.getByText('A tour of the table, one part at a time.')).toBeTruthy();
    expect(screen.getByText(SWITCH)).toBeTruthy();
    expect(screen.getByText(/Anonymous counts of how the game is played\. No names, no accounts, never sold or used for ads\./)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Privacy' });
    expect(link.getAttribute('href')).toBe('/privacy.html');
    expect(screen.queryByText("Your browser's privacy setting turned this off.")).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Tutorial'));
    expect(onTutorial).toHaveBeenCalledTimes(1);
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
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
  });

  it('with the opt-out already saved, the switch starts Off', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    const sw = open();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it("under Global Privacy Control the switch shows Off, can't be turned on, and the locked line shows", () => {
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
    render(<GameSettingsSheet open={false} modeWord="CLASSIC" round={1} hand={1} onDone={() => {}} onTutorial={() => {}} />);
    expect(screen.queryByText('Settings')).toBeNull();
  });
});
