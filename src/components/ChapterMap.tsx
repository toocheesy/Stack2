import { useEffect, useState } from 'react';
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

interface Node {
  x: number; y: number;
  name: string; sub: string;
  boss?: boolean;
  levelId: number;
}

const NODES: Node[] = [
  { x: 18, y: 88, name: 'The Opening Hand', sub: 'Tutorial', levelId: 1 },
  { x: 38, y: 80, name: 'First Capture', sub: 'Lvl 2', levelId: 2 },
  { x: 24, y: 72, name: 'Combo Basics', sub: 'Lvl 3', levelId: 3 },
  { x: 50, y: 65, name: 'The Stack', sub: 'Lvl 4', levelId: 4 },
  { x: 68, y: 60, name: 'Suit Tactics', sub: 'Lvl 5', levelId: 5 },
  { x: 50, y: 52, name: 'Boss · The Dealer', sub: 'Boss', boss: true, levelId: 6 },
  { x: 30, y: 44, name: 'Court Cards', sub: 'Lvl 7', levelId: 7 },
  { x: 55, y: 36, name: 'Wild Hand', sub: 'Lvl 8', levelId: 8 },
  { x: 75, y: 30, name: 'Speed Round', sub: 'Lvl 9', levelId: 9 },
  { x: 50, y: 22, name: 'Doubles', sub: 'Lvl 10', levelId: 10 },
  { x: 30, y: 14, name: 'Triple Stack', sub: 'Lvl 11', levelId: 11 },
  { x: 60, y: 6, name: 'Boss · The House', sub: 'Final', boss: true, levelId: 12 },
];

interface Props {
  onBack: () => void;
  onSelectLevel: (levelId: number) => void;
}

export function ChapterMap({ onBack, onSelectLevel }: Props) {
  const [progress, setProgress] = useState<AdventureProgress>(getInitialProgress);
  useEffect(() => { setProgress(loadProgress()); }, []);

  // Find current node: first unlocked but incomplete level
  const currentIdx = NODES.findIndex((n) => {
    const unlocked = isLevelUnlocked(progress, n.levelId);
    const stars = getStarsForLevel(progress, n.levelId);
    return unlocked && stars === 0;
  });
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;
  const currentNode = NODES[activeIdx];
  const totalStars = progress.totalStars;
  const maxStars = NODES.length * 3;

  const pathD = NODES.reduce((acc, n, i) => {
    if (i === 0) return `M ${n.x} ${n.y}`;
    const p = NODES[i - 1];
    const cx = (p.x + n.x) / 2;
    return acc + ` Q ${cx} ${p.y} ${n.x} ${n.y}`;
  }, '');

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
            CAMPAIGN · CH. 1
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginTop: 2, letterSpacing: '-0.01em' }}>
            {currentNode.name}
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
          <path d={pathD} fill="none" stroke={BROWN} strokeWidth="0.4" strokeDasharray="1 1.5" strokeLinecap="round" opacity="0.5" />
        </svg>

        {NODES.map((n, i) => {
          const isCurrent = i === activeIdx;
          const isPast = i < activeIdx || getStarsForLevel(progress, n.levelId) > 0;
          const isLocked = !isPast && !isCurrent;
          const stars = getStarsForLevel(progress, n.levelId);

          return (
            <NodeDot
              key={i}
              node={n}
              idx={i}
              stars={stars}
              isCurrent={isCurrent}
              isPast={isPast}
              isLocked={isLocked}
              onTap={() => {
                if (!isLocked) onSelectLevel(n.levelId);
              }}
            />
          );
        })}
      </div>

      {/* Bottom level card */}
      <div style={{
        margin: '0 20px 30px', padding: 16,
        background: 'rgba(184,134,47,0.1)',
        border: '1px solid rgba(184,134,47,0.4)',
        borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'relative', zIndex: 2,
        cursor: 'pointer',
      }} onClick={() => onSelectLevel(currentNode.levelId)}>
        <MiniCard w={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: TAN, letterSpacing: '0.2em', fontWeight: 600 }}>
            {activeIdx > 0 ? `NEXT · LVL ${currentNode.levelId}` : `START HERE · LVL 1`}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, marginTop: 3 }}>{currentNode.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            {activeIdx > 0 ? `${getStarsForLevel(progress, currentNode.levelId) > 0 ? '★'.repeat(getStarsForLevel(progress, currentNode.levelId)) + '☆'.repeat(3 - getStarsForLevel(progress, currentNode.levelId)) + ' · ' : ''}Resume run` : 'Learn the basics'}
          </div>
        </div>
        <div style={{
          fontWeight: 700, fontSize: 12, color: '#1a1410',
          background: TAN, padding: '10px 16px', borderRadius: 99,
          letterSpacing: '0.08em',
        }}>{activeIdx > 0 ? 'RESUME' : 'BEGIN'} →</div>
      </div>
    </div>
  );
}

// ─── Node dot ───────────────────────────────────────

function NodeDot({ node, idx, stars, isCurrent, isPast, isLocked, onTap }: {
  node: Node; idx: number; stars: number;
  isCurrent: boolean; isPast: boolean; isLocked: boolean;
  onTap: () => void;
}) {
  const size = node.boss ? 38 : 28;
  const bg = isPast ? BROWN : isCurrent ? TAN : 'rgba(255,255,255,0.04)';
  const border = isLocked ? 'rgba(184,134,47,0.3)' : BROWN;
  const fg = isLocked ? 'rgba(255,255,255,0.3)' : isPast || isCurrent ? '#1a1410' : BROWN;

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
          border: `1.5px solid ${TAN}`, opacity: 0.4,
          animation: 'breathe 2s ease-in-out infinite',
        }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: node.boss ? 8 : 99,
        background: bg, border: `1.5px ${isLocked ? 'dashed' : 'solid'} ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: fg, fontWeight: 800, fontSize: node.boss ? 14 : 12,
        boxShadow: isCurrent ? '0 0 16px rgba(232,197,119,0.4)' : 'none',
      }}>
        {isLocked ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2" y="4.5" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1" />
            <path d="M3.5 4.5V3a1.5 1.5 0 013 0v1.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : node.boss ? '♛' : (idx + 1)}
      </div>
      {(isCurrent || node.boss) && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 7,
          color: isLocked ? 'rgba(184,134,47,0.5)' : TAN,
          letterSpacing: '0.1em', fontWeight: 600, whiteSpace: 'nowrap',
          background: 'rgba(13,8,5,0.85)', padding: '2px 5px', borderRadius: 3, marginTop: 2,
        }}>{node.sub.toUpperCase()}</div>
      )}
      {isPast && stars > 0 && (
        <div style={{ fontSize: 7, color: TAN, letterSpacing: '0.5px', marginTop: -2 }}>
          {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
        </div>
      )}
    </div>
  );
}

// ─── Mini card for bottom panel ─────────────────────

function MiniCard({ w }: { w: number }) {
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
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: w * 0.50, lineHeight: 0.85, letterSpacing: '-0.05em', color: TAN }}>A</div>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: w * 0.30, lineHeight: 1, color: BROWN }}>{'\u2660\uFE0E'}</div>
      </div>
    </div>
  );
}
