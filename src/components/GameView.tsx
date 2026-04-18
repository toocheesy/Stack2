import { useCallback, useMemo, useRef, useState } from 'react';
import type { ComboSlot, GameState } from '../engine/types';
import { SCORE_KEYS } from '../engine/types';
import type { GameActions, BotVizStep } from '../game/useGameController';
import { CardComponent, CARD_W, CARD_H } from './Card';
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

  const handleCardDrop = useCallback(
    (cardId: string, source: CardSource, point: { x: number; y: number }) => {
      if (!isPlayerTurn) return;
      const target = findDropTarget(point);
      if (!target) return;
      if (target.type === 'slot') {
        actions.addToCombo(cardId, source, target.slot);
      } else if (target.type === 'board' && source === 'hand') {
        actions.placeCard(cardId);
      }
    },
    [isPlayerTurn, findDropTarget, actions],
  );

  const handleHandTap = useCallback(
    (cardId: string) => {
      if (!isPlayerTurn) return;
      if (!state.combination.base) {
        actions.addToCombo(cardId, 'hand', 'base');
      } else {
        const slot = nextEmptySlot(state.combination);
        if (slot) actions.addToCombo(cardId, 'hand', slot);
      }
    },
    [isPlayerTurn, state.combination, actions],
  );

  const handleBoardTap = useCallback(
    (cardId: string) => {
      if (!isPlayerTurn) return;
      if (!state.combination.base) {
        actions.addToCombo(cardId, 'board', 'base');
      } else {
        const slot = nextEmptySlot(state.combination);
        if (slot) actions.addToCombo(cardId, 'board', slot);
      }
    },
    [isPlayerTurn, state.combination, actions],
  );

  const handleSubmit = useCallback(() => {
    const err = actions.submitCombo();
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 2000);
    }
  }, [actions]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: '#1E1E2E',
        display: 'grid',
        gridTemplateColumns: '100px 1fr 100px',
        gridTemplateRows: '36px 1fr 110px',
        gridTemplateAreas: `"score score score" "bot1 board bot2" "hand hand hand"`,
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* Score bar */}
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

      {/* Bot 1 */}
      <div
        style={{
          gridArea: 'bot1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10, color: '#8B8BA3' }}>Bot 1</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: -20 }}>
          {state.hands[1].map((c) => (
            <CardComponent key={c.id} card={c} faceDown small />
          ))}
        </div>
        {botViz?.playerIndex === 1 && botViz.type === 'thinking' && (
          <span style={{ fontSize: 11, color: '#60A5FA' }}>thinking...</span>
        )}
      </div>

      {/* Board area */}
      <div
        ref={boardRef}
        style={{
          gridArea: 'board',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 12,
          padding: '8px 8px',
          background: '#252538',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Combo slots */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
                ref={(el) => { slotRefs.current[i] = el; }}
                onClick={() => {
                  if (staged.length > 0) actions.resetCombo();
                }}
                style={{
                  width: CARD_W + 8,
                  height: CARD_H + 8,
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
                }}
              >
                {staged.length > 0 ? (
                  staged.map((c) => (
                    <CardComponent key={c.id} card={c} small />
                  ))
                ) : (
                  <>
                    <span style={{ fontSize: 8, color: '#5A5A70', fontWeight: 500 }}>
                      {SLOT_LABELS[key]}
                    </span>
                    <span style={{ fontSize: 9, color: '#3A3A50' }}>EMPTY</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        {isPlayerTurn && (
          <div style={{ display: 'flex', gap: 8 }}>
            {hasCombo && (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!comboValid}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: comboValid ? '#4F46E5' : '#2A2A3D',
                    color: comboValid ? '#FFF' : '#5A5A70',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: comboValid ? 'pointer' : 'default',
                  }}
                >
                  SUBMIT
                </button>
                <button
                  onClick={actions.resetCombo}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #8B8BA3',
                    background: 'transparent',
                    color: '#8B8BA3',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  RESET
                </button>
              </>
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
          }}
        >
          {visibleBoard.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              draggable={isPlayerTurn}
              onTap={() => handleBoardTap(card.id)}
              onDragEnd={(pt) => handleCardDrop(card.id, 'board', pt)}
            />
          ))}
        </div>
      </div>

      {/* Bot 2 */}
      <div
        style={{
          gridArea: 'bot2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10, color: '#8B8BA3' }}>Bot 2</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: -20 }}>
          {state.hands[2].map((c) => (
            <CardComponent key={c.id} card={c} faceDown small />
          ))}
        </div>
        {botViz?.playerIndex === 2 && botViz.type === 'thinking' && (
          <span style={{ fontSize: 11, color: '#A78BFA' }}>thinking...</span>
        )}
      </div>

      {/* Player hand */}
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
        <span style={{ fontSize: 9, color: '#8B8BA3', letterSpacing: 1, fontWeight: 500 }}>
          YOUR HAND
        </span>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {visibleHand.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              draggable={isPlayerTurn}
              onTap={() => handleHandTap(card.id)}
              onDragEnd={(pt) => handleCardDrop(card.id, 'hand', pt)}
            />
          ))}
        </div>
      </div>

      {/* Game over overlay */}
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
            {gameOver.winnerName} — {state.overallScores[SCORE_KEYS[gameOver.winner as 0|1|2]]}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onPlayAgain}
              style={btnPrimary}
            >
              PLAY AGAIN
            </button>
            <button
              onClick={onHome}
              style={btnOutline}
            >
              HOME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

function nextEmptySlot(
  combo: GameState['combination'],
): Exclude<ComboSlot, 'base'> | null {
  if (combo.combo1.length === 0) return 'combo1';
  if (combo.combo2.length === 0) return 'combo2';
  if (combo.combo3.length === 0) return 'combo3';
  return null;
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 8,
  border: 'none',
  background: '#4F46E5',
  color: '#FFF',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnOutline: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: 8,
  border: '2px solid #8B8BA3',
  background: 'transparent',
  color: '#F1F1F3',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
