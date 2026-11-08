import { AnimatePresence, motion } from 'motion/react';
import type { Difficulty } from '../engine/types';
import { C, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';

// Bot colours (STACKED v2): Nina azure, Rex wisteria; Calvin and Jett have no colour yet (line).
const BOT_COLORS: Record<Difficulty, { fill: string; name: string }> = {
  beginner:     { fill: C.line.classic, name: 'Calvin' },
  intermediate: { fill: C.botAzure, name: 'Nina' },
  advanced:     { fill: C.botWisteria, name: 'Rex' },
  expert:       { fill: C.line.classic, name: 'Jett' },
};

interface Props {
  visible: boolean;
  difficulty: Difficulty;
}

export function ThinkingBubble({ visible, difficulty }: Props) {
  const info = BOT_COLORS[difficulty];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: alpha(C.surface.classic, 0.92),
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: `1px solid ${C.line.classic}`,
            borderRadius: 999,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap' as const,
          }}
        >
          <span style={{
            fontSize: 11, color: C.inkOnSurface.classic,
            fontFamily: FONTS.sans,
          }}>
            {info.name} is thinking
          </span>
          <AnimatedDots color={info.fill} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AnimatedDots({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color,
          }}
        />
      ))}
    </span>
  );
}
