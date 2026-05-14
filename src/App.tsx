import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameView } from './components/GameView';
import { ClassicSetup } from './components/ClassicSetup';
import { ChapterMap } from './components/ChapterMap';
import { useGameController } from './game/useGameController';
import type { Difficulty, GameSettings } from './engine/types';
import { loadGame, clearSavedGame } from './game/persistence';
import { getLevel, TOTAL_LEVELS } from './engine/adventure/levelConfig';
import { calculateStars, recordLevelCompletion, loadProgress, saveProgress, getLevelWorld, isWorldUnlocked, unlockJettInClassic, isFinalLevel } from './engine/adventure/progressManager';
import { LevelCompleteOverlay } from './components/LevelCompleteOverlay';
import { CardAtomTest } from './components/CardAtomTest';

type Screen = 'home' | 'setup' | 'worldMap' | 'game' | 'cardtest';

const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currentLevelId, setCurrentLevelId] = useState<number | null>(null);

  const goToSetup = useCallback(() => {
    setScreen('setup');
  }, []);

  const startWithSettings = useCallback((targetScore: number, bot1: Difficulty, bot2: Difficulty) => {
    clearSavedGame();
    setCurrentLevelId(null);
    setSeed(Math.floor(Math.random() * 1_000_000));
    setSettings({ targetScore, bot1Personality: bot1, bot2Personality: bot2 });
    setScreen('game');
  }, []);

  const settingsForLevel = useCallback((levelId: number): GameSettings => {
    const level = getLevel(levelId)!;
    return {
      targetScore: level.targetScore,
      bot1Personality: level.bots[0],
      bot2Personality: level.bots[1],
      hintStripEnabled: level.hintStripEnabled,
      disableSeatingSwap: !level.turnOrderSwap,
    };
  }, []);

  const continueGame = useCallback(() => {
    setScreen('game');
  }, []);

  const goHome = useCallback(() => {
    clearSavedGame();
    setCurrentLevelId(null);
    setScreen('home');
  }, []);

  const goToWorldMap = useCallback(() => {
    clearSavedGame();
    setScreen('worldMap');
  }, []);

  const playAgain = useCallback(() => {
    clearSavedGame();
    setSeed(Math.floor(Math.random() * 1_000_000));
  }, []);

  const nextLevel = useCallback(() => {
    if (!currentLevelId) return;
    const nextId = currentLevelId + 1;
    if (!getLevel(nextId)) return;
    setCurrentLevelId(nextId);
    clearSavedGame();
    setSeed(Math.floor(Math.random() * 1_000_000));
    setSettings(settingsForLevel(nextId));
  }, [currentLevelId, settingsForLevel]);

  if (screen === 'cardtest') {
    return <CardAtomTest />;
  }

  if (screen === 'worldMap') {
    return (
      <ChapterMap
        onBack={() => setScreen('home')}
        onSelectLevel={(id) => {
          if (!getLevel(id)) return;
          setCurrentLevelId(id);
          clearSavedGame();
          setSeed(Math.floor(Math.random() * 1_000_000));
          setSettings(settingsForLevel(id));
          setScreen('game');
        }}
      />
    );
  }

  if (screen === 'setup') {
    return (
      <ClassicSetup
        onStart={startWithSettings}
        onBack={goHome}
      />
    );
  }

  if (screen === 'game') {
    return (
      <GameWrapper
        key={seed}
        seed={seed}
        settings={settings}
        currentLevelId={currentLevelId}
        onQuit={currentLevelId ? goToWorldMap : goHome}
        onHome={currentLevelId ? goToWorldMap : goHome}
        onPlayAgain={playAgain}
        onNextLevel={nextLevel}
      />
    );
  }

  const hasSave = !!loadGame();
  return (
    <TitleScreen
      onNewGame={goToSetup}
      onAdventure={() => setScreen('worldMap')}
      onContinue={hasSave ? continueGame : undefined}
    />
  );
}

