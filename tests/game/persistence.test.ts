import { describe, expect, it, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSavedGame, type SavedGame } from '../../src/game/persistence';
import type { GameState } from '../../src/engine/types';

// ─── localStorage mock for Node test environment ────
const store = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: () => null as string | null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

const CLASSIC_KEY = 'stacked-save-classic';

function fullState(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: [],
    board: [{ id: '2H', rank: '2', suit: 'hearts', value: 2 }],
    hands: [[], [], []],
    overallScores: { player: 0, bot1: 0, bot2: 0 },
    combination: { base: null, combo1: [], combo2: [], combo3: [] },
    currentPlayer: 0,
    lastAction: null,
    lastCapturer: null,
    settings: {
      targetScore: 100,
      bot1Personality: 'beginner',
      bot2Personality: 'beginner',
    },
    currentRound: 1,
    currentDealer: 0,
    handNumber: 1,
    gamePhase: 'playing',
    roundStats: [
      { pointsThisRound: 0, highestCapture: null, tookTheTable: false },
      { pointsThisRound: 0, highestCapture: null, tookTheTable: false },
      { pointsThisRound: 0, highestCapture: null, tookTheTable: false },
    ],
    gameStats: [
      { highestCapture: null },
      { highestCapture: null },
      { highestCapture: null },
    ],
    isOvertime: false,
    ...overrides,
  };
}

function saveOf(game: GameState): SavedGame {
  return { game, seed: 7, dealStream: 1234, botStream: 5678 };
}

describe('persistence — saveGame / loadGame (version 7)', () => {
  beforeEach(() => { store.clear(); });

  it('returns null when nothing is saved', () => {
    expect(loadGame('classic')).toBeNull();
  });

  it('a version-7 save round-trips the game, the seed and both streams, and nothing else', () => {
    const game = fullState({ currentRound: 2 });
    saveGame('classic', saveOf(game));
    const raw = JSON.parse(store.get(CLASSIC_KEY)!);
    expect(raw.version).toBe(7);
    expect(Object.keys(raw).sort()).toEqual(['botStream', 'dealStream', 'game', 'seed', 'version']);
    const loaded = loadGame('classic')!;
    expect(loaded.game).toEqual(game);
    expect(loaded.seed).toBe(7);
    expect(loaded.dealStream).toBe(1234);
    expect(loaded.botStream).toBe(5678);
  });

  it('clearSavedGame empties the slot', () => {
    saveGame('classic', saveOf(fullState()));
    clearSavedGame('classic');
    expect(loadGame('classic')).toBeNull();
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  // ─── Older saves are removed, not converted (S-032, this change only) ──

  for (const version of [6, 5, 4, 3]) {
    it(`a version-${version} save is removed on load, not converted`, () => {
      saveGame('classic', saveOf(fullState()));
      const raw = JSON.parse(store.get(CLASSIC_KEY)!);
      store.set(CLASSIC_KEY, JSON.stringify({ ...raw, version }));
      expect(loadGame('classic')).toBeNull();
      expect(store.has(CLASSIC_KEY)).toBe(false);
    });
  }

  // ─── Bad data ────────────────────────────────────────

  it('rejects corrupt JSON in the slot and clears it', () => {
    store.set(CLASSIC_KEY, '{not json');
    expect(loadGame('classic')).toBeNull();
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  it('rejects a version-7 save without a stream and clears it', () => {
    saveGame('classic', saveOf(fullState()));
    const { botStream: _drop, ...rest } = JSON.parse(store.get(CLASSIC_KEY)!);
    void _drop;
    store.set(CLASSIC_KEY, JSON.stringify(rest));
    expect(loadGame('classic')).toBeNull();
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });
});
