# The Run Tutorial — 8-Mark Coach Overlay — Spec

**Track:** `Build — The Run tutorial (8-mark coach-mark overlay)` — `36c2f266-2cac-81f8-94e5-e716909188d1`.
**Plan output:** `docs/run-tutorial-plan-2026-05-25.md` (next).

---

## Confirmation pass against the live screen

| Ticket assumption | Verified in `src/components/GameView.tsx` |
| ----------------- | ----------------------------------------- |
| Builder sits above the hand | ✓ Visual order top → bottom: ZONE A header → B msg strip → C+D bots → E board → F combo strip (builder) → G+H hand+score |
| Reset control label | Actual label is `"RESET"` (all-caps) at `:523`. Coach copy will say "Reset" (prose); the spotlight ring lands on the actual all-caps pill |
| All 8 ticket marks map to real zones | ✓ Mapped below |

**8-mark teaching order mapping (ticket → GameView line):**

| # | Ticket mark | GameView target | Approx line |
| - | ----------- | --------------- | ----------- |
| 1 | Hand + score (bottom strip) | Zones G+H outer wrapper | `:538` |
| 2 | Table (board) | Zone E (`boardRef`, already exists) | `:438` |
| 3 | Combo builder | Zone F outer wrapper | `:484` |
| 4 | Reset control | wrapping div around `<Btn label="RESET" />` | `:523` |
| 5 | SUBMIT button | wrapping div around `<Btn label="SUBMIT" />` | `:522` |
| 6 | Bot zones | Zones C+D outer wrapper | `:420` |
| 7 | Message strip | Zone B outer | `:356` |
| 8 | Header | Zone A outer | `:295` |

---

## Architecture

**UI-only.** No `src/engine/` changes. No game-state mutations. The overlay is a sibling layer above GameView that reads measured zone rects via refs and renders spotlight + coach card chrome on top.

**Files:**

| File | Purpose | Approx LOC |
| ---- | ------- | ---------- |
| `src/tutorial/tutorialStorage.ts` (new) | `stacked.tutorial.v1` localStorage read/write | ~30 |
| `src/tutorial/useTutorial.ts` (new) | State machine: `currentStep`, `visible`, `next`, `prev`, `jumpTo`, `dismiss`, `complete` | ~50 |
| `src/components/TutorialOverlay.tsx` (new) | Spotlight + coach card render | ~250 |
| `src/components/GameView.tsx` (modified) | Attach refs to the 8 zones, expose them to TutorialOverlay, render overlay, ghost-render SUBMIT/RESET when tutorial active | ~50 LOC delta |
| `src/components/SettingsScreen.tsx` (modified) | Add "Replay tutorial" row that calls a `onReplayTutorial` callback | ~15 LOC delta |
| `src/App.tsx` (modified) | Hold `tutorialReplayToken: number`, increment on Settings replay, thread to GameWrapper → GameView | ~10 LOC delta |
| `tests/tutorial/state.test.ts` (new) | State machine + persistence unit tests | ~80 |

**Estimated total:** ~480 LOC.

---

## Persistence

**Key:** `stacked.tutorial.v1`
**Shape:** `{ seen: boolean }`
**Defaults:** missing key = not seen.
**Migration:** none (fresh key).
**Mirror of:** `stacked.audio.v1` pattern from `src/audio/settingsStorage.ts`.

```ts
export interface TutorialState { seen: boolean; }
const STORAGE_KEY = 'stacked.tutorial.v1';
export const DEFAULT_TUTORIAL: TutorialState = { seen: false };

export function loadTutorialSeen(): boolean { ... returns parsed.seen ?? false ... }
export function setTutorialSeen(seen: boolean): void { ... writes { seen } ... }
```

---

## State machine

`useTutorial()` hook returns:
```ts
{
  visible: boolean;
  currentStep: number;  // 0..7
  totalSteps: number;   // 8
  open: () => void;
  dismiss: () => void;     // → setTutorialSeen(true), visible=false
  complete: () => void;    // → setTutorialSeen(true), visible=false (post-Done beat)
  next: () => void;         // → step++, or complete() at last
  prev: () => void;         // → step-- (clamp 0)
  jumpTo: (step: number) => void;  // dot-tap nav
}
```

