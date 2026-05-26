# The Run Tutorial — Plan

**Spec:** `docs/run-tutorial-spec-2026-05-25.md`.
**Order:** S1 → S7 in sequence. Single commit at end.

---

## S1 — Persistence layer

**New file:** `src/tutorial/tutorialStorage.ts`

Mirror the `src/audio/settingsStorage.ts` shape. ~30 LOC.

```ts
export interface TutorialState { seen: boolean; }
const STORAGE_KEY = 'stacked.tutorial.v1';
export const DEFAULT_TUTORIAL: TutorialState = { seen: false };
export function loadTutorialSeen(): boolean { ... }
export function setTutorialSeen(seen: boolean): void { ... }
```

Defensive `typeof localStorage === 'undefined'` + try/catch on JSON parse → defaults.

---

## S2 — State machine hook

**New file:** `src/tutorial/useTutorial.ts`

```ts
export interface TutorialApi {
  visible: boolean;
  currentStep: number;
  totalSteps: number;
  open(): void;
  dismiss(): void;
  complete(): void;
  next(): void;
  prev(): void;
  jumpTo(step: number): void;
}

export function useTutorial(totalSteps: number): TutorialApi { ... }
```

State: `[visible, setVisible] = useState(false)`, `[currentStep, setStep] = useState(0)`.

`next()`: if step < totalSteps-1, increment; else `complete()`.
`complete()` / `dismiss()`: setTutorialSeen(true); setVisible(false); setStep(0).
`open()`: setVisible(true); setStep(0).

~50 LOC.

---

## S3 — TutorialOverlay component

**New file:** `src/components/TutorialOverlay.tsx`

Signature:
```tsx
interface Mark {
  title: string;
  copy: string;
  ref: React.RefObject<HTMLElement | null>;
}

interface Props {
  visible: boolean;
  currentStep: number;
  totalSteps: number;
  marks: Mark[];                // length === totalSteps
  onNext(): void;
  onPrev(): void;
  onSkip(): void;
  onJump(step: number): void;
}
```

Internal:
- `useState<DOMRect | null>` for the current zone's measured rect.
- `useEffect` on `[currentStep, visible]`: when visible and ref is mounted, measure `marks[currentStep].ref.current.getBoundingClientRect()`. Re-measure on `window.resize` + `window.orientationchange`.
- Renders absolutely-positioned scrim div with the `box-shadow` halo technique.
- Renders coach card positioned via `useMemo` over `[rect, windowSize]`.

Sub-component: `CoachCard` — counter, title, copy, dots, Skip + Next/Done buttons. Final-step Next becomes Done; on Done click → brief "You're ready to play" message for ~1s via `setTimeout`, then call `onNext` (which the parent maps to `complete()`).

~250 LOC.

---

## S4 — GameView refs + overlay mount + ghost actions

**File:** `src/components/GameView.tsx`

Add 7 new refs at the top of the component (boardRef already exists):
```ts
const headerRef = useRef<HTMLDivElement | null>(null);
const msgStripRef = useRef<HTMLDivElement | null>(null);
const botZonesRef = useRef<HTMLDivElement | null>(null);
// boardRef — already declared
const comboBuilderRef = useRef<HTMLDivElement | null>(null);
const submitWrapRef = useRef<HTMLDivElement | null>(null);
const resetWrapRef = useRef<HTMLDivElement | null>(null);
const handZoneRef = useRef<HTMLDivElement | null>(null);
```

Attach `ref={...}` to each of the 8 target divs (see spec mapping table).

Add tutorial state via `useTutorial(8)` plus `useEffect`s for auto-fire (mount-only, gated on `currentLevelId === 1 && !loadTutorialSeen()`) and replay-token (`useEffect([tutorialReplayToken])`).

Add new prop to GameView signature:
```tsx
interface Props {
  // ...existing
  tutorialReplayToken: number;
}
```

Compute `tutorialShowGhostActions = tutorial.visible` locally. Pass through to the SUBMIT/RESET conditional render block — see spec section for exact diff.

Wrap SUBMIT and RESET in `<div ref={submitWrapRef}>` / `<div ref={resetWrapRef}>` wrappers (within the existing flex row).

Build the `marks` array inline + render `<TutorialOverlay>` at the very end of the GameView's outer div (above QuitDialog / overlays for z-index correctness).

