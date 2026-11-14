import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GameView, type PauseSheet } from './components/GameView';
import { ClassicSetup } from './components/ClassicSetup';
import { HomeScreen } from './components/HomeScreen';
import { CurtainDeal } from './components/CurtainDeal';
import { NewGameSheet } from './components/NewGameSheet';
import { HomeSettingsSheet } from './components/HomeSettingsSheet';
import { RulesScreen } from './components/RulesScreen';
import { useGameController } from './game/useGameController';
import type { Difficulty, GameSettings } from './engine/types';
import { loadGame, clearSavedGame } from './game/persistence';
import { useTutorial } from './tutorial/useTutorial';
import { trackGameStart, trackTutorialComplete, trackGameEnd } from './analytics/track';
import { C } from './config/colors';

type Screen = 'home' | 'setup' | 'game' | 'rules';

const DEFAULT_SETTINGS: GameSettings = {
  targetScore: 300,
  bot1Personality: 'beginner',
  bot2Personality: 'intermediate',
};

// Quick Match (D-007 ruling 106, S-033): a Classic game to 300 against two of
// the four opponents (Calvin, Nina, Rex, Jett), any pair, six possible tables.
const QUICK_MATCH_TARGET = 300;
const QUICK_MATCH_PAIRS: [Difficulty, Difficulty][] = [
  ['beginner', 'intermediate'], ['beginner', 'advanced'], ['beginner', 'expert'],
  ['intermediate', 'advanced'], ['intermediate', 'expert'], ['advanced', 'expert'],
];

