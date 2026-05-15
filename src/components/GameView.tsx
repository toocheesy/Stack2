import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Card, ComboSlot, Difficulty, GameState, PlayerIndex } from '../engine/types';
import { getTransition } from '../config/motion';
import type { GameActions, BotVizStep, BotComboDisplay, LastCaptureInfo } from '../game/useGameController';
import { CardComponent, CARD_W } from './Card';
import { RoundEndOverlay } from './RoundEndOverlay';
import { JackpotCelebration, type JackpotDisplay } from './JackpotCelebration';
import { GameOverOverlay } from './GameOverOverlay';
import { validateFullCombo } from '../engine/core/captureValidator';

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
  // Bundle C — when an Adventure overlay (LevelCompleteOverlay etc.) is
  // showing from App.tsx, suppress the in-game toast layer. App passes
  // !!levelComplete here so the toast logic doesn't need to know about
  // overlays it can't directly observe.
  suppressToasts?: boolean;
}

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const SLOT_LABELS: Record<ComboSlot, string> = {
  base: 'BASE', combo1: 'COMBO 1', combo2: 'COMBO 2', combo3: 'COMBO 3',
};

const PLAYER_COLORS: Record<Difficulty, { color: string; name: string }> = {
  beginner:     { color: '#3B82F6', name: 'Calvin' },
  intermediate: { color: '#DBEAFE', name: 'Nina' },
  advanced:     { color: '#DC2626', name: 'Rex' },
  expert:       { color: '#8B5CF6', name: 'Jett' },
};

const JADE = '#065F46';
const TAN = '#E8C577';
const BG = '#0A0A0A';
const BOARD_GAP = 4;