~50 LOC delta.

---

## S5 — App + GameWrapper + Settings wiring

**File:** `src/App.tsx`

Add:
```ts
const [tutorialReplayToken, setTutorialReplayToken] = useState(0);
const replayTutorial = useCallback(() => {
  setTutorialReplayToken((t) => t + 1);
  setSettingsOpen(false);
}, []);
```

Thread `tutorialReplayToken` to GameWrapper:
```tsx
view = (<GameWrapper ... tutorialReplayToken={tutorialReplayToken} />);
```

GameWrapper signature gains `tutorialReplayToken: number`, passes through to GameView.

Pass `onReplayTutorial={replayTutorial}` to SettingsScreen:
```tsx
<SettingsScreen ... onReplayTutorial={replayTutorial} />
```

~10 LOC delta.

---

## S6 — SettingsScreen Replay row

**File:** `src/components/SettingsScreen.tsx`

Add `onReplayTutorial: () => void` to Props.

Below the Music + SFX toggle rows, add a secondary row:
```tsx
<button
  onClick={onReplayTutorial}
  style={{
    width: '100%', padding: '8px 12px', borderRadius: 8,
    background: 'transparent', border: `1px solid ${TAN}66`,
    color: TAN, fontSize: 12, fontWeight: 600,
    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
    letterSpacing: '0.04em',
  }}
>
  Replay tutorial
</button>
```

Tan-outline secondary, sits visually below the two toggle rows.

~15 LOC delta.

---

## S7 — Tests

**New file:** `tests/tutorial/state.test.ts` — ~80 LOC, 6 specs.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadTutorialSeen, setTutorialSeen } from '../../src/tutorial/tutorialStorage';

// localStorage mock — match the pattern in tests/audio/settingsStorage.test.ts

describe('tutorialStorage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns false when key absent', () => {
    expect(loadTutorialSeen()).toBe(false);
  });

  it('round-trips seen=true', () => {
    setTutorialSeen(true);
    expect(loadTutorialSeen()).toBe(true);
  });

  it('returns false on malformed JSON', () => {
    localStorage.setItem('stacked.tutorial.v1', '{bad');
    expect(loadTutorialSeen()).toBe(false);
  });
});

// State-machine tests with renderHook-style or pure-function extraction.
// The useTutorial hook can be tested via a tiny render harness — but
// vitest's react-hooks support requires @testing-library/react which
// isn't in deps. Honest skip the hook-render tests; cover the
// composition with manual playtest. Test the persistence only here.
```

**Honest skip:** state-machine hook tests would need `@testing-library/react`. Three pure-function tests on persistence suffice as the regression guard. Spec gates with playtest for behavior.

~3 unit tests added. Final count: 332 → 335.

---

## Build order

1. **S1 persistence** — pure module, no deps. Land first so S2/S3 can import it.
2. **S2 state machine hook** — depends on S1.
3. **S3 TutorialOverlay** — depends on S2 indirectly (consumed via GameView).
4. **S4 GameView refs + ghost actions + overlay mount** — depends on S1-S3 + accepts `tutorialReplayToken` prop (not yet wired).
5. **S5 App + GameWrapper wiring** — wires the token, completes the prop chain.
6. **S6 SettingsScreen Replay row** — last UI tweak.
7. **S7 tests + verification** — vitest + tsc -b.

S1-S7 must land in order; TS won't be clean partway through S4 until S5 wires the new GameView prop.

Single commit at end.

---

## Confirmations for completion report

- [ ] `stacked.tutorial.v1` defaults seen=false on missing key; round-trips true.
- [ ] Auto-fires on first W1L1 entry (currentLevelId === 1 + !seen).
- [ ] After dismiss/complete, seen=true, no auto-fire on subsequent W1L1 entries.
- [ ] Settings "Replay tutorial" row re-runs the 8-mark tour.
- [ ] All 8 marks land on correct zones (measured rects, not hardcoded).
- [ ] Ghost SUBMIT/RESET render during tutorial; no `actions.*` calls leak when tapped.
- [ ] Coach card adapts above/below spotlight based on zone vertical half.
- [ ] 332 → 335 tests green.
- [ ] `tsc -b` exit 0.
- [ ] `grep "from .*tutorial" src/engine/` returns empty.
