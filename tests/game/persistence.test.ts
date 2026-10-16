import { describe, expect, it, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSavedGame, saveModeFor, type SavedGame } from '../../src/game/persistence';
import type { GameState } from '../../src/engine/types';
import { botStreamSeed } from '../../src/engine/utils/prng';

// ─── localStorage mock for Node test environment ────
const store = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (_i: number) => null as string | null,
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });

const LEGACY_KEY = 'stacked-v2-game';
const CLASSIC_KEY = 'stacked-save-classic';
const RUN_KEY = 'stacked-save-run';

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
      { pointsThisRound: 0, highestCapture: null },
      { pointsThisRound: 0, highestCapture: null },
      { pointsThisRound: 0, highestCapture: null },
    ],
    gameStats: [
      { highestCapture: null },
      { highestCapture: null },
      { highestCapture: null },
    ],
    dumpActive: false,
    isOvertime: false,
    ...overrides,
  };
}

function saveOf(game: GameState, currentLevelId: number | null = null, seed = 7): SavedGame {
  return { game, currentLevelId, seed, dealStream: 1234, botStream: 5678 };
}

// What a version-4 save's tracker looked like (S-006): the bots' card memory beside the game.
const v4Tracker = {
  seenCardsEntries: [['2H', 'board']],
  valueCounts: { A: 0, '2': 1, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, J: 0, Q: 0, K: 0 },
  playerCaptures: [[], [], []],
  deckRemaining: 39,
  totalSeen: 13,
  gamePhase: 'early',
};

// What an old (schema 3) save's game looked like: the three score fields.
function oldGame(overrides: Record<string, unknown> = {}) {
  const { roundStats: _r, gameStats: _g, ...rest } = fullState();
  void _r;
  void _g;
  return {
    ...rest,
    board: [{ id: 'card_b1', rank: '2', suit: 'hearts', value: 2 }],
    overallScores: { player: 5, bot1: 0, bot2: 0 },
    scores: { player: 5, bot1: 0, bot2: 0 },
    roundStats: [
      { roundScore: 5, highestCapture: null },
      { roundScore: 0, highestCapture: null },
      { roundScore: 0, highestCapture: null },
    ],
    gameStats: [
      { totalScore: 5, highestCapture: null },
      { totalScore: 0, highestCapture: null },
      { totalScore: 0, highestCapture: null },
    ],
    ...overrides,
  };
}

