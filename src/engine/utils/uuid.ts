import type { PRNG } from './prng';

export interface IdGenerator {
  generateCardId(): string;
  generatePlayerId(): string;
  generateGameId(): string;
}

const HEX_LENGTH = 6;

function randomHex(prng: PRNG, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += prng.nextInt(0, 15).toString(16);
  }
  return out;
}

export function createIdGenerator(prng: PRNG): IdGenerator {
  return {
    generateCardId: () => `card_${randomHex(prng, HEX_LENGTH)}`,
    generatePlayerId: () => `player_${randomHex(prng, HEX_LENGTH)}`,
    generateGameId: () => `game_${randomHex(prng, HEX_LENGTH)}`,
  };
}
