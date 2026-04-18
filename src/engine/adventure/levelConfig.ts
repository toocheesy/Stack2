import type { PersonalityKey } from '../../shared/personalities';

export type ComboRestriction =
  | 'pairsOnly'
  | 'noSum2'
  | 'noSum3';

export interface LevelConfig {
  id: string;
  name: string;
  worldId: number;
  targetScore: number;
  bot1: PersonalityKey;
  bot2: PersonalityKey;
  restrictions: ComboRestriction[];
  locked: boolean;
  tutorial: string;
}

export interface WorldConfig {
  id: number;
  name: string;
  description: string;
  icon: string;
  levels: LevelConfig[];
}

export interface WorldIntro {
  worldId: number;
  title: string;
  bots: { name: string; title: string }[];
  quote: string;
}

const WORLDS: WorldConfig[] = [
  {
    id: 1,
    name: 'Pair Valley',
    description: 'Match cards of the same rank.',
    icon: '🌿',
    levels: [
      {
        id: '1-1',
        name: 'First Match',
        worldId: 1,
        targetScore: 50,
        bot1: 'calvin',
        bot2: 'calvin',
        restrictions: ['pairsOnly'],
        locked: false,
        tutorial: 'Match a hand card with a board card of the same rank.',
      },
      {
        id: '1-2',
        name: 'Pair Pro',
        worldId: 1,
        targetScore: 75,
        bot1: 'calvin',
        bot2: 'calvin',
        restrictions: ['pairsOnly'],
        locked: false,
        tutorial: 'Keep pairing. Build up to a jackpot.',
      },
    ],
  },
  {
    id: 2,
    name: 'Sum Springs',
    description: 'Add cards to capture by value.',
    icon: '💧',
    levels: [
      {
        id: '2-1',
        name: 'Adding Up',
        worldId: 2,
        targetScore: 100,
        bot1: 'calvin',
        bot2: 'talia',
        restrictions: ['noSum3'],
        locked: false,
        tutorial: 'Two board cards can add up to one of your hand cards.',
      },
      {
        id: '2-2',
        name: 'Triple Threat',
        worldId: 2,
        targetScore: 125,
        bot1: 'talia',
        bot2: 'talia',
        restrictions: [],
        locked: false,
        tutorial: 'Three-card sums now count. Watch the board.',
      },
      {
        id: '2-3',
        name: 'Full Power',
        worldId: 2,
        targetScore: 150,
        bot1: 'talia',
        bot2: 'talia',
        restrictions: [],
        locked: false,
        tutorial: 'All four combo slots unlock. Play big combos.',
      },
    ],
  },
  {
    id: 3,
    name: 'Combo Canyon',
    description: 'Chain captures and manage the board.',
    icon: '🪨',
    levels: [
      {
        id: '3-1',
        name: 'Canyon Entry',
        worldId: 3,
        targetScore: 175,
        bot1: 'nina',
        bot2: 'calvin',
        restrictions: [],
        locked: false,
        tutorial: 'Nina plays solid. Deny her easy captures.',
      },
      {
        id: '3-2',
        name: 'Deep Combo',
        worldId: 3,
        targetScore: 200,
        bot1: 'nina',
        bot2: 'nina',
        restrictions: [],
        locked: false,
        tutorial: 'Two Ninas. Capture efficiently.',
      },
      {
        id: '3-3',
        name: 'Canyon Peak',
        worldId: 3,
        targetScore: 225,
        bot1: 'nina',
        bot2: 'nina',
        restrictions: [],
        locked: false,
        tutorial: 'First to 225 points wins. Stay alert.',
      },
    ],
  },
  {
    id: 4,
    name: 'Strategy Summit',
    description: 'Face the sharks. Every move matters.',
    icon: '⛰️',
    levels: [
      {
        id: '4-1',
        name: 'Rex Rising',
        worldId: 4,
        targetScore: 250,
        bot1: 'rex',
        bot2: 'nina',
        restrictions: [],
        locked: false,
        tutorial: 'Rex hunts jackpots. Defend your lastCapturer.',
      },
      {
        id: '4-2',
        name: "Jett's Speed",
        worldId: 4,
        targetScore: 275,
        bot1: 'jett',
        bot2: 'nina',
        restrictions: [],
        locked: false,
        tutorial: 'Jett reads tempo. Keep your pace.',
      },
      {
        id: '4-3',
        name: "Mira's Wall",
        worldId: 4,
        targetScore: 300,
        bot1: 'mira',
        bot2: 'rex',
        restrictions: [],
        locked: false,
        tutorial: 'Mira blocks your captures. Find the gaps.',
      },
      {
        id: '4-4',
        name: 'Summit Champion',
        worldId: 4,
        targetScore: 300,
        bot1: 'rex',
        bot2: 'mira',
        restrictions: [],
        locked: false,
        tutorial: 'Beat the two best bots. Claim the summit.',
      },
    ],
  },
  {
    id: 5,
    name: "Legend's Lair",
    description: 'Coming soon.',
    icon: '🐉',
    levels: [
      {
        id: '5-1',
        name: 'Legend I',
        worldId: 5,
        targetScore: 300,
        bot1: 'rex',
        bot2: 'mira',
        restrictions: [],
        locked: true,
        tutorial: 'Coming soon.',
      },
      {
        id: '5-2',
        name: 'Legend II',
        worldId: 5,
        targetScore: 300,
        bot1: 'jett',
        bot2: 'rex',
        restrictions: [],
        locked: true,
        tutorial: 'Coming soon.',
      },
      {
        id: '5-3',
        name: 'Legend III',
        worldId: 5,
        targetScore: 400,
        bot1: 'mira',
        bot2: 'jett',
        restrictions: [],
        locked: true,
        tutorial: 'Coming soon.',
      },
    ],
  },
  {
    id: 6,
    name: "Champion's Arena",
    description: 'Coming soon.',
    icon: '🏟️',
    levels: [
      {
        id: '6-1',
        name: 'Arena I',
        worldId: 6,
        targetScore: 400,
        bot1: 'rex',
        bot2: 'jett',
        restrictions: [],
        locked: true,
        tutorial: 'Coming soon.',
      },
      {
        id: '6-2',
        name: 'Arena II',
        worldId: 6,
        targetScore: 400,
        bot1: 'mira',
        bot2: 'rex',
        restrictions: [],
        locked: true,
        tutorial: 'Coming soon.',
      },
      {
        id: '6-3',
        name: 'Final Arena',
        worldId: 6,
        targetScore: 500,
        bot1: 'jett',
        bot2: 'mira',
        restrictions: [],
        locked: true,
        tutorial: 'Coming soon.',
      },
    ],
  },
];

