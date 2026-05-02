const JADE = '#065F46';
const CREAM = '#FAFAF5';
const CARD_W = 100;
const CARD_H = 140;
const SHADOW = '0 0 16px rgba(6,95,70,0.3), 0 8px 24px rgba(0,0,0,0.5)';

const BANDS = [
  { bg: '#0A0A0A', label: 'CHARCOAL' },
  { bg: '#1A1410', label: 'WARM EBONY' },
  { bg: '#0A1F1A', label: 'JADE-TINTED' },
] as const;

function CardPair() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: CARD_W }}>
      {/* Card Face */}
      <div style={{
        width: CARD_W, height: CARD_H, borderRadius: 10,
        background: '#FFFFFF', position: 'relative', overflow: 'hidden',
        boxShadow: SHADOW, flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', left: '10%', top: 0, width: '18%', height: '70%', background: JADE, borderRadius: 2 }} />
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 36, lineHeight: 1, color: '#DC2626' }}>J</span>
          <span style={{ fontSize: 20, lineHeight: 1, color: '#DC2626' }}>♥</span>
        </div>
      </div>

      {/* Card Back */}
      <div style={{
        width: CARD_W, height: CARD_H, borderRadius: 10,
        background: JADE, position: 'relative', overflow: 'hidden',
        boxShadow: SHADOW, flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, transparent 30%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '10%', top: 0, width: '18%', height: '70%', background: CREAM, borderRadius: 2, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 10, color: JADE, opacity: 0.15, letterSpacing: '0.1em', transform: 'rotate(90deg)', whiteSpace: 'nowrap' as const, userSelect: 'none' as const }}>STACKED</span>
        </div>
      </div>
    </div>
  );
}

export function CardAtomTest() {
  return (
    <div style={{ width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {BANDS.map(({ bg, label }) => (
        <div key={label} style={{
          flex: 1, background: bg, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            position: 'absolute', top: 10, left: 14,
            fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500,
            color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase' as const,
          }}>
            {label}
          </span>
          <CardPair />
        </div>
      ))}
    </div>
  );
}
