import { describe, expect, it } from 'vitest';
import { formatYaml, formatYamlSingle } from '../src/formatter-yaml';
import type { FileDoc } from '../src/types';

describe('formatYaml', () => {
  it('renders a simple test as a plain string', () => {
    const docs: FileDoc[] = [{
      path: '/project/tests/example.spec.ts',
      describes: [],
      tests: [{ name: 'my test', modifier: null, line: 5, steps: [] }],
    }];

    expect(formatYaml(docs, '/project')).toBe(
      'tests/example.spec.ts:\n' +
      '  - my test\n',
    );
  });

  it('uses object format only for tests with metadata', () => {
    const docs: FileDoc[] = [{
      path: '/project/a.spec.ts',
      describes: [],
      tests: [
        { name: 'skipped', modifier: 'skip', line: 1, steps: [] },
        { name: 'normal', modifier: null, line: 2, steps: [] },
      ],
    }];

    const yaml = formatYaml(docs, '/project');
    expect(yaml).toContain('- name: skipped');
    expect(yaml).toContain('  modifier: skip');
    expect(yaml).toContain('- normal');
    expect(yaml).not.toMatch(/name: normal/);
  });

  it('renders describes as mapping keys', () => {
    const docs: FileDoc[] = [{
      path: '/project/a.spec.ts',
      describes: [{
        name: 'Auth',
        modifier: null,
        line: 1,
        describes: [],
        tests: [{ name: 'logs in', modifier: null, line: 2, steps: [] }],
      }],
      tests: [],
    }];

    expect(formatYaml(docs, '/project')).toBe(
      'a.spec.ts:\n' +
      '  Auth:\n' +
      '    - logs in\n',
    );
  });

  it('uses tests: sub-key when describe has both tests and nested groups', () => {
    const docs: FileDoc[] = [{
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
          tests: [{ name: 'deep test', modifier: null, line: 6, steps: [] }],
        }],
        tests: [{ name: 'sibling', modifier: null, line: 3, steps: [] }],
      }],
      tests: [],
    }];

    expect(formatYaml(docs, '/project')).toBe(
      'nested.spec.ts:\n' +
      '  outer:\n' +
      '    tests:\n' +
      '      - sibling\n' +
      '    inner:\n' +
      '      - deep test\n',
    );
  });

  it('renders describe modifier in brackets', () => {
    const docs: FileDoc[] = [{
      path: '/project/a.spec.ts',
      describes: [{
        name: 'Auth',
        modifier: 'parallel',
        line: 1,
        describes: [],
        tests: [{ name: 'test', modifier: null, line: 2, steps: [] }],
      }],
      tests: [],
    }];

    const yaml = formatYaml(docs, '/project');
    expect(yaml).toContain('Auth [parallel]:');
  });

  it('renders steps as string lists', () => {
    const docs: FileDoc[] = [{
      path: '/project/s.spec.ts',
      describes: [],
      tests: [{
        name: 'with steps',
        modifier: null,
        line: 1,
        steps: [
          { name: 'first step', steps: [] },
          { name: 'second step', steps: [] },
        ],
      }],
    }];

    const yaml = formatYaml(docs, '/project');
    expect(yaml).toContain('steps:');
    expect(yaml).toContain('- first step');
    expect(yaml).toContain('- second step');
  });

  it('renders nested steps as mapping entries', () => {
    const docs: FileDoc[] = [{
      path: '/project/s.spec.ts',
      describes: [],
      tests: [{
        name: 'nested',
        modifier: null,
        line: 1,
        steps: [
          { name: 'parent', steps: [{ name: 'child', steps: [] }] },
        ],
      }],
    }];

    const yaml = formatYaml(docs, '/project');
    expect(yaml).toContain('- parent:');
    expect(yaml).toContain('- child');
  });

  it('returns empty string for empty docs array', () => {
    expect(formatYaml([], '/project')).toBe('');
  });

  it('renders empty file as []', () => {
    const docs: FileDoc[] = [{
      path: '/project/empty.spec.ts',
      describes: [],
      tests: [],
    }];

    expect(formatYaml(docs, '/project')).toBe('empty.spec.ts: []\n');
  });

  it('quotes strings with special YAML characters', () => {
    const docs: FileDoc[] = [{
      path: '/project/a.spec.ts',
      describes: [],
      tests: [{ name: 'test: with colon', modifier: null, line: 1, steps: [] }],
    }];

    const yaml = formatYaml(docs, '/project');
    expect(yaml).toContain('"test: with colon"');
  });

  it('uses tests: sub-key for file with both top-level tests and describes', () => {
    const docs: FileDoc[] = [{
      path: '/project/mixed.spec.ts',
      describes: [{
        name: 'group',
        modifier: null,
        line: 5,
        describes: [],
        tests: [{ name: 'grouped', modifier: null, line: 6, steps: [] }],
      }],
      tests: [
        { name: 'standalone', modifier: null, line: 1, steps: [] },
      ],
    }];

    expect(formatYaml(docs, '/project')).toBe(
      'mixed.spec.ts:\n' +
      '  tests:\n' +
      '    - standalone\n' +
      '  group:\n' +
      '    - grouped\n',
    );
  });

  it('renders multiple files separated by blank lines', () => {
    const docs: FileDoc[] = [
      { path: '/project/a.spec.ts', describes: [], tests: [{ name: 'a', modifier: null, line: 1, steps: [] }] },
      { path: '/project/b.spec.ts', describes: [], tests: [{ name: 'b', modifier: null, line: 1, steps: [] }] },
    ];

    const yaml = formatYaml(docs, '/project');
    expect(yaml).toContain('a.spec.ts:');
    expect(yaml).toContain('b.spec.ts:');
    expect(yaml).toContain('\n\n');
  });

  it('renders empty describe as []', () => {
    const docs: FileDoc[] = [{
      path: '/project/a.spec.ts',
      describes: [{
        name: 'empty group',
        modifier: null,
        line: 1,
        describes: [],
        tests: [],
      }],
      tests: [],
    }];

    expect(formatYaml(docs, '/project')).toBe(
      'a.spec.ts:\n' +
      '  empty group: []\n',
    );
  });
});

describe('formatYamlSingle', () => {
  it('renders a single file doc', () => {
    const doc: FileDoc = {
      path: '/project/tests/example.spec.ts',
      describes: [],
      tests: [{ name: 'my test', modifier: null, line: 5, steps: [] }],
    };

    expect(formatYamlSingle(doc, '/project')).toBe(
      'tests/example.spec.ts:\n' +
      '  - my test\n',
    );
  });

  it('returns empty string for empty doc', () => {
    const doc: FileDoc = {
      path: '/project/empty.spec.ts',
      describes: [],
      tests: [],
    };

    // renderFile still produces output for empty files (key: [])
    const result = formatYamlSingle(doc, '/project');
    expect(result).toBe('empty.spec.ts: []\n');
  });

  it('renders describes with tests', () => {
    const doc: FileDoc = {
      path: '/project/auth.spec.ts',
      describes: [{
        name: 'Auth',
        modifier: null,
        line: 1,
        describes: [],
        tests: [{ name: 'logs in', modifier: null, line: 2, steps: [] }],
      }],
      tests: [],
    };

    expect(formatYamlSingle(doc, '/project')).toBe(
      'auth.spec.ts:\n' +
      '  Auth:\n' +
      '    - logs in\n',
    );
  });
});
