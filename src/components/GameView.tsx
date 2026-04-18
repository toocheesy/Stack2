import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Card, ComboSlot, Difficulty, GameState } from '../engine/types';
import { SCORE_KEYS } from '../engine/types';
import { C } from '../config/colors';
import { getTransition } from '../config/motion';
import type { GameActions, BotVizStep, BotComboDisplay, LastCaptureInfo } from '../game/useGameController';
import { CardComponent, CARD_W } from './Card';
import { LastCaptureCallout } from './LastCapture';
import { ThinkingBubble } from './ThinkingBubble';
import { validateFullCombo } from '../engine/core/captureValidator';

type CardSource = 'hand' | 'board';

interface Props {
  state: GameState;
  isPlayerTurn: boolean;
  botViz: BotVizStep | null;
  botCombo: BotComboDisplay | null;
  lastCapture: LastCaptureInfo | null;
  gameOver: { winner: number; winnerName: string } | null;
  actions: GameActions;
  onHome: () => void;
  onPlayAgain: () => void;
}

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const SLOT_LABELS: Record<ComboSlot, string> = {
  base: 'BASE', combo1: 'COMBO 1', combo2: 'COMBO 2', combo3: 'COMBO 3',
};
const BOT_COLORS: Record<Difficulty, { fill: string; border: string; name: string }> = {
  beginner:     { fill: C.botCalvin, border: '#93C5FD', name: 'Calvin' },
  intermediate: { fill: C.botNina, border: '#C4B5FD', name: 'Nina' },
  advanced:     { fill: C.botRex, border: '#FCA5A5', name: 'Rex' },
};
const BOARD_GAP = 6;
const MIN_BOARD_CARD_W = 40;

