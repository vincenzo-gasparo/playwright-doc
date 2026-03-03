# playwright-doc

A CLI tool that generates structured Markdown documentation from Playwright test files by parsing the AST.

## Features

- Parses `test()`, `test.describe()`, and `test.step()` calls from `.spec.ts` files
- Supports all test modifiers: `skip`, `only`, `fixme`, `fail`, `slow`
- Supports describe modifiers: `parallel`, `serial`, `skip`, `only`, `fixme`
- Detects custom test identifiers (`test.extend()` / `import { test as base }`)
- Handles nested describes and nested steps
- Outputs clean Markdown with heading hierarchy and line numbers
- Supports YAML output for machine-readable consumption (`--format yaml`)
- Gracefully reports per-file parse errors without aborting

## Installation

```bash
# Install globally
npm install -g cli-parser

# Or run directly with npx
npx cli-parser generate "tests/**/*.spec.ts"
```

## Usage

```bash
# Print documentation to stdout
playwright-doc generate "tests/**/*.spec.ts"

# Write to a file
playwright-doc generate "tests/**/*.spec.ts" -o docs/tests.md

# Output as YAML
playwright-doc generate "tests/**/*.spec.ts" --format yaml

# Short flag
playwright-doc generate "tests/**/*.spec.ts" -f yaml -o docs/tests.yaml

# Write one file per source file, preserving directory structure
playwright-doc generate "tests/**/*.spec.ts" --outdir docs/

# Per-file YAML output
playwright-doc generate "tests/**/*.spec.ts" -d docs/ -f yaml

# Use a custom working directory
playwright-doc generate "**/*.spec.ts" --cwd ./packages/app
```

### Sample output

```markdown
# Test Documentation

## tests/auth.spec.ts

> ### describe: Authentication
>
> - **test**: should log in *(line 8)*
>   - step: Fill username
>   - step: Fill password
>   - step: Click submit
>
> - **test**: should reject bad credentials `[fail]` *(line 20)*
```

### YAML output (`--format yaml`)

```yaml
tests/auth.spec.ts:
  Authentication:
    - name: should log in
      steps:
        - Fill username
        - Fill password
        - Click submit
    - name: should reject bad credentials
      modifier: fail
```

## Supported patterns

| Pattern | Example |
|---------|---------|
| Basic test | `test('name', async () => {})` |
| Test modifiers | `test.skip(...)`, `test.only(...)`, `test.fixme(...)`, `test.fail(...)`, `test.slow(...)` |
| Describe | `test.describe('group', () => {})` |
| Describe modifiers | `test.describe.parallel(...)`, `test.describe.serial(...)` |
| Steps | `await test.step('name', async () => {})` |
| Nested steps | Steps inside steps are rendered with indentation |
| Custom test ID | `import { test as base }` + `const test = base.extend({...})` |

## How it works

1. **File discovery** — Uses `fast-glob` to find files matching the given pattern
2. **AST parsing** — Each file is parsed with the TypeScript compiler API to build a syntax tree
3. **Test extraction** — Walks the AST to find `test()`, `test.describe()`, and `test.step()` calls, resolving custom identifiers via import/extend chains
4. **Output generation** — Converts the extracted structure into Markdown or YAML

The tool is built with `fp-ts` for type-safe error handling using `TaskEither` and `Either`, ensuring parse failures in individual files don't abort the entire run.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
