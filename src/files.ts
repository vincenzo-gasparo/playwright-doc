import * as TE from 'fp-ts/TaskEither';
import fg from 'fast-glob';

import type { ParseError } from './types';

export const findFiles = (
  pattern: string,
  cwd: string,
): TE.TaskEither<ParseError, readonly string[]> =>
  TE.tryCatch(
    () => fg(pattern, { cwd, absolute: true }),
    (e): ParseError => ({ tag: 'GlobError', pattern, cause: e as Error }),
  );
