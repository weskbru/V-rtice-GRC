import type {
  FrameworkListSortField,
  FrameworkOrigin,
  FrameworkVersionStatus,
  MappingMigrationOutcome,
  RequirementComplianceState,
} from '@/features/compliance/types';
import type { StatusVariant } from '@pharos/design-system/components';

const FRAMEWORK_ORIGIN_LABELS: Record<FrameworkOrigin, string> = {
  EXTERNAL_STANDARD: 'Norma externa',
  INTERNAL_POLICY: 'Política interna',
};

const FRAMEWORK_VERSION_STATUS_LABELS: Record<FrameworkVersionStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
};

const FRAMEWORK_VERSION_STATUS_VARIANT: Record<FrameworkVersionStatus, StatusVariant> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
};

const REQUIREMENT_COMPLIANCE_STATE_LABELS: Record<RequirementComplianceState, string> = {
  NOT_APPLICABLE: 'Não aplicável',
  NOT_MET: 'Não atendido',
  NOT_PROVEN: 'Não comprovado',
  PARTIALLY_MET: 'Parcialmente atendido',
  COMPLIANT: 'Conforme',
};

const REQUIREMENT_COMPLIANCE_STATE_VARIANT: Record<RequirementComplianceState, StatusVariant> = {
  NOT_APPLICABLE: 'neutral',
  NOT_MET: 'danger',
  NOT_PROVEN: 'warning',
  PARTIALLY_MET: 'warning',
  COMPLIANT: 'success',
};

const REQUIREMENT_COMPLIANCE_STATE_DESCRIPTIONS: Record<RequirementComplianceState, string> = {
  NOT_APPLICABLE:
    'Esta cláusula foi declarada não aplicável e não entra no cálculo de conformidade.',
  NOT_MET: 'Nenhum controle está ligado a esta cláusula.',
  NOT_PROVEN:
    'Há controle ligado, mas nenhum deles comprova a cláusula agora — sem verificação atestada, aposentado ou inefetivo.',
  PARTIALLY_MET: 'Alguns dos controles ligados comprovam a cláusula agora; outros não.',
  COMPLIANT: 'Todos os controles ligados são efetivos e comprovam esta cláusula.',
};

const FRAMEWORK_SORT_LABELS: Record<FrameworkListSortField, string> = {
  code: 'Código',
  name: 'Nome',
  updatedAt: 'Atualizado em',
};

const MAPPING_MIGRATION_OUTCOME_LABELS: Record<MappingMigrationOutcome, string> = {
  COPIED: 'Transportado',
  PENDING_DECISION: 'Pendente de decisão',
  SKIPPED_ALREADY_MAPPED: 'Já tinha mapeamento próprio',
};

const MAPPING_MIGRATION_OUTCOME_VARIANT: Record<MappingMigrationOutcome, StatusVariant> = {
  COPIED: 'success',
  PENDING_DECISION: 'warning',
  SKIPPED_ALREADY_MAPPED: 'neutral',
};