export function GameView({
  state, isPlayerTurn, botViz, botCombo, lastCapture, gameOver, actions, onHome, onPlayAgain,
}: Props) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<ComboSlot | null>(null);
  const [hoveredBoard, setHoveredBoard] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [, setDraggingSource] = useState<CardSource | null>(null);
  const lastHitRef = useRef(0);

  const stagedIds = useMemo(() => {
    const ids = new Set<string>();
    if (state.combination.base) ids.add(state.combination.base.id);
    for (const g of state.combination.combo1) ids.add(g.card.id);
    for (const g of state.combination.combo2) ids.add(g.card.id);
    for (const g of state.combination.combo3) ids.add(g.card.id);
    return ids;
  }, [state.combination]);

  const visibleBoard = useMemo(() => state.board.filter((c) => !stagedIds.has(c.id)), [state.board, stagedIds]);
  const visibleHand = useMemo(() => state.hands[0].filter((c) => !stagedIds.has(c.id)), [state.hands, stagedIds]);
  const hasCombo = state.combination.base !== null || state.combination.combo1.length > 0 || state.combination.combo2.length > 0 || state.combination.combo3.length > 0;
  const comboValid = useMemo(() => hasCombo && validateFullCombo(state).isValid, [state, hasCombo]);
  const target = state.settings.targetScore;
  const bot1Info = BOT_COLORS[state.settings.bot1Personality];
  const bot2Info = BOT_COLORS[state.settings.bot2Personality];

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

  // ── Dynamic board card width ───────────────────────

  const boardCardScale = useMemo(() => {
    if (visibleBoard.length === 0) return 1;
    // Estimate available width (~70% of viewport minus gaps)
    const avail = typeof window !== 'undefined' ? window.innerWidth * 0.6 : 500;
    const idealTotal = CARD_W * visibleBoard.length + BOARD_GAP * (visibleBoard.length - 1);
    if (idealTotal <= avail) return 1;
    const maxW = (avail - BOARD_GAP * (visibleBoard.length - 1)) / visibleBoard.length;
    return Math.max(MIN_BOARD_CARD_W / CARD_W, maxW / CARD_W);
  }, [visibleBoard.length]);

  // ── Combo display (player combo or bot combo) ──────

  const displayCombo = useMemo((): { base: Card | null; slots: Card[][] } => {
    if (botCombo) {
      return {
        base: botCombo.baseCard,
        slots: [botCombo.comboCards.slice(0, 3), botCombo.comboCards.slice(3, 6), botCombo.comboCards.slice(6)],
      };
    }
    return {
      base: state.combination.base,
      slots: [
        state.combination.combo1.map((g) => g.card),
        state.combination.combo2.map((g) => g.card),
        state.combination.combo3.map((g) => g.card),
      ],
    };
  }, [state.combination, botCombo]);

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: C.slateBg,
      display: 'grid',
      gridTemplateColumns: '72px 1fr 72px',
      gridTemplateRows: '40px auto 1fr auto 100px',
      gridTemplateAreas: `"score score score" "lc lc lc" "bot1 board bot2" "combo combo combo" "hand hand hand"`,
      overflow: 'hidden', touchAction: 'none',
    }}>

      {/* ═══ SCORE BAR ═══ */}
      <div style={{ gridArea: 'score', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: C.slateBg, borderBottom: `1px solid ${C.divider}` }}>
        <ScoreBlock label="YOU" labelColor={C.textSecondary} score={state.overallScores.player} target={target} active={state.currentPlayer === 0} amber />
        <ScoreBlock label={bot1Info.name} labelColor={bot1Info.fill} score={state.overallScores.bot1} target={target} active={state.currentPlayer === 1} />
        <ScoreBlock label={bot2Info.name} labelColor={bot2Info.fill} score={state.overallScores.bot2} target={target} active={state.currentPlayer === 2} />
        <span style={{ color: C.textSecondary, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>R{state.currentRound}</span>
      </div>

      {/* ═══ LAST CAPTURE ═══ */}
      <div style={{ gridArea: 'lc' }}>
        <LastCaptureCallout info={lastCapture} />
      </div>

      {/* ═══ BOT 1 ═══ */}
      <BotBadge area="bot1" info={bot1Info} handCount={state.hands[1].length} hand={state.hands[1]} thinking={botViz?.playerIndex === 1 && botViz.type === 'thinking'} />

      {/* ═══ BOARD ZONE ═══ */}
      <div ref={boardRef} onClick={handleBoardAreaTap} style={{
        gridArea: 'board', display: 'flex', flexWrap: 'wrap', gap: BOARD_GAP,
        justifyContent: 'center', alignItems: 'center', alignContent: 'center',
        padding: '8px 4px', background: C.board, borderRadius: 8,
        border: hoveredBoard ? `1px solid ${C.success}` : `1px solid ${C.divider}`,
        boxShadow: hoveredBoard ? `0 0 12px rgba(16,185,129,0.15)` : 'none',
        transition: 'border 150ms, box-shadow 150ms, background 150ms',
        minHeight: 0,
      }}>
        {visibleBoard.length === 0 && !botCombo && (
          <span style={{ fontSize: 11, color: C.disabledText, fontFamily: 'Inter, sans-serif' }}>Board empty</span>
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
      </div>

      {/* ═══ BOT 2 ═══ */}
      <BotBadge area="bot2" info={bot2Info} handCount={state.hands[2].length} hand={state.hands[2]} thinking={botViz?.playerIndex === 2 && botViz.type === 'thinking'} />

      {/* ═══ COMBO ZONE ═══ */}
      <div style={{
        gridArea: 'combo', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 6, padding: '6px 8px',
        background: '#222236', position: 'relative',
      }}>
        {/* Thinking bubble between board and combo */}
        <ThinkingBubble
          visible={!!botViz && botViz.type === 'thinking'}
          difficulty={(botViz?.playerIndex ?? 1) === 1 ? state.settings.bot1Personality : state.settings.bot2Personality}
        />

        {/* Slots */}
        <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center' }}>
          {SLOT_KEYS.map((key, i) => {
            const slotIdx = i; // 0=base,1=combo1,2=combo2,3=combo3
            const staged = slotIdx === 0 ? (displayCombo.base ? [displayCombo.base] : []) : displayCombo.slots[slotIdx - 1];
            const filled = staged.length > 0;
            const isBase = key === 'base';
            const isHovered = hoveredSlot === key && draggingCardId !== null;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: '1 1 0', maxWidth: 72 }}>
                <span style={{ fontSize: 8, color: C.textSecondary, fontWeight: 500, letterSpacing: 1, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>{SLOT_LABELS[key]}</span>
                <div
                  ref={(el) => { slotRefs.current[i] = el; }}
                  onClick={(e) => { e.stopPropagation(); handleSlotTap(key); }}
                  style={{
                    width: '100%', aspectRatio: '2.5/3.5', borderRadius: 6,
                    border: isHovered ? `2px solid ${C.indigo}` : isBase ? (filled ? `2px solid ${C.indigo}` : `1px solid ${C.indigo}`) : (filled ? `2px solid ${C.indigo}` : `1px dashed ${C.slotEmpty}`),
                    boxShadow: isHovered ? '0 0 8px rgba(79,70,229,0.4)' : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    background: isHovered ? 'rgba(79,70,229,0.12)' : filled ? 'rgba(79,70,229,0.06)' : 'transparent',
                    transition: 'border 150ms, box-shadow 150ms, background 150ms',
                  }}
                >
                  {filled ? staged.map((c) => (
                    <div key={c.id} onClick={(e) => { e.stopPropagation(); handleStagedCardTap(c.id); }} style={{ cursor: 'pointer' }}>
                      <CardComponent card={c} small />
                    </div>
                  )) : (
                    <span style={{ fontSize: 9, color: C.disabledText, fontFamily: 'Inter, sans-serif' }}>EMPTY</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        {isPlayerTurn && hasCombo && !botCombo && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn label="SUBMIT" primary disabled={!comboValid} onClick={handleSubmit} />
            <Btn label="RESET" onClick={actions.resetCombo} />
          </div>
        )}
        {error && <span style={{ fontSize: 11, color: C.error }}>{error}</span>}
      </div>

      {/* ═══ PLAYER HAND ═══ */}
      <div style={{
        gridArea: 'hand', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        background: '#1A1A28', borderTop: `1px solid ${C.divider}`,
      }}>
        <span style={{ fontSize: 9, color: C.textSecondary, letterSpacing: 1, fontWeight: 500, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>YOUR HAND</span>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
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
      </div>

      {/* ═══ GAME OVER ═══ */}
      {gameOver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 200 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: gameOver.winner === 0 ? C.amber : C.textPrimary }}>
            {gameOver.winner === 0 ? 'YOU WIN!' : 'GAME OVER'}
          </h1>
          <p style={{ fontSize: 16, color: C.textSecondary, fontFamily: 'Inter, sans-serif' }}>
            {gameOver.winnerName} — {state.overallScores[SCORE_KEYS[gameOver.winner as 0|1|2]]}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Btn label="PLAY AGAIN" primary onClick={onPlayAgain} big />
            <Btn label="HOME" onClick={onHome} big />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function ScoreBlock({ label, labelColor, score, target, active, amber }: {
  label: string; labelColor: string; score: number; target: number; active: boolean; amber?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: active ? `3px solid ${C.indigo}` : '3px solid transparent', paddingBottom: 1, transition: 'border-color 200ms' }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: labelColor, letterSpacing: 1, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ color: amber ? C.amber : C.textPrimary, fontWeight: 700, fontSize: 20, fontFamily: "'JetBrains Mono', monospace" }}>{score}</span>
        <span style={{ color: C.textSecondary, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", opacity: 0.6 }}>/{target}</span>
      </div>
    </div>
  );
}

function BotBadge({ area, info, handCount, hand, thinking }: {
  area: string; info: { fill: string; border: string; name: string }; handCount: number; hand: readonly Card[]; thinking: boolean;
}) {
  return (
    <div style={{ gridArea: area, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: info.fill, border: `2px solid ${info.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 700, fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{info.name[0]}</div>
      <span style={{ fontSize: 10, fontWeight: 600, color: info.fill, fontFamily: 'Inter, sans-serif' }}>{info.name}</span>
      <span style={{ fontSize: 9, color: C.textSecondary, fontFamily: 'Inter, sans-serif' }}>{handCount}</span>
      <div style={{ position: 'relative', width: 28, height: 16 + Math.min(hand.length, 4) * 5 }}>
        {hand.slice(0, 4).map((c, i) => (
          <div key={c.id} style={{ position: 'absolute', top: i * 5, left: 0, width: 28, height: 16, borderRadius: 3, background: C.indigo, border: `1px solid ${C.indigoHover}` }} />
        ))}
      </div>
      {thinking && <span style={{ fontSize: 9, color: info.fill, fontStyle: 'italic' }}>...</span>}
    </div>
  );
}

function Btn({ label, primary, disabled, big, onClick }: {
  label: string; primary?: boolean; disabled?: boolean; big?: boolean; onClick: () => void;
}) {
  return (
    <motion.button onClick={onClick} disabled={disabled} whileTap={disabled ? undefined : { scale: 0.97 }} transition={getTransition('snappy')} style={{
      padding: big ? '10px 24px' : '5px 14px', borderRadius: 6,
      border: primary ? 'none' : `1px solid ${C.textSecondary}`,
      background: primary ? (disabled ? C.disabled : C.indigo) : 'transparent',
      color: primary ? (disabled ? C.disabledText : C.card) : C.textSecondary,
      fontSize: big ? 15 : 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
      cursor: disabled ? 'default' : 'pointer',
    }}>{label}</motion.button>
  );
}

function nextEmptySlot(combo: GameState['combination']): Exclude<ComboSlot, 'base'> | null {
  if (combo.combo1.length === 0) return 'combo1';
  if (combo.combo2.length === 0) return 'combo2';
  if (combo.combo3.length === 0) return 'combo3';
  return null;
}
