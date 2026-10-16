import { beforeEach, describe, expect, it } from 'vitest';
import classicV3Raw from './fixtures/save-v3-classic.json?raw';
import runV3Raw from './fixtures/save-v3-run.json?raw';
import classicV4Raw from './fixtures/save-v4-classic.json?raw';
import runV4Raw from './fixtures/save-v4-run.json?raw';
import { loadGame, type SavedGame } from '../../src/game/persistence';
import { cardId } from '../../src/engine/utils/cardId';
import { botStreamSeed } from '../../src/engine/utils/prng';
import type { Card, CaptureRecord, GameState } from '../../src/engine/types';

// S-006: conversion of real schema-3 saves. The fixtures were written by main
// c6816a4's own persistence.ts from games in the middle of round 1, driven by
// its own engine: card_ IDs, the three score fields, a tracker.
// S-008: conversion of real version-4 saves. The fixtures were written by main
// bbe79b6's own persistence.ts from games paused in the middle of round 1
// through the runner: rank-and-suit IDs, the seed and both streams, and the
// bots' card memory (the tracker) that version 5 no longer saves.

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

const LEGACY_KEY = 'stacked-v2-game';
const CLASSIC_KEY = 'stacked-save-classic';
const RUN_KEY = 'stacked-save-run';
const MOUNT_SEED = 31337;

interface OldSave {
  version: number;
  currentLevelId: number | null;
  game: {
    deck: Card[];
    board: Card[];
    hands: [Card[], Card[], Card[]];
    scores: Record<string, number>;
    overallScores: Record<string, number>;
    gamePhase: string;
    currentRound: number;
    roundStats: { roundScore: number; highestCapture: CaptureRecord | null }[];
    gameStats: { totalScore: number; highestCapture: CaptureRecord | null }[];
  };
  tracker: {
    seenCardsEntries: [string, string][];
    valueCounts: Record<string, number>;
    playerCaptures: [Card[], Card[], Card[]];
    deckRemaining: number;
    totalSeen: number;
    gamePhase: string;
  };
}

interface V4Save {
  version: number;
  game: GameState;
  tracker: { playerCaptures: [Card[], Card[], Card[]]; totalSeen: number };
  currentLevelId: number | null;
  seed: number;
  dealStream: number;
  botStream: number;
}

function rankSuit(c: Card): string {
  return `${c.rank} of ${c.suit}`;
}

// The cards a save holds: the game's zones plus the captured cards, which the
// game does not hold and the save's tracker did.
function zones(game: { deck: Card[]; board: Card[]; hands: [Card[], Card[], Card[]] }, captures: [Card[], Card[], Card[]]): Card[] {
  return [...game.deck, ...game.board, ...game.hands[0], ...game.hands[1], ...game.hands[2], ...captures[0], ...captures[1], ...captures[2]];
}

function expectEachCardInOneZone(cards: Card[]) {
  expect(cards).toHaveLength(52);
  expect(new Set(cards.map((c) => c.id)).size).toBe(52);
  expect(new Set(cards.map(rankSuit)).size).toBe(52);
}

function renewed(captures: [Card[], Card[], Card[]]): [Card[], Card[], Card[]] {
  return captures.map((cards) => cards.map((c) => ({ ...c, id: cardId(c.rank, c.suit) }))) as [Card[], Card[], Card[]];
}

function checkV3Conversion(raw: string, mode: 'classic' | 'run', ownKey: string, otherKey: string) {
  const old = JSON.parse(raw) as OldSave;
  // A real schema-3 save from mid-round.
  expect(old.version).toBe(3);
  expect(old.game.gamePhase).toBe('playing');
  expect(old.game.currentRound).toBe(1);
  expect(old.game.roundStats.some((r) => r.roundScore > 0)).toBe(true);
  expect(old.tracker.seenCardsEntries.length).toBeGreaterThan(0);
  const before = zones(old.game, old.tracker.playerCaptures);
  expectEachCardInOneZone(before);
  expect(before.every((c) => c.id.startsWith('card_'))).toBe(true);

  store.set(LEGACY_KEY, raw);
  const loaded = loadGame(mode, MOUNT_SEED);
  expect(loaded).not.toBeNull();
  const save = loaded as SavedGame;

  // The slot at version 5 with no tracker, and the old key is gone.
  expect(store.has(LEGACY_KEY)).toBe(false);
  expect(store.has(otherKey)).toBe(false);
  const slot = JSON.parse(store.get(ownKey)!);
  expect(slot.version).toBe(5);
  expect('tracker' in slot).toBe(false);
  expect('tracker' in save).toBe(false);
  expect(save.currentLevelId).toBe(old.currentLevelId);

  // IDs: every card takes its rank and suit, and sits where it sat. The old
  // tracker's captured cards, renewed the same way, fill in the captured zone.
  const after = zones(save.game, renewed(old.tracker.playerCaptures));
  expectEachCardInOneZone(after);
  for (const c of after) expect(c.id).toBe(cardId(c.rank, c.suit));
  expect(save.game.deck.map(rankSuit)).toEqual(old.game.deck.map(rankSuit));
  expect(save.game.board.map(rankSuit)).toEqual(old.game.board.map(rankSuit));
  for (const p of [0, 1, 2] as const) {
    expect(save.game.hands[p].map(rankSuit)).toEqual(old.game.hands[p].map(rankSuit));
  }
  for (const p of [0, 1, 2] as const) {
    const oldRecord = old.game.roundStats[p].highestCapture;
    const record = save.game.roundStats[p].highestCapture;
    expect(record === null).toBe(oldRecord === null);
    if (record && oldRecord) {
      expect(record.baseCard.id).toBe(cardId(oldRecord.baseCard.rank, oldRecord.baseCard.suit));
      expect(record.cards.map((c) => c.id)).toEqual(oldRecord.cards.map((c) => cardId(c.rank, c.suit)));
      expect(record.points).toBe(oldRecord.points);
    }
    expect(save.game.gameStats[p].highestCapture?.baseCard.id).toBe(
      old.game.gameStats[p].highestCapture ? cardId(old.game.gameStats[p].highestCapture.baseCard.rank, old.game.gameStats[p].highestCapture.baseCard.suit) : undefined,
    );
  }

  // Scores: overallScores kept, roundScore becomes pointsThisRound, the rest dropped.
  expect(save.game.overallScores).toEqual(old.game.overallScores);
  expect(save.game.roundStats.map((r) => r.pointsThisRound)).toEqual(old.game.roundStats.map((r) => r.roundScore));
  expect('scores' in save.game).toBe(false);
  for (const g of save.game.gameStats) expect('totalScore' in g).toBe(false);

  // Seed: the mount seed, both streams fresh from it.
  expect(save.seed).toBe(MOUNT_SEED);
  expect(save.dealStream).toBe(MOUNT_SEED);
  expect(save.botStream).toBe(botStreamSeed(MOUNT_SEED));

  // A second load reads the version-5 slot, not a fresh conversion.
  expect(loadGame(mode, 1)!.seed).toBe(MOUNT_SEED);
  return { old, save };
}

