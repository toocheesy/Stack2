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
  allowMultiSlot: true,
  useChainEval: false,
  preferSumsOnTie: true,
  preferHighestValueOnPlace: false,
  thinkingDelay: { min: 800, max: 1500 },
};
