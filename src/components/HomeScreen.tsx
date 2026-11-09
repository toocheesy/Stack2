import { useEffect, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { Gear } from './board/pieces';

// The home screen, HS15 Citrus Press (D-007 rulings 35, 37, 38, 39, 65, 65b,
// 105): the wordmark with its "A" in cobalt, the gear, the TAKE A SEAT pill
// and the Stack: Classic's card as the top card of a tilted stack, a
// tangerine layer tilted left and a cobalt layer tilted right behind it.
// Classic's card holds CONTINUE (only with a saved game), QUICK MATCH and
// SET THE TABLE, and grows to hold the third button. Privacy at the bottom.
// No playing card, no "How to play" yet (release 4), and nothing names The
// Run (ruling 32). Phone A's values (390 x 844) on phones 760px and taller,
// phone B's (375 x 667) below that; both show everything with no scrolling.
//
// `leaving` plays the home's part of DD2 Curtain Deal (ruling 46): Classic's
// card drops off the bottom of the screen (300ms, ease-in like a fall), the
// two layers follow 40 and 80ms behind, tipping a few degrees further, and
// the wordmark, pill, gear and link fade (160ms from 60ms). Under
// reduce-motion nothing here moves: the curtain fades the whole home instead
// (CurtainDeal). The curtain takes every tap while it plays.

interface Props {
  hasSave: boolean;
  leaving: boolean;
  onContinue: () => void;
  onQuickMatch: () => void;
  onSetTheTable: () => void;
  onOpenSettings: () => void;
}

// HS15's two phones. The card's height is its minimum: with a saved game it
// is 24px taller on A and 12px on B to hold CONTINUE, and grows past that
// only when the three buttons need more.
const PHONE_A = { gearTop: 18, wordTop: 74, wordSize: 62, pillTop: 150, stackSide: 34, stackTop: 232, cardHeight: 300, grownBy: 24, cardPadTop: 26, titleSize: 48, privacyBottom: 12 };
const PHONE_B = { gearTop: 12, wordTop: 56, wordSize: 50, pillTop: 116, stackSide: 30, stackTop: 176, cardHeight: 236, grownBy: 12, cardPadTop: 20, titleSize: 40, privacyBottom: 6 };
// Below this height the home takes phone B's values (GameView's compact rule, ruling 99).
const COMPACT_BELOW = 760;

// DD2: the fall (cubic-bezier(.55, 0, .9, .4)) and the fade (linear, from 60ms).
const FALL: Transition = { duration: 0.3, ease: [0.55, 0, 0.9, 0.4] };
const FADE: Transition = { duration: 0.16, delay: 0.06, ease: 'linear' };

// The layers' transforms read rotate then translate, as HS15 and DD2 write them.
type Parts = { rotate?: string | number; x?: string | number; y?: string | number };
const unit = (v: string | number | undefined, u: string) => (typeof v === 'number' ? `${v}${u}` : v ?? `0${u}`);
const rotateThenTranslate = (t: Parts) => `rotate(${unit(t.rotate, 'deg')}) translate(${unit(t.x, 'px')}, ${unit(t.y, 'px')})`;

function useCompact(): boolean {
  const [height, setHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 844));
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height < COMPACT_BELOW;
}

const OUTLINED: CSSProperties = {
  width: '100%', height: 48, borderRadius: 'inherit', border: `1.5px solid ${C.ink.classic}`, background: 'transparent',
  fontFamily: FONTS.sans, fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', color: C.ink.classic, cursor: 'pointer',
};

