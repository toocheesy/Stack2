import { beforeEach, describe, expect, it } from 'vitest';
import classicRaw from './fixtures/save-v3-classic.json?raw';
import runRaw from './fixtures/save-v3-run.json?raw';
import { loadGame, type SavedGame } from '../../src/game/persistence';
import { cardId } from '../../src/engine/utils/cardId';
import { botStreamSeed } from '../../src/engine/utils/prng';
import type { Card, CaptureRecord } from '../../src/engine/types';

// S-006: conversion of real schema-3 saves. The fixtures were written by main
// c6816a4's own persistence.ts from games in the middle of round 1, driven by
// its own engine: card_ IDs, the three score fields, a tracker.

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

function rankSuit(c: Card): string {
  return `${c.rank} of ${c.suit}`;
}

function zones(game: { deck: Card[]; board: Card[]; hands: [Card[], Card[], Card[]] }, captures: [Card[], Card[], Card[]]): Card[] {
  return [...game.deck, ...game.board, ...game.hands[0], ...game.hands[1], ...game.hands[2], ...captures[0], ...captures[1], ...captures[2]];
}

function expectEachCardInOneZone(cards: Card[]) {
  expect(cards).toHaveLength(52);
  expect(new Set(cards.map((c) => c.id)).size).toBe(52);
  expect(new Set(cards.map(rankSuit)).size).toBe(52);
}

function checkConversion(raw: string, mode: 'classic' | 'run', ownKey: string, otherKey: string) {
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
  const oldById = new Map(before.map((c) => [c.id, c]));

  store.set(LEGACY_KEY, raw);
  const loaded = loadGame(mode, MOUNT_SEED);
  expect(loaded).not.toBeNull();
  const save = loaded as SavedGame;

  // The slot, and the old key is gone.
  expect(store.has(LEGACY_KEY)).toBe(false);
  expect(store.has(otherKey)).toBe(false);
  expect(JSON.parse(store.get(ownKey)!).version).toBe(4);
  expect(save.currentLevelId).toBe(old.currentLevelId);

  // IDs: every card takes its rank and suit, and sits where it sat.
  const after = zones(save.game, save.tracker.playerCaptures);
  expectEachCardInOneZone(after);
  for (const c of after) expect(c.id).toBe(cardId(c.rank, c.suit));
  expect(save.game.deck.map(rankSuit)).toEqual(old.game.deck.map(rankSuit));
  expect(save.game.board.map(rankSuit)).toEqual(old.game.board.map(rankSuit));
  for (const p of [0, 1, 2] as const) {
    expect(save.game.hands[p].map(rankSuit)).toEqual(old.game.hands[p].map(rankSuit));
    expect(save.tracker.playerCaptures[p].map(rankSuit)).toEqual(old.tracker.playerCaptures[p].map(rankSuit));
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

  // Tracker: re-keyed entry for entry, counters unchanged.
  expect(save.tracker.seenCards.size).toBe(old.tracker.seenCardsEntries.length);
  for (const [oldId, location] of old.tracker.seenCardsEntries) {
    const card = oldById.get(oldId)!;
    expect(card).toBeDefined();
    expect(save.tracker.seenCards.get(cardId(card.rank, card.suit))).toBe(location);
  }
  expect(save.tracker.valueCounts).toEqual(old.tracker.valueCounts);
  expect(save.tracker.totalSeen).toBe(old.tracker.totalSeen);
  expect(save.tracker.deckRemaining).toBe(old.tracker.deckRemaining);
  expect(save.tracker.gamePhase).toBe(old.tracker.gamePhase);

  // Seed: the mount seed, both streams fresh from it.
  expect(save.seed).toBe(MOUNT_SEED);
  expect(save.dealStream).toBe(MOUNT_SEED);
  expect(save.botStream).toBe(botStreamSeed(MOUNT_SEED));

  // A second load reads the version-4 slot, not a fresh conversion.
  expect(loadGame(mode, 1)!.seed).toBe(MOUNT_SEED);
  return { old, save };
}

describe('conversion of a real schema-3 save (S-006)', () => {
  beforeEach(() => store.clear());

  it('Classic: lands in the Classic slot with rank-and-suit IDs, one score, the tracker and the seed', () => {
    const { save } = checkConversion(classicRaw, 'classic', CLASSIC_KEY, RUN_KEY);
    expect(save.currentLevelId).toBeNull();
    expect(loadGame('run', 1)).toBeNull();
  });

  it('the Run: lands in the Run slot with its level id', () => {
    const { save } = checkConversion(runRaw, 'run', RUN_KEY, CLASSIC_KEY);
    expect(save.currentLevelId).toBe(3);
    expect(loadGame('classic', 1)).toBeNull();
  });

  it('a duplicate card ID converts, and drops only that tracker entry', () => {
    const old = JSON.parse(classicRaw) as OldSave;
    // Give a deck card the same old ID as a board card the tracker has seen.
    const twin = old.game.board.find((b) => old.tracker.seenCardsEntries.some(([id]) => id === b.id))!;
    expect(twin).toBeDefined();
    old.game.deck[0].id = twin.id;
    store.set(LEGACY_KEY, JSON.stringify(old));

    const save = loadGame('classic', MOUNT_SEED)!;
    expect(save).not.toBeNull();
    expect(store.has(LEGACY_KEY)).toBe(false);

    // Both cards get their own IDs and every card is still in exactly one zone.
    expect(save.game.deck[0].id).toBe(cardId(old.game.deck[0].rank, old.game.deck[0].suit));
    const twinNew = cardId(twin.rank, twin.suit);
    expect(save.game.board.some((b) => b.id === twinNew)).toBe(true);
    expectEachCardInOneZone(zones(save.game, save.tracker.playerCaptures));

    // Only the twin's entry is gone from the seen-cards map.
    expect(save.tracker.seenCards.size).toBe(old.tracker.seenCardsEntries.length - 1);
    expect(save.tracker.seenCards.has(twinNew)).toBe(false);
    expect(save.tracker.seenCards.has(save.game.deck[0].id)).toBe(false);
    const oldById = new Map(zones(old.game, old.tracker.playerCaptures).filter((c) => c.id !== twin.id).map((c) => [c.id, c]));
    for (const [oldId, location] of old.tracker.seenCardsEntries) {
      if (oldId === twin.id) continue;
      const card = oldById.get(oldId)!;
      expect(save.tracker.seenCards.get(cardId(card.rank, card.suit))).toBe(location);
    }
  });
});
