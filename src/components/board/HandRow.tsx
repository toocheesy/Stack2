import type { Ref } from 'react';
import type { Card } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { CardComponent, HAND_CARD_W } from '../Card';
import { Ghost } from './pieces';
import type { Point } from './moments';

const HAND_CARD_H = 100;

/** Your hand (GB2): cards at 72 x 100 with a 12px gap, a dashed ghost where a
 *  staged card came from, room above for the lift, and YC1's "No cards left
 *  this hand" once the hand is empty. */
export function HandRow({ cards, ghosts, ghostFade, draggable, emptyWords, compact, onTap, onDragMove, onDragEnd, rowRef }: {
  cards: readonly Card[];
  ghosts: ReadonlyMap<string, string>;
  /** Seconds the ghosts take to fade away (YC1), or none. */
  ghostFade?: number;
  draggable: boolean;
  /** Show "No cards left this hand" when the hand is empty. */
  emptyWords: boolean;
  /** A short screen (ruling 99): less room above the cards. */
  compact?: boolean;
  onTap: (card: Card) => void;
  onDragMove: (card: Card, point: Point) => void;
  onDragEnd: (card: Card, point: Point) => void;
  rowRef: Ref<HTMLDivElement>;
}) {
  const lift = compact ? 6 : 10;
  return (
    <div ref={rowRef} style={{
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, paddingTop: lift, marginTop: compact ? 4 : 8,
      minHeight: HAND_CARD_H + lift, flexShrink: 0, position: 'relative', zIndex: 20,
    }}>
      {cards.length === 0 && emptyWords && (
        <span style={{ alignSelf: 'center', fontFamily: FONTS.sans, fontSize: 13, color: C.muted.classic }}>No cards left this hand</span>
      )}
      {cards.map((card) => {
        const ghost = ghosts.get(card.id);
        if (ghost !== undefined) return <Ghost key={card.id} w={HAND_CARD_W} h={HAND_CARD_H} radius={9} label={ghost} fontSize={10} fade={ghostFade} />;
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
