import path from 'path';

/**
 * Maps a source file path to its output path inside the given output directory,
 * preserving the original directory structure relative to `rootDir`.
 *
 * Example: deriveOutputPath('/proj/tests/auth/login.spec.ts', '/proj', 'docs', '.md')
 *        → 'docs/tests/auth/login.spec.md'
 */
export const deriveOutputPath = (
  sourcePath: string,
  rootDir: string,
  outDir: string,
  ext: string,
): string => {
  const rel = path.relative(rootDir, sourcePath);
  const parsed = path.parse(rel);
  const newName = `${parsed.name}${ext}`;
  return path.join(outDir, parsed.dir, newName);
};
