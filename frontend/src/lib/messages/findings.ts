export type FindingCategory =
  'NONCONFORMITY' | 'CONTROL_DEFICIENCY' | 'OBSERVATION' | 'IMPROVEMENT_OPPORTUNITY';

export type FindingOrigin = 'INTERNAL_ASSESSMENT' | 'CONTROL_TESTING' | 'MANAGEMENT_REVIEW';

export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FindingPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type FindingStatus = 'OPEN' | 'IN_REMEDIATION' | 'CLOSED' | 'ARCHIVED';

export const findings = {
  categoryLabels: {
    NONCONFORMITY: 'Não conformidade',
    CONTROL_DEFICIENCY: 'Deficiência de controle',
    OBSERVATION: 'Observação',
    IMPROVEMENT_OPPORTUNITY: 'Oportunidade de melhoria',
  } satisfies Record<FindingCategory, string>,

  originLabels: {
    INTERNAL_ASSESSMENT: 'Autoavaliação interna',
    CONTROL_TESTING: 'Teste de controle',
    MANAGEMENT_REVIEW: 'Revisão da administração',
  } satisfies Record<FindingOrigin, string>,

  severityLabels: {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
  } satisfies Record<FindingSeverity, string>,

  priorityLabels: {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  } satisfies Record<FindingPriority, string>,

  statusLabels: {
    OPEN: 'Aberto',
    IN_REMEDIATION: 'Em remediação',
    CLOSED: 'Encerrado',
    ARCHIVED: 'Arquivado',
  } satisfies Record<FindingStatus, string>,

  panel: {
    cardTitle: 'Achados',
    cardDescription:
      'Constatações de GRC registradas nesta unidade organizacional — não conformidades, ' +
      'deficiências de controle, observações e oportunidades de melhoria.',
    loading: 'Carregando achados…',
    loadError: 'Não foi possível carregar os achados.',
    empty: 'Nenhum achado registrado ainda.',
    newAction: 'Novo achado',
    editAction: 'Editar',
    closeAction: 'Encerrar',
    reopenAction: 'Reabrir',
    archiveAction: 'Arquivar',
    ownerLabel: (name: string): string => `Responsável: ${name}`,
    identifiedOnLabel: (date: string): string => `Identificado em ${date}`,
    openActionCountLabel: (count: number): string =>
      count === 1 ? '1 ação em aberto' : `${count} ações em aberto`,
    evidenceCountLabel: (count: number): string =>
      count === 1 ? '1 evidência vinculada' : `${count} evidências vinculadas`,
    closureJustificationLabel: (text: string): string => `Justificativa do encerramento: ${text}`,

    archiveConfirm: {
      title: 'Arquivar achado',
      description: (title: string): string =>
        `"${title}" será arquivado e removido de circulação. Evidências e ações vinculadas ` +
        'permanecem consultáveis.',
    },

    createSuccess: 'Achado registrado.',
    createError: 'Não foi possível registrar o achado.',
    editSuccess: 'Achado atualizado.',
    editError: 'Não foi possível atualizar o achado.',
    closeSuccess: 'Achado encerrado.',
    closeError: 'Não foi possível encerrar o achado.',
    reopenSuccess: 'Achado reaberto.',
    reopenError: 'Não foi possível reabrir o achado.',
    archiveSuccess: 'Achado arquivado.',
    archiveError: 'Não foi possível arquivar o achado.',
  },

  form: {
    createTitle: 'Registrar achado',
    createDescription:
      'Descreva a constatação, classifique sua gravidade e a urgência de tratamento. ' +
      'Evidências e ações de remediação podem ser vinculadas depois de salvar.',
    editTitle: 'Editar achado',
    fields: {
      title: { label: 'Título' },
      description: { label: 'Descrição' },
      recommendation: { label: 'Recomendação', optional: '(opcional)' },
      category: { label: 'Categoria', placeholder: 'Selecione a categoria' },
      origin: { label: 'Origem', placeholder: 'Selecione a origem' },
      severity: { label: 'Severidade', placeholder: 'Selecione a severidade' },
      priority: { label: 'Prioridade', placeholder: 'Selecione a prioridade' },
      ownerUserId: { label: 'Responsável' },
      identifiedOn: { label: 'Data de identificação' },
    },
    cancel: 'Cancelar',
    submit: 'Registrar',
    submitEdit: 'Salvar alterações',
    submitting: 'Salvando…',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    genericError: 'Não foi possível concluir a operação. Tente novamente.',
    validation: {
      title: { required: 'O título é obrigatório.' },
      description: { required: 'A descrição é obrigatória.' },
      category: { required: 'Selecione a categoria do achado.' },
      origin: { required: 'Selecione a origem do achado.' },
      severity: { required: 'Selecione a severidade do achado.' },
      priority: { required: 'Selecione a prioridade do achado.' },
      ownerUserId: { required: 'Selecione o responsável pelo achado.' },
      identifiedOn: { required: 'Informe a data de identificação.' },
    },
  },

  close: {
    title: 'Encerrar achado',
    description:
      'O encerramento exige ao menos uma ação de remediação concluída ou uma justificativa. ' +
      'Quem executou a remediação não pode encerrar o próprio achado.',
    justificationLabel: 'Justificativa',
    justificationPlaceholder:
      'Obrigatória quando não há ação de remediação concluída vinculada a este achado.',
    confirm: 'Encerrar',
    cancel: 'Cancelar',
    segregationOfDutiesError:
      'Quem executou a remediação não pode encerrar o achado. Peça que outra pessoa com ' +
      'permissão de encerramento realize esta ação.',
  },

  reopen: {
    title: 'Reabrir achado',
    description: 'A reabertura preserva o encerramento anterior na trilha de auditoria.',
    reasonLabel: 'Motivo da reabertura',
    reasonPlaceholder: 'Por que este achado está sendo reaberto?',
    reasonRequired: 'Informe o motivo da reabertura.',
    confirm: 'Reabrir',
    cancel: 'Cancelar',
  },
} as const;
