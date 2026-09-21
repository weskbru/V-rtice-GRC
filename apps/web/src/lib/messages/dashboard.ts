/**
 * PharosGRC — GRC dashboard (pt-BR, FR-047 to FR-052, SC-013).
 *
 * The platform's landing screen, not Risk Management's. It answers three
 * questions in order — what needs attention now, how each area stands, where
 * to go next — and only for the capabilities the caller can actually see.
 *
 * ## Labels that are NOT restated here
 *
 * Status names (`Em andamento`, `Em análise`, the four action statuses) come
 * from each domain's own catalogue (`incidents.statusLabels`,
 * `problems.statusLabels`, `actions.statusLabels`) wherever the dashboard
 * shows exactly that status — never a second copy that could drift
 * (CLAUDE.md §13.8). What lives here is the dashboard's own framing: card
 * titles, the short context lines under a number, and link text.
 */
export const dashboard = {
  pageTitle: 'Dashboard',
  description: 'Visão geral do que requer atenção e das principais informações no seu escopo.',
  /** Hero greeting above the page title — "Olá, Ada", the reader's own first name. */
  greeting: (firstName: string): string => `Olá, ${firstName}`,

  sections: {
    needsAttention: 'O que requer atenção agora',
    overview: 'Visão dos módulos',
    /** Visually hidden — the three chart cards carry their own titles. */
    distribution: 'Distribuições',
    plannedModules: 'Módulos planejados',
  },

  states: {
    loadingLabel: 'Carregando dados do dashboard…',
    errorTitle: 'Não foi possível carregar o dashboard',
    retry: 'Tentar novamente',
    /**
     * A metric whose source has no data at all — distinct from a real zero
     * all the way from `IndicatorCalculationService`, and kept distinct here
     * (the same "nunca 0 nem 100" rule the indicator screens follow).
     */
    noData: 'Sem dados calculados ainda.',
    /**
     * `GET /dashboard/summary` failed while `GET /dashboard` succeeded. The
     * risk view still renders; saying nothing would leave a caller with
     * incident or control access looking at a screen indistinguishable from
     * "you have access to nothing else".
     */
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

  /** "O que requer atenção agora". Each is a number, the words that give it meaning, and a way in. */
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

  /**
   * "Visão dos módulos". Row labels sit under a number in a column roughly
   * 60-70px wide, so they are kept to one or two short words: the first
   * capture broke "Conformidade" and "Engajamentos" mid-word across two lines.
   * The card title already names the area ("Auditoria"), so "Abertas",
   * "Achados" and "Críticos" read in its context without repeating it.
   */
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

  /** Chart chrome only — level/status labels are reused from each domain's catalogue (CLAUDE.md §13.8). */
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

  /** Planned-module cards (`plannedAreas` from the API). The registry is empty today; the section renders only when it holds an entry. */
  plannedArea: {
    badge: 'Planejado',
    message: 'Módulo planejado — ainda não implementado nesta versão.',
  },
} as const;
