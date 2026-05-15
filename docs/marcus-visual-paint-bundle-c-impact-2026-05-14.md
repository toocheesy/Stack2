# Marcus Visual Paint — Bundle C Impact

**Track:** `BUILD — Marcus Visual Paint Bundle C (Messaging Architecture)` — P2, May 14 2026.
**Source of truth (spec):** Notion `3602f2662cac811eb433e754b418d458` — Visual Paint Brief Post-UX Review (section 2).
**Ticket:** Notion `3602f266-2cac-817b-83fb-fd1c825391c1`.
**Depends on:** Bundle A (brand color tokens). ✅ Bundle A shipped May 14 (commit `0b8ddb7`). Bundle B is independent and shipped May 14 (commit `2819e5b`).
**Pre-track baseline:** 321 tests passing, `npm run build` clean (post Bundle B).
**Status:** Subsystem shipped. **321 of 321 tests passing** (no new tests; behavioral/layout change). `tsc -b` clean. `npm run build` clean (412.13 KB / 127.25 KB gzip).

---

## Subsystem 1 — Messaging strip toast + persistent split

### What landed

Zone B was a single overloaded strip routing five message states (last capture, round info, hint, celebration placeholder, empty) through one element. Players relearned the strip's meaning every 2-3 seconds. Per UX Review finding 2: the strip became background noise.

Bundle C splits Zone B into **two stacked layers** with explicit priority and overlay gating:

1. **Persistent layer** (always rendered, transparent strip directly under Zone A header) — carries low-frequency continuous state. Default content: `LAST · X = Y` after first capture. Empty before. The header (Bundle B) now carries round info so the persistent strip never repeats it.
2. **Toast layer** (renders ABOVE the persistent strip when active) — carries transient events with slide-in/out. Three kinds with hard priority ordering.

### Layer 1 — Persistent strip (always rendered)

```tsx
{persistentMessage && (
  <span style={{
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.02em',
  }}>
    {persistentMessage.prefix}
    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {persistentMessage.equation}
    </span>
  </span>
)}
```

Typography per spec section 2:
- Prefix `LAST · `: Inter Medium 14px, white @ 60%, letter-spacing +0.02em.
- Equation `A = A+A`: JetBrains Mono 14px (mono digits/operators).
- Background: transparent.
- Height: 32px.

Rendered empty (the conditional is `null`) when no capture has occurred — the header carries R[N] / H[N] / [N] LEFT so the strip has nothing useful to say at start-of-round.

### Layer 2 — Toast layer (slides over persistent)

Three toast kinds. Implemented as a single `motion.div` inside an `AnimatePresence` so each transition cleanly enters/exits with slide-in/out.

| Kind          | Trigger                                                      | Text format                  | Color       | Duration                 | Notes                                 |
| ------------- | ------------------------------------------------------------ | ---------------------------- | ----------- | ------------------------ | ------------------------------------- |
| Celebration   | `lastCapture.timestamp` changes (any new capture)            | `+{points} · NICE COMBO`     | tan @ 100%  | 2s total (250ms / 1500ms / 250ms) | Highest priority         |
| Transition    | `state.currentRound` increments (skip round 1)               | `R{N} · FRESH DECK`          | white @ 100% | 3s total (250ms / 2500ms / 250ms) | Letter-spacing 0.06em    |
| Hint          | Adventure W1+W2 `hintStripEnabled` AND player needs guidance | `HINT  {context}`            | tan prefix + tan @ 90% copy | persistent (no auto-dismiss) | Sentence case             |

Slide animation uses `motion.div` with `initial={{ opacity: 0, y: -10 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, y: -10 }}`, 250ms ease-out. The toast div has a solid `BG` background so it cleanly covers the persistent strip while active.

### Priority resolution (state machine)

A `useState<Transient | null>` holds the active timed toast. Two `useEffect` blocks fire transients:

1. **Celebration effect** — watches `lastCapture` and a ref of the last-seen timestamp. On change, sets transient to celebration (always preempts whatever was there — celebration is highest priority).
2. **Transition effect** — watches `state.currentRound` and a ref of last-seen round. On change, sets transient to transition **only if** the current transient isn't a celebration (`prev?.kind === 'celebration' ? prev : new transition`).

Auto-clear effect: when `transient` is set, schedules a `setTimeout` to clear it at `transient.expires`. Cleanup on unmount/update.

The final `activeToast` is derived via `useMemo`:
- If overlay-suppressing, return null.
- Else if transient is set, return transient.
- Else if `hintText` is set, return a hint variant.
- Else return null.

This means: hint shows as a steady ambient state whenever Adventure W1+W2 is active. When a capture or round transition fires, the timed toast preempts the hint. When the timer expires, the hint resumes if it's still applicable. Doctrine-aligned: lower priorities resume when higher ones complete.

### Overlay gating (closes finding 9)

```ts
const isOverlaySuppressing =
  state.gamePhase !== 'playing' ||   // covers roundEnd + gameOver phases
  !!jackpotInfo ||                   // JACKPOT! celebration overlay active
  !!gameOver ||                      // gameOver prop set (Classic-mode end)
  suppressToasts;                    // App-level pass-through for LevelComplete (Adventure)
```

When any overlay is showing, `activeToast` resolves to `null` immediately. The persistent strip stays — but it has nothing to say during overlays either (last capture echo is fine to keep but rendered behind the overlay backdrop). No HINT showing during JACKPOT, no celebration interrupting Round Complete.

