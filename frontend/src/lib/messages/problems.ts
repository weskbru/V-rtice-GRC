import type { ProblemSeverity, ProblemStatus } from '@/features/problems/types';

const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  OPEN: 'Aberto',
  IN_ANALYSIS: 'Em análise',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

const PROBLEM_SEVERITY_LABELS: Record<ProblemSeverity, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const problems = {
  entityLabel: 'problema',
  navLabel: 'Problemas',
  statusLabels: PROBLEM_STATUS_LABELS,
  severityLabels: PROBLEM_SEVERITY_LABELS,

  register: {
    pageTitle: 'Problemas',
    pageDescription:
      'Registro de problemas da organização — investigação de causa raiz e correção definitiva.',
    createAction: 'Novo problema',
    tableCaption: 'Lista de problemas registrados',
    searchLabel: 'Buscar problemas',
    searchPlaceholder: 'Buscar por código ou título…',
    columns: {
      code: 'Código',
      title: 'Título',
      severity: 'Severidade',
      status: 'Status',
      orgUnit: 'Unidade organizacional',
      owner: 'Responsável',
      identifiedOn: 'Identificado em',
      updatedAt: 'Última atualização',
      notSet: 'Não definido',
    },
    filters: {
      regionLabel: 'Filtros de problemas',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar problemas',
      searchPlaceholder: 'Buscar por código ou título…',
      statusLabel: 'Status',
      severityLabel: 'Severidade',
      orgUnitLabel: 'Unidade organizacional',
      optionsError: 'Não foi possível carregar as opções de filtro.',
      loadingOptions: 'Carregando opções…',
    },
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (value: string): string => `Busca: "${value}"`,
      valueChip: (field: string, value: string): string => `${field}: ${value}`,
      countChip: (field: string, count: number): string => `${field} (${count})`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
    },
    results: {
      count: (total: number): string =>
        total === 1 ? '1 problema' : `${total.toLocaleString('pt-BR')} problemas`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortOptions: {
        'identifiedOn:desc': 'Identificação (mais recente)',
        'identifiedOn:asc': 'Identificação (mais antiga)',
        'updatedAt:desc': 'Atualização (mais recente)',
        'code:asc': 'Código (A-Z)',
        'title:asc': 'Título (A-Z)',
      },
      sortFieldLabels: {
        code: 'Código',
        title: 'Título',
        severity: 'Severidade',
        status: 'Status',
        identifiedOn: 'Identificado em',
        updatedAt: 'Atualizado em',
      },
      sortDirectionLabels: { asc: 'crescente', desc: 'decrescente' },
      customSortOption: (field: string, direction: string): string => `${field} (${direction})`,
    },

    summary: {
      regionLabel: 'Situação geral dos problemas no seu escopo',
      open: {
        label: 'Abertos',
        hint: 'Ainda não iniciados',
        linkLabel: 'Filtrar o registro por problemas abertos',
      },
      inAnalysis: {
        label: 'Em análise',
        hint: 'Investigação em andamento',
        linkLabel: 'Filtrar o registro por problemas em análise',
      },
      resolved: {
        label: 'Resolvidos',
        hint: 'Causa raiz identificada',
        linkLabel: 'Filtrar o registro por problemas resolvidos',
      },
      closed: {
        label: 'Fechados',
        hint: 'Ciclo encerrado',
        linkLabel: 'Filtrar o registro por problemas fechados',
      },
      loading: 'Carregando indicadores…',
      error: 'Não foi possível carregar os indicadores.',
    },

    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver os problemas em cards',
      tableLabel: 'Ver os problemas em tabela',
    },

    card: {
      regionLabel: 'Problemas',
      orgUnitLabel: 'Unidade',
      ownerLabel: 'Responsável',
      identifiedOnLabel: 'Identificado em',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      openLabel: (code: string, title: string): string => `Abrir o problema ${code}: ${title}`,
    },

    empty: {
      noneYet: {
        title: 'Nenhum problema registrado',
        description: 'Registre o primeiro problema da sua unidade organizacional.',
        createAction: 'Registrar problema',
      },
      noResults: {
        title: 'Nenhum problema encontrado',
        description: 'Nenhum problema corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  form: {
    createHeading: 'Novo problema',
    editHeading: 'Editar problema',
    editDescription: 'Altere os dados cadastrais do problema.',
    createTitle: 'Novo problema',
    createDescription: 'Registre um problema para investigar sua causa raiz.',
    fields: {
      title: 'Título',
      description: 'Descrição',
      severity: 'Severidade',
      orgUnit: 'Unidade organizacional',
      owner: 'Responsável',
      identifiedOn: 'Data de identificação',
    },
    fieldHelpers: {
      orgUnit: 'A unidade organizacional determina o escopo de acesso a este problema.',
      owner: 'Quando não informado, o responsável é você mesmo.',
    },
    fieldPlaceholders: {
      orgUnit: 'Selecione a unidade organizacional',
      owner: 'Selecione o responsável',
      severity: 'Selecione a severidade',
    },
    sections: {
      identification: {
        title: 'Identificação',
        description: 'Dados descritivos do problema e sua unidade organizacional.',
      },
    },
    validation: {
      title: { required: 'Informe o título do problema.' },
      description: { required: 'Informe a descrição do problema.' },
      severity: { required: 'Selecione a severidade do problema.' },
      orgUnit: { required: 'Selecione a unidade organizacional.' },
      identifiedOn: { required: 'Informe a data de identificação.' },
    },
    submitCreateLabel: 'Registrar problema',
    submitEditLabel: 'Salvar alterações',
    createSuccess: 'Problema registrado.',
    updateSuccess: 'Problema atualizado.',
    createError: 'Não foi possível registrar o problema. Tente novamente.',
    updateError: 'Não foi possível atualizar o problema. Tente novamente.',
    genericError: 'Não foi possível salvar o problema. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência.',
    outOfScopeError:
      'A unidade organizacional informada não existe ou está fora do seu escopo organizacional.',
  },

  detail: {
    breadcrumbLabel: 'Problemas',
    loading: 'Carregando problema…',
    notFoundTitle: 'Problema não encontrado',
    notFoundDescription: 'Este problema não existe ou está fora do seu escopo organizacional.',
    editAction: 'Editar',
    metadata: {
      orgUnit: (name: string): string => `Unidade organizacional: ${name}`,
      createdAt: (date: string): string => `Registrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      risks: 'Riscos',
      incidents: 'Incidentes',
      correctiveActions: 'Ações corretivas',
      evidence: 'Evidência',
      attachments: 'Anexos',
      comments: 'Comentários',
    },

    groups: {
      overview: 'Visão geral',
      response: 'Resposta',
      relationships: 'Relacionamentos',
      register: 'Registro',
    },
    groupsAriaLabel: 'Grupos de seções do problema',
    sectionsAriaLabel: (groupLabel: string): string => `Seções de ${groupLabel}`,
    asideLabel: 'Contexto do problema',

    quickActions: {
      heading: 'Ações rápidas',
      linkRisk: 'Vincular risco',
      linkIncident: 'Vincular incidente',
      addCorrectiveAction: 'Adicionar ação corretiva',
      addEvidence: 'Adicionar evidência',
      comment: 'Comentar',
    },
    relationshipsPanel: {
      heading: 'Relacionamentos',
      risks: 'Riscos',
      incidents: 'Incidentes',
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',

    lifecycleOutcomes: {
      resolvedAtLabel: 'Resolvido em',
      resolvedByLabel: 'Resolvido por',
      closedAtLabel: 'Fechado em',
      closedByLabel: 'Fechado por',
      cancellationReasonLabel: 'Motivo do cancelamento',
    },

    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida do problema',
      cancelledAriaLabel: 'Problema cancelado',
      cancelledContextLabel: 'Encerrado por cancelamento',
      stateLabels: {
        current: 'Atual',
        completed: 'Concluído',
        available: 'Disponível',
        unavailable: 'Indisponível',
      },
    },
  },

  overview: {
    descriptionCardTitle: 'Descrição',
    rootCauseCardTitle: 'Causa raiz',
    rootCauseEmptyDescription: 'A causa raiz deste problema ainda não foi identificada.',
    detailsCardTitle: 'Detalhes do problema',
    fields: {
      severity: 'Severidade',
      orgUnit: 'Unidade organizacional',
      owner: 'Responsável',
      identifiedOn: 'Identificado em',
      createdAt: 'Registrado em',
    },
    notSet: 'Não definido',
  },

  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Trajetória e transições disponíveis para este problema.',
    actions: {
      startAnalysis: 'Iniciar análise',
      resolve: 'Resolver',
      close: 'Fechar',
      cancel: 'Cancelar problema',
      reopen: 'Reabrir',
    },
    closeConfirmAriaLabel: 'Fechar problema',
    fields: {
      rootCause: 'Causa raiz',
      cancellationReason: 'Motivo do cancelamento',
      reopenReason: 'Motivo da reabertura',
    },
    validation: {
      rootCauseRequired: 'Informe a causa raiz identificada.',
      cancellationReasonRequired: 'Informe o motivo do cancelamento.',
      reopenReasonRequired: 'Informe o motivo da reabertura.',
    },
    confirm: {
      startAnalysis: {
        title: 'Iniciar análise deste problema?',
        description: 'O problema passa para "Em análise" — nenhuma informação adicional é exigida.',
      },
      resolve: {
        title: 'Resolver este problema?',
        description: 'Informe a causa raiz identificada — obrigatória para marcar como resolvido.',
      },
      close: {
        title: 'Fechar este problema?',
        description:
          'Fechar exige uma ação corretiva já concluída para este problema, e quem fecha precisa ser diferente de quem concluiu essa ação — a mesma segregação de funções já aplicada a Achados de auditoria.',
      },
      cancel: {
        title: 'Cancelar este problema?',
        description:
          'Um problema cancelado é tratado como se nunca tivesse existido nas métricas de resolução. Informe o motivo.',
      },
      reopen: {
        title: 'Reabrir este problema?',
        description: 'Informe o motivo da reabertura — obrigatório para retomar a análise.',
      },
    },
    dialog: {
      confirmAction: 'Confirmar',
      confirmingAction: 'Confirmando…',
      cancelAction: 'Cancelar',
    },
    loading: 'Carregando ações do ciclo de vida…',
    loadError: 'Não foi possível carregar as ações disponíveis.',
    transitionError: 'Não foi possível concluir esta transição. Tente novamente.',
    illegalTransitionError: 'Esta transição não é permitida a partir do status atual.',
    closeMissingActionError:
      'Este problema ainda não tem uma ação corretiva concluída — feche depois que a ação de origem for concluída.',
    closeSameUserError:
      'Quem fecha o problema precisa ser diferente de quem concluiu a ação corretiva.',
    closeRequirement: {
      title: 'Ação corretiva concluída necessária',
      description:
        'O fechamento exige ao menos uma ação corretiva concluída, originada deste problema. Conclua a ação antes de tentar fechar.',
      checking: 'Verificando ação corretiva…',
    },
  },

  correctiveActions: {
    cardTitle: 'Ações corretivas',
    cardDescription:
      'Ações corretivas necessárias para investigar e corrigir este problema. O fechamento exige ao menos uma concluída.',
    loading: 'Carregando ações corretivas…',
    loadError: 'Não foi possível carregar as ações corretivas.',
    empty: 'Nenhuma ação corretiva registrada ainda.',
    columns: {
      title: 'Título',
      responsible: 'Responsável',
      dueOn: 'Prazo',
      status: 'Situação',
      rowActions: 'Ações',
    },
    addAction: 'Adicionar ação corretiva',
    loadMore: 'Carregar mais',
    form: {
      cardTitle: 'Nova ação corretiva',
      fields: {
        title: { label: 'Título' },
        description: { label: 'Descrição' },
        responsible: { label: 'Responsável', placeholder: 'Selecione o responsável' },
        dueOn: { label: 'Prazo' },
      },
      validation: {
        titleRequired: 'Informe o título da ação.',
        responsibleRequired: 'Selecione o responsável pela ação.',
        dueOnRequired: 'Informe o prazo da ação.',
      },
      actions: {
        submit: 'Adicionar ação',
        submitting: 'Adicionando…',
        cancel: 'Cancelar',
      },
      submitSuccess: 'Ação corretiva adicionada.',
      genericError: 'Não foi possível adicionar a ação corretiva. Tente novamente.',
    },
    transitionError: 'Não foi possível alterar a situação da ação. Tente novamente.',
  },

  relationships: {
    includeWithdrawnLabel: 'Incluir vínculos desfeitos',
    withdrawnBadge: 'Desfeito',
    withdrawnAt: (date: string): string => `em ${date}`,

    risks: {
      sectionTitle: 'Riscos',
      sectionDescription: 'Riscos que este problema fundamenta.',
      regionLabel: 'Riscos vinculados ao problema',
      entityLabel: 'risco',
      pickerLabel: 'Vincular risco',
      pickerPlaceholder: 'Selecione um risco',
      pickerSearchPlaceholder: 'Buscar risco por título ou código',
      pickerNoOptions: 'Nenhum risco disponível para vincular.',
      pickerAriaLabel: 'Selecionar risco',
      empty: 'Nenhum risco vinculado a este problema.',
      loading: 'Carregando riscos vinculados…',
      loadError: 'Não foi possível carregar os riscos vinculados.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Risco vinculado.',
      unlinkSuccess: 'Risco desvinculado.',
      linkError: 'Não foi possível vincular o risco. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o risco. Tente novamente.',
      alreadyLinkedError: 'Este risco já está vinculado a este problema.',
      outOfScopeError:
        'Este risco não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
      unlinkConfirm: {
        title: 'Desvincular risco?',
        description: (title: string): string =>
          `O risco "${title}" será desvinculado deste problema. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { risk: 'Risco', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
    incidents: {
      sectionTitle: 'Incidentes',
      sectionDescription: 'Incidentes que este problema explica.',
      regionLabel: 'Incidentes vinculados ao problema',
      entityLabel: 'incidente',
      pickerLabel: 'Vincular incidente',
      pickerPlaceholder: 'Selecione um incidente',
      pickerSearchPlaceholder: 'Buscar incidente por código ou título',
      pickerNoOptions: 'Nenhum incidente disponível para vincular.',
      pickerAriaLabel: 'Selecionar incidente',
      empty: 'Nenhum incidente vinculado a este problema.',
      loading: 'Carregando incidentes vinculados…',
      loadError: 'Não foi possível carregar os incidentes vinculados.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Incidente vinculado.',
      unlinkSuccess: 'Incidente desvinculado.',
      linkError: 'Não foi possível vincular o incidente. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o incidente. Tente novamente.',
      alreadyLinkedError: 'Este incidente já está vinculado a este problema.',
      outOfScopeError:
        'Este incidente não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
      unlinkConfirm: {
        title: 'Desvincular incidente?',
        description: (title: string): string =>
          `O incidente "${title}" será desvinculado deste problema. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: {
        incident: 'Incidente',
        status: 'Status',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
  },

  comments: {
    cardTitle: 'Comentários',
    cardDescription:
      'Observações registradas por quem tem acesso a este problema. Um comentário removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Comentários do problema',
    loading: 'Carregando comentários…',
    loadError: 'Não foi possível carregar os comentários.',
    empty: 'Nenhum comentário registrado ainda.',
    composerLabel: 'Novo comentário',
    composerPlaceholder: 'Escreva um comentário sobre este problema…',
    submitLabel: 'Comentar',
    submittingLabel: 'Enviando…',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais comentários',
    loadingMoreLabel: 'Carregando mais comentários…',
    submitSuccess: 'Comentário adicionado.',
    submitError: 'Não foi possível adicionar o comentário. Tente novamente.',
    withdrawConfirm: {
      title: 'Remover comentário?',
      description:
        'O comentário não é apagado: ele deixa de aparecer nesta lista, mas continua registrado na trilha de auditoria, com autoria e data preservadas.',
    },
    withdrawSuccess: 'Comentário removido.',
    withdrawError: 'Não foi possível remover o comentário. Tente novamente.',
  },

  attachments: {
    cardTitle: 'Anexos',
    cardDescription:
      'Evidências e documentos anexados a este problema. Um anexo removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Anexos do problema',
    loading: 'Carregando anexos…',
    loadError: 'Não foi possível carregar os anexos.',
    empty: 'Nenhum anexo enviado ainda.',
    chooseFileLabel: 'Selecionar arquivo',
    uploadLabel: 'Enviar arquivo',
    uploadingLabel: 'Enviando…',
    allowedTypesHint:
      'Formatos aceitos: PDF, PNG, JPEG ou texto simples (.txt). Tamanho máximo: 25 MB. O conteúdo do arquivo é conferido pelo servidor — um arquivo com a extensão trocada é recusado.',
    downloadLabel: 'Baixar anexo',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais anexos',
    loadingMoreLabel: 'Carregando mais anexos…',
    uploadSuccess: 'Arquivo enviado.',
    uploadGenericError: 'Não foi possível enviar o arquivo. Tente novamente.',
    withdrawConfirm: {
      title: 'Remover anexo?',
      description: (fileName: string): string =>
        `O arquivo "${fileName}" não é apagado: ele deixa de aparecer nesta lista, mas continua registrado na trilha de auditoria, com autoria e data preservadas.`,
    },
    withdrawSuccess: 'Anexo removido.',
    withdrawError: 'Não foi possível remover o anexo. Tente novamente.',
  },
} as const;
