import { AnimatePresence, motion } from 'motion/react';
import { getTransition } from '../config/motion';

const TAN = '#E8C577';
const BG = '#0A0A0A';
const DIVIDER = 'rgba(255,255,255,0.12)';

interface Props {
  visible: boolean;
  onClose: () => void;
  onReplayTutorial: () => void;
}

export function SettingsScreen({ visible, onClose, onReplayTutorial }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a', borderRadius: 12, padding: 18,
              maxWidth: 280, width: '100%',
              display: 'flex', flexDirection: 'column', gap: 10,
              border: `1px solid ${DIVIDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <h2 style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15,
              color: '#fff', letterSpacing: 0.5, margin: 0, textAlign: 'center',
            }}>
              SETTINGS
            </h2>

            <button
              onClick={onReplayTutorial}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                background: 'transparent', border: `1px solid ${TAN}66`,
                color: TAN, fontSize: 12, fontWeight: 600,
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                letterSpacing: '0.04em', marginTop: 2,
              }}
            >
              Replay tutorial
            </button>

            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.97 }}
              transition={getTransition('snappy')}
              style={{
                width: '100%', height: 36, borderRadius: 8,
                border: 'none', background: TAN,
                color: BG, fontSize: 13, fontWeight: 700,
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              DONE
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
