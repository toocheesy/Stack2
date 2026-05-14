import type { PersonalityWeights } from '../evaluator';
import type { PersonalityProfile } from './calvin';

export const NINA_WEIGHTS: PersonalityWeights = {
  rawPoints: 1.0,
  chainPotential: 0.5,
  placementDanger: 0.7,
  opponentDenial: 0.3,
  jackpotValue: 0.4,
  boardControl: 0.3,
  mistakeRate: 0.08,
};

export const NINA: PersonalityProfile = {
  name: 'Nina',
  weights: NINA_WEIGHTS,
  preferSumsOnTie: true,        // only surviving flag — Nina's flavor
  riskThreshold: 3,            // PASS 3A — takes most captures
  deckAwareness: 4,            // PASS 3A — tracks cards okay
  opponentAwareness: 3,        // PASS 3A — notices opponents, shallow modeling
  positionAwareness: 4,        // PASS 3A — mid layers of strategic loop
  pressureHandling: 4,         // PASS 3A — some pressure response
  setupEngineering: 3,         // PASS 3A — Place-To-Plant only (plays what she sees)
  captureComplexity: 5,        // PASS 3A — multi-slot YES, chain eval NO (her CC > SE asymmetry)
  placementIntelligence: 4,    // PASS 3A — lowest-danger 2-9 selection
  thinkingDelay: { min: 800, max: 1500 },
};
