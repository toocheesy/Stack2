import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { LEVELS, getLevelsForWorld } from '../engine/adventure/levelConfig';
import {
  loadProgress,
  getInitialProgress,
  isLevelUnlocked,
  isWorldUnlocked,
  starsRemainingForWorld,
  getStarsForLevel,
  type AdventureProgress,
} from '../engine/adventure/progressManager';
import { C } from '../config/colors';
import { getTransition } from '../config/motion';

const WORLDS = [1, 2, 3, 4, 5, 6] as const;
const MAX_STARS = LEVELS.length * 3;

interface Props {
  onBack: () => void;
  onSelectLevel: (levelId: number) => void;
}

export function WorldMap({ onBack, onSelectLevel }: Props) {
  const [progress, setProgress] = useState<AdventureProgress>(getInitialProgress);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: C.slateBg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', flexShrink: 0,
        borderBottom: `1px solid ${C.divider}`,
      }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          transition={getTransition('snappy')}
          style={{
            width: 36, height: 36, borderRadius: 8,
            border: `1px solid ${C.divider}`, background: 'transparent',
            color: C.textSecondary, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          ←
        </motion.button>
        <h2 style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18,
          color: C.textPrimary, margin: 0, flex: 1,
        }}>
          Adventure
        </h2>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
          fontWeight: 600, color: C.amber,
        }}>
          {'★'} {progress.totalStars}/{MAX_STARS}
        </span>
      </div>

      {/* Scrollable body */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px 32px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {WORLDS.map((worldNum) => {
          const levels = getLevelsForWorld(worldNum);
          if (levels.length === 0) return null;
          const worldName = levels[0].worldName;
          const worldOpen = isWorldUnlocked(progress, worldNum);
          const remaining = starsRemainingForWorld(progress, worldNum);

          return (
            <div key={worldNum} style={{ opacity: worldOpen ? 1 : 0.45 }}>
              {/* World header */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                marginBottom: 10, paddingLeft: 4,
              }}>
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
                  color: worldOpen ? C.textSecondary : C.disabledText,
                  letterSpacing: 1.5, textTransform: 'uppercase',
                }}>
                  {worldOpen ? '' : '\u{1F512} '}World {worldNum}
                </span>
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500,
                  color: worldOpen ? C.textSecondary : C.disabledText,
                }}>
                  {worldName}
                </span>
                {!worldOpen && remaining > 0 && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600,
                    color: C.amber, marginLeft: 'auto',
                  }}>
                    {remaining} ★ to unlock
                  </span>
                )}
              </div>

              {/* Level tiles */}
              <div style={{ display: 'flex', gap: 10 }}>
                {levels.map((level) => {
                  const unlocked = worldOpen && isLevelUnlocked(progress, level.id);
                  const stars = getStarsForLevel(progress, level.id);

                  return (
                    <LevelTile
                      key={level.id}
                      levelId={level.id}
                      stars={stars}
                      unlocked={unlocked}
                      onTap={() => {
                        if (unlocked) onSelectLevel(level.id);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Level Tile ─────────────────────────────────────

function LevelTile({ levelId, stars, unlocked, onTap }: {
  levelId: number;
  stars: 0 | 1 | 2 | 3;
  unlocked: boolean;
  onTap: () => void;
}) {
  const completed = stars > 0;

  return (
    <motion.button
      onClick={unlocked ? onTap : undefined}
      whileTap={unlocked ? { scale: 0.95 } : undefined}
      transition={getTransition('snappy')}
      style={{
        flex: '1 1 0',
        aspectRatio: '1',
        maxWidth: 100,
        borderRadius: 10,
        border: unlocked
          ? completed
            ? `2px solid ${C.indigo}`
            : `1px solid ${C.indigo}`
          : `1px solid ${C.divider}`,
        background: unlocked
          ? completed
            ? 'rgba(79,70,229,0.1)'
            : 'rgba(79,70,229,0.04)'
          : 'rgba(255,255,255,0.02)',
        opacity: unlocked ? 1 : 0.4,
        cursor: unlocked ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        position: 'relative' as const,
      }}
    >
      {/* Lock icon for locked levels */}
      {!unlocked && (
        <span style={{
          fontSize: 16, color: C.disabledText,
          position: 'absolute', top: 6, right: 8,
        }}>
          &#128274;
        </span>
      )}

      {/* Level number */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700, fontSize: 22,
        color: unlocked ? C.textPrimary : C.disabledText,
      }}>
        {levelId}
      </span>

      {/* Stars */}
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              fontSize: 12,
              color: i <= stars ? C.amber : unlocked ? C.divider : C.disabledText,
            }}
          >
            {i <= stars ? '★' : '☆'}
          </span>
        ))}
      </div>
    </motion.button>
  );
}