export const compliance = {
  originLabels: FRAMEWORK_ORIGIN_LABELS,
  frameworkVersionStatusLabels: FRAMEWORK_VERSION_STATUS_LABELS,
  frameworkVersionStatusVariant: FRAMEWORK_VERSION_STATUS_VARIANT,
  complianceStateLabels: REQUIREMENT_COMPLIANCE_STATE_LABELS,
  complianceStateVariant: REQUIREMENT_COMPLIANCE_STATE_VARIANT,
  complianceStateDescriptions: REQUIREMENT_COMPLIANCE_STATE_DESCRIPTIONS,
  mappingMigrationOutcomeLabels: MAPPING_MIGRATION_OUTCOME_LABELS,
  mappingMigrationOutcomeVariant: MAPPING_MIGRATION_OUTCOME_VARIANT,
  sortLabels: FRAMEWORK_SORT_LABELS,

  entityLabels: {
    framework: 'Framework',
    frameworkVersion: 'Versão do framework',
    requirement: 'Requisito',
    control: 'Controle',
  },

  register: {
    pageTitle: 'Biblioteca normativa',
    pageDescription:
      'Frameworks, suas versões e os requisitos (cláusulas) que a organização precisa atender.',
    createAction: 'Cadastrar framework',
    tableCaption: 'Frameworks cadastrados',
    columns: {
      code: 'Código',
      name: 'Nome',
      origin: 'Origem',
      versionCount: 'Versões',
      updatedAt: 'Atualizado em',
    },
    filters: {
      regionLabel: 'Filtros do registro de frameworks',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar por nome ou código',
      searchPlaceholder: 'Buscar frameworks…',
      originLabel: 'Origem',
    },
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (value: string): string => `Busca: "${value}"`,
      countChip: (label: string, count: number): string => `${label} (${count})`,
      valueChip: (label: string, value: string): string => `${label}: ${value}`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
    },
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      cardsLabel: 'Visualização em cards',
      table: 'Tabela',
      tableLabel: 'Visualização em tabela',
    },
    card: {
      regionLabel: 'Frameworks',
      originLabel: 'Origem',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      selectLabel: (code: string, name: string): string => `Abrir o framework ${code}: ${name}`,
    },
    results: {
      count: (total: number): string =>
        total === 1 ? '1 framework' : `${total.toLocaleString('pt-BR')} frameworks`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: FRAMEWORK_SORT_LABELS,
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      },
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} — ${directionLabel}`,
      sortOptions: {
        'code:asc': 'Código — crescente',
        'code:desc': 'Código — decrescente',
        'name:asc': 'Nome — crescente',
        'name:desc': 'Nome — decrescente',
        'updatedAt:asc': 'Atualizado em — crescente',
        'updatedAt:desc': 'Atualizado em — decrescente',
      } as Record<string, string>,
    },
    empty: {
      noneYet: {
        title: 'Nenhum framework cadastrado',
        description:
          'Cadastre a primeira norma a que a organização responde — uma norma externa (ISO, NIST, um decreto) ou uma política interna.',
        createAction: 'Cadastrar framework',
      },
      noResults: {
        title: 'Nenhum framework encontrado',
        description: 'Tente ajustar ou limpar os filtros e o termo de busca.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  frameworkForm: {
    createTitle: 'Cadastrar framework',
    createDescription:
      'Registre a norma — o nome, uma descrição e se é uma norma externa ou uma política interna.',
    editTitle: 'Editar framework',
    sections: {
      identification: {
        title: 'Identificação',
        description:
          'Estes dados identificam a norma; a versão e as cláusulas são cadastradas depois.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: { label: 'Descrição' },
      origin: {
        label: 'Origem',
        placeholder: 'Selecione a origem',
        description: 'Norma externa (ISO, NIST, um decreto) ou política interna da organização.',
      },
    },
    validation: {
      name: {
        required: 'Informe o nome do framework.',
        tooLong: 'O nome deve ter no máximo 300 caracteres.',
      },
      description: { required: 'Informe uma descrição.' },
      origin: { required: 'Selecione a origem do framework.' },
    },
    actions: {
      saveAndCreate: 'Cadastrar framework',
      creating: 'Cadastrando…',
      save: 'Salvar alterações',
      saving: 'Salvando…',
    },
    createSuccess: 'Framework cadastrado com sucesso.',
    updateSuccess: 'Framework atualizado com sucesso.',
    genericError: 'Não foi possível salvar o framework. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    conflict: {
      title: 'Este framework foi alterado por outra pessoa',
      description:
        'Alguém salvou uma alteração neste framework enquanto você editava. Reveja a versão atual antes de continuar.',
      modifiedAt: (when: string): string => `Alterado em ${when}.`,
      reloadAction: 'Ver versão atual',
      retryAction: 'Salvar mesmo assim',
      dismissAction: 'Continuar editando',
    },
    unsavedNote: 'As alterações só são salvas ao confirmar o formulário.',
  },

  frameworkDetail: {
    loading: 'Carregando framework…',
    notFoundTitle: 'Framework não encontrado',
    notFoundDescription:
      'O framework consultado não existe ou você não tem permissão para visualizá-lo.',
    editAction: 'Editar',
    breadcrumbLabel: 'Compliance',
    backToRegister: 'Voltar à biblioteca normativa',
    metadata: {
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      versions: 'Versões',
    },
    overview: {
      descriptionCardTitle: 'Descrição',
      contextCardTitle: 'Contexto normativo',
      originLabel: 'Origem',
      createdAtLabel: 'Cadastrado em',
      updatedAtLabel: 'Atualizado em',
      notSet: 'Não definido',
    },
    versions: {
      description:
        'Cada versão tem suas próprias cláusulas. Publicar uma versão a torna imutável; revisar a norma significa criar a versão seguinte, não reescrever esta.',
      createAction: 'Nova versão',
      tableCaption: 'Versões deste framework',
      columns: {
        label: 'Identificador (label)',
        status: 'Status',
        publishedAt: 'Publicada em',
        updatedAt: 'Atualizado em',
      },
      loadError: 'Não foi possível carregar as versões deste framework.',
      empty: {
        title: 'Nenhuma versão cadastrada',
        description:
          'Um framework sem versão é legível, mas não há o que medir ainda — cadastre a primeira versão com suas cláusulas.',
        createAction: 'Nova versão',
      },
    },
  },

  versionForm: {
    createTitle: 'Nova versão',
    createDescription: (frameworkName: string): string =>
      `A nova versão de "${frameworkName}" nasce em rascunho — a versão anterior, se houver, permanece íntegra e legível.`,
    editTitle: 'Editar identificador da versão',
    fields: {
      label: {
        label: 'Identificador (label)',
        description: 'Como esta versão é referida, por exemplo "2022" ou "Revisão 3".',
      },
    },
    validation: {
      label: {
        required: 'Informe o identificador da versão.',
        tooLong: 'O identificador deve ter no máximo 100 caracteres.',
      },
    },
    actions: {
      saveAndCreate: 'Criar versão',
      creating: 'Criando…',
      save: 'Salvar',
      saving: 'Salvando…',
    },
    createSuccess: 'Versão criada com sucesso.',
    updateSuccess: 'Identificador da versão atualizado com sucesso.',
    genericError: 'Não foi possível salvar a versão. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    labelAlreadyUsedHint:
      'Já existe uma versão deste framework com este identificador — escolha outro.',
  },

  versionDetail: {
    loading: 'Carregando versão…',
    notFoundTitle: 'Versão não encontrada',
    notFoundDescription:
      'A versão consultada não existe, não pertence a este framework, ou você não tem permissão para visualizá-la.',
    editAction: 'Editar identificador',
    backToFramework: (frameworkName: string): string => `Voltar a ${frameworkName}`,
    metadata: {
      framework: (name: string): string => `Framework: ${name}`,
      createdAt: (date: string): string => `Criada em ${date}`,
      publishedAt: (date: string): string => `Publicada em ${date}`,
      publishedBy: (name: string): string => `por ${name}`,
    },
    notEditableAfterPublish:
      'Esta versão já foi publicada. Uma versão publicada tem seu identificador e suas cláusulas fixados — revisar a norma significa criar a próxima versão, não alterar esta.',
    sections: {
      overview: 'Visão geral',
      requirements: 'Requisitos (cláusulas)',
      mappingMigration: 'Migração de mapeamento',
    },
    publish: {
      cardTitle: 'Publicação',
      draftDescription:
        'Publicar torna esta versão e todas as suas cláusulas imutáveis. Esta operação não pode ser desfeita — revisar a norma depois significa criar a versão seguinte.',
      publishedDescription: 'Esta versão está publicada e é imutável.',
      action: 'Publicar versão',
      confirmTitle: 'Publicar esta versão?',
      confirmDescription:
        'Depois de publicada, o identificador e as cláusulas desta versão não podem mais ser alterados. Uma versão sem nenhum requisito cadastrado não pode ser publicada.',
      confirmAction: 'Publicar',
      publishing: 'Publicando…',
      success: 'Versão publicada com sucesso.',
      genericError: 'Não foi possível publicar a versão. Tente novamente.',
      conflictError:
        'Esta versão foi alterada por outra pessoa desde a última leitura. Recarregue a página e tente novamente.',
      requirementCountHint: (count: number): string =>
        count === 1
          ? 'Esta versão tem 1 requisito cadastrado.'
          : `Esta versão tem ${count.toLocaleString('pt-BR')} requisitos cadastrados.`,
      noRequirementsWarning:
        'Esta versão ainda não tem nenhum requisito cadastrado. Uma versão sem cláusula alguma não pode ser publicada.',
    },
  },

  requirements: {
    sectionDescription:
      'O requisito é a cláusula da norma — distinto do controle, que é o que a organização faz a respeito dela.',
    notDraftNotice:
      'Esta versão já foi publicada; requisitos de uma versão publicada são imutáveis, então não é possível cadastrar nem editar requisitos aqui.',
    createFormTitle: 'Cadastrar requisito',
    editFormTitle: 'Editar requisito',
    fields: {
      externalRef: {
        label: 'Identificador na norma (externalRef)',
        description: 'Por exemplo "A.5.1" ou "Art. 12". Pode se repetir em normas diferentes.',
      },
      title: { label: 'Título' },
      description: { label: 'Descrição' },
    },
    validation: {
      externalRef: {
        required: 'Informe o identificador da cláusula na norma.',
        tooLong: 'O identificador deve ter no máximo 100 caracteres.',
      },
      title: {
        required: 'Informe o título.',
        tooLong: 'O título deve ter no máximo 300 caracteres.',
      },
      description: { required: 'Informe uma descrição.' },
    },
    actions: {
      saveAndCreate: 'Cadastrar requisito',
      creating: 'Cadastrando…',
      save: 'Salvar alterações',
      saving: 'Salvando…',
      cancelEdit: 'Cancelar edição',
      edit: 'Editar',
    },
    createSuccess: 'Requisito cadastrado com sucesso.',
    updateSuccess: 'Requisito atualizado com sucesso.',
    genericError: 'Não foi possível salvar o requisito. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    complianceStateLabel: 'Estado de conformidade',
  },

  requirementList: {
    description:
      'As cláusulas desta versão, com seu estado de conformidade calculado a partir dos controles ligados.',
    createAction: 'Cadastrar requisito',
    tableCaption: 'Requisitos desta versão',
    columns: {
      externalRef: 'Identificador',
      title: 'Título',
      complianceState: 'Estado de conformidade',
    },
    stateFilterLabel: 'Filtrar por estado de conformidade',
    loadingResults: 'Carregando requisitos…',
    loadError: 'Não foi possível carregar os requisitos desta versão.',
    resultsSummary: (total: number): string =>
      total === 1 ? '1 requisito' : `${total.toLocaleString('pt-BR')} requisitos`,
    empty: {
      noneYet: {
        title: 'Nenhum requisito cadastrado',
        description: 'Cadastre a primeira cláusula desta versão.',
        createAction: 'Cadastrar requisito',
      },
      noResults: {
        title: 'Nenhum requisito encontrado',
        description: 'Tente ajustar ou limpar o filtro de estado de conformidade.',
        clearAction: 'Limpar filtro',
      },
    },
  },

  requirementDetail: {
    loading: 'Carregando requisito…',
    notFoundTitle: 'Requisito não encontrado',
    notFoundDescription:
      'O requisito consultado não existe, não pertence a esta versão, ou você não tem permissão para visualizá-lo.',
    editAction: 'Editar',
    backToVersion: (versionLabel: string): string => `Voltar à versão ${versionLabel}`,
    metadata: {
      framework: (name: string): string => `Framework: ${name}`,
      version: (label: string): string => `Versão: ${label}`,
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      controlMapping: 'Controles mapeados',
      applicability: 'Aplicabilidade',
    },
    overview: {
      descriptionTitle: 'Descrição',
      complianceStateTitle: 'Estado de conformidade',
    },
  },

  controlMapping: {
    sectionDescription:
      'Os controles que a organização mantém para satisfazer esta cláusula. Um controle pode satisfazer cláusulas de normas diferentes sem nunca ser duplicado.',
    columns: {
      control: 'Controle',
      linkedBy: 'Vinculado por',
      linkedAt: 'Vinculado em',
      status: 'Status',
    },
    empty: 'Nenhum controle vinculado a esta cláusula.',
    pickerLabel: 'Vincular controle',
    pickerPlaceholder: 'Selecione um controle',
    pickerNoOptions: 'Nenhum controle disponível para vincular.',
    pickerSearchPlaceholder: 'Buscar controle por nome ou código',
    pickerAriaLabel: 'Selecionar controle',
    linkAction: 'Vincular',
    linkSuccess: 'Controle vinculado.',
    linkError: 'Não foi possível vincular o controle. Tente novamente.',
    alreadyLinkedError: 'Este controle já está vinculado a esta cláusula.',
    outOfScopeError:
      'Este controle não pôde ser vinculado — ele não existe ou está fora do seu escopo organizacional.',
    unlinkAction: 'Desvincular',
    unlinkSuccess: 'Controle desvinculado.',
    unlinkError: 'Não foi possível desvincular o controle. Tente novamente.',
    unlinkConfirm: {
      title: 'Desvincular controle?',
      description: (name: string): string =>
        `O controle "${name}" será desvinculado desta cláusula. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção — apenas deixa de contar como vigente, e o estado de conformidade da cláusula é recalculado.`,
    },
    showWithdrawnLabel: 'Mostrar vínculos desfeitos',
    withdrawnBadge: 'Desfeito',
    withdrawnAt: (date: string): string => `Desvinculado em ${date}`,
  },

  applicability: {
    defaultNotice:
      'Esta cláusula é aplicável (padrão) — nenhuma declaração de não aplicabilidade está ativa.',
    activeNotice:
      'Esta cláusula foi declarada não aplicável e não entra no cálculo de conformidade da versão.',
    activeWithLinksNotice:
      'Esta cláusula tem controle vinculado, mas continua fora do cálculo de conformidade enquanto a declaração de não aplicável estiver ativa — o vínculo é mantido porque a organização pode ter o controle por outra razão.',
    declaredBy: (name: string, date: string): string => `Declarado por ${name} em ${date}`,
    justificationLabel: 'Justificativa',
    declareAction: 'Declarar não aplicável',
    declareDialog: {
      title: 'Declarar cláusula não aplicável',
      description:
        'A cláusula deixa de contar no cálculo de conformidade da versão a partir de agora. Um vínculo de controle existente, se houver, é mantido.',
      justificationLabel: 'Justificativa',
      justificationPlaceholder: 'Por que esta cláusula não se aplica à organização?',
      justificationRequired: 'Informe a justificativa.',
      submit: 'Declarar não aplicável',
      submitting: 'Declarando…',
    },
    declareSuccess: 'Cláusula declarada não aplicável.',
    declareError: 'Não foi possível declarar a cláusula não aplicável. Tente novamente.',
    alreadyDeclaredError:
      'Já existe uma declaração de não aplicável ativa para esta cláusula. Revogue-a antes de declarar novamente.',
    revokeAction: 'Revogar declaração',
    revokeConfirm: {
      title: 'Revogar esta declaração?',
      description:
        'A cláusula volta a ser aplicável e volta a entrar no cálculo de conformidade da versão a partir de agora. A declaração permanece no histórico, com quem a revogou e quando.',
    },
    revokeSuccess: 'Declaração revogada — a cláusula voltou a ser aplicável.',
    revokeError: 'Não foi possível revogar a declaração. Tente novamente.',
    historyTitle: 'Histórico de declarações',
    historyEmpty: 'Nenhuma declaração de não aplicável foi registrada para esta cláusula.',
    historyColumns: {
      justification: 'Justificativa',
      declaredBy: 'Declarado por',
      declaredAt: 'Declarado em',
      revokedBy: 'Revogado por',
      revokedAt: 'Revogado em',
    },
    currentBadge: 'Ativa',
    revokedBadge: 'Revogada',
  },

  complianceSummary: {
    cardTitle: 'Estado de conformidade',
    cardDescription:
      'Calculado a partir das cláusulas aplicáveis desta versão e da efetividade dos controles ligados a elas.',
    loadingLabel: 'Calculando estado de conformidade…',
    loadError: 'Não foi possível calcular o estado de conformidade desta versão.',
    noRequirements: 'Esta versão ainda não tem nenhum requisito — não há o que medir.',
    totalRequirements: 'Total de cláusulas',
    applicableRequirements: 'Cláusulas aplicáveis',
    notApplicableCount: (count: number): string =>
      count === 1 ? '1 não aplicável' : `${count.toLocaleString('pt-BR')} não aplicáveis`,
    percentageUnavailable: 'Sem cláusula aplicável para medir',
    computedAt: (date: string): string => `Calculado em ${date}`,
  },

  mappingMigration: {
    sectionDescription:
      'Transporta o mapeamento requisito↔controle de outra versão deste framework para esta versão. Cada correspondência é decidida por quem executa a migração — o sistema nunca infere uma.',
    newAction: 'Nova migração',
    tableCaption: 'Migrações executadas para esta versão',
    columns: {
      source: 'Versão de origem',
      executedBy: 'Executado por',
      executedAt: 'Executado em',
      copied: 'Transportados',
      pending: 'Pendentes',
      skipped: 'Já mapeados',
    },
    viewDetailAction: 'Ver detalhe',
    loadingResults: 'Carregando migrações…',
    loadError: 'Não foi possível carregar as migrações desta versão.',
    empty: 'Nenhuma migração de mapeamento foi executada para esta versão ainda.',
    dialog: {
      title: 'Nova migração de mapeamento',
      description:
        'Escolha a versão de origem e, para cada requisito de destino que deve herdar mapeamento, escolha um ou mais requisitos de origem correspondentes. Requisitos de destino já mapeados são preservados automaticamente; os deixados sem correspondência ficam pendentes de decisão.',
      sourceVersionLabel: 'Versão de origem',
      sourceVersionPlaceholder: 'Selecione a versão de origem',
      sourceVersionNoOptions: 'Nenhuma outra versão deste framework está disponível como origem.',
      loadingRequirements: 'Carregando requisitos…',
      loadRequirementsError: 'Não foi possível carregar os requisitos de uma das versões.',
      targetColumnLabel: 'Requisito de destino (esta versão)',
      sourcePickerLabel: 'Adicionar correspondência',
      sourcePickerPlaceholder: 'Selecione um requisito de origem',
      sourcePickerNoOptions: 'Nenhum requisito de origem disponível.',
      addAction: 'Adicionar',
      removeAction: 'Remover',
      noCorrespondenceHint:
        'Sem correspondência — ficará pendente de decisão, a menos que já tenha mapeamento próprio.',
      submit: 'Executar migração',
      submitting: 'Executando…',
      cancel: 'Cancelar',
      genericError: 'Não foi possível executar a migração. Tente novamente.',
    },
    executeSuccess: 'Migração executada com sucesso.',
    resultTitle: 'Resultado da migração',
    resultCloseAction: 'Concluir',
    resultPendingNotice: (count: number): string =>
      count === 1
        ? '1 requisito ficou pendente de decisão — ainda precisa de mapeamento.'
        : `${count.toLocaleString('pt-BR')} requisitos ficaram pendentes de decisão — ainda precisam de mapeamento.`,
    itemColumns: {
      target: 'Requisito de destino',
      sources: 'Requisito(s) de origem',
      outcome: 'Resultado',
      copiedLinkCount: 'Vínculos transportados',
    },
    noSources: '—',
  },

  mappingMigrationDetail: {
    loading: 'Carregando migração…',
    notFoundTitle: 'Migração não encontrada',
    notFoundDescription:
      'A migração consultada não existe ou você não tem permissão para visualizá-la.',
    backToVersion: (versionLabel: string): string => `Voltar à versão ${versionLabel}`,
    title: (sourceLabel: string, targetLabel: string): string =>
      `Migração de ${sourceLabel} para ${targetLabel}`,
    metadata: {
      executedBy: (name: string): string => `Executado por ${name}`,
      executedAt: (date: string): string => `em ${date}`,
    },
  },

  navigation: {
    label: 'Compliance',
  },
} as const;
