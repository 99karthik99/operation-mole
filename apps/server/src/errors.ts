/** Invalid user input (e.g. a path that does not exist or has the wrong type). Maps to HTTP 400. */
export class CompareInputError extends Error {
  override name = 'CompareInputError';
}

/** Requested file does not exist. Maps to HTTP 404. */
export class NotFoundError extends Error {
  override name = 'NotFoundError';
}

/** A readable message for any thrown value (`catch` gives `unknown`). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Narrows a caught value to a Node system error, so its `code` (e.g. `ENOENT`) can be read. */
export function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

/** The request conflicts with existing data (e.g. duplicate name). Maps to HTTP 409. */
export class ConflictError extends Error {
  override name = 'ConflictError';
}
