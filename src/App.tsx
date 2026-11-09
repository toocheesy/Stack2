import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GameView, type PauseSheet } from './components/GameView';
import { ClassicSetup } from './components/ClassicSetup';
import { ChapterMap } from './components/ChapterMap';
import { HomeScreen } from './components/HomeScreen';
import { CurtainDeal } from './components/CurtainDeal';
import { NewGameSheet } from './components/NewGameSheet';
import { HomeSettingsSheet } from './components/HomeSettingsSheet';
import { RulesScreen } from './components/RulesScreen';
import { useGameController } from './game/useGameController';
import type { Difficulty, GameSettings } from './engine/types';
import { loadGame, clearSavedGame, saveModeFor } from './game/persistence';
import { getLevel, TOTAL_LEVELS } from './engine/adventure/levelConfig';
import { calculateStars, recordLevelCompletion, loadProgress, saveProgress, getLevelWorld, isWorldUnlocked, unlockJettInClassic, isFinalLevel } from './engine/adventure/progressManager';
import { LevelCompleteOverlay } from './components/LevelCompleteOverlay';
import { CardAtomTest } from './components/CardAtomTest';
import { useTutorial } from './tutorial/useTutorial';
import { loadTutorialSeen } from './tutorial/tutorialStorage';
import { trackGameStart, trackTutorialComplete, trackGameEnd, trackRunComplete } from './analytics/track';
import { C } from './config/colors';

