import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/engine/core/gameState';
import { createPRNG } from '../../src/engine/utils/prng';
import { RANK_VALUES, type Card, type CaptureGroup, type Combination, type GameSettings, type GameState, type Rank, type Suit } from '../../src/engine/types';
import { messageLine, type BotComboDisplay, type LastMove } from '../../src/game/useGameController';

// D-007 ruling 95: the message line's words, and the order its rules apply
// in. Seats are fixed: Nina (intermediate) in seat 1, Rex (advanced) in seat 2.

const settings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'intermediate',
  bot2Personality: 'advanced',
  disableSeatingSwap: true,
};

const SUITS: Record<string, Suit> = { H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' };
function card(id: string): Card {
  const rank = id.slice(0, -1) as Rank;
  return { id, rank, suit: SUITS[id.slice(-1)], value: RANK_VALUES[rank] };
}
const cards = (...ids: string[]) => ids.map(card);
const fromHand = (id: string): CaptureGroup => ({ card: card(id), source: 'hand', originalIndex: 0 });
const fromTable = (id: string): CaptureGroup => ({ card: card(id), source: 'board', originalIndex: 0 });
const NOTHING: Combination = { base: null, combo1: [], combo2: [], combo3: [] };
function build(base: string, combo1: CaptureGroup[] = [], combo2: CaptureGroup[] = [], combo3: CaptureGroup[] = []): Combination {
  return { base: card(base), combo1, combo2, combo3 };
}

// A real deal, then what the case needs: the hands, the table, the deck, whose turn.
function state(over: Partial<GameState> & { hand?: string[]; table?: string[]; bot1?: string[]; bot2?: string[] } = {}): GameState {
  const base = createInitialState(settings, createPRNG(3));
  const { hand, table, bot1, bot2, ...rest } = over;
  return {
    ...base,
    hands: [
      hand ? cards(...hand) : base.hands[0],
      bot1 ? cards(...bot1) : base.hands[1],
      bot2 ? cards(...bot2) : base.hands[2],
    ],
    board: table ? cards(...table) : base.board,
    currentPlayer: 0,
    ...rest,
  };
}

function move(over: Partial<LastMove>): LastMove {
  return { id: 1, player: 0, captures: [], placed: null, rest: [], round: 1, hand: 1, next: null, before: state(), ...over };
}
const ONE_CAPTURE = { combination: build('5H', [fromTable('5C')]), points: 10 };

function replay(player: 1 | 2, combination: Combination): BotComboDisplay {
  return { playerIndex: player, combination, points: 0, cards: [] };
}

const YOUR_TURN = 'Your turn. Pick a base card to start a capture.';
const BASE_FROM_HAND = 'Base from your hand: every combo you fill needs a table card.';
const BASE_FROM_TABLE = 'Base from the table: every combo you fill needs a card from your hand.';
const KINGS = 'Kings, queens and jacks only match their own kind.';
const MIXED = 'Each combo matches the base or sums to it, never both.';
const ACES = 'Aces count as 1 in a sum.';
const TENS = '10s sum like any number.';
const LAST_HAND = 'Last hand: the deck is empty. When the round ends, the last player to capture takes every card left on the table.';

describe('the message line (D-007 ruling 95)', () => {
  describe('your turn', () => {
    it('nothing in the tray', () => {
      expect(messageLine(state(), NOTHING, null, null)).toBe(YOUR_TURN);
    });
    it('base from your hand', () => {
      expect(messageLine(state({ hand: ['5H', '7C'] }), build('5H'), null, null)).toBe(BASE_FROM_HAND);
    });
    it('base from the table', () => {
      expect(messageLine(state({ hand: ['7C'], table: ['5H', '9D'] }), build('5H'), null, null)).toBe(BASE_FROM_TABLE);
    });
    it('a K, Q or J as the base', () => {
      expect(messageLine(state({ hand: ['KH'] }), build('KH', [fromTable('KC')]), null, null)).toBe(KINGS);
      expect(messageLine(state({ hand: ['QH'] }), build('QH'), null, null)).toBe(KINGS);
      expect(messageLine(state({ hand: ['JH'] }), build('JH'), null, null)).toBe(KINGS);
    });
    it('a combo mixing a match and a sum', () => {
      expect(messageLine(state({ hand: ['5H'] }), build('5H', [fromTable('5C'), fromTable('2D')]), null, null)).toBe(MIXED);
    });
    it('an ace in a sum', () => {
      expect(messageLine(state({ hand: ['5H'] }), build('5H', [fromTable('AC'), fromTable('4D')]), null, null)).toBe(ACES);
    });
    it('a 10 as the base', () => {
      expect(messageLine(state({ hand: ['10H'] }), build('10H'), null, null)).toBe(TENS);
    });
  });

  describe('after you move', () => {
    it('you capture and still hold cards', () => {
      expect(messageLine(state({ hand: ['7C', '8D'] }), NOTHING, move({ captures: [ONE_CAPTURE] }), null))
        .toBe('Your turn continues: you still hold 2 cards.');
    });
    it('one card', () => {
      expect(messageLine(state({ hand: ['7C'] }), NOTHING, move({ captures: [ONE_CAPTURE] }), null))
        .toBe('Your turn continues: you still hold 1 card.');
    });
    it('you capture and your hand is empty', () => {
      expect(messageLine(state({ hand: [], currentPlayer: 1 }), NOTHING, move({ captures: [ONE_CAPTURE], next: 1 }), null))
        .toBe('Your turn ends: your hand is empty. Nina is next.');
    });
    it('the next player is the next one holding cards (RULES.md Law 12)', () => {
      expect(messageLine(state({ hand: [], bot1: [], currentPlayer: 2 }), NOTHING, move({ captures: [ONE_CAPTURE], next: 2 }), null))
        .toBe('Your turn ends: your hand is empty. Rex is next.');
    });
    it('you place a card', () => {
      expect(messageLine(state({ currentPlayer: 1 }), NOTHING, move({ placed: card('4H') }), null))
        .toBe('You placed a 4. Placing ends your turn; there is no pass.');
    });
    it('"an" before an 8 or an A', () => {
      expect(messageLine(state({ currentPlayer: 1 }), NOTHING, move({ placed: card('8C') }), null))
        .toBe('You placed an 8. Placing ends your turn; there is no pass.');
      expect(messageLine(state({ currentPlayer: 1 }), NOTHING, move({ placed: card('AS') }), null))
        .toBe('You placed an A. Placing ends your turn; there is no pass.');
    });
  });

  describe('opponents', () => {
    it("an opponent's turn starts", () => {
      expect(messageLine(state({ currentPlayer: 1 }), NOTHING, null, null)).toBe("Nina's turn.");
      expect(messageLine(state({ currentPlayer: 2 }), NOTHING, null, null)).toBe("Rex's turn.");
    });
    it("a capture replays, base from the opponent's hand", () => {
      const s = state({ currentPlayer: 2, bot2: ['9S', 'JD'], table: ['5H', '4C', '9D'] });
      const r = replay(2, build('9S', [fromTable('5H'), fromTable('4C')], [fromTable('9D')]));
      expect(messageLine(s, NOTHING, null, r)).toBe("Base from Rex's hand: every combo has a table card.");
    });
    it('a capture replays, base from the table', () => {
      const s = state({ currentPlayer: 1, bot1: ['9S'], table: ['9D', '5H', '4C'] });
      const r = replay(1, build('9D', [fromHand('9S')]));
      expect(messageLine(s, NOTHING, null, r)).toBe("Base from the table: every combo has a card from Nina's hand.");
    });
  });

  describe('the last hand', () => {
    it('in place of "Your turn…"', () => {
      expect(messageLine(state({ deck: [] }), NOTHING, null, null)).toBe(LAST_HAND);
    });
    it('in place of "Rex\'s turn."', () => {
      expect(messageLine(state({ deck: [], currentPlayer: 2 }), NOTHING, null, null)).toBe(LAST_HAND);
    });
    it('the last cards (RULES.md Law 8), you last', () => {
      const s = state({ hand: [], bot1: [], bot2: [], deck: [], handNumber: 4 });
      expect(messageLine(s, NOTHING, move({ placed: card('6H'), rest: cards('JC'), hand: 4 }), null))
        .toBe('Nina and Rex are out of cards. You placed 6♥, so the rest of your hand (J♣) goes onto the table. Hand 4 is over.');
    });
    it('the last cards, an opponent last', () => {
      const s = state({ hand: [], bot1: [], bot2: [], deck: [], handNumber: 4, currentPlayer: 2 });
      expect(messageLine(s, NOTHING, move({ player: 2, placed: card('6H'), rest: cards('JC'), hand: 4 }), null))
        .toBe("You and Nina are out of cards. Rex placed 6♥, so the rest of Rex's hand (J♣) goes onto the table. Hand 4 is over.");
    });
    it('the last cards, more than one card in the rest', () => {
      const s = state({ hand: [], bot1: [], bot2: [], handNumber: 2 });
      expect(messageLine(s, NOTHING, move({ placed: card('6H'), rest: cards('JC', '4D'), hand: 2 }), null))
        .toBe('Nina and Rex are out of cards. You placed 6♥, so the rest of your hand (J♣, 4♦) goes onto the table. Hand 2 is over.');
    });
  });

  describe('which line shows: first match wins', () => {
    it('1 over 2: the last cards over your place', () => {
      const s = state({ hand: [], bot1: [], bot2: [] });
      expect(messageLine(s, NOTHING, move({ placed: card('6H'), rest: cards('JC') }), null)).toMatch(/^Nina and Rex are out of cards/);
    });
    it('1 ends when the next hand is dealt', () => {
      const s = state({ handNumber: 2, currentPlayer: 1 });
      expect(messageLine(s, NOTHING, move({ placed: card('6H'), rest: cards('JC'), hand: 1 }), null)).toBe("Nina's turn.");
    });
    it('2 over 3: after your move over a replay on show', () => {
      const s = state({ hand: ['7C'] });
      const r = replay(2, build('9S', [fromTable('9D')]));
      expect(messageLine(s, NOTHING, move({ captures: [ONE_CAPTURE] }), r)).toBe('Your turn continues: you still hold 1 card.');
    });
    it('2 ends when you stage a card', () => {
      const s = state({ hand: ['5H', '7C'] });
      expect(messageLine(s, build('5H'), move({ captures: [ONE_CAPTURE] }), null)).toBe(BASE_FROM_HAND);
    });
    it('2 ends when the next player moves', () => {
      expect(messageLine(state(), NOTHING, move({ player: 1, placed: card('4H') }), null)).toBe(YOUR_TURN);
    });
    it('2 ends when the next hand is dealt', () => {
      expect(messageLine(state({ handNumber: 2 }), NOTHING, move({ placed: card('4H'), hand: 1 }), null)).toBe(YOUR_TURN);
    });
    it('3 over 4, 5 and 6: a replay in the last hand', () => {
      const s = state({ currentPlayer: 2, bot2: ['9S'], table: ['9D'], deck: [] });
      expect(messageLine(s, NOTHING, null, replay(2, build('9S', [fromTable('9D')])))).toBe("Base from Rex's hand: every combo has a table card.");
    });
    it('4 over 5: building in the last hand', () => {
      expect(messageLine(state({ hand: ['5H'], deck: [] }), build('5H'), null, null)).toBe(BASE_FROM_HAND);
    });
    it('4 (a) mixed before (b) kings', () => {
      expect(messageLine(state({ hand: ['KH'] }), build('KH', [fromTable('KC'), fromTable('2D')]), null, null)).toBe(MIXED);
    });
    it('4 (b) kings before (c) the base source', () => {
      expect(messageLine(state({ hand: ['KH', 'KD'] }), build('KH', [fromHand('KD')]), null, null)).toBe(KINGS);
    });
    it('4 (c) the base source before (d) aces: a combo with no card from the other side', () => {
      expect(messageLine(state({ hand: ['5H', 'AC', '4D'] }), build('5H', [fromHand('AC'), fromHand('4D')]), null, null)).toBe(BASE_FROM_HAND);
      expect(messageLine(state({ hand: ['9S'], table: ['5H', 'AC', '4D'] }), build('5H', [fromTable('AC'), fromTable('4D')]), null, null)).toBe(BASE_FROM_TABLE);
    });
    it('4 (d) aces before (e) 10s', () => {
      expect(messageLine(state({ hand: ['10H'] }), build('10H', [fromTable('AC'), fromTable('9D')]), null, null)).toBe(ACES);
    });
    it('4 (e) 10s before (f) the base source', () => {
      expect(messageLine(state({ hand: ['10H'] }), build('10H', [fromTable('6C'), fromTable('4D')]), null, null)).toBe(TENS);
    });
    it('4 (f) the base source for a plain build', () => {
      expect(messageLine(state({ hand: ['5H'] }), build('5H', [fromTable('5C')]), null, null)).toBe(BASE_FROM_HAND);
      expect(messageLine(state({ hand: ['5C'], table: ['5H'] }), build('5H', [fromHand('5C')]), null, null)).toBe(BASE_FROM_TABLE);
    });
    it('5 over 6', () => {
      expect(messageLine(state({ deck: [] }), NOTHING, null, null)).toBe(LAST_HAND);
    });
  });

  describe("the Run's hint strip, in place of 2, 4 and 6", () => {
    const run = (over: Parameters<typeof state>[0] = {}) => state({ settings: { ...settings, hintStripEnabled: true }, ...over });
    it('6: your turn and an opponent\'s turn', () => {
      expect(messageLine(run(), NOTHING, null, null)).toBe('Drag a card to start your turn');
      expect(messageLine(run({ currentPlayer: 2 }), NOTHING, null, null)).toBe('Watch the opponents play their turn');
    });
    it('4: while you build', () => {
      expect(messageLine(run({ hand: ['5H'] }), build('5H'), null, null)).toBe('Combo groups must sum (or match) the base card value');
      expect(messageLine(run({ hand: ['5H'], table: ['5C', '9D'] }), build('5H', [fromTable('5C')]), null, null)).toBe('Tap SUBMIT to capture, or RESET to clear');
    });
    it('2: after your move', () => {
      expect(messageLine(run({ hand: ['7C'] }), NOTHING, move({ captures: [ONE_CAPTURE] }), null)).toBe('Drag a card to start your turn');
      expect(messageLine(run({ currentPlayer: 1 }), NOTHING, move({ placed: card('4H') }), null)).toBe('Watch the opponents play their turn');
    });
    it('not 1, 3 or 5', () => {
      expect(messageLine(run({ hand: [], bot1: [], bot2: [] }), NOTHING, move({ placed: card('6H'), rest: cards('JC') }), null)).toMatch(/^Nina and Rex are out of cards/);
      expect(messageLine(run({ currentPlayer: 2, bot2: ['9S'], table: ['9D'] }), NOTHING, null, replay(2, build('9S', [fromTable('9D')])))).toBe("Base from Rex's hand: every combo has a table card.");
      expect(messageLine(run({ deck: [] }), NOTHING, null, null)).toBe(LAST_HAND);
    });
  });
});