`suppressToasts` is a new prop on `GameView`. App.tsx passes `!!levelComplete` so the in-game toast layer suppresses while the LevelCompleteOverlay (rendered parent-side) is up — the only overlay GameView can't observe directly.

### Honest skips called out

| Item                                | Status                                                                                                          | Resolution path                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Score Celebration **jackpot variant** (`JACKPOT · +85` in jade with subtle glow) | Not implemented separately — the JACKPOT! overlay already handles this case visually and the toast is suppressed during the overlay anyway. | If the JACKPOT! overlay is ever removed/changed, wire the jackpot variant via a `points >= threshold` check or a dedicated signal. |
| **Hint dismissal on player action** | Hint shows whenever `hintText` is non-null and no transient is active. It doesn't auto-dismiss on a player tap — but the `hintText` re-computes per render based on game state, so as soon as the player makes progress (selects a card, builds a combo), the hint text updates to the new appropriate guidance. Effectively dismisses-by-replacement. | If the spec intends explicit dismissal-on-action (single hint, then silence), add a `dismissedThisTurn` ref and gate `hintText`. |
| **Tests** | No new tests. The state machine is verifiable by code review + manual playtest. Vitest doesn't render the GameView in unit tests (no React Testing Library setup). | If a React testing harness is stood up later, the toast priority logic + overlay gating are the natural targets. |

### Files modified
- `src/components/GameView.tsx` — `messageContent` and `hintText` retained; `persistentMessage` is the new derivation; toast state machine added (transient state, two trigger effects, auto-clear, activeToast memo); Zone B render replaced with persistent + AnimatePresence-wrapped toast layer; separate hint strip render below Zone B removed (hint routes through toast now). New `suppressToasts` prop on `GameView`.
- `src/App.tsx` — passes `suppressToasts={!!levelComplete}` to `GameView`.

---

## Aggregate state

| Metric                 | Pre-track | Post-track | Delta                |
| ---------------------- | --------- | ---------- | -------------------- |
| Tests passing          | 321       | **321**    | unchanged            |
| `tsc -b`               | clean     | clean      | —                    |
| `npm run build`        | clean (~430 ms) | clean (~420 ms) | bundle 412.13 KB / 127.25 KB gzip |

**Files touched (2):**
- `src/components/GameView.tsx` — messaging architecture refactor + `suppressToasts` prop.
- `src/App.tsx` — wire `suppressToasts={!!levelComplete}` to GameView in the Adventure flow.

---

## TC manual playtest checklist

Visit `http://192.168.1.79:8091/?unlock` (phone) or `http://localhost:8091/?unlock` (desktop). Auto-unlock helper still in `main.tsx` for playtest.

### Persistent strip
- [ ] Start a fresh Classic game. Strip directly under the header is **empty** at start (header alone carries round info now).
- [ ] After your first capture, persistent strip reads `LAST · A = A+A` (or whatever the capture pattern was). Inter Medium 14px, white@60%. Equation portion uses JetBrains Mono.
- [ ] Confirm bot captures also update the persistent strip.

### Toast — Score Celebration
- [ ] Make a capture worth 20+ points. A tan `+20 · NICE COMBO` toast slides in from the top, holds ~1.5s, slides out. Persistent strip's `LAST · …` is visible underneath after the toast clears.

### Toast — Round Transition
- [ ] Play through to end-of-round. After the Round Complete overlay's CONTINUE, the next round starts and a white `R2 · FRESH DECK` toast appears for ~3s.
- [ ] Confirm Round 1 doesn't show a `R1` transition (suppressed for the initial round).

### Toast — Adventure Hint
- [ ] In Adventure W1 L1 (hints ON), at start of your turn the toast shows `HINT  Tap a card in your hand to start your turn`. Tan prefix + tan@90% copy.
- [ ] Select a card. Hint updates to `HINT  Tap a board card to capture, or tap the board to place`.
- [ ] Move to W3 (hints OFF). Hint toast no longer appears.

### Toast — Priority
- [ ] During Round 2+, before the persistent strip updates, take a capture immediately. Celebration preempts.
- [ ] During an Adventure hint state, make a capture. Celebration toast appears for 2s, then the hint returns.

### Toast — Overlay gating (closes finding 9)
- [ ] Reach end-of-round in Adventure with the hint still set. When the JACKPOT! celebration fires, the HINT toast should disappear — it should NOT show "Watch the bots play their turn" behind the celebration anymore.
- [ ] Same check for Round Complete, Game Over (Classic), Level Complete (Adventure).

---

## What this enables

This is the **final bundle in Marcus's visual paint queue.** Bundle A (cleanup) + B (header + bot zones) + C (messaging architecture) together close every finding from the May 13 UX Review except the items explicitly deferred (responsive priority drop, stat-card re-baseline measurement post-canonical-rebuild).

After this lands, the playtest list narrows to:
- Stat-card re-baseline measurement (deferred from canonical rebuild)
- Adventure mode revalidation pass (deferred per Marcus brief — confirm 12 levels still tune correctly with the new bot calibration)
- Whatever new findings TC surfaces in playtest

---

*Authored against the Visual Paint Brief locked May 13, 2026 (Notion `3602f2662cac811eb433e754b418d458`). One focused subsystem shipped in one CC pass. After this lands: TC plays the checklist, commits + pushes. Marcus visual paint queue drained.*