export function HomeScreen({ hasSave, leaving, onContinue, onQuickMatch, onSetTheTable, onOpenSettings }: Props) {
  const calm = !!useReducedMotion();
  const L = useCompact() ? PHONE_B : PHONE_A;
  // The curtain moves the home only in full motion; calm fades it whole.
  const falling = leaving && !calm;
  const fade = { initial: { opacity: 1 }, animate: { opacity: falling ? 0 : 1 }, transition: FADE };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: C.ground.brand, color: C.ink.brand, fontFamily: FONTS.sans, overflow: 'hidden',
      pointerEvents: leaving ? 'none' : 'auto',
    }}>
      <motion.button type="button" aria-label="Settings" onClick={onOpenSettings} {...fade} style={{
        position: 'absolute', right: 14, top: L.gearTop, width: 44, height: 44, borderRadius: 22, border: `1.5px solid ${C.line.brand}`, background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', color: C.ink.brand, zIndex: 3,
      }}>
        <Gear />
      </motion.button>

      <motion.h1 {...fade} style={{
        position: 'absolute', left: 24, top: L.wordTop, margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: L.wordSize, lineHeight: 1, letterSpacing: '0.04em', color: C.ink.brand,
      }}>
        ST<span style={{ color: C.accent.brand }}>A</span>CKED
      </motion.h1>

      <motion.div {...fade} style={{
        position: 'absolute', left: 24, top: L.pillTop, display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px 0 calc(14px + 0.3em)', borderRadius: 999,
        background: C.surface.brand, fontSize: 13, fontWeight: 700, letterSpacing: '0.3em', color: C.inkOnSurface.brand,
      }}>
        TAKE A SEAT
      </motion.div>

      {/* The Stack: the two layers fill the card's box, so they grow with it. */}
      <div style={{ position: 'absolute', left: L.stackSide, right: L.stackSide, top: L.stackTop }}>
        <motion.div
          aria-hidden="true"
          initial={{ rotate: -5, x: -6, y: 10 }}
          animate={falling ? { rotate: -9, x: -6, y: 660 } : { rotate: -5, x: -6, y: 10 }}
          transition={{ ...FALL, delay: 0.04 }}
          transformTemplate={rotateThenTranslate}
          style={{ position: 'absolute', inset: 0, borderRadius: 22, background: C.stackUpper }}
        />
        <motion.div
          aria-hidden="true"
          initial={{ rotate: 3, x: 6, y: 6 }}
          animate={falling ? { rotate: 7, x: 6, y: 660 } : { rotate: 3, x: 6, y: 6 }}
          transition={{ ...FALL, delay: 0.08 }}
          transformTemplate={rotateThenTranslate}
          style={{ position: 'absolute', inset: 0, borderRadius: 22, background: C.stackLower }}
        />
        <motion.section
          aria-label="Classic"
          initial={{ y: 0 }}
          animate={{ y: falling ? 640 : 0 }}
          transition={FALL}
          style={{
            position: 'relative', minHeight: L.cardHeight + (hasSave ? L.grownBy : 0), boxSizing: 'border-box', padding: `${L.cardPadTop}px 20px 20px`,
            background: C.classicTable, border: `1.5px solid ${C.classicGold}`, borderRadius: 22,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, color: C.ink.classic,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', color: C.classicGold }}>DEAL ME IN</div>
            <h2 style={{ margin: '2px 0 0', fontFamily: FONTS.display, fontWeight: 400, fontSize: L.titleSize, lineHeight: 1.08, color: C.ink.classic }}>Classic</h2>
            <div style={{ fontSize: 14, lineHeight: 1.3, color: C.muted.classic }}>Race to the Score</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 12 }}>
            {hasSave && (
              <button type="button" onClick={onContinue} style={OUTLINED}>CONTINUE</button>
            )}
            <button type="button" onClick={onQuickMatch} style={{
              width: '100%', height: 52, borderRadius: 'inherit', border: 'none', background: C.classicGold,
              fontFamily: FONTS.sans, fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', color: C.classicTable, cursor: 'pointer',
            }}>
              QUICK MATCH
            </button>
            <button type="button" onClick={onSetTheTable} style={OUTLINED}>SET THE TABLE</button>
          </div>
        </motion.section>
      </div>

      {/* S-020: the privacy notice, a static page opened in a new tab. */}
      <motion.div {...fade} style={{ position: 'absolute', left: 0, right: 0, bottom: L.privacyBottom, display: 'flex', justifyContent: 'center' }}>
        <a href="/privacy.html" target="_blank" rel="noopener" style={{
          display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 10px', fontSize: 13, fontWeight: 600, color: C.muted.brand,
          textDecoration: 'underline', textUnderlineOffset: 3,
        }}>
          Privacy
        </a>
      </motion.div>
    </div>
  );
}
