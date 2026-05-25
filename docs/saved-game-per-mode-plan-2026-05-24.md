# Home-Screen Saved-Game Per-Mode Split — Plan

**Spec:** `docs/saved-game-per-mode-spec-2026-05-24.md`.
**Order:** strict — each step lands before the next so TS stays green. Single commit at the end.

---

## S1 — Persistence v3 + currentLevelId

**File:** `src/game/persistence.ts`

- Bump `SCHEMA_VERSION = 3`.
- Add `currentLevelId: number | null` to `PersistedSnapshot`.
- Add `currentLevelId: number | null` to `LoadedSave`.
- `saveGame(state, tracker, currentLevelId)` — accept the third arg, write to snapshot.
- `loadGame()` — extract `currentLevelId` from parsed snapshot; default to `null` for v2 or pre-v2 (legacy) saves.

**Test fixture migration:** any direct `saveGame(s, t)` calls in tests/ need a third arg. Add `null` default at call sites OR write a tiny `save()` helper in `tests/game/persistence.test.ts` that wraps with `null`.

---

## S2 — Controller threads currentLevelId

**File:** `src/game/useGameController.ts`

- Add third positional param `currentLevelId: number | null`.
- Capture via `useRef` so the latest value flows to every `setAndPersist`.
- `saveGame(s, trackerRef.current, currentLevelIdRef.current)` at the existing site.

---

## S3 — App imports + savedSnapshot

**File:** `src/App.tsx`

- Replace `import { loadGame, clearSavedGame } from './game/persistence';` (already there).
- Inside `App()`:
  - Read `const savedSnapshot = loadGame();` (replaces the conditional `hasSave = !!loadGame()` inside the home-screen branch — promote to top so all paths can use it).
  - Derive `const savedIsClassic = savedSnapshot && savedSnapshot.currentLevelId === null;`.
  - Derive `const savedRunLevelId = savedSnapshot?.currentLevelId ?? null;` (number-typed for ChapterMap).

---

## S4 — App handlers

**File:** `src/App.tsx`

Add two callbacks:

```ts
const continueClassic = useCallback(() => {
  setCurrentLevelId(null);
  setScreen('game');
}, []);

const continueRunFromMap = useCallback((levelId: number) => {
  setCurrentLevelId(levelId);
  setSettings(settingsForLevel(levelId));
  setScreen('game');
}, [settingsForLevel]);
```

Delete the old `continueGame` callback (line ~50 before this track; replaced by `continueClassic`).

---

## S5 — GameWrapper passes currentLevelId

**File:** `src/App.tsx` (`GameWrapper` component)

`const { ... } = useGameController(seed, settings, currentLevelId);` — pass the existing `currentLevelId` prop through.

---

## S6 — Kill global Continue link + Run descriptor fix

**File:** `src/App.tsx` (`TitleScreen` component)

- Remove the `onContinue?: () => void` prop entirely from `TitleScreen` signature.
- Remove the footer Continue block (it's the only remaining footer element after S3 of the Settings Gear track — TitleScreen's footer becomes empty / removed).
- Remove the `onContinue={hasSave ? continueGame : undefined}` from the TitleScreen render in `App`.

**Run descriptor fix** (in `AdventureHeroCard`):

Current code (around line 419-426 in the current App.tsx — needs precise location at edit time):

```tsx
{returning ? (
  <><span style={{ color: TAN, fontWeight: 600 }}>Resume your run</span><br/>...</>
) : (
  <><span style={{ color: TAN, fontWeight: 600 }}>{TOTAL_LEVELS} levels</span><br/>...</>
)}
```

Replace with three-way branch on `runStatus`:

```tsx
{runStatus === 'complete' ? (
  <><span style={{ color: TAN, fontWeight: 600 }}>Run complete</span><br/>
    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Start a fresh run</span></>
) : runStatus === 'in-progress' ? (
  <><span style={{ color: TAN, fontWeight: 600 }}>Resume your run</span><br/>
    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{TOTAL_LEVELS} levels · 4 worlds</span></>
) : (
  <><span style={{ color: TAN, fontWeight: 600 }}>{TOTAL_LEVELS} levels</span><br/>
    <span style={{ color: 'rgba(255,255,255,0.5)' }}>4 worlds to conquer</span></>
)}
```

`returning` variable becomes obsolete; remove the assignment line if it was just for this descriptor (else leave it).

---

## S7 — ClassicHeroCard Continue affordance

**File:** `src/App.tsx` (`ClassicHeroCard` component)

Signature change:
```tsx
function ClassicHeroCard({ onPlay, onContinue }: { onPlay: () => void; onContinue?: () => void }) {
```

