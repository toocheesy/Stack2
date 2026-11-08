import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Card, ComboSlot, Difficulty, GameState, PlayerIndex } from '../engine/types';
import { getTransition } from '../config/motion';
import type { GameActions, BotVizStep, BotComboDisplay, LastCaptureInfo } from '../game/useGameController';
import { CardComponent, HAND_CARD_RING, HAND_CARD_W, TABLE_CARD_W } from './Card';
import { RoundEndOverlay } from './RoundEndOverlay';
import { JackpotCelebration, type JackpotDisplay } from './JackpotCelebration';
import { GameOverOverlay } from './GameOverOverlay';
import { validateFullCombo } from '../engine/core/captureValidator';
import { TutorialOverlay, type TutorialMark } from './TutorialOverlay';
import type { TutorialApi } from '../tutorial/useTutorial';
import { C, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';

type CardSource = 'hand' | 'board';

interface Props {
  state: GameState;
  isPlayerTurn: boolean;
  botViz: BotVizStep | null;
  botCombo: BotComboDisplay | null;
  lastCapture: LastCaptureInfo | null;
  jackpotInfo: JackpotDisplay | null;
  currentLevelId?: number | null;
  gameOver: { winner: number; winnerName: string } | null;
  actions: GameActions;
  onQuit: () => void;
  onHome: () => void;
  onPlayAgain: () => void;
  onOpenSettings: () => void;
  // The Run tutorial — state lives in GameWrapper so useGameController
  // can see tutorialActive from its first render (freeze ticket). GameView
  // just renders the overlay and consults visible for ghost SUBMIT/RESET.
  tutorial: TutorialApi;
  // When an Adventure overlay (LevelCompleteOverlay etc.) is
  // showing from App.tsx, suppress the in-game toast layer. App passes
  // !!levelComplete here so the toast logic doesn't need to know about
  // overlays it can't directly observe.
  suppressToasts?: boolean;
}

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const SLOT_LABELS: Record<ComboSlot, string> = {
  base: 'BASE', combo1: 'COMBO 1', combo2: 'COMBO 2', combo3: 'COMBO 3',
};

// Bot colours (STACKED v2): Nina azure, Rex wisteria; Calvin and Jett have no colour yet (line).
const PLAYER_COLORS: Record<Difficulty, { color: string; name: string }> = {
  beginner:     { color: C.line.classic, name: 'Calvin' },
  intermediate: { color: C.botAzure, name: 'Nina' },
  advanced:     { color: C.botWisteria, name: 'Rex' },
  expert:       { color: C.line.classic, name: 'Jett' },
};

const BOARD_GAP = 4;
// The hand rule (D-007 ruling 92). The engine deals four cards a hand
// (src/engine/core/gameState.ts); this much table shows between two hand
// cards' rings; and this much of the screen's width sits beside the hand row:
// the zone's 16px padding, the 8px gap, the 72px YOU block, the hand panel's
// 8px padding and its 3px active border on each side.
const HAND_SIZE = 4;
const HAND_RING_CLEARANCE = 2;
const HAND_ROW_CHROME = 16 + 8 + 72 + 8 + 6;

export function GameView({
  state, isPlayerTurn, botViz, botCombo, lastCapture, jackpotInfo, currentLevelId, gameOver, actions, onQuit, onHome, onPlayAgain, onOpenSettings, tutorial, suppressToasts = false,
}: Props) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  // Tutorial zone refs (boardRef above doubles as the Table mark).
  const headerRef = useRef<HTMLDivElement | null>(null);
  const msgStripRef = useRef<HTMLDivElement | null>(null);
  const botZonesRef = useRef<HTMLDivElement | null>(null);
  const comboBuilderRef = useRef<HTMLDivElement | null>(null);
  const submitWrapRef = useRef<HTMLDivElement | null>(null);
  const resetWrapRef = useRef<HTMLDivElement | null>(null);
  const handZoneRef = useRef<HTMLDivElement | null>(null);

  // Ghost-render SUBMIT/RESET while the tutorial is up so marks 4 and 5
  // have something visible to spotlight (the real buttons only render
  // when the player has built a combo).
  const tutorialShowGhostActions = tutorial.visible;
  const [error, setError] = useState<string | null>(null);
  // Drag is the only path into the builder; taps on cards do nothing.
  const [hoveredSlot, setHoveredSlot] = useState<ComboSlot | null>(null);
  const [hoveredBoard, setHoveredBoard] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [, setDraggingSource] = useState<CardSource | null>(null);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const lastHitRef = useRef(0);

  const stagedIds = useMemo(() => {
    const ids = new Set<string>();
    if (state.combination.base) ids.add(state.combination.base.id);
    for (const g of state.combination.combo1) ids.add(g.card.id);
    for (const g of state.combination.combo2) ids.add(g.card.id);
    for (const g of state.combination.combo3) ids.add(g.card.id);
    if (botCombo) {
      ids.add(botCombo.baseCard.id);
      for (const c of botCombo.comboCards) ids.add(c.id);
    }
    return ids;
  }, [state.combination, botCombo]);

  const visibleBoard = useMemo(() => state.board.filter((c) => !stagedIds.has(c.id)), [state.board, stagedIds]);
  const visibleHand = useMemo(() => state.hands[0].filter((c) => !stagedIds.has(c.id)), [state.hands, stagedIds]);
  const hasCombo = state.combination.base !== null || state.combination.combo1.length > 0 || state.combination.combo2.length > 0 || state.combination.combo3.length > 0;
  const comboValid = useMemo(() => hasCombo && validateFullCombo(state).isValid, [state, hasCombo]);
  const target = state.settings.targetScore;
  const bot1 = PLAYER_COLORS[state.settings.bot1Personality];
  const bot2 = PLAYER_COLORS[state.settings.bot2Personality];
  const deckEmpty = state.deck.length === 0 && state.gamePhase === 'playing';

  const bot1HandVisible = botCombo?.playerIndex === 1 ? state.hands[1].filter(c => c.id !== botCombo.baseCard.id) : state.hands[1];
  const bot2HandVisible = botCombo?.playerIndex === 2 ? state.hands[2].filter(c => c.id !== botCombo.baseCard.id) : state.hands[2];

  // Active-turn glow gates on gamePhase. Glow MUST clear when
  // gamePhase moves to roundEnd / jackpot / gameOver so the overlay messaging
  // doesn't compete with a leftover active-player highlight.
  const inPlay = state.gamePhase === 'playing';
  const playerActive = inPlay && state.currentPlayer === 0;
  const bot1Active = inPlay && state.currentPlayer === 1;
  const bot2Active = inPlay && state.currentPlayer === 2;

  // Score-state escalation. Once a player crosses 80% of target,
  // their score number transitions ink → the accent over ~500ms ease-in. Scores are
  // monotonic within a round, so the boolean naturally resets when scores
  // reset for the next round (round-boundary clear).
  const escalateThreshold = target * 0.8;
  const playerEscalated = state.overallScores.player >= escalateThreshold;
  const bot1Escalated = state.overallScores.bot1 >= escalateThreshold;
  const bot2Escalated = state.overallScores.bot2 >= escalateThreshold;

  // ── Hit testing ─────────────────────────────────────

  const findDropTarget = useCallback((point: { x: number; y: number }): { type: 'slot'; slot: ComboSlot } | { type: 'board' } | null => {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom)
        return { type: 'slot', slot: SLOT_KEYS[i] };
    }
    const bel = boardRef.current;
    if (bel) {
      const r = bel.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom)
        return { type: 'board' };
    }
    return null;
  }, []);

  const handleDragMove = useCallback((point: { x: number; y: number }, source: CardSource) => {
    const now = Date.now();
    if (now - lastHitRef.current < 50) return;
    lastHitRef.current = now;
    const t = findDropTarget(point);
    if (t?.type === 'slot') { setHoveredSlot(t.slot); setHoveredBoard(false); }
    else if (t?.type === 'board' && source === 'hand') { setHoveredSlot(null); setHoveredBoard(true); }
    else { setHoveredSlot(null); setHoveredBoard(false); }
  }, [findDropTarget]);

  const handleDragStart = useCallback((cardId: string, source: CardSource) => {
    setDraggingCardId(cardId);
    setDraggingSource(source);
  }, []);

  const handleDragEnd = useCallback((cardId: string, source: CardSource, point: { x: number; y: number }) => {
    setHoveredSlot(null); setHoveredBoard(false); setDraggingCardId(null); setDraggingSource(null);
    if (!isPlayerTurn) return;
    const t = findDropTarget(point);
    if (!t) return;
    if (t.type === 'slot') actions.addToCombo(cardId, source, t.slot);
    else if (t.type === 'board' && source === 'hand') actions.placeCard(cardId);
  }, [isPlayerTurn, findDropTarget, actions]);

  const handleStagedCardTap = useCallback((cardId: string) => {
    if (!isPlayerTurn) return;
    actions.removeFromCombo(cardId);
  }, [isPlayerTurn, actions]);

  const handleSubmit = useCallback(() => {
    const err = actions.submitCombo();
    if (err) { setError(err); setTimeout(() => setError(null), 2000); }
  }, [actions]);

  // ── Table card scaling (6 across) ─────────────────
  // Six table cards (54 x 76) across; scaled down only when they don't fit, never above 1.

  const boardCardScale = useMemo(() => {
    if (visibleBoard.length === 0) return 1;
    const avail = typeof window !== 'undefined' ? window.innerWidth - 24 : 350;
    const perRow = 6;
    const maxW = (avail - BOARD_GAP * (perRow - 1)) / perRow;
    const scale = Math.min(1, maxW / TABLE_CARD_W);
    return Math.max(0.55, scale);
  }, [visibleBoard.length]);

  // ── Hand card fit (D-007 ruling 92) ───────────────
  // The hand card is drawn at the largest size that fits today's row, in its
  // exact 72:100 shape, never above 72 x 100, with the rings of neighbouring
  // cards apart: four cards, three gaps of two rings plus the clearance, and
  // a ring at each end. Its exact 72 x 100 arrives with release 2's layout.

  const handFit = useMemo(() => {
    const rowWidth = (typeof window !== 'undefined' ? window.innerWidth : 390) - HAND_ROW_CHROME;
    const perScale = HAND_SIZE * HAND_CARD_W + (HAND_SIZE - 1) * 2 * HAND_CARD_RING + 2 * HAND_CARD_RING;
    const scale = Math.min(1, (rowWidth - (HAND_SIZE - 1) * HAND_RING_CLEARANCE) / perScale);
    return { scale, gap: 2 * HAND_CARD_RING * scale + HAND_RING_CLEARANCE };
  }, []);

  // ── Combo display ─────────────────────────────────

  const displayCombo = useMemo((): { base: Card | null; slots: Card[][] } => {
    if (botCombo) {
      return { base: botCombo.baseCard, slots: [botCombo.comboCards.slice(0, 3), botCombo.comboCards.slice(3, 6), botCombo.comboCards.slice(6)] };
    }
    return {
      base: state.combination.base,
      slots: [state.combination.combo1.map(g => g.card), state.combination.combo2.map(g => g.card), state.combination.combo3.map(g => g.card)],
    };
  }, [state.combination, botCombo]);

  // ── Persistent strip content (LAST capture echo) ──
  // Empty when no capture has happened yet; the header carries
  // round info so we don't need to repeat it here.

  const persistentMessage = useMemo(() => {
    if (!lastCapture) return null;
    const base = lastCapture.baseCard?.rank ?? '';
    const areas = lastCapture.areas.map(a => a.map(c => c.rank).join('+')).join(' · ');
    return { prefix: 'LAST · ', equation: `${base} = ${areas}` };
  }, [lastCapture]);

  // ── Adventure hint copy (routed through toast layer below) ──

  const hintText = useMemo(() => {
    if (!state.settings.hintStripEnabled) return null;
    if (state.gamePhase !== 'playing') return null;
    if (!isPlayerTurn) return 'Watch the opponents play their turn';
    if (hasCombo && !comboValid) return 'Combo groups must sum (or match) the base card value';
    if (hasCombo && comboValid) return 'Tap SUBMIT to capture, or RESET to clear';
    return 'Drag a card to start your turn';
  }, [state.settings.hintStripEnabled, state.gamePhase, isPlayerTurn, hasCombo, comboValid]);

  // ── Toast layer state machine ──
  // Three toast kinds:
  //   - celebration: 2s, +pts · NICE COMBO, the accent
  //   - transition:  3s, R[N] · FRESH DECK, ink
  //   - hint:        persistent until cleared by player action / interrupt
  // Priority: celebration > transition > hint > none. Higher preempts lower.
  // Suppressed entirely whenever an overlay (RoundEnd/Jackpot/GameOver/
  // LevelComplete) is showing.

  type TransientKind = 'celebration' | 'transition';
  type Transient = { kind: TransientKind; text: string; color: string; expires: number };
  const [transient, setTransient] = useState<Transient | null>(null);
  const lastCaptureTsRef = useRef<number>(lastCapture?.timestamp ?? 0);
  const lastSeenRoundRef = useRef<number>(state.currentRound);

  const isOverlaySuppressing =
    state.gamePhase !== 'playing' ||
    !!jackpotInfo ||
    !!gameOver ||
    suppressToasts;

  // Score Celebration on new capture timestamps.
  useEffect(() => {
    if (!lastCapture) return;
    if (lastCapture.timestamp === lastCaptureTsRef.current) return;
    lastCaptureTsRef.current = lastCapture.timestamp;
    if (isOverlaySuppressing) return;
    setTransient({
      kind: 'celebration',
      text: `+${lastCapture.points} · NICE COMBO`,
      color: C.accent.classic,
      expires: Date.now() + 2000,
    });
  }, [lastCapture, isOverlaySuppressing]);

  // Round Transition on round increment (skip the initial round). Does not
  // preempt an active Score Celebration (celebration is higher priority).
  useEffect(() => {
    if (state.currentRound === lastSeenRoundRef.current) return;
    lastSeenRoundRef.current = state.currentRound;
    if (state.currentRound <= 1 || isOverlaySuppressing) return;
    setTransient((prev) => {
      if (prev?.kind === 'celebration') return prev;
      return {
        kind: 'transition',
        text: `R${state.currentRound} · FRESH DECK`,
        color: C.ink.classic,
        expires: Date.now() + 3000,
      };
    });
  }, [state.currentRound, isOverlaySuppressing]);

  // Auto-clear expired transients.
  useEffect(() => {
    if (!transient) return;
    const ms = Math.max(0, transient.expires - Date.now());
    const t = setTimeout(() => setTransient(null), ms);
    return () => clearTimeout(t);
  }, [transient]);

  // Resolve which toast wins (transient first, hint as fallback). null when
  // suppressed or nothing to show.
  const activeToast = useMemo<{ kind: TransientKind | 'hint'; text: string; color: string } | null>(() => {
    if (isOverlaySuppressing) return null;
    if (transient) return transient;
    if (hintText) return { kind: 'hint', text: hintText, color: alpha(C.accent.classic, 0.9) };
    return null;
  }, [isOverlaySuppressing, transient, hintText]);

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: C.ground.classic,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', touchAction: 'none',
      fontFamily: FONTS.sans,
    }}>

      {/* ═══ ZONE A — HEADER BAR ═══
            Header polish (May 14 follow-up) — 4-segment format with
            restored STACKED! wordmark: MODE · TARGET/LEVEL · R[N] · H[N]/[total].
            Layout: quit button left, [wordmark + segments] grouped center,
            spacer right. Wordmark scales smaller than home screen (14px vs
            18px) to fit alongside segments at 375px+ portrait. */}
      <div ref={headerRef} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', flexShrink: 0, height: 44, gap: 8,
      }}>
        {!gameOver && !jackpotInfo && state.gamePhase === 'playing' ? (
          <motion.button onClick={() => setShowQuitDialog(true)} whileTap={{ scale: 0.9 }} transition={getTransition('snappy')} style={{
            width: 32, height: 32, borderRadius: 99, border: 'none',
            background: alpha(C.ink.classic, 0.06), color: alpha(C.ink.classic, 0.7),
            fontSize: 16, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</motion.button>
        ) : <div style={{ width: 32, flexShrink: 0 }} />}

        {/* Centered group: STACKED! wordmark + game-state segments */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, flex: 1, minWidth: 0, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: FONTS.display,
            fontWeight: 400, fontSize: 14, letterSpacing: '-0.02em',
            color: C.ink.classic, flexShrink: 0,
          }}>
            STACKED<span style={{ color: C.accent.classic }}>!</span>
          </span>
          <HeaderSegments
            mode={currentLevelId ? 'THE RUN' : 'CLASSIC'}
            targetOrLevel={currentLevelId
              ? `${Math.ceil(currentLevelId / 3)}-${((currentLevelId - 1) % 3) + 1}`
              : String(target)}
            round={state.currentRound}
            hand={state.handNumber}
          />
        </div>

        {/* Settings Gear ticket: top-bar gear opens the App-level Settings
            modal mid-game. Game state stays untouched behind the overlay. */}
        <motion.button
          onClick={onOpenSettings}
          aria-label="Settings"
          whileTap={{ scale: 0.9 }}
          transition={getTransition('snappy')}
          style={{
            width: 32, height: 32, borderRadius: 99, border: 'none',
            background: alpha(C.ink.classic, 0.06), color: alpha(C.ink.classic, 0.7),
            fontSize: 16, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, lineHeight: 1,
          }}
        >
          <span style={{ fontVariantEmoji: 'text' as React.CSSProperties['fontVariantEmoji'] }}>{'⚙︎'}</span>
        </motion.button>
      </div>

      {/* ═══ ZONE B — MESSAGE STRIP (persistent + toast) ═══
           Persistent layer is always rendered (transparent strip carrying
           the LAST capture echo). Toast layer animates in/out over the top
           with celebration/transition/hint content. */}
      <div ref={msgStripRef} style={{
        position: 'relative', flexShrink: 0, height: 32,
      }}>
        {/* Persistent layer */}
        <div style={{
          position: 'absolute', inset: 0,
          padding: '4px 16px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {persistentMessage && (
            <span style={{
              fontFamily: FONTS.sans,
              fontSize: 14, fontWeight: 600, color: alpha(C.ink.classic, 0.6),
              letterSpacing: '0.02em',
            }}>
              {persistentMessage.prefix}
              <span style={{ fontFamily: FONTS.sans }}>
                {persistentMessage.equation}
              </span>
            </span>
          )}
        </div>

        {/* Toast layer — slides over the persistent strip when active. */}
        <AnimatePresence>
          {activeToast && (
            <motion.div
              key={`${activeToast.kind}:${activeToast.text}`}
              data-testid="toast-strip"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: activeToast.kind === 'celebration' || activeToast.kind === 'transition' ? 'easeOut' : 'easeOut' }}
              style={{
                position: 'absolute', inset: 0,
                padding: '4px 16px', textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6,
                background: C.ground.classic, // covers persistent strip while toast active
              }}
            >
              {activeToast.kind === 'hint' && (
                <span style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11, fontWeight: 700,
                  color: C.accent.classic, letterSpacing: '0.18em',
                }}>HINT</span>
              )}
              <span style={{
                fontFamily: FONTS.sans,
                fontSize: activeToast.kind === 'hint' ? 13 : 14,
                fontWeight: activeToast.kind === 'transition' ? 700 : 600,
                color: activeToast.color,
                letterSpacing: activeToast.kind === 'transition' ? '0.06em' : '0.02em',
              }}>
                {activeToast.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ZONES C+D — BOT ZONES ═══
            Two-line layout. When both bots share a personality (Adventure
            W1 Calvin+Calvin etc.), seats lock to "Name · 1" / "Name · 2"
            for player-side disambiguation. Position-locked at game start
            because settings don't shuffle mid-game. */}
      <div ref={botZonesRef} style={{ display: 'flex', gap: 8, padding: '0 8px', flexShrink: 0 }}>
        <BotZone
          name={state.settings.bot1Personality === state.settings.bot2Personality ? `${bot1.name} · 1` : bot1.name}
          color={bot1.color} score={state.overallScores.bot1}
          target={target} hand={bot1HandVisible} active={bot1Active}
          thinking={!!botViz && botViz.playerIndex === 1 && botViz.type === 'thinking'}
          escalated={bot1Escalated}
        />
        <BotZone
          name={state.settings.bot1Personality === state.settings.bot2Personality ? `${bot2.name} · 2` : bot2.name}
          color={bot2.color} score={state.overallScores.bot2}
          target={target} hand={bot2HandVisible} active={bot2Active}
          thinking={!!botViz && botViz.playerIndex === 2 && botViz.type === 'thinking'}
          escalated={bot2Escalated}
        />
      </div>

      {/* ═══ ZONE E — GAME BOARD ═══ */}
      <div ref={boardRef} style={{
        flex: 1, margin: '8px 8px 0', borderRadius: 12, padding: '8px 6px',
        background: alpha(C.ink.classic, 0.03),
        border: hoveredBoard ? `1px solid ${alpha(C.accent.classic, 0.5)}` : deckEmpty ? `1px solid ${C.accent.classic}55` : `1px solid ${alpha(C.ink.classic, 0.06)}`,
        display: 'flex', flexWrap: 'wrap', gap: BOARD_GAP,
        justifyContent: 'center', alignItems: 'center', alignContent: 'center',
        position: 'relative', zIndex: 15, minHeight: 0, overflow: 'visible',
        transition: 'border 150ms',
      }}>
        {/* Jackpot table tint. The accent @ 6% during the
             jackpot hand (deck.length===0 + still playing). Coexists with the
             deckEmpty gold border glow above; different signal: tint = "this
             is the jackpot hand", glow = "this hand is ending soon." */}
        <motion.div
          initial={false}
          animate={{ opacity: deckEmpty ? 0.06 : 0 }}
          transition={{ duration: deckEmpty ? 0.6 : 0.4, ease: deckEmpty ? 'easeOut' : 'easeIn' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: C.accent.classic, pointerEvents: 'none', zIndex: 0,
          }}
        />
        {visibleBoard.length === 0 && !botCombo && inPlay && (
          <span style={{ fontSize: 11, color: alpha(C.ink.classic, 0.25), position: 'relative', zIndex: 1 }}>Table empty</span>
        )}
        {visibleBoard.map((card) => (
          <CardComponent key={card.id} card={card} size="table" scale={boardCardScale}
            draggable={isPlayerTurn}
            onDragMove={(pt) => { handleDragStart(card.id, 'board'); handleDragMove(pt, 'board'); }}
            onDragEnd={(pt) => handleDragEnd(card.id, 'board', pt)}
          />
        ))}
        {deckEmpty && (
          <motion.div
            style={{ position: 'absolute', inset: -1, borderRadius: 12, pointerEvents: 'none' }}
            animate={{ boxShadow: [`0 0 8px ${C.accent.classic}20`, `0 0 20px ${C.accent.classic}48`, `0 0 8px ${C.accent.classic}20`] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* ═══ ZONE F — COMBO STRIP ═══ */}
      <div ref={comboBuilderRef} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, padding: '6px 8px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center' }}>
          {SLOT_KEYS.map((key, i) => {
            const slotIdx = i;
            const staged = slotIdx === 0 ? (displayCombo.base ? [displayCombo.base] : []) : displayCombo.slots[slotIdx - 1];
            const filled = staged.length > 0;
            const isBase = key === 'base';
            const isHovered = hoveredSlot === key && draggingCardId !== null;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: '1 1 0', maxWidth: 72 }}>
                <span style={{ fontSize: 8, color: alpha(C.ink.classic, 0.4), fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{SLOT_LABELS[key]}</span>
                <div
                  ref={(el) => { slotRefs.current[i] = el; }}
                  style={{
                    width: '100%', aspectRatio: '2.5/3.5', borderRadius: 6,
                    border: isHovered ? `2px solid ${C.classicGold}` : isBase ? (filled ? `2px solid ${C.classicGold}` : `1px solid ${C.classicGold}`) : (filled ? `2px solid ${C.classicGold}` : `1px dashed ${alpha(C.ink.classic, 0.12)}`),
                    boxShadow: isHovered ? `0 0 8px ${C.classicGold}66` : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    background: isHovered ? `${C.classicGold}1A` : filled ? `${C.classicGold}0F` : 'transparent',
                    transition: 'border 150ms, box-shadow 150ms, background 150ms',
                  }}
                >
                  {filled ? staged.map((c) => (
                    <div key={c.id} onClick={(e) => { e.stopPropagation(); handleStagedCardTap(c.id); }} style={{ cursor: 'pointer' }}>
                      <CardComponent card={c} size="slot" />
                    </div>
                  )) : (
                    <span style={{ fontSize: 9, color: alpha(C.ink.classic, 0.2) }}>EMPTY</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {(tutorialShowGhostActions || (isPlayerTurn && hasCombo && !botCombo)) && (
          <div style={{ display: 'flex', gap: 6 }}>
            <div ref={submitWrapRef}>
              <Btn
                label="SUBMIT" primary
                disabled={tutorialShowGhostActions || !comboValid}
                onClick={tutorialShowGhostActions ? () => {} : handleSubmit}
              />
            </div>
            <div ref={resetWrapRef}>
              <Btn
                label="RESET"
                disabled={tutorialShowGhostActions}
                onClick={tutorialShowGhostActions ? () => {} : actions.resetCombo}
              />
            </div>
          </div>
        )}
        {error &&<span style={{ fontSize: 11, color: C.suitRed }}>{error}</span>}
      </div>

      {/* ═══ ZONES G+H — PLAYER HAND + SCORE ═══ */}
      <div ref={handZoneRef} style={{
        display: 'flex', padding: '0 8px 8px', gap: 8, flexShrink: 0,
      }}>
        {/* Zone H — Player score block. Active-turn glow:
              3px accent border + breathing 16px outer + 4px inset. Phase-gated. */}
        <motion.div
          animate={playerActive ? {
            boxShadow: [
              `0 0 16px ${C.accent.classic}80, inset 0 0 4px ${C.accent.classic}4D`,
              `0 0 16px ${C.accent.classic}B3, inset 0 0 4px ${C.accent.classic}4D`,
            ],
          } : { boxShadow: '0 0 0 0 transparent' }}
          transition={playerActive
            ? { duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
            : { duration: 0.2 }}
          style={{
            width: 72, borderRadius: 10, padding: '8px 4px',
            background: alpha(C.ink.classic, 0.03),
            border: playerActive ? `3px solid ${C.accent.classic}` : `1px solid ${alpha(C.ink.classic, 0.06)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            transition: 'border 200ms',
          }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C.accent.classic, letterSpacing: '0.1em' }}>YOU</span>
          <motion.span
            animate={{ color: playerEscalated ? C.accent.classic : C.ink.classic }}
            transition={{ duration: 0.5, ease: 'easeIn' }}
            style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 18 }}
          >
            {state.overallScores.player}
          </motion.span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 9, color: alpha(C.ink.classic, 0.4) }}>
            /{target}
          </span>
        </motion.div>

        {/* Zone G — Your hand. Same active-turn glow as Zone H. */}
        <motion.div
          animate={playerActive ? {
            boxShadow: [
              `0 0 16px ${C.accent.classic}80, inset 0 0 4px ${C.accent.classic}4D`,
              `0 0 16px ${C.accent.classic}B3, inset 0 0 4px ${C.accent.classic}4D`,
            ],
          } : { boxShadow: '0 0 0 0 transparent' }}
          transition={playerActive
            ? { duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
            : { duration: 0.2 }}
          style={{
            flex: 1, borderRadius: 10, padding: '6px 4px',
            background: alpha(C.ink.classic, 0.03),
            border: playerActive ? `3px solid ${C.accent.classic}` : `1px solid ${alpha(C.ink.classic, 0.06)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            transition: 'border 200ms',
            position: 'relative', zIndex: 20,
          }}>
          <span style={{ fontSize: 8, color: alpha(C.ink.classic, 0.4), letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>YOUR HAND</span>
          <div style={{ display: 'flex', gap: handFit.gap, justifyContent: 'center' }}>
            {visibleHand.map((card) => (
              <CardComponent key={card.id} card={card} size="hand" scale={handFit.scale}
                draggable={isPlayerTurn}
                onDragMove={(pt) => { handleDragStart(card.id, 'hand'); handleDragMove(pt, 'hand'); }}
                onDragEnd={(pt) => handleDragEnd(card.id, 'hand', pt)}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* ═══ QUIT DIALOG ═══ */}
      <AnimatePresence>
        {showQuitDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onClick={() => setShowQuitDialog(false)}
            style={{ position: 'fixed', inset: 0, background: alpha(C.classicTable, 0.7), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 20 }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: C.surface.classic, borderRadius: 12, padding: 24, maxWidth: 280, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 18, color: C.inkOnSurface.classic, margin: 0 }}>
                {currentLevelId ? 'Return to The Run Map?' : 'Quit Game?'}
              </h3>
              <p style={{ fontSize: 13, color: alpha(C.inkOnSurface.classic, 0.6), textAlign: 'center', margin: 0 }}>
                {currentLevelId
                  ? 'Your level is saved. Resume it from The Run map. Star progress is safe.'
                  : 'Your game is saved. Tap Continue on the home screen to pick it up.'}
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, width: '100%' }}>
                <Btn label={currentLevelId ? 'BACK' : 'QUIT'} onClick={() => { setShowQuitDialog(false); onQuit(); }} big />
                <Btn label="RESUME" primary onClick={() => setShowQuitDialog(false)} big />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ OVERLAYS ═══ */}
      <RoundEndOverlay visible={state.gamePhase === 'roundEnd'} roundNumber={state.currentRound} roundStats={state.roundStats} overallScores={state.overallScores} targetScore={target} bot1Personality={state.settings.bot1Personality} bot2Personality={state.settings.bot2Personality} onContinue={actions.continueRound} adventureMode={!!currentLevelId} />
      <JackpotCelebration info={jackpotInfo} bot1Personality={state.settings.bot1Personality} bot2Personality={state.settings.bot2Personality} />
      <GameOverOverlay winner={gameOver as { winner: PlayerIndex; winnerName: string } | null} state={state} adventureMode={!!currentLevelId} onPlayAgain={onPlayAgain} onHome={onHome} />

      {/* The Run tutorial — 8-mark coach overlay. Auto-fires on first W1L1
          entry, replayable from Settings. Pure presentation; engine untouched. */}
      <TutorialOverlay
        visible={tutorial.visible}
        currentStep={tutorial.currentStep}
        totalSteps={tutorial.totalSteps}
        marks={TUTORIAL_MARKS({
          handZoneRef, boardRef, comboBuilderRef, resetWrapRef,
          submitWrapRef, botZonesRef, msgStripRef, headerRef,
        })}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onSkip={tutorial.dismiss}
        onJump={tutorial.jumpTo}
      />
    </div>
  );
}

// ─── Tutorial marks (verbatim copy + zone refs) ─────────
// Teaching order: bottom (your stuff) → middle (workspace) → controls →
// upper middle (opponents) → top (context).

interface TutorialMarkRefs {
  handZoneRef: React.RefObject<HTMLDivElement | null>;
  boardRef: React.RefObject<HTMLDivElement | null>;
  comboBuilderRef: React.RefObject<HTMLDivElement | null>;
  resetWrapRef: React.RefObject<HTMLDivElement | null>;
  submitWrapRef: React.RefObject<HTMLDivElement | null>;
  botZonesRef: React.RefObject<HTMLDivElement | null>;
  msgStripRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
}

function TUTORIAL_MARKS(refs: TutorialMarkRefs): TutorialMark[] {
  return [
    { title: 'Your hand', copy: 'Your hand and your score. Drag a card into the builder to begin.', ref: refs.handZoneRef },
    { title: 'The table', copy: 'Shared cards. You score by capturing these.', ref: refs.boardRef },
    { title: 'Combo builder', copy: 'Drag a base card here — from your hand or the table — then add cards that add up to it, or match it.', ref: refs.comboBuilderRef },
    { title: 'Reset', copy: 'Dragged the wrong card? Reset sends everything in the builder back where it came from.', ref: refs.resetWrapRef, pill: true },
    { title: 'Submit', copy: 'Hit submit to capture, and your turn keeps going. To place instead, drag a card onto the table — that ends your turn.', ref: refs.submitWrapRef, pill: true },
    { title: 'The opponents', copy: 'Two opponents are after the same cards. Watch what they leave behind.', ref: refs.botZonesRef },
    { title: 'Message strip', copy: 'Hints and the last move land here.', ref: refs.msgStripRef },
    { title: 'Header', copy: "Where you are: your world and level, and the round and hand you're on.", ref: refs.headerRef },
  ];
}

// ─── Bot Zone ───────────────────────────────────────

function BotZone({ name, color, score, target, hand, active, thinking, escalated }: {
  name: string; color: string; score: number; target: number;
  hand: readonly Card[]; active: boolean; thinking: boolean;
  escalated: boolean;
}) {
  // Active-turn glow (3px border + breathing 16px outer + 4px inset).
  // Two-line layout: name (top) + score (middle) + face-down cards (bottom).
  return (
    <motion.div
      animate={active ? {
        boxShadow: [
          `0 0 16px ${color}80, inset 0 0 4px ${color}4D`,
          `0 0 16px ${color}B3, inset 0 0 4px ${color}4D`,
        ],
      } : { boxShadow: '0 0 0 0 transparent' }}
      transition={active
        ? { duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
        : { duration: 0.2 }}
      style={{
        flex: 1, borderRadius: 10, padding: '8px 10px',
        background: alpha(C.ink.classic, 0.03),
        border: active ? `3px solid ${color}` : `1px solid ${alpha(C.ink.classic, 0.06)}`,
        display: 'flex', flexDirection: 'column', gap: 4,
        transition: 'border 200ms',
        minWidth: 0,
      }}>
      {/* Name line — 14px, bot colour @ 100% */}
      <span style={{
        fontFamily: FONTS.sans,
        fontSize: 14, fontWeight: 600, color,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {name}{thinking ? ' …' : ''}
      </span>

      {/* Score line — `[score] /[target]` format.
            Score: 700 at 18px, ink@90% → the accent@90% at the 80% threshold.
            Suffix: 600 at 12px, ink@50%. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <motion.span
          animate={{ color: escalated ? alpha(C.accent.classic, 0.9) : alpha(C.ink.classic, 0.9) }}
          transition={{ duration: 0.5, ease: 'easeIn' }}
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 700, fontSize: 18, lineHeight: 1,
          }}
        >
          {score}
        </motion.span>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 12, fontWeight: 600, color: alpha(C.ink.classic, 0.5),
        }}>/{target}</span>
      </div>

      {/* Face-down hand */}
      <div style={{ display: 'flex', gap: -4, marginTop: 2 }}>
        {hand.slice(0, 4).map((c, i) => (
          <div key={c.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
            <CardComponent card={c} faceDown size="slot" />
          </div>
        ))}
        {hand.length === 0 && <span style={{ fontSize: 9, color: alpha(C.ink.classic, 0.25) }}>No cards</span>}
      </div>
    </motion.div>
  );
}

// ─── Button ─────────────────────────────────────────

function Btn({ label, primary, disabled, big, onClick }: {
  label: string; primary?: boolean; disabled?: boolean; big?: boolean; onClick: () => void;
}) {
  // Secondary outlined style: 1.5px ink@40% border, ink@90% text,
  // transparent fill. Primary is Classic's gold with the table colour (SUBMIT / RESUME).
  return (
    <motion.button onClick={onClick} disabled={disabled} whileTap={disabled ? undefined : { scale: 0.97 }} transition={getTransition('snappy')} style={{
      padding: big ? '10px 24px' : '5px 14px', borderRadius: 6,
      border: primary ? 'none' : `1.5px solid ${alpha(C.ink.classic, 0.4)}`,
      background: primary ? (disabled ? alpha(C.ink.classic, 0.08) : C.classicGold) : 'transparent',
      color: primary ? (disabled ? alpha(C.ink.classic, 0.3) : C.classicTable) : alpha(C.ink.classic, 0.9),
      fontSize: big ? 15 : 12, fontWeight: 600, fontFamily: FONTS.sans,
      cursor: disabled ? 'default' : 'pointer',
    }}>{label}</motion.button>
  );
}

// Header bar segments. 4 segments separated by mid-dots:
//   MODE · TARGET/LEVEL · R[N] · H[N]
// Mode + target/level stable ink@90% (never drop). R[N] / H[N]
// ink@70% by default, the accent@90% during the Hand 3 round-arc cue.
// Min-width:0 + overflow:hidden on the container give natural
// truncation if width is tight.
//
// H[N] shows the hand number alone, with no hands-per-round total, so
// the header holds for any hand size, player count or game mode.

function HeaderSegments({
  mode, targetOrLevel, round, hand,
}: {
  mode: 'CLASSIC' | 'THE RUN';
  targetOrLevel: string;
  round: number;
  hand: number;
}) {
  const HAND_3_FORK = hand >= 3;
  const stable = alpha(C.ink.classic, 0.9);
  const secondary = alpha(C.ink.classic, 0.7);
  const cue = alpha(C.accent.classic, 0.9);
  const dotColor = alpha(C.ink.classic, 0.4);

  const seg = (text: string, color: string, key: string, letterSpacing = 'normal') => (
    <span key={key} style={{
      fontFamily: FONTS.sans,
      fontSize: 13, fontWeight: 500, color, letterSpacing, whiteSpace: 'nowrap',
    }}>{text}</span>
  );

  const dot = (key: string) => (
    <span key={key} aria-hidden style={{
      fontFamily: FONTS.sans,
      fontSize: 13, color: dotColor, padding: '0 8px', whiteSpace: 'nowrap',
    }}>·</span>
  );

  const segments = [
    seg(mode, stable, 'mode', '0.04em'),
    seg(targetOrLevel, stable, 'tl'),
    seg(`R${round}`, HAND_3_FORK ? cue : secondary, 'r'),
    seg(`H${hand}`, HAND_3_FORK ? cue : secondary, 'h'),
  ];

  // Interleave separators between segments
  const children: React.ReactNode[] = [];
  segments.forEach((s, i) => {
    if (i > 0) children.push(dot(`d${i}`));
    children.push(s);
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 0, overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

