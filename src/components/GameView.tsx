import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Card, ComboSlot, GameState, PlayerIndex } from '../engine/types';
import { getTransition } from '../config/motion';
import {
  baseSourceOf,
  comboIsValid,
  messageLine,
  opponentName,
  playerName,
  stagedPoints,
  tableCardsThatCannotJoin,
  takeTheTable,
  type BotComboDisplay,
  type BotVizStep,
  type GameActions,
  type LastMove,
} from '../game/useGameController';
import { validateFullCombo } from '../engine/core/captureValidator';
import { RoundEndOverlay } from './RoundEndOverlay';
import { JackpotCelebration, type JackpotDisplay } from './JackpotCelebration';
import { GameOverOverlay } from './GameOverOverlay';
import { TutorialOverlay, type TutorialMark } from './TutorialOverlay';
import type { TutorialApi } from '../tutorial/useTutorial';
import { C, alpha } from '../config/colors';
import { FONTS } from '../config/fonts';
import { TopBar } from './board/TopBar';
import { OpponentSeat } from './board/OpponentSeat';
import { MessageLine } from './board/MessageLine';
import { SpeechBubble } from './board/SpeechBubble';
import { TableZone } from './board/TableZone';
import { CaptureTray } from './board/CaptureTray';
import { TakeTheTablePanel } from './board/TakeTheTablePanel';
import { YourBar } from './board/YourBar';
import { HandRow } from './board/HandRow';
import { seatOf } from './board/opponents';
import { moveWords } from './board/words';

// The game board, GB2 (D-007 release 2, part 1): top bar, two opponent seats,
// the message line, the table, the capture tray while you build or an
// opponent's capture replays, your race bar and your hand. Gold is yours and
// the table's; an opponent's things wear its colour.

type CardSource = 'hand' | 'board';

interface Props {
  state: GameState;
  isPlayerTurn: boolean;
  botViz: BotVizStep | null;
  botCombo: BotComboDisplay | null;
  /** The last move (useGameController's LastMove), under App.tsx's name for it. */
  lastCapture: LastMove | null;
  jackpotInfo: JackpotDisplay | null;
  currentLevelId?: number | null;
  gameOver: { winner: number; winnerName: string } | null;
  actions: GameActions;
  onQuit: () => void;
  onHome: () => void;
  onPlayAgain: () => void;
  onOpenSettings: () => void;
  // The Run tutorial — state lives in GameWrapper so useGameController
  // can see tutorialActive from its first render (freeze ticket). GameView
  // just renders the overlay and shows the tray's ghost for its marks.
  tutorial: TutorialApi;
  /** Still passed by App.tsx; the toasts it suppressed went with release 2. */
  suppressToasts?: boolean;
}

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];

