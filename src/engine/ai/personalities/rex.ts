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
  allowMultiSlot: true,
  useChainEval: true,
  preferSumsOnTie: false,
  preferHighestNumberCardOnPlace: false,
  riskThreshold: 0.08,
  deckAwareness: 7,
  opponentAwareness: 7,
  positionAwareness: 8,
  pressureHandling: 9,
  setupEngineering: 7,
  thinkingDelay: { min: 400, max: 900 },
};
