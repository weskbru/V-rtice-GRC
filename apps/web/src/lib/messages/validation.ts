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
