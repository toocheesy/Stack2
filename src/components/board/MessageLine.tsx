import { motion } from 'motion/react';
import type { Ref } from 'react';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';

/** The message line (GB2, D-007 ruling 95): one line on the table colour with
 *  a gold left edge. A new line fades in (the same under reduce-motion). */
export function MessageLine({ text, lineRef }: { text: string; lineRef: Ref<HTMLDivElement> }) {
  return (
    <div ref={lineRef} role="status" aria-live="polite" style={{
      minHeight: 50, marginTop: 8, flexShrink: 0, boxSizing: 'border-box', padding: '7px 12px', borderLeft: `3px solid ${C.classicGold}`,
      background: C.surface.classic, borderRadius: '0 6px 6px 0', fontFamily: FONTS.sans, fontSize: 13, lineHeight: 1.35, color: C.ink.classic,
      display: 'flex', alignItems: 'center',
    }}>
      <motion.span key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
        {text}
      </motion.span>
    </div>
  );
}
