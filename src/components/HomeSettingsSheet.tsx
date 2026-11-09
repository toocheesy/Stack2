import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { hasGlobalPrivacyControl, isAnalyticsOptedOut, setAnalyticsOptOut } from '../analytics/track';
import { C, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';
import { cardMotion } from './board/sheet';

// Settings at home, ST3 Card phones B and C (D-007 rulings 81, 82): the home
// gear opens a lemon card on a tilted cobalt layer over the home dimmed navy
// at 78%, with Done beside the title and the "Share anonymous play data"
// switch (S-020's storage, through track.ts) over its helper line and the
// Privacy link. No Tutorial row, no sound settings. Under a Global Privacy
// Control signal the switch shows Off, can't be turned on, and a locked line
// says why (phone C). The card opens with ST3's fade and settle from 94%,
// the cobalt layer tilting in 60ms behind it; it closes with the 160ms fade
// and shrink. Calm: fades only, and the thumb jumps. The dim takes every tap
// and does nothing with it.

// The home dimmed by navy at 78% (ST3 phones B and C; NewGameSheet has the same).
const HOME_DIM = alpha(C.surface.brand, 0.78);

interface Props {
  open: boolean;
  onDone: () => void;
}

export function HomeSettingsSheet({ open, onDone }: Props) {
  const calm = !!useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="home-settings"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          style={{ position: 'fixed', inset: 0, background: HOME_DIM, zIndex: 300 }}
        >
          <SettingsCard calm={calm} onDone={onDone} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// The layer's transform reads rotate then translate, as ST3 writes it.
type Parts = { rotate?: string | number; x?: string | number; y?: string | number };
const unit = (v: string | number | undefined, u: string) => (typeof v === 'number' ? `${v}${u}` : v ?? `0${u}`);
const rotateThenTranslate = (t: Parts) => `rotate(${unit(t.rotate, 'deg')}) translate(${unit(t.x, 'px')}, ${unit(t.y, 'px')})`;

// The card mounts with the sheet, so the switch reads the saved choice each time it opens.
function SettingsCard({ calm, onDone }: { calm: boolean; onDone: () => void }) {
  // S-020: sharing is on unless the player turned it off on this device.
  const [sharing, setSharing] = useState(() => !isAnalyticsOptedOut());
  const locked = hasGlobalPrivacyControl();
  const on = sharing && !locked;

  const toggle = () => {
    if (locked) return;
    const next = !sharing;
    setSharing(next);
    setAnalyticsOptOut(!next);
  };

  const tilted = { rotate: 3, x: 6, y: 8 };
  const flat = { rotate: 0, x: 0, y: 0 };
  const tilt = { duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      {...cardMotion(calm)}
      style={{ position: 'absolute', left: 22, right: 22, top: 190, fontFamily: FONTS.sans, color: C.ink.brand }}
    >
      {/* The cobalt layer: tilts in 60ms after the card (320ms); calm fades it in place. */}
      <motion.div
        aria-hidden="true"
        initial={calm ? { opacity: 0, ...tilted } : { opacity: 0, ...flat }}
        animate={{ opacity: 1, ...tilted }}
        exit={calm ? { opacity: 0, transition: { duration: 0.2, ease: 'linear' } } : { opacity: 0, ...flat, transition: { duration: 0.16, ease: 'linear' } }}
        transition={calm
          ? { duration: 0.2, ease: 'linear' }
          : { opacity: { duration: 0.2, delay: 0.06, ease: 'linear' }, rotate: tilt, x: tilt, y: tilt }}
        transformTemplate={rotateThenTranslate}
        style={{ position: 'absolute', inset: 0, borderRadius: 22, background: C.stackLower }}
      />
      <section style={{
        position: 'relative', boxSizing: 'border-box', padding: '20px 18px 20px', background: C.ground.brand, borderRadius: 22,
        boxShadow: `0 18px 40px ${alpha(C.ink.brand, 0.4)}`, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 30, lineHeight: 1.1, color: C.ink.brand }}>Settings</h2>
          <button type="button" onClick={onDone} style={{
            height: 44, flexShrink: 0, padding: '0 20px', borderRadius: 8, border: 'none', background: C.surface.brand,
            fontFamily: FONTS.sans, fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', color: C.inkOnSurface.brand, cursor: 'pointer',
          }}>
            Done
          </button>
        </div>

        <div aria-hidden="true" style={{ height: 1, background: C.line.brand }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: C.ink.brand }}>Share anonymous play data</span>
            <ShareSwitch on={on} locked={locked} calm={calm} onToggle={toggle} />
          </div>
          {locked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.line.brand}` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: C.ink.brand }}>Your browser's privacy setting turned this off.</span>
            </div>
          )}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: C.muted.brand }}>
            Anonymous counts of how the game is played. No names, no accounts, never sold or used for ads.{' '}
            <a href="/privacy.html" target="_blank" rel="noopener" style={{
              display: 'inline-block', padding: '12px 0', margin: '-12px 0', color: C.ink.brand, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              Privacy
            </a>
          </p>
        </div>
      </section>
    </motion.div>
  );
}

/** The switch in the brand look: On or Off in words, the thumb sliding 24px
 *  as the cobalt fill fades in, a cobalt check on the lemon thumb when on.
 *  Under reduce-motion the fill fades and the thumb jumps. Locked (the
 *  browser's privacy signal): Off, a dashed steel track, and no response to
 *  a tap. */
function ShareSwitch({ on, locked, calm, onToggle }: { on: boolean; locked: boolean; calm: boolean; onToggle: () => void }) {
  const fade = { duration: calm ? 0.2 : 0.18, ease: 'linear' as const };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={locked || undefined}
      aria-label="Share anonymous play data"
      onClick={onToggle}
      style={{
        flexShrink: 0, height: 48, padding: '0 0 0 8px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: FONTS.sans, cursor: locked ? 'not-allowed' : 'pointer',
      }}
    >
      <span style={{ width: 28, textAlign: 'right', fontSize: 15, fontWeight: 700, color: C.ink.brand }}>{on ? 'On' : 'Off'}</span>
      <span aria-hidden="true" style={{ position: 'relative', width: 56, height: 32, boxSizing: 'border-box', borderRadius: 16, flexShrink: 0 }}>
        {locked ? (
          <>
            <span style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: 16, border: `2px dashed ${C.line.brand}`, background: C.ground.brand }} />
            <span style={{ position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, background: C.line.brand }} />
          </>
        ) : (
          <>
            <span style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: 16, border: `2px solid ${C.line.brand}`, background: C.ground.brand }} />
            <motion.span initial={false} animate={{ opacity: on ? 1 : 0 }} transition={fade} style={{ position: 'absolute', inset: 0, borderRadius: 16, background: C.accent.brand }} />
            <motion.span
              initial={false}
              animate={{ x: on ? 24 : 0 }}
              transition={calm ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', left: 4, top: 4, width: 24, height: 24, borderRadius: 12 }}
            >
              <motion.span initial={false} animate={{ opacity: on ? 0 : 1 }} transition={fade} style={{ position: 'absolute', inset: 2, borderRadius: 10, background: C.line.brand }} />
              <motion.span initial={false} animate={{ opacity: on ? 1 : 0 }} transition={fade} style={{
                position: 'absolute', inset: 0, borderRadius: 12, background: C.ground.brand, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent.brand} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </motion.span>
            </motion.span>
          </>
        )}
      </span>
    </button>
  );
}
