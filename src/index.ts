#!/usr/bin/env node

import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import fs from 'fs/promises';
import path from 'path';

import { Command } from 'commander';

import { findFiles } from './files';
import { formatMarkdown, formatMarkdownSingle } from './formatter';
import { formatYaml, formatYamlSingle } from './formatter-yaml';
import { deriveOutputPath } from './output';
import { parseFile } from './parser';
import type { FileDoc, ParseError } from './types';

// ── Error formatting ──────────────────────────────────────────────────────────

const renderError = (error: ParseError): string => {
  switch (error.tag) {
    case 'FileReadError': return `[read error]  ${error.path}\n             ${error.cause.message}`;
    case 'ParseError':    return `[parse error] ${error.path}\n             ${error.cause.message}`;
    case 'GlobError':     return `[glob error]  pattern: ${error.pattern}\n             ${error.cause.message}`;
    case 'OutputError':   return `[write error] ${error.path}\n             ${error.cause.message}`;
  }
};

// ── Parse all files, collecting failures without stopping ─────────────────────

type ParseOutcome = E.Either<ParseError, FileDoc>;

/**
 * Wraps parseFile so it never fails — errors become Left values in the result
 * array instead of aborting the whole traversal.
 */
const parseFileSafe = (filePath: string): TE.TaskEither<never, ParseOutcome> =>
  pipe(parseFile(filePath), T.map(E.right));

const parseAll = (
  files: readonly string[],
): TE.TaskEither<never, readonly ParseOutcome[]> =>
  pipe(files, RA.traverse(TE.ApplicativePar)(parseFileSafe));

// ── Write output ──────────────────────────────────────────────────────────────

const writeOutput = (
  markdown: string,
  outputFile: string | undefined,
): TE.TaskEither<ParseError, void> =>
  outputFile != null
    ? TE.tryCatch(
        async () => {
          const resolved = path.resolve(outputFile);
          await fs.mkdir(path.dirname(resolved), { recursive: true });
          await fs.writeFile(resolved, markdown, 'utf-8');
        },
        (e): ParseError => ({ tag: 'OutputError', path: outputFile, cause: e as Error }),
      )
    : TE.fromIO(() => { process.stdout.write(markdown + '\n'); });

type OutputEntry = { readonly filePath: string; readonly content: string };

const writeOneFile = (entry: OutputEntry): TE.TaskEither<ParseError, void> =>
  TE.tryCatch(
    async () => {
      const resolved = path.resolve(entry.filePath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, entry.content, 'utf-8');
    },
    (e): ParseError => ({ tag: 'OutputError', path: entry.filePath, cause: e as Error }),
  );

const writeOutputDir = (
  entries: readonly OutputEntry[],
): TE.TaskEither<ParseError, void> =>
  pipe(
    entries,
    RA.traverse(TE.ApplicativePar)(writeOneFile),
    TE.map(() => undefined),
  );

// ── CLI ───────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('playwright-doc')
  .description('Generate markdown documentation for Playwright test files')
  .version('1.0.0');

program
  .command('generate')
  .description('Scan test files and output documentation')
  .argument('<pattern>', 'Glob pattern to match test files (e.g. "tests/**/*.spec.ts")')
  .option('-o, --output <file>', 'Write output to file instead of stdout')
  .option('-d, --outdir <dir>', 'Write one file per source file into directory (mutually exclusive with -o)')
  .option('-f, --format <type>', 'Output format: markdown or yaml', 'markdown')
  .option('--cwd <dir>', 'Working directory for glob resolution', process.cwd())
  .action(async (pattern: string, opts: { output?: string; outdir?: string; format: string; cwd: string }) => {
    if (opts.output != null && opts.outdir != null) {
      console.error('Error: --output and --outdir are mutually exclusive');
      process.exit(1);
    }

    const isYaml = opts.format === 'yaml';
    const ext = isYaml ? '.yaml' : '.md';

    const parseDocs = pipe(
      findFiles(pattern, opts.cwd),
      TE.chainFirst(files =>
        TE.fromIO(() => { console.error(`Found ${files.length} file(s)…`); })
      ),
      TE.chainW(files => parseAll(files)),
      TE.chain(outcomes => {
        const { left: errors, right: docs } = RA.separate(outcomes);

        if (errors.length > 0) {
          console.error(`\n${errors.length} file(s) failed to parse:`);
          errors.forEach(err => console.error(`  ${renderError(err)}`));
          console.error('');
        }

        return TE.right(docs);
      }),
    );

    const task = opts.outdir != null
      ? pipe(
          parseDocs,
          TE.map(docs =>
            docs
              .filter(doc => doc.tests.length > 0 || doc.describes.length > 0)
              .map(doc => ({
                filePath: deriveOutputPath(doc.path, opts.cwd, opts.outdir!, ext),
                content: isYaml
                  ? formatYamlSingle(doc, opts.cwd)
                  : formatMarkdownSingle(doc, opts.cwd),
              })),
          ),
          TE.chain(writeOutputDir),
        )
      : pipe(
          parseDocs,
          TE.map(docs =>
            isYaml
              ? formatYaml(docs, opts.cwd)
              : formatMarkdown(docs, opts.cwd),
          ),
          TE.chain(content => writeOutput(content, opts.output)),
        );

    const result = await task();

    if (E.isLeft(result)) {
      console.error(`Error: ${renderError(result.left)}`);
      process.exit(1);
    }

    if (opts.outdir) {
      console.error(`Documentation written to ${opts.outdir}/`);
    } else if (opts.output) {
      console.error(`Documentation written to ${opts.output}`);
    }
  });

program.parse();
