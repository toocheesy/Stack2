import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LastCaptureInfo } from '../game/useGameController';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { tween } from '../config/motion';

const PLAYER_COLORS: Record<number, string> = {
  0: C.accent.classic, 1: C.line.classic, 2: C.botAzure,
};
const HOLD_MS = 3000;

export function LastCaptureCallout({ info }: { info: LastCaptureInfo | null }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<LastCaptureInfo | null>(null);

  useEffect(() => {
    if (!info) return;
    setCurrent(info);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [info]);

  const borderColor = current ? (PLAYER_COLORS[current.playerIndex] ?? C.muted.classic) : C.muted.classic;
  const areas = current?.areas ?? [];
  const formulaLen = (current?.baseCard?.rank.length ?? 0)
    + areas.reduce((sum, a) => sum + a.reduce((s, c) => s + c.rank.length + 1, -1), 0)
    + areas.length * 3;
  const fontSize = formulaLen > 18 ? 11 : 13;

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tween.default}
          style={{
            width: '100%', padding: '4px 12px 6px',
            borderBottom: `1px solid ${borderColor}66`,
            display: 'flex', alignItems: 'center', gap: 6,
            justifyContent: 'center', flexShrink: 0,
          }}
        >
          <span style={{
            fontSize: 9, fontWeight: 600, color: C.muted.classic,
            letterSpacing: 1, fontFamily: FONTS.sans,
            textTransform: 'uppercase', flexShrink: 0,
          }}>LAST CAPTURE</span>

          <span style={{
            fontSize, fontWeight: 600,
            fontFamily: FONTS.sans,
            color: C.ink.classic, whiteSpace: 'nowrap',
          }}>
            {current.baseCard?.rank}
            {areas.map((area, i) => (
              <span key={i}>
                <span style={{ color: C.muted.classic, fontWeight: 400 }}> = </span>
                {area.map((c, j) => (
                  <span key={c.id}>
                    {j > 0 && <span style={{ color: C.muted.classic, fontWeight: 400 }}>+</span>}
                    {c.rank}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
