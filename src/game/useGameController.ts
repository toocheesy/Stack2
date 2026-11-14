import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Card,
  CardSource,
  Combination,
  ComboSlot,
  GameSettings,
  GameState,
  PlayerIndex,
  Rank,
  Scores,
  Suit,
} from '../engine/types';
import {
  createInitialState,
  dealNewHand,
  executeCapture,
  placeCard,
  resetCombination,
  applyJackpot,
  startNewRound,
} from '../engine/core/gameState';
import { botCaptureToCombination, validateComboSlot, validateFullCombo } from '../engine/core/captureValidator';
import { determineTurnResult, findNextPlayerWithCards } from '../engine/core/turnManager';
import { calculateCardPoints, calculateCardsPoints } from '../engine/core/scoring';
import { botStreamSeed, createPRNG, type PRNG } from '../engine/utils/prng';
import { readCardMemory } from '../engine/ai/cardTracker';
import { decideBotAction, getBotThinkingDelay, getPersonalityProfile } from '../engine/ai/botDecision';
import { evaluateAllActions } from '../engine/ai/evaluator';
import { saveGame, loadGame, clearSavedGame } from './persistence';
import { trackFirstCapture } from '../analytics/track';

export interface GameActions {
  addToCombo: (cardId: string, source: CardSource, slot: ComboSlot) => void;
  removeFromCombo: (cardId: string) => void;
  submitCombo: () => string | null;
  placeCard: (cardId: string) => void;
  resetCombo: () => void;
  continueRound: () => void;
}

export interface BotVizStep {
  playerIndex: PlayerIndex;
}

/** An opponent's capture on show in the tray (GB2 phone C): the Combination
 *  the opponent built, slot by slot, its points (RULES.md Law 6) and every
 *  captured card, base first. */
export interface BotComboDisplay {
  playerIndex: PlayerIndex;
  combination: Combination;
  points: number;
  cards: Card[];
}

/** One capture in a turn: the Combination as built and its points. */
export interface MoveCapture {
  combination: Combination;
  points: number;
}

/** The last move made, for the board's message line (D-007 ruling 95), the
 *  opponents' speech bubbles (GB2) and the board's motion (YC1, the last
 *  cards landing). A turn's captures build up until the turn ends with a
 *  place or an empty hand; another player's move replaces it, a new deal or
 *  round clears it, and so does your staging a card. App.tsx passes it to
 *  GameView under its name from before release 2, lastCapture. */
export interface LastMove {
  /** Counts up with every move, so the board plays each move's motion once. */
  id: number;
  player: PlayerIndex;
  captures: MoveCapture[];
  /** The card placed to end the turn; null while the turn goes on. */
  placed: Card | null;
  /** RULES.md Law 8: the rest of the hand the game placed after `placed`. */
  rest: Card[];
  /** The round and hand the move was made in. */
  round: number;
  hand: number;
  /** After a capture that emptied your hand: the next player holding cards
   *  (RULES.md Law 12); null otherwise. */
  next: PlayerIndex | null;
  /** The game as it stood before the move, for the board's motion. */
  before: GameState;
}

/** Take the Table on show (TT1, RULES.md Law 10): who takes it, the cards as
 *  they lay and the scores before, for the board's motion. App.tsx passes it
 *  to GameView as jackpotInfo. */
export interface TakeTheTableMoment {
  id: number;
  winner: PlayerIndex;
  points: number;
  cardCount: number;
  cards: Card[];
  scoresBefore: Scores;
}

/** The moments' timings in milliseconds, as the boards' notes give them. The
 *  board reads them for its motion; the controller for when play moves on. */
export const MOMENTS = {
  /** YC1, your capture, about 1,020 ms from SUBMIT: the tray's chrome fades,
   *  the cards fly to your bar, the message line changes, the score lands. */
  yourCapture: { chromeOut: 140, cardStep: 60, cardFlight: 460, message: 640, land: 700, end: 1020, calm: { out: 180, land: 350, end: 750 } },
  /** RULES.md Law 8 (ruling 44): the rest of a hand lands one card at a time,
   *  then the last-cards line holds before play moves on. */
  landing: { step: 80, flight: 400, hold: 1500 },
  /** TT1, Take the Table, 2,500 ms: a beat, the cards fly to the taker, the
   *  banner, the score lands, and RE1p's sheet starts to rise. */
  takeTheTable: { hold: 240, step: 80, flight: 640, banner: 260, land: 1180, bannerEnd: 1760, sheet: 2120, end: 2500, calm: { out: 400, land: 500, bannerEnd: 1700, sheet: 2100 } },
} as const;

