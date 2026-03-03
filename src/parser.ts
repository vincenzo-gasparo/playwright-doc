import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import fs from 'fs/promises';
import ts from 'typescript';

import type {
  DescribeBlock,
  DescribeModifier,
  FileDoc,
  ParseError,
  TestEntry,
  TestModifier,
  TestStep,
} from './types';

// ── AST helpers ───────────────────────────────────────────────────────────────

const getStringLiteral = (node: ts.Node): O.Option<string> => {
  if (ts.isStringLiteral(node)) return O.some(node.text);
  if (ts.isNoSubstitutionTemplateLiteral(node)) return O.some(node.text);
  return O.none;
};

const getFunctionBody = (node: ts.Node): O.Option<ts.Node> => {
  if (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node)
  ) {
    return node.body != null ? O.some(node.body) : O.none;
  }
  return O.none;
};

const lineOf = (sourceFile: ts.SourceFile, node: ts.Node): number =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

// ── Local function map (Level 1: same-file resolution) ────────────────────────

type LocalFunctions = ReadonlyMap<string, ts.Node>;

const collectLocalFunctions = (sourceFile: ts.SourceFile): LocalFunctions => {
  const fns = new Map<string, ts.Node>();

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name != null) {
      fns.set(node.name.text, node);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer != null) {
          if (
            ts.isArrowFunction(decl.initializer) ||
            ts.isFunctionExpression(decl.initializer)
          ) {
            fns.set(decl.name.text, decl.initializer);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return fns;
};

// ── Test identifier detection ─────────────────────────────────────────────────

/**
 * Finds the effective test identifier used for test() / test.describe() calls.
 *
 * Handles three patterns:
 *   import { test } from '@playwright/test'            → "test"
 *   import { test as myTest } from './fixtures'         → "myTest"
 *   const test = myTest.extend({...})                   → follows .extend() chain
 *
 * Defaults to `"test"` when no import is found.
 */
const findTestIdentifier = (sourceFile: ts.SourceFile): string => {
  // Step 1 — find the imported identifier for 'test'
  let testId = 'test';

  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings != null) {
      const bindings = node.importClause.namedBindings;
      if (ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          const imported = el.propertyName?.text ?? el.name.text;
          if (imported === 'test') testId = el.name.text;
        }
      }
    }
  });

  // Step 2 — follow const X = knownTestId.extend({...}) chains
  // Repeat until stable (handles chained extends: a → b → c)
  let changed = true;
  while (changed) {
    changed = false;
    ts.forEachChild(sourceFile, node => {
      if (!ts.isVariableStatement(node)) return;
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.initializer == null) continue;
        const init = decl.initializer;
        // Matches: knownId.extend(...) or knownId.extend<T>(...)
        if (
          ts.isCallExpression(init) &&
          ts.isPropertyAccessExpression(init.expression) &&
          ts.isIdentifier(init.expression.expression) &&
          init.expression.expression.text === testId &&
          init.expression.name.text === 'extend'
        ) {
          testId = decl.name.text;
          changed = true;
        }
      }
    });
  }

  return testId;
};

// ── Step extraction ───────────────────────────────────────────────────────────

