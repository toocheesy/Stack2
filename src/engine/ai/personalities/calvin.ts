import type { PersonalityWeights } from '../evaluator';

export const CALVIN_WEIGHTS: PersonalityWeights = {
  rawPoints: 1.0,
  chainPotential: 0.0,
  placementDanger: 0.1,
  opponentDenial: 0.0,
  jackpotValue: 0.0,
  boardControl: 0.0,
  mistakeRate: 0.25,
};

export interface PersonalityProfile {
  name: string;
  weights: PersonalityWeights;
  // Only surviving flag — Nina's sum-preference stylistic identity per spec 7.3.
  preferSumsOnTie: boolean;
  // ─── Canonical skill points (1-10 scale)
  riskThreshold: number;
  deckAwareness: number;
  opponentAwareness: number;
  positionAwareness: number;
  pressureHandling: number;
  setupEngineering: number;
  captureComplexity: number;       // gates multi-slot (≥3) + chain eval (≥6)
  placementIntelligence: number;   // drives valueLossPenalty PI sub-rules
  thinkingDelay: { min: number; max: number };
}

export const CALVIN: PersonalityProfile = {
  name: 'Calvin',
  weights: CALVIN_WEIGHTS,
  preferSumsOnTie: false,
  riskThreshold: 1,            // PASS 3A — floor (greedy)
  deckAwareness: 1,            // PASS 3A — doesn't track
  opponentAwareness: 1,        // PASS 3A — undifferentiated opponents
  positionAwareness: 2,        // PASS 3A — basic active-count only
  pressureHandling: 1,         // PASS 3A — no pressure response
  setupEngineering: 1,         // PASS 3A — no setup planning
  captureComplexity: 1,        // PASS 3A — single captures only
  placementIntelligence: 2,    // PASS 3A — Calvin's tell (highest 2-9 selection)
  thinkingDelay: { min: 1500, max: 3000 },
};
