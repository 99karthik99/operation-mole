/**
 * Outcome of an operation that can fail in an expected way (validation, parsing).
 * Throw only for programmer errors and truly exceptional conditions.
 */
export type Result<T, TError = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: TError };
