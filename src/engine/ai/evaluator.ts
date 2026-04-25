import type {
  Card,
  ComboSlot,
  Difficulty,
  GameState,
  MultiSlotCaptureSlot,
  PlayerIndex,
  Rank,
} from '../types';
import { RANKS, RANK_VALUES, SCORE_KEYS, SCORE_VALUES } from '../types';
import {
  findAllCaptures,
  findBestMultiSlotCapture,
} from '../core/captureValidator';
import { calculateCardPoints, calculateCardsPoints } from '../core/scoring';
import type { CardTrackerState } from './cardTracker';
import { estimateDeckComposition, getRemainingOfRank } from './cardTracker';

export interface PersonalityWeights {
  rawPoints: number;
  chainPotential: number;
  placementDanger: number;
  opponentDenial: number;
  jackpotValue: number;
  boardControl: number;
  mistakeRate: number;
}

export interface ActionScore {
  rawPoints: number;
  chainPotential: number;
  placementDanger: number;
  opponentDenial: number;
  jackpotValue: number;
  boardControl: number;
  total: number;
}

export interface ScoredCaptureDetails {
  slots: MultiSlotCaptureSlot[];
  capturedCards: Card[];
  totalPoints: number;
  kind: 'single' | 'multi';
}

export interface ScoredAction {
  action: 'capture' | 'place';
  handCard: Card;
  captureDetails?: ScoredCaptureDetails;
  score: ActionScore;
  reasoning: string;
}

export interface ChainStep {
  handCard: Card;
  capturedCards: Card[];
  slots: MultiSlotCaptureSlot[];
  points: number;
}

export interface ChainPlan {
  firstCapture: ChainStep;
  secondCapture: ChainStep;
  totalPoints: number;
}

const FACE_SET = new Set<Rank>(['J', 'Q', 'K']);

function isFace(rank: Rank): boolean {
  return FACE_SET.has(rank);
}

function rankValueForSum(rank: Rank): number | null {
  if (isFace(rank)) return null;
  return RANK_VALUES[rank];
}

function removeCardsById(cards: readonly Card[], ids: Set<string>): Card[] {
  return cards.filter((c) => !ids.has(c.id));
}

function applyWeights(
  score: Omit<ActionScore, 'total'>,
  w: PersonalityWeights,
): number {
  return (
    score.rawPoints * w.rawPoints +
    score.chainPotential * w.chainPotential +
    score.placementDanger * w.placementDanger +
    score.opponentDenial * w.opponentDenial +
    score.jackpotValue * w.jackpotValue +
    score.boardControl * w.boardControl
  );
}

function boardCanSumTo(board: readonly Card[], needed: number): boolean {
  if (needed <= 0) return false;
  for (let i = 0; i < board.length; i++) {
    if (isFace(board[i].rank)) continue;
    if (board[i].value === needed) return true;
    for (let j = i + 1; j < board.length; j++) {
      if (isFace(board[j].rank)) continue;
      if (board[i].value + board[j].value === needed) return true;
    }
  }
  return false;
}

export function scoreCapture(
  state: GameState,
  handCard: Card,
  capturedCards: readonly Card[],
  playerIndex: PlayerIndex,
  tracker: CardTrackerState,
): Omit<ActionScore, 'total'> {
  const capturedIds = new Set(capturedCards.map((c) => c.id));
  const boardCaptured = capturedCards.filter((c) => c.id !== handCard.id);

  const rawPoints = calculateCardsPoints(capturedCards);

  const remainingBoard = removeCardsById(state.board, capturedIds);
  const remainingHand = state.hands[playerIndex].filter(
    (c) => c.id !== handCard.id,
  );
  let canChain = false;
  for (const h of remainingHand) {
    if (findAllCaptures(h, remainingBoard).length > 0) {
      canChain = true;
      break;
    }
  }
  const chainPotential = canChain ? 20 : 0;

  const estimated = estimateDeckComposition(tracker);
  let deniedCount = 0;
  for (const b of boardCaptured) {
    const opponentCouldPair = estimated[b.rank] > 0;
    if (opponentCouldPair) deniedCount += 1;
    const v = rankValueForSum(b.rank);
    if (v !== null) {
      const partnersOnBoard = state.board.filter(
        (x) => x.id !== b.id && !isFace(x.rank) && x.value + v <= 10,
      ).length;
      if (partnersOnBoard > 0) deniedCount += 0.5;
    }
  }
  const opponentDenial = deniedCount * 15;

  let jackpotValue = 0;
  const inLateGame =
    tracker.gamePhase === 'late' || tracker.gamePhase === 'endgame';
  if (inLateGame && state.lastCapturer !== playerIndex) {
    jackpotValue += 25;
  }
  if (remainingBoard.length === 0 && state.board.length > 0) {
    jackpotValue += 30;
  }

  let boardControl = 0;
  for (const b of boardCaptured) {
    const otherBoard = state.board.filter((x) => x.id !== b.id);
    let partners = 0;
    for (const other of otherBoard) {
      if (other.rank === b.rank) partners++;
      const bv = rankValueForSum(b.rank);
      const ov = rankValueForSum(other.rank);
      if (bv !== null && ov !== null && bv + ov <= 10) partners++;
    }
    if (partners >= 2) boardControl += 5;
  }

  return {
    rawPoints,
    chainPotential,
    placementDanger: 0,
    opponentDenial,
    jackpotValue,
    boardControl,
  };
}

