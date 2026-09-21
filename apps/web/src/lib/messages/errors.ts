/**
 * PharosGRC — canonical, backend-aligned error copy (pt-BR).
 *
 * These exact strings are coordinated with `apps/api`'s own localization
 * pass so a problem+json body's `title`/`detail` and this frontend's
 * independently-authored fallback copy never diverge into two different
 * Portuguese phrasings for the same situation — `e2e/auth.spec.ts` asserts
 * on exact rendered text. Do not reword these without checking with the
 * backend copy first (see `apps/api`'s own domain-error default messages).
 */
export const errors = {
  /** FR-007: one generic, non-disclosing message for every failed sign-in, regardless of the real cause. */
  invalidCredentials: 'E-mail ou senha incorretos.',
  /** Mirrors `UnauthorizedDomainError`'s default message. */
  authenticationRequired: 'Autenticação necessária.',
  /** Mirrors `ForbiddenDomainError`'s default message. */
  forbidden: 'Você não tem permissão para executar esta ação.',
  /** Mirrors `RateLimitedDomainError`'s default message (FR-008, 429). */
  rateLimited: 'Muitas tentativas. Tente novamente mais tarde.',
  /**
   * Mirrors the backend's specific "current password supplied is not valid"
   * detail. NOTE: `change-password-form.tsx` deliberately does NOT render
   * this string on its own — a 401 from `POST /auth/me/password` is
   * contractually ambiguous between "wrong current password" and "session
   * expired mid-use", and the form owns one combined, still-ambiguous
   * message for that case (`auth.changePassword.ambiguousUnauthorized`)
   * rather than trusting the server's specific wording. Kept here so the
   * exact canonical phrase is defined once, for any screen that DOES know
   * unambiguously that the current password was wrong (e.g. a future
   * 422 field-level rendering).
   */
  currentPasswordIncorrect: 'A senha atual informada está incorreta.',
  /** Mirrors the backend's password-policy `ValidationDomainError` top-level detail. */
  passwordPolicyViolation: 'A nova senha não atende à política de senhas.',
  /**
   * F-65 (`docs/deferred-findings.md`) — mirrors
   * `apps/api/src/shared/messages/problem-details.ts`'s `payloadTooLarge`/
   * `apps/api/src/shared/messages/attachment.ts`'s `fileTooLarge` exactly.
   * Used by `middleware.ts`'s own pre-clone size check on
   * `POST /api/v1/attachments` — a request whose `Content-Length` already
   * exceeds the proxy's own ceiling is refused here, before Next's
   * external-rewrite body clone ever buffers a byte of it, with the SAME
   * wording the API itself would give for the same reason (multer's
   * `limits.fileSize`) on a request just under that ceiling — one 413,
   * one meaning, regardless of which layer catches it.
   */
  payloadTooLargeTitle: 'Arquivo muito grande',
  fileTooLarge: 'O arquivo enviado excede o tamanho máximo permitido.',
  /**
   * RFC 9457 problem+json `title` by HTTP status. Used only for the rare
   * case this client itself must synthesize a title (`api-client.ts`'s
   * `parseProblem`) — never to override a title the server already sent.
   */
  httpStatusTitle: {
    400: 'Requisição inválida',
    401: 'Não autorizado',
    403: 'Acesso negado',
    404: 'Não encontrado',
    409: 'Conflito',
    422: 'Não processável',
    429: 'Muitas requisições',
    500: 'Erro interno do servidor',
  },
  /** Used when a response could not even be parsed as problem+json (e.g. a proxy/infra failure before the API ran) and the status is not one of `httpStatusTitle`'s known codes. */
  requestFailedTitle: 'Falha na requisição',
  /** `ErrorState`'s own last-resort defaults, when a caller supplies neither `problem` nor an explicit override — see `packages/design-system`. */
  genericTitle: 'Algo deu errado',
  genericMessage:
    'Não foi possível concluir a solicitação. Tente novamente e, se o problema persistir, entre em contato com o suporte.',
} as const;
