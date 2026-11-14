import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/core/gameState';
import { createPRNG } from '../../src/engine/utils/prng';
import { RANK_VALUES, type Card, type CaptureGroup, type CaptureRecord, type Combination, type GameSettings, type GameState, type Rank, type Suit } from '../../src/engine/types';
import { baseSourceOf, cannotJoin, cardLabel, comboIsValid, stagedPoints, tableCardsThatCannotJoin, takeTheTable } from '../../src/game/useGameController';
import { captureLine, captureWords, moveWords, pointsBreakdown, sourceTags, takeTheTableSentence, worthWords } from '../../src/components/board/words';
import { tableFit } from '../../src/components/board/tableFit';

// The board's reads (D-007 release 2, part 1): the shading rule, the points
// preview, Take the Table, and the words around them.

const settings: GameSettings = { targetScore: 300, bot1Personality: 'intermediate', bot2Personality: 'advanced' };

const SUITS: Record<string, Suit> = { H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' };
function card(id: string): Card {
  const rank = id.slice(0, -1) as Rank;
  return { id, rank, suit: SUITS[id.slice(-1)], value: RANK_VALUES[rank] };
}
const cards = (...ids: string[]) => ids.map(card);
const fromHand = (id: string): CaptureGroup => ({ card: card(id), source: 'hand' });
const fromTable = (id: string): CaptureGroup => ({ card: card(id), source: 'board' });
function build(base: string | null, combo1: CaptureGroup[] = [], combo2: CaptureGroup[] = [], combo3: CaptureGroup[] = []): Combination {
  return { base: base ? card(base) : null, combo1, combo2, combo3 };
}
function state(over: Partial<GameState> & { hand?: string[]; table?: string[] } = {}): GameState {
  const base = createInitialState(settings, createPRNG(3));
  const { hand, table, ...rest } = over;
  return { ...base, hands: [hand ? cards(...hand) : base.hands[0], base.hands[1], base.hands[2]], board: table ? cards(...table) : base.board, currentPlayer: 0, ...rest };
}

describe('cards that cannot join your build (GB2, rulings 19 and 23b)', () => {
  it('a K, Q or J base: every card of another rank', () => {
    expect(cannotJoin(card('KH'), card('QC'))).toBe(true);
    expect(cannotJoin(card('KH'), card('5D'))).toBe(true);
    expect(cannotJoin(card('KH'), card('AD'))).toBe(true);
    expect(cannotJoin(card('KH'), card('KC'))).toBe(false);
  });
  it('a number base: a K, Q or J', () => {
    expect(cannotJoin(card('7H'), card('JC'))).toBe(true);
    expect(cannotJoin(card('7H'), card('QC'))).toBe(true);
    expect(cannotJoin(card('10H'), card('KC'))).toBe(true);
  });
  it('a number base: a card of higher value', () => {
    expect(cannotJoin(card('5H'), card('9C'))).toBe(true);
    expect(cannotJoin(card('5H'), card('6C'))).toBe(true);
    expect(cannotJoin(card('5H'), card('4C'))).toBe(false);
    expect(cannotJoin(card('9H'), card('AC'))).toBe(false);
  });
  it('a card of the same rank joins', () => {
    expect(cannotJoin(card('5H'), card('5C'))).toBe(false);
    expect(cannotJoin(card('10H'), card('10C'))).toBe(false);
    expect(cannotJoin(card('AH'), card('AC'))).toBe(false);
  });
  it('an ace base: every other number card is higher', () => {
    expect(cannotJoin(card('AH'), card('2C'))).toBe(true);
    expect(cannotJoin(card('AH'), card('KC'))).toBe(true);
  });
  it('only table cards are listed; hand cards are never shaded', () => {
    const s = state({ hand: ['KH', '9S', '5D'], table: ['QC', '5C', 'KD'], combination: build('KH') });
    const shaded = tableCardsThatCannotJoin(s);
    expect([...shaded].sort()).toEqual(['5C', 'QC']);
    expect(shaded.has('9S')).toBe(false);
    expect(shaded.has('5D')).toBe(false);
  });
  it('nothing is shaded without a base', () => {
    expect(tableCardsThatCannotJoin(state({ table: ['QC', '5C'] })).size).toBe(0);
  });
});

describe('the points preview (RULES.md Law 6 and the scoring table)', () => {
  it('A 15; K, Q, J, 10 score 10; 2 to 9 score 5', () => {
    expect(stagedPoints(build('AH'))).toBe(15);
    expect(stagedPoints(build('KH'))).toBe(10);
    expect(stagedPoints(build('QH'))).toBe(10);
    expect(stagedPoints(build('JH'))).toBe(10);
    expect(stagedPoints(build('10H'))).toBe(10);
    for (const r of ['2', '3', '4', '5', '6', '7', '8', '9']) expect(stagedPoints(build(`${r}H`))).toBe(5);
  });
  it('every staged card counts, base included', () => {
    expect(stagedPoints(build('AH', [fromTable('KC'), fromTable('QD')], [fromTable('2S'), fromTable('9H')]))).toBe(15 + 10 + 10 + 5 + 5);
    expect(stagedPoints(build('10H', [fromTable('7C'), fromTable('3D')], [], [fromTable('10S')]))).toBe(10 + 5 + 5 + 10);
  });
  it('nothing staged scores nothing', () => {
    expect(stagedPoints(build(null))).toBe(0);
  });
});

describe('a combo on the tray', () => {
  it('where the base came from', () => {
    expect(baseSourceOf(state({ hand: ['5H'] }), build('5H'))).toBe('hand');
    expect(baseSourceOf(state({ hand: ['7C'], table: ['5H'] }), build('5H'))).toBe('board');
    expect(baseSourceOf(state(), build(null))).toBeNull();
  });
  it('is valid when it matches or sums to the base and holds a card from the other side (RULES.md Laws 2 to 5)', () => {
    const s = state({ hand: ['9S', '5D', '4H'], table: ['5H', '4C', '9D', 'KC'] });
    expect(comboIsValid(s, build('9S', [fromTable('5H'), fromTable('4C')]), 'combo1')).toBe(true);
    expect(comboIsValid(s, build('9S', [], [fromTable('9D')]), 'combo2')).toBe(true);
    expect(comboIsValid(s, build('9S', [fromHand('5D'), fromHand('4H')]), 'combo1')).toBe(false);
    expect(comboIsValid(s, build('9S', [fromTable('KC')]), 'combo1')).toBe(false);
    expect(comboIsValid(s, build('9S', [fromTable('5H')]), 'combo1')).toBe(false);
    expect(comboIsValid(s, build('9S'), 'combo1')).toBe(false);
  });
  it('tags its sources: HAND outlined, TABLE solid, ×N for several', () => {
    expect(sourceTags([fromTable('5H'), fromTable('4C')])).toEqual([{ source: 'board', label: 'TABLE ×2' }]);
    expect(sourceTags([fromHand('5H')])).toEqual([{ source: 'hand', label: 'HAND' }]);
    expect(sourceTags([fromHand('5H'), fromTable('4C'), fromTable('3D')])).toEqual([{ source: 'hand', label: 'HAND' }, { source: 'board', label: 'TABLE ×2' }]);
  });
});

describe('Take the Table (RULES.md Law 10) in the last hand', () => {
  it('nothing outside the last hand', () => {
    expect(takeTheTable(state({ lastCapturer: 0 }))).toBeNull();
  });
  it('nothing when nobody has captured this round', () => {
    expect(takeTheTable(state({ deck: [], lastCapturer: null }))).toBeNull();
  });
  it("who is in line and what it's worth", () => {
    const s = state({ deck: [], lastCapturer: 2, table: ['AH', 'KC', '8D', '5S', '4H', '9C'] });
    const read = takeTheTable(s)!;
    expect(read.player).toBe(2);
    expect(read.cards.map((c) => c.id)).toEqual(['AH', 'KC', '8D', '5S', '4H', '9C']);
    expect(read.points).toBe(45);
    expect(worthWords(read.cards.length, read.points)).toBe('6 cards · worth 45');
    expect(pointsBreakdown(read.cards)).toBe('A 15 · K 10 · 8, 5, 4, 9 at 5 each');
  });
  it('the points line groups several cards at one value', () => {
    expect(pointsBreakdown(cards('KC', '10D'))).toBe('K, 10 at 10 each');
    expect(pointsBreakdown(cards('7C'))).toBe('7 5');
    expect(worthWords(1, 5)).toBe('1 card · worth 5');
  });
  it('the line on who can still take it: GB2 when you are in line, ruling 100 when an opponent is', () => {
    expect(takeTheTableSentence('You', ['Rex', 'Nina'])).toBe('You captured last. If Rex or Nina captures before the round ends, they take it instead.');
    expect(takeTheTableSentence('Rex', ['Nina', 'You'])).toBe('Rex captured last. Whoever captures next before the round ends takes it instead.');
    expect(takeTheTableSentence('Nina', ['You', 'Rex'])).toBe('Nina captured last. Whoever captures next before the round ends takes it instead.');
  });
});

describe("a recorded capture's line on the sheets (RE1p, GO2)", () => {
  const record = (base: string, combos: string[][], points: number): CaptureRecord => ({
    points, baseCard: card(base), cards: [card(base), ...combos.flat().map(card)], combos: combos.map((c) => c.map(card)),
  });
  it('one sum combo', () => {
    expect(captureLine(record('10D', [['6C', '4H']], 20))).toBe('10 = 6 + 4');
  });
  it('combos joined with " and "', () => {
    expect(captureLine(record('9S', [['5H', '4C'], ['9D']], 20))).toBe('9 = 5 + 4 and 9');
  });
  it('a match', () => {
    expect(captureLine(record('KS', [['KH']], 20))).toBe('K = K');
    expect(captureLine(record('AS', [['AH', 'AC']], 45))).toBe('A = A + A');
  });
});

describe("an opponent's move in words (GB2's speech bubble)", () => {
  const base = { id: 1, player: 2 as const, rest: [], round: 1, hand: 1, next: null, before: state() };
  it('a capture, then a place', () => {
    const capture = { combination: build('10S', [fromTable('8C'), fromTable('2D')]), points: 20 };
    expect(moveWords({ ...base, captures: [capture], placed: card('6C') })).toBe('took 8 + 2 = 10 (+20), then placed 6♣.');
  });
  it('a place alone', () => {
    expect(moveWords({ ...base, captures: [], placed: card('4H') })).toBe('placed 4♥.');
  });
  it('a capture with a sum and a match, turn going on', () => {
    const capture = { combination: build('9S', [fromTable('5H'), fromTable('4C')], [fromTable('9D')]), points: 20 };
    expect(moveWords({ ...base, captures: [capture], placed: null })).toBe('took 5 + 4 = 9 and 9 (+20).');
  });
  it('two matched cards in one combo', () => {
    expect(captureWords(build('9S', [fromTable('9D'), fromTable('9C')]))).toBe('9, 9');
  });
  it('a card in words', () => {
    expect(cardLabel(card('6H'))).toBe('6♥');
    expect(cardLabel(card('JC'))).toBe('J♣');
    expect(cardLabel(card('10D'))).toBe('10♦');
    expect(cardLabel(card('AS'))).toBe('A♠');
  });
});

describe('the table fits its zone (rows wrap; the scale never goes above 1)', () => {
  // GB2's table at 390: 358 wide, 12px side padding, 228 tall with 50 above and 10 below.
  const W = 358 - 24;
  const H = 228 - 60;
  it('ten cards fit at full size in two rows of five', () => {
    expect(tableFit(10, W, H)).toBe(1);
    expect(tableFit(4, W, H)).toBe(1);
  });
  it('five across still fits at 375', () => {
    expect(tableFit(10, 375 - 32 - 24, H)).toBe(1);
  });
  it('more rows than fit scale the cards down, never above 1', () => {
    const s = tableFit(15, W, H);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThanOrEqual(0.55);
    expect(tableFit(52, W, H)).toBe(0.55);
  });
  it('an empty or unmeasured zone keeps full size', () => {
    expect(tableFit(0, W, H)).toBe(1);
    expect(tableFit(8, 0, 0)).toBe(1);
  });
});
