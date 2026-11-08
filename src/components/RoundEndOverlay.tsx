import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Difficulty, GameState, PlayerIndex, RoundStats, Scores } from '../engine/types';
import { C } from '../config/colors';
import { FONTS } from '../config/fonts';
import { getTransition } from '../config/motion';
import { CardComponent } from './Card';
import { RaceBar } from './board/pieces';
import { SHEET_DIM, SHEET_GLOW, sheetColourOf } from './board/sheet';
import { captureLine } from './board/words';

// Round end, RE1p Score Sheet in Plum (D-007 rulings 70 and 71): a plum
// sheet rises over the table dimmed by the table colour at 85%, with a 2px
// gold edge and the gold glow. One row per player in finishing order; the
// round's top scorer sits on deep plum in a gold frame with TOP ROUND; the
// taker's row carries "Took the Table" (RULES.md Law 10). The next round
// deals itself after 10 seconds or on CONTINUE.

const AUTO_ADVANCE_SEC = 10;

interface Props {
  visible: boolean;
  roundNumber: number;
  roundStats: [RoundStats, RoundStats, RoundStats];
  overallScores: Scores;
  targetScore: number;
  bot1Personality: Difficulty;
  bot2Personality: Difficulty;
  onContinue: () => void;
  /** RULES.md Law 11: the round ended with a tie at the top; one more round. */
  isOvertime: boolean;
  /** "CLASSIC" or "THE RUN", for the line above the title. */
  modeWord: string;
  /** The Run's games use the same sheet (the prop stays for the caller). */
  adventureMode?: boolean;
}

const NAMES: Record<Difficulty, string> = { beginner: 'Calvin', intermediate: 'Nina', advanced: 'Rex', expert: 'Jett' };

interface Row {
  idx: PlayerIndex;
  name: string;
  colour: string;
  points: number;
  total: number;
  stats: RoundStats;
}

