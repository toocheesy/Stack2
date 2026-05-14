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
  allowMultiSlot: true,
  useChainEval: true,
  preferSumsOnTie: false,
  preferHighestNumberCardOnPlace: false,
  riskThreshold: 0.10,
  deckAwareness: 8,
  opponentAwareness: 8,
  positionAwareness: 9,
  pressureHandling: 9,
  setupEngineering: 8,
  thinkingDelay: { min: 300, max: 700 },
};