export function scorePlacement(
  state: GameState,
  handCard: Card,
  playerIndex: PlayerIndex,
  tracker: CardTrackerState,
): Omit<ActionScore, 'total'> {
  const placedIsFace = isFace(handCard.rank);
  const placedValue = handCard.value;

  let danger = 0;

  for (const rank of RANKS) {
    const remaining = getRemainingOfRank(tracker, rank);
    if (remaining === 0) continue;

    if (rank === handCard.rank) {
      danger += SCORE_VALUES[rank];
      continue;
    }

    if (placedIsFace) continue;
    if (isFace(rank)) continue;

    const opponentValue = rank === 'A' ? 1 : RANK_VALUES[rank];
    if (opponentValue <= placedValue) continue;
    const needed = opponentValue - placedValue;

    if (needed === 0) {
      danger += SCORE_VALUES[rank];
      continue;
    }

    if (boardCanSumTo(state.board, needed)) {
      danger += SCORE_VALUES[rank];
    }
  }

  let jackpotValue = 0;
  if (tracker.gamePhase === 'endgame' && state.lastCapturer !== playerIndex) {
    jackpotValue = -10;
  }

  return {
    rawPoints: 0,
    chainPotential: 0,
    placementDanger: -danger,
    opponentDenial: 0,
    jackpotValue,
    boardControl: 0,
  };
}

function bestSingleCapture(
  handCard: Card,
  board: readonly Card[],
): { boardCards: Card[]; points: number; slots: MultiSlotCaptureSlot[] } | null {
  const options = findAllCaptures(handCard, board);
  let best: {
    boardCards: Card[];
    points: number;
    slots: MultiSlotCaptureSlot[];
  } | null = null;
  for (const o of options) {
    if (!best || o.points > best.points) {
      best = {
        boardCards: o.boardCards,
        points: o.points,
        slots: [{ slot: 'combo1', cards: o.boardCards, type: o.type }],
      };
    }
  }
  const multi = findBestMultiSlotCapture(handCard, board);
  if (multi && (!best || multi.totalPoints > best.points)) {
    const boardCards = multi.slots.flatMap((s) => s.cards);
    best = { boardCards, points: multi.totalPoints, slots: multi.slots };
  }
  return best;
}

export function evaluateChainCapture(
  state: GameState,
  playerIndex: PlayerIndex,
  handCards: readonly Card[],
  board: readonly Card[],
): ChainPlan | null {
  let best: ChainPlan | null = null;

  for (const a of handCards) {
    const cap1 = bestSingleCapture(a, board);
    if (!cap1) continue;

    const capturedIds = new Set(cap1.boardCards.map((c) => c.id));
    const newBoard = removeCardsById(board, capturedIds);
    const newHand = handCards.filter((h) => h.id !== a.id);

    for (const b of newHand) {
      const cap2 = bestSingleCapture(b, newBoard);
      if (!cap2) continue;
      const totalPoints = cap1.points + cap2.points;
      if (!best || totalPoints > best.totalPoints) {
        best = {
          firstCapture: {
            handCard: a,
            capturedCards: cap1.boardCards,
            slots: cap1.slots,
            points: cap1.points,
          },
          secondCapture: {
            handCard: b,
            capturedCards: cap2.boardCards,
            slots: cap2.slots,
            points: cap2.points,
          },
          totalPoints,
        };
      }
    }
  }

  // Unused in this function but retained for playerIndex referential consistency
  void state;
  void playerIndex;
  return best;
}

export type ComboRestrictionKey = 'pairsOnly' | 'noSum2' | 'noSum3';

export interface EvaluateOptions {
  allowMultiSlot?: boolean;
  restrictions?: readonly ComboRestrictionKey[];
}

function captureViolatesRestrictions(
  type: 'pair' | 'sum',
  boardCardCount: number,
  restrictions: readonly ComboRestrictionKey[] | undefined,
): boolean {
  if (!restrictions || restrictions.length === 0) return false;
  if (restrictions.includes('pairsOnly') && type === 'sum') return true;
  if (restrictions.includes('noSum2') && type === 'sum' && boardCardCount === 2)
    return true;
  if (restrictions.includes('noSum3') && type === 'sum' && boardCardCount === 3)
    return true;
  return false;
}