/** How long the last cards take to land and the line to hold (Law 8). */
export function landingMs(restCount: number): number {
  if (restCount <= 0) return 0;
  const l = MOMENTS.landing;
  return l.step * (restCount - 1) + l.flight + l.hold;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// The captures made so far in the turn `prev` records, when that turn is
// this player's and still going; otherwise none.
function turnCaptures(prev: LastMove | null, player: PlayerIndex, s: GameState): MoveCapture[] {
  return prev && prev.player === player && prev.placed === null && prev.round === s.currentRound && prev.hand === s.handNumber
    ? prev.captures
    : [];
}

// RULES.md Law 8: when every other hand is empty, a place also puts the rest
// of the placer's hand on the table. The rest, for the message line.
function restAfterPlace(s: GameState, player: PlayerIndex, placedId: string): Card[] {
  const othersEmpty = s.hands.every((h, i) => i === player || h.length === 0);
  return othersEmpty ? s.hands[player].filter((c) => c.id !== placedId) : [];
}

/** The game controller. `paused` is the pause (D-007 release 2 part 3,
 *  section D): true while the tutorial, the leave sheet or the in-game
 *  Settings is open. While it is, no opponent moves and no moment carries
 *  on; closing the sheet carries on from where the game stood. It began as
 *  the tutorial's freeze and keeps that freeze's gates. */
export function useGameController(seed: number, settings: GameSettings, paused: boolean = false) {
  // Set up once, on mount (S-006): the saved game if there is one, the
  // game seed (the seed prop for a new game, the save's own for a resumed one)
  // and the two streams from it: prngRef deals, botPrngRef feeds the bots. A
  // resumed game's streams carry on from where the save left them.
  const [mount] = useState(() => {
    const saved = loadGame('classic');
    return saved
      ? { saved, seed: saved.seed, dealPrng: createPRNG(saved.dealStream), botPrng: createPRNG(saved.botStream) }
      : { saved: null, seed, dealPrng: createPRNG(seed), botPrng: createPRNG(botStreamSeed(seed)) };
  });
  const seedRef = useRef(mount.seed);
  const prngRef = useRef<PRNG>(mount.dealPrng);
  const botPrngRef = useRef<PRNG>(mount.botPrng);
  const botBusyRef = useRef(false);
  const mountedRef = useRef(true);
  // The pause (the tutorial freeze of May 26, widened to every pause sheet).
  // runBotTurn and its in-flight checkpoints read this ref: while paused, no
  // bot turn starts and an in-flight turn gates out at its next await (no
  // state change past the last setAndPersist). A moment's wait that ends
  // while paused holds in waitThrough until the sheet closes. The resume
  // effect (deps [paused]) lets held moments carry on, or re-fires
  // runBotTurn from the frozen state.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Moments waiting through a pause: how many, and how to let them carry on.
  const holdRef = useRef(0);
  const resumersRef = useRef<(() => void)[]>([]);

  // Analytics: set during state init so game_start can emit resumed:true
  // and first_capture is suppressed on resumed games (player isn't making
  // their literal first capture — they're picking up a game in progress).
  const wasResumedRef = useRef(false);

  const [state, setState] = useState<GameState>(() => {
    const saved = mount.saved;
    if (saved) {
      wasResumedRef.current = true;
      return saved.game;
    }
    return createInitialState(settings, prngRef.current);
  });

  // Analytics: time the player's first capture from mount.
  const gameStartedAtRef = useRef(Date.now());
  const firstCaptureFiredRef = useRef(false);

  const setAndPersist = useCallback((s: GameState) => {
    setState(s);
    stateRef.current = s;
    saveGame('classic', {
      game: s,
      seed: seedRef.current,
      dealStream: prngRef.current.getSeed(),
      botStream: botPrngRef.current.getSeed(),
    });
  }, []);
  const [botViz, setBotViz] = useState<BotVizStep | null>(null);
  const [gameOver, setGameOver] = useState<{ winner: PlayerIndex } | null>(null);
  const [botCombo, setBotCombo] = useState<BotComboDisplay | null>(null);
  const [jackpotInfo, setJackpotInfo] = useState<TakeTheTableMoment | null>(null);

  // The last move (D-007 release 2): a derived read for the board, not saved.
  // A reload starts with none, and the message line falls back to the rules
  // that read the state alone.
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const lastMoveRef = useRef<LastMove | null>(null);
  const moveIdRef = useRef(0);
  const recordMove = useCallback((m: Omit<LastMove, 'id'> | null) => {
    const move = m ? { ...m, id: ++moveIdRef.current } : null;
    lastMoveRef.current = move;
    setLastMove(move);
  }, []);

  // Always-fresh ref to current state (avoids stale closures)
  const stateRef = useRef(state);
  stateRef.current = state;

  // A new Classic game is saved the moment it is dealt (D-007 ruling 110), so
  // leaving before anyone has moved keeps it for CONTINUE. The save is the
  // one setAndPersist writes, written now instead of at the first move. A
  // resumed game is left as it was loaded.
  useEffect(() => {
    if (mount.saved !== null) return;
    saveGame('classic', {
      game: stateRef.current,
      seed: seedRef.current,
      dealStream: prngRef.current.getSeed(),
      botStream: botPrngRef.current.getSeed(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Core flow: advance after any action ──────────

  const advanceRef = useRef<(s: GameState) => Promise<void>>(null!);

  advanceRef.current = async (current: GameState) => {
    if (!mountedRef.current) return;
    const result = determineTurnResult(current);

    switch (result.type) {
      case 'CONTINUE_TURN': {
        const next = {
          ...current,
          currentPlayer: result.nextPlayer,
        };
        setAndPersist(next);
        if (result.nextPlayer !== 0) {
          await runBotTurn(next);
        }
        break;
      }
      case 'DEAL_NEW_HAND': {
        let next = dealNewHand(current);
        next = { ...next, currentPlayer: result.startingPlayer };
        setAndPersist(next);
        // A new hand: the last cards line and the after-move lines end here.
        recordMove(null);
        if (result.startingPlayer !== 0) {
          await runBotTurn(next);
        }
        break;
      }
      case 'END_ROUND': {
        const { state: afterJackpot, jackpotResult } = applyJackpot(current);
        setAndPersist(afterJackpot);
        if (jackpotResult) {
          // Take the Table plays (TT1): the sheet starts to rise before it ends.
          setJackpotInfo({
            id: ++moveIdRef.current,
            winner: jackpotResult.player,
            points: jackpotResult.points,
            cardCount: jackpotResult.cardCount,
            cards: current.board,
            scoresBefore: current.overallScores,
          });
          await waitThrough(MOMENTS.takeTheTable.sheet);
          if (!mountedRef.current) return;
          setAndPersist({ ...stateRef.current, gamePhase: 'roundEnd' as const, isOvertime: result.isOvertime });
          await waitThrough(MOMENTS.takeTheTable.end - MOMENTS.takeTheTable.sheet);
          if (!mountedRef.current) return;
          setJackpotInfo(null);
        } else {
          await waitThrough(500);
          if (!mountedRef.current) return;
          setAndPersist({ ...stateRef.current, gamePhase: 'roundEnd' as const, isOvertime: result.isOvertime });
        }
        break;
      }
      case 'END_GAME': {
        const { state: afterJackpot, jackpotResult } = applyJackpot(current);
        setAndPersist(afterJackpot);
        if (jackpotResult) {
          // Take the Table plays, then game over.
          setJackpotInfo({
            id: ++moveIdRef.current,
            winner: jackpotResult.player,
            points: jackpotResult.points,
            cardCount: jackpotResult.cardCount,
            cards: current.board,
            scoresBefore: current.overallScores,
          });
          await waitThrough(MOMENTS.takeTheTable.end);
          if (!mountedRef.current) return;
          setJackpotInfo(null);
        }
        const finalState = { ...stateRef.current, gamePhase: 'gameOver' as const };
        setAndPersist(finalState);
        clearSavedGame('classic');
        setGameOver({ winner: result.winner });
        break;
      }
    }
  };

  // A moment's wait that holds through a pause (section D): when the time is
  // up and a sheet is open, play carries on once the sheet closes. The resume
  // effect sees the hold and starts nothing of its own meanwhile.
  async function waitThrough(ms: number): Promise<void> {
    holdRef.current += 1;
    try {
      await wait(ms);
      if (pausedRef.current && mountedRef.current) {
        await new Promise<void>((resolve) => { resumersRef.current.push(resolve); });
      }
    } finally {
      holdRef.current -= 1;
    }
  }

  // Moves play on after a wait: when your capture empties your hand (YC1's
  // land), and when the last cards land (Law 8). If play has moved on another
  // way meanwhile, the wait ends quietly.
  function advanceLater(next: GameState, ms: number) {
    void (async () => {
      await waitThrough(ms);
      if (!mountedRef.current) return;
      if (stateRef.current !== next) return;
      await advanceRef.current(next);
    })();
  }

  // ─── Bot turn execution ───────────────────────────

  async function runBotTurn(current: GameState): Promise<void> {
    if (!mountedRef.current || botBusyRef.current || pausedRef.current) return;
    const player = current.currentPlayer;
    if (player === 0) return;
    if (current.hands[player].length === 0) {
      // Bot has no cards — advance immediately
      await advanceRef.current(current);
      return;
    }

    botBusyRef.current = true;
    setBotViz({ playerIndex: player });

    const difficulty =
      player === 1
        ? current.settings.bot1Personality
        : current.settings.bot2Personality;

    const delay = getBotThinkingDelay(difficulty, botPrngRef.current);
    await wait(delay);
    if (!mountedRef.current) return;
    // Pause gate after the thinking delay: a sheet opened mid-think.
    if (pausedRef.current) {
      setBotViz(null);
      botBusyRef.current = false;
      return;
    }

    if (import.meta.env.DEV) {
      // ── AI diagnostic logging ──
      const profile = getPersonalityProfile(difficulty);
      const allActions = evaluateAllActions(
        current,
        player,
        readCardMemory(current),
        profile.weights,
        { allowMultiSlot: profile.captureComplexity >= 3 },
      );
      const top3 = allActions.slice(0, 3);
      console.log(
        `[BOT ${player}] ${profile.name} (${difficulty}) | ` +
        `hand: ${current.hands[player].length} cards | ` +
        `board: ${current.board.length} cards | ` +
        `${allActions.length} actions evaluated`,
      );
      top3.forEach((a, i) => {
        console.log(
          `  #${i + 1}: ${a.action} ${a.handCard.rank}${a.handCard.suit[0]} ` +
          `total=${a.score.total.toFixed(1)} raw=${a.score.rawPoints} ` +
          `chain=${a.score.chainPotential} deny=${a.score.opponentDenial.toFixed(1)} ` +
          `| ${a.reasoning}`,
        );
      });
    }

    const decision = decideBotAction(
      current,
      player,
      difficulty,
      readCardMemory(current),
      botPrngRef.current,
    );

    if (import.meta.env.DEV) {
      console.log(
        `  → CHOSEN: ${decision.action} ${decision.handCard.rank}${decision.handCard.suit[0]} ` +
        `score=${decision.score.total.toFixed(1)} | ${decision.reasoning}`,
      );
    }

    // Bot captures go through the same capture check as the player's.
    // A refused capture falls through to the place branch below.
    let botCombo: Combination | null = null;
    let botPoints = 0;
    let botCards: Card[] = [];
    if (decision.action === 'capture' && decision.captureDetails) {
      const combo = botCaptureToCombination(
        decision.handCard,
        decision.captureDetails.slots,
      );
      const validation = validateFullCombo(current, combo);
      if (validation.isValid) {
        botCombo = combo;
        botPoints = validation.totalPoints;
        botCards = validation.allCapturedCards;
      } else if (import.meta.env.DEV) {
        console.warn(
          `[BOT ${player}] capture refused by validateFullCombo`,
          { base: decision.handCard, slots: decision.captureDetails.slots, errors: validation.errors },
        );
      }
    }

    let next: GameState;
    let restPlaced = 0;
    if (botCombo && decision.captureDetails) {
      // Show the opponent's capture in the tray as it built it, slot by slot,
      // for the player to read; its speech bubble recaps it from here on.
      const moveBefore = lastMoveRef.current;
      recordMove({
        player,
        captures: [...turnCaptures(moveBefore, player, current), { combination: botCombo, points: botPoints }],
        placed: null,
        rest: [],
        round: current.currentRound,
        hand: current.handNumber,
        next: null,
        before: current,
      });
      setBotCombo({ playerIndex: player, combination: botCombo, points: botPoints, cards: botCards });
      await wait(2000);
      if (!mountedRef.current) return;
      setBotCombo(null);
      // Pause gate after the capture replay: a sheet opened mid-show.
      if (pausedRef.current) {
        lastMoveRef.current = moveBefore;
        setLastMove(moveBefore);
        setBotViz(null);
        botBusyRef.current = false;
        return;
      }

      next = executeCapture(current, botCombo);
    } else {
      const rest = restAfterPlace(current, player, decision.handCard.id);
      restPlaced = rest.length;
      next = placeCard(current, decision.handCard.id);
      recordMove({
        player,
        captures: turnCaptures(lastMoveRef.current, player, current),
        placed: decision.handCard,
        rest,
        round: current.currentRound,
        hand: current.handNumber,
        next: null,
        before: current,
      });
    }

    setAndPersist(next);
    setBotViz(null);
    botBusyRef.current = false;

    // The last cards land and the line holds (Law 8) before play moves on;
    // a pause opened meanwhile holds it until the sheet closes.
    await waitThrough(restPlaced > 0 ? landingMs(restPlaced) : 500);
    if (!mountedRef.current) return;
    await advanceRef.current(next);
  }

  // Mount/unmount tracker — separate from the bot trigger so the lifecycle
  // flag is set/cleared exactly once. A moment held through a pause at
  // unmount is let go, and finds the controller gone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const held = resumersRef.current;
      resumersRef.current = [];
      held.forEach((resume) => resume());
    };
  }, []);

  // ─── Bot turn trigger: mount + pause-close resume ───
  // Single effect covers (a) initial mount when nothing is paused, (b)
  // resumption when a sheet closes mid-game. The pause gates inside
  // runBotTurn handle the mid-turn freeze (an in-flight bot turn cleans up
  // at its next await); a moment held in waitThrough carries on itself.
  useEffect(() => {
    if (paused) return;
    if (holdRef.current > 0) {
      const held = resumersRef.current;
      resumersRef.current = [];
      held.forEach((resume) => resume());
      return;
    }
    if (botBusyRef.current || gameOver) return;
    const s = stateRef.current;
    if (s.currentPlayer !== 0) {
      void runBotTurn(s);
      return;
    }
    // A save made between your last move and its advance (your hand empty,
    // the game still playing): play moves on now.
    if (s.gamePhase === 'playing' && s.hands[0].length === 0) {
      void advanceRef.current(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // ─── Player actions ───────────────────────────────

  const addToCombo = useCallback(
    (cardId: string, source: CardSource, slot: ComboSlot) => {
      if (botBusyRef.current) return;
      const s = stateRef.current;
      if (s.currentPlayer !== 0) return;

      const card =
        source === 'hand'
          ? s.hands[0].find((c) => c.id === cardId)
          : s.board.find((c) => c.id === cardId);
      if (!card) return;

      const combo = {
        base: s.combination.base,
        combo1: s.combination.combo1.slice(),
        combo2: s.combination.combo2.slice(),
        combo3: s.combination.combo3.slice(),
      };

      if (slot === 'base') {
        if (combo.base) return;
        combo.base = card;
      } else {
        if (!combo.base) return;
        const already =
          combo.base.id === cardId ||
          [...combo.combo1, ...combo.combo2, ...combo.combo3].some(
            (g) => g.card.id === cardId,
          );
        if (already) return;
        // Slot type-lock (capture-legality fix, May 25): each non-base slot
        // represents ONE relationship to the base — either a pair/match or a
        // sum, never both. Engine math already rejects mixed slots at SUBMIT,
        // but the staging gate let users build them. Lock the slot to its
        // first card's role: if the first card matches the base rank, only
        // accept further match-rank cards; otherwise only accept further
        // non-match-rank cards. Refuse the off-type drop silently. Cross-slot
        // apex plays (slot 1 match + slot 2 sum) and the face-card pair-only
        // rule are unaffected — this gate is per-slot.
        const existing = combo[slot];
        if (existing.length > 0) {
          const firstIsMatch = existing[0].card.rank === combo.base.rank;
          const newIsMatch = card.rank === combo.base.rank;
          if (firstIsMatch !== newIsMatch) return;
        }
        combo[slot] = combo[slot].concat([{ card, source }]);
      }

      const next = { ...s, combination: combo };
      // Staging a card ends the after-your-move line (D-007 ruling 95).
      if (lastMoveRef.current?.player === 0) recordMove(null);
      setAndPersist(next);
    },
    [setAndPersist, recordMove],
  );

  const submitCombo = useCallback((): string | null => {
    if (botBusyRef.current) return 'Not your turn';
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return 'Not your turn';

    const validation = validateFullCombo(s);
    if (!validation.isValid) return validation.errors[0] ?? 'Invalid combo';

    const next = executeCapture(s, s.combination);
    if (!firstCaptureFiredRef.current && !wasResumedRef.current) {
      firstCaptureFiredRef.current = true;
      trackFirstCapture({
        mode: 'classic',
        time_to_first_capture_ms: Date.now() - gameStartedAtRef.current,
        seed: seedRef.current,
      });
    }
    const handEmptied = next.hands[0].length === 0;
    recordMove({
      player: 0,
      captures: [...turnCaptures(lastMoveRef.current, 0, s), { combination: s.combination, points: validation.totalPoints }],
      placed: null,
      rest: [],
      round: s.currentRound,
      hand: s.handNumber,
      // RULES.md Law 12: when the capture emptied your hand, the next player holding cards.
      next: handEmptied ? findNextPlayerWithCards(next, false) : null,
      before: s,
    });
    setAndPersist(next);
    // Your turn goes on at once; when your hand is empty the next turn starts
    // as your capture lands (YC1).
    if (handEmptied) advanceLater(next, MOMENTS.yourCapture.land);
    else void advanceRef.current(next);
    return null;
  }, [setAndPersist, recordMove]);

  const doPlaceCard = useCallback((cardId: string) => {
    if (botBusyRef.current) return;
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return;
    const card = s.hands[0].find((c) => c.id === cardId);
    if (!card) return;

    const rest = restAfterPlace(s, 0, cardId);
    let next = resetCombination(s);
    next = placeCard(next, cardId);
    recordMove({
      player: 0,
      captures: turnCaptures(lastMoveRef.current, 0, s),
      placed: card,
      rest,
      round: s.currentRound,
      hand: s.handNumber,
      next: null,
      before: s,
    });
    setAndPersist(next);
    // RULES.md Law 8: the last cards land and the line holds before play moves on.
    if (rest.length > 0) advanceLater(next, landingMs(rest.length));
    else void advanceRef.current(next);
  }, [setAndPersist, recordMove]);

  const doRemoveFromCombo = useCallback((cardId: string) => {
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return;
    const combo = {
      base: s.combination.base?.id === cardId ? null : s.combination.base,
      combo1: s.combination.combo1.filter((g) => g.card.id !== cardId),
      combo2: s.combination.combo2.filter((g) => g.card.id !== cardId),
      combo3: s.combination.combo3.filter((g) => g.card.id !== cardId),
    };
    const next = { ...s, combination: combo };
    setAndPersist(next);
  }, [setAndPersist]);

  const doResetCombo = useCallback(() => {
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return;
    const next = resetCombination(s);
    setAndPersist(next);
  }, [setAndPersist]);

  function doContinueRound() {
    const s = stateRef.current;
    if (s.gamePhase !== 'roundEnd') return;
    const next = startNewRound(s, prngRef.current);
    setAndPersist(next);
    recordMove(null);
    if (next.currentPlayer !== 0) {
      void runBotTurn(next);
    }
  }

  const isPlayerTurn =
    state.currentPlayer === 0 && !botBusyRef.current && !gameOver;

  return {
    state,
    isPlayerTurn,
    botViz,
    botCombo,
    // The last move, under the name App.tsx has passed to GameView since
    // before release 2 (App.tsx is outside this part's fence).
    lastCapture: lastMove,
    jackpotInfo,
    gameOver,
    wasResumed: wasResumedRef.current,
    // The game seed (S-006): the save's own for a resumed game, the seed prop for a new one.
    seed: mount.seed,
    actions: {
      addToCombo,
      removeFromCombo: doRemoveFromCombo,
      submitCombo,
      placeCard: doPlaceCard,
      resetCombo: doResetCombo,
      continueRound: doContinueRound,
    } as GameActions,
  };
}

// ─── Board reads (D-007 release 2) ─────────────────
// Pure functions over the game state for the board. The screen reaches the
// game only through this file (architecture rule 1), so they live here, and
// GameView calls them with the values App.tsx hands it.

const FACE_RANKS = new Set<Rank>(['J', 'Q', 'K']);
const SUIT_GLYPHS: Record<Suit, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

/** A card in words: "6♥", "J♣". */
export function cardLabel(card: Card): string {
  return card.rank + SUIT_GLYPHS[card.suit];
}

/** A card's points from the scoring table (RULES.md). */
export function cardPoints(card: Card): number {
  return calculateCardPoints(card);
}

/** An opponent's name, from the personality in its seat. */
export function opponentName(state: GameState, player: 1 | 2): string {
  const difficulty = player === 1 ? state.settings.bot1Personality : state.settings.bot2Personality;
  return getPersonalityProfile(difficulty).name;
}

/** A player's name in a sentence: "You", "Nina", "Rex". */
export function playerName(state: GameState, player: PlayerIndex): string {
  return player === 0 ? 'You' : opponentName(state, player);
}

function stagedCards(build: Combination): Card[] {
  const cards = build.base ? [build.base] : [];
  for (const slot of [build.combo1, build.combo2, build.combo3]) {
    for (const g of slot) cards.push(g.card);
  }
  return cards;
}

function hasStaged(build: Combination): boolean {
  return build.base !== null || build.combo1.length > 0 || build.combo2.length > 0 || build.combo3.length > 0;
}

/** The points preview beside SUBMIT: the scoring table's points of every
 *  staged card, base included (RULES.md Law 6). */
export function stagedPoints(build: Combination): number {
  return calculateCardsPoints(stagedCards(build));
}

/** Where a build's base came from: the current player's hand or the table. */
export function baseSourceOf(state: GameState, build: Combination): CardSource | null {
  if (!build.base) return null;
  const id = build.base.id;
  return state.hands[state.currentPlayer].some((c) => c.id === id) ? 'hand' : 'board';
}

/** A filled combo is valid when it matches the base or sums to it (RULES.md
 *  Laws 2, 4, 5) and holds a card from the other side of the base (Law 3). */
export function comboIsValid(state: GameState, build: Combination, slot: Exclude<ComboSlot, 'base'>): boolean {
  const groups = build[slot];
  if (!build.base || groups.length === 0) return false;
  if (!validateComboSlot(groups, build.base).isValid) return false;
  const baseSide = baseSourceOf(state, build);
  return groups.some((g) => g.source !== baseSide);
}

/** While you build, a table card no combo could use (GB2, rulings 19 and 23b):
 *  the base is K, Q or J and the card's rank differs; the base is a number
 *  card and the card is K, Q or J; or the base is a number card and the
 *  card's value is above the base's with a different rank. Hand cards are
 *  never shaded. */
export function cannotJoin(base: Card, card: Card): boolean {
  if (FACE_RANKS.has(base.rank)) return card.rank !== base.rank;
  if (FACE_RANKS.has(card.rank)) return true;
  return card.value > base.value && card.rank !== base.rank;
}

/** The ids of the table cards shaded during your build; empty without a base. */
export function tableCardsThatCannotJoin(state: GameState): Set<string> {
  const base = state.combination.base;
  if (!base) return new Set();
  return new Set(state.board.filter((c) => cannotJoin(base, c)).map((c) => c.id));
}

export interface TakeTheTableRead {
  /** In line to take it now: the round's last capturer so far. */
  player: PlayerIndex;
  cards: Card[];
  points: number;
}

/** RULES.md Law 10 in the last hand (the deck is empty): who is in line to take
 *  the table and what it is worth. Null outside the last hand, and null when
 *  nobody has captured this round (nobody takes the table). */
export function takeTheTable(state: GameState): TakeTheTableRead | null {
  if (state.gamePhase !== 'playing' || state.deck.length > 0 || state.lastCapturer === null) return null;
  return { player: state.lastCapturer, cards: state.board, points: calculateCardsPoints(state.board) };
}

// The message line's words (D-007 ruling 95). Names, counts, cards and hand
// numbers follow the game.
const LINE = {
  yourTurn: 'Your turn. Pick a base card to start a capture.',
  baseFromHand: 'Base from your hand: every combo you fill needs a table card.',
  baseFromTable: 'Base from the table: every combo you fill needs a card from your hand.',
  kings: 'Kings, queens and jacks only match their own kind.',
  mixed: 'Each combo matches the base or sums to it, never both.',
  aces: 'Aces count as 1 in a sum.',
  tens: '10s sum like any number.',
  lastHand: 'Last hand: the deck is empty. When the round ends, the last player to capture takes every card left on the table.',
} as const;

function article(rank: Rank): string {
  return rank === '8' || rank === 'A' ? 'an' : 'a';
}

function buildLine(state: GameState, build: Combination): string {
  const base = build.base!;
  const filled = [build.combo1, build.combo2, build.combo3].filter((s) => s.length > 0);
  const baseSide = baseSourceOf(state, build);
  const sourceLine = baseSide === 'hand' ? LINE.baseFromHand : LINE.baseFromTable;
  // (a) a combo mixes a match and a sum
  if (filled.some((s) => s.some((g) => g.card.rank === base.rank) && s.some((g) => g.card.rank !== base.rank))) return LINE.mixed;
  // (b) the base is K, Q or J
  if (FACE_RANKS.has(base.rank)) return LINE.kings;
  // (c) a filled combo has no card from the other side of the base
  if (filled.some((s) => !s.some((g) => g.source !== baseSide))) return sourceLine;
  // (d) an ace sits in a combo whose base isn't an ace
  if (base.rank !== 'A' && filled.some((s) => s.some((g) => g.card.rank === 'A'))) return LINE.aces;
  // (e) the base is a 10
  if (base.rank === '10') return LINE.tens;
  // (f) otherwise, where the base came from
  return sourceLine;
}

// RULES.md Law 8, for the player who placed last.
function lastCardsLine(state: GameState, last: LastMove): string {
  const others = ([0, 1, 2] as PlayerIndex[]).filter((p) => p !== last.player).map((p) => playerName(state, p));
  const placer = playerName(state, last.player);
  const whose = last.player === 0 ? 'your' : `${placer}'s`;
  const rest = last.rest.map(cardLabel).join(', ');
  return `${others[0]} and ${others[1]} are out of cards. ${placer} placed ${cardLabel(last.placed!)}, so the rest of ${whose} hand (${rest}) goes onto the table. Hand ${last.hand} is over.`;
}

/** The message line (D-007 ruling 95): the rule that matters now, from the
 *  game state, the build in the tray, the last move and the opponent's
 *  capture on show. First match wins, in this order:
 *  1. the last cards (RULES.md Law 8), until the next hand is dealt;
 *  2. after your move, until you stage a card or the next player moves;
 *  3. an opponent's capture replays;
 *  4. while you build: mixed, kings, base source, aces, 10s, base source;
 *  5. the last hand;
 *  6. whose turn it is. */
export function messageLine(state: GameState, build: Combination, last: LastMove | null, replay: BotComboDisplay | null): string {
  const sameHand = last !== null && last.round === state.currentRound && last.hand === state.handNumber;

  // 1. The last cards, from the moment Law 8 places the rest of a hand until the next hand is dealt.
  if (last && sameHand && last.placed && last.rest.length > 0) {
    return lastCardsLine(state, last);
  }

  // 2. After your move, until you stage a card or the next player moves.
  if (last && sameHand && last.player === 0 && !hasStaged(build)) {
    if (last.placed) {
      return `You placed ${article(last.placed.rank)} ${last.placed.rank}. Placing ends your turn; there is no pass.`;
    }
    const held = state.hands[0].length;
    if (held > 0) return `Your turn continues: you still hold ${held} ${held === 1 ? 'card' : 'cards'}.`;
    if (last.next !== null) return `Your turn ends: your hand is empty. ${playerName(state, last.next)} is next.`;
  }

  // 3. An opponent's capture replays.
  // A bot's base is always its hand card (botCaptureToCombination).
  if (replay && replay.playerIndex !== 0) {
    return `Base from ${opponentName(state, replay.playerIndex)}'s hand: every combo has a table card.`;
  }

  // 4. While you build.
  if (build.base && state.currentPlayer === 0) return buildLine(state, build);

  // 5. The last hand.
  if (state.gamePhase === 'playing' && state.deck.length === 0) return LINE.lastHand;

  // 6. Whose turn it is.
  return state.currentPlayer === 0 ? LINE.yourTurn : `${opponentName(state, state.currentPlayer)}'s turn.`;
}