function checkV4Conversion(raw: string, mode: 'classic' | 'run', ownKey: string, otherKey: string) {
  const old = JSON.parse(raw) as V4Save;
  // A real version-4 save from mid-round, with a tracker beside the game.
  expect(old.version).toBe(4);
  expect(old.game.gamePhase).toBe('playing');
  expect(old.game.currentRound).toBe(1);
  expect(old.tracker.playerCaptures.flat().length).toBeGreaterThan(0);
  expectEachCardInOneZone(zones(old.game, old.tracker.playerCaptures));

  store.set(ownKey, raw);
  store.set(otherKey, 'the other slot');
  const loaded = loadGame(mode, MOUNT_SEED);
  expect(loaded).not.toBeNull();
  const save = loaded as SavedGame;

  // Its own slot rewritten as version 5 with no tracker; the other slot untouched.
  const slot = JSON.parse(store.get(ownKey)!);
  expect(slot.version).toBe(5);
  expect('tracker' in slot).toBe(false);
  expect('tracker' in save).toBe(false);
  expect(store.get(otherKey)).toBe('the other slot');

  // Game, level, seed and both streams as the fixture had them.
  expect(save.game).toEqual(old.game);
  expect(save.currentLevelId).toBe(old.currentLevelId);
  expect(save.seed).toBe(old.seed);
  expect(save.dealStream).toBe(old.dealStream);
  expect(save.botStream).toBe(old.botStream);
  expect(slot.game).toEqual(old.game);
  expect(slot.currentLevelId).toBe(old.currentLevelId);
  expect(slot.seed).toBe(old.seed);
  expect(slot.dealStream).toBe(old.dealStream);
  expect(slot.botStream).toBe(old.botStream);

  // Each card in exactly one zone, the fixture's captured cards filling in what the game doesn't hold.
  expectEachCardInOneZone(zones(save.game, old.tracker.playerCaptures));

  // A second load reads the rewritten slot as it is.
  expect(loadGame(mode, 1)).toEqual(save);
  expect(JSON.parse(store.get(ownKey)!)).toEqual(slot);
  return { old, save };
}

describe('conversion of a real schema-3 save (S-006)', () => {
  beforeEach(() => store.clear());

  it('Classic: lands in the Classic slot with rank-and-suit IDs, one score, no tracker and the seed', () => {
    const { save } = checkV3Conversion(classicV3Raw, 'classic', CLASSIC_KEY, RUN_KEY);
    expect(save.currentLevelId).toBeNull();
    expect(loadGame('run', 1)).toBeNull();
  });

  it('the Run: lands in the Run slot with its level id', () => {
    const { save } = checkV3Conversion(runV3Raw, 'run', RUN_KEY, CLASSIC_KEY);
    expect(save.currentLevelId).toBe(3);
    expect(loadGame('classic', 1)).toBeNull();
  });

  it('a duplicate card ID converts, and both cards take their own IDs', () => {
    const old = JSON.parse(classicV3Raw) as OldSave;
    // Give a deck card the same old ID as a board card.
    const twin = old.game.board[0];
    old.game.deck[0].id = twin.id;
    store.set(LEGACY_KEY, JSON.stringify(old));

    const save = loadGame('classic', MOUNT_SEED)!;
    expect(save).not.toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);

    // Both cards get their own IDs and every card is still in exactly one zone.
    expect(save.game.deck[0].id).toBe(cardId(old.game.deck[0].rank, old.game.deck[0].suit));
    const twinNew = cardId(twin.rank, twin.suit);
    expect(save.game.board.some((b) => b.id === twinNew)).toBe(true);
    expectEachCardInOneZone(zones(save.game, renewed(old.tracker.playerCaptures)));
  });
});

describe('conversion of a real version-4 save (S-008)', () => {
  beforeEach(() => store.clear());

  it('Classic slot: converts in place to version 5 without its tracker, everything else as it was', () => {
    const { save } = checkV4Conversion(classicV4Raw, 'classic', CLASSIC_KEY, RUN_KEY);
    expect(save.currentLevelId).toBeNull();
    expect(save.seed).toBe(4242);
  });

  it('Run slot: converts in place to version 5 without its tracker, everything else as it was', () => {
    const { save } = checkV4Conversion(runV4Raw, 'run', RUN_KEY, CLASSIC_KEY);
    expect(save.currentLevelId).toBe(1);
    expect(save.seed).toBe(777);
  });
});
