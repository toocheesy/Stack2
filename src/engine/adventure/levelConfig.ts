import type { Difficulty } from '../types';

export interface Level {
  id: number;
  world: number;
  worldName: string;
  targetScore: number;
  bots: [Difficulty, Difficulty];
}

const WORLD_NAMES: Record<number, string> = {
  1: 'Calvin Country',
  2: 'Two on the Field',
  3: 'Meet Nina',
  4: 'Pressure',
  5: 'Meet Rex',
  6: 'Final Boss',
};

export const LEVELS: readonly Level[] = [
  // World 1 — Calvin Country
  { id: 1,  world: 1, worldName: WORLD_NAMES[1], targetScore: 50,  bots: ['beginner', 'beginner'] },
  { id: 2,  world: 1, worldName: WORLD_NAMES[1], targetScore: 100, bots: ['beginner', 'beginner'] },
  { id: 3,  world: 1, worldName: WORLD_NAMES[1], targetScore: 150, bots: ['beginner', 'beginner'] },

  // World 2 — Two on the Field
  { id: 4,  world: 2, worldName: WORLD_NAMES[2], targetScore: 100, bots: ['beginner', 'beginner'] },
  { id: 5,  world: 2, worldName: WORLD_NAMES[2], targetScore: 150, bots: ['beginner', 'beginner'] },
  { id: 6,  world: 2, worldName: WORLD_NAMES[2], targetScore: 200, bots: ['beginner', 'beginner'] },

  // World 3 — Meet Nina
  { id: 7,  world: 3, worldName: WORLD_NAMES[3], targetScore: 150, bots: ['beginner', 'intermediate'] },
  { id: 8,  world: 3, worldName: WORLD_NAMES[3], targetScore: 200, bots: ['beginner', 'intermediate'] },
  { id: 9,  world: 3, worldName: WORLD_NAMES[3], targetScore: 200, bots: ['intermediate', 'intermediate'] },

  // World 4 — Pressure
  { id: 10, world: 4, worldName: WORLD_NAMES[4], targetScore: 250, bots: ['intermediate', 'intermediate'] },
  { id: 11, world: 4, worldName: WORLD_NAMES[4], targetScore: 300, bots: ['intermediate', 'intermediate'] },
  { id: 12, world: 4, worldName: WORLD_NAMES[4], targetScore: 250, bots: ['beginner', 'advanced'] },

  // World 5 — Meet Rex
  { id: 13, world: 5, worldName: WORLD_NAMES[5], targetScore: 250, bots: ['intermediate', 'advanced'] },
  { id: 14, world: 5, worldName: WORLD_NAMES[5], targetScore: 300, bots: ['intermediate', 'advanced'] },
  { id: 15, world: 5, worldName: WORLD_NAMES[5], targetScore: 250, bots: ['advanced', 'advanced'] },

  // World 6 — Final Boss
  { id: 16, world: 6, worldName: WORLD_NAMES[6], targetScore: 300, bots: ['advanced', 'advanced'] },
  { id: 17, world: 6, worldName: WORLD_NAMES[6], targetScore: 400, bots: ['advanced', 'advanced'] },
  { id: 18, world: 6, worldName: WORLD_NAMES[6], targetScore: 500, bots: ['advanced', 'advanced'] },
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