export function GameView({
  state, isPlayerTurn, botViz, botCombo, lastCapture, jackpotInfo, currentLevelId, gameOver, actions, onQuit, onHome, onPlayAgain, suppressToasts = false,
}: Props) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
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

  // Bundle A S2 — active-turn glow gates on gamePhase. Glow MUST clear when
  // gamePhase moves to roundEnd / jackpot / gameOver so the overlay messaging
  // doesn't compete with a leftover active-player highlight.
  const inPlay = state.gamePhase === 'playing';
  const playerActive = inPlay && state.currentPlayer === 0;
  const bot1Active = inPlay && state.currentPlayer === 1;
  const bot2Active = inPlay && state.currentPlayer === 2;

  // Bundle A S4 — score-state escalation. Once a player crosses 80% of target,
  // their score number transitions white → tan over ~500ms ease-in. Scores are
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
    setSelectedHandCard(null);
  }, []);

  const handleDragEnd = useCallback((cardId: string, source: CardSource, point: { x: number; y: number }) => {
    setHoveredSlot(null); setHoveredBoard(false); setDraggingCardId(null); setDraggingSource(null);
    if (!isPlayerTurn) return;
    const t = findDropTarget(point);
    if (!t) return;
    if (t.type === 'slot') actions.addToCombo(cardId, source, t.slot);
    else if (t.type === 'board' && source === 'hand') { actions.placeCard(cardId); setSelectedHandCard(null); }
  }, [isPlayerTurn, findDropTarget, actions]);

  const handleHandTap = useCallback((cardId: string) => {
    if (!isPlayerTurn) return;
    setSelectedHandCard((prev) => (prev === cardId ? null : cardId));
  }, [isPlayerTurn]);

  const handleBoardTap = useCallback((cardId: string) => {
    if (!isPlayerTurn) return;
    if (!state.combination.base) actions.addToCombo(cardId, 'board', 'base');
    else { const slot = nextEmptySlot(state.combination); if (slot) actions.addToCombo(cardId, 'board', slot); }
  }, [isPlayerTurn, state.combination, actions]);

  const handleSlotTap = useCallback((slot: ComboSlot) => {
    if (!isPlayerTurn) return;
    if (selectedHandCard) { actions.addToCombo(selectedHandCard, 'hand', slot); setSelectedHandCard(null); }
  }, [isPlayerTurn, selectedHandCard, actions]);

  const handleStagedCardTap = useCallback((cardId: string) => {
    if (!isPlayerTurn) return;
    actions.removeFromCombo(cardId);
  }, [isPlayerTurn, actions]);

  const handleBoardAreaTap = useCallback(() => {
    if (!isPlayerTurn || !selectedHandCard) return;
    actions.placeCard(selectedHandCard);
    setSelectedHandCard(null);
  }, [isPlayerTurn, selectedHandCard, actions]);

  const handleSubmit = useCallback(() => {
    const err = actions.submitCombo();
    if (err) { setError(err); setTimeout(() => setError(null), 2000); }
  }, [actions]);

  // ── Board card scaling (6 across) ─────────────────

  const boardCardScale = useMemo(() => {
    if (visibleBoard.length === 0) return 0.85;
    const avail = typeof window !== 'undefined' ? window.innerWidth - 24 : 350;
    const perRow = 6;
    const maxW = (avail - BOARD_GAP * (perRow - 1)) / perRow;
    const scale = Math.min(0.85, maxW / CARD_W);
    return Math.max(0.55, scale);
  }, [visibleBoard.length]);

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

  // ── Bundle C — Persistent strip content (LAST capture echo) ──
  // Empty when no capture has happened yet; the header (Bundle B) carries
  // round info so we don't need to repeat it here.

  const persistentMessage = useMemo(() => {
    if (!lastCapture) return null;
    const base = lastCapture.baseCard?.rank ?? '';
    const areas = lastCapture.areas.map(a => a.map(c => c.rank).join('+')).join(' · ');
    return { prefix: 'LAST · ', equation: `${base} = ${areas}` };
  }, [lastCapture]);

  // ── Bundle C — Adventure hint copy (routed through toast layer below) ──

  const hintText = useMemo(() => {
    if (!state.settings.hintStripEnabled) return null;
    if (state.gamePhase !== 'playing') return null;
    if (!isPlayerTurn) return 'Watch the bots play their turn';
    if (hasCombo && !comboValid) return 'Combo groups must sum (or match) the base card value';
    if (hasCombo && comboValid) return 'Tap SUBMIT to capture, or RESET to clear';
    if (selectedHandCard) return 'Tap a board card to capture, or tap the board to place';
    return 'Tap a card in your hand to start your turn';
  }, [state.settings.hintStripEnabled, state.gamePhase, isPlayerTurn, hasCombo, comboValid, selectedHandCard]);

  // ── Bundle C — Toast layer state machine ──
  // Three toast kinds:
  //   - celebration: 2s, +pts · NICE COMBO, tan
  //   - transition:  3s, R[N] · FRESH DECK, white
  //   - hint:        persistent until cleared by player action / interrupt
  // Priority: celebration > transition > hint > none. Higher preempts lower.
  // Suppressed entirely whenever an overlay (RoundEnd/Jackpot/GameOver/
  // LevelComplete) is showing — closes UX Review finding 9.

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
      color: TAN,
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
        color: '#fff',
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
    if (hintText) return { kind: 'hint', text: hintText, color: 'rgba(232,197,119,0.9)' };
    return null;
  }, [isOverlaySuppressing, transient, hintText]);

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: BG,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', touchAction: 'none',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* ═══ ZONE A — HEADER BAR ═══
            Header polish (May 14 follow-up) — 4-segment format with
            restored STACKED! wordmark: MODE · TARGET/LEVEL · R[N] · H[N]/[total].
            Layout: quit button left, [wordmark + segments] grouped center,
            spacer right. Wordmark scales smaller than home screen (14px vs
            18px) to fit alongside segments at 375px+ portrait. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', flexShrink: 0, height: 44, gap: 8,
      }}>
        {!gameOver && !jackpotInfo && state.gamePhase === 'playing' ? (
          <motion.button onClick={() => setShowQuitDialog(true)} whileTap={{ scale: 0.9 }} transition={getTransition('snappy')} style={{
            width: 32, height: 32, borderRadius: 99, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
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
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 900, fontSize: 14, letterSpacing: '-0.02em',
            color: '#fff', flexShrink: 0,
          }}>
            STACKED<span style={{ color: JADE }}>!</span>
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

        <div style={{ width: 32, flexShrink: 0 }} />
      </div>

      {/* ═══ ZONE B — MESSAGE STRIP (Bundle C: persistent + toast) ═══
           Persistent layer is always rendered (transparent strip carrying
           the LAST capture echo). Toast layer animates in/out over the top
           with celebration/transition/hint content. */}
      <div style={{
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
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.02em',
            }}>
              {persistentMessage.prefix}
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
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
                background: BG, // covers persistent strip while toast active
              }}
            >
              {activeToast.kind === 'hint' && (
                <span style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 11, fontWeight: 700,
                  color: TAN, letterSpacing: '0.18em',
                }}>HINT</span>
              )}
              <span style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: activeToast.kind === 'hint' ? 13 : 14,
                fontWeight: activeToast.kind === 'transition' ? 700 : 500,
                color: activeToast.color,
                letterSpacing: activeToast.kind === 'transition' ? '0.06em' : '0.02em',
              }}>
                {activeToast.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ZONES C+D — BOT ZONES (Bundle B S2) ═══
            Two-line layout. When both bots share a personality (Adventure
            W1 Calvin+Calvin etc.), seats lock to "Name · 1" / "Name · 2"
            for player-side disambiguation. Position-locked at game start
            because settings don't shuffle mid-game. */}
      <div style={{ display: 'flex', gap: 8, padding: '0 8px', flexShrink: 0 }}>
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
      <div ref={boardRef} onClick={handleBoardAreaTap} style={{
        flex: 1, margin: '8px 8px 0', borderRadius: 12, padding: '8px 6px',
        background: 'rgba(255,255,255,0.03)',
        border: hoveredBoard ? '1px solid rgba(16,185,129,0.5)' : deckEmpty ? `1px solid ${TAN}55` : '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexWrap: 'wrap', gap: BOARD_GAP,
        justifyContent: 'center', alignItems: 'center', alignContent: 'center',
        position: 'relative', zIndex: 15, minHeight: 0, overflow: 'visible',
        transition: 'border 150ms',
      }}>
        {/* Bundle A S5 — jackpot board tint. Tan #E8C577 @ 6% during the
             jackpot hand (deck.length===0 + still playing). Coexists with the
             deckEmpty amber border glow above; different signal: tint = "this
             is the jackpot hand", glow = "this hand is ending soon." */}
        <motion.div
          initial={false}
          animate={{ opacity: deckEmpty ? 0.06 : 0 }}
          transition={{ duration: deckEmpty ? 0.6 : 0.4, ease: deckEmpty ? 'easeOut' : 'easeIn' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: TAN, pointerEvents: 'none', zIndex: 0,
          }}
        />
        {visibleBoard.length === 0 && !botCombo && inPlay && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', position: 'relative', zIndex: 1 }}>Board empty</span>
        )}
        {visibleBoard.map((card) => (
          <div key={card.id} style={{ transform: `scale(${boardCardScale})`, transformOrigin: 'center' }}>
            <CardComponent card={card}
              draggable={isPlayerTurn}
              isDragging={draggingCardId === card.id}
              onTap={() => handleBoardTap(card.id)}
              onDragMove={(pt) => { handleDragStart(card.id, 'board'); handleDragMove(pt, 'board'); }}
              onDragEnd={(pt) => handleDragEnd(card.id, 'board', pt)}
            />
          </div>
        ))}
        {deckEmpty && (
          <motion.div
            style={{ position: 'absolute', inset: -1, borderRadius: 12, pointerEvents: 'none' }}
            animate={{ boxShadow: [`0 0 8px ${TAN}20`, `0 0 20px ${TAN}48`, `0 0 8px ${TAN}20`] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* ═══ ZONE F — COMBO STRIP ═══ */}
      <div style={{
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
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' }}>{SLOT_LABELS[key]}</span>
                <div
                  ref={(el) => { slotRefs.current[i] = el; }}
                  onClick={(e) => { e.stopPropagation(); handleSlotTap(key); }}
                  style={{
                    width: '100%', aspectRatio: '2.5/3.5', borderRadius: 6,
                    border: isHovered ? `2px solid ${JADE}` : isBase ? (filled ? `2px solid ${JADE}` : `1px solid ${JADE}`) : (filled ? `2px solid ${JADE}` : '1px dashed rgba(255,255,255,0.12)'),
                    boxShadow: isHovered ? `0 0 8px ${JADE}66` : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    background: isHovered ? `${JADE}1A` : filled ? `${JADE}0F` : 'transparent',
                    transition: 'border 150ms, box-shadow 150ms, background 150ms',
                  }}
                >
                  {filled ? staged.map((c) => (
                    <div key={c.id} onClick={(e) => { e.stopPropagation(); handleStagedCardTap(c.id); }} style={{ cursor: 'pointer' }}>
                      <CardComponent card={c} small />
                    </div>
                  )) : (
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>EMPTY</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {isPlayerTurn && hasCombo && !botCombo && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label="SUBMIT" primary disabled={!comboValid || state.dumpActive} onClick={handleSubmit} />
            <Btn label="RESET" onClick={actions.resetCombo} />
          </div>
        )}
        {isPlayerTurn && state.dumpActive && (
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, fontWeight: 500,
            color: TAN, letterSpacing: '0.04em',
          }}>
            Last cards — place only
          </span>
        )}
        {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}
      </div>

      {/* ═══ ZONES G+H — PLAYER HAND + SCORE ═══ */}
      <div style={{
        display: 'flex', padding: '0 8px 8px', gap: 8, flexShrink: 0,
      }}>
        {/* Zone H — Player score block. Bundle A S2 active-turn glow:
              3px tan border + breathing 16px outer + 4px inset. Phase-gated. */}
        <motion.div
          animate={playerActive ? {
            boxShadow: [
              `0 0 16px ${TAN}80, inset 0 0 4px ${TAN}4D`,
              `0 0 16px ${TAN}B3, inset 0 0 4px ${TAN}4D`,
            ],
          } : { boxShadow: '0 0 0 0 transparent' }}
          transition={playerActive
            ? { duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
            : { duration: 0.2 }}
          style={{
            width: 72, borderRadius: 10, padding: '8px 4px',
            background: 'rgba(255,255,255,0.03)',
            border: playerActive ? `3px solid ${TAN}` : '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            transition: 'border 200ms',
          }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#F59E0B', letterSpacing: '0.1em' }}>YOU</span>
          <motion.span
            animate={{ color: playerEscalated ? TAN : '#fff' }}
            transition={{ duration: 0.5, ease: 'easeIn' }}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 18 }}
          >
            {state.overallScores.player}
          </motion.span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
            /{target}
          </span>
          {/* Bundle B — card count moved to Zone A header; the "X cards" line
              that used to live here was deleted per spec section 1. */}
        </motion.div>

        {/* Zone G — Your hand. Bundle A S2 glow same treatment as Zone H. */}
        <motion.div
          animate={playerActive ? {
            boxShadow: [
              `0 0 16px ${TAN}80, inset 0 0 4px ${TAN}4D`,
              `0 0 16px ${TAN}B3, inset 0 0 4px ${TAN}4D`,
            ],
          } : { boxShadow: '0 0 0 0 transparent' }}
          transition={playerActive
            ? { duration: 1.2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }
            : { duration: 0.2 }}
          style={{
            flex: 1, borderRadius: 10, padding: '6px 4px',
            background: 'rgba(255,255,255,0.03)',
            border: playerActive ? `3px solid ${TAN}` : '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            transition: 'border 200ms',
            position: 'relative', zIndex: 20,
          }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, fontWeight: 500, textTransform: 'uppercase' }}>YOUR HAND</span>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {visibleHand.map((card) => (
              <CardComponent key={card.id} card={card}
                selected={selectedHandCard === card.id}
                draggable={isPlayerTurn}
                isDragging={draggingCardId === card.id}
                onTap={() => handleHandTap(card.id)}
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 20 }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, maxWidth: 280, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, color: '#fff', margin: 0 }}>
                {currentLevelId ? 'Return to The Run Map?' : 'Quit Game?'}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', margin: 0 }}>
                {currentLevelId
                  ? 'This level will restart next time. Star progress is safe.'
                  : 'Your progress in this game will be lost.'}
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
      <RoundEndOverlay visible={state.gamePhase === 'roundEnd'} roundNumber={state.currentRound} roundStats={state.roundStats} gameStats={state.gameStats} targetScore={target} bot1Personality={state.settings.bot1Personality} bot2Personality={state.settings.bot2Personality} onContinue={actions.continueRound} adventureMode={!!currentLevelId} />
      <JackpotCelebration info={jackpotInfo} bot1Personality={state.settings.bot1Personality} bot2Personality={state.settings.bot2Personality} />
      <GameOverOverlay winner={gameOver as { winner: PlayerIndex; winnerName: string } | null} state={state} adventureMode={!!currentLevelId} onPlayAgain={onPlayAgain} onHome={onHome} />
    </div>
  );
}

// ─── Bot Zone ───────────────────────────────────────

function BotZone({ name, color, score, target, hand, active, thinking, escalated }: {
  name: string; color: string; score: number; target: number;
  hand: readonly Card[]; active: boolean; thinking: boolean;
  escalated: boolean;
}) {
  // Bundle A S2 — active-turn glow (3px border + breathing 16px outer + 4px inset).
  // Bundle B S2 — two-line layout: name (top) + score (middle) + face-down cards (bottom).
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
        background: 'rgba(255,255,255,0.03)',
        border: active ? `3px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 4,
        transition: 'border 200ms',
        minWidth: 0,
      }}>
      {/* Name line — Inter Medium 14px, bot color @ 100% (per spec section 4) */}
      <span style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14, fontWeight: 500, color,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {name}{thinking ? ' …' : ''}
      </span>

      {/* Score line — `[score] /[target]` format per spec section 4.
            Score: Inter Black 22px, white@90% → tan@90% at 80% threshold (Bundle A S4).
            Suffix: Inter Medium 12px, white@50%. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <motion.span
          animate={{ color: escalated ? 'rgba(232,197,119,0.9)' : 'rgba(255,255,255,0.9)' }}
          transition={{ duration: 0.5, ease: 'easeIn' }}
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 900, fontSize: 18, lineHeight: 1,
          }}
        >
          {score}
        </motion.span>
        <span style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
        }}>/{target}</span>
      </div>

      {/* Face-down hand */}
      <div style={{ display: 'flex', gap: -4, marginTop: 2 }}>
        {hand.slice(0, 4).map((c, i) => (
          <div key={c.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
            <CardComponent card={c} faceDown small />
          </div>
        ))}
        {hand.length === 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>No cards</span>}
      </div>
    </motion.div>
  );
}

// ─── Button ─────────────────────────────────────────

function Btn({ label, primary, disabled, big, onClick }: {
  label: string; primary?: boolean; disabled?: boolean; big?: boolean; onClick: () => void;
}) {
  // Bundle A S3 — secondary outlined spec: 1.5px white@40% border, white@90% text,
  // transparent fill. Primary keeps jade for in-game CTAs (SUBMIT / RESUME).
  return (
    <motion.button onClick={onClick} disabled={disabled} whileTap={disabled ? undefined : { scale: 0.97 }} transition={getTransition('snappy')} style={{
      padding: big ? '10px 24px' : '5px 14px', borderRadius: 6,
      border: primary ? 'none' : '1.5px solid rgba(255,255,255,0.4)',
      background: primary ? (disabled ? 'rgba(255,255,255,0.08)' : JADE) : 'transparent',
      color: primary ? (disabled ? 'rgba(255,255,255,0.3)' : '#fff') : 'rgba(255,255,255,0.9)',
      fontSize: big ? 15 : 12, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif',
      cursor: disabled ? 'default' : 'pointer',
    }}>{label}</motion.button>
  );
}

// Header bar segments. 4 segments separated by mid-dots:
//   MODE · TARGET/LEVEL · R[N] · H[N]
// Mode + target/level stable white@90% (never drop). R[N] / H[N]
// white@70% by default, tan@90% during the Hand 3 round-arc cue.
// Min-width:0 + overflow:hidden on the container give natural
// truncation if width is tight.
//
// Marcus Build 2 audit (May 15): H[N]/[total] reverted to bare H[N].
// Display no longer bakes a hands-per-round structural assumption
// into UI copy — survives engine variants (different hand size,
// player count, deck composition, future game modes).

function HeaderSegments({
  mode, targetOrLevel, round, hand,
}: {
  mode: 'CLASSIC' | 'THE RUN';
  targetOrLevel: string;
  round: number;
  hand: number;
}) {
  const HAND_3_FORK = hand >= 3;
  const stable = 'rgba(255,255,255,0.9)';
  const secondary = 'rgba(255,255,255,0.7)';
  const tan = 'rgba(232,197,119,0.9)'; // TAN #E8C577 @ 90%
  const dotColor = 'rgba(255,255,255,0.4)';

  const seg = (text: string, color: string, key: string, letterSpacing = 'normal') => (
    <span key={key} style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 13, fontWeight: 500, color, letterSpacing, whiteSpace: 'nowrap',
    }}>{text}</span>
  );

  const dot = (key: string) => (
    <span key={key} aria-hidden style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 13, color: dotColor, padding: '0 8px', whiteSpace: 'nowrap',
    }}>·</span>
  );

  const segments = [
    seg(mode, stable, 'mode', '0.04em'),
    seg(targetOrLevel, stable, 'tl'),
    seg(`R${round}`, HAND_3_FORK ? tan : secondary, 'r'),
    seg(`H${hand}`, HAND_3_FORK ? tan : secondary, 'h'),
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

function nextEmptySlot(combo: GameState['combination']): Exclude<ComboSlot, 'base'> | null {
  if (combo.combo1.length === 0) return 'combo1';
  if (combo.combo2.length === 0) return 'combo2';
  if (combo.combo3.length === 0) return 'combo3';
  return null;
}
