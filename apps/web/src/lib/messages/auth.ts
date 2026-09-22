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
    // Names the outer `<section>` (brand, slogan, card and institutional
    // footer) — distinct from `formAriaLabel`, which names the `<form>`
    // nested inside it. Reusing `formAriaLabel` here gave the page two
    // same-named landmarks (`SECTION:Entrar` and `FORM:Entrar`).
    institutionalAriaLabel: 'Acesso institucional',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    submit: 'Entrar',
    submitting: 'Entrando…',
    slogan: 'Mais visão para o que importa.',
    introduction: 'Gestão integrada para um ambiente mais seguro, resiliente e em conformidade.',
    emailPlaceholder: 'seu@dominio.gov.br',
    passwordPlaceholder: 'Digite sua senha',
    showPassword: 'Mostrar senha',
    hidePassword: 'Ocultar senha',
    restricted: 'Acesso restrito',
    institution: 'Agência Espacial Brasileira — AEB',
    signature: 'Solução institucional de Governança, Riscos e Compliance',
    inspiredBy: 'INSPIRADO EM',
    proteus: 'Proteu',
    origin: 'O nome Pharos remete à cratera Pharos, em Proteu, uma das luas de Netuno.',
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
