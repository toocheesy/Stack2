import { describe, expect, it } from 'vitest';
import type { Difficulty, GameSettings, Rank } from '../../../src/engine/types';
import { RANKS } from '../../../src/engine/types';
import { readCardMemory } from '../../../src/engine/ai/cardTracker';
import { createDeck } from '../../../src/engine/utils/deck';
import { playGame } from './runner';

// S-008: the bots' card memory, read from the game state, checked at every
// step of 400 full games (after every move and after every end-of-round
// sweep). The four bot personalities are spread over the seeds.
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);
const LONG_TEST_MS = 120_000;

function settingsFor(seed: number): GameSettings {
  return {
    targetScore: 100,
    bot1Personality: DIFFICULTIES[seed % 4],
    bot2Personality: DIFFICULTIES[(seed >> 2) % 4],
  };
}

const RANK_OF = new Map<string, Rank>(createDeck().map((c) => [c.id, c.rank]));

describe('the bots\' card memory over 400 full games (S-008)', () => {
  it("the bots' memory never passes 52 cards in a round", () => {
    let steps = 0;
    let highest = 0;
    const over: string[] = [];
    for (const seed of SEEDS) {
      playGame(seed, settingsFor(seed), {
        onStep: (state) => {
          steps++;
          const seen = readCardMemory(state).totalSeen;
          if (seen > highest) highest = seen;
          if (seen > 52 && over.length < 20) over.push(`seed ${seed} round ${state.currentRound}: ${seen}`);
        },
      });
    }
    expect(steps).toBeGreaterThan(0);
    expect(over).toEqual([]);
    expect(highest).toBe(52);
  }, LONG_TEST_MS);

  it("the bots' memory stays in step with the board and this round's captures", () => {
    let steps = 0;
    const mismatches: string[] = [];
    for (const seed of SEEDS) {
      playGame(seed, settingsFor(seed), {
        onStep: (state, capturedThisRound) => {
          steps++;
          const memory = readCardMemory(state);
          const onTable: Record<string, number> = {};
          for (const r of RANKS) onTable[r] = 0;
          for (const c of state.board) onTable[c.rank] += 1;
          for (const id of capturedThisRound) onTable[RANK_OF.get(id)!] += 1;
          for (const r of RANKS) {
            if (memory.valueCounts[r] !== onTable[r] && mismatches.length < 20) {
              mismatches.push(`seed ${seed} round ${state.currentRound} rank ${r}: memory ${memory.valueCounts[r]}, table ${onTable[r]}`);
            }
          }
          if (memory.deckRemaining !== state.deck.length && mismatches.length < 20) {
            mismatches.push(`seed ${seed} round ${state.currentRound}: deckRemaining ${memory.deckRemaining}, deck ${state.deck.length}`);
          }
        },
      });
    }
    expect(steps).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  }, LONG_TEST_MS);
});
