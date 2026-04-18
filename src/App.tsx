import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameView } from './components/GameView';
import { useGameController } from './game/useGameController';
import type { GameSettings } from './engine/types';
import { C, SHADOWS } from './config/colors';
import { getTransition, tween } from './config/motion';

type Screen = 'home' | 'game';

const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [settings] = useState(DEFAULT_SETTINGS);

  const startGame = useCallback(() => {
    setSeed(Math.floor(Math.random() * 1_000_000));
    setScreen('game');
  }, []);

  if (screen === 'game') {
    return (
      <GameWrapper
        seed={seed}
        settings={settings}
        onHome={() => setScreen('home')}
        onPlayAgain={() => setSeed(Math.floor(Math.random() * 1_000_000))}
      />
    );
  }

  return <TitleScreen onStart={startGame} />;
}

// ─── Title Screen ───────────────────────────────────

function TitleScreen({ onStart }: { onStart: () => void }) {
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
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
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
          marginTop: -4,
        }}
      >
        CAPTURE · COMBO · WIN
      </p>

      {/* How to Play link */}
      <button
        onClick={() => setShowRules(true)}
        style={{
          marginTop: 8,
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          color: C.textSecondary,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'none',
          padding: '4px 8px',
        }}
      >
        How to Play
      </button>

      {/* Start button */}
      <motion.button
        onClick={onStart}
        whileTap={{ scale: 0.97 }}
        transition={getTransition('snappy')}
        style={{
          marginTop: 8,
          width: 220,
          height: 52,
          background: C.indigo,
          color: '#FFF',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: 18,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
        }}
      >
        START GAME
      </motion.button>

      {/* Footer */}
      <p
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          color: C.disabledText,
          marginTop: 16,
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

// ─── Card Peek (Queen of Hearts) ────────────────────

function PeekCard() {
  const w = 120;
  const h = Math.round(w * (3.5 / 2.5));
  const stripeW = Math.round(w * 0.22);
  const stripeH = Math.round(h * 0.75);
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
      {/* 75% indigo stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: stripeW,
          height: stripeH,
          background: `linear-gradient(to bottom, ${C.indigo}, ${C.indigoHover})`,
          borderRadius: '12px 0 0 0',
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

function GameWrapper({
  seed,
  settings,
  onHome,
  onPlayAgain,
}: {
  seed: number;
  settings: GameSettings;
  onHome: () => void;
  onPlayAgain: () => void;
}) {
  const { state, isPlayerTurn, botViz, botCombo, lastCapture, gameOver, actions } =
    useGameController(seed, settings);

  return (
    <GameView
      state={state}
      isPlayerTurn={isPlayerTurn}
      botViz={botViz}
      botCombo={botCombo}
      lastCapture={lastCapture}
      gameOver={gameOver}
      actions={actions}
      onHome={onHome}
      onPlayAgain={onPlayAgain}
    />
  );
}

export default App;
