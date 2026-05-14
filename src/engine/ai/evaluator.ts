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
import { calculateCardsPoints } from '../core/scoring';
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

export interface SelectiveDeckInfo {
  acesRemaining: number;
  faceCardScarcity: { J: number; Q: number; K: number };
  oddOnes: Rank[];
}

export type SeatPosition = 'dealer' | 'first' | 'second';

export interface PositionContext {
  currentPosition: SeatPosition;
  handOfRound: number;
  activePlayerCount: number;
  previousAction: 'capture' | 'place' | null;
}

export function getPositionContext(
  state: GameState,
  playerIndex: PlayerIndex,
): PositionContext {
  const dealer = state.currentDealer;
  const first = ((dealer + 1) % 3) as PlayerIndex;
  let currentPosition: SeatPosition;
  if (playerIndex === dealer) currentPosition = 'dealer';
  else if (playerIndex === first) currentPosition = 'first';
  else currentPosition = 'second';

  const activePlayerCount = state.hands.filter((h) => h.length > 0).length;

  return {
    currentPosition,
    handOfRound: state.handNumber,
    activePlayerCount,
    previousAction: state.lastAction,
  };
}

export function applyPositionModifiers(
  weights: PersonalityWeights,
  positionAwareness: number,
  context: PositionContext,
  state: GameState,
  playerIndex: PlayerIndex,
): PersonalityWeights {
  if (positionAwareness < 2) return weights;

  const modified = { ...weights };
  const target = state.settings.targetScore;
  const myScore = state.overallScores[SCORE_KEYS[playerIndex]];

  // Layer 1: Round arc position (Nina+ at PA >= 4)
  if (positionAwareness >= 4) {
    if (context.currentPosition === 'dealer' && context.handOfRound === 2) {
      // Dealer Hand 2 = Press Hand (doctrine 5.8)
      modified.rawPoints *= 1.3;
      modified.placementDanger *= 0.7;
    }
    if (context.currentPosition === 'first') {
      // First Player advantage — press fresh board (doctrine 2.10)
      modified.rawPoints *= 1.15;
    }
    if (context.currentPosition === 'dealer') {
      // Dealer penalty awareness — cautious placement (doctrine 2.9)
      modified.placementDanger *= 1.2;
    }
  }

  // Layer 4: Active player count (Calvin partially at PA >= 2)
  if (positionAwareness >= 2) {
    if (context.activePlayerCount === 1) {
      // Solo state — no opponents to deny or fear
      modified.opponentDenial *= 0.1;
      modified.placementDanger *= 0.3;
    } else if (context.activePlayerCount === 2) {
      // 2-player — reduced threat surface
      modified.opponentDenial *= 0.7;
    }
  }

  // Hand 3 Fork (doctrine 6.6) — Nina+ at PA >= 6
  if (positionAwareness >= 6 && context.handOfRound >= 3) {
    if (target > 0 && myScore >= target * 0.7) {
      // PRESS path: target reachable this round
      modified.rawPoints *= 1.4;
    } else {
      // PIVOT path: engineer jackpot
      modified.jackpotValue *= 1.5;
      modified.boardControl *= 1.3;
    }
  }

  return modified;
}

export function applyPressureExpansion(
  weights: PersonalityWeights,
  pressureHandling: number,
  state: GameState,
  playerIndex: PlayerIndex,
): PersonalityWeights {
  if (pressureHandling < 4) return weights;

  const modified = { ...weights };
  const target = state.settings.targetScore;
  const myScore = state.overallScores[SCORE_KEYS[playerIndex]];
  const handOfRound = state.handNumber;

  // 1. Hand-of-round posture shifts (PH >= 4)
  if (handOfRound === 2) {
    // Non-dealer Hand 2 press when trailing (dealer press is in position modifiers)
    const opponentIndices = ([0, 1, 2] as PlayerIndex[]).filter((i) => i !== playerIndex);
    const maxOpp = Math.max(...opponentIndices.map((i) => state.overallScores[SCORE_KEYS[i]]));
    const deficit = maxOpp - myScore;
    if (target > 0 && deficit > target * 0.1) {
      modified.rawPoints *= 1.2;
    }
  }

  // 2. Jackpot proximity awareness (PH >= 5)
  if (pressureHandling >= 5) {
    const jackpotNear = handOfRound >= 3 && state.deck.length < 12;
    if (jackpotNear) {
      if (state.lastCapturer === playerIndex) {
        // Protect last-capturer status — jackpot is ours to lose
        modified.jackpotValue *= 1.8;
        modified.placementDanger *= 0.5;
      } else {
        // Need to capture to become last capturer before round ends
        modified.rawPoints *= 1.3;
      }
    }
  }

  // 3. Target-score aggression scaling (PH >= 6)
  if (pressureHandling >= 6 && target > 0) {
    if (target <= 200) {
      modified.rawPoints *= 1.3;
    } else if (target >= 400) {
      modified.rawPoints *= 0.85;
    }
  }

  return modified;
}

