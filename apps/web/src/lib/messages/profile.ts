/**
 * PharosGRC — own-profile screen and change-password form (pt-BR, FR-009, FR-010).
 */
export const profile = {
  pageTitle: 'Perfil',
  pageDescription: 'Sua identidade e credenciais.',
  forcedPasswordChange: {
    title: 'Você precisa alterar sua senha para continuar',
    description:
      'Sua conta foi criada com uma senha temporária. Defina uma nova senha abaixo antes de continuar usando o restante do ambiente de trabalho.',
  },
  loading: 'Carregando seu perfil…',
  identity: {
    cardTitle: 'Identidade',
    fullName: 'Nome completo',
    email: 'E-mail',
    jobTitle: 'Cargo',
    status: 'Status',
    organizationalUnit: 'Unidade organizacional',
    roles: 'Papéis',
    lastLogin: 'Último acesso',
    firstLogin: 'Este é o seu primeiro acesso',
    notSetJobTitle: 'Não definido',
    notAssignedOrgUnit: 'Não atribuído',
    noRolesAssigned: 'Nenhum atribuído',
    /*
     * `roleLabels` USED to live here: a second map from `Role.name` to a
     * pt-BR label, live on this screen since 001, covering SIX of the twelve
     * seeded roles. The other six — Audit Lead, Compliance Manager, Control
     * Owner, Control Approver, Incident Manager, Problem Manager — were
     * seeded later and never added, so the "Papéis" line printed pt-BR for
     * one person and English for the next. Nothing failed, because the
     * lookup was `map[name] ?? name` and a fallback never fails.
     *
     * The canonical map is `common.roleDisplayNames`, resolved by
     * `roleDisplayName` (`@/lib/role-display-name`) — the single point of
     * translation ADR-022 requires and CLAUDE.md §19.7 demands. Do not
     * reintroduce a role map here, or anywhere else: a second one is the
     * defect, not a convenience.
     */
  },
  changePassword: {
    cardTitle: 'Alterar senha',
    currentPasswordLabel: 'Senha atual',
    newPasswordLabel: 'Nova senha',
    newPasswordHint: 'Pelo menos 12 caracteres.',
    confirmNewPasswordLabel: 'Confirmar nova senha',
    submit: 'Alterar senha',
    submitting: 'Alterando senha…',
    successTitle: 'Senha alterada',
    successDescription: 'Entre novamente com sua nova senha.',
    /**
     * A 401 from `POST /auth/me/password` is contractually ambiguous
     * (wrong current password vs. an already-expired session — see the
     * form's own doc comment). This message deliberately covers both
     * without disclosing which one actually happened.
     */
    ambiguousUnauthorized:
      'A senha atual informada está incorreta ou sua sessão expirou. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    genericError: 'Não foi possível concluir a alteração de senha. Tente novamente.',
  },
} as const;
