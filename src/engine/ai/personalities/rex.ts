import type { PersonalityWeights } from '../evaluator';
import type { PersonalityProfile } from './calvin';

export const REX_WEIGHTS: PersonalityWeights = {
  rawPoints: 0.8,
  chainPotential: 1.0,
  placementDanger: 1.0,
  opponentDenial: 0.9,
  jackpotValue: 1.0,
  boardControl: 0.8,
  mistakeRate: 0.02,
};

export const REX: PersonalityProfile = {
  name: 'Rex',
  weights: REX_WEIGHTS,
  preferSumsOnTie: false,
  riskThreshold: 5,            // PASS 3A — selective on captures
  deckAwareness: 6,            // PASS 3A — tracks well
  opponentAwareness: 6,        // PASS 3A — models opponents
  positionAwareness: 7,        // PASS 3A — HIGHER (positional hunter)
  pressureHandling: 7,         // PASS 3A — HIGHER (reactive to score state)
  setupEngineering: 6,         // PASS 3A — Place-To-Plant + Multi-Turn (no Jackpot Trap; SE=6 < 7 gate)
  captureComplexity: 6,        // PASS 3A — multi-slot + chain eval
  placementIntelligence: 5,    // PASS 3A — placement isn't his focus (slightly LOWER)
  thinkingDelay: { min: 400, max: 900 },
};
