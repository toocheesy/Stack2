import type {
  Card,
  CaptureGroup,
  CaptureOption,
  ComboSlot,
  ComboValidation,
  GameState,
  MultiSlotCapture,
  MultiSlotCaptureSlot,
  SlotValidation,
} from '../types';
import { calculateCardPoints, calculateCardsPoints } from './scoring';

const FACE_RANKS = new Set(['J', 'Q', 'K']);

function isFaceCard(card: Card): boolean {
  return FACE_RANKS.has(card.rank);
}

export function validateComboSlot(
  slotCards: readonly CaptureGroup[],
  baseCard: Card,
): SlotValidation {
  if (slotCards.length === 0) {
    return { isValid: false, captureType: null, details: 'Slot is empty' };
  }

  const allMatchBase = slotCards.every((g) => g.card.rank === baseCard.rank);
  if (allMatchBase) {
    return {
      isValid: true,
      captureType: 'pair',
      details: `Pair of ${baseCard.rank}`,
    };
  }

  if (isFaceCard(baseCard)) {
    return {
      isValid: false,
      captureType: null,
      details: 'Face cards can only pair, never sum',
    };
  }

  if (slotCards.some((g) => isFaceCard(g.card))) {
    return {
      isValid: false,
      captureType: null,
      details: 'Face cards cannot be used in sums',
    };
  }

  const sum = slotCards.reduce((acc, g) => acc + g.card.value, 0);
  if (sum === baseCard.value) {
    return {
      isValid: true,
      captureType: 'sum',
      details: `Sum to ${baseCard.value}`,
    };
  }

  return {
    isValid: false,
    captureType: null,
    details: `Sum ${sum} does not equal base value ${baseCard.value}`,
  };
}

function findCardSource(
  state: GameState,
  cardId: string,
): 'hand' | 'board' | null {
  const hand = state.hands[state.currentPlayer];
  if (hand.some((c) => c.id === cardId)) return 'hand';
  if (state.board.some((c) => c.id === cardId)) return 'board';
  return null;
}

export function validateFullCombo(state: GameState): ComboValidation {
  const errors: string[] = [];
  const { combination } = state;
  const base = combination.base;

  if (!base) {
    return {
      isValid: false,
      validSlots: [],
      allCapturedCards: [],
      totalPoints: 0,
      errors: ['Base card is required'],
    };
  }

  const slots: ComboSlot[] = ['combo1', 'combo2', 'combo3'];
  const slotValidations: SlotValidation[] = [];
  const allCapturedCards: Card[] = [base];
  let hasHandCard = false;
  let hasBoardCard = false;

  const baseSource = findCardSource(state, base.id);
  if (baseSource === 'hand') hasHandCard = true;
  else if (baseSource === 'board') hasBoardCard = true;
  else errors.push('Base card is not in current hand or board');

  let occupiedSlotCount = 0;
  for (const slot of slots) {
    if (slot === 'base') continue;
    const groups = combination[slot];
    if (groups.length === 0) continue;
    occupiedSlotCount++;
    const validation = validateComboSlot(groups, base);
    slotValidations.push(validation);
    if (!validation.isValid) {
      errors.push(`${slot}: ${validation.details}`);
      continue;
    }
    for (const g of groups) {
      allCapturedCards.push(g.card);
      if (g.source === 'hand') hasHandCard = true;
      else hasBoardCard = true;
    }
  }

  if (occupiedSlotCount === 0) {
    errors.push('At least one combo slot must have cards');
  }

  if (!hasHandCard || !hasBoardCard) {
    errors.push('Capture must include at least one hand card and one board card');
  }

  const totalPoints = calculateCardsPoints(allCapturedCards);

  return {
    isValid: errors.length === 0,
    validSlots: slotValidations,
    allCapturedCards,
    totalPoints,
    errors,
  };
}

function subsetSumsToValue(
  cards: readonly Card[],
  target: number,
  size: number,
): Card[][] {
  const results: Card[][] = [];
  const pick = (start: number, acc: Card[], sum: number) => {
    if (acc.length === size) {
      if (sum === target) results.push(acc.slice());
      return;
    }
    for (let i = start; i < cards.length; i++) {
      const next = cards[i];
      if (isFaceCard(next)) continue;
      const newSum = sum + next.value;
      if (newSum > target && size - acc.length > 0) continue;
      acc.push(next);
      pick(i + 1, acc, newSum);
      acc.pop();
    }
  };
  pick(0, [], 0);
  return results;
}

export function findAllCaptures(handCard: Card, board: readonly Card[]): CaptureOption[] {
  const options: CaptureOption[] = [];
  const handCardPoints = calculateCardPoints(handCard);

  const matchingBoard = board.filter((b) => b.rank === handCard.rank);
  for (let mask = 1; mask < 1 << matchingBoard.length; mask++) {
    const subset: Card[] = [];
    for (let i = 0; i < matchingBoard.length; i++) {
      if (mask & (1 << i)) subset.push(matchingBoard[i]);
    }
    options.push({
      type: 'pair',
      boardCards: subset,
      points: handCardPoints + calculateCardsPoints(subset),
    });
  }

  if (!isFaceCard(handCard)) {
    const maxSumSize = Math.min(board.length, 10);
    for (let size = 2; size <= maxSumSize; size++) {
      const subsets = subsetSumsToValue(board, handCard.value, size);
      for (const subset of subsets) {
        options.push({
          type: 'sum',
          boardCards: subset,
          points: handCardPoints + calculateCardsPoints(subset),
        });
      }
    }
  }

  return options;
}

function hasOverlap(a: CaptureOption, b: CaptureOption): boolean {
  const ids = new Set(a.boardCards.map((c) => c.id));
  return b.boardCards.some((c) => ids.has(c.id));
}

export function findBestMultiSlotCapture(
  handCard: Card,
  board: readonly Card[],
): MultiSlotCapture | null {
  const options = findAllCaptures(handCard, board);
  if (options.length < 2) return null;

  const handPoints = calculateCardPoints(handCard);
  let best: { picks: CaptureOption[]; total: number } | null = null;

  const n = options.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hasOverlap(options[i], options[j])) continue;
      const pair = [options[i], options[j]];
      const pairTotal =
        handPoints +
        calculateCardsPoints([...options[i].boardCards, ...options[j].boardCards]);
      if (!best || pairTotal > best.total) best = { picks: pair, total: pairTotal };

      for (let k = j + 1; k < n; k++) {
        if (hasOverlap(options[i], options[k])) continue;
        if (hasOverlap(options[j], options[k])) continue;
        const trip = [options[i], options[j], options[k]];
        const tripTotal =
          handPoints +
          calculateCardsPoints([
            ...options[i].boardCards,
            ...options[j].boardCards,
            ...options[k].boardCards,
          ]);
        if (tripTotal > best.total) best = { picks: trip, total: tripTotal };
      }
    }
  }

  if (!best) return null;

  const slotNames: Array<Exclude<ComboSlot, 'base'>> = ['combo1', 'combo2', 'combo3'];
  const slots: MultiSlotCaptureSlot[] = best.picks.map((opt, idx) => ({
    slot: slotNames[idx],
    cards: opt.boardCards,
    type: opt.type,
  }));

  return { handCard, slots, totalPoints: best.total };
}
