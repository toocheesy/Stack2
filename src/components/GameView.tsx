import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Card, ComboSlot, GameState, PlayerIndex } from '../engine/types';
import {
  MOMENTS,
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
import { TakeTheTableBanner, type JackpotDisplay } from './JackpotCelebration';
import { GameOverOverlay } from './GameOverOverlay';
import { TutorialOverlay, type TutorialMark } from './TutorialOverlay';
import { LeaveSheet } from './LeaveSheet';
import { GameSettingsSheet } from './GameSettingsSheet';
import type { TutorialApi } from '../tutorial/useTutorial';
import { C } from '../config/colors';
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
import { centreOf, useMomentPhase, type Point } from './board/moments';
import { Fade, type Flight } from './board/pieces';

// The game board, GB2 (D-007 release 2): top bar, two opponent seats, the
// message line, the table, the capture tray while you build or an opponent's
// capture replays, your race bar and your hand. Gold is yours and the
// table's; an opponent's things wear its colour. Part 2 adds the moments:
// your capture (YC1), the last cards landing (Law 8), Take the Table (TT1),
// and the round end and game over sheets (RE1p, GO2). Part 3 adds the
// pauses: leaving the game (QD1), the in-game Settings (ST3) and the
// tutorial (TU2), each a plum sheet over the dimmed game, with the game
// paused underneath.

type CardSource = 'hand' | 'board';

/** The pause sheet open over the game: leaving it (QD1) or Settings (ST3).
 *  The tutorial is the third pause, held by useTutorial. */
export type PauseSheet = 'leave' | 'settings' | null;

interface Props {
  state: GameState;
  isPlayerTurn: boolean;
  botViz: BotVizStep | null;
  botCombo: BotComboDisplay | null;
  /** The last move (useGameController's LastMove), under App.tsx's name for it. */
  lastCapture: LastMove | null;
  /** Take the Table on show (useGameController's TakeTheTableMoment), under App.tsx's name for it. */
  jackpotInfo: JackpotDisplay | null;
  gameOver: { winner: number } | null;
  actions: GameActions;
  onQuit: () => void;
  onHome: () => void;
  onPlayAgain: () => void;
  /** The pause sheet open, and how to open or close one. Its state lives in
   *  GameWrapper so useGameController is paused from the same render. */
  pause: PauseSheet;
  onPause: (sheet: PauseSheet) => void;
  // The tutorial — state lives in GameWrapper so useGameController can see
  // the pause from its first render (freeze ticket). GameView renders the
  // overlay and shows the tray's ghost for its marks.
  tutorial: TutorialApi;
}

const SLOT_KEYS: ComboSlot[] = ['base', 'combo1', 'combo2', 'combo3'];
const YC = MOMENTS.yourCapture;
const TT = MOMENTS.takeTheTable;
// Ruling 99: below this height the board's spacing tightens so the table's
// cards keep their size with the tray open, down to 667px tall.
const COMPACT_BELOW = 760;

function useCompact(): boolean {
  const [height, setHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 844));
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height < COMPACT_BELOW;
}

