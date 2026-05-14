import type { PersonalityWeights } from '../evaluator';
import type { PersonalityProfile } from './calvin';

export const JETT_WEIGHTS: PersonalityWeights = {
  rawPoints: 0.7,
  chainPotential: 1.0,
  placementDanger: 1.2,
  opponentDenial: 1.0,
  jackpotValue: 1.0,
  boardControl: 1.0,
  mistakeRate: 0.005,
};

export const JETT: PersonalityProfile = {
  name: 'Jett',
  weights: JETT_WEIGHTS,
  preferSumsOnTie: false,
  riskThreshold: 7,            // PASS 3A — very selective
  deckAwareness: 8,            // PASS 3A — HIGHEST (tracks everything)
  opponentAwareness: 8,        // PASS 3A — HIGHEST (deep opponent reading)
  positionAwareness: 8,        // PASS 3A — all strategic loop layers
  pressureHandling: 6,         // PASS 3A — slightly LOWER (stalker, not reactive expert)
  setupEngineering: 8,         // PASS 3A — all three setup features incl. Jackpot Trap (Jett-only)
  captureComplexity: 8,        // PASS 3A — strong capture vision + chain eval
  placementIntelligence: 9,    // PASS 3A — HIGHEST (PI 9 unlocks multi-turn, stubbed)
  thinkingDelay: { min: 300, max: 700 },
};
