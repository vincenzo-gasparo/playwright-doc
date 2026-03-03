// ── Error types ──────────────────────────────────────────────────────────────

export type ParseError =
  | { readonly tag: 'FileReadError'; readonly path: string; readonly cause: Error }
  | { readonly tag: 'ParseError';    readonly path: string; readonly cause: Error }
  | { readonly tag: 'GlobError';     readonly pattern: string; readonly cause: Error }
  | { readonly tag: 'OutputError';   readonly path: string; readonly cause: Error };

// ── Test structure ────────────────────────────────────────────────────────────

export type TestStep = {
  readonly name: string;
  readonly steps: readonly TestStep[];
};

export type TestModifier = 'skip' | 'only' | 'fixme' | 'fail' | 'slow';
export type DescribeModifier = 'parallel' | 'serial' | 'skip' | 'only' | 'fixme';

export type TestEntry = {
  readonly name: string;
  readonly modifier: TestModifier | null;
  readonly line: number;
  readonly steps: readonly TestStep[];
};

export type DescribeBlock = {
  readonly name: string;
  readonly modifier: DescribeModifier | null;
  readonly line: number;
  readonly describes: readonly DescribeBlock[];
  readonly tests: readonly TestEntry[];
};

export type FileDoc = {
  readonly path: string;
  readonly describes: readonly DescribeBlock[];
  readonly tests: readonly TestEntry[];
};
