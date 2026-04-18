export interface PRNG {
  next(): number;
  nextInt(min: number, max: number): number;
  shuffle<T>(array: readonly T[]): T[];
  getSeed(): number;
}

export function createPRNG(seed: number): PRNG {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const nextInt = (min: number, max: number): number => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('nextInt bounds must be finite numbers');
    }
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) {
      throw new Error(`nextInt: max (${max}) must be >= min (${min})`);
    }
    return lo + Math.floor(next() * (hi - lo + 1));
  };

  const shuffle = <T>(array: readonly T[]): T[] => {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };

  const getSeed = (): number => state;

  return { next, nextInt, shuffle, getSeed };
}
