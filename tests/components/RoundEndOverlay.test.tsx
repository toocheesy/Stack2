// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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

import { RoundEndOverlay } from '../../src/components/RoundEndOverlay';
import { RANK_VALUES, type Card, type CaptureRecord, type Rank, type RoundStats, type Suit } from '../../src/engine/types';

// RE1p, Score Sheet in Plum (D-007 rulings 70 and 71): the words from its
// board, one row per player in finishing order, the round's top scorer
// framed, "Took the Table" on the taker's row, the overtime box, and the
// countdown that deals the next round at 0 or on CONTINUE.

const SUITS: Record<string, Suit> = { H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' };
function card(id: string): Card {
  const rank = id.slice(0, -1) as Rank;
  return { id, rank, suit: SUITS[id.slice(-1)], value: RANK_VALUES[rank] };
}
function record(base: string, combos: string[][], points: number): CaptureRecord {
  return { points, baseCard: card(base), cards: [card(base), ...combos.flat().map(card)], combos: combos.map((c) => c.map(card)) };
}
function stats(points: number, best: CaptureRecord | null, took = false): RoundStats {
  return { pointsThisRound: points, highestCapture: best, tookTheTable: took };
}

// The span whose text, children joined, is exactly this.
function byFullText(text: string) {
  return screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === text && el.children.length > 0);
}

describe('the round end sheet (RE1p)', () => {
  let onContinue: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onContinue = vi.fn<() => void>();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("phone A: round 2 is over; You on top with the round's best, Took the Table; Rex without a capture", () => {
    render(
      <RoundEndOverlay
        visible
        roundNumber={2}
        roundStats={[stats(70, record('10D', [['6C', '4H']], 20), true), stats(55, record('KS', [['KH']], 20)), stats(0, null)]}
        overallScores={{ player: 145, bot1: 120, bot2: 95 }}
        targetScore={300}
        bot1Personality="intermediate"
        bot2Personality="advanced"
        onContinue={onContinue}
        isOvertime={false}
        modeWord="CLASSIC"
      />,
    );
    expect(screen.getByText('CLASSIC · TARGET 300')).toBeTruthy();
    expect(screen.getByText('Round 2 is over')).toBeTruthy();
    // Finishing order: You 145, Nina 120, Rex 95.
    expect(screen.getAllByText(/^(You|Nina|Rex)$/).map((e) => e.textContent)).toEqual(['You', 'Nina', 'Rex']);
    expect(screen.getByText('+70')).toBeTruthy();
    expect(screen.getByText('145')).toBeTruthy();
    expect(screen.getAllByText('/ 300')).toHaveLength(3);
    expect(screen.getAllByText('TOP ROUND')).toHaveLength(1);
    expect(byFullText('Best capture 10 = 6 + 4, +20')).toBeTruthy();
    expect(byFullText('Best capture K = K, +20')).toBeTruthy();
    expect(screen.getAllByText('Took the Table')).toHaveLength(1);
    expect(screen.getByText('No captures this round')).toBeTruthy();
    expect(screen.queryByText(/Tied at the top/)).toBeNull();
    expect(byFullText('Round 3 deals in 10')).toBeTruthy();
    expect(screen.getByText('10s')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeTruthy();
  });

  it('combos are joined with " and "', () => {
    render(
      <RoundEndOverlay
        visible
        roundNumber={1}
        roundStats={[stats(0, null), stats(15, record('9C', [['5D', '4S']], 15), true), stats(20, record('9S', [['5H', '4C'], ['9D']], 20))]}
        overallScores={{ player: 0, bot1: 15, bot2: 20 }}
        targetScore={300}
        bot1Personality="intermediate"
        bot2Personality="advanced"
        onContinue={onContinue}
        isOvertime={false}
        modeWord="CLASSIC"
      />,
    );
    expect(byFullText('Best capture 9 = 5 + 4 and 9, +20')).toBeTruthy();
    // Rex scored most this round: his row is the framed one.
    const framedName = screen.getByText('TOP ROUND').parentElement!.textContent;
    expect(framedName).toContain('Rex');
  });

  it('phone B: overtime, with the tie box above the rows', () => {
    render(
      <RoundEndOverlay
        visible
        roundNumber={5}
        roundStats={[stats(65, record('AS', [['AH']], 30)), stats(80, record('9C', [['5D', '4S']], 15), true), stats(40, record('QD', [['QC']], 20))]}
        overallScores={{ player: 310, bot1: 310, bot2: 240 }}
        targetScore={300}
        bot1Personality="intermediate"
        bot2Personality="advanced"
        onContinue={onContinue}
        isOvertime
        modeWord="CLASSIC"
      />,
    );
    expect(screen.getByText('Round 5 is over')).toBeTruthy();
    expect(screen.getByText('Tied at the top.')).toBeTruthy();
    expect(screen.getByText('One more round.')).toBeTruthy();
    expect(screen.getByText('You and Nina both have 310. Round 6 is next.')).toBeTruthy();
    expect(screen.getAllByText(/^(You|Nina|Rex)$/).map((e) => e.textContent)).toEqual(['You', 'Nina', 'Rex']);
    expect(screen.getByText('TOP ROUND').parentElement!.textContent).toContain('Nina');
    expect(byFullText('Round 6 deals in 10')).toBeTruthy();
  });

  it('CONTINUE deals the next round; so does the countdown at 0', () => {
    const props = {
      roundNumber: 2,
      roundStats: [stats(0, null), stats(0, null), stats(0, null)] as [RoundStats, RoundStats, RoundStats],
      overallScores: { player: 0, bot1: 0, bot2: 0 },
      targetScore: 300,
      bot1Personality: 'intermediate' as const,
      bot2Personality: 'advanced' as const,
      isOvertime: false,
      modeWord: 'CLASSIC',
    };
    const { unmount } = render(<RoundEndOverlay visible onContinue={onContinue} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    unmount();

    const again = vi.fn<() => void>();
    render(<RoundEndOverlay visible onContinue={again} {...props} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(byFullText('Round 3 deals in 7')).toBeTruthy();
    expect(again).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(7000); });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('not visible: nothing is in the page', () => {
    render(
      <RoundEndOverlay visible={false} roundNumber={2} roundStats={[stats(0, null), stats(0, null), stats(0, null)]} overallScores={{ player: 0, bot1: 0, bot2: 0 }}
        targetScore={300} bot1Personality="intermediate" bot2Personality="advanced" onContinue={onContinue} isOvertime={false} modeWord="CLASSIC" />,
    );
    expect(screen.queryByText(/is over/)).toBeNull();
  });
});
