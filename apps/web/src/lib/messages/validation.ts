/**
 * PharosGRC — client-side form validation copy (pt-BR).
 *
 * Backs the zod schemas in `src/lib/validation/auth.ts`. Presence/shape
 * only — the actual password *policy* (beyond minimum length) is enforced
 * exclusively by the server (FR-006) and its messages arrive as 422 field
 * errors, which are rendered verbatim rather than through this catalog.
 */
export const validation = {
  email: {
    required: 'Informe seu e-mail.',
    invalid: 'Informe um e-mail válido.',
  },
  password: {
    required: 'Informe sua senha.',
  },
  currentPassword: {
    required: 'Informe sua senha atual.',
  },
  newPassword: {
    tooShort: 'A nova senha deve ter pelo menos 12 caracteres.',
    tooLong: 'A nova senha é muito longa.',
  },
  confirmNewPassword: {
    required: 'Confirme sua nova senha.',
    mismatch: 'As senhas não coincidem.',
  },
} as const;
