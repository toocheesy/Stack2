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
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings, GameState } from '../../src/engine/types';

// PLAY AGAIN after CONTINUE (D-007 rulings 72 and 102): CONTINUE on a saved
// Classic game makes that game's opponents and target App's settings, so
// GO2's PLAY AGAIN deals what was being played, not Classic's defaults.

const SEED = 1;
const settings: GameSettings = {
  targetScore: 100,
  bot1Personality: 'intermediate',
  bot2Personality: 'advanced',
  disableSeatingSwap: true,
};

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('PLAY AGAIN after CONTINUE', () => {
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

  it('continue a game with Nina and Rex to 100, end it, PLAY AGAIN: the new game has Nina and Rex to 100', async () => {
    // Nina holds the last card, the deck is out, and Nina is at the target: her move ends the game.
    const base = createInitialState(settings, createPRNG(SEED));
    const game: GameState = {
      ...base,
      deck: [],
      hands: [[], [base.hands[1][0]], []],
      currentPlayer: 1,
      overallScores: { player: 40, bot1: 100, bot2: 30 },
    };
    saveGame('classic', { game, currentLevelId: null, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });

    render(<App />);
    fireEvent.click(screen.getByText('CONTINUE'));
    expect(screen.getAllByText('CLASSIC · 100 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    await advance(10_000);
    // GO2's headline: the winner's name in her colour, then "wins".
    expect(screen.getByText((_, el) => el?.tagName === 'H2' && el.textContent === 'Nina wins')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /PLAY AGAIN/ }));
    await advance(100);
    expect(screen.getAllByText('CLASSIC · 100 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Nina')).toBeTruthy();
    expect(screen.getByText('Rex')).toBeTruthy();
    expect(screen.queryByText('Calvin')).toBeNull();
    expect(screen.queryByText(/is over|wins/)).toBeNull();
  });
});
