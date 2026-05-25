import { AnimatePresence, motion } from 'motion/react';
import type { AudioSettings } from '../audio/settingsStorage';
import { getTransition } from '../config/motion';

const JADE = '#065F46';
const TAN = '#E8C577';
const BG = '#0A0A0A';
const DIVIDER = 'rgba(255,255,255,0.12)';

interface Props {
  visible: boolean;
  settings: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
  onClose: () => void;
}

export function SettingsScreen({ visible, settings, onChange, onClose }: Props) {
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
              background: '#1a1a1a', borderRadius: 12, padding: 24,
              maxWidth: 340, width: '100%',
              display: 'flex', flexDirection: 'column', gap: 16,
              border: `1px solid ${DIVIDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <h2 style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18,
              color: '#fff', letterSpacing: 1, margin: 0, textAlign: 'center',
            }}>
              SETTINGS
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ToggleRow
                label="Music"
                on={settings.musicOn}
                onToggle={(on) => onChange({ musicOn: on })}
              />
              <ToggleRow
                label="SFX"
                on={settings.sfxOn}
                onToggle={(on) => onChange({ sfxOn: on })}
              />
            </div>

            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.97 }}
              transition={getTransition('snappy')}
              style={{
                width: '100%', height: 42, borderRadius: 8,
                border: 'none', background: TAN,
                color: BG, fontSize: 14, fontWeight: 700,
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                marginTop: 4, letterSpacing: 0.5,
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

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: (on: boolean) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 4px',
    }}>
      <span style={{
        fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 500,
        color: 'rgba(255,255,255,0.9)',
      }}>
        {label}
      </span>
      <button
        onClick={() => onToggle(!on)}
        aria-pressed={on}
        aria-label={`${label} ${on ? 'on' : 'off'}`}
        style={{
          width: 48, height: 28, borderRadius: 99,
          border: 'none', cursor: 'pointer',
          background: on ? JADE : 'rgba(255,255,255,0.15)',
          position: 'relative', transition: 'background 0.18s ease',
          padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 22, height: 22, borderRadius: 99,
          background: on ? TAN : 'rgba(255,255,255,0.6)',
          transition: 'left 0.18s ease, background 0.18s ease',
        }} />
      </button>
    </div>
  );
}
