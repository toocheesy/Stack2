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

import { MotionGlobalConfig } from 'motion/react';
import App from '../../src/App';
import { saveGame } from '../../src/game/persistence';

// Sheets leave the page as soon as they close here (no exit animation), so
// the page reflects the state after each tap.
MotionGlobalConfig.skipAnimations = true;
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings, GameState } from '../../src/engine/types';

// Paused means paused (D-007 release 2 part 3, section D), through the whole
// app: while the leave sheet, the in-game Settings or the tutorial is open,
// an opponent due to move does not; closing the sheet lets it move from the
// same state. The tutorial never touches the game: a build in the tray is
// there, untouched, when Skip closes it.

const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
// From tests/game/tutorialFreeze.test.tsx: seed 1 deals the player first; seed 6 deals bot 1 first.
const SEED_PLAYER_FIRST = 1;
const SEED_BOT_FIRST = 6;
// Longer than any bot delay plus the capture replay and the wait after a move.
const WELL_PAST = 10_000;

function saveClassic(game: GameState, seed: number) {
  saveGame('classic', { game, seed, dealStream: seed, botStream: botStreamSeed(seed) });
}

function savedGame(): GameState {
  return JSON.parse(localStorage.getItem('stacked-save-classic')!).game as GameState;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function continueGame() {
  render(<App />);
  fireEvent.click(screen.getByText('CONTINUE'));
}

function botCardCounts(): string[] {
  return screen.getAllByText(/^\d CARDS?$/).map((e) => e.textContent!);
}

const openers = {
  leave: () => fireEvent.click(screen.getByRole('button', { name: 'Leave game' })),
  settings: () => fireEvent.click(screen.getByRole('button', { name: 'Settings' })),
  tutorial: () => {
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByText('Tutorial'));
  },
};
const words = {
  leave: 'Leave this game?',
  settings: 'PAUSED · CLASSIC · ROUND 1 · HAND 1',
  tutorial: 'STEP 1 OF 9',
};
const closers = {
  leave: () => fireEvent.click(screen.getByText('Keep playing')),
  settings: () => fireEvent.click(screen.getByRole('button', { name: 'Done' })),
  tutorial: () => fireEvent.click(screen.getByRole('button', { name: 'Skip' })),
};

describe('paused means paused (section D)', () => {
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

  for (const sheet of ['leave', 'settings', 'tutorial'] as const) {
    it(`${sheet}: an opponent due to move waits while the sheet is open, and moves from the same state once it closes`, async () => {
      const game = createInitialState(settings, createPRNG(SEED_BOT_FIRST));
      expect(game.currentPlayer).not.toBe(0);
      saveClassic(game, SEED_BOT_FIRST);
      continueGame();
      // The opponent is thinking from the first render; the other seat shows its four cards.
      expect(screen.getByText('THINKING ···')).toBeTruthy();
      expect(botCardCounts()).toEqual(['4 CARDS']);

      openers[sheet]();
      expect(screen.getByText(words[sheet])).toBeTruthy();
      await advance(WELL_PAST);
      // Nothing moved: both opponents still hold four cards, nobody is thinking, and the save is as it was.
      expect(botCardCounts()).toEqual(['4 CARDS', '4 CARDS']);
      expect(screen.queryByText('THINKING ···')).toBeNull();
      expect(savedGame().hands.map((h) => h.length)).toEqual([4, 4, 4]);
      expect(screen.getByText(words[sheet])).toBeTruthy();

      closers[sheet]();
      // The opponent moves from the frozen state: its hand is one card down, the other's still full.
      for (let t = 0; t < WELL_PAST && !botCardCounts().includes('3 CARDS'); t += 50) await advance(50);
      expect(screen.queryByText(words[sheet])).toBeNull();
      expect(botCardCounts().sort()).toEqual(['3 CARDS', '4 CARDS']);
      expect(savedGame().hands[game.currentPlayer]).toHaveLength(3);
      expect(savedGame().hands.filter((h) => h.length === 4)).toHaveLength(2);
    });
  }

  it('the tutorial with a build in the tray: step to 3 to 6 and Skip; the state, the hand, the table and the build are as before', async () => {
    const base = createInitialState(settings, createPRNG(SEED_PLAYER_FIRST));
    expect(base.currentPlayer).toBe(0);
    const staged = base.hands[0][0];
    const game: GameState = { ...base, combination: { base: staged, combo1: [], combo2: [], combo3: [] } };
    saveClassic(game, SEED_PLAYER_FIRST);
    const before = JSON.stringify(savedGame());
    continueGame();
    // The build is in the tray: BASE holds the staged card, from your hand.
    expect(screen.getByText('YOUR CAPTURE')).toBeTruthy();
    expect(screen.getByText('HAND')).toBeTruthy();
    expect(screen.getByText('IN BASE')).toBeTruthy();

    openers.tutorial();
    expect(screen.getByText('STEP 1 OF 9')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(screen.getByText('STEP 3 OF 9')).toBeTruthy();
    expect(screen.getByText('The capture tray.')).toBeTruthy();
    // The sample capture lies over the tray: +20 so far, 6♣ + 4♥ from the table.
    expect(screen.getByText('+20 so far')).toBeTruthy();
    expect(screen.getByText('TABLE ×2')).toBeTruthy();
    for (const title of ['HAND and TABLE.', 'SUBMIT.', 'RESET.']) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(title)).toBeTruthy();
    }
    await advance(WELL_PAST);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await advance(WELL_PAST);
    expect(screen.queryByText(/STEP \d OF 9/)).toBeNull();
    expect(screen.queryByText('+20 so far')).toBeNull();
    // The real build is still in the tray, and the save never changed.
    expect(screen.getByText('YOUR CAPTURE')).toBeTruthy();
    expect(screen.getByText('IN BASE')).toBeTruthy();
    expect(JSON.stringify(savedGame())).toBe(before);
    expect(screen.queryByText('THINKING ···')).toBeNull();
  });

  it('each sheet covers the whole screen with a fixed layer that takes the taps', async () => {
    const game = createInitialState(settings, createPRNG(SEED_PLAYER_FIRST));
    saveClassic(game, SEED_PLAYER_FIRST);
    continueGame();
    const layers = () => Array.from(document.querySelectorAll<HTMLElement>('div')).filter((d) => d.style.position === 'fixed' && d.style.inset === '0px');
    expect(layers()).toHaveLength(0);

    openers.leave();
    const leave = layers();
    expect(leave.length).toBeGreaterThanOrEqual(1);
    expect(leave.some((l) => l.contains(screen.getByText('Leave this game?')))).toBe(true);
    closers.leave();
    await advance(1000);

    openers.settings();
    expect(layers().some((l) => l.contains(screen.getByRole('dialog', { name: 'Settings' })))).toBe(true);
    fireEvent.click(screen.getByText('Tutorial'));
    expect(layers().some((l) => l.style.zIndex === '400' && l.style.pointerEvents === 'auto')).toBe(true);
    closers.tutorial();
    await advance(1000);
  });

  it('Leave game on the sheet keeps the save and goes home, where CONTINUE shows again', () => {
    const game = createInitialState(settings, createPRNG(SEED_PLAYER_FIRST));
    saveClassic(game, SEED_PLAYER_FIRST);
    continueGame();
    openers.leave();
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Leave game'));
    expect(screen.getByText('CONTINUE')).toBeTruthy();
    expect(savedGame().board.map((c) => c.id)).toEqual(game.board.map((c) => c.id));
  });
});