Inside the bottom row (existing structure: `[descriptor maxWidth:60%] [PLAY pill]`), inject a Continue pill between them when `onContinue` is defined:

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', marginTop: 14 }}>
  <div style={{ /* existing descriptor */ }}>...</div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {onContinue && (
      <button
        onClick={(e) => { e.stopPropagation(); onContinue(); }}
        style={{
          fontWeight: 700, fontSize: 11, color: TAN, background: 'transparent',
          padding: '8px 14px', borderRadius: 99, letterSpacing: '0.06em',
          border: `1px solid ${TAN}66`, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        CONTINUE
      </button>
    )}
    <div style={{ /* existing PLAY pill */ }}>...</div>
  </div>
</div>
```

Update the render in `App`'s TitleScreen body:
```tsx
<ClassicHeroCard onPlay={onNewGame} onContinue={savedIsClassic ? continueClassic : undefined} />
```

Pass `onContinue` from `TitleScreen` props down. TitleScreen signature gains `onContinue?: () => void`.

---

## S8 — ChapterMap Resume Level N callout

**File:** `src/components/ChapterMap.tsx`

Signature change:
```tsx
interface Props {
  onBack: () => void;
  onSelectLevel: (levelId: number) => void;
  savedRunLevelId?: number | null;
  onResumeRun?: (levelId: number) => void;
}
```

When both `savedRunLevelId !== null` and `onResumeRun` are defined, render a callout banner above the existing bottom level card:

```tsx
{/* Mid-match resume callout (per-mode split) */}
{savedRunLevelId !== null && savedRunLevelId !== undefined && onResumeRun && (() => {
  const savedLevel = NODES.find((n) => n.id === savedRunLevelId);
  if (!savedLevel) return null;
  return (
    <div
      onClick={() => onResumeRun(savedRunLevelId)}
      style={{
        margin: '0 20px 12px', padding: '10px 16px',
        background: 'rgba(245,158,11,0.12)', borderRadius: 12,
        border: '1px solid rgba(245,158,11,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', gap: 12,
        position: 'relative', zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#F59E0B',
          letterSpacing: '0.18em', fontWeight: 600,
        }}>
          IN PROGRESS
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginTop: 2 }}>
          Resume {savedLevel.displayId} · {savedLevel.title}
        </span>
      </div>
      <span style={{ color: '#F59E0B', fontSize: 18, fontWeight: 700 }}>→</span>
    </div>
  );
})()}
```

Position: between the map area (`</div>` closing map at line ~149) and the bottom level card (line ~152).

Update App's ChapterMap render:
```tsx
<ChapterMap
  onBack={() => setScreen('home')}
  onSelectLevel={(id) => { ... existing }}
  savedRunLevelId={savedRunLevelId}
  onResumeRun={continueRunFromMap}
/>
```

---

## S9 — Update persistence tests

**File:** `tests/game/persistence.test.ts`

1. **Add helper** near the top of the describe block:
   ```ts
   const saveWithCurrent = (s: GameState, t: CardTrackerState, lvl: number | null = null) => saveGame(s, t, lvl);
   ```
2. **Replace every `saveGame(s, freshTracker(s))`** call in existing specs with the helper (or just add `, null` to each `saveGame` call inline — easier). ~5-6 call sites.
3. **Add 3 new specs** in a new describe block "currentLevelId per-mode split (v3)":
   - `'saveGame writes currentLevelId and loadGame returns it'` — `saveGame(s, t, 5)`, expect `loaded.currentLevelId === 5`.
   - `'saveGame with null currentLevelId round-trips as null'` — explicit Classic case.
   - `'v2 migration: legacy v2 snapshot (no currentLevelId) loads with null'` — write `{ version: 2, game, tracker: toWire(...) }` manually to localStorage; load; expect `currentLevelId === null`.

For the v2 migration test, manually constructing the wire shape requires access to `toWire` which isn't exported. Simpler: use `saveGame(s, t, 5)` to create a v3 snapshot, then mutate localStorage to remove the `version` field and the `currentLevelId` field, simulating a v2 save. Or just construct the JSON inline:

```ts
const wireTracker = {
  seenCardsEntries: [],
  valueCounts: { ... },
  playerCaptures: [[], [], []],
  deckRemaining: 0,
  totalSeen: 0,
  gamePhase: 'early',
};
localStorage.setItem(STORAGE_KEY, JSON.stringify({
  version: 2,
  game: fullState(),
  tracker: wireTracker,
}));
const loaded = loadGame();
expect(loaded!.currentLevelId).toBeNull();
```

---

## S10 — Vitest + tsc -b verification

1. Run `npx tsc -b` — confirm exit 0.
2. Run `npx vitest run` — confirm 328 → 331 green.

---

## Order summary

S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10.

S1 is the type-changing root (`saveGame` signature). All later steps depend on it but won't compile cleanly until S2 lands (controller passes the new arg). Sequence is mandatory; no parallelization possible without breaking interim TS.

Each step ~5-30 LOC. Total estimate: ~80-120 LOC + 3 tests.

Single commit at the end after tests + tsc -b green.
