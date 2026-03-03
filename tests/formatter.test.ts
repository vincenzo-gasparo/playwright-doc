import { describe, expect, it } from 'vitest';
import { formatMarkdown, formatMarkdownSingle } from '../src/formatter';
import type { FileDoc } from '../src/types';

describe('formatMarkdown', () => {
  it('renders a single test', () => {
    const docs: FileDoc[] = [{
      path: '/project/tests/example.spec.ts',
      describes: [],
      tests: [{ name: 'my test', modifier: null, line: 5, steps: [] }],
    }];

    const md = formatMarkdown(docs, '/project');
    expect(md).toContain('# Test Documentation');
    expect(md).toContain('## tests/example.spec.ts');
    expect(md).toContain('**test**: my test');
    expect(md).toContain('`(line 5)`');
  });

  it('renders modifier badges', () => {
    const docs: FileDoc[] = [{
      path: '/project/a.spec.ts',
      describes: [],
      tests: [
        { name: 'skipped', modifier: 'skip', line: 1, steps: [] },
        { name: 'focused', modifier: 'only', line: 2, steps: [] },
      ],
    }];

    const md = formatMarkdown(docs, '/project');
    expect(md).toContain('`[skip]`');
    expect(md).toContain('`[only]`');
  });

  it('renders nested describe blocks with increasing heading depth', () => {
    const docs: FileDoc[] = [{
      path: '/project/nested.spec.ts',
      describes: [{
        name: 'outer',
        modifier: null,
        line: 1,
        describes: [{
          name: 'inner',
          modifier: 'parallel',
          line: 6,
          describes: [],
          tests: [{ name: 'deep test', modifier: null, line: 7, steps: [] }],
        }],
        tests: [{ name: 'sibling test', modifier: null, line: 4, steps: [] }],
      }],
      tests: [],
    }];

    const md = formatMarkdown(docs, '/project');
    // describes are wrapped in blockquotes
    expect(md).toContain('> ### describe: outer');
    expect(md).toContain('> > #### describe: inner `[parallel]`');
    // nested test is quoted at depth 2
    expect(md).toContain('> > - **test**: deep test');
    // sibling test is quoted at depth 1
    expect(md).toContain('> - **test**: sibling test');

    // sibling test (line 4) should appear before nested group (line 6)
    const siblingIdx = md.indexOf('sibling test');
    const innerIdx = md.indexOf('describe: inner');
    expect(siblingIdx).toBeLessThan(innerIdx);
  });

  it('renders test steps with indentation', () => {
    const docs: FileDoc[] = [{
      path: '/project/steps.spec.ts',
      describes: [],
      tests: [{
        name: 'with steps',
        modifier: null,
        line: 1,
        steps: [
          { name: 'first step', steps: [{ name: 'nested', steps: [] }] },
          { name: 'second step', steps: [] },
        ],
      }],
    }];

    const md = formatMarkdown(docs, '/project');
    expect(md).toContain('- step: first step');
    expect(md).toContain('  - step: nested');
    expect(md).toContain('- step: second step');
  });

  it('renders multiple files with separate headings', () => {
    const docs: FileDoc[] = [
      { path: '/project/a.spec.ts', describes: [], tests: [{ name: 'test a', modifier: null, line: 1, steps: [] }] },
      { path: '/project/b.spec.ts', describes: [], tests: [{ name: 'test b', modifier: null, line: 1, steps: [] }] },
    ];

    const md = formatMarkdown(docs, '/project');
    expect(md).toContain('## a.spec.ts');
    expect(md).toContain('## b.spec.ts');
  });

  it('renders minimal output for empty docs', () => {
    const md = formatMarkdown([], '/project');
    expect(md).toContain('# Test Documentation');
    expect(md.trim()).toBe('# Test Documentation');
  });
});

describe('formatMarkdownSingle', () => {
  it('uses h1 for the file path instead of h2', () => {
    const doc: FileDoc = {
      path: '/project/tests/example.spec.ts',
      describes: [],
      tests: [{ name: 'my test', modifier: null, line: 5, steps: [] }],
    };

    const md = formatMarkdownSingle(doc, '/project');
    expect(md).toContain('# tests/example.spec.ts');
    expect(md).not.toContain('## tests/example.spec.ts');
  });

  it('does not include "Test Documentation" header', () => {
    const doc: FileDoc = {
      path: '/project/a.spec.ts',
      describes: [],
      tests: [{ name: 'a test', modifier: null, line: 1, steps: [] }],
    };

    const md = formatMarkdownSingle(doc, '/project');
    expect(md).not.toContain('Test Documentation');
  });

  it('renders describes at h2 depth instead of h3', () => {
    const doc: FileDoc = {
      path: '/project/nested.spec.ts',
      describes: [{
        name: 'outer',
        modifier: null,
        line: 1,
        describes: [{
          name: 'inner',
          modifier: null,
          line: 5,
          describes: [],
          tests: [{ name: 'deep', modifier: null, line: 6, steps: [] }],
        }],
        tests: [],
      }],
      tests: [],
    };

    const md = formatMarkdownSingle(doc, '/project');
    expect(md).toContain('> ## describe: outer');
    expect(md).toContain('> > ### describe: inner');
  });

  it('renders tests and steps correctly', () => {
    const doc: FileDoc = {
      path: '/project/steps.spec.ts',
      describes: [],
      tests: [{
        name: 'with steps',
        modifier: 'skip',
        line: 3,
        steps: [{ name: 'do something', steps: [] }],
      }],
    };

    const md = formatMarkdownSingle(doc, '/project');
    expect(md).toContain('**test**: with steps');
    expect(md).toContain('`[skip]`');
    expect(md).toContain('- step: do something');
  });
});