export function evaluateAllActions(
  state: GameState,
  playerIndex: PlayerIndex,
  tracker: CardTrackerState,
  weights: PersonalityWeights,
  options: EvaluateOptions = {},
): ScoredAction[] {
  const actions: ScoredAction[] = [];
  const hand = state.hands[playerIndex];
  const allowMultiSlot = options.allowMultiSlot !== false;

  for (const handCard of hand) {
    const singles = findAllCaptures(handCard, state.board);
    for (const s of singles) {
      if (captureViolatesRestrictions(s.type, s.boardCards.length, options.restrictions))
        continue;
      const capturedCards = [handCard, ...s.boardCards];
      const base = scoreCapture(state, handCard, capturedCards, playerIndex, tracker);
      const total = applyWeights(base, weights);
      actions.push({
        action: 'capture',
        handCard,
        captureDetails: {
          slots: [{ slot: 'combo1' as Exclude<ComboSlot, 'base'>, cards: s.boardCards, type: s.type }],
          capturedCards,
          totalPoints: s.points,
          kind: 'single',
        },
        score: { ...base, total },
        reasoning: `${s.type} capture with ${handCard.rank} for ${s.points}pts`,
      });
    }

    if (allowMultiSlot) {
      const multi = findBestMultiSlotCapture(handCard, state.board);
      const multiViolates = multi?.slots.some((slot) =>
        captureViolatesRestrictions(slot.type, slot.cards.length, options.restrictions),
      );
      if (multi && !multiViolates) {
        const boardCards = multi.slots.flatMap((s) => s.cards);
        const capturedCards = [handCard, ...boardCards];
        const base = scoreCapture(
          state,
          handCard,
          capturedCards,
          playerIndex,
          tracker,
        );
        const total = applyWeights(base, weights);
        actions.push({
          action: 'capture',
          handCard,
          captureDetails: {
            slots: multi.slots,
            capturedCards,
            totalPoints: multi.totalPoints,
            kind: 'multi',
          },
          score: { ...base, total },
          reasoning: `multi-slot (${multi.slots.length}) with ${handCard.rank} for ${multi.totalPoints}pts`,
        });
      }
    }

    const place = scorePlacement(state, handCard, playerIndex, tracker);
    const placeTotal = applyWeights(place, weights);
    actions.push({
      action: 'place',
      handCard,
      score: { ...place, total: placeTotal },
      reasoning: `place ${handCard.rank}${handCard.suit[0].toUpperCase()} (danger ${Math.abs(place.placementDanger).toFixed(0)})`,
    });
  }

  actions.sort((a, b) => b.score.total - a.score.total);
  return actions;
}

export function scoreFromDimensions(
  score: Omit<ActionScore, 'total'>,
  weights: PersonalityWeights,
): ActionScore {
  return { ...score, total: applyWeights(score, weights) };
}

export function modifyWeightsForGameState(
  baseWeights: PersonalityWeights,
  difficulty: Difficulty,
  state: GameState,
  playerIndex: PlayerIndex,
): PersonalityWeights {
  if (difficulty === 'beginner') return baseWeights;

  const target = state.settings.targetScore;
  if (!target || target <= 0) return baseWeights;

  const myScore = state.overallScores[SCORE_KEYS[playerIndex]];
  const opponentIndices = ([0, 1, 2] as PlayerIndex[]).filter((i) => i !== playerIndex);
  const maxOpponent = Math.max(...opponentIndices.map((i) => state.overallScores[SCORE_KEYS[i]]));

  if (difficulty === 'advanced') {
    // Denial takes precedence: opponent at 50%+ of target → block everything
    if (maxOpponent >= target * 0.50) {
      return { ...baseWeights, opponentDenial: 1.8, boardControl: 1.2 };
    }
    // Conservative: Rex leads by 20%+ of target → protect lead
    if (myScore - maxOpponent >= target * 0.20) {
      return { ...baseWeights, rawPoints: 0.5, placementDanger: 1.5, opponentDenial: 0.45 };
    }
    return baseWeights;
  }

  if (difficulty === 'intermediate') {
    // Aggressive: Nina behind by 15%+ of target → take more risks
    if (maxOpponent - myScore >= target * 0.15) {
      return { ...baseWeights, rawPoints: 1.3, opponentDenial: 0.5, placementDanger: 0.5 };
    }
    return baseWeights;
  }

  return baseWeights;
}

export function calvinPlacementPick(hand: readonly Card[]): Card {
  // Calvin's tell — always places his highest-value card
  let best = hand[0];
  let bestScore = calculateCardPoints(best);
  for (const c of hand) {
    const s = calculateCardPoints(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}
