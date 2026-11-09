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
import { getLevel } from '../../src/engine/adventure/levelConfig';
import { setTutorialSeen } from '../../src/tutorial/tutorialStorage';
import type { GameSettings, GameState } from '../../src/engine/types';

// The game board, GB2 (D-007 release 2, part 1), through the whole app: the
// top bar's mode line, the seats, the message line, the table's deck count,
// your bar and the tray's absence until you build. The Run's two tests
// reached its board from the old home's Run card; release 3 took that way in
// off the home screen (ruling 32), so they are skipped until S-032 deletes
// The Run and them.

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

function runSettings(levelId: number): GameSettings {
  const level = getLevel(levelId)!;
  return {
    targetScore: level.targetScore,
    bot1Personality: level.bots[0],
    bot2Personality: level.bots[1],
    hintStripEnabled: level.hintStripEnabled,
    disableSeatingSwap: !level.turnOrderSwap,
  };
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
    saveGame('classic', { game: yourTurn(classicSettings), currentLevelId: null, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
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
    saveGame('classic', { game, currentLevelId: null, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
    render(<App />);
    fireEvent.click(screen.getByText('CONTINUE'));
    await advance(300);
    expect(screen.getByText('Rex took the table')).toBeTruthy();
    expect(screen.queryByText('YOUR TURN')).toBeNull();
    expect(screen.queryByText(/WAITING/)).toBeNull();
    await advance(3000);
    expect(screen.getByText('Round 1 is over')).toBeTruthy();
  });

  it.skip('The Run: a level starts on the board, with its mode line and its hint strip on the message line', () => {
    setTutorialSeen(true);
    const level = 1;
    saveGame('run', { game: yourTurn(runSettings(level)), currentLevelId: level, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
    render(<App />);
    fireEvent.click(screen.getByText('The Run'));
    fireEvent.click(screen.getByText(/^Resume 1-1/));

    expect(screen.getAllByText('THE RUN · 1-1 · R1 · H1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Drag a card to start your turn')).toBeTruthy();
    expect(screen.getByText('Calvin · 1')).toBeTruthy();
    expect(screen.getByText('Calvin · 2')).toBeTruthy();
  });

  it.skip('The Run: a level ends with its level-complete overlay', async () => {
    const level = 3;
    const base = createInitialState(runSettings(level), createPRNG(SEED));
    // Bot 1 holds the last card, the deck is out, and bot 1 is at the target: its move ends the level.
    const game: GameState = {
      ...base,
      deck: [],
      hands: [[], [base.hands[1][0]], []],
      currentPlayer: 1,
      overallScores: { player: 0, bot1: base.settings.targetScore, bot2: 0 },
    };
    saveGame('run', { game, currentLevelId: level, seed: SEED, dealStream: SEED, botStream: botStreamSeed(SEED) });
    render(<App />);
    fireEvent.click(screen.getByText('The Run'));
    fireEvent.click(screen.getByText(/^Resume 1-3/));
    await advance(10_000);

    expect(screen.getByText('TRY AGAIN')).toBeTruthy();
  });
});
