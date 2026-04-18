import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComboSlot, Difficulty, GameState } from '../engine/types';
import { SCORE_KEYS } from '../engine/types';
import type { GameActions, BotVizStep } from '../game/useGameController';
import { CardComponent } from './Card';
import { validateFullCombo } from '../engine/core/captureValidator';

type CardSource = 'hand' | 'board';

interface Props {
  state: GameState;
  isPlayerTurn: boolean;
  botViz: BotVizStep | null;
  gameOver: { winner: number; winnerName: string } | null;
  actions: GameActions;
  onHome: () => void;
  onPlayAgain: () => void;
}

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const SLOT_LABELS: Record<ComboSlot, string> = {
  base: 'BASE',
  combo1: 'COMBO 1',
  combo2: 'COMBO 2',
  combo3: 'COMBO 3',
};

const BOT_COLORS: Record<Difficulty, { fill: string; border: string; name: string }> = {
  beginner:     { fill: '#60A5FA', border: '#93C5FD', name: 'Calvin' },
  intermediate: { fill: '#A78BFA', border: '#C4B5FD', name: 'Nina' },
  advanced:     { fill: '#EF4444', border: '#FCA5A5', name: 'Rex' },
};

export function GameView({
  state,
  isPlayerTurn,
  botViz,
  gameOver,
  actions,
  onHome,
  onPlayAgain,
}: Props) {
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);

  const stagedIds = useMemo(() => {
    const ids = new Set<string>();
    if (state.combination.base) ids.add(state.combination.base.id);
    for (const g of state.combination.combo1) ids.add(g.card.id);
    for (const g of state.combination.combo2) ids.add(g.card.id);
    for (const g of state.combination.combo3) ids.add(g.card.id);
    return ids;
  }, [state.combination]);

  const visibleBoard = useMemo(
    () => state.board.filter((c) => !stagedIds.has(c.id)),
    [state.board, stagedIds],
  );
  const visibleHand = useMemo(
    () => state.hands[0].filter((c) => !stagedIds.has(c.id)),
    [state.hands, stagedIds],
  );

  const hasCombo =
    state.combination.base !== null ||
    state.combination.combo1.length > 0 ||
    state.combination.combo2.length > 0 ||
    state.combination.combo3.length > 0;

  const comboValid = useMemo(() => {
    if (!hasCombo) return false;
    return validateFullCombo(state).isValid;
  }, [state, hasCombo]);

  const target = state.settings.targetScore;
  const bot1Info = BOT_COLORS[state.settings.bot1Personality];
  const bot2Info = BOT_COLORS[state.settings.bot2Personality];

  // ─── Drop target hit-testing ─────────────────────

  const findDropTarget = useCallback(
    (point: { x: number; y: number }): { type: 'slot'; slot: ComboSlot } | { type: 'board' } | null => {
      for (let i = 0; i < slotRefs.current.length; i++) {
        const el = slotRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
          return { type: 'slot', slot: SLOT_KEYS[i] };
        }
      }
      const bel = boardRef.current;
      if (bel) {
        const r = bel.getBoundingClientRect();
        if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
          return { type: 'board' };
        }
      }
      return null;
    },
    [],
  );

  const handleDragEnd = useCallback(
    (cardId: string, source: CardSource, point: { x: number; y: number }) => {
      if (!isPlayerTurn) return;
      const t = findDropTarget(point);
      if (!t) return;
      if (t.type === 'slot') actions.addToCombo(cardId, source, t.slot);
      else if (t.type === 'board' && source === 'hand') {
        actions.placeCard(cardId);
        setSelectedHandCard(null);
      }
    },
    [isPlayerTurn, findDropTarget, actions],
  );

  const handleHandTap = useCallback((cardId: string) => {
    if (!isPlayerTurn) return;
    setSelectedHandCard((prev) => (prev === cardId ? null : cardId));
  }, [isPlayerTurn]);

  const handleBoardTap = useCallback(
    (cardId: string) => {
      if (!isPlayerTurn) return;
      if (!state.combination.base) actions.addToCombo(cardId, 'board', 'base');
      else {
        const slot = nextEmptySlot(state.combination);
        if (slot) actions.addToCombo(cardId, 'board', slot);
      }
    },
    [isPlayerTurn, state.combination, actions],
  );

  const handleSlotTap = useCallback(
    (slot: ComboSlot) => {
      if (!isPlayerTurn) return;
      if (selectedHandCard) {
        actions.addToCombo(selectedHandCard, 'hand', slot);
        setSelectedHandCard(null);
      } else if (hasCombo) actions.resetCombo();
    },
    [isPlayerTurn, selectedHandCard, hasCombo, actions],
  );

  const handleBoardAreaTap = useCallback(() => {
    if (!isPlayerTurn || !selectedHandCard) return;
    actions.placeCard(selectedHandCard);
    setSelectedHandCard(null);
  }, [isPlayerTurn, selectedHandCard, actions]);

  const handleSubmit = useCallback(() => {
    const err = actions.submitCombo();
    if (err) { setError(err); setTimeout(() => setError(null), 2000); }
  }, [actions]);

  // ─── Render ───────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: '#1E1E2E',
      display: 'grid',
      gridTemplateColumns: '80px 1fr 80px',
      gridTemplateRows: '40px 1fr 110px',
      gridTemplateAreas: `"score score score" "bot1 board bot2" "hand hand hand"`,
      overflow: 'hidden', touchAction: 'none',
    }}>

      {/* ═══ SCORE BAR ═══ */}
      <div style={{
        gridArea: 'score', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
        background: '#1E1E2E', borderBottom: '1px solid #3A3A50',
      }}>
        <ScoreBlock
          label="YOU" labelColor="#8B8BA3"
          score={state.scores.player} target={target}
          active={state.currentPlayer === 0} amber
        />
        <ScoreBlock
          label={bot1Info.name} labelColor={bot1Info.fill}
          score={state.scores.bot1} target={target}
          active={state.currentPlayer === 1}
        />
        <ScoreBlock
          label={bot2Info.name} labelColor={bot2Info.fill}
          score={state.scores.bot2} target={target}
          active={state.currentPlayer === 2}
        />
        <span style={{ color: '#8B8BA3', fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
          R{state.currentRound}
        </span>
      </div>

      {/* ═══ BOT 1 BADGE ═══ */}
      <BotBadge
        area="bot1"
        info={bot1Info}
        handCount={state.hands[1].length}
        hand={state.hands[1]}
        thinking={botViz?.playerIndex === 1 && botViz.type === 'thinking'}
      />

      {/* ═══ PLAY AREA ═══ */}
      <div
        ref={boardRef}
        onClick={handleBoardAreaTap}
        style={{
          gridArea: 'board', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 8, padding: '6px 4px',
          background: '#252538', borderRadius: 8, overflow: 'hidden',
        }}
      >
        {/* Combo slots */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, width: '100%', justifyContent: 'center' }}>
          {SLOT_KEYS.map((key, i) => {
            const staged = key === 'base'
              ? state.combination.base ? [state.combination.base] : []
              : state.combination[key].map((g) => g.card);
            const filled = staged.length > 0;
            const isBase = key === 'base';
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: '1 1 0', maxWidth: 72 }}>
                <span style={{ fontSize: 8, color: '#8B8BA3', fontWeight: 500, letterSpacing: 1, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' as const }}>
                  {SLOT_LABELS[key]}
                </span>
                <div
                  ref={(el) => { slotRefs.current[i] = el; }}
                  onClick={(e) => { e.stopPropagation(); handleSlotTap(key); }}
                  style={{
                    width: '100%', aspectRatio: '2.5/3.5',
                    borderRadius: 6,
                    border: isBase
                      ? (filled ? '2px solid #4F46E5' : '1px solid #4F46E5')
                      : (filled ? '2px solid #4F46E5' : '1px dashed #4A4A5A'),
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    background: filled ? 'rgba(79,70,229,0.08)' : 'transparent',
                    transition: 'border 150ms, box-shadow 150ms',
                  }}
                >
                  {filled ? (
                    staged.map((c) => <CardComponent key={c.id} card={c} small />)
                  ) : (
                    <span style={{ fontSize: 9, color: '#5A5A70', fontFamily: 'Inter, sans-serif' }}>EMPTY</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        {isPlayerTurn && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {hasCombo && (
              <>
                <Btn label="SUBMIT" primary disabled={!comboValid} onClick={handleSubmit} />
                <Btn label="RESET" onClick={actions.resetCombo} />
              </>
            )}
          </div>
        )}
        {error && <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>}

        {/* Board cards */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          justifyContent: 'center', flex: 1, alignItems: 'center',
        }}>
          {visibleBoard.map((card) => (
            <CardComponent key={card.id} card={card}
              draggable={isPlayerTurn}
              onTap={() => handleBoardTap(card.id)}
              onDragEnd={(pt) => handleDragEnd(card.id, 'board', pt)}
            />
          ))}
        </div>
      </div>

      {/* ═══ BOT 2 BADGE ═══ */}
      <BotBadge
        area="bot2"
        info={bot2Info}
        handCount={state.hands[2].length}
        hand={state.hands[2]}
        thinking={botViz?.playerIndex === 2 && botViz.type === 'thinking'}
      />

      {/* ═══ PLAYER HAND ═══ */}
      <div style={{
        gridArea: 'hand', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        background: '#1A1A28', borderTop: '1px solid #3A3A50',
      }}>
        <span style={{ fontSize: 9, color: '#8B8BA3', letterSpacing: 1, fontWeight: 500, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' as const }}>
          YOUR HAND
        </span>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {visibleHand.map((card) => (
            <CardComponent key={card.id} card={card}
              selected={selectedHandCard === card.id}
              draggable={isPlayerTurn}
              onTap={() => handleHandTap(card.id)}
              onDragEnd={(pt) => handleDragEnd(card.id, 'hand', pt)}
            />
          ))}
        </div>
      </div>

      {/* ═══ GAME OVER ═══ */}
      {gameOver && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, zIndex: 200,
        }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: gameOver.winner === 0 ? '#F59E0B' : '#F1F1F3' }}>
            {gameOver.winner === 0 ? 'YOU WIN!' : 'GAME OVER'}
          </h1>
          <p style={{ fontSize: 16, color: '#8B8BA3', fontFamily: 'Inter, sans-serif' }}>
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

// ─── Sub-components ─────────────────────────────────

function ScoreBlock({ label, labelColor, score, target, active, amber }: {
  label: string; labelColor: string; score: number; target: number; active: boolean; amber?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      borderBottom: active ? '3px solid #4F46E5' : '3px solid transparent',
      paddingBottom: 1, transition: 'border-color 200ms',
    }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: labelColor, letterSpacing: 1, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' as const }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ color: amber ? '#F59E0B' : '#F1F1F3', fontWeight: 700, fontSize: 20, fontFamily: "'JetBrains Mono', monospace" }}>
          {score}
        </span>
        <span style={{ color: '#8B8BA3', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", opacity: 0.6 }}>
          /{target}
        </span>
      </div>
    </div>
  );
}

function BotBadge({ area, info, handCount, hand, thinking }: {
  area: string;
  info: { fill: string; border: string; name: string };
  handCount: number;
  hand: readonly import('../engine/types').Card[];
  thinking: boolean;
}) {
  return (
    <div style={{
      gridArea: area, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6, padding: 4,
    }}>
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 18,
        background: info.fill, border: `2px solid ${info.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#FFF', fontWeight: 700, fontSize: 16, fontFamily: 'Inter, sans-serif',
      }}>
        {info.name[0]}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: info.fill, fontFamily: 'Inter, sans-serif' }}>
        {info.name}
      </span>
      <span style={{ fontSize: 10, color: '#8B8BA3', fontFamily: 'Inter, sans-serif' }}>
        {handCount} cards
      </span>
      {/* Mini card stack */}
      <div style={{ position: 'relative', width: 32, height: 20 + Math.min(hand.length, 4) * 6 }}>
        {hand.slice(0, 4).map((c, i) => (
          <div key={c.id} style={{
            position: 'absolute', top: i * 6, left: 0,
            width: 32, height: 20, borderRadius: 3,
            background: '#4F46E5', border: '1px solid #6366F1',
          }} />
        ))}
      </div>
      {thinking && (
        <span style={{ fontSize: 10, color: info.fill, fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>
          thinking...
        </span>
      )}
    </div>
  );
}

function Btn({ label, primary, disabled, big, onClick }: {
  label: string; primary?: boolean; disabled?: boolean; big?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: big ? '10px 24px' : '5px 14px', borderRadius: 6,
      border: primary ? 'none' : '1px solid #8B8BA3',
      background: primary ? (disabled ? '#2A2A3D' : '#4F46E5') : 'transparent',
      color: primary ? (disabled ? '#5A5A70' : '#FFF') : '#8B8BA3',
      fontSize: big ? 15 : 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
      cursor: disabled ? 'default' : 'pointer',
    }}>
      {label}
    </button>
  );
}

function nextEmptySlot(combo: GameState['combination']): Exclude<ComboSlot, 'base'> | null {
  if (combo.combo1.length === 0) return 'combo1';
  if (combo.combo2.length === 0) return 'combo2';
  if (combo.combo3.length === 0) return 'combo3';
  return null;
}
