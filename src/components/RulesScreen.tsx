import { useState, type CSSProperties } from 'react';
import type { Card } from '../engine/types';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { CardComponent } from './Card';

// The rules page, "How to play", RP1 Card Stack (D-007 rulings 43, 60, 61,
// 107, 111): a screen inside the game in the brand look. The title sits on a
// navy card over the home's tilted tangerine and cobalt layers, and each rule
// is its own outlined card with a numbered navy pill. Under 03, one capture
// as a picture: the game's own card at 78% of hand size on the pill navy, so
// the gold ring shows; nothing in it is tappable. The page scrolls (about
// 1,707px at 390 wide) and opens at the top every time it is mounted; once
// it has scrolled, the back button is held in a slim top bar so it is always
// one tap away. Going back is instant, with no motion in or out; App.tsx
// owns the way back (the back button and the phone's back gesture). The
// board sets no line-height on its headings and labels, so they take the
// browser's normal here too (the game's base styles would hand them 1.5).

interface Props {
  onBack: () => void;
}

// The eight rules, word for word from the board.
const RULES: { title: string; text: string }[] = [
  { title: 'The goal.', text: 'Race your two opponents to the target score. Capture cards from the table to score.' },
  { title: 'Your turn.', text: 'Capture or place a card. No passing. Capture and you keep going while you have cards; place a card and your turn is over.' },
  { title: 'How to capture.', text: 'Pick a base card. Then fill up to three combos with cards that add up to it, or cards that match it. One combo can\'t do both.' },
  { title: 'Mix it up.', text: 'Every combo needs a card from the other side of your base. Base from your hand? Each combo needs a table card. Base from the table? Each combo needs one from your hand.' },
  { title: 'Face cards.', text: 'K, Q and J only match their own kind. Everything else adds up, 10 included. Aces count as 1.' },
  { title: 'Points.', text: 'Every card you take counts, your base too. Ace 15. K, Q, J and 10 are worth 10. Everything else 5.' },
  { title: 'Take the Table.', text: 'Each round has four hands of 4 cards. When the round ends, whoever captured last takes every card still on the table.' },
  { title: 'Winning.', text: 'Pick your target score. Points add up from round to round. When a round ends with someone at the target, the leader wins. Tied for the lead? Play one more round.' },
];
// The example sits under this rule (counting from 1).
const EXAMPLE_UNDER = 3;

// The example's cards: base 9♠ from the hand; 5♥ + 4♣ from the table (they
// add up to 9); 9♦ from the table (a match). Four cards at 5 = +20.
const card = (rank: Card['rank'], suit: Card['suit'], value: number): Card => ({ id: rank + suit[0].toUpperCase(), rank, suit, value });
const BASE = card('9', 'spades', 9);
const COMBO = [card('5', 'hearts', 5), card('4', 'clubs', 4)];
const MATCH = card('9', 'diamonds', 9);
// The cards are drawn at 78% of hand size (56 x 78).
const CARD_SCALE = 0.78;
// The combo's second card overlaps the first, as the board draws it.
const COMBO_OVERLAP = 14;

const BACK_BUTTON: CSSProperties = {
  width: 44, height: 44, flexShrink: 0, borderRadius: 22, border: `1.5px solid ${C.ink.brand}`, background: C.ground.brand,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', color: C.ink.brand,
};

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Back to home" onClick={onClick} style={BACK_BUTTON}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

function Example() {
  const label: CSSProperties = { fontSize: 11, lineHeight: 'normal', fontWeight: 700, letterSpacing: '0.14em', color: C.inkOnSurface.brand };
  const column: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 };
  return (
    <figure style={{
      margin: '14px 0 0', padding: '14px 10px 12px', background: C.surface.brand, borderRadius: 16,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
        <div style={column}>
          <span style={label}>HAND</span>
          <div style={{ display: 'flex', padding: 3 }}>
            <CardComponent card={BASE} size="hand" scale={CARD_SCALE} />
          </div>
        </div>
        <div style={column}>
          <span style={label}>TABLE</span>
          <div style={{ display: 'flex', padding: 3 }}>
            {COMBO.map((c, i) => (
              <div key={c.id} style={{ marginLeft: i > 0 ? -COMBO_OVERLAP : 0 }}>
                <CardComponent card={c} size="hand" scale={CARD_SCALE} />
              </div>
            ))}
          </div>
        </div>
        <div style={column}>
          <span style={label}>TABLE</span>
          <div style={{ display: 'flex', padding: 3 }}>
            <CardComponent card={MATCH} size="hand" scale={CARD_SCALE} />
          </div>
        </div>
      </div>
      <figcaption style={{ textAlign: 'center', fontSize: 15, lineHeight: 'normal', fontWeight: 700, color: C.inkOnSurface.brand }}>+20</figcaption>
    </figure>
  );
}

export function RulesScreen({ onBack }: Props) {
  // Once the page has scrolled, the back button is held in the top bar.
  const [scrolled, setScrolled] = useState(false);

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.ground.brand, color: C.ink.brand, fontFamily: FONTS.sans, overflow: 'hidden' }}>
      <div
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
        style={{ position: 'absolute', inset: 0, overflowX: 'hidden', overflowY: 'auto', touchAction: 'pan-y' }}
      >
        <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onClick={onBack} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 20, lineHeight: 1, letterSpacing: '0.04em', color: C.ink.brand }}>
            ST<span style={{ color: C.accent.brand }}>A</span>CKED
          </span>
          <span style={{ width: 44 }} />
        </div>

        {/* The title on a navy card over the Stack's tilted layers. */}
        <div style={{ position: 'relative', margin: '22px 26px 26px', height: 92 }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 22, background: C.stackUpper, transform: 'rotate(-4deg) translate(-4px, 6px)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 22, background: C.stackLower, transform: 'rotate(2.5deg) translate(4px, 4px)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: C.surface.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <h1 style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 40, lineHeight: 'normal', color: C.inkOnSurface.brand }}>How to play</h1>
          </div>
        </div>

        <div style={{ padding: '0 18px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {RULES.map((rule, i) => (
            <section key={rule.title} style={{ padding: '18px 18px 20px', border: `1.5px solid ${C.ink.brand}`, borderRadius: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 26, padding: '0 8px', boxSizing: 'border-box',
                  borderRadius: 999, background: C.surface.brand, fontSize: 13, fontWeight: 700, color: C.inkOnSurface.brand,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 24, lineHeight: 'normal', color: C.ink.brand }}>{rule.title}</h2>
              </div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: C.ink.brand }}>{rule.text}</p>
              {i + 1 === EXAMPLE_UNDER && <Example />}
            </section>
          ))}
        </div>
      </div>

      {scrolled && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 72, boxSizing: 'border-box', padding: '14px 20px 0',
          background: C.ground.brand, borderBottom: `1.5px solid ${C.line.brand}`, display: 'flex', alignItems: 'flex-start', gap: 14, zIndex: 2,
        }}>
          <BackButton onClick={onBack} />
          <span style={{ marginTop: 9, fontFamily: FONTS.display, fontWeight: 400, fontSize: 22, lineHeight: 'normal', color: C.ink.brand }}>How to play</span>
        </div>
      )}
    </div>
  );
}
