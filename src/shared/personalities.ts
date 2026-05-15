import type { Difficulty } from '../engine/types';

export type PersonalityKey =
  | 'calvin'
  | 'talia'
  | 'nina'
  | 'rex'
  | 'jett'
  | 'mira';

export interface PersonalityProfile {
  key: PersonalityKey;
  name: string;
  difficulty: Difficulty;
  label: string;
  flavor: string;
  color: string;
  colorHex: number;
}

export const PERSONALITY_PROFILES: readonly PersonalityProfile[] = [
  {
    key: 'calvin',
    name: 'Calvin',
    difficulty: 'beginner',
    label: 'Beginner',
    flavor: 'Still learning the ropes',
    color: '#60A5FA',
    colorHex: 0x60a5fa,
  },
  {
    key: 'talia',
    name: 'Talia',
    difficulty: 'beginner',
    label: 'Teacher',
    flavor: "I'll show you some new tricks",
    color: '#60A5FA',
    colorHex: 0x60a5fa,
  },
  {
    key: 'nina',
    name: 'Nina',
    difficulty: 'intermediate',
    label: 'Intermediate',
    flavor: "Don't underestimate me",
    color: '#A78BFA',
    colorHex: 0xa78bfa,
  },
  {
    key: 'rex',
    name: 'Rex',
    difficulty: 'advanced',
    label: 'Advanced',
    flavor: 'I read every card you play',
    color: '#EF4444',
    colorHex: 0xef4444,
  },
  {
    key: 'jett',
    name: 'Jett',
    difficulty: 'expert',
    label: 'Expert',
    flavor: 'Patient, relentless',
    color: '#8B5CF6',
    colorHex: 0x8b5cf6,
  },
  {
    key: 'mira',
    name: 'Mira',
    difficulty: 'advanced',
    label: 'Advanced',
    flavor: 'Nothing gets past me',
    color: '#EF4444',
    colorHex: 0xef4444,
  },
];

export const ALL_PROFILES = PERSONALITY_PROFILES;

export function getProfile(key: PersonalityKey): PersonalityProfile {
  return PERSONALITY_PROFILES.find((p) => p.key === key) ?? PERSONALITY_PROFILES[0];
}

export function getUnlockedProfiles(
  unlockedKeys: readonly PersonalityKey[],
): PersonalityProfile[] {
  const set = new Set(unlockedKeys);
  return PERSONALITY_PROFILES.filter((p) => set.has(p.key));
}

export function profileForDifficulty(d: Difficulty): PersonalityProfile {
  return PERSONALITY_PROFILES.find((p) => p.difficulty === d) ?? PERSONALITY_PROFILES[0];
}

export function isPersonalityKey(value: string): value is PersonalityKey {
  return PERSONALITY_PROFILES.some((p) => p.key === value);
}
