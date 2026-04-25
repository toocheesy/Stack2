import type {
  Card,
  Difficulty,
  MultiSlotCaptureSlot,
  PlayerIndex,
  GameState,
} from '../types';
import type { PRNG } from '../utils/prng';
import type { CardTrackerState } from './cardTracker';
import {
  evaluateAllActions,
  evaluateChainCapture,
  calvinPlacementPick,
  modifyWeightsForGameState,
} from './evaluator';
import type {
  ActionScore,
  ChainPlan,
  ScoredAction,
  PersonalityWeights,
} from './evaluator';
import {
  CALVIN,
  CALVIN_WEIGHTS,
  NINA,
  NINA_WEIGHTS,
  REX,
  REX_WEIGHTS,
  type PersonalityProfile,
} from './personalities';

export interface BotCaptureDetails {
  slots: MultiSlotCaptureSlot[];
  capturedCards: Card[];
  totalPoints: number;
}

export interface BotDecision {
  action: 'capture' | 'place';
  handCard: Card;
  captureDetails?: BotCaptureDetails;
  reasoning: string;
  score: ActionScore;
}

export function getPersonalityWeights(
  difficulty: Difficulty,
): PersonalityWeights {
  switch (difficulty) {
    case 'beginner':
      return CALVIN_WEIGHTS;
    case 'intermediate':
      return NINA_WEIGHTS;
    case 'advanced':
      return REX_WEIGHTS;
  }
}

export function getPersonalityProfile(difficulty: Difficulty): PersonalityProfile {
  switch (difficulty) {
    case 'beginner':
      return CALVIN;
    case 'intermediate':
      return NINA;
    case 'advanced':
      return REX;
  }
}

export function getBotThinkingDelay(
  difficulty: Difficulty,
  prng: PRNG,
): number {
  const profile = getPersonalityProfile(difficulty);
  return prng.nextInt(profile.thinkingDelay.min, profile.thinkingDelay.max);
}

function applyNinaSumPreference(actions: ScoredAction[]): ScoredAction[] {
  const sorted = actions.slice();
  sorted.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    const aIsSum = a.captureDetails?.slots.some((s) => s.type === 'sum') ?? false;
    const bIsSum = b.captureDetails?.slots.some((s) => s.type === 'sum') ?? false;
    if (aIsSum !== bIsSum) return aIsSum ? -1 : 1;
    return 0;
  });
  return sorted;
}

function chainPlanAsAction(
  plan: ChainPlan,
  candidates: ScoredAction[],
): ScoredAction | null {
  for (const action of candidates) {
    if (action.action !== 'capture') continue;
    if (action.handCard.id !== plan.firstCapture.handCard.id) continue;
    const ids = new Set(action.captureDetails?.capturedCards.map((c) => c.id));
    const planIds = new Set(plan.firstCapture.capturedCards.map((c) => c.id));
    planIds.add(plan.firstCapture.handCard.id);
    let matches = ids.size === planIds.size;
    if (matches) {
      for (const id of planIds) {
        if (!ids.has(id)) {
          matches = false;
          break;
        }
      }
    }
    if (matches) return action;
  }
  return null;
}

function toBotDecision(action: ScoredAction): BotDecision {
  if (action.action === 'capture' && action.captureDetails) {
    return {
      action: 'capture',
      handCard: action.handCard,
      captureDetails: {
        slots: action.captureDetails.slots,
        capturedCards: action.captureDetails.capturedCards,
        totalPoints: action.captureDetails.totalPoints,
      },
      reasoning: action.reasoning,
      score: action.score,
    };
  }
  return {
    action: 'place',
    handCard: action.handCard,
    reasoning: action.reasoning,
    score: action.score,
  };
}

export interface DecideBotOptions {
  restrictions?: readonly ('pairsOnly' | 'noSum2' | 'noSum3')[];
}

export function decideBotAction(
  state: GameState,
  playerIndex: PlayerIndex,
  difficulty: Difficulty,
  tracker: CardTrackerState,
  prng: PRNG,
  options: DecideBotOptions = {},
): BotDecision {
  const profile = getPersonalityProfile(difficulty);
  const weights = modifyWeightsForGameState(profile.weights, difficulty, state, playerIndex);
  let actions = evaluateAllActions(state, playerIndex, tracker, weights, {
    allowMultiSlot: profile.allowMultiSlot,
    restrictions: options.restrictions,
  });

  if (actions.length === 0) {
    throw new Error('decideBotAction: no actions available (empty hand?)');
  }

  if (profile.preferSumsOnTie) {
    actions = applyNinaSumPreference(actions);
  }

  if (profile.useChainEval) {
    const plan = evaluateChainCapture(
      state,
      playerIndex,
      state.hands[playerIndex],
      state.board,
    );
    if (plan) {
      const bestCaptureTotal = actions
        .filter((a) => a.action === 'capture')
        .reduce((m, a) => Math.max(m, a.captureDetails?.totalPoints ?? 0), 0);
      if (plan.totalPoints > bestCaptureTotal * 1.2) {
        const chainAction = chainPlanAsAction(plan, actions);
        if (chainAction) {
          const idx = actions.indexOf(chainAction);
          if (idx > 0) {
            actions = [chainAction, ...actions.filter((_, i) => i !== idx)];
          }
        }
      }
    }
  }

  const top = actions[0];
  const mistakeRoll = prng.next();
  let chosen = top;

  if (mistakeRoll < profile.weights.mistakeRate && actions.length > 1) {
    const half = Math.max(1, Math.floor(actions.length / 2));
    const pool = actions.slice(0, half);
    const pick = prng.nextInt(0, pool.length - 1);
    chosen = pool[pick];
  }

  if (
    profile.preferHighestValueOnPlace &&
    chosen.action === 'place'
  ) {
    const highest = calvinPlacementPick(state.hands[playerIndex]);
    if (highest.id !== chosen.handCard.id) {
      const swap = actions.find(
        (a) => a.action === 'place' && a.handCard.id === highest.id,
      );
      if (swap) chosen = swap;
    }
  }

  return toBotDecision(chosen);
}
