import { describe, it, expect } from 'vitest';
import { modifyWeightsForGameState } from '../evaluator';
import { createCardTracker, seedInitialDeal, recordPlacement } from '../cardTracker';
import { CALVIN_WEIGHTS } from '../personalities/calvin';
import { NINA_WEIGHTS } from '../personalities/nina';
import { REX_WEIGHTS } from '../personalities/rex';
import { addScore, createInitialState } from '../../core/gameState';
import { createPRNG } from '../../utils/prng';
import { createIdGenerator } from '../../utils/uuid';
import type { GameState, PlayerIndex } from '../../types';

function makeState(target = 300, seed = 42): GameState {
  return createInitialState(
    { targetScore: target, bot1Personality: 'beginner', bot2Personality: 'intermediate' },
    createPRNG(seed),
    createIdGenerator(createPRNG(seed + 1000)),
  );
}

const TARGETS = [100, 300, 500, 1000] as const;

// ─── Rex dynamic weights (percentage-based) ─────────

describe('Rex denial mode (50% of target)', () => {
  it.each(TARGETS)('triggers at target=%i when opponent reaches 50%%', (target) => {
    let s = makeState(target);
    s = addScore(s, 0, target * 0.50);
    const w = modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex);
    expect(w.opponentDenial).toBeCloseTo(1.8);
    expect(w.boardControl).toBeCloseTo(1.2);
    expect(w.rawPoints).toBe(REX_WEIGHTS.rawPoints);
  });

  it.each(TARGETS)('does NOT trigger at target=%i when opponent at 49%%', (target) => {
    let s = makeState(target);
    s = addScore(s, 0, Math.floor(target * 0.49));
    const w = modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex);
    expect(w).toBe(REX_WEIGHTS);
  });
});

describe('Rex conservative mode (20% lead over target)', () => {
  it.each(TARGETS)('triggers at target=%i when Rex leads by 20%%', (target) => {
    let s = makeState(target);
    const lead = target * 0.20;
    s = addScore(s, 2, lead + 10);
    s = addScore(s, 0, 10);
    const w = modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex);
    expect(w.rawPoints).toBeCloseTo(0.5);
    expect(w.placementDanger).toBeCloseTo(1.5);
    expect(w.opponentDenial).toBeCloseTo(0.45);
  });

  it.each(TARGETS)('does NOT trigger at target=%i when lead < 20%%', (target) => {
    let s = makeState(target);
    const justUnder = Math.floor(target * 0.19);
    s = addScore(s, 2, justUnder + 5);
    s = addScore(s, 0, 5);
    const w = modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex);
    expect(w).toBe(REX_WEIGHTS);
  });
});

describe('Rex mode precedence', () => {
  it('denial takes precedence over conservative', () => {
    let s = makeState(300);
    s = addScore(s, 0, 200); // opponent at 67% → denial
    s = addScore(s, 2, 350); // Rex leads by 150 → also conservative
    const w = modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex);
    expect(w.opponentDenial).toBeCloseTo(1.8);
  });

  it('normal mode when no conditions met', () => {
    const s = makeState(300);
    const w = modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex);
    expect(w).toBe(REX_WEIGHTS);
  });
});

// ─── Nina dynamic weights (percentage-based) ────────

describe('Nina aggressive mode (15% deficit of target)', () => {
  it.each(TARGETS)('triggers at target=%i when behind by 15%%', (target) => {
    let s = makeState(target);
    const deficit = target * 0.15;
    s = addScore(s, 0, deficit + 10);
    s = addScore(s, 1, 10);
    const w = modifyWeightsForGameState(NINA_WEIGHTS, 'intermediate', s, 1 as PlayerIndex);
    expect(w.rawPoints).toBeCloseTo(1.3);
    expect(w.opponentDenial).toBeCloseTo(0.5);
    expect(w.placementDanger).toBeCloseTo(0.5);
  });

  it.each(TARGETS)('does NOT trigger at target=%i when deficit < 15%%', (target) => {
    let s = makeState(target);
    const justUnder = Math.floor(target * 0.14);
    s = addScore(s, 0, justUnder + 10);
    s = addScore(s, 1, 10);
    const w = modifyWeightsForGameState(NINA_WEIGHTS, 'intermediate', s, 1 as PlayerIndex);
    expect(w).toBe(NINA_WEIGHTS);
  });
});

// ─── Calvin static ──────────────────────────────────

describe('Calvin dynamic weights', () => {
  it('returns exact same reference regardless of scoreboard', () => {
    let s = makeState(300);
    s = addScore(s, 0, 290);
    const w = modifyWeightsForGameState(CALVIN_WEIGHTS, 'beginner', s, 1 as PlayerIndex);
    expect(w).toBe(CALVIN_WEIGHTS);
  });
});

// ─── Edge cases ─────────────────────────────────────

describe('edge cases', () => {
  it('targetScore = 0 returns baseWeights unchanged', () => {
    let s = makeState(300);
    s = { ...s, settings: { ...s.settings, targetScore: 0 } };
    s = addScore(s, 0, 999);
    expect(modifyWeightsForGameState(REX_WEIGHTS, 'advanced', s, 2 as PlayerIndex)).toBe(REX_WEIGHTS);
    expect(modifyWeightsForGameState(NINA_WEIGHTS, 'intermediate', s, 1 as PlayerIndex)).toBe(NINA_WEIGHTS);
  });
});

// ─── CardTracker seeding ────────────────────────────

describe('CardTracker seedInitialDeal', () => {
  it('increases totalSeen by unseenDealtCount', () => {
    let t = createCardTracker();
    t = seedInitialDeal(t, 12);
    expect(t.totalSeen).toBe(12);
  });

  it('board + hands gives totalSeen = 16 after seeding', () => {
    let t = createCardTracker();
    const s = makeState();
    for (const card of s.board) t = recordPlacement(t, card);
    expect(t.totalSeen).toBe(4);
    t = seedInitialDeal(t, 12);
    expect(t.totalSeen).toBe(16);
  });

  it('phase moves from early to mid after seeding', () => {
    let t = createCardTracker();
    const s = makeState();
    for (const card of s.board) t = recordPlacement(t, card);
    expect(t.gamePhase).toBe('early');
    t = seedInitialDeal(t, 12);
    expect(t.gamePhase).toBe('mid');
  });

  it('deckRemaining updates after seeding', () => {
    let t = createCardTracker();
    const s = makeState();
    for (const card of s.board) t = recordPlacement(t, card);
    expect(t.deckRemaining).toBe(48);
    t = seedInitialDeal(t, 12);
    expect(t.deckRemaining).toBe(36);
  });

  it('subsequent deal stacks on totalSeen', () => {
    let t = createCardTracker();
    t = seedInitialDeal(t, 16);
    expect(t.totalSeen).toBe(16);
    t = seedInitialDeal(t, 12);
    expect(t.totalSeen).toBe(28);
    expect(t.gamePhase).toBe('late');
  });
});