const noop = () => {};

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // QD1 phone B: QUICK MATCH with a saved game asks first.
  const [newGameAsk, setNewGameAsk] = useState(false);
  // DD2 is playing: the home leaves over the screen it opened, which waits
  // underneath. `hadSave` keeps the leaving home as it was at the tap.
  const [curtain, setCurtain] = useState<{ hadSave: boolean } | null>(null);

  // The saved game (S-006), read once per render: CONTINUE reads the Classic slot.
  const savedClassic = loadGame('classic');
  const hasSave = savedClassic !== null;

  useEffect(() => {
    // Drop the orphan useSettings hook's dead localStorage key on any returning user.
    try { localStorage.removeItem('stacked.settings.v1'); } catch { /* ignore */ }
    // Sound is gone (S-023): clear returning players' stored sound setting.
    try { localStorage.removeItem('stacked.audio.v1'); } catch { /* ignore */ }
    // The old level mode is gone (S-032): clear returning players' save, progress and unlock.
    try { localStorage.removeItem('stacked-save-run'); } catch { /* ignore */ }
    try { localStorage.removeItem('stacked_v2_adventure_progress'); } catch { /* ignore */ }
    try { localStorage.removeItem('stacked_v2_jett_unlocked_classic'); } catch { /* ignore */ }
    // Saves before version 7 are gone (S-032): clear returning players' old single-slot save.
    try { localStorage.removeItem('stacked-v2-game'); } catch { /* ignore */ }
    // A key no code in this repo writes or reads (S-032).
    try { localStorage.removeItem('stacked_welcomed'); } catch { /* ignore */ }
  }, []);

  // SET THE TABLE: DD2 plays over Classic Setup (ruling 46).
  const setTheTable = useCallback(() => {
    setCurtain({ hadSave: hasSave });
    setScreen('setup');
  }, [hasSave]);

  const startWithSettings = useCallback((targetScore: number, bot1: Difficulty, bot2: Difficulty) => {
    clearSavedGame('classic');
    setSeed(Math.floor(Math.random() * 1_000_000));
    setSettings({ targetScore, bot1Personality: bot1, bot2Personality: bot2 });
    setScreen('game');
  }, []);

  // QUICK MATCH (ruling 106, S-033): the pair is picked with the seed's random
  // source; the engine seats the two by its coin flip (RULES.md Classic rule
  // 5). The game is dealt now and held paused under DD2 until the board has
  // faded in, so an opponent seated first moves in view.
  const quickMatch = useCallback(() => {
    const [bot1, bot2] = QUICK_MATCH_PAIRS[Math.floor(Math.random() * QUICK_MATCH_PAIRS.length)];
    setCurtain({ hadSave: hasSave });
    startWithSettings(QUICK_MATCH_TARGET, bot1, bot2);
  }, [hasSave, startWithSettings]);

  // With a saved game QUICK MATCH asks first (QD1 phone B); without one it starts at once.
  const askQuickMatch = useCallback(() => {
    if (hasSave) setNewGameAsk(true);
    else quickMatch();
  }, [hasSave, quickMatch]);

  const endCurtain = useCallback(() => setCurtain(null), []);

  // The rules page (RP1, rulings 107 and 111): "How to play" opens it with one
  // history entry, so the phone's back gesture closes it; the back button goes
  // back through that same entry. Both ways home are instant.
  const openRules = useCallback(() => {
    window.history.pushState({ stackedRules: true }, '');
    setScreen('rules');
  }, []);
  const closeRules = useCallback(() => {
    setScreen('home');
    if ((window.history.state as { stackedRules?: boolean } | null)?.stackedRules) window.history.back();
  }, []);
  useEffect(() => {
    const onPopState = () => setScreen((s) => (s === 'rules' ? 'home' : s));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // CONTINUE on the Classic card. useGameController loads the snapshot on
  // mount and uses it as initial state. The saved game's opponents and target
  // become App's settings, so PLAY AGAIN deals what was being played (D-007
  // rulings 72 and 102).
  const continueClassic = useCallback(() => {
    const saved = loadGame('classic');
    if (saved) setSettings(saved.game.settings);
    setScreen('game');
  }, []);

  // Quitting keeps the save (S-006): CONTINUE on the Classic card picks it up.
  // Every way back home is instant (ruling 107); a curtain still playing goes with it.
  const goHome = useCallback(() => {
    setCurtain(null);
    setScreen('home');
  }, []);

  const playAgain = useCallback(() => {
    clearSavedGame('classic');
    setSeed(Math.floor(Math.random() * 1_000_000));
  }, []);

  let view: ReactNode;
  if (screen === 'rules') {
    view = <RulesScreen onBack={closeRules} />;
  } else if (screen === 'setup') {
    view = (
      <ClassicSetup
        onStart={startWithSettings}
        onBack={goHome}
      />
    );
  } else if (screen === 'game') {
    view = (
      <GameWrapper
        key={seed}
        seed={seed}
        settings={settings}
        onHome={goHome}
        onPlayAgain={playAgain}
        held={curtain !== null}
      />
    );
  } else {
    view = (
      <HomeScreen
        hasSave={hasSave}
        leaving={false}
        onContinue={continueClassic}
        onQuickMatch={askQuickMatch}
        onSetTheTable={setTheTable}
        onOpenSettings={() => setSettingsOpen(true)}
        onHowToPlay={openRules}
      />
    );
  }

  return (
    <>
      {view}
      {/* DD2: the home as it was at the tap leaves over the screen it opened. The curtain takes every tap. */}
      {curtain && (
        <CurtainDeal onDone={endCurtain}>
          <HomeScreen hasSave={curtain.hadSave} leaving onContinue={noop} onQuickMatch={noop} onSetTheTable={noop} onOpenSettings={noop} onHowToPlay={noop} />
        </CurtainDeal>
      )}
      <NewGameSheet open={newGameAsk} onKeepPlaying={() => setNewGameAsk(false)} onNewGame={() => { setNewGameAsk(false); quickMatch(); }} />
      <HomeSettingsSheet open={settingsOpen} onDone={() => setSettingsOpen(false)} />
    </>
  );
}

// ─── The page base ──────────────────────────────────
// index.css paints html and body from these two variables, so every colour
// stays in src/config/colors.ts (D-007). The page around the game wears the
// brand theme.

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--page-ground', C.ground.brand);
  document.documentElement.style.setProperty('--page-ink', C.ink.brand);
}

