import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import type { Card } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { CardComponent, TABLE_CARD_W } from '../Card';
import { Ghost } from './pieces';
import { TABLE_CARD_H, TABLE_GAP_X, TABLE_GAP_Y, TABLE_PAD_BOTTOM, TABLE_PAD_TOP, TABLE_PAD_X, tableFit } from './tableFit';

/** The table (GB2): gold-edged, with the deck count in a pill and the table
 *  cards at 54 x 76 with an 8px gap, five across at 390. Rows wrap; when the
 *  rows don't fit the zone the cards scale down together, never above 1. */
export function TableZone({ cards, ghosts, shaded, deckCount, pillSide, highlighted, draggable, onTap, onDragMove, onDragEnd, zoneRef, children }: {
  cards: readonly Card[];
  /** Staged cards by id, with the ghost's label where each came from. */
  ghosts: ReadonlyMap<string, string>;
  /** Table cards no combo could use while you build. */
  shaded: ReadonlySet<string>;
  deckCount: number;
  /** The deck pill sits opposite the speech bubble. */
  pillSide: 'left' | 'right';
  highlighted: boolean;
  draggable: boolean;
  onTap: (card: Card) => void;
  onDragMove: (card: Card, point: { x: number; y: number }) => void;
  onDragEnd: (card: Card, point: { x: number; y: number }) => void;
  zoneRef: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}) {
  const [inner, setInner] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const measure = () => setInner({ w: el.clientWidth - 2 * TABLE_PAD_X, h: el.clientHeight - TABLE_PAD_TOP - TABLE_PAD_BOTTOM });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoneRef]);

  const scale = inner ? tableFit(cards.length, inner.w, inner.h) : 1;

  return (
    <div ref={zoneRef} style={{
      position: 'relative', flex: '1 1 0', minHeight: 0, marginTop: 12, boxSizing: 'border-box',
      padding: `${TABLE_PAD_TOP}px ${TABLE_PAD_X}px ${TABLE_PAD_BOTTOM}px`, background: C.surface.classic,
      border: `1px solid ${C.classicGold}`, outline: highlighted ? `1px solid ${C.classicGold}` : undefined, borderRadius: 6,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
      <span style={{
        position: 'absolute', top: 12, ...(pillSide === 'left' ? { left: 12 } : { right: 12 }),
        padding: '3px 8px', borderRadius: 999, border: `1px solid ${C.line.classic}`,
        fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.2, color: C.ink.classic,
      }}>
        DECK {deckCount}
      </span>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center',
        gap: `${TABLE_GAP_Y}px ${TABLE_GAP_X}px`, position: 'relative', zIndex: 1,
      }}>
        {cards.map((card) => {
          const ghost = ghosts.get(card.id);
          if (ghost !== undefined) {
            return <Ghost key={card.id} w={TABLE_CARD_W * scale} h={TABLE_CARD_H * scale} radius={7 * scale} label={ghost} fontSize={9} twoLines />;
          }
          return (
            <CardComponent key={card.id} card={card} size="table" scale={scale}
              disabled={shaded.has(card.id)}
              draggable={draggable}
              onTap={() => onTap(card)}
              onDragMove={(pt) => onDragMove(card, pt)}
              onDragEnd={(pt) => onDragEnd(card, pt)}
            />
          );
        })}
      </div>
    </div>
  );
}
