// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

// jsdom has no matchMedia, and the app asks for it as its modules load.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import App from '../../src/App';
import { saveGame } from '../../src/game/persistence';
import { createInitialState } from '../../src/engine/core/gameState';
import { botStreamSeed, createPRNG } from '../../src/engine/utils/prng';
import type { GameSettings, GameState } from '../../src/engine/types';

// The game board, GB2 (D-007 release 2, part 1), through the whole app: the
// top bar's mode line, the seats, the message line, the table's deck count,
// your bar and the tray's absence until you build.

const SEED = 1;

const classicSettings: GameSettings = {
  targetScore: 300,
  bot1Personality: 'intermediate',
  bot2Personality: 'advanced',
  disableSeatingSwap: true,
};

function yourTurn(settings: GameSettings): GameState {
  const game = createInitialState(settings, createPRNG(SEED));
  return { ...game, currentPlayer: 0, lastAction: null };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('the game board (GB2)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.gtag = vi.fn() as (...args: unknown[]) => void;
  });

  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Classic, your turn: the top bar, the seats, the message line, the table, your bar and hand; no tray', () => {
    saveGame('classic', { game: yourTurn(classicSettings), seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
    render(<App />);
    fireEvent.click(screen.getByText('CONTINUE'));

    // The mode line, once visible and once in the top bar's hidden width probe.
    expect(screen.getAllByText('CLASSIC · 300 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Leave game' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByText('Nina')).toBeTruthy();
    expect(screen.getByText('Rex')).toBeTruthy();
    // The scores pop when they change, so each sits in its own span inside the line.
    const lineOf = (text: string) => screen.getAllByText((_, el) => el?.tagName === 'SPAN' && el.textContent === text && el.children.length > 0);
    expect(lineOf('0 / 300')).toHaveLength(2);
    expect(screen.getAllByText('4 CARDS')).toHaveLength(2);
    expect(screen.getByText('Your turn. Pick a base card to start a capture.')).toBeTruthy();
    expect(screen.getByText('DECK 36')).toBeTruthy();
    expect(screen.getByText('YOUR TURN')).toBeTruthy();
    expect(lineOf('You 0 / 300')).toHaveLength(1);
    expect(screen.queryByText('YOUR CAPTURE')).toBeNull();
    expect(screen.queryByText('SUBMIT')).toBeNull();
    expect(screen.queryByText(/NICE COMBO|FRESH DECK|LAST ·/)).toBeNull();
  });

  it("while Take the Table plays, your bar's turn label shows nothing", async () => {
    // Your hand is empty, the deck is out and Rex captured last: at mount play
    // moves on and Rex takes the table (TT1).
    const base = yourTurn(classicSettings);
    const game: GameState = { ...base, deck: [], hands: [[], [], []], board: base.board, lastAction: 'place', lastCapturer: 2, handNumber: 4 };
    saveGame('classic', { game, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
    render(<App />);
    fireEvent.click(screen.getByText('CONTINUE'));
    await advance(300);
    expect(screen.getByText('Rex took the table')).toBeTruthy();
    expect(screen.queryByText('YOUR TURN')).toBeNull();
    expect(screen.queryByText(/WAITING/)).toBeNull();
    await advance(3000);
    expect(screen.getByText('Round 1 is over')).toBeTruthy();
  });
});
