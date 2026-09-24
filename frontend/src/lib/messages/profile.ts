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
    ambiguousUnauthorized:
      'A senha atual informada está incorreta ou sua sessão expirou. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    genericError: 'Não foi possível concluir a alteração de senha. Tente novamente.',
  },
} as const;
