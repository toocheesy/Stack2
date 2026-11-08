import { describe, it, expect } from 'vitest';

// One home for every colour (D-007 release 1): no file under src outside
// src/config/colors.ts holds a colour value. Every .ts, .tsx and .css file
// under src is read as text and checked with the release's own pattern:
// a hex colour or an rgb()/rgba() call.
const SOURCES = import.meta.glob<string>(
  ['/src/**/*.ts', '/src/**/*.tsx', '/src/**/*.css'],
  { query: '?raw', import: 'default', eager: true },
);

const HOME = '/src/config/colors.ts';
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

describe('one colour home (D-007)', () => {
  it('reads the source files, the home among them', () => {
    const paths = Object.keys(SOURCES);
    expect(paths.length).toBeGreaterThan(20);
    expect(paths).toContain(HOME);
    expect(paths).toContain('/src/components/Card.tsx');
    expect(paths).toContain('/src/index.css');
  });

  it('the home holds the colours', () => {
    expect(SOURCES[HOME].match(COLOUR)?.length ?? 0).toBeGreaterThan(10);
  });

  it('no other file under src holds a colour value', () => {
    const hits: string[] = [];
    for (const [path, text] of Object.entries(SOURCES)) {
      if (path === HOME) continue;
      text.split('\n').forEach((line, i) => {
        const found = line.match(COLOUR);
        if (found) hits.push(`${path}:${i + 1}: ${found.join(' ')}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
