import type {
  Card,
  Difficulty,
  MultiSlotCaptureSlot,
  PlayerIndex,
  GameState,
} from '../types';
import { SCORE_KEYS } from '../types';
import type { PRNG } from '../utils/prng';
import type { CardTrackerState } from './cardTracker';
import {
  evaluateAllActions,
  evaluateChainCapture,
  evaluatePlaceChain,
  calvinNumberCardPick,
  getSelectiveDeckAwareness,
  getPositionContext,
  applyPositionModifiers,
  applyPressureExpansion,
  modifyWeightsForGameState,
} from './evaluator';
import type {
  ActionScore,
  SelectiveDeckInfo,
  OpponentInfo,
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
  JETT,
  JETT_WEIGHTS,
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
    case 'expert':
      return JETT_WEIGHTS;
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
    case 'expert':
      return JETT;
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

function opponentInfoFor(state: GameState, idx: PlayerIndex): OpponentInfo {
  const score = state.overallScores[SCORE_KEYS[idx]];
  if (idx === 0) {
    return {
      playerIndex: idx,
      score,
      difficulty: null,
      preferHighestNumberCardOnPlace: false,
      mistakeRate: 0,
      allowMultiSlot: true,
    };
  }
  const diff =
    idx === 1 ? state.settings.bot1Personality : state.settings.bot2Personality;
  const prof = getPersonalityProfile(diff);
  return {
    playerIndex: idx,
    score,
    difficulty: diff,
    preferHighestNumberCardOnPlace: prof.preferHighestNumberCardOnPlace,
    mistakeRate: prof.weights.mistakeRate,
    allowMultiSlot: prof.allowMultiSlot,
  };
}

function buildOpponentInfo(
  state: GameState,
  playerIndex: PlayerIndex,
): OpponentInfo[] {
  const opponents: OpponentInfo[] = [];
  for (const idx of [0, 1, 2] as PlayerIndex[]) {
    if (idx === playerIndex) continue;
    opponents.push(opponentInfoFor(state, idx));
  }
  return opponents;
}

function findNextActiveOpponent(
  state: GameState,
  playerIndex: PlayerIndex,
): PlayerIndex | null {
  for (let i = 1; i <= 2; i++) {
    const next = ((playerIndex + i) % 3) as PlayerIndex;
    if (state.hands[next].length > 0) return next;
  }
  return null;
}

// Awareness-level scaling functions (doctrine 7.3: tier = depth, not breadth)

function layer3Reliability(pa: number): number {
  if (pa <= 8) return 0.70;
  if (pa <= 9) return 0.90;
  return 0.95;
}

function deckAttentionChance(da: number): number {
  if (da <= 1) return 0.15;
  if (da <= 2) return 0.30;
  if (da <= 3) return 0.50;
  if (da <= 4) return 0.65;
  if (da <= 5) return 0.80;
  if (da <= 6) return 0.90;
  if (da <= 7) return 0.95;
  if (da <= 8) return 0.97;
  if (da <= 9) return 0.99;
  return 1.0;
}

function setupChainThreshold(se: number): number {
  if (se <= 5) return 1.35;
  if (se <= 7) return 1.30;
  if (se <= 8) return 1.25;
  if (se <= 9) return 1.20;
  return 1.15;
}

// Capture-chain promotion threshold — gates whether a 2-turn capture plan
// (capture A now → capture B next turn) overrides the best single-turn
// capture. Sibling to setupChainThreshold(se) which gates place-chains;
// both derive from the same SE curve so each bot's two chain types
// behave consistently. Generalized from a hardcoded 1.2x per
// docs/post-foundation-calibration-diagnosis-2026-05-06.md.
// Exported for test surface; sibling private functions are exercised
// indirectly via decideBotAction.
export function captureChainThreshold(se: number): number {
  if (se <= 5) return 1.40;
  if (se <= 7) return 1.30;
  if (se <= 8) return 1.20;
  return 1.15;
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
  let weights = modifyWeightsForGameState(profile.weights, difficulty, state, playerIndex);

  // Position awareness: 5-layer strategic loop (doctrine 5.1)
  if (profile.positionAwareness >= 2) {
    const posContext = getPositionContext(state, playerIndex);
    // Layer 3: recent action context — reliability scales with PA level
    if (profile.positionAwareness >= 7 && prng.next() < layer3Reliability(profile.positionAwareness)) {
      if (posContext.previousAction === 'capture') {
        weights = { ...weights, placementDanger: weights.placementDanger * 1.3, boardControl: weights.boardControl * 1.2 };
      }
    }
    weights = applyPositionModifiers(weights, profile.positionAwareness, posContext, state, playerIndex);
  }

  // Pressure handling expansion: hand-of-round, jackpot proximity, target aggression
  weights = applyPressureExpansion(weights, profile.pressureHandling, state, playerIndex);

  // Selective deck awareness: attention roll based on deckAwareness level
  let selectiveDeck: SelectiveDeckInfo | null = null;
  if (profile.deckAwareness > 0) {
    if (prng.next() < deckAttentionChance(profile.deckAwareness)) {
      selectiveDeck = getSelectiveDeckAwareness(tracker);
    }
  }

  // Opponent awareness plumbing: expose opponent profiles for OA >= 4
  let opponents: OpponentInfo[] | undefined;
  let nextOpponent: OpponentInfo | null = null;
  if (profile.opponentAwareness >= 4) {
    opponents = buildOpponentInfo(state, playerIndex);
    const nextIdx = findNextActiveOpponent(state, playerIndex);
    if (nextIdx !== null) {
      nextOpponent = opponents.find((o) => o.playerIndex === nextIdx) ?? null;
    }
  }

  let actions = evaluateAllActions(state, playerIndex, tracker, weights, {
    allowMultiSlot: profile.allowMultiSlot,
    restrictions: options.restrictions,
    selectiveDeck,
    opponents,
    nextOpponent,
    opponentAwareness: profile.opponentAwareness,
    setupEngineering: profile.setupEngineering,
  });

  if (actions.length === 0) {
    throw new Error('decideBotAction: no actions available (empty hand?)');
  }

  // Doctrine 2.7 — Forced-Placement Dump: captures locked out for the
  // last player holding cards. Filter to placements only and skip the
  // capture-specific ranking layers below.
  if (state.dumpActive) {
    const placeActions = actions.filter((a) => a.action === 'place');
    if (placeActions.length > 0) {
      let chosen = placeActions[0];
      if (profile.preferHighestNumberCardOnPlace) {
        const highest = calvinNumberCardPick(state.hands[playerIndex]);
        if (highest) {
          const swap = placeActions.find((a) => a.handCard.id === highest.id);
          if (swap) chosen = swap;
        }
      }
      return toBotDecision(chosen);
    }
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
      if (plan.totalPoints > bestCaptureTotal * captureChainThreshold(profile.setupEngineering)) {
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

  // Setup Engineering: place-then-capture chain evaluation (SE >= 5)
  if (profile.setupEngineering >= 5) {
    const placeChain = evaluatePlaceChain(state.hands[playerIndex], state.board);
    if (placeChain) {
      const bestCaptureTotal = actions
        .filter((a) => a.action === 'capture')
        .reduce((m, a) => Math.max(m, a.captureDetails?.totalPoints ?? 0), 0);
      const survivalDiscount = 0.6;
      const chainExpected = placeChain.totalExpectedPoints * survivalDiscount;
      if (chainExpected > bestCaptureTotal * setupChainThreshold(profile.setupEngineering) || bestCaptureTotal === 0) {
        const placeAction = actions.find(
          (a) => a.action === 'place' && a.handCard.id === placeChain.placedCard.id,
        );
        if (placeAction) {
          actions = [placeAction, ...actions.filter((a) => a !== placeAction)];
        }
      }
    }
  }

  // Risk threshold gate: demote sub-threshold captures below best placement
  const targetScore = state.settings.targetScore;
  if (profile.riskThreshold > 0 && targetScore > 0) {
    const threshold = targetScore * profile.riskThreshold;
    const topAction = actions[0];
    if (
      topAction.action === 'capture' &&
      topAction.captureDetails &&
      topAction.captureDetails.totalPoints < threshold
    ) {
      const bestPlace = actions.find((a) => a.action === 'place');
      if (bestPlace && bestPlace.score.placementDanger > -threshold) {
        actions = [bestPlace, ...actions.filter((a) => a !== bestPlace)];
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
    profile.preferHighestNumberCardOnPlace &&
    chosen.action === 'place'
  ) {
    const highest = calvinNumberCardPick(state.hands[playerIndex]);
    if (highest && highest.id !== chosen.handCard.id) {
      const swap = actions.find(
        (a) => a.action === 'place' && a.handCard.id === highest.id,
      );
      if (swap) chosen = swap;
    }
  }

  return toBotDecision(chosen);
}
