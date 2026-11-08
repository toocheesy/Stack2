import type { Ref } from 'react';
import type { Card } from '../../engine/types';
import { CardComponent, HAND_CARD_W } from '../Card';
import { Ghost } from './pieces';

const HAND_CARD_H = 100;

/** Your hand (GB2): cards at 72 x 100 with a 12px gap, a dashed ghost where a
 *  staged card came from, and room above for the lift. */
export function HandRow({ cards, ghosts, draggable, onTap, onDragMove, onDragEnd, rowRef }: {
  cards: readonly Card[];
  ghosts: ReadonlyMap<string, string>;
  draggable: boolean;
  onTap: (card: Card) => void;
  onDragMove: (card: Card, point: { x: number; y: number }) => void;
  onDragEnd: (card: Card, point: { x: number; y: number }) => void;
  rowRef: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={rowRef} style={{
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, paddingTop: 14, marginTop: 18,
      minHeight: HAND_CARD_H + 14, flexShrink: 0, position: 'relative', zIndex: 20,
    }}>
      {cards.map((card) => {
        const ghost = ghosts.get(card.id);
        if (ghost !== undefined) return <Ghost key={card.id} w={HAND_CARD_W} h={HAND_CARD_H} radius={9} label={ghost} fontSize={10} />;
        return (
          <CardComponent key={card.id} card={card} size="hand"
            draggable={draggable}
            onTap={() => onTap(card)}
            onDragMove={(pt) => onDragMove(card, pt)}
            onDragEnd={(pt) => onDragEnd(card, pt)}
          />
        );
      })}
    </div>
  );
}
