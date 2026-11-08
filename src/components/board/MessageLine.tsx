import { motion } from 'motion/react';
import type { Ref } from 'react';
import { C } from '../../config/colors';
import { FONTS } from '../../config/fonts';

/** The message line (GB2, D-007 ruling 95): one line on the table colour with
 *  a gold left edge. A new line fades in (the same under reduce-motion). On a
 *  short screen (ruling 99) it sits a little tighter. */
export function MessageLine({ text, lineRef, compact }: { text: string; lineRef: Ref<HTMLDivElement>; compact?: boolean }) {
  return (
    <div ref={lineRef} role="status" aria-live="polite" style={{
      minHeight: compact ? 40 : 44, marginTop: compact ? 4 : 6, flexShrink: 0, boxSizing: 'border-box', padding: '7px 12px', borderLeft: `3px solid ${C.classicGold}`,
      background: C.surface.classic, borderRadius: '0 6px 6px 0', fontFamily: FONTS.sans, fontSize: 13, lineHeight: 1.35, color: C.ink.classic,
      display: 'flex', alignItems: 'center',
    }}>
      <motion.span key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
        {text}
      </motion.span>
    </div>
  );
}