**Transitions:**
- `open()`: visible=true, currentStep=0
- `next()`: if step < 7, step++; else complete()
- `prev()`: clamp to 0
- `jumpTo(n)`: clamp 0..7
- `dismiss()` / `complete()`: setTutorialSeen(true), visible=false

---

## Trigger behavior

**Auto-fire** (GameView mount effect):
```ts
useEffect(() => {
  if (currentLevelId === 1 && !loadTutorialSeen()) {
    open();
  }
}, []);  // mount-only
```

**Replay from Settings** (separate effect with token dep):
```ts
useEffect(() => {
  if (tutorialReplayToken > 0) open();
}, [tutorialReplayToken]);
```

Token starts at 0 (no-op on first mount). Settings click increments. If user is on home when replay tapped, token bumps but GameView is unmounted; next GameView mount picks up the bumped value via the dep array.

**Stays-once-seen guarantee:** any dismiss/complete writes `seen: true`. Auto-fire re-checks `loadTutorialSeen()` on every mount; will skip after the first session.

---

## Spotlight technique

Per zone: measure rect via `ref.current.getBoundingClientRect()` on each step change AND on window resize/orientation events. Cache in component state.

**Scrim:** a single fixed-inset div with `box-shadow: 0 0 0 9999px rgba(10,10,10,0.85)` projected outward from the measured zone rect. Plus an `outline: 2px solid #E8C577` (tan) drawn on the cutout div. Inset slightly to give breathing room.

**Pros:** single element, no SVG, no clip-path complications. Performs well on mobile Safari.
**Edge case:** when the spotlight zone is at the screen edge, the outline naturally clips. Acceptable.

---

## Coach card

Fixed-position panel rendered alongside the spotlight cutout.

**Contents:**
- "Step N of 8" counter (small jade label)
- Zone title (bold, white)
- Copy line (white-70)
- 8 step dots (tappable; active dot tan-filled, others jade outline)
- Skip (left, ghost text-button) + Next/Done (right, tan pill)

**Adaptive placement:**
- Compute zone rect center.
- If `centerY < windowHeight / 2` → place card below the zone (top = rect.bottom + 12).
- Else → place card above the zone (bottom = windowHeight - rect.top + 12).
- Clamp left/right within `[16, windowWidth - cardWidth - 16]`.
- Cap maxWidth ~320px for portrait mobile.

