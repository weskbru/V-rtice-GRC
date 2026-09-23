import type {
  ControlAssessmentResult,
  ControlEffectiveness,
  ControlFrequency,
  ControlNature,
  ControlRegisterSortField,
  ControlStatus,
  ControlType,
  SortDirection,
} from '@/features/controls/types';
import type { StatusVariant } from '@pharos/design-system/components';

const CONTROL_STATUS_LABELS: Record<ControlStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  RETIRED: 'Descontinuado',
};

const CONTROL_NATURE_LABELS: Record<ControlNature, string> = {
  MANUAL: 'Manual',
  AUTOMATED: 'Automatizado',
};

const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  PREVENTIVE: 'Preventivo',
  DETECTIVE: 'Detectivo',
  CORRECTIVE: 'Corretivo',
};

const CONTROL_FREQUENCY_LABELS: Record<ControlFrequency, string> = {
  CONTINUOUS: 'Contínua',
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

const CONTROL_ASSESSMENT_RESULT_LABELS: Record<ControlAssessmentResult, string> = {
  EFFECTIVE: 'Efetivo',
  PARTIALLY_EFFECTIVE: 'Parcialmente efetivo',
  INEFFECTIVE: 'Inefetivo',
};

const CONTROL_EFFECTIVENESS_LABELS: Record<ControlEffectiveness, string> = {
  NOT_ASSESSED: 'Não avaliado',
  EFFECTIVE: 'Efetivo',
  PARTIALLY_EFFECTIVE: 'Parcialmente efetivo',
  INEFFECTIVE: 'Inefetivo',
  EXPIRED: 'Vencido',
};

const EFFECTIVENESS_VARIANT: Record<ControlEffectiveness, StatusVariant> = {
  NOT_ASSESSED: 'neutral',
  EFFECTIVE: 'success',
  PARTIALLY_EFFECTIVE: 'warning',
  INEFFECTIVE: 'danger',
  EXPIRED: 'warning',
};

const STATUS_VARIANT: Record<ControlStatus, StatusVariant> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  RETIRED: 'neutral',
};