// ─── Homepage constants (LOCKED) ────────────────────

const JADE = '#065F46';
const TAN = '#E8C577';
const BROWN = '#72571C';
const HOME_BG = '#0A0A0A';

// ─── Animation keyframes (injected once) ────────────

const styleId = 'stacked-home-anims';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const s = document.createElement('style');
  s.id = styleId;
  s.textContent = `
    @keyframes breathe { 0%,100% { transform: rotate(var(--tilt,0deg)) translateY(0); } 50% { transform: rotate(var(--tilt,0deg)) translateY(-4px); } }
    @keyframes breathe2 { 0%,100% { transform: rotate(var(--tilt,0deg)) translateY(0); } 50% { transform: rotate(var(--tilt,0deg)) translateY(-6px); } }
    @keyframes drawPath { to { stroke-dashoffset: 0; } }
    @keyframes nodeFade { from { opacity: 0; } to { opacity: 1; } }
    .breathe { animation: breathe 4s ease-in-out infinite; }
    .breathe-2 { animation: breathe2 4s ease-in-out infinite 0.5s; }
    .draw-path { stroke-dashoffset: 200; animation: drawPath 2s ease forwards; }
    .node-fade { opacity: 0; animation: nodeFade 0.4s ease forwards; }
  `;
  document.head.appendChild(s);
}

// ─── Title Screen (LOCKED) ──────────────────────────

