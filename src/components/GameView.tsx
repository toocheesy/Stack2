import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComboSlot, GameState } from '../engine/types';
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

  // ─── Drop target hit-testing ─────────────────────

  const findDropTarget = useCallback(
    (
      point: { x: number; y: number },
    ): { type: 'slot'; slot: ComboSlot } | { type: 'board' } | null => {
      // Check slots first (they're inside the board area)
      for (let i = 0; i < slotRefs.current.length; i++) {
        const el = slotRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          point.x >= r.left &&
          point.x <= r.right &&
          point.y >= r.top &&
          point.y <= r.bottom
        ) {
          return { type: 'slot', slot: SLOT_KEYS[i] };
        }
      }
      // Then check board area (for placement)
      const bel = boardRef.current;
      if (bel) {
        const r = bel.getBoundingClientRect();
        if (
          point.x >= r.left &&
          point.x <= r.right &&
          point.y >= r.top &&
          point.y <= r.bottom
        ) {
          return { type: 'board' };
        }
      }
      return null;
    },
    [],
  );

  // ─── Drag end handler (used by ALL draggable cards) ─

  const handleDragEnd = useCallback(
    (cardId: string, source: CardSource, point: { x: number; y: number }) => {
      if (!isPlayerTurn) return;
      const target = findDropTarget(point);
      if (!target) return; // snap back, no action

      if (target.type === 'slot') {
        // Dropped on a specific slot — use THAT slot
        actions.addToCombo(cardId, source, target.slot);
      } else if (target.type === 'board' && source === 'hand') {
        // Hand card dropped on board area = PLACE (turn ends)
        actions.placeCard(cardId);
        setSelectedHandCard(null);
      }
      // Board card dropped on board area = no-op (snap back)
    },
    [isPlayerTurn, findDropTarget, actions],
  );

  // ─── Tap handlers (fallback — auto-route) ─────────

  const handleHandTap = useCallback(
    (cardId: string) => {
      if (!isPlayerTurn) return;
      // Toggle selection
      if (selectedHandCard === cardId) {
        setSelectedHandCard(null);
        return;
      }
      setSelectedHandCard(cardId);
    },
    [isPlayerTurn, selectedHandCard],
  );

  const handleBoardTap = useCallback(
    (cardId: string) => {
      if (!isPlayerTurn) return;
      // Auto-route board card to next available slot
      if (!state.combination.base) {
        actions.addToCombo(cardId, 'board', 'base');
      } else {
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
        // Selected hand card goes into tapped slot
        actions.addToCombo(selectedHandCard, 'hand', slot);
        setSelectedHandCard(null);
      } else if (hasCombo) {
        // Tap a filled slot = reset combo
        actions.resetCombo();
      }
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
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 2000);
    }
  }, [actions]);

  const handlePlace = useCallback(() => {
    if (!selectedHandCard) return;
    actions.placeCard(selectedHandCard);
    setSelectedHandCard(null);
  }, [selectedHandCard, actions]);

  // ─── Render ───────────────────────────────────────

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: '#1E1E2E',
        display: 'grid',
        gridTemplateColumns: '90px 1fr 90px',
        gridTemplateRows: '36px 1fr 110px',
        gridTemplateAreas: `"score score score" "bot1 board bot2" "hand hand hand"`,
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* ── Score bar ── */}
      <div
        style={{
          gridArea: 'score',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          background: '#1A1A28',
          borderBottom: '1px solid #3A3A50',
          fontSize: 12,
        }}
      >
        <ScoreBlock label="YOU" score={state.scores.player} active={state.currentPlayer === 0} amber />
        <ScoreBlock label="BOT 1" score={state.scores.bot1} active={state.currentPlayer === 1} />
        <ScoreBlock label="BOT 2" score={state.scores.bot2} active={state.currentPlayer === 2} />
        <span style={{ color: '#8B8BA3', fontSize: 11 }}>R{state.currentRound}</span>
      </div>

      {/* ── Bot 1 (left) ── */}
      <BotColumn index={1} hand={state.hands[1]} botViz={botViz} />

      {/* ── Board area ── */}
      <div
        ref={boardRef}
        onClick={handleBoardAreaTap}
        style={{
          gridArea: 'board',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '6px 6px',
          background: '#252538',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Combo slots */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {SLOT_KEYS.map((key, i) => {
            const staged =
              key === 'base'
                ? state.combination.base
                  ? [state.combination.base]
                  : []
                : state.combination[key].map((g) => g.card);
            return (
              <div
                key={key}
                ref={(el) => {
                  slotRefs.current[i] = el;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSlotTap(key);
                }}
                style={{
                  width: 58,
                  height: 82,
                  borderRadius: 6,
                  border:
                    key === 'base'
                      ? '2px solid #4F46E5'
                      : staged.length > 0
                      ? '2px solid #4F46E5'
                      : '2px dashed #4A4A5A',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  flexShrink: 0,
                  background:
                    staged.length > 0 ? 'rgba(79,70,229,0.08)' : 'transparent',
                }}
              >
                {staged.length > 0 ? (
                  staged.map((c) => (
                    <CardComponent key={c.id} card={c} small />
                  ))
                ) : (
                  <>
                    <span style={{ fontSize: 7, color: '#5A5A70', fontWeight: 500 }}>
                      {SLOT_LABELS[key]}
                    </span>
                    <span style={{ fontSize: 8, color: '#3A3A50' }}>EMPTY</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        {isPlayerTurn && (
          <div
            style={{ display: 'flex', gap: 6, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {hasCombo && (
              <>
                <Btn
                  label="SUBMIT"
                  primary
                  disabled={!comboValid}
                  onClick={handleSubmit}
                />
                <Btn label="RESET" onClick={actions.resetCombo} />
              </>
            )}
            {selectedHandCard && (
              <Btn label="PLACE" primary onClick={handlePlace} />
            )}
          </div>
        )}

        {error && (
          <span style={{ fontSize: 11, color: '#EF4444' }}>{error}</span>
        )}

        {/* Board cards */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
            flex: 1,
            alignItems: 'center',
          }}
        >
          {visibleBoard.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              draggable={isPlayerTurn}
              onTap={() => handleBoardTap(card.id)}
              onDragEnd={(pt) => handleDragEnd(card.id, 'board', pt)}
            />
          ))}
        </div>
      </div>

      {/* ── Bot 2 (right) ── */}
      <BotColumn index={2} hand={state.hands[2]} botViz={botViz} />

      {/* ── Player hand ── */}
      <div
        style={{
          gridArea: 'hand',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          background: '#1A1A28',
          borderTop: '1px solid #3A3A50',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: '#8B8BA3',
            letterSpacing: 1,
            fontWeight: 500,
          }}
        >
          YOUR HAND
        </span>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {visibleHand.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              selected={selectedHandCard === card.id}
              draggable={isPlayerTurn}
              onTap={() => handleHandTap(card.id)}
              onDragEnd={(pt) => handleDragEnd(card.id, 'hand', pt)}
            />
          ))}
        </div>
      </div>

      {/* ── Game over overlay ── */}
      {gameOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            zIndex: 200,
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: gameOver.winner === 0 ? '#F59E0B' : '#F1F1F3',
            }}
          >
            {gameOver.winner === 0 ? 'YOU WIN!' : 'GAME OVER'}
          </h1>
          <p style={{ fontSize: 16, color: '#8B8BA3' }}>
            {gameOver.winnerName} —{' '}
            {
              state.overallScores[
                SCORE_KEYS[gameOver.winner as 0 | 1 | 2]
              ]
            }
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

function ScoreBlock({
  label,
  score,
  active,
  amber,
}: {
  label: string;
  score: number;
  active: boolean;
  amber?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderBottom: active ? '2px solid #4F46E5' : '2px solid transparent',
        paddingBottom: 2,
      }}
    >
      <span style={{ color: '#8B8BA3', fontSize: 11 }}>{label}</span>
      <span
        style={{
          color: amber ? '#F59E0B' : '#F1F1F3',
          fontWeight: 700,
          fontSize: 15,
          fontFamily: 'monospace',
        }}
      >
        {score}
      </span>
    </div>
  );
}

function BotColumn({
  index,
  hand,
  botViz,
}: {
  index: 1 | 2;
  hand: readonly import('../engine/types').Card[];
  botViz: BotVizStep | null;
}) {
  return (
    <div
      style={{
        gridArea: index === 1 ? 'bot1' : 'bot2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 4,
      }}
    >
      <span style={{ fontSize: 10, color: '#8B8BA3' }}>
        Bot {index} ({hand.length})
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {hand.slice(0, 4).map((c) => (
          <CardComponent key={c.id} card={c} faceDown small />
        ))}
      </div>
      {botViz?.playerIndex === index && botViz.type === 'thinking' && (
        <span
          style={{
            fontSize: 11,
            color: index === 1 ? '#60A5FA' : '#A78BFA',
            marginTop: 4,
          }}
        >
          thinking...
        </span>
      )}
    </div>
  );
}

function Btn({
  label,
  primary,
  disabled,
  big,
  onClick,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  big?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: big ? '10px 24px' : '5px 14px',
        borderRadius: 6,
        border: primary ? 'none' : '1px solid #8B8BA3',
        background: primary
          ? disabled
            ? '#2A2A3D'
            : '#4F46E5'
          : 'transparent',
        color: primary ? (disabled ? '#5A5A70' : '#FFF') : '#8B8BA3',
        fontSize: big ? 15 : 12,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function nextEmptySlot(
  combo: GameState['combination'],
): Exclude<ComboSlot, 'base'> | null {
  if (combo.combo1.length === 0) return 'combo1';
  if (combo.combo2.length === 0) return 'combo2';
  if (combo.combo3.length === 0) return 'combo3';
  return null;
}
