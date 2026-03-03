import path from 'path';
import { describe, expect, it } from 'vitest';
import * as E from 'fp-ts/Either';
import { findFiles } from '../src/files';

const fixturesDir = path.resolve(__dirname, 'fixtures');

const run = async (pattern: string) => findFiles(pattern, fixturesDir)();

describe('findFiles', () => {
  it('finds all fixture spec files', async () => {
    const result = await run('*.spec.ts');
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    expect(result.right.length).toBeGreaterThanOrEqual(6);
    for (const file of result.right) {
      expect(file).toMatch(/\.spec\.ts$/);
    }
  });

  it('returns empty array for non-matching pattern', async () => {
    const result = await run('*.nonexistent');
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    expect(result.right).toHaveLength(0);
  });

  it('returns exactly one file for specific match', async () => {
    const result = await run('basic.spec.ts');
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    expect(result.right).toHaveLength(1);
    expect(result.right[0]).toContain('basic.spec.ts');
  });
});