type Screen = 'home' | 'setup' | 'worldMap' | 'game' | 'cardtest' | 'rules';

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
  const [currentLevelId, setCurrentLevelId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // QD1 phone B: QUICK MATCH with a saved game asks first.
  const [newGameAsk, setNewGameAsk] = useState(false);
  // DD2 is playing: the home leaves over the screen it opened, which waits
  // underneath. `hadSave` keeps the leaving home as it was at the tap.
  const [curtain, setCurtain] = useState<{ hadSave: boolean } | null>(null);

  // The tutorial's replay token. The home's "Replay tutorial" went with the
  // old SettingsScreen (D-007 release 3, ruling 104), so nothing bumps it now;
  // GameWrapper still reads it. S-032 removes it.
  const [tutorialReplayToken] = useState(0);

  // Per-mode saved games (S-006): one slot each, read once per render. Classic
  // CONTINUE reads the Classic slot; the Run map's Resume reads the Run slot.
  const savedClassic = loadGame('classic', seed);
  const savedRun = loadGame('run', seed);
  const savedIsClassic = savedClassic !== null;
  const savedRunLevelId: number | null = savedRun?.currentLevelId ?? null;

  useEffect(() => {
    // Drop the orphan useSettings hook's dead localStorage key on any returning user.
    try { localStorage.removeItem('stacked.settings.v1'); } catch { /* ignore */ }
    // Sound is gone (S-023): clear returning players' stored sound setting.
    try { localStorage.removeItem('stacked.audio.v1'); } catch { /* ignore */ }
  }, []);

  // SET THE TABLE: DD2 plays over Classic Setup (ruling 46).
  const setTheTable = useCallback(() => {
    setCurtain({ hadSave: savedIsClassic });
    setScreen('setup');
  }, [savedIsClassic]);

  const startWithSettings = useCallback((targetScore: number, bot1: Difficulty, bot2: Difficulty) => {
    clearSavedGame('classic');
    setCurrentLevelId(null);
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
    setCurtain({ hadSave: savedIsClassic });
    startWithSettings(QUICK_MATCH_TARGET, bot1, bot2);
  }, [savedIsClassic, startWithSettings]);

  // With a saved game QUICK MATCH asks first (QD1 phone B); without one it starts at once.
  const askQuickMatch = useCallback(() => {
    if (savedIsClassic) setNewGameAsk(true);
    else quickMatch();
  }, [savedIsClassic, quickMatch]);

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

  // Per-mode resume — Classic Continue affordance on the Classic card.
  // useGameController loads the snapshot on mount and uses it as initial state;
  // setting currentLevelId here ensures GameWrapper renders the right frame.
  // The saved game's opponents and target become App's settings, so PLAY
  // AGAIN deals what was being played (D-007 rulings 72 and 102).
  const continueClassic = useCallback(() => {
    const saved = loadGame('classic', seed);
    if (saved) setSettings(saved.game.settings);
    setCurrentLevelId(null);
    setScreen('game');
  }, [seed]);

  // Per-mode resume — ChapterMap "Resume Level N" callout dispatches here.
  const continueRunFromMap = useCallback((levelId: number) => {
    setCurrentLevelId(levelId);
    setSettings(settingsForLevel(levelId));
    setScreen('game');
  }, [settingsForLevel]);

  // Quitting keeps the save (S-006): CONTINUE on the Classic card picks it up.
  // Every way back home is instant (ruling 107); a curtain still playing goes with it.
  const goHome = useCallback(() => {
    setCurtain(null);
    setCurrentLevelId(null);
    setScreen('home');
  }, []);

  // Quitting keeps the save (S-006): the Run map's Resume picks it up.
  const goToWorldMap = useCallback(() => {
    setScreen('worldMap');
  }, []);

  const playAgain = useCallback(() => {
    clearSavedGame(saveModeFor(currentLevelId));
    setSeed(Math.floor(Math.random() * 1_000_000));
  }, [currentLevelId]);

  const nextLevel = useCallback(() => {
    if (!currentLevelId) return;
    const nextId = currentLevelId + 1;
    if (!getLevel(nextId)) return;
    setCurrentLevelId(nextId);
    clearSavedGame('run');
    setSeed(Math.floor(Math.random() * 1_000_000));
    setSettings(settingsForLevel(nextId));
  }, [currentLevelId, settingsForLevel]);

  let view: ReactNode;
  if (screen === 'cardtest') {
    view = <CardAtomTest />;
  } else if (screen === 'worldMap') {
    view = (
      <ChapterMap
        onBack={() => setScreen('home')}
        onSelectLevel={(id) => {
          if (!getLevel(id)) return;
          setCurrentLevelId(id);
          clearSavedGame('run');
          setSeed(Math.floor(Math.random() * 1_000_000));
          setSettings(settingsForLevel(id));
          setScreen('game');
        }}
        savedRunLevelId={savedRunLevelId}
        onResumeRun={continueRunFromMap}
      />
    );
  } else if (screen === 'rules') {
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
        currentLevelId={currentLevelId}
        onQuit={currentLevelId ? goToWorldMap : goHome}
        onHome={currentLevelId ? goToWorldMap : goHome}
        onPlayAgain={playAgain}
        onNextLevel={nextLevel}
        tutorialReplayToken={tutorialReplayToken}
        held={curtain !== null}
      />
    );
  } else {
    view = (
      <HomeScreen
        hasSave={savedIsClassic}
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

// ─── Animation keyframes (injected once) ────────────
// The old home's keyframes. The home no longer uses them (HS15, D-007 release
// 3), but ChapterMap (The Run, frozen) still names `breathe`; S-032 removes
// the block with The Run.

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
  tutorialReplayToken,
  held,
}: {
  seed: number;
  settings: GameSettings;
  currentLevelId: number | null;
  onQuit: () => void;
  onHome: () => void;
  onPlayAgain: () => void;
  onNextLevel: () => void;
  tutorialReplayToken: number;
  /** DD2 is still playing over the board (ruling 106): the game waits under the curtain. */
  held: boolean;
}) {
  // Tutorial state lives here (not in GameView) so useGameController can see
  // the pause from its first render — required for the freeze ticket so
  // the bot-turn mount effect knows to gate. Initial visible is computed
  // synchronously from loadTutorialSeen() to avoid an effect round-trip race.
  // TU2 has nine steps; The Run's level 1 still opens it by itself.
  const tutorialShouldAutoOpen = currentLevelId === 1 && !loadTutorialSeen();
  const tutorial = useTutorial(9, tutorialShouldAutoOpen);

  // The other two pauses (D-007 release 2 part 3): the leave sheet and the
  // in-game Settings. Any of the three pauses the controller, and so does a
  // Quick Match's curtain (release 3, ruling 106).
  const [pause, setPause] = useState<PauseSheet>(null);

  // Replay-from-Settings: App bumps the token; reopen the overlay.
  // Token starts at 0 (no-op on initial mount). Lives here so the auto-fire
  // and replay paths sit beside each other.
  useEffect(() => {
    if (tutorialReplayToken > 0) tutorial.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialReplayToken]);

  const { state, isPlayerTurn, botViz, botCombo, lastCapture, jackpotInfo, gameOver, wasResumed, seed: gameSeed, actions } =
    useGameController(seed, settings, currentLevelId, tutorial.visible || pause !== null || held);

  // Analytics — game_start fires once per GameWrapper mount. seed change
  // remounts via key={seed} so a new game gets a new event. wasResumed
  // comes from useGameController's loadGame() result, single source of truth.
  const analyticsGameStartedAtRef = useRef(Date.now());
  useEffect(() => {
    trackGameStart({
      mode: currentLevelId === null ? 'classic' : 'run',
      level_id: currentLevelId ?? undefined,
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

  // Analytics — game_end fires once when gameOver flips truthy. Declared
  // AFTER the recordLevelCompletion effect so run_complete reads the freshly-
  // saved totalStars. Single ref guards against double-fire on React re-runs.
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (!gameOver || gameEndFiredRef.current) return;
    gameEndFiredRef.current = true;
    const playerScore = state.overallScores.player;
    const mode = currentLevelId === null ? 'classic' : 'run';
    trackGameEnd({
      mode,
      won: levelComplete ? levelComplete.won : gameOver.winner === 0,
      score: playerScore,
      duration_ms: Date.now() - analyticsGameStartedAtRef.current,
      level_id: currentLevelId ?? undefined,
      stars: levelComplete?.stars,
      margin: levelComplete?.margin,
      seed: gameSeed,
    });
    if (levelComplete?.won && levelComplete.isFinalLevel) {
      trackRunComplete({ total_stars: loadProgress().totalStars });
    }
  }, [gameOver, levelComplete, state.overallScores, currentLevelId, gameSeed]);

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
        pause={pause}
        onPause={setPause}
        tutorial={tutorial}
        suppressToasts={!!levelComplete}
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
