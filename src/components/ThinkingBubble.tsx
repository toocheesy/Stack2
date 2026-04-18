import { AnimatePresence, motion } from 'motion/react';
import type { Difficulty } from '../engine/types';

const BOT_COLORS: Record<Difficulty, { fill: string; name: string }> = {
  beginner:     { fill: '#60A5FA', name: 'Calvin' },
  intermediate: { fill: '#A78BFA', name: 'Nina' },
  advanced:     { fill: '#EF4444', name: 'Rex' },
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
            top: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(42,42,61,0.92)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: '1px solid #3A3A50',
            borderRadius: 999,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap' as const,
          }}
        >
          <span style={{
            fontSize: 13, color: '#F1F1F3',
            fontFamily: 'Inter, sans-serif',
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
