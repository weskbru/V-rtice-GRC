import type {
  IncidentSeverity,
  IncidentStatus,
  ProblemStatusRef,
} from '@/features/incidents/types';

const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const incidents = {
  entityLabel: 'incidente',
  navLabel: 'Incidentes',
  statusLabels: INCIDENT_STATUS_LABELS,
  severityLabels: INCIDENT_SEVERITY_LABELS,

  register: {
    pageTitle: 'Incidentes',
    pageDescription: 'Registro de incidentes da organização e seu ciclo de vida de atendimento.',
    createAction: 'Novo incidente',
    tableCaption: 'Lista de incidentes registrados',
    searchLabel: 'Buscar incidentes',
    searchPlaceholder: 'Buscar por código ou título…',
    filters: {
      regionLabel: 'Filtros do registro de incidentes',
      groupLabel: 'Filtros',
      statusLabel: 'Status',
      severityLabel: 'Severidade',
      orgUnitLabel: 'Unidade organizacional',
      loadingOptions: 'Carregando opções…',
      optionsError: 'Não foi possível carregar as opções de filtro.',
    },
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (value: string): string => `Busca: "${value}"`,
      countChip: (label: string, count: number): string => `${label} (${count})`,
      valueChip: (label: string, value: string): string => `${label}: ${value}`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
    },
    columns: {
      code: 'Código',
      title: 'Título',
      severity: 'Severidade',
      status: 'Status',
      orgUnit: 'Unidade organizacional',
      owner: 'Responsável',
      reportedOn: 'Reportado em',
      updatedAt: 'Última atualização',
    },
    empty: {
      noneYet: {
        title: 'Nenhum incidente registrado',
        description: 'Registre o primeiro incidente da sua unidade organizacional.',
        createAction: 'Registrar incidente',
      },
      noResults: {
        title: 'Nenhum incidente encontrado',
        description: 'Nenhum incidente corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
    results: {
      count: (total: number): string =>
        total === 1 ? '1 incidente' : `${total.toLocaleString('pt-BR')} incidentes`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: {
        code: 'Código',
        title: 'Título',
        severity: 'Severidade',
        status: 'Status',
        reportedOn: 'Reportado em',
        updatedAt: 'Última atualização',
      },
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      },
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} — ${directionLabel}`,
      sortOptions: {
        'code:asc': 'Código — crescente',
        'code:desc': 'Código — decrescente',
        'title:asc': 'Título — crescente',
        'title:desc': 'Título — decrescente',
        'severity:asc': 'Severidade — crescente',
        'severity:desc': 'Severidade — decrescente',
        'status:asc': 'Status — crescente',
        'status:desc': 'Status — decrescente',
        'reportedOn:asc': 'Reportado em — crescente',
        'reportedOn:desc': 'Reportado em — decrescente',
        'updatedAt:asc': 'Última atualização — crescente',
        'updatedAt:desc': 'Última atualização — decrescente',
      } as Record<string, string>,
    },

    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      cardsLabel: 'Visualização em cards',
      table: 'Tabela',
      tableLabel: 'Visualização em tabela',
    },

    card: {
      regionLabel: 'Incidentes',
      orgUnitLabel: 'Unidade',
      ownerLabel: 'Responsável',
      reportedOnLabel: 'Reportado em',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      updatedAtUnknown: 'Data de atualização não disponível',
      selectLabel: (code: string, title: string): string => `Abrir o incidente ${code}: ${title}`,
    },

    summary: {
      regionLabel: 'Situação geral dos incidentes no seu escopo',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de incidentes',
        hint: 'Todos os status, no seu escopo',
        linkLabel: 'Ver todos os incidentes',
      },
      open: {
        label: 'Abertos',
        hint: 'Aguardando atendimento',
        linkLabel: 'Ver incidentes abertos',
      },
      inProgress: {
        label: 'Em andamento',
        hint: 'Em atendimento no momento',
        linkLabel: 'Ver incidentes em andamento',
      },
      resolved: {
        label: 'Resolvidos',
        hint: 'Aguardando fechamento',
        linkLabel: 'Ver incidentes resolvidos',
      },
    },
  },

  form: {
    createHeading: 'Novo incidente',
    editHeading: 'Editar incidente',
    editDescription: 'Altere os dados cadastrais do incidente.',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'Dados que identificam e classificam o incidente.',
      },
    },
    fields: {
      title: { label: 'Título' },
      description: { label: 'Descrição' },
      severity: { label: 'Severidade', placeholder: 'Selecione a severidade' },
      orgUnit: {
        label: 'Unidade organizacional',
        placeholder: 'Selecione a unidade organizacional',
        helperImmutable: 'A unidade organizacional não pode ser alterada após o registro.',
      },
      owner: {
        label: 'Responsável',
        placeholder: 'Atribuir a mim (padrão)',
        helper: 'Deixe em branco para atribuir o incidente a você mesmo.',
      },
      reportedOn: { label: 'Data do reporte' },
    },
    validation: {
      title: {
        required: 'Informe o título do incidente.',
        tooLong: 'O título deve ter no máximo 300 caracteres.',
      },
      description: { required: 'Informe a descrição do incidente.' },
      severity: { required: 'Selecione a severidade do incidente.' },
      orgUnit: { required: 'Selecione a unidade organizacional.' },
      reportedOn: { required: 'Informe a data do reporte.' },
    },
    submitCreateLabel: 'Registrar incidente',
    submitEditLabel: 'Salvar alterações',
    createSuccess: 'Incidente registrado.',
    updateSuccess: 'Incidente atualizado.',
    createError: 'Não foi possível registrar o incidente. Tente novamente.',
    updateError: 'Não foi possível atualizar o incidente. Tente novamente.',
    outOfScopeError:
      'A unidade organizacional informada não existe ou está fora do seu escopo organizacional.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
  },

  detail: {
    breadcrumbLabel: 'Incidentes',
    loading: 'Carregando incidente…',
    notFoundTitle: 'Incidente não encontrado',
    notFoundDescription: 'Este incidente não existe ou está fora do seu escopo organizacional.',
    editAction: 'Editar',
    metadata: {
      orgUnit: (name: string): string => `Unidade: ${name}`,
      owner: (name: string): string => `Responsável: ${name}`,
      reportedOn: (date: string): string => `Reportado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      risks: 'Riscos',
      assets: 'Ativos',
      processes: 'Processos',
      problems: 'Problemas',
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
    groupsAriaLabel: 'Grupos de seções do incidente',
    sectionsAriaLabel: (groupLabel: string): string => `Seções de ${groupLabel}`,
    asideLabel: 'Contexto do incidente',

    quickActions: {
      heading: 'Ações rápidas',
      linkRisk: 'Vincular risco',
      linkAsset: 'Vincular ativo',
      linkProcess: 'Vincular processo',
      addCorrectiveAction: 'Adicionar ação corretiva',
      addEvidence: 'Adicionar evidência',
      comment: 'Comentar',
    },
    relationshipsPanel: {
      heading: 'Relacionamentos',
      risks: 'Riscos',
      assets: 'Ativos',
      processes: 'Processos',
      problems: 'Problemas',
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',

    lifecycleOutcomes: {
      resolutionSummaryLabel: 'Resumo da resolução',
      resolvedAtLabel: 'Resolvido em',
      resolvedByLabel: 'Resolvido por',
      closedAtLabel: 'Fechado em',
      closedByLabel: 'Fechado por',
      cancellationReasonLabel: 'Motivo do cancelamento',
    },

    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida do incidente',
      cancelledAriaLabel: 'Incidente cancelado',
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
    detailsCardTitle: 'Detalhes do incidente',
    fields: {
      severity: 'Severidade',
      orgUnit: 'Unidade organizacional',
      owner: 'Responsável',
      reportedOn: 'Reportado em',
      reportedBy: 'Reportado por',
      createdAt: 'Registrado em',
    },
    notSet: 'Não definido',
  },

  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Trajetória e transições disponíveis para este incidente.',
    actions: {
      start: 'Iniciar atendimento',
      resolve: 'Resolver',
      close: 'Fechar',
      cancel: 'Cancelar incidente',
      reopen: 'Reabrir',
    },
    fields: {
      resolutionSummary: 'Resumo da resolução',
      cancellationReason: 'Motivo do cancelamento',
      reopenReason: 'Motivo da reabertura',
    },
    confirm: {
      resolve: {
        title: 'Resolver este incidente?',
        description: 'Informe um resumo da resolução — obrigatório para marcar como resolvido.',
      },
      close: {
        title: 'Fechar este incidente?',
        description:
          'Os campos descritivos deixam de ser editáveis depois de fechado. O histórico permanece.',
      },
      cancel: {
        title: 'Cancelar este incidente?',
        description:
          'Um incidente cancelado é tratado como se nunca tivesse ocorrido nas métricas de tempo de resolução. Informe o motivo.',
      },
      reopen: {
        title: 'Reabrir este incidente?',
        description: 'Informe o motivo da reabertura — obrigatório para retomar o atendimento.',
      },
    },
    transitionError: 'Não foi possível concluir esta transição. Tente novamente.',
    illegalTransitionError: 'Esta transição não é permitida a partir do status atual.',
    fieldRequiredError: 'Este campo é obrigatório.',
  },

  correctiveActions: {
    cardTitle: 'Ações corretivas',
    cardDescription: 'Ações corretivas abertas a partir deste incidente.',
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
    includeWithdrawnLabel: 'Mostrar vínculos desfeitos',
    withdrawnBadge: 'Desfeito',
    withdrawnAt: (date: string): string => `Desvinculado em ${date}`,
    risks: {
      sectionTitle: 'Riscos',
      sectionDescription: 'Riscos relacionados a este incidente.',
      entityLabel: 'risco',
      loading: 'Carregando riscos vinculados…',
      loadError: 'Não foi possível carregar os riscos vinculados a este incidente.',
      pickerLabel: 'Vincular risco',
      pickerPlaceholder: 'Selecione um risco',
      pickerSearchPlaceholder: 'Buscar risco por título ou código',
      pickerNoOptions: 'Nenhum risco disponível para vincular.',
      pickerAriaLabel: 'Selecionar risco',
      empty: 'Nenhum risco vinculado a este incidente.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Risco vinculado.',
      unlinkSuccess: 'Risco desvinculado.',
      linkError: 'Não foi possível vincular o risco. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o risco. Tente novamente.',
      alreadyLinkedError: 'Este risco já está vinculado a este incidente.',
      outOfScopeError:
        'Este risco não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
      unlinkConfirm: {
        title: 'Desvincular risco?',
        description: (title: string): string =>
          `O risco "${title}" será desvinculado deste incidente. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { risk: 'Risco', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
    assets: {
      sectionTitle: 'Ativos',
      sectionDescription: 'Ativos afetados por este incidente.',
      entityLabel: 'ativo',
      loading: 'Carregando ativos vinculados…',
      loadError: 'Não foi possível carregar os ativos vinculados a este incidente.',
      pickerLabel: 'Vincular ativo',
      pickerPlaceholder: 'Selecione um ativo',
      pickerSearchPlaceholder: 'Buscar ativo por nome ou código',
      pickerNoOptions: 'Nenhum ativo disponível para vincular.',
      pickerAriaLabel: 'Selecionar ativo',
      empty: 'Nenhum ativo vinculado a este incidente.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Ativo vinculado.',
      unlinkSuccess: 'Ativo desvinculado.',
      linkError: 'Não foi possível vincular o ativo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o ativo. Tente novamente.',
      alreadyLinkedError: 'Este ativo já está vinculado a este incidente.',
      outOfScopeError:
        'Este ativo não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
      unlinkConfirm: {
        title: 'Desvincular ativo?',
        description: (name: string): string =>
          `O ativo "${name}" será desvinculado deste incidente. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { asset: 'Ativo', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
    processes: {
      sectionTitle: 'Processos',
      sectionDescription: 'Processos de negócio afetados por este incidente.',
      entityLabel: 'processo',
      loading: 'Carregando processos vinculados…',
      loadError: 'Não foi possível carregar os processos vinculados a este incidente.',
      pickerLabel: 'Vincular processo',
      pickerPlaceholder: 'Selecione um processo',
      pickerSearchPlaceholder: 'Buscar processo por nome ou código',
      pickerNoOptions: 'Nenhum processo disponível para vincular.',
      pickerAriaLabel: 'Selecionar processo',
      empty: 'Nenhum processo vinculado a este incidente.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Processo vinculado.',
      unlinkSuccess: 'Processo desvinculado.',
      linkError: 'Não foi possível vincular o processo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o processo. Tente novamente.',
      alreadyLinkedError: 'Este processo já está vinculado a este incidente.',
      outOfScopeError:
        'Este processo não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
      unlinkConfirm: {
        title: 'Desvincular processo?',
        description: (name: string): string =>
          `O processo "${name}" será desvinculado deste incidente. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { process: 'Processo', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
    problems: {
      sectionTitle: 'Problemas',
      sectionDescription:
        'Problemas que apontam este incidente como contribuinte. Vincular ou desvincular acontece a partir do problema.',
      empty: 'Nenhum problema vinculado a este incidente.',
      loading: 'Carregando problemas vinculados…',
      loadError: 'Não foi possível carregar os problemas vinculados a este incidente.',
      statusLabels: {
        OPEN: 'Aberto',
        IN_ANALYSIS: 'Em análise',
        RESOLVED: 'Resolvido',
        CLOSED: 'Fechado',
        CANCELLED: 'Cancelado',
      } satisfies Record<ProblemStatusRef, string>,
      columns: {
        problem: 'Problema',
        status: 'Status',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
  },

  comments: {
    cardTitle: 'Comentários',
    cardDescription:
      'Observações registradas por quem tem acesso a este incidente. Um comentário removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Comentários do incidente',
    loading: 'Carregando comentários…',
    loadError: 'Não foi possível carregar os comentários.',
    empty: 'Nenhum comentário registrado ainda.',
    composerLabel: 'Novo comentário',
    composerPlaceholder: 'Escreva um comentário sobre este incidente…',
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
      'Evidências e documentos anexados a este incidente. Um anexo removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Anexos do incidente',
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
