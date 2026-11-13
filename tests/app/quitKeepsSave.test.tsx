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
import { loadGame, saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings, GameState } from '../../src/engine/types';

// S-006, through the whole app: quitting keeps the save and the home screen
// offers CONTINUE; game_start and game_end carry the seed, including on a
// resumed game.

const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
// Seed 1 deals the player first with these settings (tutorialFreeze.test.tsx).
const DEAL_SEED = 1;
const CLASSIC_SEED = 90210;

function ids(cards: readonly { id: string }[]): string[] {
  return cards.map((c) => c.id);
}

function saveClassic(game: GameState, seed = CLASSIC_SEED) {
  saveGame('classic', {
    game,
    seed,
    dealStream: DEAL_SEED,
    botStream: botStreamSeed(DEAL_SEED),
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('quitting keeps the save (S-006)', () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    gtag = vi.fn();
    window.gtag = gtag as (...args: unknown[]) => void;
  });

  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Classic: CONTINUE resumes with the saved seed, quitting keeps the save, and CONTINUE shows again', () => {
    const game = createInitialState(classicSettings, createPRNG(DEAL_SEED));
    saveClassic(game);

    render(<App />);
    fireEvent.click(screen.getByText('CONTINUE'));
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'game_start',
      expect.objectContaining({ mode: 'classic', resumed: true, seed: CLASSIC_SEED }),
    );

    // The back arrow opens QD1's leave sheet (D-007 release 2 part 3); Leave game keeps the save.
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(screen.getByText('Leave this game?')).toBeTruthy();
    expect(screen.getByText('Your game is saved. Tap CONTINUE on the home screen to pick it up right where you left off.')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Leave game'));

    expect(screen.getByText('CONTINUE')).toBeTruthy();
    const kept = loadGame('classic')!;
    expect(kept).not.toBeNull();
    expect(kept.seed).toBe(CLASSIC_SEED);
    expect(ids(kept.game.board)).toEqual(ids(game.board));
    expect(ids(kept.game.hands[0])).toEqual(ids(game.hands[0]));
  });

  it('game_end carries the seed of a resumed game', async () => {
    // Bot 1 holds the last card, the deck is out, and bot 1 is at the target:
    // its move ends the game.
    const base = createInitialState(classicSettings, createPRNG(DEAL_SEED));
    const game: GameState = {
      ...base,
      deck: [],
      hands: [[], [base.hands[1][0]], []],
      currentPlayer: 1,
      overallScores: { player: 0, bot1: 300, bot2: 0 },
    };
    saveClassic(game);

    render(<App />);
    fireEvent.click(screen.getByText('CONTINUE'));
    await advance(10_000);

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'game_end',
      expect.objectContaining({ mode: 'classic', won: false, seed: CLASSIC_SEED }),
    );
  });
});
