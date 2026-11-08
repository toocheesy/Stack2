import { describe, expect, it } from 'vitest';
import { applyJackpot, createInitialState, executeCapture, startNewRound } from '../../../src/engine/core/gameState';
import { calculateCardsPoints } from '../../../src/engine/core/scoring';
import { createPRNG } from '../../../src/engine/utils/prng';
import type { Card, CaptureGroup, Combination, GameSettings, GameState, PlayerIndex } from '../../../src/engine/types';

// D-007 release 2, rulings 96 and 97: a capture's record keeps its combos
// slot by slot, and Take the Table (RULES.md Law 10) is not a capture for
// best captures; the taker's round marks it.

const settings: GameSettings = { targetScore: 300, bot1Personality: 'beginner', bot2Personality: 'intermediate', disableSeatingSwap: true };
const SEED = 5;

const ids = (cards: readonly Card[]) => cards.map((c) => c.id);
const fromTable = (card: Card): CaptureGroup => ({ card, source: 'board', originalIndex: 0 });

// A real deal rearranged: the hands and the table the case needs, the deck
// the rest of the pack, so no card is in two places.
function arrange(over: { hand?: string[]; bot1?: string[]; bot2?: string[]; table?: string[]; currentPlayer?: PlayerIndex; lastCapturer?: PlayerIndex | null }): GameState {
  const base = createInitialState(settings, createPRNG(SEED));
  const pack = [...base.deck, ...base.board, ...base.hands[0], ...base.hands[1], ...base.hands[2]];
  const pick = (list?: string[]) => (list ?? []).map((id) => pack.find((c) => c.id === id)!);
  const hands: [Card[], Card[], Card[]] = [pick(over.hand), pick(over.bot1), pick(over.bot2)];
  const board = pick(over.table);
  const used = new Set([...hands.flat(), ...board].map((c) => c.id));
  return {
    ...base,
    hands,
    board,
    deck: pack.filter((c) => !used.has(c.id)),
    currentPlayer: over.currentPlayer ?? 0,
    lastAction: null,
    lastCapturer: over.lastCapturer ?? null,
  };
}

function byId(s: GameState, id: string): Card {
  return [...s.board, ...s.hands.flat()].find((c) => c.id === id)!;
}

describe('a capture record holds its combos (D-007 ruling 96)', () => {
  it('a capture with two combos records them slot by slot, the base left out', () => {
    const s = arrange({ hand: ['9S', '2C'], table: ['5H', '4C', '9D', 'KS'] });
    const combination: Combination = {
      base: byId(s, '9S'),
      combo1: [fromTable(byId(s, '5H')), fromTable(byId(s, '4C'))],
      combo2: [fromTable(byId(s, '9D'))],
      combo3: [],
    };
    const after = executeCapture(s, combination);
    const record = after.roundStats[0].highestCapture!;
    expect(record.combos.map(ids)).toEqual([['5H', '4C'], ['9D']]);
    expect(record.combos.flat().some((c) => c.id === '9S')).toBe(false);
    expect(record.baseCard.id).toBe('9S');
    expect(ids(record.cards)).toEqual(['9S', '5H', '4C', '9D']);
    expect(record.points).toBe(20);
    expect(after.gameStats[0].highestCapture).toEqual(record);
  });

  it('slot order holds when a middle slot is empty', () => {
    const s = arrange({ hand: ['9S', '2C'], table: ['5H', '4C', '9D', 'KS'] });
    const combination: Combination = {
      base: byId(s, '9S'),
      combo1: [fromTable(byId(s, '9D'))],
      combo2: [],
      combo3: [fromTable(byId(s, '5H')), fromTable(byId(s, '4C'))],
    };
    const record = executeCapture(s, combination).roundStats[0].highestCapture!;
    expect(record.combos.map(ids)).toEqual([['9D'], ['5H', '4C']]);
  });

  it('a bigger capture replaces the record, combos and all', () => {
    let s = arrange({ hand: ['9S', 'KH'], table: ['5H', '4C', '9D', 'KS'] });
    s = executeCapture(s, { base: byId(s, 'KH'), combo1: [fromTable(byId(s, 'KS'))], combo2: [], combo3: [] });
    expect(s.roundStats[0].highestCapture!.points).toBe(20);
    s = executeCapture(s, { base: byId(s, '9S'), combo1: [fromTable(byId(s, '5H')), fromTable(byId(s, '4C'))], combo2: [fromTable(byId(s, '9D'))], combo3: [] });
    expect(s.roundStats[0].highestCapture!.points).toBe(20);
    expect(s.roundStats[0].highestCapture!.combos.map(ids)).toEqual([['KS']]);
  });
});

describe('Take the Table is not a capture (D-007 ruling 97, RULES.md Laws 10 and 16)', () => {
  it("after applyJackpot nobody's highestCapture changed, the taker alone took the table, and the score is as before", () => {
    let s = arrange({ hand: ['9S', '2C'], bot1: ['7H'], table: ['5H', '4C', '9D', 'KS', '3D'] });
    s = executeCapture(s, { base: byId(s, '9S'), combo1: [fromTable(byId(s, '5H')), fromTable(byId(s, '4C'))], combo2: [], combo3: [] });
    // The round's last capturer is bot 1 (as if it captured after you).
    s = { ...s, lastCapturer: 1, deck: [], hands: [[], [], []] };
    const roundBefore = s.roundStats.map((r) => r.highestCapture);
    const gameBefore = s.gameStats.map((g) => g.highestCapture);
    const tablePoints = calculateCardsPoints(s.board);
    expect(tablePoints).toBe(5 + 10 + 5);

    const { state: after, jackpotResult } = applyJackpot(s);
    expect(jackpotResult!.points).toBe(tablePoints);
    expect(jackpotResult!.cardCount).toBe(3);
    expect(after.overallScores).toEqual({ ...s.overallScores, bot1: s.overallScores.bot1 + tablePoints });
    expect(after.roundStats[1].pointsThisRound).toBe(s.roundStats[1].pointsThisRound + tablePoints);
    expect(after.roundStats.map((r) => r.highestCapture)).toEqual(roundBefore);
    expect(after.gameStats.map((g) => g.highestCapture)).toEqual(gameBefore);
    expect(after.roundStats[1].highestCapture).toBeNull();
    expect(after.roundStats.map((r) => r.tookTheTable)).toEqual([false, true, false]);
    expect(after.board).toEqual([]);
    // No card moved anywhere but off the board.
    expect(after.hands).toEqual(s.hands);
    expect(after.deck).toEqual(s.deck);
  });

  it('tookTheTable starts false for everyone and resets with the round', () => {
    const start = createInitialState(settings, createPRNG(SEED));
    expect(start.roundStats.map((r) => r.tookTheTable)).toEqual([false, false, false]);
    const taken = applyJackpot({ ...start, lastCapturer: 2 }).state;
    expect(taken.roundStats.map((r) => r.tookTheTable)).toEqual([false, false, true]);
    const next = startNewRound(taken, createPRNG(99));
    expect(next.roundStats.map((r) => r.tookTheTable)).toEqual([false, false, false]);
  });

  it('nobody takes the table when nobody captured this round (RULES.md Law 10)', () => {
    const s = arrange({ table: ['5H', '4C'], lastCapturer: null });
    const { state: after, jackpotResult } = applyJackpot(s);
    expect(jackpotResult).toBeNull();
    expect(after).toBe(s);
    expect(after.roundStats.map((r) => r.tookTheTable)).toEqual([false, false, false]);
  });
});