export function GameView({
  state, isPlayerTurn, botViz, botCombo, lastCapture: lastMove, jackpotInfo, currentLevelId, gameOver, actions, onQuit, onHome, onPlayAgain, onOpenSettings, tutorial,
}: Props) {
  const calm = useReducedMotion();
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tableRef = useRef<HTMLDivElement | null>(null);
  // Tutorial zone refs (tableRef above doubles as the Table mark).
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const seatsRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const submitWrapRef = useRef<HTMLDivElement | null>(null);
  const resetWrapRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Record<1 | 2, HTMLDivElement | null>>({ 1: null, 2: null });

  const [hoveredSlot, setHoveredSlot] = useState<ComboSlot | null>(null);
  const [hoveredTable, setHoveredTable] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [flyTo, setFlyTo] = useState<{ x: number; y: number } | null>(null);
  const lastHitRef = useRef(0);

  const inPlay = state.gamePhase === 'playing';
  const target = state.settings.targetScore;
  const current = state.currentPlayer;
  const build = state.combination;
  const hasBuild = build.base !== null || build.combo1.length > 0 || build.combo2.length > 0 || build.combo3.length > 0;
  const replay = botCombo;
  const building = isPlayerTurn && hasBuild && !replay;
  // The tray shows while you build, while an opponent's capture replays, and
  // as a ghost under the tutorial so its SUBMIT and RESET marks have a target.
  const trayOpen = building || replay !== null || tutorial.visible;
  // Release 1's read of the engine for SUBMIT, left as it was.
  const buildValid = useMemo(() => hasBuild && validateFullCombo(state).isValid, [state, hasBuild]);
  const seats = useMemo(() => ({ 1: seatOf(state, 1), 2: seatOf(state, 2) }), [state]);

  // Where each staged card came from, for its ghost: your build, or the
  // opponent's capture on show.
  const ghosts = useMemo(() => {
    const m = new Map<string, string>();
    const c = replay ? replay.combination : build;
    if (c.base) m.set(c.base.id, 'IN BASE');
    c.combo1.forEach((g) => m.set(g.card.id, 'IN COMBO 1'));
    c.combo2.forEach((g) => m.set(g.card.id, 'IN COMBO 2'));
    c.combo3.forEach((g) => m.set(g.card.id, 'IN COMBO 3'));
    return m;
  }, [build, replay]);
  const shaded = useMemo(() => (building && build.base ? tableCardsThatCannotJoin(state) : new Set<string>()), [building, build.base, state]);
  const message = useMemo(() => messageLine(state, build, lastMove, replay), [state, build, lastMove, replay]);
  const ttt = useMemo(() => takeTheTable(state), [state]);
  const baseSide = baseSourceOf(state, build);
  const valid = {
    combo1: comboIsValid(state, build, 'combo1'),
    combo2: comboIsValid(state, build, 'combo2'),
    combo3: comboIsValid(state, build, 'combo3'),
  };
  const points = stagedPoints(build);

  const bubble = lastMove && lastMove.player !== 0 && inPlay
    ? { player: lastMove.player as 1 | 2, words: moveWords(lastMove) }
    : null;
  // The base on show has left the opponent's hand (GB2 phone C: 4 → 3).
  const heldBy = (p: 1 | 2) => state.hands[p].length - (replay?.playerIndex === p ? 1 : 0);
  const thinkingBot = botViz?.type === 'thinking' && !replay ? botViz.playerIndex : null;
  const barLabel = current === 0
    ? 'YOUR TURN'
    : thinkingBot === current
      ? `WAITING FOR ${opponentName(state, current).toUpperCase()}`
      : `WAITING · ${opponentName(state, current).toUpperCase()}'S TURN`;
  // MODE · TARGET · R[round] · H[hand]; The Run keeps today's level in place of the target.
  const mode = currentLevelId ? 'THE RUN' : 'CLASSIC';
  const detail = currentLevelId ? `${Math.ceil(currentLevelId / 3)}-${((currentLevelId - 1) % 3) + 1}` : String(target);

  // The Take the Table panel's other two players, in turn order from the current player.
  const tttOthers = useMemo(() => {
    if (!ttt) return [];
    const order: PlayerIndex[] = [current, ((current + 1) % 3) as PlayerIndex, ((current + 2) % 3) as PlayerIndex];
    return order.filter((p) => p !== ttt.player).map((p) => playerName(state, p));
  }, [ttt, current, state]);
  const tttColour = ttt && ttt.player !== 0 ? seats[ttt.player as 1 | 2].colour : C.classicGold;

  // Where the replayed cards fly when the tray closes: to the opponent's seat.
  useLayoutEffect(() => {
    if (!replay) return;
    const seat = seatRefs.current[replay.playerIndex as 1 | 2];
    const tray = trayRef.current;
    if (!seat || !tray) {
      setFlyTo(null);
      return;
    }
    const a = tray.getBoundingClientRect();
    const b = seat.getBoundingClientRect();
    setFlyTo({ x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2) });
  }, [replay]);

  // ── Picking and dragging ──────────────────────────
  // A tap on a hand or table card picks it as the base and opens the tray;
  // from there cards are dragged into the combos, and a hand card dragged
  // onto the table is placed.

  const handleTap = useCallback((card: Card, source: CardSource) => {
    if (!isPlayerTurn || build.base) return;
    actions.addToCombo(card.id, source, 'base');
  }, [isPlayerTurn, build.base, actions]);

  const findDropTarget = useCallback((point: { x: number; y: number }): { type: 'slot'; slot: ComboSlot } | { type: 'table' } | null => {
    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) return { type: 'slot', slot: SLOT_KEYS[i] };
    }
    const t = tableRef.current;
    if (t) {
      const r = t.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) return { type: 'table' };
    }
    return null;
  }, []);

  const handleDragMove = useCallback((source: CardSource, point: { x: number; y: number }) => {
    const now = Date.now();
    if (now - lastHitRef.current < 50) return;
    lastHitRef.current = now;
    const t = findDropTarget(point);
    if (t?.type === 'slot') { setHoveredSlot(t.slot); setHoveredTable(false); }
    else if (t?.type === 'table' && source === 'hand') { setHoveredSlot(null); setHoveredTable(true); }
    else { setHoveredSlot(null); setHoveredTable(false); }
  }, [findDropTarget]);

  const handleDragEnd = useCallback((card: Card, source: CardSource, point: { x: number; y: number }) => {
    setHoveredSlot(null);
    setHoveredTable(false);
    if (!isPlayerTurn) return;
    const t = findDropTarget(point);
    if (!t) return;
    if (t.type === 'slot') actions.addToCombo(card.id, source, t.slot);
    else if (source === 'hand') actions.placeCard(card.id);
  }, [isPlayerTurn, findDropTarget, actions]);

  const handleRemove = useCallback((cardId: string) => {
    if (!isPlayerTurn) return;
    actions.removeFromCombo(cardId);
  }, [isPlayerTurn, actions]);

  const handleSubmit = useCallback(() => {
    actions.submitCombo();
  }, [actions]);

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100dvh', boxSizing: 'border-box', background: C.ground.classic, color: C.ink.classic,
      display: 'flex', flexDirection: 'column', padding: '14px 16px 28px',
      overflow: 'hidden', touchAction: 'none', fontFamily: FONTS.sans,
    }}>
      <TopBar
        barRef={topBarRef}
        mode={mode}
        detail={detail}
        round={state.currentRound}
        hand={state.handNumber}
        canLeave={!gameOver && !jackpotInfo && inPlay}
        onLeave={() => setShowQuitDialog(true)}
        onSettings={onOpenSettings}
      />

      <div ref={seatsRef} style={{ display: 'flex', gap: 10, marginTop: 6, flexShrink: 0 }}>
        {([1, 2] as const).map((p) => (
          <OpponentSeat
            key={p}
            seatRef={(el) => { seatRefs.current[p] = el; }}
            name={seats[p].name}
            colour={seats[p].colour}
            score={p === 1 ? state.overallScores.bot1 : state.overallScores.bot2}
            target={target}
            cardsHeld={heldBy(p)}
            thinking={thinkingBot === p}
            active={inPlay && current === p}
          />
        ))}
      </div>

      <MessageLine lineRef={messageRef} text={message} />

      <TableZone
        zoneRef={tableRef}
        cards={state.board}
        ghosts={ghosts}
        shaded={shaded}
        deckCount={state.deck.length}
        pillSide={bubble?.player === 1 ? 'right' : 'left'}
        highlighted={hoveredTable}
        draggable={isPlayerTurn}
        onTap={(card) => handleTap(card, 'board')}
        onDragMove={(_card, pt) => handleDragMove('board', pt)}
        onDragEnd={(card, pt) => handleDragEnd(card, 'board', pt)}
      >
        <AnimatePresence>
          {bubble && (
            <SpeechBubble
              key={`${bubble.player}:${bubble.words}`}
              side={bubble.player === 1 ? 'left' : 'right'}
              colour={seats[bubble.player].colour}
              name={seats[bubble.player].name}
              words={bubble.words}
            />
          )}
        </AnimatePresence>
      </TableZone>

      <AnimatePresence initial={false} mode="wait">
        {trayOpen && (
          <motion.div
            key={replay ? `replay-${replay.playerIndex}` : 'build'}
            ref={trayRef}
            initial={{ opacity: 0, y: calm ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: replay ? 0.45 : 0.2, ease: 'easeOut' }}
            style={{ marginTop: 12, flexShrink: 0 }}
          >
            {replay ? (
              <CaptureTray
                mode="replay"
                combination={replay.combination}
                name={seats[replay.playerIndex as 1 | 2].name}
                colour={seats[replay.playerIndex as 1 | 2].colour}
                points={replay.points}
                cards={replay.cards}
                flyTo={flyTo}
              />
            ) : (
              <CaptureTray
                mode="build"
                build={build}
                baseSide={baseSide}
                valid={valid}
                canSubmit={buildValid}
                points={points}
                ghost={!building}
                hoveredSlot={hoveredSlot}
                onRemove={handleRemove}
                onReset={actions.resetCombo}
                onSubmit={handleSubmit}
                slotRefs={slotRefs}
                submitWrapRef={submitWrapRef}
                resetWrapRef={resetWrapRef}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!trayOpen && inPlay && ttt && (
        <TakeTheTablePanel
          inLine={playerName(state, ttt.player)}
          colour={tttColour}
          others={tttOthers}
          cards={ttt.cards}
          points={ttt.points}
        />
      )}

      <YourBar label={barLabel} yours={current === 0} score={state.overallScores.player} target={target} />

      <HandRow
        rowRef={handRef}
        cards={state.hands[0]}
        ghosts={ghosts}
        draggable={isPlayerTurn}
        onTap={(card) => handleTap(card, 'hand')}
        onDragMove={(_card, pt) => handleDragMove('hand', pt)}
        onDragEnd={(card, pt) => handleDragEnd(card, 'hand', pt)}
      />

      {/* ═══ QUIT DIALOG (today's, until part 3) ═══ */}
      <AnimatePresence>
        {showQuitDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onClick={() => setShowQuitDialog(false)}
            style={{ position: 'fixed', inset: 0, background: alpha(C.classicTable, 0.7), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 20 }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: C.surface.classic, borderRadius: 12, padding: 24, maxWidth: 280, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontFamily: FONTS.display, fontWeight: 400, fontSize: 18, color: C.inkOnSurface.classic, margin: 0 }}>
                {currentLevelId ? 'Return to The Run Map?' : 'Quit Game?'}
              </h3>
              <p style={{ fontSize: 13, color: alpha(C.inkOnSurface.classic, 0.6), textAlign: 'center', margin: 0 }}>
                {currentLevelId
                  ? 'Your level is saved. Resume it from The Run map. Star progress is safe.'
                  : 'Your game is saved. Tap Continue on the home screen to pick it up.'}
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, width: '100%' }}>
                <Btn label={currentLevelId ? 'BACK' : 'QUIT'} onClick={() => { setShowQuitDialog(false); onQuit(); }} />
                <Btn label="RESUME" primary onClick={() => setShowQuitDialog(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ OVERLAYS (parts 2 and 3) ═══ */}
      <RoundEndOverlay visible={state.gamePhase === 'roundEnd'} roundNumber={state.currentRound} roundStats={state.roundStats} overallScores={state.overallScores} targetScore={target} bot1Personality={state.settings.bot1Personality} bot2Personality={state.settings.bot2Personality} onContinue={actions.continueRound} adventureMode={!!currentLevelId} />
      <JackpotCelebration info={jackpotInfo} bot1Personality={state.settings.bot1Personality} bot2Personality={state.settings.bot2Personality} />
      <GameOverOverlay winner={gameOver as { winner: PlayerIndex; winnerName: string } | null} state={state} adventureMode={!!currentLevelId} onPlayAgain={onPlayAgain} onHome={onHome} />

      {/* The Run tutorial — 8-mark coach overlay. Auto-fires on first W1L1
          entry, replayable from Settings. Pure presentation; engine untouched. */}
      <TutorialOverlay
        visible={tutorial.visible}
        currentStep={tutorial.currentStep}
        totalSteps={tutorial.totalSteps}
        marks={TUTORIAL_MARKS({
          handZoneRef: handRef, boardRef: tableRef, comboBuilderRef: trayRef, resetWrapRef,
          submitWrapRef, botZonesRef: seatsRef, msgStripRef: messageRef, headerRef: topBarRef,
        })}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onSkip={tutorial.dismiss}
        onJump={tutorial.jumpTo}
      />
    </div>
  );
}

