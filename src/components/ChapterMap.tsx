import { useEffect, useMemo, useState } from 'react';
import { LEVELS, TOTAL_LEVELS, type Level } from '../engine/adventure/levelConfig';
import {
  loadProgress,
  getInitialProgress,
  getStarsForLevel,
  isLevelUnlocked,
  type AdventureProgress,
} from '../engine/adventure/progressManager';

const TAN = '#E8C577';
const BROWN = '#72571C';
const JADE = '#065F46';

// Per-world subtle tints. World 1 keeps the warm tan base;
// later worlds shift cooler/sharper/redder to telegraph progression.
const WORLD_TINT: Record<number, string> = {
  1: TAN,        // Basics — warm tan
  2: '#7ED1B3',  // Sharper — minty jade
  3: '#F59E0B',  // Hunter — amber
  4: '#EF4444',  // Endgame — crimson
};

// Hand-curated path positions across the 12 nodes (x %, y %).
const NODE_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 18, y: 88 }, { x: 38, y: 80 }, { x: 24, y: 72 },
  { x: 50, y: 65 }, { x: 68, y: 60 }, { x: 50, y: 52 },
  { x: 30, y: 44 }, { x: 55, y: 36 }, { x: 75, y: 30 },
  { x: 50, y: 22 }, { x: 30, y: 14 }, { x: 60, y: 6 },
];

interface NodeData extends Level {
  x: number;
  y: number;
  boss: boolean;
  tint: string;
}

const NODES: NodeData[] = LEVELS.map((lvl, i) => ({
  ...lvl,
  x: NODE_POSITIONS[i].x,
  y: NODE_POSITIONS[i].y,
  boss: lvl.id === TOTAL_LEVELS,
  tint: WORLD_TINT[lvl.world],
}));

interface Props {
  onBack: () => void;
  onSelectLevel: (levelId: number) => void;
}

export function ChapterMap({ onBack, onSelectLevel }: Props) {
  const [progress, setProgress] = useState<AdventureProgress>(getInitialProgress);
  useEffect(() => { setProgress(loadProgress()); }, []);

  // Active node: first unlocked but incomplete level
  const activeIdx = useMemo(() => {
    const found = NODES.findIndex((n) => isLevelUnlocked(progress, n.id) && getStarsForLevel(progress, n.id) === 0);
    return found >= 0 ? found : 0;
  }, [progress]);
  const currentNode = NODES[activeIdx];
  const totalStars = progress.totalStars;
  const maxStars = NODES.length * 3;

  // Build segmented path so each segment can take its world's tint.
  const pathSegments = useMemo(() => {
    const segs: { d: string; tint: string }[] = [];
    for (let i = 1; i < NODES.length; i++) {
      const a = NODES[i - 1];
      const b = NODES[i];
      const cx = (a.x + b.x) / 2;
      segs.push({
        d: `M ${a.x} ${a.y} Q ${cx} ${a.y} ${b.x} ${b.y}`,
        tint: b.tint,
      });
    }
    return segs;
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, #0d0805 0%, #1a1410 60%, #0d0805 100%)',
      color: '#fff', fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(184,134,47,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(184,134,47,0.05) 0%, transparent 50%)',
      }} />

      <div style={{ height: 50 }} />

      {/* Top nav */}
      <div style={{ padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 99,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: TAN, fontSize: 18, fontWeight: 600, cursor: 'pointer',
        }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: BROWN, letterSpacing: '0.22em', fontWeight: 600 }}>
            THE RUN · {currentNode.worldName.toUpperCase()}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginTop: 2, letterSpacing: '-0.01em' }}>
            {currentNode.title}
          </div>
        </div>
        <div style={{
          padding: '6px 10px', borderRadius: 99,
          background: 'rgba(184,134,47,0.12)', border: '1px solid rgba(184,134,47,0.35)',
          display: 'flex', alignItems: 'center', gap: 5,
          color: TAN, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        }}>
          <span>★</span><span>{totalStars}/{maxStars}</span>
        </div>
      </div>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', padding: '20px 0' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {pathSegments.map((seg, i) => (
            <path key={i} d={seg.d} fill="none" stroke={seg.tint}
              strokeWidth="0.4" strokeDasharray="1 1.5" strokeLinecap="round" opacity="0.55" />
          ))}
        </svg>

        {NODES.map((n, i) => {
          const stars = getStarsForLevel(progress, n.id);
          const unlocked = isLevelUnlocked(progress, n.id);
          const isCurrent = i === activeIdx;
          const isPast = stars > 0;
          const isLocked = !unlocked;

          return (
            <NodeDot
              key={n.id}
              node={n}
              stars={stars}
              isCurrent={isCurrent}
              isPast={isPast}
              isLocked={isLocked}
              onTap={() => { if (!isLocked) onSelectLevel(n.id); }}
            />
          );
        })}
      </div>

      {/* Bottom level card */}
      <div style={{
        margin: '0 20px 30px', padding: 16,
        background: 'rgba(184,134,47,0.1)',
        border: `1px solid ${currentNode.tint}66`,
        borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative', zIndex: 2,
        cursor: 'pointer',
      }} onClick={() => onSelectLevel(currentNode.id)}>
        <MiniCard w={56} accent={currentNode.tint} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: currentNode.tint, letterSpacing: '0.2em', fontWeight: 600 }}>
            {activeIdx > 0 ? `NEXT · ${currentNode.displayId.toUpperCase()}` : `START HERE · 1-1`}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, marginTop: 3 }}>{currentNode.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            {activeIdx > 0
              ? `${getStarsForLevel(progress, currentNode.id) > 0 ? '★'.repeat(getStarsForLevel(progress, currentNode.id)) + '☆'.repeat(3 - getStarsForLevel(progress, currentNode.id)) + ' · ' : ''}Resume run`
              : 'Learn the basics'}
          </div>
        </div>
        <div style={{
          fontWeight: 700, fontSize: 12, color: '#1a1410',
          background: currentNode.tint, padding: '10px 16px', borderRadius: 99,
          letterSpacing: '0.08em',
        }}>{activeIdx > 0 ? 'RESUME' : 'START'} →</div>
      </div>
    </div>
  );
}

