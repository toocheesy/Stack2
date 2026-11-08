// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

// jsdom has no matchMedia, and the motion presets ask for it as their module loads.
vi.hoisted(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import { CardComponent, type CardSize } from '../../src/components/Card';
import { C, alpha } from '../../src/config/colors';
import type { Card } from '../../src/engine/types';

// The locked card (D-007 release 1): each of the four sizes renders at its
// locked width and height, with the face, ring and stripe colours read from
// colors.ts; selected adds the 2px outline; a disabled card keeps its size
// and shows the 40% table shade.

const QUEEN_OF_HEARTS: Card = { id: 'QH', rank: 'Q', suit: 'hearts', value: 12 };

// The locked sizes (tokens.json cardSize; the rings from N4G and GB2).
const LOCKED: Record<CardSize, { w: number; h: number; ring: number }> = {
  full: { w: 180, h: 252, ring: 5 },
  hand: { w: 72, h: 100, ring: 3 },
  table: { w: 54, h: 76, ring: 2 },
  slot: { w: 40, h: 56, ring: 2 },
};
const SIZES: CardSize[] = ['full', 'hand', 'table', 'slot'];

// jsdom may store a colour as it was written or as rgb()/rgba(); compare the channels.
function channels(value: string): number[] | null {
  const v = value.trim().toLowerCase();
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    const n = parseInt(hex.slice(0, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = v.match(/^rgba?\(([^)]*)\)$/);
  if (!m) return null;
  const parts = m[1].split(',').map((p) => parseFloat(p));
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

function sameColour(value: string, hex: string): boolean {
  const a = channels(value);
  const b = channels(hex);
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && Math.abs(a[3] - b[3]) < 0.01;
}

function divs(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('div'));
}

function face(root: ParentNode): HTMLElement {
  const el = divs(root).find((d) => sameColour(d.style.backgroundColor, C.cardFace));
  if (!el) throw new Error('no card face in the render');
  return el;
}

function mentions(shadow: string, hex: string): boolean {
  const s = shadow.toLowerCase();
  if (s.includes(hex.toLowerCase())) return true;
  const c = channels(hex)!;
  return s.includes(`rgb(${c[0]}, ${c[1]}, ${c[2]})`);
}

describe('the locked card (D-007 release 1)', () => {
  afterEach(cleanup);

  for (const size of SIZES) {
    it(`${size}: locked width and height, with the face, ring and stripes from colors.ts`, () => {
      const { container } = render(<CardComponent card={QUEEN_OF_HEARTS} size={size} />);
      const f = face(container);
      expect(f.style.width).toBe(`${LOCKED[size].w}px`);
      expect(f.style.height).toBe(`${LOCKED[size].h}px`);

      const shadow = f.style.boxShadow;
      expect(shadow).toContain(`0 0 0 ${LOCKED[size].ring}px`);
      expect(mentions(shadow, C.cardRing)).toBe(true);

      const stripes = divs(f).filter((d) => d.children.length === 0 && d.style.height !== '');
      expect(stripes.some((d) => sameColour(d.style.backgroundColor, C.classicTable))).toBe(true);
      expect(stripes.some((d) => sameColour(d.style.backgroundColor, C.classicGoldDeep))).toBe(true);
    });
  }

  it('the capture-slot card has the ring and no shadow', () => {
    const { container } = render(<CardComponent card={QUEEN_OF_HEARTS} size="slot" />);
    const shadow = face(container).style.boxShadow;
    expect(shadow.split(',').length).toBe(1);
    expect(shadow).toContain('0 0 0 2px');
  });

  it("selected: a 2px outline in Classic's ink", () => {
    const { container } = render(<CardComponent card={QUEEN_OF_HEARTS} size="hand" selected />);
    const outlined = divs(container).find((d) => d.style.outline !== '' || d.style.outlineWidth !== '');
    expect(outlined).toBeDefined();
    const outline = outlined!.style.outline || `${outlined!.style.outlineWidth} ${outlined!.style.outlineStyle} ${outlined!.style.outlineColor}`;
    expect(outline).toContain('2px');
    expect(mentions(outline, C.ink.classic)).toBe(true);
  });

  it('disabled: the same size, with the table colour at 40% over the whole card', () => {
    const { container } = render(<CardComponent card={QUEEN_OF_HEARTS} size="table" disabled />);
    const f = face(container);
    expect(f.style.width).toBe(`${LOCKED.table.w}px`);
    expect(f.style.height).toBe(`${LOCKED.table.h}px`);
    const shade = divs(container).find((d) => sameColour(d.style.backgroundColor, alpha(C.classicTable, 0.4)));
    expect(shade).toBeDefined();
    expect(shade!.style.position).toBe('absolute');
  });

  it('not disabled: no table shade', () => {
    const { container } = render(<CardComponent card={QUEEN_OF_HEARTS} size="table" />);
    const shade = divs(container).find((d) => sameColour(d.style.backgroundColor, alpha(C.classicTable, 0.4)));
    expect(shade).toBeUndefined();
  });
});