**Final mark (#8):** "Next" button label becomes "Done." Tap → brief "You're ready to play" message for ~1s, then auto-dismiss to game.

---

## Ghost SUBMIT / RESET for marks 4 + 5

The SUBMIT / RESET buttons only render under `(isPlayerTurn && hasCombo && !botCombo)` at `GameView.tsx:519`. On the initial dealt state of W1L1, `hasCombo === false`, so the buttons don't render — no rect to spotlight.

**Fix:** add a `tutorialShowGhostActions?: boolean` prop to GameView. When true, force-render the buttons; both disabled (`disabled={true}`), both with no-op `onClick`. Pure presentation — no game state altered.

```tsx
{(tutorialShowGhostActions || (isPlayerTurn && hasCombo && !botCombo)) && (
  <div style={{ display: 'flex', gap: 6 }}>
    <div ref={submitWrapRef}>
      <Btn label="SUBMIT" primary
        disabled={tutorialShowGhostActions || !comboValid || state.dumpActive}
        onClick={tutorialShowGhostActions ? () => {} : handleSubmit} />
    </div>
    <div ref={resetWrapRef}>
      <Btn label="RESET"
        disabled={tutorialShowGhostActions}
        onClick={tutorialShowGhostActions ? () => {} : actions.resetCombo} />
    </div>
  </div>
)}
```

`tutorialShowGhostActions` is set by GameView itself based on its tutorial visibility — no extra prop drilling required:

```tsx
const tutorialShowGhostActions = tutorial.visible;
```

Architecture rule check: this changes which components render but does not mutate `state` or call any `actions.*` mutators. Pure presentation.

---

## Block board interaction during overlay

The overlay's scrim div has `pointerEvents: 'auto'` over the dimmed area. Taps on the scrim (not the coach card) do nothing — they don't advance the tutorial and don't reach the underlying GameView. Coach card has explicit Skip/Next/Done buttons.

The cutout / spotlight ring also doesn't proxy clicks through to the underlying button — taps on the spotlight area also fall on the scrim (the cutout is just the cutout in box-shadow, not in event handling).

**Result:** board, hand cards, gear, anything beneath the overlay is unreachable until Skip/Next/Done.

---

## Brand tokens

Per ticket, no hardcoded hex in coach card chrome — use the existing token system. Existing tokens used in GameView:
- `JADE = '#065F46'`
- `TAN = '#E8C577'`
- `BG = '#0A0A0A'` (the near-black background)

For the coach card body, use a near-black `#1a1a1a` surface (matches SettingsScreen panel), with a tan top stripe (3px), tan accents on Next/active dot, brown text on tan pills, jade on small chrome labels. Same palette discipline as SettingsScreen.

---

## Visual spec (concrete defaults)

| Element | Style |
| ------- | ----- |
| Scrim color | `rgba(10, 10, 10, 0.85)` |
| Spotlight outline | `2px solid #E8C577` (tan), `borderRadius: 8` for non-button zones, `borderRadius: 99` (pill) for SUBMIT/RESET |
| Spotlight breathing room | `padding: 6px` inflated rect |
| Coach card surface | `#1a1a1a` with `1px solid rgba(232,197,119,0.25)` border + `3px solid #E8C577` top stripe (border-top) |
| Coach card maxWidth | 320 |
| Coach card padding | 18 |
| Coach card gap | 12 |
| Step counter font | jade (`#065F46`), Inter, 10px, letter-spacing 0.2em, fontWeight 600 |
| Zone title font | white, Inter, 16px, fontWeight 800 |
| Copy line font | rgba(255,255,255,0.75), 13px, lineHeight 1.4 |
| Step dots | active = `8px tan filled`, inactive = `6px jade outline`. Gap 6 |
| Skip button | text button, color: `rgba(255,255,255,0.5)`, fontSize 12 |
| Next / Done button | tan pill, brown text (`#72571C`), Inter, 13px, fontWeight 700, padding 8px 18px |
| Done-beat message | tan title `You're ready to play`, ~1s before auto-dismiss |

---

## Tests

`tests/tutorial/state.test.ts` — vitest, ~6 specs against pure functions:

1. `loadTutorialSeen()` returns false when key absent.
2. `setTutorialSeen(true)` round-trips: subsequent `loadTutorialSeen()` returns true.
3. Malformed JSON in key → `loadTutorialSeen()` returns false (recoverable).
4. State machine: `next()` from step 7 calls `complete()` (which sets seen=true).
5. State machine: `dismiss()` sets seen=true and `visible=false`.
6. State machine: `jumpTo(3)` sets currentStep=3.

**Honest skip per ticket:** overlay-render assertions (DOM-level visual verification). Requires React Testing Library + jsdom getBoundingClientRect mocking. Playtest covers it.

**Test count:** 332 → 338.

---

## Constraints checklist

| Constraint | Satisfied by |
| ---------- | ------------ |
| UI only, no engine touched | No `src/engine/` files modified. |
| No game-state changes | Tutorial state is React-component-local + localStorage; ghost SUBMIT/RESET are decorative (no `actions.*` calls). |
| Portrait-native, mobile-first | Coach card maxWidth 320, adaptive placement clamped to viewport. |
| Brand tokens used | JADE/TAN/BG from existing const set. |
| `tsc -b` clean | New files are typed; existing GameView/Settings/App changes typed. |
| Tests stay green | Existing tests untouched. New state-machine tests added. |
| Replay path exists | Settings "Replay tutorial" row + App-level token bump. |

---

## Open questions for TC

The ticket flagged one: "Confirm with TC if he'd rather the replay entry live on the Run home card instead." Spec proceeds with Settings placement (ticket primary instruction); will ask post-build whether to also/instead surface on the Run card.

---

## Definition of done

- `stacked.tutorial.v1` persistence works, defaults gracefully.
- 8-mark spotlight + coach card overlay mounts on top of GameView, blocks input, advances via Next, completes with Done.
- Auto-fires once on first W1L1 entry; never auto-fires again after dismiss/complete.
- Replay from Settings re-runs from step 1.
- All 8 marks land on the correct zone via measured refs.
- Coach card adapts position based on spotlight zone's vertical half.
- Ghost SUBMIT/RESET render during tutorial; no game state mutation.
- 332 → 338 tests green. `tsc -b` exit 0. Engine purity intact.