// ─── Node dot ───────────────────────────────────────

function NodeDot({ node, stars, isCurrent, isPast, isLocked, onTap }: {
  node: NodeData; stars: number;
  isCurrent: boolean; isPast: boolean; isLocked: boolean;
  onTap: () => void;
}) {
  const size = node.boss ? 38 : 28;
  const tint = node.tint;
  const bg = isPast ? tint : isCurrent ? tint : 'rgba(255,255,255,0.04)';
  const border = isLocked ? `${tint}55` : tint;
  const fg = isLocked ? 'rgba(255,255,255,0.3)' : isPast || isCurrent ? '#1a1410' : tint;

  return (
    <div
      onClick={isLocked ? undefined : onTap}
      style={{
        position: 'absolute', left: `${node.x}%`, top: `${node.y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: isLocked ? 'default' : 'pointer',
      }}
    >
      {isCurrent && (
        <div style={{
          position: 'absolute', width: size + 14, height: size + 14, borderRadius: 99,
          border: `1.5px solid ${tint}`, opacity: 0.4,
          animation: 'breathe 2s ease-in-out infinite',
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: node.boss ? 8 : 99,
        background: bg, border: `1.5px ${isLocked ? 'dashed' : 'solid'} ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fg, fontWeight: 800, fontSize: node.boss ? 14 : 11,
        boxShadow: isCurrent ? `0 0 16px ${tint}66` : 'none',
      }}>
        {isLocked ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2" y="4.5" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <path d="M3.5 4.5V3a1.5 1.5 0 013 0v1.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : node.boss ? '♛' : node.displayId}
      </div>
      {(isCurrent || node.boss) && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 7,
          color: isLocked ? 'rgba(184,134,47,0.5)' : tint,
          letterSpacing: '0.1em', fontWeight: 600, whiteSpace: 'nowrap',
          background: 'rgba(13,8,5,0.85)', padding: '2px 5px', borderRadius: 3, marginTop: 2,
        }}>{(node.boss ? 'BOSS · ' : '') + node.displayId.toUpperCase()}</div>
      )}
      {isPast && stars > 0 && (
        <div style={{ fontSize: 7, color: tint, letterSpacing: '0.5px', marginTop: -2 }}>
          {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
        </div>
      )}
    </div>
  );
}

// ─── Mini card for bottom panel ─────────────────────

function MiniCard({ w, accent }: { w: number; accent: string }) {
  const h = w * (3.5 / 2.5);
  const bottomR = Math.max(4, Math.round(w * 0.03));
  return (
    <div style={{
      width: w, height: h, borderRadius: Math.round(w * 0.06),
      background: '#FFFFFF', position: 'relative', overflow: 'hidden', flexShrink: 0,
      transform: 'rotate(-4deg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    }}>
      <div style={{ position: 'absolute', left: '10%', top: 0, width: '18%', height: '70%', background: JADE, borderRadius: `0 0 ${bottomR}px ${bottomR}px`, zIndex: 1 }} />
      <div style={{ position: 'absolute', left: '34%', right: '6%', top: 0, bottom: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: w * 0.01 }}>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: w * 0.50, lineHeight: 0.85, letterSpacing: '-0.05em', color: accent }}>A</div>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: w * 0.30, lineHeight: 1, color: BROWN }}>{'♠︎'}</div>
      </div>
    </div>
  );
}