export function GameView({
  state, isPlayerTurn, botViz, botCombo, lastCapture: lastMove, jackpotInfo, gameOver, actions, onQuit, onHome, onPlayAgain, pause, onPause, tutorial,
}: Props) {
  const calm = !!useReducedMotion();
  const compact = useCompact();
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tableRef = useRef<HTMLDivElement | null>(null);
  // Tutorial zone refs (tableRef above doubles as the Table mark).
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const seatsRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const submitWrapRef = useRef<HTMLDivElement | null>(null);
  const resetWrapRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const seatRefs = useRef<Record<1 | 2, HTMLDivElement | null>>({ 1: null, 2: null });

  const [hoveredSlot, setHoveredSlot] = useState<ComboSlot | null>(null);
  const [hoveredTable, setHoveredTable] = useState(false);
  // Ruling 98: a drag with nothing staged opens the tray as a drop target.
  const [dragOpen, setDragOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<Point | null>(null);
  const lastHitRef = useRef(0);

  const inPlay = state.gamePhase === 'playing';
  const target = state.settings.targetScore;
  const current = state.currentPlayer;
  const build = state.combination;
  const hasBuild = build.base !== null || build.combo1.length > 0 || build.combo2.length > 0 || build.combo3.length > 0;
  const replay = botCombo;

  // ── The moments ────────────────────────────────────

  // YC1: your capture just made plays once per move, from the game as it
  // stood before it (lastMove.before) to the game as it is.
  const yourCapture = lastMove && lastMove.player === 0 && lastMove.captures.length > 0 && lastMove.placed === null ? lastMove : null;
  const ycPhase = useMomentPhase(
    yourCapture ? yourCapture.id : null,
    calm ? [YC.calm.out, YC.calm.land, YC.calm.land, YC.calm.end] : [YC.chromeOut, YC.message, YC.land, YC.end],
  );
  // 0: the chrome fades and the cards fly; 1: chrome gone; 2: the message
  // line, hand and table show the capture made; 3: the score lands; 4: over.
  const ycShowing = yourCapture !== null && ycPhase < 4;
  const ycBefore = yourCapture !== null && ycPhase < 2 ? yourCapture.before : null;

  // TT1: Take the Table plays once per round end.
  const tt = jackpotInfo;
  const ttPhase = useMomentPhase(tt ? tt.id : null, calm ? [1, TT.calm.land, TT.calm.bannerEnd] : [TT.hold, TT.land, TT.bannerEnd]);
  // 0: a beat; 1: the cards fly and the banner shows; 2: the score lands; 3: the banner is gone.

  // The last cards landing (Law 8): the rest of a hand, one card at a time.
  const landingMove = lastMove && lastMove.rest.length > 0 && lastMove.round === state.currentRound && lastMove.hand === state.handNumber ? lastMove : null;

  const momentActive = ycShowing || tt !== null;
  const interactive = isPlayerTurn && !momentActive;
  // Paused (section D): a sheet is open over the game; taps reach only the sheet.
  const paused = pause !== null || tutorial.visible;
  const canAct = interactive && !paused;

  const shownState = ycBefore ?? state;
  const shownBuild = ycBefore ? ycBefore.combination : build;
  const shownScores = tt && ttPhase < 2 ? tt.scoresBefore : (yourCapture && ycPhase < 3 ? yourCapture.before.overallScores : state.overallScores);

  const building = interactive && hasBuild && !replay;
  // The tray shows while you build, while an opponent's capture replays, as
  // the drop target of a drag with nothing staged, as your capture flies, and
  // as a ghost under the tutorial so its SUBMIT and RESET marks have a target.
  const trayOpen = building || replay !== null || tutorial.visible || (dragOpen && interactive) || ycShowing;
  // Release 1's read of the engine for SUBMIT, left as it was.
  const buildValid = useMemo(() => hasBuild && validateFullCombo(state).isValid, [state, hasBuild]);
  const seats = useMemo(() => ({ 1: seatOf(state, 1), 2: seatOf(state, 2) }), [state]);

  // Where each staged card came from, for its ghost: your build (or the one
  // just captured), or the opponent's capture on show.
  const ghosts = useMemo(() => {
    const m = new Map<string, string>();
    const c = replay ? replay.combination : shownBuild;
    if (c.base) m.set(c.base.id, 'IN BASE');
    c.combo1.forEach((g) => m.set(g.card.id, 'IN COMBO 1'));
    c.combo2.forEach((g) => m.set(g.card.id, 'IN COMBO 2'));
    c.combo3.forEach((g) => m.set(g.card.id, 'IN COMBO 3'));
    return m;
  }, [shownBuild, replay]);
  const shaded = useMemo(() => (building && build.base ? tableCardsThatCannotJoin(state) : new Set<string>()), [building, build.base, state]);
  const message = useMemo(
    () => (ycBefore ? messageLine(ycBefore, ycBefore.combination, null, null) : messageLine(state, build, lastMove, replay)),
    [ycBefore, state, build, lastMove, replay],
  );
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
  // While Take the Table plays the label shows nothing (TC's playtest of part 2).
  const barLabel = tt
    ? ''
    : current === 0
      ? 'YOUR TURN'
      : thinkingBot === current
        ? `WAITING FOR ${opponentName(state, current).toUpperCase()}`
        : `WAITING · ${opponentName(state, current).toUpperCase()}'S TURN`;
  // MODE · TARGET · R[round] · H[hand].
  const mode = 'CLASSIC';
  const detail = String(target);

  // The Take the Table panel: who is in line (from the moment while it plays).
  const panel = useMemo(() => (tt ? { player: tt.winner, cards: tt.cards, points: tt.points } : ttt), [tt, ttt]);
  const panelOthers = useMemo(() => {
    if (!panel) return [];
    const order: PlayerIndex[] = [current, ((current + 1) % 3) as PlayerIndex, ((current + 2) % 3) as PlayerIndex];
    return order.filter((p) => p !== panel.player).map((p) => playerName(state, p));
  }, [panel, current, state]);
  const panelColour = panel && panel.player !== 0 ? seats[panel.player as 1 | 2].colour : C.classicGold;
  const panelShowing = !trayOpen && inPlay && panel !== null;

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

  // Targets for the moments' flights: your bar, your score, a seat.
  const barTarget = useCallback(() => centreOf(barRef.current), []);
  const scoreTarget = useCallback(() => centreOf(scoreRef.current), []);
  const seatTarget = useCallback((p: PlayerIndex) => (p === 0 ? centreOf(barRef.current) : centreOf(seatRefs.current[p])), []);
  const handTarget = useCallback(() => centreOf(handRef.current), []);

  // TT1's flight for the i-th of n table cards.
  const ttFlightFor = useCallback((i: number, n: number): Flight => ({
    target: () => (tt ? seatTarget(tt.winner) : null),
    delay: (TT.hold + i * TT.step) / 1000,
    duration: TT.flight / 1000,
    hop: 12,
    grow: 1.08,
    shrink: 0.35,
    rotate: (i - (n - 1) / 2) * 7,
    calmDuration: TT.calm.out / 1000,
  }), [tt, seatTarget]);

  // ── Picking and dragging ──────────────────────────
  // A tap on a hand or table card picks it as the base and opens the tray;
  // a drag with nothing staged opens the tray too, as a drop target (ruling
  // 98). From there cards are dragged into the combos, and a hand card
  // dragged onto the table is placed.

  const handleTap = useCallback((card: Card, source: CardSource) => {
    if (!canAct || build.base) return;
    actions.addToCombo(card.id, source, 'base');
  }, [canAct, build.base, actions]);

  const findDropTarget = useCallback((point: Point): { type: 'slot'; slot: ComboSlot } | { type: 'table' } | null => {
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

  const handleDragMove = useCallback((source: CardSource, point: Point) => {
    if (!dragOpen) setDragOpen(true);
    const now = Date.now();
    if (now - lastHitRef.current < 50) return;
    lastHitRef.current = now;
    const t = findDropTarget(point);
    if (t?.type === 'slot') { setHoveredSlot(t.slot); setHoveredTable(false); }
    else if (t?.type === 'table' && source === 'hand') { setHoveredSlot(null); setHoveredTable(true); }
    else { setHoveredSlot(null); setHoveredTable(false); }
  }, [dragOpen, findDropTarget]);

  const handleDragEnd = useCallback((card: Card, source: CardSource, point: Point) => {
    setHoveredSlot(null);
    setHoveredTable(false);
    // The tray stays only if the drop staged something (the build then holds it open).
    setDragOpen(false);
    if (!canAct) return;
    const t = findDropTarget(point);
    if (!t) return;
    if (t.type === 'slot') actions.addToCombo(card.id, source, t.slot);
    else if (source === 'hand') actions.placeCard(card.id);
  }, [canAct, findDropTarget, actions]);

  const handleRemove = useCallback((cardId: string) => {
    if (!canAct) return;
    actions.removeFromCombo(cardId);
  }, [canAct, actions]);

  const handleSubmit = useCallback(() => {
    if (!canAct) return;
    actions.submitCombo();
  }, [canAct, actions]);

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100dvh', boxSizing: 'border-box', background: C.ground.classic, color: C.ink.classic,
      display: 'flex', flexDirection: 'column', padding: compact ? '6px 16px 8px' : '8px 16px 12px',
      overflow: 'hidden', touchAction: 'none', fontFamily: FONTS.sans,
    }}>
      <TopBar
        barRef={topBarRef}
        mode={mode}
        detail={detail}
        round={state.currentRound}
        hand={state.handNumber}
        canLeave={!gameOver && !tt && inPlay}
        // QD1's leave sheet.
        onLeave={() => onPause('leave')}
        onSettings={() => onPause('settings')}
      />

      <div ref={seatsRef} style={{ display: 'flex', gap: 10, marginTop: compact ? 2 : 4, flexShrink: 0 }}>
        {([1, 2] as const).map((p) => (
          <OpponentSeat
            key={p}
            seatRef={(el) => { seatRefs.current[p] = el; }}
            name={seats[p].name}
            colour={seats[p].colour}
            score={p === 1 ? shownScores.bot1 : shownScores.bot2}
            target={target}
            cardsHeld={heldBy(p)}
            thinking={thinkingBot === p}
            active={inPlay && current === p}
          />
        ))}
      </div>

      <MessageLine lineRef={messageRef} text={message} compact={compact} />

      <TableZone
        zoneRef={tableRef}
        compact={compact}
        cards={shownState.board}
        ghosts={ghosts}
        ghostFade={ycShowing ? (calm ? YC.calm.out : YC.chromeOut) / 1000 : undefined}
        shaded={shaded}
        deckCount={state.deck.length}
        pillSide={bubble?.player === 1 ? 'right' : 'left'}
        highlighted={hoveredTable}
        draggable={canAct}
        landing={landingMove ? {
          ids: landingMove.rest.map((c) => c.id),
          from: landingMove.player === 0 ? handTarget : () => seatTarget(landingMove.player),
          step: MOMENTS.landing.step / 1000,
        } : null}
        flight={tt ? { cards: tt.cards, flightFor: ttFlightFor } : null}
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
            key={replay ? `replay-${replay.playerIndex}` : ycShowing ? `capture-${yourCapture!.id}` : 'build'}
            ref={trayRef}
            initial={{ opacity: 0, y: calm ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: replay ? 0.45 : 0.2, ease: 'easeOut' }}
            style={{ marginTop: compact ? 4 : 8, flexShrink: 0 }}
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
            ) : ycShowing ? (
              <CaptureTray
                mode="capture"
                combination={yourCapture!.captures[yourCapture!.captures.length - 1].combination}
                baseSide={baseSourceOf(yourCapture!.before, yourCapture!.before.combination)}
                points={yourCapture!.captures[yourCapture!.captures.length - 1].points}
                barTarget={barTarget}
                scoreTarget={scoreTarget}
              />
            ) : (
              <CaptureTray
                mode="build"
                compact={compact}
                build={build}
                baseSide={baseSide}
                valid={valid}
                canSubmit={buildValid}
                points={points}
                ghost={!building && !dragOpen}
                hoveredSlot={hoveredSlot}
                onRemove={handleRemove}
                onReset={actions.resetCombo}
                onSubmit={handleSubmit}
                slotRefs={slotRefs}
                columnRefs={columnRefs}
                submitWrapRef={submitWrapRef}
                resetWrapRef={resetWrapRef}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {panelShowing && panel && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Fade out={tt !== null} duration={(calm ? TT.calm.out : 200) / 1000} delay={tt && !calm ? TT.banner / 1000 : 0}>
            <TakeTheTablePanel
              inLine={playerName(state, panel.player)}
              colour={panelColour}
              others={panelOthers}
              cards={panel.cards}
              points={panel.points}
            />
          </Fade>
          <AnimatePresence>
            {tt && ttPhase >= 1 && ttPhase < 3 && (
              <TakeTheTableBanner
                key={tt.id}
                name={playerName(state, tt.winner)}
                colour={panelColour}
                points={tt.points}
                cardCount={tt.cardCount}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      <YourBar
        label={barLabel}
        yours={current === 0}
        score={shownScores.player}
        target={target}
        compact={compact}
        barRef={barRef}
        scoreRef={scoreRef}
      />

      <HandRow
        rowRef={handRef}
        compact={compact}
        cards={shownState.hands[0]}
        ghosts={ghosts}
        ghostFade={ycShowing ? (calm ? YC.calm.out : YC.chromeOut) / 1000 : undefined}
        draggable={canAct}
        emptyWords={inPlay}
        onTap={(card) => handleTap(card, 'hand')}
        onDragMove={(_card, pt) => handleDragMove('hand', pt)}
        onDragEnd={(card, pt) => handleDragEnd(card, 'hand', pt)}
      />

      {/* ═══ THE SHEETS ═══ */}
      <RoundEndOverlay
        visible={state.gamePhase === 'roundEnd'}
        roundNumber={state.currentRound}
        roundStats={state.roundStats}
        overallScores={state.overallScores}
        targetScore={target}
        bot1Personality={state.settings.bot1Personality}
        bot2Personality={state.settings.bot2Personality}
        onContinue={actions.continueRound}
        isOvertime={state.isOvertime}
        modeWord={mode}
        paused={paused}
      />
      <GameOverOverlay winner={gameOver as { winner: PlayerIndex } | null} state={state} onPlayAgain={onPlayAgain} onHome={onHome} />

      {/* ═══ THE PAUSES (D-007 release 2 part 3) ═══ */}
      <LeaveSheet
        open={pause === 'leave'}
        onKeepPlaying={() => onPause(null)}
        onLeave={() => { onPause(null); onQuit(); }}
      />
      <GameSettingsSheet
        open={pause === 'settings'}
        modeWord={mode}
        round={state.currentRound}
        hand={state.handNumber}
        onDone={() => onPause(null)}
        onTutorial={() => { onPause(null); tutorial.open(); }}
      />
      {/* The tutorial, TU2: nine steps over the board's parts. It opens from
          Settings › Tutorial; the engine is never touched. */}
      <TutorialOverlay
        visible={tutorial.visible}
        currentStep={tutorial.currentStep}
        totalSteps={tutorial.totalSteps}
        marks={TUTORIAL_MARKS({
          hand: handRef, table: tableRef, tray: trayRef, columns: columnRefs, submit: submitWrapRef, reset: resetWrapRef,
          seats: seatsRef, message: messageRef, topBar: topBarRef,
        })}
        trayRef={trayRef}
        compact={compact}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onSkip={tutorial.dismiss}
        onJump={tutorial.jumpTo}
      />
    </div>
  );
}

// ─── Tutorial marks: TU2's nine steps (D-007 ruling 79) ───
// Each step's words, the part it lights, and the edge the sheet docks to,
// away from the part. Steps 3 to 6 lay the sample capture over the tray.

interface TutorialMarkRefs {
  hand: React.RefObject<HTMLDivElement | null>;
  table: React.RefObject<HTMLDivElement | null>;
  tray: React.RefObject<HTMLDivElement | null>;
  /** The tray's slot columns; HAND and TABLE lights the first two. */
  columns: React.RefObject<(HTMLDivElement | null)[]>;
  submit: React.RefObject<HTMLDivElement | null>;
  reset: React.RefObject<HTMLDivElement | null>;
  seats: React.RefObject<HTMLDivElement | null>;
  message: React.RefObject<HTMLDivElement | null>;
  topBar: React.RefObject<HTMLDivElement | null>;
}

function TUTORIAL_MARKS(refs: TutorialMarkRefs): TutorialMark[] {
  const column = (i: number): React.RefObject<HTMLDivElement | null> => ({ get current() { return refs.columns.current[i] ?? null; } });
  return [
    { title: 'Your hand.', copy: 'Your cards. Drag one into the capture tray to start a capture, or onto the table to place it.', refs: [refs.hand], side: 'top' },
    { title: 'The table.', copy: 'The shared cards. Capture them to score.', refs: [refs.table], side: 'bottom' },
    { title: 'The capture tray.', copy: 'Put a base card here, from your hand or the table. Then fill up to three combos with cards that add up to it, or match it.', refs: [refs.tray], side: 'top', sample: true },
    { title: 'HAND and TABLE.', copy: 'Every combo needs a card from the other side of your base.', refs: [column(0), column(1)], side: 'top', sample: true },
    { title: 'SUBMIT.', copy: 'Your points show before you press it. A capture keeps your turn going; placing a card ends it.', refs: [refs.submit], side: 'top', sample: true },
    { title: 'RESET.', copy: 'Wrong card? RESET sends everything back where it came from.', refs: [refs.reset], side: 'top', sample: true },
    { title: 'Your opponents.', copy: 'Two opponents race you to the target. Their moves pop up from their seats.', refs: [refs.seats], side: 'bottom' },
    { title: 'The message line.', copy: 'It tells you the rule that matters right now.', refs: [refs.message], side: 'bottom' },
    { title: 'The top bar.', copy: "The target score, and the round and hand you're on. The back arrow leaves the game; it stays saved.", refs: [refs.topBar], side: 'bottom' },
  ];
}
