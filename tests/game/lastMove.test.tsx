// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MOMENTS, landingMs, messageLine, useGameController } from '../../src/game/useGameController';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { Card, GameSettings, GameState, PlayerIndex } from '../../src/engine/types';

// The controller's reads for the board (D-007 release 2, part 1): an
// opponent's capture on show as the Combination it built, slot by slot, and
// the last move the message line and the speech bubbles read.
// Seats are fixed: Rex (advanced) in seat 1, Nina (intermediate) in seat 2.
// The target is low so Rex's risk gate never turns a capture into a place.

const settings: GameSettings = {
  targetScore: 100,
  bot1Personality: 'advanced',
  bot2Personality: 'intermediate',
};
const SEED = 22;
const WELL_PAST = 10_000;

function mount() {
  return renderHook(() => useGameController(SEED, settings, false));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function advanceUntil(done: () => boolean, limitMs = WELL_PAST) {
  const step = 50;
  for (let t = 0; t < limitMs; t += step) {
    if (done()) return;
    await advance(step);
  }
  expect(done()).toBe(true);
}

const ids = (cards: readonly Card[]) => cards.map((c) => c.id);

// A real deal rearranged: the hands and the table the case needs, the deck
// the rest of the pack (or empty), so no card is in two places.
function arrange(over: {
  hand?: string[]; bot1?: string[]; bot2?: string[]; table?: string[];
  deck?: 'rest' | 'empty'; currentPlayer: PlayerIndex; lastCapturer?: PlayerIndex | null; handNumber?: number;
}): GameState {
  const base = createInitialState(settings, createPRNG(SEED));
  const pack = [...base.deck, ...base.board, ...base.hands[0], ...base.hands[1], ...base.hands[2]];
  const pick = (list?: string[]) => (list ?? []).map((id) => pack.find((c) => c.id === id)!);
  const hands: [Card[], Card[], Card[]] = [pick(over.hand), pick(over.bot1), pick(over.bot2)];
  const board = pick(over.table);
  const used = new Set([...hands.flat(), ...board].map((c) => c.id));
  const deck = over.deck === 'empty' ? [] : pack.filter((c) => !used.has(c.id));
  return {
    ...base,
    hands,
    board,
    deck,
    currentPlayer: over.currentPlayer,
    lastAction: null,
    lastCapturer: over.lastCapturer ?? null,
    handNumber: over.handNumber ?? 1,
    combination: { base: null, combo1: [], combo2: [], combo3: [] },
  };
}

function save(game: GameState) {
  saveGame('classic', { game, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
}

describe('the board reads from the controller', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("an opponent's capture replays as the Combination it built, slot by slot (ends S-030)", async () => {
    // Rex's only capture: 9♠ takes 5♥ + 4♣ in one combo and 9♦ in another.
    save(arrange({
      bot1: ['9S', 'JD', 'QC', '10H'], table: ['5H', '4C', '9D', '8S'],
      hand: ['2C', '3C', '7C', '6C'], bot2: ['2D', '3D', '7D', '6D'], currentPlayer: 1,
    }));
    const { result } = mount();
    await advanceUntil(() => result.current.botCombo !== null);

    const show = result.current.botCombo!;
    expect(show.playerIndex).toBe(1);
    expect(show.combination.base!.id).toBe('9S');
    const slots = [show.combination.combo1, show.combination.combo2, show.combination.combo3]
      .filter((s) => s.length > 0)
      .map((s) => ids(s.map((g) => g.card)).sort());
    expect(slots).toHaveLength(2);
    expect(slots).toContainEqual(['4C', '5H']);
    expect(slots).toContainEqual(['9D']);
    for (const s of [show.combination.combo1, show.combination.combo2, show.combination.combo3]) {
      for (const g of s) expect(g.source).toBe('board');
    }
    expect(show.points).toBe(20);
    expect(ids(show.cards).sort()).toEqual(['4C', '5H', '9D', '9S']);

    // The last move is Rex's capture, with the same Combination, and the
    // message line teaches where its base came from.
    const last = result.current.lastCapture!;
    expect(last.player).toBe(1);
    expect(last.captures).toHaveLength(1);
    expect(last.captures[0].combination).toBe(show.combination);
    expect(last.captures[0].points).toBe(20);
    expect(last.placed).toBeNull();
    const s = result.current.state;
    expect(messageLine(s, s.combination, last, show)).toBe("Base from Rex's hand: every combo has a table card.");

    // The cards reach Rex when the show ends.
    await advanceUntil(() => result.current.botCombo === null);
    expect(result.current.state.overallScores.bot1).toBe(20);
  });

  it('your place is the last move, and the line says so while the next opponent thinks', async () => {
    save(arrange({ hand: ['4H', '7C', '8D', '2S'], bot1: ['KS', 'QD', 'JC', '10C'], bot2: ['KD', 'QS', 'JH', '10D'], table: ['3H', '5S', '6D', 'AC'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => { result.current.actions.placeCard('4H'); });
    await advance(0);

    const last = result.current.lastCapture!;
    expect(last.player).toBe(0);
    expect(last.placed!.id).toBe('4H');
    expect(last.rest).toEqual([]);
    expect(last.captures).toEqual([]);
    expect(result.current.state.currentPlayer).toBe(1);
    const s = result.current.state;
    expect(messageLine(s, s.combination, last, result.current.botCombo)).toBe('You placed a 4. Placing ends your turn; there is no pass.');
  });

  it('your capture is the last move until you stage a card', async () => {
    save(arrange({ hand: ['5H', '7C', '8D'], bot1: ['KS', 'QD'], bot2: ['KD', 'QS'], table: ['5C', '9D', 'KC', '3S'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => {
      result.current.actions.addToCombo('5H', 'hand', 'base');
      result.current.actions.addToCombo('5C', 'board', 'combo1');
    });
    let refusal: string | null = 'unset';
    act(() => { refusal = result.current.actions.submitCombo(); });
    expect(refusal).toBeNull();
    await advance(0);

    const last = result.current.lastCapture!;
    expect(last.player).toBe(0);
    expect(last.captures).toHaveLength(1);
    expect(last.captures[0].points).toBe(10);
    expect(ids([last.captures[0].combination.base!, ...last.captures[0].combination.combo1.map((g) => g.card)])).toEqual(['5H', '5C']);
    let s = result.current.state;
    expect(messageLine(s, s.combination, last, null)).toBe('Your turn continues: you still hold 2 cards.');

    act(() => { result.current.actions.addToCombo('7C', 'hand', 'base'); });
    expect(result.current.lastCapture).toBeNull();
    s = result.current.state;
    expect(messageLine(s, s.combination, result.current.lastCapture, null)).toBe('Base from your hand: every combo you fill needs a table card.');
  });

  it('a capture that empties your hand names the next player holding cards, skipping an empty hand (RULES.md Law 12)', async () => {
    save(arrange({ hand: ['5H'], bot1: [], bot2: ['2D', '3D'], table: ['5C', '9D'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => {
      result.current.actions.addToCombo('5H', 'hand', 'base');
      result.current.actions.addToCombo('5C', 'board', 'combo1');
      result.current.actions.submitCombo();
    });
    await advance(0);

    const last = result.current.lastCapture!;
    expect(last.next).toBe(2);
    let s = result.current.state;
    expect(messageLine(s, s.combination, last, result.current.botCombo)).toBe('Your turn ends: your hand is empty. Nina is next.');
    // The next turn starts as your capture lands (YC1, part 2); the line holds meanwhile.
    await advance(MOMENTS.yourCapture.land);
    s = result.current.state;
    expect(s.currentPlayer).toBe(2);
    expect(messageLine(s, s.combination, result.current.lastCapture, result.current.botCombo)).toBe('Your turn ends: your hand is empty. Nina is next.');
  });

  it('RULES.md Law 8: your last place records the rest of your hand, and the line reads it', async () => {
    // Deck empty and a capturer this round, so the round end waits on Take the Table.
    save(arrange({ hand: ['6H', 'JC'], bot1: [], bot2: [], table: ['5C', '9D'], deck: 'empty', currentPlayer: 0, lastCapturer: 1, handNumber: 4 }));
    const { result } = mount();
    act(() => { result.current.actions.placeCard('6H'); });
    await advance(0);

    const last = result.current.lastCapture!;
    expect(last.placed!.id).toBe('6H');
    expect(ids(last.rest)).toEqual(['JC']);
    expect(last.hand).toBe(4);
    // The rest is on the table at once; the round end (and Take the Table,
    // RULES.md Law 10) waits for the last cards to land and the line to hold.
    expect(ids(result.current.state.board)).toEqual(['5C', '9D', '6H', 'JC']);
    await advance(landingMs(1));
    expect(result.current.state.board).toEqual([]);
    expect(result.current.state.overallScores.bot1).toBe(5 + 5 + 5 + 10);
    const s = result.current.state;
    expect(messageLine(s, s.combination, last, null))
      .toBe('Rex and Nina are out of cards. You placed 6♥, so the rest of your hand (J♣) goes onto the table. Hand 4 is over.');
  });

  it('a new deal clears the last move', async () => {
    save(arrange({ hand: ['4H'], bot1: [], bot2: [], table: ['3H', '5S'], currentPlayer: 0 }));
    const { result } = mount();
    act(() => { result.current.actions.placeCard('4H'); });
    await advance(0);
    expect(result.current.state.handNumber).toBe(2);
    expect(result.current.lastCapture).toBeNull();
  });
});
