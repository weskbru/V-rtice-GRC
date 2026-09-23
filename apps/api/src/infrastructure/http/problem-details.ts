import type { ValidationFieldError } from '../../shared/errors/domain-error';

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly correlationId: string;
  readonly errors?: readonly ValidationFieldError[];
}