export interface OpponentInfo {
  playerIndex: PlayerIndex;
  score: number;
  difficulty: Difficulty | null;
  preferHighestNumberCardOnPlace: boolean;
  mistakeRate: number;
  allowMultiSlot: boolean;
}

export function getSelectiveDeckAwareness(
  tracker: CardTrackerState,
): SelectiveDeckInfo {
  const acesRemaining = getRemainingOfRank(tracker, 'A');
  const faceCardScarcity = {
    J: getRemainingOfRank(tracker, 'J'),
    Q: getRemainingOfRank(tracker, 'Q'),
    K: getRemainingOfRank(tracker, 'K'),
  };
  const oddOnes: Rank[] = [];
  for (const rank of ['J', 'Q', 'K'] as Rank[]) {
    if (getRemainingOfRank(tracker, rank) === 1) {
      oddOnes.push(rank);
    }
  }
  return { acesRemaining, faceCardScarcity, oddOnes };
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
  selectiveDeck?: SelectiveDeckInfo | null,
  opponents?: OpponentInfo[],
  opponentAwareness?: number,
): Omit<ActionScore, 'total'> {
  const capturedIds = new Set(capturedCards.map((c) => c.id));
  const boardCaptured = capturedCards.filter((c) => c.id !== handCard.id);

  let rawPoints = calculateCardsPoints(capturedCards);

  // Selective deck awareness: Ace scarcity bonus
  if (selectiveDeck && selectiveDeck.acesRemaining <= 2) {
    for (const c of capturedCards) {
      if (c.rank === 'A') rawPoints += 10;
    }
  }

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
  // Per-opponent denial: weight by threat level when awareness is high enough
  let denialMultiplier = 1.0;
  if ((opponentAwareness ?? 0) >= 4 && opponents && opponents.length > 0) {
    const target = state.settings.targetScore;
    if (target > 0) {
      const maxThreat = Math.max(...opponents.map((o) => o.score / target));
      denialMultiplier = 1.0 + Math.min(maxThreat, 1.0);
    }
  }
  const opponentDenial = deniedCount * 15 * denialMultiplier;

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
  selectiveDeck?: SelectiveDeckInfo | null,
  nextOpponent?: OpponentInfo | null,
  setupEngineering?: number,
): Omit<ActionScore, 'total'> {
  const placedIsFace = isFace(handCard.rank);
  const placedValue = handCard.value;

  let danger = 0;
  let setupValue = 0;

  // Place-To-Plant: face card from a hand-vs-hand pair (doctrine 3.3)
  if ((setupEngineering ?? 0) >= 3 && placedIsFace) {
    const remainingHand = state.hands[playerIndex].filter(
      (c) => c.id !== handCard.id,
    );
    const hasMatch = remainingHand.some((c) => c.rank === handCard.rank);
    if (hasMatch) {
      const publicRemaining = getRemainingOfRank(tracker, handCard.rank);
      const heldCount = state.hands[playerIndex].filter(
        (c) => c.rank === handCard.rank,
      ).length;
      const opponentPool = Math.max(0, publicRemaining - heldCount);
      let survival =
        opponentPool === 0 ? 0.9 : opponentPool === 1 ? 0.5 : 0.3;
      if (nextOpponent?.preferHighestNumberCardOnPlace) {
        survival = Math.min(survival + 0.3, 0.95);
      }
      const captureValue = SCORE_VALUES[handCard.rank] * 2;
      setupValue = captureValue * survival;

      // Jackpot Trap bonus: dead face card in Hand 3 (doctrine 6.4)
      if (
        (setupEngineering ?? 0) >= 7 &&
        selectiveDeck?.oddOnes.includes(handCard.rank) &&
        state.handNumber >= 3
      ) {
        setupValue += 20;
      }
    }
  }

  // Selective deck awareness: Odd-One Trap penalty
  if (
    selectiveDeck &&
    placedIsFace &&
    selectiveDeck.oddOnes.includes(handCard.rank)
  ) {
    danger += SCORE_VALUES[handCard.rank] * 1.5;
  }

  for (const rank of RANKS) {
    const remaining = getRemainingOfRank(tracker, rank);
    if (remaining === 0) continue;

    if (rank === handCard.rank) {
      let pairDanger = SCORE_VALUES[rank];
      // Personality-aware: Calvin won't capture face cards (he places
      // number cards), so face card placements before Calvin are safer
      if (
        nextOpponent?.preferHighestNumberCardOnPlace &&
        placedIsFace
      ) {
        pairDanger *= 0.3;
      }
      danger += pairDanger;
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
    rawPoints: setupValue,
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

export interface PlaceChainPlan {
  placedCard: Card;
  followupCapture: {
    handCard: Card;
    capturedCards: Card[];
    points: number;
  };
  totalExpectedPoints: number;
}

export function evaluatePlaceChain(
  handCards: readonly Card[],
  board: readonly Card[],
): PlaceChainPlan | null {
  let best: PlaceChainPlan | null = null;

  for (const placed of handCards) {
    const newBoard = [...board, placed];
    const remainingHand = handCards.filter((c) => c.id !== placed.id);

    for (const h of remainingHand) {
      const cap = bestSingleCapture(h, newBoard);
      if (!cap) continue;
      // Only count chains that recapture the planted card
      if (!cap.boardCards.some((c) => c.id === placed.id)) continue;
      if (!best || cap.points > best.totalExpectedPoints) {
        best = {
          placedCard: placed,
          followupCapture: {
            handCard: h,
            capturedCards: cap.boardCards,
            points: cap.points,
          },
          totalExpectedPoints: cap.points,
        };
      }
    }
  }

  return best;
}

export type ComboRestrictionKey = 'pairsOnly' | 'noSum2' | 'noSum3';

export interface EvaluateOptions {
  allowMultiSlot?: boolean;
  restrictions?: readonly ComboRestrictionKey[];
  selectiveDeck?: SelectiveDeckInfo | null;
  opponents?: OpponentInfo[];
  nextOpponent?: OpponentInfo | null;
  opponentAwareness?: number;
  setupEngineering?: number;
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
  const selectiveDeck = options.selectiveDeck;
  const opponents = options.opponents;
  const nextOpponent = options.nextOpponent;
  const opponentAwareness = options.opponentAwareness ?? 0;
  const setupEngineering = options.setupEngineering ?? 0;

  for (const handCard of hand) {
    const singles = findAllCaptures(handCard, state.board);
    for (const s of singles) {
      if (captureViolatesRestrictions(s.type, s.boardCards.length, options.restrictions))
        continue;
      const capturedCards = [handCard, ...s.boardCards];
      const base = scoreCapture(state, handCard, capturedCards, playerIndex, tracker, selectiveDeck, opponents, opponentAwareness);
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
          selectiveDeck,
          opponents,
          opponentAwareness,
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

    const place = scorePlacement(state, handCard, playerIndex, tracker, selectiveDeck, nextOpponent, setupEngineering);
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

  if (difficulty === 'expert') {
    // Jett: tighter thresholds than Rex — patient hunter
    if (maxOpponent >= target * 0.45) {
      return { ...baseWeights, opponentDenial: 2.0, boardControl: 1.3 };
    }
    if (myScore - maxOpponent >= target * 0.15) {
      return { ...baseWeights, rawPoints: 0.4, placementDanger: 1.8, opponentDenial: 0.3 };
    }
    return baseWeights;
  }

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

export function calvinNumberCardPick(hand: readonly Card[]): Card | null {
  // Calvin's tell — always places his highest number card (2-9)
  // Per doctrine 3.2: spend high number cards first, defer sum vehicles,
  // face cards, and Aces. Returns null if no number cards in hand.
  const numberCards = hand.filter((c) => c.value >= 2 && c.value <= 9);
  if (numberCards.length === 0) return null;
  let best = numberCards[0];
  for (const c of numberCards) {
    if (c.value > best.value) best = c;
  }
  return best;
}
