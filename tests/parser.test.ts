import path from 'path';
import { describe, expect, it } from 'vitest';
import * as E from 'fp-ts/Either';
import { parseFile } from '../src/parser';

const fixture = (name: string) =>
  path.resolve(__dirname, 'fixtures', name);

const run = async (filePath: string) => parseFile(filePath)();

describe('parseFile', () => {
  it('parses a basic test', async () => {
    const result = await run(fixture('basic.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.tests).toHaveLength(1);
    expect(doc.tests[0].name).toBe('example test');
    expect(doc.tests[0].line).toBe(3);
    expect(doc.tests[0].modifier).toBeNull();
    expect(doc.describes).toHaveLength(0);
  });

  it('parses test modifiers', async () => {
    const result = await run(fixture('modifiers.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.tests).toHaveLength(5);

    const modifiers = doc.tests.map(t => t.modifier);
    expect(modifiers).toEqual(['skip', 'only', 'fixme', 'fail', 'slow']);
  });

  it('parses nested describe blocks', async () => {
    const result = await run(fixture('describes.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.describes).toHaveLength(3);

    const outer = doc.describes[0];
    expect(outer.name).toBe('outer group');
    expect(outer.modifier).toBeNull();
    expect(outer.tests).toHaveLength(1);
    expect(outer.tests[0].name).toBe('inner test');
    expect(outer.describes).toHaveLength(1);
    expect(outer.describes[0].name).toBe('nested group');
    expect(outer.describes[0].tests[0].name).toBe('deeply nested');

    expect(doc.describes[1].name).toBe('parallel group');
    expect(doc.describes[1].modifier).toBe('parallel');

    expect(doc.describes[2].name).toBe('serial group');
    expect(doc.describes[2].modifier).toBe('serial');
  });

  it('parses test steps including nested steps', async () => {
    const result = await run(fixture('steps.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.tests).toHaveLength(1);

    const steps = doc.tests[0].steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].name).toBe('step one');
    expect(steps[0].steps).toHaveLength(1);
    expect(steps[0].steps[0].name).toBe('nested step');
    expect(steps[1].name).toBe('step two');
    expect(steps[1].steps).toHaveLength(0);
  });

  it('parses tests with custom/extended test identifier', async () => {
    const result = await run(fixture('custom-id.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.tests).toHaveLength(1);
    expect(doc.tests[0].name).toBe('custom fixture test');
  });

  it('returns empty arrays for file with no tests', async () => {
    const result = await run(fixture('empty.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.tests).toHaveLength(0);
    expect(doc.describes).toHaveLength(0);
  });

  it('parses template literals with interpolations', async () => {
    const result = await run(fixture('template-literals.spec.ts'));
    expect(E.isRight(result)).toBe(true);
    if (!E.isRight(result)) return;

    const doc = result.right;
    expect(doc.describes).toHaveLength(1);
    expect(doc.describes[0].name).toBe('group for ${item}');
    expect(doc.describes[0].tests).toHaveLength(1);
    expect(doc.describes[0].tests[0].name).toBe('should handle ${item}');
    expect(doc.describes[0].tests[0].steps).toHaveLength(1);
    expect(doc.describes[0].tests[0].steps[0].name).toBe('step with ${item}');

    expect(doc.tests).toHaveLength(1);
    expect(doc.tests[0].name).toBe('top-level test for ${item}');
  });

  it('returns Left with FileReadError for missing file', async () => {
    const result = await run(fixture('nonexistent.spec.ts'));
    expect(E.isLeft(result)).toBe(true);
    if (!E.isLeft(result)) return;

    expect(result.left.tag).toBe('FileReadError');
  });
});
