import { useCallback, useState } from 'react';
import { GameView } from './components/GameView';
import { useGameController } from './game/useGameController';
import type { GameSettings } from './engine/types';

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

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        background: '#1E1E2E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <h1
        style={{
          fontWeight: 700,
          fontSize: 42,
          color: '#F1F1F3',
          letterSpacing: -1,
        }}
      >
        STACKED<span style={{ color: '#4F46E5' }}>!</span>
      </h1>
      <p style={{ fontSize: 16, color: '#8B8BA3' }}>Strategic Card Combat</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        <RuleRow icon="🃏" text="Capture cards by matching pairs or sums" />
        <RuleRow icon="🎯" text="Build combos in the 4 capture slots" />
        <RuleRow icon="👆" text="Drag cards from your hand to slots" />
        <RuleRow icon="🏆" text="First to 300 points wins" />
      </div>

      <button
        onClick={startGame}
        style={{
          marginTop: 16,
          width: 220,
          height: 52,
          background: '#4F46E5',
          color: '#FFF',
          fontWeight: 600,
          fontSize: 18,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
        }}
      >
        START GAME
      </button>

      <p style={{ fontSize: 12, color: '#5A5A70', marginTop: 8 }}>
        Built by TC with AI collaboration
      </p>
    </div>
  );
}

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
  const { state, isPlayerTurn, botViz, gameOver, actions } =
    useGameController(seed, settings);

  return (
    <GameView
      state={state}
      isPlayerTurn={isPlayerTurn}
      botViz={botViz}
      gameOver={gameOver}
      actions={actions}
      onHome={onHome}
      onPlayAgain={onPlayAgain}
    />
  );
}

function RuleRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 14, color: '#8B8BA3' }}>{text}</span>
    </div>
  );
}

export default App;
