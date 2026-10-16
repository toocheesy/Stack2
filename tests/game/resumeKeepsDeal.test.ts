import { beforeEach, describe, expect, it } from 'vitest';
import type { GameSettings } from '../../src/engine/types';
import { loadGame, saveGame } from '../../src/game/persistence';
import { createDeck } from '../../src/engine/utils/deck';
import { playGame, resumeGame } from '../engine/fullGame/runner';

// S-006: a resumed game keeps its deal. Played to the middle of round 1,
// saved through persistence.ts, loaded and played on, every later deal and
// the final result match the same seed played straight through.

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  },
  configurable: true,
});

const settings: GameSettings = {
  targetScore: 100,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

const ALL_IDS = createDeck()
  .map((c) => c.id)
  .sort();
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe('resume keeps the deal (S-006)', () => {
  beforeEach(() => store.clear());

  it.each(SEEDS)('seed %i: save mid-round 1, load, play on; deals and result match the straight game', (seed) => {
    const straight = playGame(seed, settings);
    expect(straight.rounds).toBeGreaterThanOrEqual(1);

    const first = playGame(seed, settings, { stopAfterMoves: 3 + (seed % 9) });
    const paused = first.paused!;
    expect(paused).not.toBeNull();
    expect(paused.state.currentRound).toBe(1);
    expect(paused.state.gamePhase).toBe('playing');

    // Each card in exactly one zone at the save point.
    const everywhere = [
      ...paused.state.deck.map((c) => c.id),
      ...paused.state.board.map((c) => c.id),
      ...paused.state.hands.flat().map((c) => c.id),
      ...paused.tracker.playerCaptures.flat().map((c) => c.id),
    ].sort();
    expect(everywhere).toEqual(ALL_IDS);

    saveGame('classic', {
      game: paused.state,
      tracker: paused.tracker,
      currentLevelId: null,
      seed,
      dealStream: paused.dealStream,
      botStream: paused.botStream,
    });
    // The mount seed is not used for a resumed game.
    const loaded = loadGame('classic', 999_999)!;
    expect(loaded).not.toBeNull();
    expect(loaded.seed).toBe(seed);
    expect(loaded.dealStream).toBe(paused.dealStream);
    expect(loaded.botStream).toBe(paused.botStream);

    const rest = resumeGame(loaded);
    expect([...first.deals, ...rest.deals]).toEqual(straight.deals);
    expect([...first.moves, ...rest.moves]).toEqual(straight.moves);
    expect([...first.sweeps, ...rest.sweeps]).toEqual(straight.sweeps);
    expect(rest.scores).toEqual(straight.scores);
    expect(rest.winner).toBe(straight.winner);
    expect(rest.rounds).toBe(straight.rounds);
  });
});
