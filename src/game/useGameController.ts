import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Card,
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
import { decideBotAction, getBotThinkingDelay } from '../engine/ai/botDecision';
import type { BotDecision } from '../engine/ai/botDecision';

type CardSource = 'hand' | 'board';

export interface GameActions {
  addToCombo: (cardId: string, source: CardSource, slot: ComboSlot) => void;
  submitCombo: () => string | null;
  placeCard: (cardId: string) => void;
  resetCombo: () => void;
}

export interface BotVizStep {
  type: 'thinking' | 'card-to-slot' | 'hold' | 'done';
  playerIndex: PlayerIndex;
  card?: Card;
  slot?: ComboSlot;
}

export function useGameController(seed: number, settings: GameSettings) {
  const prngRef = useRef<PRNG>(createPRNG(seed));
  const idGenRef = useRef<IdGenerator>(createIdGenerator(createPRNG(seed + 1000)));
  const trackerRef = useRef<CardTrackerState>(createCardTracker());
  const runningRef = useRef(true);

  const [state, setState] = useState<GameState>(() =>
    createInitialState(settings, prngRef.current, idGenRef.current),
  );
  const [botBusy, setBotBusy] = useState(false);
  const [botViz, setBotViz] = useState<BotVizStep | null>(null);
  const [gameOver, setGameOver] = useState<{
    winner: PlayerIndex;
    winnerName: string;
  } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const wait = useCallback(
    (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    [],
  );

  const advance = useCallback(
    async (current: GameState) => {
      if (!runningRef.current) return;
      const result = determineTurnResult(current);
      switch (result.type) {
        case 'CONTINUE_TURN': {
          const next = { ...current, currentPlayer: result.nextPlayer };
          setState(next);
          if (result.nextPlayer !== 0) {
            await runBot(next);
          }
          break;
        }
        case 'DEAL_NEW_HAND': {
          let next = dealNewHand(current);
          next = { ...next, currentPlayer: result.startingPlayer };
          setState(next);
          if (result.startingPlayer !== 0) {
            await runBot(next);
          }
          break;
        }
        case 'END_ROUND': {
          const boardBefore = current.board.slice();
          const { state: afterJackpot, jackpotResult } = applyJackpot(current);
          let s = afterJackpot;
          if (jackpotResult) {
            trackerRef.current = recordCapture(
              trackerRef.current,
              jackpotResult.player,
              boardBefore,
            );
          }
          setState(s);
          await wait(1500);
          if (!runningRef.current) return;
          s = startNewRound(s, prngRef.current, idGenRef.current);
          setState(s);
          if (s.currentPlayer !== 0) {
            await runBot(s);
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
          setGameOver({ winner: result.winner, winnerName: result.winnerName });
          break;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runBot = useCallback(
    async (current: GameState) => {
      if (!runningRef.current) return;
      const player = current.currentPlayer;
      if (player === 0) return;
      setBotBusy(true);

      const difficulty =
        player === 1
          ? current.settings.bot1Personality
          : current.settings.bot2Personality;

      setBotViz({ type: 'thinking', playerIndex: player });
      const delay = getBotThinkingDelay(difficulty, prngRef.current);
      await wait(delay);
      if (!runningRef.current) return;

      const decision: BotDecision = decideBotAction(
        current,
        player,
        difficulty,
        trackerRef.current,
        prngRef.current,
      );

      setBotViz({ type: 'done', playerIndex: player });

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
      setBotViz(null);
      setBotBusy(false);
      await wait(300);
      if (!runningRef.current) return;
      await advance(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Kick off bot on initial load if it's not player's turn
  useEffect(() => {
    if (state.currentPlayer !== 0 && !botBusy && !gameOver) {
      void runBot(state);
    }
    return () => {
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToCombo = useCallback(
    (cardId: string, source: CardSource, slot: ComboSlot) => {
      const s = stateRef.current;
      if (s.currentPlayer !== 0 || botBusy) return;
      const card =
        source === 'hand'
          ? s.hands[s.currentPlayer].find((c) => c.id === cardId)
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
        const idx =
          source === 'hand'
            ? s.hands[s.currentPlayer].findIndex((c) => c.id === cardId)
            : s.board.findIndex((c) => c.id === cardId);
        const already =
          combo.base?.id === cardId ||
          [...combo.combo1, ...combo.combo2, ...combo.combo3].some(
            (g) => g.card.id === cardId,
          );
        if (already) return;
        combo[slot] = combo[slot].concat([
          { card, source, originalIndex: idx },
        ]);
      }
      setState({ ...s, combination: combo });
    },
    [botBusy],
  );

  const submitCombo = useCallback((): string | null => {
    const s = stateRef.current;
    if (s.currentPlayer !== 0 || botBusy) return 'Not your turn';
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
    void advance(next);
    return null;
  }, [botBusy, advance]);

  const doPlaceCard = useCallback(
    (cardId: string) => {
      const s = stateRef.current;
      if (s.currentPlayer !== 0 || botBusy) return;
      const card = s.hands[0].find((c) => c.id === cardId);
      if (!card) return;
      let next = resetCombination(s);
      next = placeCard(next, cardId);
      trackerRef.current = recordPlacement(trackerRef.current, card);
      setState(next);
      void advance(next);
    },
    [botBusy, advance],
  );

  const doResetCombo = useCallback(() => {
    const s = stateRef.current;
    if (s.currentPlayer !== 0) return;
    setState(resetCombination(s));
  }, []);

  const actions: GameActions = {
    addToCombo,
    submitCombo,
    placeCard: doPlaceCard,
    resetCombo: doResetCombo,
  };

  const isPlayerTurn = state.currentPlayer === 0 && !botBusy && !gameOver;

  return { state, isPlayerTurn, botBusy, botViz, gameOver, actions };
}