export const controls = {
  statusLabels: CONTROL_STATUS_LABELS,
  natureLabels: CONTROL_NATURE_LABELS,
  typeLabels: CONTROL_TYPE_LABELS,
  frequencyLabels: CONTROL_FREQUENCY_LABELS,
  assessmentResultLabels: CONTROL_ASSESSMENT_RESULT_LABELS,
  effectivenessLabels: CONTROL_EFFECTIVENESS_LABELS,
  statusVariant: STATUS_VARIANT,
  effectivenessVariant: EFFECTIVENESS_VARIANT,

  attestation: {
    statusLabels: {
      PENDING: 'Pendente de atestação',
      APPROVED: 'Atestada',
      REJECTED: 'Rejeitada',
    },
  },

  register: {
    pageTitle: 'Controles',
    pageDescription:
      'Catálogo de controles da organização: salvaguardas, seus responsáveis e sua efetividade verificada.',
    createAction: 'Novo controle',
    tableCaption: 'Lista de controles cadastrados',

    view: {
      cards: 'Cards',
      cardsLabel: 'Exibir como cards',
      table: 'Tabela',
      tableLabel: 'Exibir como tabela',
      groupLabel: 'Modo de exibição',
    },

    summary: {
      regionLabel: 'Resumo do catálogo de controles',
      error: 'Não foi possível carregar o resumo do catálogo.',
      total: {
        label: 'Total de controles',
        hint: 'Todos os controles no seu escopo',
        linkLabel: 'Ver todos os controles',
      },
      active: {
        label: 'Controles ativos',
        hint: 'Em operação',
        linkLabel: 'Ver controles ativos',
      },
      ineffective: {
        label: 'Inefetivos',
        hint: 'Última verificação atestada indica falha',
        linkLabel: 'Ver controles inefetivos',
      },
      expired: {
        label: 'Efetividade vencida',
        hint: 'Verificação além da frequência declarada',
        linkLabel: 'Ver controles com efetividade vencida',
      },
    },

    filters: {
      regionLabel: 'Filtros do catálogo de controles',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar controles',
      searchPlaceholder: 'Buscar por código ou nome…',
      statusLabel: 'Status',
      effectivenessLabel: 'Efetividade',
      natureLabel: 'Natureza',
      typeLabel: 'Tipo',
      frequencyLabel: 'Frequência',
      orgUnitLabel: 'Unidade organizacional',
      ownerLabel: 'Responsável',
      columnsMenuLabel: 'Colunas',
      optionsError: 'Não foi possível carregar as opções de filtro.',
      loadingOptions: 'Carregando opções…',
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      countChip: (fieldLabel: string, count: number): string => `${fieldLabel} (${count})`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 controle' : `${total.toLocaleString('pt-BR')} controles`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: {
        code: 'Código',
        name: 'Nome',
        status: 'Status',
        effectiveness: 'Efetividade',
        owner: 'Responsável',
        updatedAt: 'Última atualização',
      } satisfies Record<ControlRegisterSortField, string>,
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      } satisfies Record<SortDirection, string>,
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} (${directionLabel})`,
      sortOptions: {
        'code:asc': 'Código (A–Z)',
        'code:desc': 'Código (Z–A)',
        'name:asc': 'Nome (A–Z)',
        'name:desc': 'Nome (Z–A)',
        'status:asc': 'Status',
        'effectiveness:asc': 'Efetividade',
        'owner:asc': 'Responsável (A–Z)',
        'updatedAt:desc': 'Atualizados recentemente',
        'updatedAt:asc': 'Atualizados há mais tempo',
      } as Record<string, string>,
    },

    columns: {
      code: 'Código',
      name: 'Nome',
      status: 'Status',
      effectiveness: 'Efetividade',
      nature: 'Natureza',
      type: 'Tipo',
      frequency: 'Frequência',
      orgUnit: 'Unidade organizacional',
      owner: 'Responsável',
      updatedAt: 'Última atualização',
      notSet: 'Não definido',
    },

    card: {
      regionLabel: 'Controles',
      selectLabel: (code: string, name: string): string => `Abrir o controle ${code}: ${name}`,
      categoryLabel: 'Natureza',
      orgUnitLabel: 'Unidade',
      ownerLabel: 'Responsável',
      noOwner: 'Sem responsável definido',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },

    empty: {
      noneYet: {
        title: 'Nenhum controle cadastrado',
        description:
          'Cadastre o primeiro controle da sua unidade organizacional para começar a governar as salvaguardas da organização.',
        createAction: 'Cadastrar controle',
      },
      noResults: {
        title: 'Nenhum controle encontrado',
        description: 'Nenhum controle corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  detail: {
    breadcrumbLabel: 'Controles',
    loading: 'Carregando controle…',
    notFoundTitle: 'Controle não encontrado',
    notFoundDescription:
      'Este controle não existe ou está fora do seu escopo organizacional de acesso.',
    editAction: 'Editar',
    metadata: {
      owner: (name: string): string => `Responsável: ${name}`,
      noOwner: 'Sem responsável definido',
      orgUnit: (name: string): string => `Unidade: ${name}`,
      noOrgUnit: 'Unidade não definida',
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      retiredAt: (date: string): string => `Descontinuado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      assessments: 'Verificações',
      relationships: 'Vínculos',
      evidence: 'Evidências',
    },
    asideLabel: 'Contexto do controle',
    quickActions: {
      heading: 'Ações rápidas',
      registerAssessment: 'Registrar verificação',
      linkRelationship: 'Vincular processo ou ativo',
      addEvidence: 'Adicionar evidência',
    },
    relationshipsPanel: {
      heading: 'Relacionamentos',
      links: 'Vínculos',
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',
    overview: {
      descriptionCardTitle: 'Descrição',
      effectivenessCardTitle: 'Efetividade',
      detailsCardTitle: 'Detalhes do controle',
      notSet: 'Não definido',
      fields: {
        orgUnit: 'Unidade organizacional',
        owner: 'Responsável',
        nature: 'Natureza',
        type: 'Tipo',
        createdAt: 'Cadastrado em',
        frequency: 'Frequência de verificação',
      },
      frequencyNoExpiry: 'Sem frequência definida — a efetividade deste controle não vence.',
    },
    effectiveness: {
      neverAssessedNotice: 'Este controle ainda não foi avaliado.',
    },
    lifecycleOutcomes: {
      retiredAtLabel: 'Descontinuado em',
      retiredByLabel: 'Descontinuado por',
      retirementReasonLabel: 'Justificativa da descontinuação',
    },
    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida do controle',
      retiredAriaLabel: 'Controle descontinuado',
      retiredContextLabel: 'Encerrado por descontinuação',
      stateLabels: {
        current: 'Atual',
        completed: 'Concluído',
        available: 'Disponível',
        unavailable: 'Indisponível',
      },
    },
  },

  form: {
    createTitle: 'Novo controle',
    createDescription:
      'Cadastre um controle informando o que ele faz, quem responde por ele e em que unidade opera.',
    editTitle: 'Editar controle',
    editDescription: 'Altere os dados cadastrais do controle.',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que este controle é e o que ele faz.',
      },
      classification: {
        title: 'Classificação',
        description:
          'Natureza de execução, tipo de atuação e frequência esperada de verificação — todos opcionais no cadastro, mas necessários antes de colocar o controle em operação.',
      },
      ownership: {
        title: 'Responsabilidade',
        description: 'Unidade organizacional e responsável pelo controle.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: { label: 'Descrição' },
      nature: { label: 'Natureza', placeholder: 'Selecione a natureza' },
      type: { label: 'Tipo', placeholder: 'Selecione o tipo' },
      frequency: { label: 'Frequência', placeholder: 'Selecione a frequência' },
      orgUnit: { label: 'Unidade organizacional', placeholder: 'Selecione a unidade' },
      owner: {
        label: 'Responsável pelo controle',
        placeholder: 'Selecione o responsável',
        description:
          'Obrigatório para colocar o controle em operação; um rascunho pode existir sem responsável definido.',
        selectOrgUnitFirst:
          'Selecione uma unidade organizacional para ver os responsáveis elegíveis.',
        loading: 'Carregando responsáveis elegíveis…',
        empty: 'Nenhum usuário elegível para responder por esta unidade organizacional.',
        loadError: 'Não foi possível carregar os responsáveis elegíveis.',
        clearedNotice:
          'O responsável selecionado não pertence mais à linha organizacional da unidade escolhida e foi limpo.',
        clearAction: 'Remover responsável',
      },
    },
    unsavedNote: 'As alterações só são salvas ao confirmar.',
    actions: {
      save: 'Salvar alterações',
      saving: 'Salvando…',
      saveAndCreate: 'Cadastrar controle',
      creating: 'Cadastrando…',
    },
    createSuccess: 'Controle cadastrado.',
    updateSuccess: 'Controle atualizado.',
    genericError: 'Não foi possível salvar o controle. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
    conflict: {
      title: 'Este controle foi alterado por outra pessoa',
      description:
        'Alguém salvou uma alteração neste controle enquanto você editava. Seus dados não foram descartados.',
      modifiedBy: (name: string): string => `Alterado por: ${name}`,
      modifiedAt: (date: string): string => `Alterado em: ${date}`,
      reloadAction: 'Ver versão atual em nova aba',
      retryAction: 'Salvar mesmo assim com meus dados',
      dismissAction: 'Continuar editando',
    },
    validation: {
      name: { required: 'Informe o nome do controle.', tooLong: 'O nome é muito longo.' },
      description: { required: 'Informe a descrição do controle.' },
      orgUnit: { required: 'Selecione a unidade organizacional.' },
    },
  },

  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Transições disponíveis a partir do status atual, para o seu perfil.',
    loading: 'Carregando transições disponíveis…',
    loadError: 'Não foi possível carregar as transições disponíveis.',
    noneAvailable: 'Nenhuma transição está disponível para o seu perfil neste momento.',
    unmetPreconditionsTitle: 'Pendências para esta transição:',
    actions: {
      apply: (statusLabel: string): string => `Aplicar: ${statusLabel}`,
    },
    transitionDialog: {
      title: (statusLabel: string): string => `Aplicar transição: ${statusLabel}`,
      description: (statusLabel: string): string =>
        `O controle passará para o status "${statusLabel}". Esta transição fica registrada na trilha de auditoria, com autor, data e os estados anterior e posterior.`,
      justificationLabel: 'Justificativa',
      justificationRequiredForRetirement:
        'Informe a justificativa da descontinuação. Ela é obrigatória para esta transição.',
      justificationDescriptionDefault: 'Registrada com a transição, quando informada.',
      justificationDescriptionRetirement:
        'Obrigatória: descreva por que este controle está sendo descontinuado.',
      cancelAction: 'Cancelar',
      confirmAction: 'Confirmar',
      confirmingAction: 'Aplicando…',
      submitSuccess: (statusLabel: string): string => `Controle movido para "${statusLabel}".`,
      conflictError:
        'Este controle foi alterado por outra pessoa. Recarregue a página para ver o estado atual.',
      genericError: 'Não foi possível aplicar esta transição.',
    },
  },

  assessment: {
    form: {
      cardTitle: 'Registrar verificação',
      cardDescription:
        'Registre o que foi observado ao testar este controle. Uma nova verificação nunca substitui a anterior — ambas permanecem legíveis no histórico.',
      fields: {
        assessedOn: { label: 'Data da verificação' },
        result: { label: 'Resultado', placeholder: 'Selecione o resultado' },
        conclusion: {
          label: 'Conclusão',
          description: 'O que foi observado e por que este resultado foi atribuído.',
        },
      },
      actions: { submit: 'Registrar verificação', submitting: 'Registrando…' },
      submitSuccess: 'Verificação registrada.',
      genericError: 'Não foi possível registrar a verificação. Tente novamente.',
      validation: {
        assessedOnRequired: 'Informe a data da verificação.',
        assessedOnFuture: 'A data da verificação não pode ser no futuro.',
        resultRequired: 'Selecione o resultado da verificação.',
        conclusionRequired: 'Descreva a conclusão da verificação.',
      },
      notActiveNotice:
        'Este controle não está ativo — apenas controles ativos aceitam novas verificações.',
    },
    history: {
      cardTitle: 'Histórico de verificações',
      cardDescription:
        'Toda verificação já registrada, do mais recente ao mais antigo. Nenhuma é editada.',
      loading: 'Carregando histórico de verificações…',
      loadError: 'Não foi possível carregar o histórico de verificações.',
      empty: 'Nenhuma verificação registrada para este controle.',
      loadMore: 'Carregar mais',
      columns: {
        assessedOn: 'Data',
        assessor: 'Executor',
        result: 'Resultado',
        conclusion: 'Conclusão',
        attestation: 'Atestação',
      },
      noConclusion: 'Sem conclusão registrada.',
    },
    attestation: {
      statusLabels: {
        PENDING: 'Pendente de atestação',
        APPROVED: 'Atestada',
        REJECTED: 'Rejeitada',
      },
      notRequested: 'Não solicitada',
      requestAction: 'Solicitar atestação',
      requesting: 'Solicitando…',
      requestSuccess: 'Atestação solicitada.',
      requestError: 'Não foi possível solicitar a atestação desta verificação.',
      alreadyExistsError:
        'Já existe uma atestação para esta verificação — pendente ou já decidida.',
      decideAction: 'Decidir atestação',
      approveAction: 'Atestar',
      rejectAction: 'Rejeitar',
      decisionDialog: {
        title: { APPROVED: 'Atestar verificação', REJECTED: 'Rejeitar verificação' },
        description: (assessorName: string, resultLabel: string): string =>
          `Verificação executada por ${assessorName}, com resultado "${resultLabel}". A decisão é permanente e fica registrada na trilha de auditoria.`,
        permanentNotice: 'Esta decisão não pode ser desfeita.',
        justificationLabel: 'Justificativa',
        justificationOptional: '(opcional)',
        cancelAction: 'Cancelar',
        confirmAction: { APPROVED: 'Confirmar atestação', REJECTED: 'Confirmar rejeição' },
        confirmingAction: 'Enviando…',
        submitSuccess: { APPROVED: 'Verificação atestada.', REJECTED: 'Decisão registrada.' },
        genericError: 'Não foi possível registrar a decisão.',
        alreadyDecidedError: 'Esta atestação já foi decidida.',
      },
      segregationNotice: {
        title: 'Quem não pode atestar esta verificação',
        assessorRule: 'Quem executou a verificação não pode atestá-la.',
        ownerRule: 'O responsável pelo controle não pode atestar verificações desse controle.',
        bothRule:
          'Quando a mesma pessoa executou a verificação e responde pelo controle, nenhuma das duas regras é dispensada — a atestação é recusada por ambas ao mesmo tempo.',
      },
    },
  },

  relationships: {
    risks: {
      sectionTitle: 'Riscos',
      sectionDescription:
        'Riscos que este controle trata. Este vínculo é criado a partir do risco, não deste lado — aqui ele é apenas exibido.',
      empty: 'Nenhum risco vinculado a este controle.',
      openRisk: 'Abrir risco',
      columns: { name: 'Risco', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
      readOnlyNotice:
        'O vínculo entre risco e controle é criado e desfeito a partir do registro do risco.',
    },
    processes: {
      sectionTitle: 'Processos',
      sectionDescription: 'Processos de negócio sobre os quais este controle atua.',
      pickerLabel: 'Vincular processo',
      pickerPlaceholder: 'Selecione um processo',
      pickerNoOptions: 'Nenhum processo disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar processo por nome ou código',
      pickerAriaLabel: 'Selecionar processo',
      empty: 'Nenhum processo vinculado a este controle.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Processo vinculado.',
      unlinkSuccess: 'Processo desvinculado.',
      linkError: 'Não foi possível vincular o processo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o processo. Tente novamente.',
      alreadyLinkedError: 'Este processo já está vinculado a este controle.',
      retiredError: 'Um controle descontinuado não aceita novos vínculos.',
      unlinkConfirm: {
        title: 'Desvincular processo?',
        description: (name: string): string =>
          `O processo "${name}" será desvinculado deste controle. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { name: 'Processo', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
    assets: {
      sectionTitle: 'Ativos',
      sectionDescription: 'Ativos sobre os quais este controle atua.',
      pickerLabel: 'Vincular ativo',
      pickerPlaceholder: 'Selecione um ativo',
      pickerNoOptions: 'Nenhum ativo disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar ativo por nome ou código',
      pickerAriaLabel: 'Selecionar ativo',
      empty: 'Nenhum ativo vinculado a este controle.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Ativo vinculado.',
      unlinkSuccess: 'Ativo desvinculado.',
      linkError: 'Não foi possível vincular o ativo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o ativo. Tente novamente.',
      alreadyLinkedError: 'Este ativo já está vinculado a este controle.',
      retiredError: 'Um controle descontinuado não aceita novos vínculos.',
      unlinkConfirm: {
        title: 'Desvincular ativo?',
        description: (name: string): string =>
          `O ativo "${name}" será desvinculado deste controle. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção.`,
      },
      columns: { name: 'Ativo', linkedBy: 'Vinculado por', linkedAt: 'Vinculado em' },
    },
    includeWithdrawnLabel: 'Mostrar vínculos desfeitos',
  },

  remediation: {
    openAction: 'Abrir ação de remediação',
    dialogTitle: 'Abrir ação de remediação',
    dialogDescription:
      'A ação criada aparece na lista de trabalho única da plataforma, identificada por sua origem nesta verificação.',
    fields: {
      title: { label: 'Título' },
      description: { label: 'Descrição' },
      responsible: { label: 'Responsável', placeholder: 'Selecione o responsável' },
      dueOn: { label: 'Prazo' },
    },
    submit: 'Abrir ação',
    submitting: 'Abrindo…',
    submitSuccess: 'Ação de remediação aberta.',
    genericError: 'Não foi possível abrir a ação de remediação.',
    validation: {
      titleRequired: 'Informe o título da ação.',
      responsibleRequired: 'Selecione o responsável pela ação.',
      dueOnRequired: 'Informe o prazo da ação.',
    },
  },
} as const;

export function controlEffectivenessHint(effectiveness: ControlEffectiveness): string | undefined {
  if (effectiveness === 'EXPIRED') {
    return 'A última verificação atestada está além da frequência declarada.';
  }
  if (effectiveness === 'NOT_ASSESSED') {
    return 'Nenhuma verificação atestada até o momento.';
  }
  return undefined;
}
