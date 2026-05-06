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
  allowMultiSlot: boolean;
  useChainEval: boolean;
  preferSumsOnTie: boolean;
  preferHighestNumberCardOnPlace: boolean;
  riskThreshold: number;
  deckAwareness: number;
  thinkingDelay: { min: number; max: number };
}

export const CALVIN: PersonalityProfile = {
  name: 'Calvin',
  weights: CALVIN_WEIGHTS,
  allowMultiSlot: false,
  useChainEval: false,
  preferSumsOnTie: false,
  preferHighestNumberCardOnPlace: true,
  riskThreshold: 0.02,
  deckAwareness: 2,
  thinkingDelay: { min: 1500, max: 3000 },
};
