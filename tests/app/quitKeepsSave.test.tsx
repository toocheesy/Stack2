// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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
import { getLevel } from '../../src/engine/adventure/levelConfig';
import type { GameSettings, GameState } from '../../src/engine/types';

// S-006, through the whole app: quitting keeps the save in both modes and the
// home screen offers that mode's resume; game_start and game_end carry the
// seed, including on a resumed game.

const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'beginner',
};
// Seed 1 deals the player first with these settings (tutorialFreeze.test.tsx).
const DEAL_SEED = 1;
const CLASSIC_SEED = 90210;
const RUN_LEVEL = 3;
const RUN_SEED = 777;

function ids(cards: readonly { id: string }[]): string[] {
  return cards.map((c) => c.id);
}

function saveClassic(game: GameState, seed = CLASSIC_SEED) {
  saveGame('classic', {
    game,
    currentLevelId: null,
    seed,
    dealStream: DEAL_SEED,
    botStream: botStreamSeed(DEAL_SEED),
  });
}

function runSettings(): GameSettings {
  const level = getLevel(RUN_LEVEL)!;
  return {
    targetScore: level.targetScore,
    bot1Personality: level.bots[0],
    bot2Personality: level.bots[1],
    hintStripEnabled: level.hintStripEnabled,
    disableSeatingSwap: !level.turnOrderSwap,
  };
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

    fireEvent.click(screen.getByText('←'));
    expect(screen.getByText('Quit Game?')).toBeTruthy();
    expect(screen.getByText('Your game is saved. Tap Continue on the home screen to pick it up.')).toBeTruthy();
    fireEvent.click(screen.getByText('QUIT'));

    expect(screen.getByText('CONTINUE')).toBeTruthy();
    const kept = loadGame('classic', 0)!;
    expect(kept).not.toBeNull();
    expect(kept.seed).toBe(CLASSIC_SEED);
    expect(ids(kept.game.board)).toEqual(ids(game.board));
    expect(ids(kept.game.hands[0])).toEqual(ids(game.hands[0]));
  });

  it('the Run: Resume on the map resumes with the saved seed, quitting keeps the save, and Resume shows again', () => {
    const game = createInitialState(runSettings(), createPRNG(RUN_SEED));
    saveGame('run', {
      game,
      currentLevelId: RUN_LEVEL,
      seed: RUN_SEED,
      dealStream: createPRNG(RUN_SEED).getSeed(),
      botStream: botStreamSeed(RUN_SEED),
    });

    render(<App />);
    fireEvent.click(screen.getByText('The Run'));
    fireEvent.click(screen.getByText(/^Resume 1-3/));
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'game_start',
      expect.objectContaining({ mode: 'run', level_id: RUN_LEVEL, resumed: true, seed: RUN_SEED }),
    );

    fireEvent.click(screen.getByText('←'));
    expect(screen.getByText('Return to The Run Map?')).toBeTruthy();
    expect(screen.getByText('Your level is saved. Resume it from The Run map. Star progress is safe.')).toBeTruthy();
    fireEvent.click(screen.getByText('BACK'));

    expect(screen.getByText(/^Resume 1-3/)).toBeTruthy();
    const kept = loadGame('run', 0)!;
    expect(kept).not.toBeNull();
    expect(kept.currentLevelId).toBe(RUN_LEVEL);
    expect(kept.seed).toBe(RUN_SEED);
    expect(ids(kept.game.board)).toEqual(ids(game.board));
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
