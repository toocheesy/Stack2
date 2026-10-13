import { describe, it, expect } from 'vitest';

// The engine never touches the browser (Arch 1, TC 2026-09-19; S-007).
// Every source file under src/engine is read as text; test folders are left out.
const ENGINE_SOURCES = import.meta.glob<string>(
  ['/src/engine/**/*.ts', '!/src/engine/**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
);

// The one named exception: the frozen Run's progress file, until the new Run replaces it (S-007).
const EXCEPTIONS = new Set(['/src/engine/adventure/progressManager.ts']);

const BROWSER_NAMES = /\b(window|document|localStorage|sessionStorage|navigator|indexedDB)\b/;

describe('engine has no browser (S-007)', () => {
  it('reads the engine source files', () => {
    expect(Object.keys(ENGINE_SOURCES).length).toBeGreaterThan(10);
    expect(Object.keys(ENGINE_SOURCES)).toContain('/src/engine/core/turnManager.ts');
  });

  it('no engine source file names a browser global', () => {
    const hits: string[] = [];
    for (const [path, text] of Object.entries(ENGINE_SOURCES)) {
      if (EXCEPTIONS.has(path)) continue;
      text.split('\n').forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
        if (BROWSER_NAMES.test(code)) hits.push(`${path}:${i + 1}: ${code}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('the exception file still exists', () => {
    for (const path of EXCEPTIONS) expect(Object.keys(ENGINE_SOURCES)).toContain(path);
  });
});