describe('persistence — saveGame / loadGame (schema 5, two slots)', () => {
  beforeEach(() => { store.clear(); });

  it('returns null when nothing saved, in either slot', () => {
    expect(loadGame('classic', 1)).toBeNull();
    expect(loadGame('run', 1)).toBeNull();
  });

  it('saveModeFor: null is Classic, a level id is the Run', () => {
    expect(saveModeFor(null)).toBe('classic');
    expect(saveModeFor(1)).toBe('run');
  });

  it('saveGame + loadGame round-trip preserves game state including dumpActive', () => {
    const s = fullState({ dumpActive: true });
    saveGame('classic', saveOf(s));
    const loaded = loadGame('classic', 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.game.dumpActive).toBe(true);
  });

  it('a version-5 save carries the seed and both stream states, and no tracker', () => {
    saveGame('classic', saveOf(fullState()));
    const raw = JSON.parse(store.get(CLASSIC_KEY)!);
    expect(raw.version).toBe(5);
    expect('tracker' in raw).toBe(false);
    const loaded = loadGame('classic', 999)!;
    expect(loaded.seed).toBe(7);
    expect(loaded.dealStream).toBe(1234);
    expect(loaded.botStream).toBe(5678);
    expect('tracker' in loaded).toBe(false);
  });

  it('each mode writes and clears only its own key', () => {
    saveGame('classic', saveOf(fullState()));
    expect(store.has(CLASSIC_KEY)).toBe(true);
    expect(store.has(RUN_KEY)).toBe(false);
    saveGame('run', saveOf(fullState(), 4));
    expect(store.has(RUN_KEY)).toBe(true);
    clearSavedGame('classic');
    expect(loadGame('classic', 1)).toBeNull();
    expect(loadGame('run', 1)!.currentLevelId).toBe(4);
    clearSavedGame('run');
    expect(loadGame('run', 1)).toBeNull();
  });

  // ─── A version-4 save in a slot ──────────────────────

  it('a version-4 save in a slot converts in place to version 5: tracker dropped, the rest kept', () => {
    const game = fullState({ currentRound: 2 });
    store.set(RUN_KEY, JSON.stringify({ version: 4, game, tracker: v4Tracker, currentLevelId: 6, seed: 99, dealStream: 11, botStream: 22 }));
    const loaded = loadGame('run', 1)!;
    expect(loaded).not.toBeNull();
    expect('tracker' in loaded).toBe(false);
    expect(loaded.game).toEqual(game);
    expect(loaded.currentLevelId).toBe(6);
    expect(loaded.seed).toBe(99);
    expect(loaded.dealStream).toBe(11);
    expect(loaded.botStream).toBe(22);
    const raw = JSON.parse(store.get(RUN_KEY)!);
    expect(raw.version).toBe(5);
    expect('tracker' in raw).toBe(false);
    expect(raw.game).toEqual(game);
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  it('a version-4 save without a stream is cleared, as a version-5 one would be', () => {
    store.set(CLASSIC_KEY, JSON.stringify({ version: 4, game: fullState(), tracker: v4Tracker, currentLevelId: null, seed: 99, dealStream: 11 }));
    expect(loadGame('classic', 1)).toBeNull();
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  // ─── Bad data ────────────────────────────────────────

  it('rejects corrupt JSON in a slot and clears that slot', () => {
    store.set(CLASSIC_KEY, '{not json');
    expect(loadGame('classic', 1)).toBeNull();
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  it('rejects a slot that is neither a version-5 nor a version-4 save and clears it', () => {
    store.set(RUN_KEY, JSON.stringify({ version: 3, game: fullState(), currentLevelId: 2 }));
    expect(loadGame('run', 1)).toBeNull();
    expect(store.has(RUN_KEY)).toBe(false);
  });

  // ─── Conversion of the old single-slot key ───────────

  it('old key, schema 3, Classic: converts into the Classic slot, removes the old key', () => {
    store.set(LEGACY_KEY, JSON.stringify({ version: 3, game: oldGame(), currentLevelId: null }));
    const loaded = loadGame('classic', 42);
    expect(loaded).not.toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);
    expect(store.has(CLASSIC_KEY)).toBe(true);
    expect(store.has(RUN_KEY)).toBe(false);
    expect(loaded!.currentLevelId).toBeNull();
    expect(loaded!.game.board[0].id).toBe('2H');
    expect(loaded!.game.overallScores).toEqual({ player: 5, bot1: 0, bot2: 0 });
    expect(loaded!.game.roundStats[0].pointsThisRound).toBe(5);
    expect('scores' in loaded!.game).toBe(false);
    expect('totalScore' in loaded!.game.gameStats[0]).toBe(false);
    expect('tracker' in loaded!).toBe(false);
    expect(JSON.parse(store.get(CLASSIC_KEY)!).version).toBe(5);
    // An old save has no seed: both streams start fresh from the mount seed.
    expect(loaded!.seed).toBe(42);
    expect(loaded!.dealStream).toBe(42);
    expect(loaded!.botStream).toBe(botStreamSeed(42));
  });

  it('old key, schema 3, the Run: converts into the Run slot and the Classic slot stays empty', () => {
    store.set(LEGACY_KEY, JSON.stringify({ version: 3, game: oldGame(), currentLevelId: 5 }));
    expect(loadGame('classic', 1)).toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);
    const loaded = loadGame('run', 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentLevelId).toBe(5);
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  it('old key, schema 2 (no currentLevelId, a tracker): converts into the Classic slot without the tracker', () => {
    const wireTracker = { ...v4Tracker, seenCardsEntries: [['card_b1', 'board']] };
    store.set(LEGACY_KEY, JSON.stringify({ version: 2, game: oldGame(), tracker: wireTracker }));
    const loaded = loadGame('classic', 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.currentLevelId).toBeNull();
    expect(loaded!.game.board.length).toBe(1);
    expect(loaded!.game.board[0].id).toBe('2H');
    expect('tracker' in loaded!).toBe(false);
    expect('tracker' in JSON.parse(store.get(CLASSIC_KEY)!)).toBe(false);
    expect(store.has(LEGACY_KEY)).toBe(false);
  });

  it('old key, legacy bare game (no version, no tracker): converts, with no tracker', () => {
    store.set(LEGACY_KEY, JSON.stringify(oldGame()));
    const loaded = loadGame('classic', 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.game.board[0].id).toBe('2H');
    expect('tracker' in loaded!).toBe(false);
    expect(store.has(LEGACY_KEY)).toBe(false);
  });

  it('legacy bare game defaults dumpActive to false', () => {
    const { dumpActive: _drop, ...rest } = oldGame();
    void _drop;
    store.set(LEGACY_KEY, JSON.stringify(rest));
    const loaded = loadGame('classic', 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.game.dumpActive).toBe(false);
  });

  it('old key holding a card without rank and suit: nothing lands in a slot, the old key is removed', () => {
    store.set(LEGACY_KEY, JSON.stringify({ version: 3, game: oldGame({ board: [{ id: 'card_x', value: 2 }] }), currentLevelId: null }));
    expect(loadGame('classic', 1)).toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  it('old key holding a malformed save: nothing lands in a slot, the old key is removed', () => {
    store.set(LEGACY_KEY, JSON.stringify({ not: 'a game' }));
    expect(loadGame('classic', 1)).toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);
    expect(store.has(CLASSIC_KEY)).toBe(false);
  });

  it('old key holding corrupt JSON: cleared, as before', () => {
    store.set(LEGACY_KEY, '{not json');
    expect(loadGame('classic', 1)).toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);
  });

  it('old key beside a version-5 save in its slot: the version-5 save is kept, the old key removed', () => {
    saveGame('classic', saveOf(fullState({ currentRound: 3 })));
    store.set(LEGACY_KEY, JSON.stringify({ version: 3, game: oldGame(), currentLevelId: null }));
    const loaded = loadGame('classic', 1);
    expect(loaded!.game.currentRound).toBe(3);
    expect(loaded!.seed).toBe(7);
    expect(store.has(LEGACY_KEY)).toBe(false);
  });
});
