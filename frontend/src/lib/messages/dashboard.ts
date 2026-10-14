export const dashboard = {
  pageTitle: 'Dashboard',
  description: 'Visão geral do que requer atenção e das principais informações no seu escopo.',
  greeting: (firstName: string): string => `Olá, ${firstName}`,

  sections: {
    needsAttention: 'O que requer atenção agora',
    overview: 'Visão dos módulos',
    distribution: 'Distribuições',
    plannedModules: 'Módulos planejados',
  },

  states: {
    loadingLabel: 'Carregando dados do dashboard…',
    errorTitle: 'Não foi possível carregar o dashboard',
    retry: 'Tentar novamente',
    noData: 'Sem dados calculados ainda.',
    summaryUnavailable:
      'Não foi possível carregar o resumo das demais áreas agora. O que aparece abaixo pode estar incompleto.',
    nothingVisible: {
      title: 'Nada para mostrar aqui ainda',
      description:
        'Seu perfil de acesso não inclui nenhuma das áreas que esta tela resume. Use o menu ' +
        'lateral para abrir os módulos disponíveis para você.',
    },
  },

  quickActions: {
    heading: 'Ações rápidas',
    newRisk: 'Registrar risco',
    newIncident: 'Registrar incidente',
    newProblem: 'Registrar problema',
    myActions: 'Meus planos de ação',
    indicators: 'Ver indicadores',
    reports: 'Abrir relatórios',
  },

  attention: {
    pendingApprovals: {
      title: 'Aprovações pendentes',
      context: 'aguardando sua decisão',
    },
    overdueActions: {
      title: 'Ações atrasadas',
      context: 'fora do prazo, de qualquer origem',
      link: 'Ver planos de ação',
    },
    dueSoonActions: {
      title: 'Ações vencendo em breve',
      context: (days: number): string => `prazo nos próximos ${String(days)} dias`,
      link: 'Ver planos de ação',
    },
    itemsRequiringReview: {
      title: 'Riscos para revisão',
      context: 'com revisão vencida',
      link: 'Ver riscos',
    },
    openIncidents: {
      title: 'Incidentes abertos',
      context: (critical: number | undefined): string => {
        if (critical === undefined) return 'em aberto';
        return critical === 1 ? '1 crítico' : `${critical.toLocaleString('pt-BR')} críticos`;
      },
      link: 'Ver incidentes',
    },
    pendingProblems: {
      title: 'Problemas pendentes',
      context: 'abertos ou em análise',
      link: 'Ver problemas',
    },
    indicatorsInAlert: {
      title: 'Indicadores em alerta',
      context: 'fora do limiar definido',
      link: 'Ver indicadores',
    },
  },

  modules: {
    risks: {
      title: 'Riscos',
      total: 'Total',
      high: 'Altos',
      critical: 'Críticos',
      link: 'Acessar riscos',
    },
    actions: {
      title: 'Planos de Ação',
      open: 'Em aberto',
      overdue: 'Atrasadas',
      dueSoon: 'Vencendo',
      link: 'Acessar planos de ação',
    },
    incidents: {
      title: 'Incidentes',
      open: 'Abertos',
      critical: 'Críticos',
      link: 'Acessar incidentes',
    },
    problems: {
      title: 'Problemas',
      open: 'Abertos',
      critical: 'Críticos',
      link: 'Acessar problemas',
    },
    controls: {
      title: 'Controles',
      total: 'Total',
      ineffective: 'Inefetivos',
      inactive: 'Inativos',
      link: 'Acessar controles',
    },
    compliance: {
      title: 'Compliance',
      percentage: 'Conforme',
      requirements: 'Requisitos',
      notMet: 'Não atendidos',
      link: 'Acessar compliance',
    },
    audits: {
      title: 'Auditoria',
      openEngagements: 'Abertas',
      openFindings: 'Achados',
      criticalFindings: 'Críticos',
      link: 'Acessar auditoria',
    },
    indicators: {
      title: 'Indicadores',
      monitored: 'Monitorados',
      breached: 'Fora do limiar',
      link: 'Acessar indicadores',
    },
  },

  charts: {
    riskLevel: {
      title: 'Riscos por nível (residual)',
      description: 'Distribuição dos riscos no seu escopo pelo nível de risco residual.',
      caption: 'Tabela: quantidade de riscos por nível de risco residual',
      columnHeaderLevel: 'Nível de risco residual',
      columnHeaderCount: 'Quantidade',
    },
    riskStatus: {
      title: 'Riscos por status',
      description: 'Distribuição dos riscos no seu escopo pela etapa atual do ciclo de vida.',
      caption: 'Tabela: quantidade de riscos por status',
      columnHeaderStatus: 'Status',
      columnHeaderCount: 'Quantidade',
    },
    actionStatus: {
      title: 'Planos de ação por status',
      description: 'Ações de qualquer origem no seu escopo, pela situação atual.',
      caption: 'Tabela: quantidade de ações por status',
      columnHeaderStatus: 'Status',
      columnHeaderCount: 'Quantidade',
      totalLabel: 'Total',
    },
  },

  plannedArea: {
    badge: 'Planejado',
    message: 'Módulo planejado — ainda não implementado nesta versão.',
  },
} as const;
