import { motion, useReducedMotion } from 'motion/react';
import { C, SHADOWS } from '../../config/colors';
import { FONTS } from '../../config/fonts';

/** An opponent's move as a speech bubble from its seat (GB2), edged in its
 *  colour, sitting on the table's top edge on the seat's side. It fades in
 *  with a small drop; under reduce-motion it only fades. */
export function SpeechBubble({ side, colour, name, words }: {
  side: 'left' | 'right';
  colour: string;
  name: string;
  words: string;
}) {
  const calm = useReducedMotion();
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: calm ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'absolute', top: -8, ...(side === 'left' ? { left: 12 } : { right: 12 }), maxWidth: 262, boxSizing: 'border-box',
        padding: '6px 10px', background: C.surface.classic, border: `2px solid ${colour}`, borderRadius: 10, boxShadow: SHADOWS.bubble,
        fontFamily: FONTS.sans, fontSize: 12, lineHeight: 1.3, color: C.ink.classic, zIndex: 2,
      }}
    >
      <span style={{ fontWeight: 700, color: colour }}>{name}</span> {words}
    </motion.div>
  );
}