const extractSteps = (
  body: ts.Node,
  testId: string,
  localFns: LocalFunctions,
  visited: Set<string>,
  sourceFile: ts.SourceFile,
): readonly TestStep[] => {
  const steps: TestStep[] = [];

  const visit = (node: ts.Node): void => {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const { expression: callee, arguments: args } = node;

    // test.step('name', async () => { ... })
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === testId &&
      callee.name.text === 'step' &&
      args.length >= 1
    ) {
      const nameOpt = getStringLiteral(args[0]);
      if (O.isSome(nameOpt)) {
        const nestedSteps = pipe(
          args.length >= 2 ? getFunctionBody(args[args.length - 1]) : O.none,
          O.map(b => extractSteps(b, testId, localFns, visited, sourceFile)),
          O.getOrElse((): readonly TestStep[] => []),
        );
        steps.push({ name: nameOpt.value, steps: nestedSteps });
        return; // don't recurse further into step args
      }
    }

    // Local function call — resolve same-file definition
    if (ts.isIdentifier(callee) && localFns.has(callee.text) && !visited.has(callee.text)) {
      const fnName = callee.text;
      visited.add(fnName);
      const fnBodyOpt = getFunctionBody(localFns.get(fnName)!);
      if (O.isSome(fnBodyOpt)) {
        steps.push(...extractSteps(fnBodyOpt.value, testId, localFns, visited, sourceFile));
      }
      visited.delete(fnName);
      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(body, visit);
  return steps;
};

// ── Suite walker ──────────────────────────────────────────────────────────────

type SuiteContent = {
  readonly describes: readonly DescribeBlock[];
  readonly tests: readonly TestEntry[];
};

const EMPTY_SUITE: SuiteContent = { describes: [], tests: [] };

const TEST_MODIFIERS = new Set<string>(['skip', 'only', 'fixme', 'fail', 'slow']);
const DESCRIBE_MODIFIERS = new Set<string>(['parallel', 'serial', 'skip', 'only', 'fixme']);

const walkSuite = (
  root: ts.Node,
  testId: string,
  localFns: LocalFunctions,
  sourceFile: ts.SourceFile,
): SuiteContent => {
  const describes: DescribeBlock[] = [];
  const tests: TestEntry[] = [];

  const visit = (node: ts.Node): void => {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const { expression: callee, arguments: args } = node;
    if (args.length < 1) {
      ts.forEachChild(node, visit);
      return;
    }

    const nameOpt = getStringLiteral(args[0]);
    if (O.isNone(nameOpt)) {
      ts.forEachChild(node, visit);
      return;
    }

    const name = nameOpt.value;
    const line = lineOf(sourceFile, node);
    const bodyOpt = args.length >= 2 ? getFunctionBody(args[args.length - 1]) : O.none;

    const childSuite = (): SuiteContent =>
      pipe(
        bodyOpt,
        O.map(b => walkSuite(b, testId, localFns, sourceFile)),
        O.getOrElse(() => EMPTY_SUITE),
      );

    const childSteps = (): readonly TestStep[] =>
      pipe(
        bodyOpt,
        O.map(b => extractSteps(b, testId, localFns, new Set(), sourceFile)),
        O.getOrElse((): readonly TestStep[] => []),
      );

    // test('name', fn)
    if (ts.isIdentifier(callee) && callee.text === testId) {
      tests.push({ name, modifier: null, line, steps: childSteps() });
      return;
    }

    if (!ts.isPropertyAccessExpression(callee)) {
      ts.forEachChild(node, visit);
      return;
    }

    const obj = callee.expression;
    const prop = callee.name.text;

    // test.skip/only/fixme/fail('name', fn)
    if (ts.isIdentifier(obj) && obj.text === testId && TEST_MODIFIERS.has(prop)) {
      tests.push({ name, modifier: prop as TestModifier, line, steps: childSteps() });
      return;
    }

    // test.describe('name', fn)
    if (ts.isIdentifier(obj) && obj.text === testId && prop === 'describe') {
      describes.push({ name, modifier: null, line, ...childSuite() });
      return;
    }

    // test.describe.parallel/serial/skip/only/fixme('name', fn)
    if (
      ts.isPropertyAccessExpression(obj) &&
      ts.isIdentifier(obj.expression) &&
      obj.expression.text === testId &&
      obj.name.text === 'describe' &&
      DESCRIBE_MODIFIERS.has(prop)
    ) {
      describes.push({ name, modifier: prop as DescribeModifier, line, ...childSuite() });
      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(root, visit);
  return { describes, tests };
};

// ── Public API ────────────────────────────────────────────────────────────────

const parseSource = (filePath: string, source: string): E.Either<ParseError, FileDoc> =>
  E.tryCatch(
    (): FileDoc => {
      const scriptKind = filePath.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : filePath.endsWith('.ts')
          ? ts.ScriptKind.TS
          : filePath.endsWith('.jsx')
            ? ts.ScriptKind.JSX
            : ts.ScriptKind.JS;

      const sourceFile = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        scriptKind,
      );

      const testId = findTestIdentifier(sourceFile);
      const localFns = collectLocalFunctions(sourceFile);
      const { describes, tests } = walkSuite(sourceFile, testId, localFns, sourceFile);

      return { path: filePath, describes, tests };
    },
    (e): ParseError => ({ tag: 'ParseError', path: filePath, cause: e as Error }),
  );

export const parseFile = (filePath: string): TE.TaskEither<ParseError, FileDoc> =>
  pipe(
    TE.tryCatch(
      () => fs.readFile(filePath, 'utf-8'),
      (e): ParseError => ({ tag: 'FileReadError', path: filePath, cause: e as Error }),
    ),
    TE.chainEitherK(source => parseSource(filePath, source)),
  );
