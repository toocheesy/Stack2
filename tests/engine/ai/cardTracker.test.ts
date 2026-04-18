import { describe, expect, it } from 'vitest';
import {
  createCardTracker,
  estimateDeckComposition,
  getRemainingOfRank,
  recordCapture,
  recordPlacement,
  updateGamePhase,
} from '../../../src/engine/ai/cardTracker';
import type { Card, Rank } from '../../../src/engine/types';
import { RANK_VALUES } from '../../../src/engine/types';

let idCounter = 0;
function card(rank: Rank): Card {
  return {
    id: `trk${++idCounter}`,
    rank,
    suit: 'hearts',
    value: RANK_VALUES[rank],
  };
}

describe('createCardTracker', () => {
  it('initializes empty state', () => {
    const t = createCardTracker();
    expect(t.totalSeen).toBe(0);
    expect(t.deckRemaining).toBe(52);
    expect(t.gamePhase).toBe('early');
    expect(t.seenCards.size).toBe(0);
    expect(t.playerCaptures.every((p) => p.length === 0)).toBe(true);
  });
});

describe('recordCapture', () => {
  it('records captures into the right player slot', () => {
    let t = createCardTracker();
    const cards = [card('5'), card('A')];
    t = recordCapture(t, 1, cards);
    expect(t.playerCaptures[1]).toHaveLength(2);
    expect(t.playerCaptures[0]).toHaveLength(0);
    expect(t.valueCounts['5']).toBe(1);
    expect(t.valueCounts.A).toBe(1);
    expect(t.totalSeen).toBe(2);
    expect(t.deckRemaining).toBe(50);
  });

  it('does not mutate input state', () => {
    const t = createCardTracker();
    const snapshotTotal = t.totalSeen;
    recordCapture(t, 0, [card('K')]);
    expect(t.totalSeen).toBe(snapshotTotal);
    expect(t.seenCards.size).toBe(0);
  });

  it('re-recording a known card does not double count', () => {
    let t = createCardTracker();
    const c = card('7');
    t = recordPlacement(t, c);
    expect(t.totalSeen).toBe(1);
    t = recordCapture(t, 0, [c]);
    expect(t.totalSeen).toBe(1);
    expect(t.valueCounts['7']).toBe(1);
  });
});

describe('recordPlacement', () => {
  it('records a placement on board', () => {
    let t = createCardTracker();
    t = recordPlacement(t, card('Q'));
    expect(t.totalSeen).toBe(1);
    expect(t.valueCounts.Q).toBe(1);
  });
});

describe('getRemainingOfRank', () => {
  it('returns 4 minus seen count', () => {
    let t = createCardTracker();
    expect(getRemainingOfRank(t, '5')).toBe(4);
    t = recordCapture(t, 0, [card('5'), card('5')]);
    expect(getRemainingOfRank(t, '5')).toBe(2);
  });
});

describe('estimateDeckComposition', () => {
  it('returns remaining counts per rank', () => {
    let t = createCardTracker();
    t = recordPlacement(t, card('K'));
    const comp = estimateDeckComposition(t);
    expect(comp.K).toBe(3);
    expect(comp.A).toBe(4);
  });
});

describe('updateGamePhase', () => {
  it('transitions at 25/50/75% thresholds', () => {
    let t = createCardTracker();
    expect(updateGamePhase(t)).toBe('early');
    for (let i = 0; i < 13; i++) t = recordPlacement(t, card('2'));
    expect(updateGamePhase(t)).toBe('mid');
    for (let i = 0; i < 13; i++) t = recordPlacement(t, card('2'));
    expect(updateGamePhase(t)).toBe('late');
    for (let i = 0; i < 14; i++) t = recordPlacement(t, card('2'));
    expect(updateGamePhase(t)).toBe('endgame');
  });

  it('game phase reflected in tracker after record', () => {
    let t = createCardTracker();
    for (let i = 0; i < 14; i++) t = recordPlacement(t, card('3'));
    expect(t.gamePhase).toBe('mid');
  });
});
