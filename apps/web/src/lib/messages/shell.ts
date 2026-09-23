export const shell = {
  brandFallback: 'PharosGRC',
  skipToContent: 'Pular para o conteúdo principal',
  navigationPending: 'Carregando página…',
  sidebar: {
    ariaLabel: 'Navegação principal',
    plannedBadge: 'Planejado',
    plannedTitle: (label: string): string =>
      `${label} é um módulo planejado — ainda não disponível`,
    collapse: 'Recolher menu lateral',
    expand: 'Expandir menu lateral',
  },
  sections: {
    grc: 'Módulos de GRC',
    administration: 'Administração',
  },
  navigation: {
    modules: {
      dashboard: 'Dashboard',
      myActions: 'Planos de Ação',
      risks: 'Riscos',
      problems: 'Problemas',
      incidents: 'Incidentes',
      controls: 'Controles',
      assets: 'Ativos',
      processes: 'Processos',
      compliance: 'Compliance',
      audits: 'Auditoria',
      indicators: 'Indicadores',
      reports: 'Relatórios',
    },
    administration: {
      users: 'Usuários',
      roles: 'Papéis e permissões',
      organization: 'Estrutura organizacional',
    },
  },
  header: {
    breadcrumbAriaLabel: 'Trilha de navegação',
    fallbackLabels: {
      profile: 'Perfil',
    },
  },
  themeToggle: {
    label: 'Alternar entre tema claro e escuro',
  },
  userMenu: {
    accountMenuAriaLabel: (fullName: string): string => `Menu da conta de ${fullName}`,
    profile: 'Perfil',
    signOut: 'Sair',
    signingOut: 'Saindo…',
  },
  notifications: {
    bellAriaLabel: 'Notificações',
    bellAriaLabelWithUnread: (unreadCount: number): string =>
      `Notificações (${unreadCount.toLocaleString('pt-BR')} não lidas)`,
    panelTitle: 'Notificações',
    loading: 'Carregando notificações…',
    loadError: 'Não foi possível carregar as notificações.',
    empty: 'Nenhuma notificação por enquanto.',
    markAllRead: 'Marcar todas como lidas',
    markAllReadSuccess: 'Todas as notificações foram marcadas como lidas.',
    markAllReadError: 'Não foi possível marcar as notificações como lidas.',
    markOneReadLabel: 'Marcar como lida',
    markOneReadError: 'Não foi possível marcar a notificação como lida.',
    unreadIndicatorLabel: 'Não lida',
  },
} as const;
