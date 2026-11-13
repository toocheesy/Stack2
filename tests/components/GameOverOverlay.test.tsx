// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// jsdom has no matchMedia, and the motion presets ask for it as their module loads.
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

import { GameOverOverlay } from '../../src/components/GameOverOverlay';
import { createInitialState } from '../../src/engine/core/gameState';
import { createPRNG } from '../../src/engine/utils/prng';
import { RANK_VALUES, type Card, type CaptureRecord, type GameState, type Rank, type Suit } from '../../src/engine/types';

// GO2, The Crown (D-007 rulings 72 and 73): the words from its board, the
// winner's best capture of the game, the podium with the winner's step in
// the winner's colour, PLAY AGAIN with the same opponents and target, HOME.

const SUITS: Record<string, Suit> = { H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' };
function card(id: string): Card {
  const rank = id.slice(0, -1) as Rank;
  return { id, rank, suit: SUITS[id.slice(-1)], value: RANK_VALUES[rank] };
}
function record(base: string, combos: string[][], points: number): CaptureRecord {
  return { points, baseCard: card(base), cards: [card(base), ...combos.flat().map(card)], combos: combos.map((c) => c.map(card)) };
}

function gameOverState(over: Partial<GameState>): GameState {
  const base = createInitialState({ targetScore: 300, bot1Personality: 'intermediate', bot2Personality: 'advanced' }, createPRNG(3));
  return { ...base, gamePhase: 'gameOver', ...over };
}

describe('the game over card (GO2)', () => {
  afterEach(cleanup);

  it('phone A: you win, with your best capture, the podium and the buttons', () => {
    const onPlayAgain = vi.fn<() => void>();
    const onHome = vi.fn<() => void>();
    const state = gameOverState({
      currentRound: 4,
      overallScores: { player: 315, bot1: 270, bot2: 245 },
      gameStats: [{ highestCapture: record('AS', [['AH']], 30) }, { highestCapture: record('KS', [['KD']], 20) }, { highestCapture: null }],
    });
    render(<GameOverOverlay winner={{ winner: 0 }} state={state} onPlayAgain={onPlayAgain} onHome={onHome} />);

    expect(screen.getByText('GAME OVER · 4 ROUNDS')).toBeTruthy();
    expect(screen.getByText('You win!')).toBeTruthy();
    expect(screen.getByText('YOUR BEST CAPTURE')).toBeTruthy();
    expect(screen.getByText('A = A')).toBeTruthy();
    expect(screen.getByText(/\+30/)).toBeTruthy();
    // The podium: 2nd, 1st, 3rd.
    expect(screen.getAllByText(/^(1ST|2ND|3RD)$/).map((e) => e.textContent)).toEqual(['2ND', '1ST', '3RD']);
    expect(screen.getAllByText(/^(You|Nina|Rex)$/).map((e) => e.textContent)).toEqual(['Nina', 'You', 'Rex']);
    expect(screen.getByText('270')).toBeTruthy();
    expect(screen.getByText('315')).toBeTruthy();
    expect(screen.getByText('245')).toBeTruthy();
    expect(screen.getByText('Target 300')).toBeTruthy();
    expect(screen.getByText('PLAY AGAIN')).toBeTruthy();
    expect(screen.getByText('Nina and Rex · to 300')).toBeTruthy();
    fireEvent.click(screen.getByText('PLAY AGAIN'));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'HOME' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("phone B: Nina wins, with Nina's best capture", () => {
    const state = gameOverState({
      currentRound: 5,
      overallScores: { player: 290, bot1: 330, bot2: 210 },
      gameStats: [{ highestCapture: record('AS', [['AH']], 30) }, { highestCapture: record('KS', [['KD']], 20) }, { highestCapture: null }],
    });
    render(<GameOverOverlay winner={{ winner: 1 }} state={state} onPlayAgain={() => {}} onHome={() => {}} />);
    expect(screen.getByText('GAME OVER · 5 ROUNDS')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Nina wins');
    expect(screen.getByText("NINA'S BEST CAPTURE")).toBeTruthy();
    expect(screen.getByText('K = K')).toBeTruthy();
    expect(screen.queryByText('YOUR BEST CAPTURE')).toBeNull();
    // The podium: You 290 second, Nina 330 first, Rex 210 third (the headline names Nina too).
    expect(screen.getAllByText(/^(You|Nina|Rex)$/).filter((e) => e.closest('h2') === null).map((e) => e.textContent)).toEqual(['You', 'Nina', 'Rex']);
  });

  it('a winner who captured nothing all game shows no best capture block', () => {
    const state = gameOverState({
      currentRound: 3,
      overallScores: { player: 100, bot1: 310, bot2: 90 },
      gameStats: [{ highestCapture: record('AS', [['AH']], 30) }, { highestCapture: null }, { highestCapture: null }],
    });
    render(<GameOverOverlay winner={{ winner: 1 }} state={state} onPlayAgain={() => {}} onHome={() => {}} />);
    expect(screen.queryByText(/BEST CAPTURE/)).toBeNull();
    expect(screen.getByText('GAME OVER · 3 ROUNDS')).toBeTruthy();
  });

  it('nothing without a winner', () => {
    const { container } = render(<GameOverOverlay winner={null} state={gameOverState({})} onPlayAgain={() => {}} onHome={() => {}} />);
    expect(container.textContent).toBe('');
  });
});
