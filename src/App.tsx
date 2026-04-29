import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameView } from './components/GameView';
import { ClassicSetup } from './components/ClassicSetup';
import { WorldMap } from './components/WorldMap';
import { useGameController } from './game/useGameController';
import type { Difficulty, GameSettings } from './engine/types';
import { C, SHADOWS } from './config/colors';
import { getTransition, tween } from './config/motion';
import { loadGame, clearSavedGame } from './game/persistence';
import { getLevel } from './engine/adventure/levelConfig';
import { calculateStars, recordLevelCompletion, loadProgress, saveProgress, getLevelWorld, isWorldUnlocked } from './engine/adventure/progressManager';
import { LevelCompleteOverlay } from './components/LevelCompleteOverlay';

type Screen = 'home' | 'setup' | 'worldMap' | 'game';

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
    const next = getLevel(nextId);
    if (!next) return;
    setCurrentLevelId(nextId);
    clearSavedGame();
    setSeed(Math.floor(Math.random() * 1_000_000));
    setSettings({ targetScore: next.targetScore, bot1Personality: next.bots[0], bot2Personality: next.bots[1] });
  }, [currentLevelId]);

  if (screen === 'worldMap') {
    return (
      <WorldMap
        onBack={() => setScreen('home')}
        onSelectLevel={(id) => {
          const level = getLevel(id);
          if (!level) return;
          setCurrentLevelId(id);
          clearSavedGame();
          setSeed(Math.floor(Math.random() * 1_000_000));
          setSettings({ targetScore: level.targetScore, bot1Personality: level.bots[0], bot2Personality: level.bots[1] });
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

// ─── Title Screen ───────────────────────────────────

function TitleScreen({ onNewGame, onAdventure, onContinue }: { onNewGame: () => void; onAdventure: () => void; onContinue?: () => void }) {
  const [showRules, setShowRules] = useState(false);

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: C.slateBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
        padding: '24px 16px',
      }}
    >
      {/* Wordmark */}
      <h1
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: 48,
          color: C.textPrimary,
          letterSpacing: -1,
          lineHeight: 1,
          margin: 0,
        }}
      >
        STACKED<span style={{ color: C.indigo }}>!</span>
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 14,
          color: C.textSecondary,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginTop: -8,
          marginBottom: 4,
        }}
      >
        CAPTURE · COMBO · WIN
      </p>

      {/* Mode grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        width: '100%',
        maxWidth: 320,
      }}>
        <ModeCard
          name="Classic"
          tagline="Race to target score, 1v2 AI"
          active
          onClick={onNewGame}
        />
        <ModeCard
          name="Adventure"
          tagline="18 levels, 6 worlds"
          active={true}
          onClick={onAdventure}
        />
        <ModeCard
          name="Speed"
          tagline="Faster pace, same combat"
          active={false}
        />
        <ModeCard
          name="Tournament"
          tagline="Bracket play to crown a champion"
          active={false}
        />
      </div>

      {/* Continue saved game */}
      {onContinue && (
        <motion.button
          onClick={onContinue}
          whileTap={{ scale: 0.97 }}
          transition={getTransition('snappy')}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13, fontWeight: 500,
            color: C.indigo,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Continue saved game
        </motion.button>
      )}

      {/* How to Play */}
      <button
        onClick={() => setShowRules(true)}
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          color: C.textSecondary,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
        }}
      >
        How to Play
      </button>

      {/* Footer */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          color: C.disabledText,
          marginTop: 4,
        }}
      >
        Built by TC with AI collaboration
      </p>

      {/* Card peek — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          right: -16,
          transform: 'rotate(10deg)',
          pointerEvents: 'none',
        }}
      >
        <PeekCard />
      </div>

      {/* Rules modal */}
      <AnimatePresence>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Mode Card ─────────────────────────────────────

