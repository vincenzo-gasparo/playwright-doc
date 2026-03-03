import path from 'path';

import type { DescribeBlock, FileDoc, TestEntry, TestStep } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const escapeMarkdown = (text: string): string =>
  text.replace(/([*_`~\[\]\\$])/g, '\\$1');

const badge = (modifier: string | null): string =>
  modifier != null ? ` \`[${modifier}]\`` : '';

const indent = (depth: number): string => '  '.repeat(depth);

const quotePrefix = (depth: number): string =>
  depth > 0 ? '> '.repeat(depth) : '';

const quoteLine = (depth: number, content: string): string => {
  const prefix = quotePrefix(depth);
  return content === '' ? prefix.trimEnd() : `${prefix}${content}`;
};

// ── Renderers ─────────────────────────────────────────────────────────────────

const renderSteps = (steps: readonly TestStep[], depth: number): string[] =>
  steps.flatMap(step => [
    `${indent(depth)}- step: ${escapeMarkdown(step.name)}`,
    ...renderSteps(step.steps, depth + 1),
  ]);

const renderTest = (test: TestEntry): string[] => [
  `- **test**: ${escapeMarkdown(test.name)}${badge(test.modifier)} \`(line ${test.line})\``,
  ...renderSteps(test.steps, 1),
];

const renderChildren = (
  describes: readonly DescribeBlock[],
  tests: readonly TestEntry[],
  headingDepth: number,
  quoteDepth: number,
): string[] => {
  const items: { line: number; render: () => string[] }[] = [
    ...describes.map(d => ({
      line: d.line,
      render: () => renderDescribe(d, headingDepth, quoteDepth),
    })),
    ...tests.map(t => ({
      line: t.line,
      render: () => [
        ...renderTest(t).map(l => quoteLine(quoteDepth, l)),
        quoteLine(quoteDepth, ''),
      ],
    })),
  ];
  items.sort((a, b) => a.line - b.line);
  return items.flatMap(i => i.render());
};

const renderDescribe = (
  describe: DescribeBlock,
  headingDepth: number,
  quoteDepth: number,
): string[] => {
  const qd = quoteDepth + 1;
  const heading = '#'.repeat(Math.min(headingDepth + 3, 6));
  return [
    quoteLine(qd, `${heading} describe: ${escapeMarkdown(describe.name)}${badge(describe.modifier)}`),
    quoteLine(qd, ''),
    ...renderChildren(describe.describes, describe.tests, headingDepth + 1, qd),
  ];
};

const renderFile = (doc: FileDoc, rootDir: string): string => {
  const rel = path.relative(rootDir, doc.path);
  const lines: string[] = [`## ${rel}`, ''];
  lines.push(...renderChildren(doc.describes, doc.tests, 0, 0));
  return lines.join('\n');
};

// ── Public API ────────────────────────────────────────────────────────────────

export const formatMarkdown = (docs: readonly FileDoc[], rootDir: string): string =>
  ['# Test Documentation', '', ...docs.map(doc => renderFile(doc, rootDir))].join('\n');