// ─── Tutorial marks (verbatim copy + zone refs) ─────────
// Teaching order: bottom (your stuff) → middle (workspace) → controls →
// upper middle (opponents) → top (context).

interface TutorialMarkRefs {
  handZoneRef: React.RefObject<HTMLDivElement | null>;
  boardRef: React.RefObject<HTMLDivElement | null>;
  comboBuilderRef: React.RefObject<HTMLDivElement | null>;
  resetWrapRef: React.RefObject<HTMLDivElement | null>;
  submitWrapRef: React.RefObject<HTMLDivElement | null>;
  botZonesRef: React.RefObject<HTMLDivElement | null>;
  msgStripRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
}

function TUTORIAL_MARKS(refs: TutorialMarkRefs): TutorialMark[] {
  return [
    { title: 'Your hand', copy: 'Your hand and your score. Drag a card into the builder to begin.', ref: refs.handZoneRef },
    { title: 'The table', copy: 'Shared cards. You score by capturing these.', ref: refs.boardRef },
    { title: 'Combo builder', copy: 'Drag a base card here — from your hand or the table — then add cards that add up to it, or match it.', ref: refs.comboBuilderRef },
    { title: 'Reset', copy: 'Dragged the wrong card? Reset sends everything in the builder back where it came from.', ref: refs.resetWrapRef, pill: true },
    { title: 'Submit', copy: 'Hit submit to capture, and your turn keeps going. To place instead, drag a card onto the table — that ends your turn.', ref: refs.submitWrapRef, pill: true },
    { title: 'The opponents', copy: 'Two opponents are after the same cards. Watch what they leave behind.', ref: refs.botZonesRef },
    { title: 'Message strip', copy: 'Hints and the last move land here.', ref: refs.msgStripRef },
    { title: 'Header', copy: "Where you are: your world and level, and the round and hand you're on.", ref: refs.headerRef },
  ];
}

// ─── Button (the quit dialog's, until part 3) ───────

function Btn({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  // Secondary outlined style: 1.5px ink@40% border, ink@90% text,
  // transparent fill. Primary is Classic's gold with the table colour (RESUME).
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.97 }} transition={getTransition('snappy')} style={{
      padding: '10px 24px', borderRadius: 6,
      border: primary ? 'none' : `1.5px solid ${alpha(C.ink.classic, 0.4)}`,
      background: primary ? C.classicGold : 'transparent',
      color: primary ? C.classicTable : alpha(C.ink.classic, 0.9),
      fontSize: 15, fontWeight: 600, fontFamily: FONTS.sans,
      cursor: 'pointer',
    }}>{label}</motion.button>
  );
}