function ModeCard({ name, tagline, active, onClick }: {
  name: string; tagline: string; active: boolean; onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={active ? onClick : undefined}
      whileTap={active ? { scale: 0.97 } : undefined}
      transition={getTransition('snappy')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '14px 14px 16px',
        borderRadius: 10,
        border: active ? `1px solid ${C.indigo}` : `1px solid ${C.divider}`,
        background: active ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.02)',
        cursor: active ? 'pointer' : 'default',
        opacity: active ? 1 : 0.5,
        width: '100%',
        textAlign: 'left' as const,
        position: 'relative' as const,
        overflow: 'hidden',
      }}
    >
      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize: 15,
        color: active ? C.textPrimary : C.disabledText,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {name}
      </span>
      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        color: active ? C.textSecondary : C.disabledText,
        lineHeight: 1.3,
      }}>
        {tagline}
      </span>
      {!active && (
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 600,
          color: C.disabledText,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 2,
        }}>
          COMING SOON
        </span>
      )}
    </motion.button>
  );
}

// ─── Card Peek (Queen of Hearts) ────────────────────

function PeekCard() {
  const w = 120;
  const h = Math.round(w * (3.5 / 2.5));
  const sw = Math.round(w * 0.22);
  const sh = Math.round(h * 0.50);
  const sl = Math.round(w * 0.07);
  const st = 0;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 12,
        background: C.card,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: SHADOWS.cardPeek,
      }}
    >
      {/* Stripe panel */}
      <div
        style={{
          position: 'absolute',
          left: sl,
          top: st,
          width: sw,
          height: sh,
          background: C.indigo,
          borderRadius: '0 0 6px 6px',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 48,
            lineHeight: 1,
            color: C.suitRed,
          }}
        >
          Q
        </span>
        <span style={{ fontSize: 28, lineHeight: 1, color: '#DC2626' }}>♥</span>
      </div>
    </div>
  );
}

// ─── Rules Modal ────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={tween.default}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30, 30, 46, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={tween.micro}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.board,
          borderRadius: 12,
          maxWidth: 360,
          width: '100%',
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left stripe — carries the motif */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: C.indigo,
            borderRadius: '12px 0 0 12px',
          }}
        />

        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 18,
            color: C.textPrimary,
            marginBottom: 16,
          }}
        >
          How to Play
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {[
            'Drag cards into combo slots to build captures',
            'Match the BASE card with pairs or sums',
            'Capture = go again. Place = turn ends.',
            'First to reach the target score wins!',
          ].map((rule, i) => (
            <p
              key={i}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                color: C.ruleText,
                lineHeight: 1.5,
              }}
            >
              {rule}
            </p>
          ))}
        </div>

        <motion.button
          onClick={onClose}
          whileTap={{ scale: 0.97 }}
          transition={getTransition('snappy')}
          style={{
            marginTop: 20,
            width: '100%',
            height: 44,
            background: C.indigo,
            color: '#FFF',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 15,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          GOT IT
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Game Wrapper ───────────────────────────────────

const BOT_NAMES: Record<Difficulty, string> = {
  beginner: 'Calvin',
  intermediate: 'Nina',
  advanced: 'Rex',
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

  // Adventure level-complete logic
  const levelComplete = currentLevelId && gameOver ? (() => {
    const playerScore = state.overallScores.player;
    const bot1Score = state.overallScores.bot1;
    const bot2Score = state.overallScores.bot2;
    const opponentMax = Math.max(bot1Score, bot2Score);
    const stars = calculateStars(playerScore, bot1Score, bot2Score, true);
    const won = stars === 3;
    const margin = playerScore - opponentMax;

    // Save progress (1+ stars = game completed)
    if (stars > 0) {
      const progress = loadProgress();
      const updated = recordLevelCompletion(progress, currentLevelId, stars);
      saveProgress(updated);
    }

    const scores = [
      { name: 'You', score: playerScore, isPlayer: true },
      { name: BOT_NAMES[state.settings.bot1Personality], score: bot1Score, isPlayer: false },
      { name: BOT_NAMES[state.settings.bot2Personality], score: bot2Score, isPlayer: false },
    ].sort((a, b) => b.score - a.score);

    return { won, stars, margin, scores, isLevel18: currentLevelId === 18 };
  })() : null;

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
          isLevel18={levelComplete.isLevel18}
          onPlayAgain={onPlayAgain}
          onNextLevel={levelComplete.stars >= 2 && currentLevelId! < 18 && (() => {
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
