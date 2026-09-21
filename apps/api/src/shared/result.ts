/**
 * Shared kernel — `Result` type (T020).
 *
 * A minimal discriminated union for operations where returning a failure as
 * a value (rather than throwing) reads more clearly at the call site —
 * typically pure domain functions consumed in a loop or a validation
 * pipeline, such as `RiskScoringService` (ADR-006) or password-policy
 * checks, where a caller wants to collect/branch on the outcome rather than
 * unwind the stack.
 *
 * This does not replace `DomainError` (domain-error.ts): application
 * services still throw a `DomainError` at the use-case boundary so the
 * global exception filter (T021) has a single, consistent place to map
 * failures to HTTP responses. `Result` is for composing pure logic
 * underneath that boundary. Use whichever reads more clearly; do not wrap
 * every function in a `Result` reflexively (constitution §2: no premature
 * abstraction).
 */

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}
