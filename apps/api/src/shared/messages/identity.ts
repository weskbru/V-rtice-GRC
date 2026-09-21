/** Local authentication, sessions and the user directory (`core/identity`). */
export const auth = {
  /**
   * MUST stay byte-for-byte identical for every login-failure reason
   * (unknown account, wrong password, deactivated account) — FR-007.
   * Do not introduce a second, more specific variant of this string.
   */
  invalidCredentials: 'E-mail ou senha incorretos.',
  authenticationRequired: 'Autenticação necessária.',
  forbidden: 'Você não tem permissão para executar esta ação.',
  /**
   * MUST stay identical across every rate-limiting reason (per-account
   * lockout, per-origin throttle) — the same non-disclosure concern as
   * `invalidCredentials` above (FR-007/FR-008): a distinct wording per
   * reason would let a caller infer whether a specific account exists.
   */
  tooManyAttempts: 'Muitas tentativas. Tente novamente mais tarde.',
  currentPasswordIncorrect: 'A senha atual informada está incorreta.',
  passwordPolicyViolation: 'A nova senha não atende à política de senhas.',
  crossOriginRejected: 'Requisição de origem cruzada rejeitada.',
  /**
   * S-01 — `PasswordChangeRequiredDomainError` (403), thrown by
   * `MandatoryPasswordChangeGuard` for every route other than the small
   * allowlist a mandatory password change itself needs.
   */
  passwordChangeRequired:
    'É necessário trocar a senha antes de continuar. Acesse seu perfil para definir uma nova senha.',
} as const;

/** Field-level messages for `PasswordPolicyViolation` (T060). */
export const passwordPolicy = {
  tooShort: (minLength: number): string =>
    `A senha deve ter pelo menos ${String(minLength)} caracteres.`,
  missingComplexity:
    'A senha deve conter ao menos três dos seguintes: letras minúsculas, letras maiúsculas, dígitos e símbolos.',
} as const;

export const email = {
  isEmail: 'Informe um endereço de e-mail válido.',
  maxLength: 'O e-mail deve ter no máximo 320 caracteres.',
} as const;

export const password = {
  isString: 'A senha deve ser um texto.',
  length: 'A senha deve ter entre 1 e 256 caracteres.',
} as const;

export const currentPassword = {
  isString: 'A senha atual deve ser um texto.',
  length: 'A senha atual deve ter entre 1 e 256 caracteres.',
} as const;

export const newPassword = {
  isString: 'A nova senha deve ser um texto.',
  length: 'A nova senha deve ter entre 12 e 256 caracteres.',
} as const;

/** `ListDirectoryUsersQueryDto` — `GET /users`. */
export const directoryQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O termo de busca deve ter no máximo 200 caracteres.' },
  assignableForOrgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
} as const;
