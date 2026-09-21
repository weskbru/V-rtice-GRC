/**
 * PharosGRC — authentication screens and flows (pt-BR).
 *
 * Covers `(public)/login/` and the in-place re-authentication seam
 * (`components/shell/session-expired-dialog.tsx`) — both submit to the same
 * `POST /auth/login`, so they intentionally share the same field labels and
 * the same generic credentials-rejection copy (`errors.invalidCredentials`).
 */
export const auth = {
  brand: {
    name: 'PharosGRC',
    tagline: 'Plataforma de Governança, Riscos e Compliance',
  },
  login: {
    pageTitle: 'Entrar — PharosGRC',
    heading: 'Entrar',
    subheading: 'Use suas credenciais organizacionais para acessar o ambiente de trabalho.',
    formAriaLabel: 'Entrar',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    submit: 'Entrar',
    submitting: 'Entrando…',
    footer: 'O acesso é provisionado pelo administrador da sua organização.',
  },
  sessionExpired: {
    title: 'Sua sessão expirou',
    descriptionPrefix: 'Entre novamente para continuar como',
    descriptionSuffix:
      '. As informações que você já preencheu nesta página continuam aqui — entrar não fará você perdê-las.',
    signInAsSomeoneElse: 'Entrar como outra pessoa',
    submit: 'Continuar',
    submitting: 'Entrando…',
  },
} as const;