export const WORLD_INTROS: WorldIntro[] = [
  {
    worldId: 1,
    title: 'Pair Valley',
    bots: [{ name: 'Calvin', title: 'The Calculator' }],
    quote: "H-hey! I'm still learning too. Let's figure this out together!",
  },
  {
    worldId: 2,
    title: 'Sum Springs',
    bots: [{ name: 'Talia', title: 'The Teacher' }],
    quote: "Welcome! I'll show you some new tricks. Pay attention!",
  },
  {
    worldId: 3,
    title: 'Combo Canyon',
    bots: [{ name: 'Nina', title: 'The Natural' }],
    quote: "Hope you've been practicing. I don't go easy.",
  },
  {
    worldId: 4,
    title: 'Strategy Summit',
    bots: [
      { name: 'Rex', title: 'The Shark' },
      { name: 'Jett', title: 'The Blitz' },
      { name: 'Mira', title: 'The Guardian' },
    ],
    quote: 'The summit awaits. Three new challengers stand in your way.',
  },
];

export function getAllWorlds(): WorldConfig[] {
  return WORLDS;
}

export function getWorld(worldId: number): WorldConfig | null {
  return WORLDS.find((w) => w.id === worldId) ?? null;
}

export function getAllLevels(): LevelConfig[] {
  return WORLDS.flatMap((w) => w.levels);
}

export function getLevel(levelId: string): LevelConfig | null {
  for (const w of WORLDS) {
    const l = w.levels.find((lv) => lv.id === levelId);
    if (l) return l;
  }
  return null;
}

export function getNextLevel(levelId: string): string | null {
  const all = getAllLevels();
  const idx = all.findIndex((l) => l.id === levelId);
  if (idx === -1 || idx === all.length - 1) return null;
  return all[idx + 1].id;
}

export function isWorldLocked(worldId: number): boolean {
  const world = getWorld(worldId);
  if (!world) return true;
  return world.levels.every((l) => l.locked);
}

export function getWorldIntro(worldId: number): WorldIntro | null {
  return WORLD_INTROS.find((i) => i.worldId === worldId) ?? null;
}

export function getLevelIndex(levelId: string): number {
  return getAllLevels().findIndex((l) => l.id === levelId);
}

export function getPreviousLevelId(levelId: string): string | null {
  const idx = getLevelIndex(levelId);
  if (idx <= 0) return null;
  return getAllLevels()[idx - 1].id;
}
