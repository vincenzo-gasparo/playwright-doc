import path from 'path';

import type { DescribeBlock, FileDoc, TestEntry, TestStep } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const YAML_KEYWORDS = new Set([
  'true', 'false', 'yes', 'no', 'on', 'off',
  'True', 'False', 'Yes', 'No', 'On', 'Off',
  'TRUE', 'FALSE', 'YES', 'NO', 'ON', 'OFF',
  'null', 'Null', 'NULL', '~',
]);

const needsQuoting = (s: string): boolean => {
  if (s === '') return true;
  if (YAML_KEYWORDS.has(s)) return true;
  if (/^[-?:] /.test(s) || /^[-?:]$/.test(s)) return true;
  if (/^[,\[\]{}#&*!|>'"% @`]/.test(s)) return true;
  if (s.includes(': ') || s.includes(' #') || s.includes('\n')) return true;
  if (s.endsWith(':') || s.endsWith(' ')) return true;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return true;
  return false;
};

const yamlString = (s: string): string =>
  needsQuoting(s) ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s;

const indent = (depth: number): string => '  '.repeat(depth);

// ── Renderers ─────────────────────────────────────────────────────────────────

const renderStepsYaml = (steps: readonly TestStep[], depth: number): string[] =>
  steps.flatMap(step =>
    step.steps.length === 0
      ? [`${indent(depth)}- ${yamlString(step.name)}`]
      : [
          `${indent(depth)}- ${yamlString(step.name)}:`,
          ...renderStepsYaml(step.steps, depth + 2),
        ],
  );

const renderTestYaml = (test: TestEntry, depth: number): string[] => {
  const hasMetadata = test.modifier != null || test.steps.length > 0;
  if (!hasMetadata) {
    return [`${indent(depth)}- ${yamlString(test.name)}`];
  }
  const lines: string[] = [];
  lines.push(`${indent(depth)}- name: ${yamlString(test.name)}`);
  if (test.modifier != null) {
    lines.push(`${indent(depth + 1)}modifier: ${test.modifier}`);
  }
  if (test.steps.length > 0) {
    lines.push(`${indent(depth + 1)}steps:`);
    lines.push(...renderStepsYaml(test.steps, depth + 2));
  }
  return lines;
};

const renderChildren = (
  describes: readonly DescribeBlock[],
  tests: readonly TestEntry[],
  depth: number,
): string[] => {
  const hasTests = tests.length > 0;
  const hasDescribes = describes.length > 0;

  if (!hasTests && !hasDescribes) return [];

  const sortedTests = [...tests].sort((a, b) => a.line - b.line);
  const sortedDescribes = [...describes].sort((a, b) => a.line - b.line);

  if (hasTests && hasDescribes) {
    return [
      `${indent(depth)}tests:`,
      ...sortedTests.flatMap(t => renderTestYaml(t, depth + 1)),
      ...sortedDescribes.flatMap(d => renderDescribeYaml(d, depth)),
    ];
  }

  if (hasTests) {
    return sortedTests.flatMap(t => renderTestYaml(t, depth));
  }

  return sortedDescribes.flatMap(d => renderDescribeYaml(d, depth));
};

const describeKey = (d: DescribeBlock): string => {
  const name = d.modifier != null ? `${d.name} [${d.modifier}]` : d.name;
  return yamlString(name);
};

const renderDescribeYaml = (d: DescribeBlock, depth: number): string[] => {
  const key = describeKey(d);

  if (d.tests.length === 0 && d.describes.length === 0) {
    return [`${indent(depth)}${key}: []`];
  }

  return [
    `${indent(depth)}${key}:`,
    ...renderChildren(d.describes, d.tests, depth + 1),
  ];
};

const renderFile = (doc: FileDoc, rootDir: string): string[] => {
  const rel = path.relative(rootDir, doc.path);

  if (doc.tests.length === 0 && doc.describes.length === 0) {
    return [`${yamlString(rel)}: []`];
  }

  return [
    `${yamlString(rel)}:`,
    ...renderChildren(doc.describes, doc.tests, 1),
  ];
};

// ── Public API ────────────────────────────────────────────────────────────────

export const formatYaml = (docs: readonly FileDoc[], rootDir: string): string =>
  docs.length === 0
    ? ''
    : docs.map(doc => renderFile(doc, rootDir).join('\n')).join('\n\n') + '\n';
