/**
 * Generic `application/problem+json` envelope text (RFC 9457) — the HTTP
 * status titles and the generic 500 detail. No module owns these: every
 * response, whichever module raised it, can carry them. See
 * `user-messages.ts` for how this composes into `USER_MESSAGES` and for
 * the shared catalog's own rules.
 */
export const problemTitle = {
  badRequest: 'Requisição inválida',
  unauthorized: 'Não autorizado',
  forbidden: 'Acesso negado',
  notFound: 'Não encontrado',
  conflict: 'Conflito',
  unprocessableEntity: 'Não processável',
  tooManyRequests: 'Muitas requisições',
  internalServerError: 'Erro interno do servidor',
  /** T190 — `PayloadTooLargeException` (multer's `limits.fileSize`,
   * FR-097). */
  payloadTooLarge: 'Arquivo muito grande',
  /** S-01 — `PasswordChangeRequiredDomainError`. Distinct from `forbidden`
   * above so the client can tell the two 403 reasons apart. */
  passwordChangeRequired: 'Troca de senha obrigatória',
} as const;

export const server = {
  /** Generic 500 `detail` — never the real exception message (FR-107). */
  unexpectedError: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
  /** F-41 (`docs/deferred-findings.md`) — `detail` for a request body Express's
   * own `json()` body-parser middleware rejected (invalid JSON syntax, or a
   * malformed URI-encoded body) before any Nest guard, pipe or application
   * code ever ran. That rejection reaches `ProblemDetailsFilter` as a bare
   * `BadRequestException(err.message)` — Node/V8's own English parser text
   * ("Unexpected token ... in JSON at position N"), never one of this
   * codebase's own `{ title, detail }` shapes — so it is replaced with this
   * fixed, generic, pt-BR detail rather than ever surfacing verbatim. */
  malformedRequestBody: 'O corpo da requisição não pôde ser interpretado como JSON válido.',
} as const;