// ─── Game Wrapper ───────────────────────────────────

function GameWrapper({
  seed,
  settings,
  onHome,
  onPlayAgain,
  held,
}: {
  seed: number;
  settings: GameSettings;
  onHome: () => void;
  onPlayAgain: () => void;
  /** DD2 is still playing over the board (ruling 106): the game waits under the curtain. */
  held: boolean;
}) {
  // Tutorial state lives here (not in GameView) so useGameController can see
  // the pause from its first render — required for the freeze ticket so
  // the bot-turn mount effect knows to gate. TU2 has nine steps; it opens
  // only from Settings › Tutorial.
  const tutorial = useTutorial(9);

  // The other two pauses (D-007 release 2 part 3): the leave sheet and the
  // in-game Settings. Any of the three pauses the controller, and so does a
  // Quick Match's curtain (release 3, ruling 106).
  const [pause, setPause] = useState<PauseSheet>(null);

  const { state, isPlayerTurn, botViz, botCombo, lastCapture, jackpotInfo, gameOver, wasResumed, seed: gameSeed, actions } =
    useGameController(seed, settings, tutorial.visible || pause !== null || held);

  // Analytics — game_start fires once per GameWrapper mount. seed change
  // remounts via key={seed} so a new game gets a new event. wasResumed
  // comes from useGameController's loadGame() result, single source of truth.
  const analyticsGameStartedAtRef = useRef(Date.now());
  useEffect(() => {
    trackGameStart({
      mode: 'classic',
      resumed: wasResumed,
      seed: gameSeed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Analytics — tutorial duration. Reset timer on each open (replay support).
  // lastTutorialStepRef tracks the highest step reached because close()
  // resets currentStep to 0 in the same commit as visible=false, so we
  // can't read it from tutorial.currentStep after close fires.
  const tutorialOpenedAtRef = useRef<number | null>(null);
  const lastTutorialStepRef = useRef(0);
  useEffect(() => {
    if (tutorial.visible) lastTutorialStepRef.current = tutorial.currentStep;
  }, [tutorial.currentStep, tutorial.visible]);
  useEffect(() => {
    if (tutorial.visible) {
      tutorialOpenedAtRef.current = Date.now();
      return;
    }
    // visible flipped to false. Only fire if it was previously open.
    if (tutorialOpenedAtRef.current === null) return;
    const stepReached = lastTutorialStepRef.current + 1; // 1-based for analytics
    trackTutorialComplete({
      step_reached: stepReached,
      method: stepReached >= tutorial.totalSteps ? 'complete' : 'dismiss',
      duration_ms: Date.now() - tutorialOpenedAtRef.current,
    });
    tutorialOpenedAtRef.current = null;
  }, [tutorial.visible, tutorial.totalSteps]);

  // Analytics — game_end fires once when gameOver flips truthy. Single ref
  // guards against double-fire on React re-runs.
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (!gameOver || gameEndFiredRef.current) return;
    gameEndFiredRef.current = true;
    const playerScore = state.overallScores.player;
    trackGameEnd({
      mode: 'classic',
      won: gameOver.winner === 0,
      score: playerScore,
      duration_ms: Date.now() - analyticsGameStartedAtRef.current,
      seed: gameSeed,
    });
  }, [gameOver, state.overallScores, gameSeed]);

  return (
    <GameView
      state={state}
      isPlayerTurn={isPlayerTurn}
      botViz={botViz}
      botCombo={botCombo}
      lastCapture={lastCapture}
      jackpotInfo={jackpotInfo}
      gameOver={gameOver}
      actions={actions}
      onHome={onHome}
      onPlayAgain={onPlayAgain}
      pause={pause}
      onPause={setPause}
      tutorial={tutorial}
    />
  );
}

export default App;
