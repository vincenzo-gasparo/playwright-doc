import { describe, expect, it } from 'vitest';
import { deriveOutputPath } from '../src/output';

describe('deriveOutputPath', () => {
  it('maps source path to output directory preserving structure', () => {
    expect(
      deriveOutputPath('/proj/tests/auth/login.spec.ts', '/proj', 'docs', '.md'),
    ).toBe('docs/tests/auth/login.spec.md');
  });

  it('handles files at root level', () => {
    expect(
      deriveOutputPath('/proj/example.spec.ts', '/proj', 'out', '.md'),
    ).toBe('out/example.spec.md');
  });

  it('works with yaml extension', () => {
    expect(
      deriveOutputPath('/proj/tests/cart.spec.ts', '/proj', 'docs', '.yaml'),
    ).toBe('docs/tests/cart.spec.yaml');
  });

  it('handles deeply nested paths', () => {
    expect(
      deriveOutputPath('/proj/tests/e2e/flows/checkout/pay.spec.ts', '/proj', 'out', '.md'),
    ).toBe('out/tests/e2e/flows/checkout/pay.spec.md');
  });

  it('handles absolute output directory', () => {
    expect(
      deriveOutputPath('/proj/tests/a.spec.ts', '/proj', '/tmp/docs', '.md'),
    ).toBe('/tmp/docs/tests/a.spec.md');
  });
});