export function RoundEndOverlay({
  visible, roundNumber, roundStats, overallScores, targetScore, bot1Personality, bot2Personality, onContinue, isOvertime, modeWord,
}: Props) {
  const calm = useReducedMotion();
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_SEC);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!visible) { setCountdown(AUTO_ADVANCE_SEC); return; }
    setCountdown(AUTO_ADVANCE_SEC);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onContinueRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  // The sheet's colours follow the seats' personalities.
  const forColour = { settings: { bot1Personality, bot2Personality } } as GameState;
  const rows: Row[] = ([0, 1, 2] as PlayerIndex[]).map((idx) => ({
    idx,
    name: idx === 0 ? 'You' : NAMES[idx === 1 ? bot1Personality : bot2Personality],
    colour: sheetColourOf(idx, forColour),
    points: roundStats[idx].pointsThisRound,
    total: idx === 0 ? overallScores.player : idx === 1 ? overallScores.bot1 : overallScores.bot2,
    stats: roundStats[idx],
  }));
  // Finishing order: by score, then by seat.
  rows.sort((a, b) => b.total - a.total || a.idx - b.idx);
  const topPoints = Math.max(...rows.map((r) => r.points));
  const topRound = topPoints > 0 ? rows.find((r) => r.points === topPoints)!.idx : null;
  // The bars reach the target; once a score passes it, they reach a fifth beyond and mark the target.
  const topTotal = Math.max(...rows.map((r) => r.total));
  const barMax = topTotal > targetScore ? targetScore * 1.2 : targetScore;
  const tied = rows.filter((r) => r.total === topTotal);
  const tiedNames = tied.map((r) => r.name);
  const tiedSentence = tiedNames.length === 2
    ? `${tiedNames[0]} and ${tiedNames[1]} both have ${topTotal}.`
    : `${tiedNames.slice(0, -1).join(', ')} and ${tiedNames[tiedNames.length - 1]} all have ${topTotal}.`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div key="round-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: SHEET_DIM }} />
          <motion.section
            aria-label="Round end"
            initial={calm ? { opacity: 0 } : { y: '100%' }}
            animate={calm ? { opacity: 1 } : { y: 0 }}
            exit={calm ? { opacity: 0 } : { y: '100%' }}
            transition={calm ? { duration: 0.3, ease: 'linear' } : { duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: `calc(100% - ${isOvertime ? 96 : 190}px)`, boxSizing: 'border-box',
              padding: '20px 20px 24px', background: C.classicSheet, borderTop: `2px solid ${C.classicGold}`, borderRadius: '24px 24px 0 0',
              boxShadow: SHEET_GLOW, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONTS.sans, color: C.classicSheetInk,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.classicSheetMuted }}>{modeWord} · TARGET {targetScore}</div>
              <h2 style={{ margin: '2px 0 0', fontFamily: FONTS.display, fontWeight: 400, fontSize: 32, lineHeight: 1.1, color: C.classicSheetInk }}>Round {roundNumber} is over</h2>
            </div>

            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isOvertime && (
                <div role="status" style={{ padding: '12px 14px', borderRadius: 8, border: `2px solid ${C.classicGold}`, background: C.classicSheetDeep, display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 22, lineHeight: 1.15, color: C.classicGold }}>Tied at the top.</span>
                  <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 22, lineHeight: 1.15, color: C.classicSheetInk }}>One more round.</span>
                  <span style={{ fontSize: 12, color: C.classicSheetMuted }}>{tiedSentence} Round {roundNumber + 1} is next.</span>
                </div>
              )}

              <div>
                {rows.map((row) => {
                  const framed = row.idx === topRound;
                  const best = row.stats.highestCapture;
                  return (
                    <div key={row.idx} style={framed
                      ? { padding: '10px 8px', margin: '2px -8px', borderRadius: 10, background: C.classicSheetDeep, border: `2px solid ${C.classicGold}`, display: 'flex', flexDirection: 'column', gap: 8 }
                      : { padding: '12px 0', borderTop: `1px solid ${C.classicSheetLine}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                          <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 22, color: row.colour, whiteSpace: 'nowrap' }}>{row.name}</span>
                          {framed && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: C.classicGold, whiteSpace: 'nowrap' }}>TOP ROUND</span>}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.classicSheetInk }}>+{row.points}</span>
                          <span style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 26, color: C.classicSheetInk }}>{row.total}</span>
                          <span style={{ fontSize: 13, color: C.classicSheetMuted }}>/ {targetScore}</span>
                        </span>
                      </div>
                      <div style={{ position: 'relative', display: 'flex' }}>
                        <RaceBar value={row.total} max={barMax} colour={row.colour} height={10} track={C.classicSheetLine} />
                        {barMax !== targetScore && (
                          <div aria-hidden="true" style={{ position: 'absolute', left: `${(targetScore / barMax) * 100}%`, top: -4, width: 2, height: 18, background: C.classicSheetInk }} />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60 }}>
                        {best && (
                          <div style={{ display: 'flex', gap: 6, padding: 2 }}>
                            {best.cards.map((c) => <CardComponent key={c.id} card={c} size="slot" />)}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          {best
                            ? <span style={{ fontSize: 13, color: C.classicSheetMuted }}>Best capture <b style={{ color: C.classicSheetInk }}>{captureLine(best)}</b>, +{best.points}</span>
                            : <span style={{ fontSize: 13, color: C.classicSheetMuted }}>No captures this round</span>}
                          {row.stats.tookTheTable && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px', borderRadius: 999, border: `1px solid ${C.classicSheetLine}`, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: C.classicSheetInk }}>Took the Table</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.classicSheetMuted }}>
                  <span>Round {roundNumber + 1} deals in <b style={{ color: C.classicSheetInk }}>{countdown}</b></span>
                  <span>{AUTO_ADVANCE_SEC}s</span>
                </div>
                <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: C.classicSheetDeep, overflow: 'hidden' }}>
                  <motion.div animate={{ scaleX: countdown / AUTO_ADVANCE_SEC }} transition={calm ? { duration: 0 } : { duration: 1, ease: 'linear' }}
                    style={{ width: '100%', height: '100%', background: C.classicGold, transformOrigin: 'left center' }} />
                </div>
              </div>
              <motion.button type="button" onClick={onContinue} whileTap={{ scale: 0.98 }} transition={getTransition('snappy')} style={{
                width: '100%', height: 52, borderRadius: 6, border: 'none', background: C.classicGold, fontFamily: FONTS.sans,
                fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', color: C.classicTable, cursor: 'pointer',
              }}>
                CONTINUE
              </motion.button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
