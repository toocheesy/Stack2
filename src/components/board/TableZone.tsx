import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import type { Card } from '../../engine/types';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';
import { CardComponent, TABLE_CARD_W } from '../Card';
import { FlyingCard, Ghost, LandingCard, type Flight } from './pieces';
import type { Point } from './moments';
import { TABLE_CARD_H, TABLE_GAP_X, TABLE_GAP_Y, TABLE_PAD_X, tableFit, tablePadding } from './tableFit';

/** Cards flying off the table to whoever took it (TT1). */
export interface TableFlight {
  cards: readonly Card[];
  flightFor: (index: number, count: number) => Flight;
}

/** The last cards landing on the table (RULES.md Law 8): which, from where, how far apart. */
export interface TableLanding {
  ids: readonly string[];
  from: () => Point | null;
  step: number;
}

/** The table (GB2): gold-edged, with the deck count in a pill and the table
 *  cards at 54 x 76 with an 8px gap, five across at 390. Rows wrap; when the
 *  rows don't fit the zone the cards scale down together, never above 1. */
export function TableZone({ cards, ghosts, ghostFade, shaded, deckCount, pillSide, highlighted, draggable, landing, flight, compact, onTap, onDragMove, onDragEnd, zoneRef, children }: {
  cards: readonly Card[];
  /** Staged cards by id, with the ghost's label where each came from. */
  ghosts: ReadonlyMap<string, string>;
  /** Seconds the ghosts take to fade away (YC1), or none. */
  ghostFade?: number;
  /** Table cards no combo could use while you build. */
  shaded: ReadonlySet<string>;
  deckCount: number;
  /** The deck pill sits opposite the speech bubble. */
  pillSide: 'left' | 'right';
  highlighted: boolean;
  draggable: boolean;
  landing?: TableLanding | null;
  /** When set, these cards are shown flying away in place of `cards`. */
  flight?: TableFlight | null;
  /** A short screen (ruling 99): less room above and below the cards. */
  compact?: boolean;
  onTap: (card: Card) => void;
  onDragMove: (card: Card, point: Point) => void;
  onDragEnd: (card: Card, point: Point) => void;
  zoneRef: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}) {
  const [inner, setInner] = useState<{ w: number; h: number } | null>(null);
  const pad = tablePadding(!!compact);

  useLayoutEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const measure = () => setInner({ w: el.clientWidth - 2 * TABLE_PAD_X, h: el.clientHeight - pad.top - pad.bottom });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoneRef, pad.top, pad.bottom]);

  const shown = flight ? flight.cards : cards;
  const scale = inner ? tableFit(shown.length, inner.w, inner.h) : 1;

  return (
    <div ref={zoneRef} style={{
      position: 'relative', flex: '1 1 0', minHeight: 0, marginTop: compact ? 6 : 8, boxSizing: 'border-box',
      padding: `${pad.top}px ${TABLE_PAD_X}px ${pad.bottom}px`, background: C.surface.classic,
      border: `1px solid ${C.classicGold}`, outline: highlighted ? `1px solid ${C.classicGold}` : undefined, borderRadius: 6,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
      <span style={{
        position: 'absolute', top: compact ? 6 : 8, ...(pillSide === 'left' ? { left: 12 } : { right: 12 }),
        padding: '3px 8px', borderRadius: 999, border: `1px solid ${C.line.classic}`,
        fontFamily: FONTS.sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.2, color: C.ink.classic,
      }}>
        DECK {deckCount}
      </span>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center',
        gap: `${TABLE_GAP_Y}px ${TABLE_GAP_X}px`, position: 'relative', zIndex: 1,
      }}>
        {shown.map((card, i) => {
          if (flight) {
            return (
              <FlyingCard key={card.id} flight={flight.flightFor(i, shown.length)}>
                <CardComponent card={card} size="table" scale={scale} />
              </FlyingCard>
            );
          }
          const ghost = ghosts.get(card.id);
          if (ghost !== undefined) {
            return <Ghost key={card.id} w={TABLE_CARD_W * scale} h={TABLE_CARD_H * scale} radius={7 * scale} label={ghost} fontSize={9} twoLines fade={ghostFade} />;
          }
          const landingIndex = landing ? landing.ids.indexOf(card.id) : -1;
          if (landing && landingIndex >= 0) {
            return (
              <LandingCard key={card.id} from={landing.from} delay={landingIndex * landing.step}>
                <CardComponent card={card} size="table" scale={scale} />
              </LandingCard>
            );
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
