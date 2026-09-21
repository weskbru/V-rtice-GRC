/**
 * RFC 9457 `application/problem+json` shape (ADR-009), shared by the filter
 * and by anything (tests, docs) that needs to describe it without pulling
 * in the whole filter.
 */
import type { ValidationFieldError } from '../../shared/errors/domain-error';

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

export interface ProblemDetails {
  /** URI reference identifying the problem type. Stable per error kind. */
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  /** The request path that produced the problem. */
  readonly instance: string;
  /** Always present — ties a client-visible error back to server logs
   * without exposing any log content itself. */
  readonly correlationId: string;
  readonly errors?: readonly ValidationFieldError[];
}
