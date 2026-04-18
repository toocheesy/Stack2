import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ComboSlot,
  GameSettings,
  GameState,
  PlayerIndex,
  ValidatedCapture,
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
import { validateFullCombo } from '../engine/core/captureValidator';
import { determineTurnResult } from '../engine/core/turnManager';
import { createPRNG, type PRNG } from '../engine/utils/prng';
import { createIdGenerator, type IdGenerator } from '../engine/utils/uuid';
import {
  createCardTracker,
  recordCapture,
  recordPlacement,
  type CardTrackerState,
} from '../engine/ai/cardTracker';
import { decideBotAction, getBotThinkingDelay, getPersonalityProfile } from '../engine/ai/botDecision';
import { evaluateAllActions } from '../engine/ai/evaluator';

type CardSource = 'hand' | 'board';

export interface GameActions {
  addToCombo: (cardId: string, source: CardSource, slot: ComboSlot) => void;
  submitCombo: () => string | null;
  placeCard: (cardId: string) => void;
  resetCombo: () => void;
}

export interface BotVizStep {
  type: 'thinking' | 'done';
  playerIndex: PlayerIndex;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function useGameController(seed: number, settings: GameSettings) {
  const prngRef = useRef<PRNG>(null!);
  const idGenRef = useRef<IdGenerator>(null!);
  const trackerRef = useRef<CardTrackerState>(null!);
  const botBusyRef = useRef(false);
  const mountedRef = useRef(true);

  // Initialize refs once
  if (prngRef.current === null) {
    prngRef.current = createPRNG(seed);
    idGenRef.current = createIdGenerator(createPRNG(seed + 1000));
    trackerRef.current = createCardTracker();
  }

  const [state, setState] = useState<GameState>(() => {
    const initial = createInitialState(settings, prngRef.current, idGenRef.current);
    // Seed tracker with initial board cards so AI has context from turn 1
    for (const card of initial.board) {
      trackerRef.current = recordPlacement(trackerRef.current, card);
    }
    return initial;
  });
  const [botViz, setBotViz] = useState<BotVizStep | null>(null);
  const [gameOver, setGameOver] = useState<{
    winner: PlayerIndex;
    winnerName: string;
  } | null>(null);

  // Always-fresh ref to current state (avoids stale closures)
  const stateRef = useRef(state);
  stateRef.current = state;

  // ─── Core flow: advance after any action ──────────

  const advanceRef = useRef<(s: GameState) => Promise<void>>(null!);

  advanceRef.current = async (current: GameState) => {
    if (!mountedRef.current) return;
    const result = determineTurnResult(current);

    switch (result.type) {
      case 'CONTINUE_TURN': {
        const next = { ...current, currentPlayer: result.nextPlayer };
        setState(next);
        stateRef.current = next;
        if (result.nextPlayer !== 0) {
          await runBotTurn(next);
        }
        break;
      }
      case 'DEAL_NEW_HAND': {
        let next = dealNewHand(current);
        next = { ...next, currentPlayer: result.startingPlayer };
        setState(next);
        stateRef.current = next;
        if (result.startingPlayer !== 0) {
          await runBotTurn(next);
        }
        break;
      }
      case 'END_ROUND': {
        const boardBefore = current.board.slice();
        const { state: afterJackpot, jackpotResult } = applyJackpot(current);
        if (jackpotResult) {
          trackerRef.current = recordCapture(
            trackerRef.current,
            jackpotResult.player,
            boardBefore,
          );
        }
        setState(afterJackpot);
        stateRef.current = afterJackpot;
        await wait(1500);
        if (!mountedRef.current) return;
        const next = startNewRound(
          afterJackpot,
          prngRef.current,
          idGenRef.current,
        );
        setState(next);
        stateRef.current = next;
        if (next.currentPlayer !== 0) {
          await runBotTurn(next);
        }
        break;
      }
      case 'END_GAME': {
        const boardBefore = current.board.slice();
        const { state: afterJackpot, jackpotResult } = applyJackpot(current);
        if (jackpotResult) {
          trackerRef.current = recordCapture(
            trackerRef.current,
            jackpotResult.player,
            boardBefore,
          );
        }
        setState(afterJackpot);
        stateRef.current = afterJackpot;
        setGameOver({
          winner: result.winner,
          winnerName: result.winnerName,
        });
        break;
      }
    }
  };

  // ─── Bot turn execution ───────────────────────────

  async function runBotTurn(current: GameState): Promise<void> {
    if (!mountedRef.current || botBusyRef.current) return;
    const player = current.currentPlayer;
    if (player === 0) return;
    if (current.hands[player].length === 0) {
      // Bot has no cards — advance immediately
      await advanceRef.current(current);
      return;
    }

    botBusyRef.current = true;
    setBotViz({ type: 'thinking', playerIndex: player });

    const difficulty =
      player === 1
        ? current.settings.bot1Personality
        : current.settings.bot2Personality;

    const delay = getBotThinkingDelay(difficulty, prngRef.current);
    await wait(delay);
    if (!mountedRef.current) return;

    // ── AI diagnostic logging ──
    const profile = getPersonalityProfile(difficulty);
    const allActions = evaluateAllActions(
      current,
      player,
      trackerRef.current,
      profile.weights,
      { allowMultiSlot: profile.allowMultiSlot },
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

    const decision = decideBotAction(
      current,
      player,
      difficulty,
      trackerRef.current,
      prngRef.current,
    );

    console.log(
      `  → CHOSEN: ${decision.action} ${decision.handCard.rank}${decision.handCard.suit[0]} ` +
      `score=${decision.score.total.toFixed(1)} | ${decision.reasoning}`,
    );

    let next: GameState;
    if (decision.action === 'capture' && decision.captureDetails) {
      const vc: ValidatedCapture = {
        allCapturedCards: decision.captureDetails.capturedCards,
        totalPoints: decision.captureDetails.totalPoints,
      };
      next = executeCapture(current, vc);
      trackerRef.current = recordCapture(
        trackerRef.current,
        player,
        decision.captureDetails.capturedCards,
      );
    } else {
      next = placeCard(current, decision.handCard.id);
      trackerRef.current = recordPlacement(
        trackerRef.current,
        decision.handCard,
      );
    }

    setState(next);
    stateRef.current = next;
    setBotViz(null);
    botBusyRef.current = false;

    await wait(400);
    if (!mountedRef.current) return;
    await advanceRef.current(next);
  }

  // ─── Initial bot turn on mount ────────────────────

  useEffect(() => {
    mountedRef.current = true;
    if (state.currentPlayer !== 0 && !botBusyRef.current && !gameOver) {
      void runBotTurn(state);
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          combo.base?.id === cardId ||
          [...combo.combo1, ...combo.combo2, ...combo.combo3].some(
            (g) => g.card.id === cardId,
          );
        if (already) return;
        const idx =
          source === 'hand'
            ? s.hands[0].findIndex((c) => c.id === cardId)
            : s.board.findIndex((c) => c.id === cardId);
        combo[slot] = combo[slot].concat([
          { card, source, originalIndex: idx },
        ]);
      }

      const next = { ...s, combination: combo };
      setState(next);
      stateRef.current = next;
    },
    [],
  );

  const submitCombo = useCallback((): string | null => {
    if (botBusyRef.current) return 'Not your turn';
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return 'Not your turn';

    const validation = validateFullCombo(s);
    if (!validation.isValid) return validation.errors[0] ?? 'Invalid combo';

    const vc: ValidatedCapture = {
      allCapturedCards: validation.allCapturedCards,
      totalPoints: validation.totalPoints,
    };
    const next = executeCapture(s, vc);
    trackerRef.current = recordCapture(
      trackerRef.current,
      0,
      validation.allCapturedCards,
    );
    setState(next);
    stateRef.current = next;
    void advanceRef.current(next);
    return null;
  }, []);

  const doPlaceCard = useCallback((cardId: string) => {
    if (botBusyRef.current) return;
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return;
    const card = s.hands[0].find((c) => c.id === cardId);
    if (!card) return;

    let next = resetCombination(s);
    next = placeCard(next, cardId);
    trackerRef.current = recordPlacement(trackerRef.current, card);
    setState(next);
    stateRef.current = next;
    void advanceRef.current(next);
  }, []);

  const doResetCombo = useCallback(() => {
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return;
    const next = resetCombination(s);
    setState(next);
    stateRef.current = next;
  }, []);

  const isPlayerTurn =
    state.currentPlayer === 0 && !botBusyRef.current && !gameOver;

  return {
    state,
    isPlayerTurn,
    botViz,
    gameOver,
    actions: {
      addToCombo,
      submitCombo,
      placeCard: doPlaceCard,
      resetCombo: doResetCombo,
    } as GameActions,
  };
}
