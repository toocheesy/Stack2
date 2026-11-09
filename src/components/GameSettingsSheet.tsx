import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { hasGlobalPrivacyControl, isAnalyticsOptedOut, setAnalyticsOptOut } from '../analytics/track';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { CARD_GLOW, SHEET_DIM, cardMotion } from './board/sheet';

// Settings in a game, ST3 Card phone A (D-007 rulings 81 and 82): the gear
// opens a plum card over the game dimmed by the table colour at 85%, with
// Done beside the title, the PAUSED line, the Tutorial row (closes this and
// opens TU2 at step 1) and the "Share anonymous play data" switch (S-020's
// storage, through track.ts). Under a Global Privacy Control signal the
// switch shows Off, can't be turned on, and a locked line says why (ST3
// phone C's state). The game is paused while it is open; Done puts it back
// exactly as it was. The dim takes every tap and does nothing with it.

interface Props {
  open: boolean;
  /** "CLASSIC" or "THE RUN". */
  modeWord: string;
  round: number;
  hand: number;
  onDone: () => void;
  onTutorial: () => void;
}

export function GameSettingsSheet({ open, modeWord, round, hand, onDone, onTutorial }: Props) {
  const calm = !!useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          style={{ position: 'fixed', inset: 0, background: SHEET_DIM, zIndex: 300 }}
        >
          <SettingsCard calm={calm} modeWord={modeWord} round={round} hand={hand} onDone={onDone} onTutorial={onTutorial} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// The card mounts with the sheet, so the switch reads the saved choice each time it opens.
function SettingsCard({ calm, modeWord, round, hand, onDone, onTutorial }: { calm: boolean } & Omit<Props, 'open'>) {
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

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      {...cardMotion(calm)}
      style={{
        position: 'absolute', left: 22, right: 22, top: 150, boxSizing: 'border-box', padding: '20px 18px 20px',
        background: C.classicSheet, border: `2px solid ${C.classicGold}`, borderRadius: 22, boxShadow: CARD_GLOW,
        display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONTS.sans, color: C.classicSheetInk,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: FONTS.display, fontWeight: 400, fontSize: 30, lineHeight: 1.1, color: C.classicSheetInk }}>Settings</h2>
        <button type="button" onClick={onDone} style={{
          height: 44, flexShrink: 0, padding: '0 20px', borderRadius: 8, border: 'none', background: C.classicGold,
          fontFamily: FONTS.sans, fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', color: C.classicTable, cursor: 'pointer',
        }}>
          Done
        </button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.classicSheetMuted }}>
        PAUSED · {modeWord} · ROUND {round} · HAND {hand}
      </div>

      <button type="button" onClick={onTutorial} style={{
        width: '100%', minHeight: 56, boxSizing: 'border-box', padding: '6px 14px', borderRadius: 8, border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left', fontFamily: FONTS.sans, cursor: 'pointer', color: C.classicSheetInk,
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.classicSheetInk }}>Tutorial</span>
          <span style={{ fontSize: 13, color: C.classicSheetMuted }}>A tour of the table, one part at a time.</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div aria-hidden="true" style={{ height: 1, background: C.classicSheetLine }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: C.classicSheetInk }}>Share anonymous play data</span>
          <ShareSwitch on={on} locked={locked} calm={calm} onToggle={toggle} />
        </div>
        {locked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.classicSheetLine}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: C.classicSheetInk }}>Your browser's privacy setting turned this off.</span>
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: C.classicSheetMuted }}>
          Anonymous counts of how the game is played. No names, no accounts, never sold or used for ads.{' '}
          <a href="/privacy.html" target="_blank" rel="noopener" style={{
            display: 'inline-block', padding: '12px 0', margin: '-12px 0', color: C.classicSheetInk, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            Privacy
          </a>
        </p>
      </div>
    </motion.div>
  );
}

/** The switch: On or Off in words, the thumb sliding 24px as the gold fill
 *  fades in, a check on the thumb when on. Under reduce-motion the fill fades
 *  and the thumb jumps. Locked (the browser's privacy signal): Off, a dashed
 *  track, and no response to a tap. */
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
      <span style={{ width: 28, textAlign: 'right', fontSize: 15, fontWeight: 700, color: C.classicSheetInk }}>{on ? 'On' : 'Off'}</span>
      <span aria-hidden="true" style={{ position: 'relative', width: 56, height: 32, boxSizing: 'border-box', borderRadius: 16, flexShrink: 0 }}>
        {locked ? (
          <>
            <span style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: 16, border: `2px dashed ${C.classicSheetLine}`, background: C.classicSheetDeep }} />
            <span style={{ position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, background: C.classicSheetLine }} />
          </>
        ) : (
          <>
            <span style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: 16, border: `2px solid ${C.classicSheetLine}`, background: C.classicSheetDeep }} />
            <motion.span initial={false} animate={{ opacity: on ? 1 : 0 }} transition={fade} style={{ position: 'absolute', inset: 0, borderRadius: 16, background: C.classicGold }} />
            <motion.span
              initial={false}
              animate={{ x: on ? 24 : 0 }}
              transition={calm ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', left: 4, top: 4, width: 24, height: 24, borderRadius: 12 }}
            >
              <motion.span initial={false} animate={{ opacity: on ? 0 : 1 }} transition={fade} style={{ position: 'absolute', inset: 2, borderRadius: 10, background: C.classicSheetInk }} />
              <motion.span initial={false} animate={{ opacity: on ? 1 : 0 }} transition={fade} style={{
                position: 'absolute', inset: 0, borderRadius: 12, background: C.classicTable, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.classicGold} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
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
