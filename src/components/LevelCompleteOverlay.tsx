import { AnimatePresence, motion } from 'motion/react';
import { C } from '../config/colors';
import { getTransition } from '../config/motion';

interface PlayerScore {
  name: string;
  score: number;
  isPlayer: boolean;
}

interface Props {
  visible: boolean;
  won: boolean;
  levelId: number;
  starsEarned: 0 | 1 | 2 | 3;
  margin: number;
  scores: PlayerScore[];
  isFinalLevel: boolean;
  onPlayAgain: () => void;
  onNextLevel?: () => void;
  onWorldMap: () => void;
}

export function LevelCompleteOverlay({
  visible, won, levelId, starsEarned, margin, scores,
  isFinalLevel, onPlayAgain, onNextLevel, onWorldMap,
}: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 14, zIndex: 200, padding: '24px 16px',
          }}
        >
          {/* Header */}
          <motion.h1
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{
              fontSize: won ? 22 : 20, fontWeight: 800, margin: 0,
              fontFamily: 'Inter, sans-serif',
              color: won ? C.amber : C.textSecondary,
              letterSpacing: 1,
            }}
          >
            {won ? (isFinalLevel ? 'ADVENTURE COMPLETE' : `LEVEL ${levelId} COMPLETE`) : 'TRY AGAIN'}
          </motion.h1>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.12, type: 'spring', stiffness: 400, damping: 20 }}
                style={{
                  fontSize: 32,
                  color: i <= starsEarned ? C.amber : C.divider,
                }}
              >
                {i <= starsEarned ? '★' : '☆'}
              </motion.span>
            ))}
          </div>

          {/* Margin */}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14, fontWeight: 600,
            color: won ? C.success : C.error,
          }}>
            {won ? `Won by ${margin} points` : `Lost by ${Math.abs(margin)} points`}
          </span>

          {/* Score breakdown */}
          <div style={{
            width: '100%', maxWidth: 260,
            display: 'flex', flexDirection: 'column', gap: 4,
            marginTop: 4,
          }}>
            {scores.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '4px 10px', borderRadius: 4,
                background: p.isPlayer ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}>
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: p.isPlayer ? 700 : 400,
                  color: p.isPlayer ? C.amber : C.textSecondary,
                }}>
                  {p.name}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600,
                  color: p.isPlayer ? C.textPrimary : C.textSecondary,
                }}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>

          {/* Final level celebration */}
          {isFinalLevel && won && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                marginTop: 4, padding: '10px 18px', borderRadius: 8,
                background: 'rgba(245,158,11,0.1)',
                border: `1px solid ${C.amber}`,
                textAlign: 'center',
              }}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700,
                color: C.amber,
              }}>
                JETT UNLOCKED IN CLASSIC
              </span>
              <br />
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: 11,
                color: C.textSecondary,
              }}>
                Bot intelligence arc complete.
              </span>
            </motion.div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, width: '100%', maxWidth: 240 }}>
            {onNextLevel && (
              <motion.button
                onClick={onNextLevel}
                whileTap={{ scale: 0.97 }}
                transition={getTransition('snappy')}
                style={{
                  width: '100%', height: 46, borderRadius: 8,
                  border: 'none', background: C.tan,
                  color: C.bgNearBlack, fontSize: 15, fontWeight: 700,
                  fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                }}
              >
                NEXT LEVEL
              </motion.button>
            )}
            <motion.button
              onClick={onPlayAgain}
              whileTap={{ scale: 0.97 }}
              transition={getTransition('snappy')}
              style={{
                width: '100%', height: 42, borderRadius: 8,
                border: onNextLevel ? `1.5px solid rgba(255,255,255,0.4)` : 'none',
                background: onNextLevel ? 'transparent' : C.tan,
                color: onNextLevel ? 'rgba(255,255,255,0.9)' : C.bgNearBlack,
                fontSize: 14, fontWeight: onNextLevel ? 600 : 700,
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
              }}
            >
              PLAY AGAIN
            </motion.button>
            <motion.button
              onClick={onWorldMap}
              whileTap={{ scale: 0.97 }}
              transition={getTransition('snappy')}
              style={{
                width: '100%', height: 42, borderRadius: 8,
                border: `1.5px solid rgba(255,255,255,0.4)`,
                background: 'transparent',
                color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600,
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
              }}
            >
              WORLD MAP
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
