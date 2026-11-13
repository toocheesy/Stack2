// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

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
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings } from '../../src/engine/types';

// The home screen, HS15 Citrus Press (D-007 release 3, rulings 32, 35, 37,
// 38, 39, 65, 65b, 105), through the whole app: the words from the board,
// CONTINUE only with a saved game, the three buttons the keyboard can reach
// (S-021), the "How to play" pill (release 4, ruling 111), nothing naming
// The Run, SET THE TABLE through DD2 to Classic Setup with nothing picked,
// Setup's back home at once, and the buttons ignoring taps while DD2 plays.

const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
const DEAL_SEED = 1;
// DD2 is 880ms in all.
const CURTAIN = 880;
// Every word the old home gave The Run.
const RUN_WORDS = /The Run|BEGIN|RESUME|NEW RUN|New here|CAMPAIGN|Run complete|levels|worlds/;

function saveClassic() {
  saveGame('classic', {
    game: createInitialState(classicSettings, createPRNG(DEAL_SEED)),
    seed: DEAL_SEED,
    dealStream: DEAL_SEED,
    botStream: botStreamSeed(DEAL_SEED),
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function classicCard() {
  return screen.getByRole('region', { name: 'Classic' });
}

function buttonNames(): string[] {
  return screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '');
}

describe('the home screen (HS15)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.gtag = vi.fn() as (...args: unknown[]) => void;
  });

  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('without a saved game: the words from the board, QUICK MATCH and SET THE TABLE, no CONTINUE, and the How to play pill', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('STACKED');
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    const card = classicCard();
    expect(within(card).getByText('DEAL ME IN')).toBeTruthy();
    expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe('Classic');
    expect(within(card).getByText('Race to the Score')).toBeTruthy();
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual(['QUICK MATCH', 'SET THE TABLE']);
    // The gear, the card's two buttons and the How to play pill (release 4) are the only buttons on the screen.
    expect(buttonNames()).toEqual(['Settings', 'QUICK MATCH', 'SET THE TABLE', 'How to play']);
    const link = screen.getByRole('link', { name: 'Privacy' });
    expect(link.getAttribute('href')).toBe('/privacy.html');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('button', { name: 'How to play' })).toBeTruthy();
    // The old home's words are gone.
    expect(screen.queryByText('Play to the score you pick.')).toBeNull();
    expect(screen.queryByText('CHOOSE YOUR GAME')).toBeNull();
    expect(screen.queryByText(/QUICK MATCH · 5 MIN|Capture · Combo · Win/)).toBeNull();
  });

  it('with a saved game: CONTINUE sits above QUICK MATCH and SET THE TABLE, and all three take focus (S-021)', () => {
    saveClassic();
    render(<App />);
    const buttons = within(classicCard()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['CONTINUE', 'QUICK MATCH', 'SET THE TABLE']);
    for (const button of buttons) {
      act(() => { button.focus(); });
      expect(document.activeElement).toBe(button);
    }
  });

  it('nothing on the home screen names The Run, and its three stored keys are removed on load (S-032)', () => {
    render(<App />);
    expect(screen.queryByText(RUN_WORDS)).toBeNull();
    cleanup();

    const keys = ['stacked-save-run', 'stacked_v2_adventure_progress', 'stacked_v2_jett_unlocked_classic'];
    for (const key of keys) localStorage.setItem(key, 'left over');
    saveClassic();
    render(<App />);
    expect(screen.queryByText(RUN_WORDS)).toBeNull();
    expect(buttonNames()).toEqual(['Settings', 'CONTINUE', 'QUICK MATCH', 'SET THE TABLE', 'How to play']);
    for (const key of keys) expect(localStorage.getItem(key)).toBeNull();
    // The Classic save is left as it was.
    expect(localStorage.getItem('stacked-save-classic')).not.toBeNull();
  });

  it('a save from before version 7 and the old single-slot save are removed on load, so there is no CONTINUE (S-032)', () => {
    saveClassic();
    const raw = JSON.parse(localStorage.getItem('stacked-save-classic')!);
    localStorage.setItem('stacked-save-classic', JSON.stringify({ ...raw, version: 6 }));
    localStorage.setItem('stacked-v2-game', JSON.stringify({ version: 3, game: raw.game }));
    render(<App />);
    expect(buttonNames()).toEqual(['Settings', 'QUICK MATCH', 'SET THE TABLE', 'How to play']);
    expect(localStorage.getItem('stacked-save-classic')).toBeNull();
    expect(localStorage.getItem('stacked-v2-game')).toBeNull();
  });

  it('SET THE TABLE: DD2 plays over Classic Setup with nothing picked; Back on Setup returns home at once', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'SET THE TABLE' }));
    // Classic Setup is under the curtain from the tap, while the home leaves over it.
    expect(screen.getByText('Classic Setup')).toBeTruthy();
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    await advance(CURTAIN - 1);
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    await advance(1);
    expect(screen.queryByText('TAKE A SEAT')).toBeNull();
    expect(screen.getByText('Classic Setup')).toBeTruthy();
    // Nothing picked: 300 is the default target, no opponent is picked, Jett is pickable like the others.
    expect(screen.getByRole('radio', { name: '300' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('0 OF 2')).toBeTruthy();
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(screen.getAllByText('PICK')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Jett/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PICK 2 OPPONENTS' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('TAKE A SEAT')).toBeTruthy();
    expect(screen.queryByText('Classic Setup')).toBeNull();
  });

  it('while DD2 plays, the buttons ignore taps', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'SET THE TABLE' }));
    // The leaving home's buttons do nothing.
    fireEvent.click(screen.getByText('QUICK MATCH'));
    fireEvent.click(screen.getByText('SET THE TABLE'));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await advance(CURTAIN);
    expect(screen.getByText('Classic Setup')).toBeTruthy();
    expect(screen.queryByText(/CLASSIC · 300/)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.gtag).not.toHaveBeenCalledWith('event', 'game_start', expect.anything());
  });
});