function TitleScreen({ onNewGame, onAdventure, onContinue }: { onNewGame: () => void; onAdventure: () => void; onContinue?: () => void }) {
  const hasAdventureProgress = (() => {
    try { const r = localStorage.getItem('stacked_v2_adventure_progress'); return !!r; } catch { return false; }
  })();

  return (
    <div style={{
      position: 'absolute', inset: 0, background: HOME_BG, color: '#fff',
      padding: '74px 24px 54px', display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      backgroundImage: 'radial-gradient(circle at 30% 10%, rgba(6,95,70,0.10) 0%, transparent 50%), radial-gradient(circle at 80% 90%, rgba(232,197,119,0.05) 0%, transparent 50%)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>
          STACKED<span style={{ color: JADE }}>!</span>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#7a8580', letterSpacing: '0.22em', fontWeight: 500 }}>
          CHOOSE YOUR GAME
        </div>
      </div>

      {/* Hero cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, minHeight: 0 }}>
        <ClassicHeroCard onPlay={onNewGame} />
        <AdventureHeroCard onPlay={onAdventure} returning={hasAdventureProgress} />
      </div>

      {/* Footer */}
      {onContinue && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, flexShrink: 0 }}>
          <button onClick={onContinue} style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, fontWeight: 500, color: JADE, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Continue saved game
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mini card primitives (proportional to locked spec) ──

function MiniCardFace({ w, rank, suit }: { w: number; rank: string; suit: string }) {
  const h = w * (3.5 / 2.5);
  const bottomR = Math.max(4, Math.round(w * 0.03));
  const isRed = suit === '♥' || suit === '♦';
  const rankColor = isRed ? TAN : BROWN;
  const suitColor = isRed ? BROWN : TAN;
  return (
    <div style={{ width: w, height: h, borderRadius: Math.round(w * 0.06), background: '#FFFFFF', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: '10%', top: 0, width: '18%', height: '70%', background: JADE, borderRadius: `0 0 ${bottomR}px ${bottomR}px`, zIndex: 1 }} />
      <div style={{ position: 'absolute', left: '34%', right: '6%', top: 0, bottom: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: w * 0.01 }}>
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: w * 0.50, lineHeight: 0.85, letterSpacing: '-0.05em', color: rankColor }}>{rank}</div>
        <div style={{ fontFamily: "'Noto Sans Symbols 2', Inter, system-ui, sans-serif", fontSize: w * 0.30, lineHeight: 1, color: suitColor, fontVariantEmoji: 'text' as any }}>{suit}&#xFE0E;</div>
      </div>
    </div>
  );
}

function MiniCardBack({ w }: { w: number }) {
  const h = w * (3.5 / 2.5);
  const bottomR = Math.max(4, Math.round(w * 0.03));
  const wordSize = Math.max(5, Math.round(w * 0.18 * 0.55));
  return (
    <div style={{ width: w, height: h, borderRadius: Math.round(w * 0.06), background: JADE, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: '10%', top: 0, width: '18%', height: '70%', background: TAN, borderRadius: `0 0 ${bottomR}px ${bottomR}px`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ transform: 'rotate(-90deg)', whiteSpace: 'nowrap' as const, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: wordSize, lineHeight: 1, letterSpacing: '0.18em', color: JADE, opacity: 0.65, userSelect: 'none' as const }}>STACKED!</div>
      </div>
    </div>
  );
}

// ─── Classic Hero Card (LOCKED V5 stagger) ──────────

function ClassicHeroCard({ onPlay }: { onPlay: () => void }) {
  const W = 88;
  const STEP = W * 0.5;
  const totalSpan = STEP + W * 1.08;
  const tallest = W * 1.08 * (3.5 / 2.5);

  return (
    <div onClick={onPlay} style={{
      flex: 1, background: 'linear-gradient(180deg, #0f2620 0%, #0a1f1a 100%)',
      borderRadius: 20, padding: 22, position: 'relative',
      border: '1px solid rgba(126,209,179,0.15)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden', cursor: 'pointer',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Suit watermark */}
      {/* Scattered suit watermarks */}
      <div style={{ position: 'absolute', right: -20, bottom: -30, fontSize: 200, color: 'rgba(126,209,179,0.04)', fontFamily: 'Inter', fontWeight: 900, lineHeight: 1, pointerEvents: 'none' }}>{'\u2665\uFE0E'}</div>
      <div style={{ position: 'absolute', left: -30, bottom: 10, fontSize: 140, color: 'rgba(126,209,179,0.03)', fontFamily: 'Inter', fontWeight: 900, lineHeight: 1, pointerEvents: 'none', transform: 'rotate(-15deg)' }}>{'\u2660\uFE0E'}</div>
      <div style={{ position: 'absolute', right: 30, top: -20, fontSize: 120, color: 'rgba(126,209,179,0.03)', fontFamily: 'Inter', fontWeight: 900, lineHeight: 1, pointerEvents: 'none', transform: 'rotate(10deg)' }}>{'\u2666\uFE0E'}</div>
      <div style={{ position: 'absolute', left: 40, top: -10, fontSize: 100, color: 'rgba(126,209,179,0.025)', fontFamily: 'Inter', fontWeight: 900, lineHeight: 1, pointerEvents: 'none', transform: 'rotate(-8deg)' }}>{'\u2663\uFE0E'}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', flex: 1 }}>
        <div style={{ flexShrink: 0, paddingRight: 8 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#7ed1b3', letterSpacing: '0.22em', fontWeight: 600 }}>QUICK MATCH · 5 MIN</div>
          <div style={{ fontWeight: 900, fontSize: 36, color: '#fff', marginTop: 6, letterSpacing: '-0.025em', lineHeight: 1 }}>Classic</div>
        </div>

        {/* V5 stagger: back + Q♥ */}
        <div style={{ position: 'relative', width: totalSpan, height: tallest + 16, marginRight: -totalSpan * 0.10 }}>
          <div className="breathe" style={{ '--tilt': '-2deg', position: 'absolute', left: 0, top: (tallest - W * (3.5/2.5)) / 2 + 8, zIndex: 1, filter: 'drop-shadow(0 0 18px rgba(20,184,154,0.35)) drop-shadow(0 8px 18px rgba(0,0,0,0.5))' } as React.CSSProperties}>
            <MiniCardBack w={W} />
          </div>
          <div className="breathe-2" style={{ '--tilt': '4deg', position: 'absolute', left: STEP, top: (tallest - W * 1.08 * (3.5/2.5)) / 2 + 8, zIndex: 2, filter: 'drop-shadow(0 0 18px rgba(20,184,154,0.35)) drop-shadow(0 8px 18px rgba(0,0,0,0.5))' } as React.CSSProperties}>
            <MiniCardFace w={W * 1.08} rank="Q" suit="♥" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', marginTop: 14 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 400, lineHeight: 1.4, maxWidth: '60%' }}>
          Capture · Combo · Win.<br/>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>Best of three rounds.</span>
        </div>
        <div style={{ fontWeight: 800, fontSize: 12, color: TAN, background: JADE, padding: '9px 16px', borderRadius: 99, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 12px rgba(6,95,70,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          PLAY <span style={{ fontSize: 14 }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ─── Adventure Hero Card ────────────────────────────

function AdventureHeroCard({ onPlay, returning }: { onPlay: () => void; returning: boolean }) {
  const nodes: [number, number][] = [
    [22,268],[78,250],[40,222],[110,208],[170,220],[130,178],
    [220,168],[200,130],[275,142],[245,100],[320,88],[355,48],
  ];
  const currentIdx = returning ? 2 : 0;
  const pathD = nodes.reduce((acc, [x, y], i) => i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`, '');

  return (
    <div onClick={onPlay} style={{
      flex: 1.1, background: 'linear-gradient(180deg, #1a1410 0%, #0d0805 100%)',
      borderRadius: 20, padding: 22, position: 'relative',
      border: '1px solid rgba(184,134,47,0.25)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden', cursor: 'pointer',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
    }}>
      {/* Chapter map peek */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.32, pointerEvents: 'none' }}>
        <svg viewBox="0 0 380 290" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          <path d={pathD} fill="none" stroke={BROWN} strokeWidth="1.5" strokeDasharray="4 6" strokeLinecap="round" className="draw-path" />
          {nodes.map(([x, y], i) => {
            const isCurrent = i === currentIdx;
            const isPast = i < currentIdx;
            return (
              <g key={i} className="node-fade" style={{ animationDelay: `${i * 0.08}s` }}>
                {isCurrent && <circle cx={x} cy={y} r="10" fill="none" stroke={TAN} strokeWidth="1.5" opacity="0.5" />}
                <circle cx={x} cy={y} r={isCurrent ? 5 : 4} fill={isPast ? BROWN : isCurrent ? TAN : 'transparent'} stroke={BROWN} strokeWidth="1.5" />
                {isCurrent && <text x={x} y={y + 2} textAnchor="middle" fontSize="6" fill="#1a1410" fontFamily="Inter" fontWeight="800">★</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: TAN, letterSpacing: '0.22em', fontWeight: 600 }}>
          {returning ? 'CAMPAIGN · CH. 1' : 'CAMPAIGN · NEW'}
        </div>
        <div style={{ fontWeight: 900, fontSize: 36, color: '#fff', marginTop: 6, letterSpacing: '-0.025em', lineHeight: 1 }}>Adventure</div>
      </div>

      {!returning && (
        <div style={{ fontSize: 11, color: TAN, fontWeight: 500, position: 'relative', marginTop: 10 }}>
          New here? Adventure starts with a tutorial.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', marginTop: returning ? 14 : 8 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 400, lineHeight: 1.4 }}>
          {returning ? (
            <><span style={{ color: TAN, fontWeight: 600 }}>Resume your run</span><br/><span style={{ color: 'rgba(255,255,255,0.5)' }}>{TOTAL_LEVELS} levels · 4 worlds</span></>
          ) : (
            <><span style={{ color: TAN, fontWeight: 600 }}>{TOTAL_LEVELS} levels</span><br/><span style={{ color: 'rgba(255,255,255,0.5)' }}>4 worlds to conquer</span></>
          )}
        </div>
        <div style={{ fontWeight: 800, fontSize: 12, color: BROWN, background: TAN, padding: '9px 16px', borderRadius: 99, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 12px rgba(232,197,119,0.25), inset 0 1px 0 rgba(255,255,255,0.18)' }}>
          {returning ? 'RESUME' : 'BEGIN'} <span style={{ fontSize: 14 }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ─── Game Wrapper ───────────────────────────────────

const BOT_NAMES: Record<Difficulty, string> = {
  beginner: 'Calvin',
  intermediate: 'Nina',
  advanced: 'Rex',
  expert: 'Jett',
};

function GameWrapper({
  seed,
  settings,
  currentLevelId,
  onQuit,
  onHome,
  onPlayAgain,
  onNextLevel,
}: {
  seed: number;
  settings: GameSettings;
  currentLevelId: number | null;
  onQuit: () => void;
  onHome: () => void;
  onPlayAgain: () => void;
  onNextLevel: () => void;
}) {
  const { state, isPlayerTurn, botViz, botCombo, lastCapture, jackpotInfo, gameOver, actions } =
    useGameController(seed, settings);

  const levelComplete = useMemo(() => {
    if (!currentLevelId || !gameOver) return null;
    const playerScore = state.overallScores.player;
    const bot1Score = state.overallScores.bot1;
    const bot2Score = state.overallScores.bot2;
    const opponentMax = Math.max(bot1Score, bot2Score);
    const stars = calculateStars(playerScore, bot1Score, bot2Score, true);
    const won = stars === 3;
    const margin = playerScore - opponentMax;
    const scores = [
      { name: 'You', score: playerScore, isPlayer: true },
      { name: BOT_NAMES[state.settings.bot1Personality], score: bot1Score, isPlayer: false },
      { name: BOT_NAMES[state.settings.bot2Personality], score: bot2Score, isPlayer: false },
    ].sort((a, b) => b.score - a.score);
    return { won, stars, margin, scores, isFinalLevel: isFinalLevel(currentLevelId) };
  }, [currentLevelId, gameOver, state.overallScores, state.settings.bot1Personality, state.settings.bot2Personality]);

  useEffect(() => {
    if (!currentLevelId || !gameOver || !levelComplete) return;
    if (levelComplete.stars <= 0) return;
    const progress = loadProgress();
    const updated = recordLevelCompletion(progress, currentLevelId, levelComplete.stars);
    saveProgress(updated);
    if (isFinalLevel(currentLevelId)) {
      unlockJettInClassic();
    }
  }, [currentLevelId, gameOver, levelComplete]);

  return (
    <>
      <GameView
        state={state}
        isPlayerTurn={isPlayerTurn}
        botViz={botViz}
        botCombo={botCombo}
        lastCapture={lastCapture}
        currentLevelId={currentLevelId}
        jackpotInfo={jackpotInfo}
        gameOver={currentLevelId ? null : gameOver}
        actions={actions}
        onQuit={onQuit}
        onHome={onHome}
        onPlayAgain={onPlayAgain}
      />
      {levelComplete && (
        <LevelCompleteOverlay
          visible
          won={levelComplete.won}
          levelId={currentLevelId!}
          starsEarned={levelComplete.stars}
          margin={levelComplete.margin}
          scores={levelComplete.scores}
          isFinalLevel={levelComplete.isFinalLevel}
          onPlayAgain={onPlayAgain}
          onNextLevel={levelComplete.stars >= 2 && currentLevelId! < TOTAL_LEVELS && (() => {
            const nextWorld = getLevelWorld(currentLevelId! + 1);
            const currentWorld = getLevelWorld(currentLevelId!);
            if (nextWorld !== currentWorld) {
              const progress = loadProgress();
              return isWorldUnlocked(progress, nextWorld);
            }
            return true;
          })() ? onNextLevel : undefined}
          onWorldMap={onHome}
        />
      )}
    </>
  );
}

export default App;
