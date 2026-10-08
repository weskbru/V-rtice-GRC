import type {
  AuditEngagementListSortField,
  AuditEngagementStatus,
  AuditScopeTargetType,
  SortDirection,
} from '@/features/audit-engagements/types';
import type { StatusVariant } from '@pharos/design-system/components';

const AUDIT_ENGAGEMENT_STATUS_LABELS: Record<AuditEngagementStatus, string> = {
  PLANNING: 'Planejamento',
  IN_PROGRESS: 'Em execução',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

const AUDIT_ENGAGEMENT_STATUS_VARIANT: Record<AuditEngagementStatus, StatusVariant> = {
  PLANNING: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const AUDIT_SCOPE_TARGET_TYPE_LABELS: Record<AuditScopeTargetType, string> = {
  FRAMEWORK_VERSION: 'Versão de framework',
  REQUIREMENT: 'Requisito',
  CONTROL: 'Controle',
};

const AUDIT_ENGAGEMENT_SORT_LABELS: Record<AuditEngagementListSortField, string> = {
  code: 'Código',
  periodStart: 'Início do período',
  updatedAt: 'Atualizado em',
};

export const auditEngagements = {
  statusLabels: AUDIT_ENGAGEMENT_STATUS_LABELS,
  statusVariant: AUDIT_ENGAGEMENT_STATUS_VARIANT,
  scopeTargetTypeLabels: AUDIT_SCOPE_TARGET_TYPE_LABELS,
  sortLabels: AUDIT_ENGAGEMENT_SORT_LABELS,

  navigation: {
    label: 'Auditoria',
  },

  register: {
    pageTitle: 'Auditoria',
    pageDescription:
      'Engajamentos de auditoria: o que cada um examina, quem o conduz e em que estado se encontra.',
    createAction: 'Novo engajamento',
    tableCaption: 'Lista de engajamentos de auditoria',

    summary: {
      regionLabel: 'Indicadores de engajamentos de auditoria',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de engajamentos',
        hint: 'Todos os engajamentos de auditoria',
        linkLabel: 'Ver todos os engajamentos',
      },
      planning: {
        label: 'Em planejamento',
        hint: 'Ainda não iniciados',
        linkLabel: 'Ver engajamentos em planejamento',
      },
      inProgress: {
        label: 'Em execução',
        hint: 'Aceitando achados',
        linkLabel: 'Ver engajamentos em execução',
      },
      completed: {
        label: 'Concluídos',
        hint: 'Ciclo encerrado',
        linkLabel: 'Ver engajamentos concluídos',
      },
    },

    view: {
      cards: 'Cards',
      cardsLabel: 'Exibir como cards',
      table: 'Tabela',
      tableLabel: 'Exibir como tabela',
      groupLabel: 'Modo de exibição',
    },

    filters: {
      regionLabel: 'Filtros dos engajamentos de auditoria',
      groupLabel: 'Filtros',
      statusLabel: 'Status',
      statusAll: 'Todos os status',
      orgUnitLabel: 'Unidade organizacional',
      leadAuditorLabel: 'Auditor responsável',
      loadingOptions: 'Carregando opções…',
      optionsError: 'Não foi possível carregar as opções de filtro.',
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 engajamento' : `${total.toLocaleString('pt-BR')} engajamentos`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      } satisfies Record<SortDirection, string>,
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} — ${directionLabel}`,
      sortOptions: {
        'code:asc': 'Código — crescente',
        'code:desc': 'Código — decrescente',
        'periodStart:asc': 'Início do período — crescente',
        'periodStart:desc': 'Início do período — decrescente',
        'updatedAt:asc': 'Atualizado em — crescente',
        'updatedAt:desc': 'Atualizado em — decrescente',
      } as Record<string, string>,
      sortFieldLabels: AUDIT_ENGAGEMENT_SORT_LABELS,
    },

    columns: {
      code: 'Código',
      objective: 'Objetivo',
      period: 'Período',
      orgUnit: 'Unidade organizacional',
      leadAuditor: 'Auditor responsável',
      status: 'Status',
      updatedAt: 'Última atualização',
    },

    card: {
      regionLabel: 'Engajamentos de auditoria',
      selectLabel: (code: string, objective: string): string =>
        `Abrir engajamento ${code} — ${objective}`,
      periodLabel: (start: string, end: string): string => `${start} a ${end}`,
      orgUnitLabel: 'Unidade',
      leadAuditorLabel: 'Auditor responsável',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },

    loading: 'Carregando engajamentos…',
    loadError: 'Não foi possível carregar os engajamentos de auditoria.',
    retryAction: 'Tentar novamente',

    empty: {
      noneYet: {
        title: 'Nenhum engajamento de auditoria cadastrado',
        description:
          'Abra o primeiro engajamento para começar a examinar controles, requisitos e versões de framework da organização.',
        createAction: 'Abrir engajamento',
      },
      noResults: {
        title: 'Nenhum engajamento encontrado',
        description: 'Nenhum engajamento corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  detail: {
    loading: 'Carregando engajamento…',
    notFoundTitle: 'Engajamento não encontrado',
    notFoundDescription:
      'Este engajamento não existe ou está fora do seu escopo organizacional de acesso.',
    editAction: 'Editar',
    breadcrumbLabel: 'Auditoria',
    backToRegister: 'Voltar à auditoria',
    metadata: {
      code: (code: string): string => `Código: ${code}`,
      orgUnit: (name: string): string => `Unidade: ${name}`,
      leadAuditor: (name: string): string => `Auditor responsável: ${name}`,
      period: (start: string, end: string): string => `Período: ${start} a ${end}`,
      createdAt: (date: string): string => `Aberto em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      startedAt: (date: string): string => `Iniciado em ${date}`,
      completedAt: (date: string): string => `Concluído em ${date}`,
      cancelledAt: (date: string): string => `Cancelado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      scope: 'Escopo',
      findings: 'Achados',
      lifecycle: 'Ciclo de vida',
    },
    overview: {
      objectiveLabel: 'Objetivo',
      objectiveCardTitle: 'Objetivo do engajamento',
      executionCardTitle: 'Execução e responsabilidade',
      registerCardTitle: 'Registro',
      notSet: 'Não definido',
      periodLabel: 'Período',
      orgUnitLabel: 'Unidade organizacional',
      leadAuditorLabel: 'Auditor responsável',
      statusLabel: 'Status',
      createdAtLabel: 'Aberto em',
      updatedAtLabel: 'Atualizado em',
      cancellationJustificationLabel: 'Justificativa do cancelamento',
    },
  },

  form: {
    createTitle: 'Novo engajamento de auditoria',
    createDescription:
      'Defina o objetivo, o período e quem conduz o engajamento. O escopo é definido depois, em uma etapa própria.',
    editTitle: 'Editar engajamento',
    editNotPlanningNotice:
      'Este engajamento só pode ser editado enquanto está em planejamento. Depois de iniciado, seus dados descritivos ficam fixos.',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que este engajamento examina e por quê.',
      },
      scheduling: {
        title: 'Período e responsabilidade',
        description: 'Quando o engajamento ocorre e quem o conduz.',
      },
    },
    fields: {
      objective: {
        label: 'Objetivo',
        description: 'O que este engajamento se propõe a examinar.',
      },
      periodStart: { label: 'Início do período' },
      periodEnd: { label: 'Fim do período' },
      orgUnit: { label: 'Unidade organizacional', placeholder: 'Selecione a unidade' },
      leadAuditor: {
        label: 'Auditor responsável',
        placeholder: 'Selecione o auditor responsável',
        loading: 'Carregando auditores elegíveis…',
        empty: 'Nenhum usuário elegível para conduzir este engajamento.',
        loadError: 'Não foi possível carregar os auditores elegíveis.',
      },
    },
    unsavedNote: 'As alterações só são salvas ao confirmar.',
    actions: {
      save: 'Salvar alterações',
      saving: 'Salvando…',
      saveAndCreate: 'Abrir engajamento',
      creating: 'Abrindo…',
    },
    createSuccess: 'Engajamento aberto.',
    updateSuccess: 'Engajamento atualizado.',
    genericError: 'Não foi possível salvar o engajamento. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
    conflict: {
      title: 'Este engajamento foi alterado por outra pessoa',
      description:
        'Alguém salvou uma alteração neste engajamento enquanto você editava. Seus dados não foram descartados.',
      modifiedBy: (name: string): string => `Alterado por: ${name}`,
      modifiedAt: (date: string): string => `Alterado em: ${date}`,
      reloadAction: 'Ver versão atual em nova aba',
      retryAction: 'Salvar mesmo assim com meus dados',
      dismissAction: 'Continuar editando',
    },
    validation: {
      objective: {
        required: 'Informe o objetivo do engajamento.',
        tooLong: 'O objetivo é muito longo.',
      },
      periodStart: { required: 'Informe o início do período.' },
      periodEnd: {
        required: 'Informe o fim do período.',
        beforeStart: 'O fim do período não pode ser anterior ao início.',
      },
      orgUnit: { required: 'Selecione a unidade organizacional.' },
      leadAuditor: { required: 'Selecione o auditor responsável.' },
    },
  },

  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Transições disponíveis a partir do estado atual, para o seu perfil.',
    noneAvailable:
      'Nenhuma transição disponível — o ciclo de vida deste engajamento está encerrado.',
    scopeLoadError: 'Não foi possível verificar o escopo deste engajamento.',
    conflictError:
      'Este engajamento foi alterado por outra pessoa. Recarregue a página para ver o estado atual.',

    start: {
      action: 'Iniciar engajamento',
      confirmTitle: 'Iniciar este engajamento?',
      confirmDescription:
        'O engajamento passa a "Em execução" e passa a aceitar o registro de achados. O escopo definido até agora fica fixo — revise-o antes de confirmar.',
      confirmAction: 'Iniciar',
      starting: 'Iniciando…',
      success: 'Engajamento iniciado.',
      genericError: 'Não foi possível iniciar o engajamento.',
      noScopeNotice:
        'É preciso adicionar ao menos um item ao escopo — uma versão de framework, um requisito ou um controle — antes de iniciar este engajamento.',
      noScopeError:
        'Este engajamento ainda não tem escopo definido. Adicione ao menos um item antes de iniciar.',
    },

    complete: {
      action: 'Concluir engajamento',
      confirmTitle: 'Concluir este engajamento?',
      confirmDescription:
        'O engajamento passa a "Concluído", um estado definitivo. Nenhum achado novo poderá ser registrado a partir dele depois disso.',
      confirmAction: 'Concluir',
      completing: 'Concluindo…',
      success: 'Engajamento concluído.',
      genericError: 'Não foi possível concluir o engajamento.',
    },

    cancel: {
      action: 'Cancelar engajamento',
      confirmTitle: 'Cancelar este engajamento?',
      confirmDescription:
        'O engajamento passa a "Cancelado", um estado definitivo. Ele permanece legível e consultável — nada é apagado — mas não pode mais avançar nem receber achados.',
      justificationLabel: 'Justificativa do cancelamento',
      justificationHelper:
        'Obrigatória: descreva por que este engajamento está sendo cancelado. Fica registrada permanentemente no engajamento e na trilha de auditoria.',
      justificationRequired: 'Informe a justificativa do cancelamento.',
      confirmAction: 'Confirmar cancelamento',
      cancelling: 'Cancelando…',
      dismissAction: 'Manter engajamento',
      success: 'Engajamento cancelado.',
      genericError: 'Não foi possível cancelar o engajamento.',
    },
  },

  scope: {
    sectionDescription:
      'O que este engajamento examina — versões de framework, requisitos e/ou controles. Cada item é uma decisão explícita do auditor: nada aqui é sugerido ou pré-marcado automaticamente.',
    loading: 'Carregando escopo…',
    loadError: 'Não foi possível carregar o escopo deste engajamento.',
    empty: 'Nenhum item no escopo deste engajamento ainda.',
    notPlanningNotice:
      'O escopo só pode ser alterado enquanto o engajamento está em planejamento. Depois de iniciado, o escopo fica fixo.',
    noRemovalNotice:
      'Não é possível remover um item do escopo depois de adicionado. Um item incluído por engano é corrigido adicionando o item correto — o escopo de um engajamento é, ele próprio, um registro do que foi examinado.',

    columns: {
      targetType: 'Tipo',
      target: 'Item',
      linkedBy: 'Adicionado por',
      linkedAt: 'Adicionado em',
    },

    addAction: 'Adicionar ao escopo',
    variantTabs: {
      frameworkVersion: 'Versão de framework',
      requirement: 'Requisito',
      control: 'Controle',
    },

    frameworkPicker: {
      label: 'Framework',
      placeholder: 'Selecione um framework',
      noOptions: 'Nenhum framework disponível.',
      loadError: 'Não foi possível carregar os frameworks disponíveis.',
    },

    frameworkVersion: {
      pickerLabel: 'Versão de framework',
      pickerPlaceholder: 'Selecione uma versão publicada',
      pickerNoOptions: 'Nenhuma versão publicada disponível para adicionar.',
      addSuccess: 'Versão de framework adicionada ao escopo.',
      addError: 'Não foi possível adicionar esta versão ao escopo. Tente novamente.',
      alreadyInScopeError: 'Esta versão já está no escopo deste engajamento.',
      notPublishedError:
        'Só é possível adicionar ao escopo uma versão de framework publicada — uma versão em rascunho ainda pode mudar.',
    },

    requirement: {
      pickerLabel: 'Requisito',
      pickerPlaceholder: 'Selecione um requisito',
      pickerNoOptions: 'Nenhum requisito disponível para adicionar.',
      addSuccess: 'Requisito adicionado ao escopo.',
      addError: 'Não foi possível adicionar este requisito ao escopo. Tente novamente.',
      alreadyInScopeError: 'Este requisito já está no escopo deste engajamento.',
      notPublishedError:
        'Só é possível adicionar ao escopo um requisito cuja versão de framework esteja publicada.',
    },

    control: {
      pickerLabel: 'Controle',
      pickerPlaceholder: 'Selecione um controle',
      pickerNoOptions: 'Nenhum controle disponível para adicionar.',
      pickerSearchPlaceholder: 'Buscar controle por nome ou código',
      pickerAriaLabel: 'Selecionar controle',
      addSuccess: 'Controle adicionado ao escopo.',
      addError: 'Não foi possível adicionar este controle ao escopo. Tente novamente.',
      alreadyInScopeError: 'Este controle já está no escopo deste engajamento.',
      outOfScopeError:
        'Este controle não pôde ser adicionado ao escopo — ele não existe, não está ativo, ou está fora do seu escopo organizacional.',
    },
  },

  findingsFromEngagement: {
    sectionDescription:
      'Achados registrados a partir deste engajamento. A origem de cada um fica visível no próprio achado.',
    newAction: 'Registrar achado',
    loading: 'Carregando achados…',
    loadError: 'Não foi possível carregar os achados deste engajamento.',
    empty: 'Nenhum achado registrado a partir deste engajamento ainda.',
    notInProgressNotice: 'Só é possível registrar achados enquanto o engajamento está em execução.',
    notInProgressError:
      'Este engajamento não está em execução — não é possível registrar um novo achado.',
    columns: {
      code: 'Código',
      title: 'Título',
      category: 'Categoria',
      severity: 'Severidade',
      priority: 'Prioridade',
      status: 'Status',
      identifiedOn: 'Identificado em',
    },

    form: {
      createTitle: 'Registrar achado',
      createDescription:
        'A unidade organizacional deste achado é a mesma do engajamento e não pode ser alterada aqui.',
      submit: 'Registrar',
      submitting: 'Registrando…',
      createSuccess: 'Achado registrado e vinculado a este engajamento.',
      genericError: 'Não foi possível registrar o achado. Tente novamente.',
      fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    },

    originNotice: (engagementCode: string): string =>
      `Este achado foi produzido pelo engajamento de auditoria ${engagementCode}.`,
    manualOriginNotice: 'Este achado foi registrado manualmente, sem vínculo a um engajamento.',
    originNoticeUnknown: 'Este achado foi produzido por um engajamento de auditoria.',
  },

  remediation: {
    action: 'Mover para remediação',
    confirmTitle: 'Mover este achado para remediação?',
    confirmDescription:
      'O achado passa de "Aberto" para "Em remediação". Esta transição fica registrada na trilha de auditoria.',
    confirmAction: 'Confirmar',
    confirming: 'Movendo…',
    success: 'Achado movido para remediação.',
    genericError: 'Não foi possível mover o achado para remediação.',
    notOpenError: 'Só é possível mover para remediação um achado que esteja "Aberto".',
  },

  closureEvidenceRequirement: {
    title: 'Encerrar um achado agora exige evidência',
    description:
      'Além da ação de remediação concluída ou da justificativa já exigidas, é preciso vincular ao menos uma evidência a este achado antes de encerrá-lo — de qualquer status, inclusive uma evidência arquivada.',
    noEvidenceError:
      'Este achado não tem nenhuma evidência vinculada. Vincule ao menos uma evidência antes de encerrar.',
  },

  findingLinks: {
    includeWithdrawnLabel: 'Mostrar vínculos desfeitos',
    withdrawnBadge: 'Desfeito',
    withdrawnAt: (date: string): string => `Desvinculado em ${date}`,

    controls: {
      sectionTitle: 'Controles',
      sectionDescription: 'Controles que este achado aponta.',
      pickerLabel: 'Vincular controle',
      pickerPlaceholder: 'Selecione um controle',
      pickerNoOptions: 'Nenhum controle disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar controle por nome ou código',
      pickerAriaLabel: 'Selecionar controle',
      empty: 'Nenhum controle vinculado a este achado.',
      loading: 'Carregando controles vinculados…',
      loadError: 'Não foi possível carregar os controles vinculados a este achado.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Controle vinculado.',
      unlinkSuccess: 'Controle desvinculado.',
      linkError: 'Não foi possível vincular o controle. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o controle. Tente novamente.',
      alreadyLinkedError: 'Este controle já está vinculado a este achado.',
      outOfScopeError:
        'Este controle não pôde ser vinculado — ele não existe, não está ativo, ou está fora do seu escopo organizacional.',
      archivedFindingError: 'Um achado arquivado não aceita novos vínculos.',
      unlinkConfirm: {
        title: 'Desvincular controle?',
        description: (name: string): string =>
          `O controle "${name}" será desvinculado deste achado. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { control: 'Controle', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },

    risks: {
      sectionTitle: 'Riscos',
      sectionDescription: 'Riscos que este achado materializa.',
      pickerLabel: 'Vincular risco',
      pickerPlaceholder: 'Selecione um risco',
      pickerNoOptions: 'Nenhum risco disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar risco por título ou código',
      pickerAriaLabel: 'Selecionar risco',
      empty: 'Nenhum risco vinculado a este achado.',
      loading: 'Carregando riscos vinculados…',
      loadError: 'Não foi possível carregar os riscos vinculados a este achado.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Risco vinculado.',
      unlinkSuccess: 'Risco desvinculado.',
      linkError: 'Não foi possível vincular o risco. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o risco. Tente novamente.',
      alreadyLinkedError: 'Este risco já está vinculado a este achado.',
      outOfScopeError:
        'Este risco não pôde ser vinculado — ele não existe, está arquivado, ou está fora do seu escopo organizacional.',
      archivedFindingError: 'Um achado arquivado não aceita novos vínculos.',
      unlinkConfirm: {
        title: 'Desvincular risco?',
        description: (name: string): string =>
          `O risco "${name}" será desvinculado deste achado. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { risk: 'Risco', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
  },

  correctiveActions: {
    sectionTitle: 'Ações de remediação',
    sectionDescription:
      'Ações corretivas vinculadas a este achado, com prazo, responsável e status.',
    loading: 'Carregando ações de remediação…',
    loadError: 'Não foi possível carregar as ações de remediação.',
    empty: 'Nenhuma ação de remediação registrada ainda.',
    addAction: 'Adicionar ação de remediação',
    loadMore: 'Carregar mais',
    transitionError: 'Não foi possível aplicar a transição.',
    columns: {
      code: 'Código',
      title: 'Título',
      responsible: 'Responsável',
      dueOn: 'Prazo',
      status: 'Status',
      rowActions: 'Ações',
    },
    form: {
      cardTitle: 'Nova ação de remediação',
      fields: {
        title: { label: 'Título' },
        description: { label: 'Descrição' },
        responsible: { label: 'Responsável', placeholder: 'Selecione o responsável' },
        dueOn: { label: 'Prazo' },
      },
      actions: {
        submit: 'Adicionar ação',
        submitting: 'Adicionando…',
        cancel: 'Cancelar',
      },
      validation: {
        titleRequired: 'O título é obrigatório.',
        responsibleRequired: 'Selecione o responsável pela ação.',
        dueOnRequired: 'Informe o prazo da ação.',
      },
      submitSuccess: 'Ação de remediação adicionada.',
      genericError: 'Não foi possível adicionar a ação de remediação. Tente novamente.',
    },
    toggleExpandSr: 'Ver ações de remediação',
    toggleCollapseSr: 'Ocultar ações de remediação',
  },

  aria: {
    registerRegionLabel: 'Lista de engajamentos de auditoria',
    scopeRegionLabel: 'Escopo do engajamento',
    findingsRegionLabel: 'Achados do engajamento',
    findingControlsRegionLabel: 'Controles vinculados ao achado',
    findingRisksRegionLabel: 'Riscos vinculados ao achado',
    findingCorrectiveActionsRegionLabel: 'Ações de remediação do achado',
    lifecycleRegionLabel: 'Ações de ciclo de vida do engajamento',
    closeDialog: 'Fechar',
  },
} as const;
