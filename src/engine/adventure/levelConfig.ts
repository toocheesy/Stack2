import type { Difficulty } from '../types';

export interface Level {
  id: number;
  world: 1 | 2 | 3 | 4;
  levelInWorld: 1 | 2 | 3;
  worldName: string;
  displayId: string;
  title: string;
  bots: [Difficulty, Difficulty];
  targetScore: number;
  hintStripEnabled: boolean;
  turnOrderSwap: false;
}

const WORLD_NAMES: Record<number, string> = {
  1: 'The Base',
  2: 'The Build',
  3: 'The Heights',
  4: 'The Summit',
};

export const TOTAL_WORLDS = 4;
export const LEVELS_PER_WORLD = 3;
export const TOTAL_LEVELS = TOTAL_WORLDS * LEVELS_PER_WORLD;

export const LEVELS: readonly Level[] = [
  // W1 — The Base (Calvin training, hints ON)
  { id: 1,  world: 1, levelInWorld: 1, worldName: WORLD_NAMES[1], displayId: '1-1', title: 'The Base 1',    bots: ['beginner',     'beginner'    ], targetScore: 100, hintStripEnabled: true,  turnOrderSwap: false },
  { id: 2,  world: 1, levelInWorld: 2, worldName: WORLD_NAMES[1], displayId: '1-2', title: 'The Base 2',    bots: ['beginner',     'beginner'    ], targetScore: 150, hintStripEnabled: true,  turnOrderSwap: false },
  { id: 3,  world: 1, levelInWorld: 3, worldName: WORLD_NAMES[1], displayId: '1-3', title: 'The Base 3',    bots: ['beginner',     'beginner'    ], targetScore: 200, hintStripEnabled: true,  turnOrderSwap: false },

  // W2 — The Build (Nina enters, hints ON)
  { id: 4,  world: 2, levelInWorld: 1, worldName: WORLD_NAMES[2], displayId: '2-1', title: 'The Build 1',   bots: ['beginner',     'intermediate'], targetScore: 200, hintStripEnabled: true,  turnOrderSwap: false },
  { id: 5,  world: 2, levelInWorld: 2, worldName: WORLD_NAMES[2], displayId: '2-2', title: 'The Build 2',   bots: ['intermediate', 'intermediate'], targetScore: 250, hintStripEnabled: true,  turnOrderSwap: false },
  { id: 6,  world: 2, levelInWorld: 3, worldName: WORLD_NAMES[2], displayId: '2-3', title: 'The Build 3',   bots: ['intermediate', 'intermediate'], targetScore: 300, hintStripEnabled: true,  turnOrderSwap: false },

  // W3 — The Heights (Rex enters, hints OFF)
  { id: 7,  world: 3, levelInWorld: 1, worldName: WORLD_NAMES[3], displayId: '3-1', title: 'The Heights 1', bots: ['intermediate', 'advanced'    ], targetScore: 250, hintStripEnabled: false, turnOrderSwap: false },
  { id: 8,  world: 3, levelInWorld: 2, worldName: WORLD_NAMES[3], displayId: '3-2', title: 'The Heights 2', bots: ['advanced',     'advanced'    ], targetScore: 300, hintStripEnabled: false, turnOrderSwap: false },
  { id: 9,  world: 3, levelInWorld: 3, worldName: WORLD_NAMES[3], displayId: '3-3', title: 'Final Hunt',    bots: ['advanced',     'advanced'    ], targetScore: 400, hintStripEnabled: false, turnOrderSwap: false },

  // W4 — The Summit (Jett enters, hints OFF; W4 L3 unlocks Jett in Classic)
  { id: 10, world: 4, levelInWorld: 1, worldName: WORLD_NAMES[4], displayId: '4-1', title: 'The Summit 1',  bots: ['advanced',     'expert'      ], targetScore: 300, hintStripEnabled: false, turnOrderSwap: false },
  { id: 11, world: 4, levelInWorld: 2, worldName: WORLD_NAMES[4], displayId: '4-2', title: 'The Summit 2',  bots: ['intermediate', 'expert'      ], targetScore: 350, hintStripEnabled: false, turnOrderSwap: false },
  { id: 12, world: 4, levelInWorld: 3, worldName: WORLD_NAMES[4], displayId: '4-3', title: 'Final Boss',    bots: ['advanced',     'expert'      ], targetScore: 400, hintStripEnabled: false, turnOrderSwap: false },
];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getLevelsForWorld(world: number): Level[] {
  return LEVELS.filter((l) => l.world === world);
}

export function getWorldName(world: number): string {
  return WORLD_NAMES[world] ?? '';
}

export function getDisplayId(id: number): string {
  return getLevel(id)?.displayId ?? `${id}`;
}
