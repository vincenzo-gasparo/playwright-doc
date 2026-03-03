# Contributing

## Prerequisites

- Node.js >= 18
- npm

## Setup

```bash
git clone <repo-url>
cd cli-parser
npm install
```

## Development

```bash
# Run in development mode (ts-node, no build step)
npm run dev -- generate "tests/**/*.spec.ts"

# Build TypeScript to dist/
npm run build

# Run the built CLI
npm start -- generate "tests/**/*.spec.ts"
```

## Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

Test fixtures live in `tests/fixtures/` — minimal `.spec.ts` files that exercise parser features without requiring a real Playwright dependency.

## Code style

- **fp-ts** — Error handling uses `TaskEither` and `Either` throughout. Avoid throwing exceptions; return typed errors instead.
- **Strict TypeScript** — `strict: true` is enabled. All types should use `readonly` where possible.
- **Pure functions** — Keep side effects at the edges (CLI entry point). The parser and formatter are pure.

## Project structure

```
src/
  types.ts      — Error and data types (ParseError, FileDoc, TestEntry, etc.)
  parser.ts     — AST-based test file parser (public export: parseFile)
  formatter.ts  — Markdown renderer (public export: formatMarkdown)
  files.ts      — Glob-based file discovery (public export: findFiles)
  index.ts      — CLI entry point (Commander)
tests/
  fixtures/     — Minimal .spec.ts files for parser testing
  parser.test.ts
  formatter.test.ts
  files.test.ts
```

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). A husky hook validates every commit message automatically.

**Format:** `<type>(<optional scope>): <description>`

| Type       | When to use                              |
|------------|------------------------------------------|
| `feat`     | A new feature                            |
| `fix`      | A bug fix                                |
| `docs`     | Documentation only changes               |
| `refactor` | Code change that neither fixes nor adds  |
| `test`     | Adding or updating tests                 |
| `chore`    | Build process, tooling, dependencies     |

**Examples:**

```
feat: add YAML output format
fix: handle empty describe blocks without crashing
docs: add commit conventions to CONTRIBUTING
refactor(parser): extract helper for nested describes
test: add fixture for tagged tests
chore: bump vitest to v4
```

A commit with `BREAKING CHANGE:` in the footer (or `!` after the type) triggers a major version bump.

## Pull requests

1. Create a feature branch from `main`
2. Make sure `npm test` passes
3. Make sure `npx tsc --noEmit` passes (no type errors)
4. Keep commits focused — one logical change per commit
