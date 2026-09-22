/**
 * PharosGRC — Compliance (pt-BR), 004-compliance-management.
 *
 * Third business-module message area (CLAUDE.md §1, §9/§18.12 — follows the
 * convention `risks.ts`/`controls.ts` already established). Field labels
 * mirror `specs/004-compliance-management/data-model.md` and
 * `contracts/compliance.openapi.yaml`.
 *
 * ADR-017's own vocabulary, kept unmistakable throughout this catalog: a
 * **Framework** is a norm (ISO 27001, a decree, an internal policy); a
 * **Requisito** ("cláusula") is one clause of a specific **versão** of that
 * norm; a **Controle** is what the organization does about it — the
 * requirement↔control mapping is built by this catalog's own
 * `controlMapping` section, and the two words are never conflated.
 *
 * All 23 contract operations are wired server-side. This catalog covers the
 * full module: the normative library (US1), requirement↔control mapping and
 * mapping migration between versions (US2), and applicability declaration
 * with the calculated compliance state (US3).
 */
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

/** Mirrors `enum FrameworkVersionStatus` (research.md D-3) — a two-state, one-way lifecycle. */
const FRAMEWORK_VERSION_STATUS_LABELS: Record<FrameworkVersionStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
};

const FRAMEWORK_VERSION_STATUS_VARIANT: Record<FrameworkVersionStatus, StatusVariant> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
};

/**
 * Mirrors `enum RequirementComplianceState` (data-model.md §7, FR-017 to
 * FR-020) — the requirement's DERIVED, calculated compliance state. Five
 * distinct words, never collapsed to three, and never conveyed by colour
 * alone (CLAUDE.md §18.8) — `NOT_PROVEN` and `PARTIALLY_MET` deliberately
 * share the 'warning' colour but never the same icon or label.
 */
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

/**
 * A one-line explanation of each compliance state, for use wherever the
 * badge alone would leave the auditor-relevant distinction unclear — most
 * of all `NOT_MET` ("não atendido": zero controles ligados) versus
 * `NOT_PROVEN` ("não comprovado": mapeado, mas sem comprovação vigente).
 */
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

/** Mirrors `enum MappingMigrationOutcome` (data-model.md §5, research.md D-6) — the per-target-requirement result of a mapping migration. */
const MAPPING_MIGRATION_OUTCOME_LABELS: Record<MappingMigrationOutcome, string> = {
  COPIED: 'Transportado',
  PENDING_DECISION: 'Pendente de decisão',
  SKIPPED_ALREADY_MAPPED: 'Já tinha mapeamento próprio',
};

const MAPPING_MIGRATION_OUTCOME_VARIANT: Record<MappingMigrationOutcome, StatusVariant> = {
  COPIED: 'success',
  // Deliberately NOT 'neutral': a pending decision is unfinished work, not
  // an inert fact — the instruction this catalog must honour is "shown as
  // work still to do, not as success".
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

  /**
   * `/compliance` — the framework register (US1), joined to the shared
   * exploration frame (CLAUDE.md §18.12): collapsible `FilterBar` + chip
   * row, `ResultsToolbar` (count + `SortSelect` + `ViewToggle`), Cards or
   * `DataTable`, shared `PaginationFooter` — the same composition
   * Risks/Controls/Assets/Processes/Audits already use. No quick-view side
   * panel: the code/title are already the record's own direct link, exactly
   * like `AssetCard`/`AuditEngagementCard`.
   *
   * Deliberately no KPI strip (coordinator decision, 2026-09-14): the only
   * cross-module figure this catalogue could read
   * (`breakdowns.compliance` — REQUIREMENT-level conformity, organization-
   * wide) describes a different aggregate than what this screen lists
   * (FRAMEWORKS). There is no global, filterable requirement register for a
   * "não conformes" tile to link into — requirements only ever list scoped
   * to one `FrameworkVersion` (`RequirementListSection`, nested three levels
   * under a framework) — so a requirement-conformity tile on a framework
   * list would either lie about what it counts or link nowhere real. Ship
   * honest: no strip, rather than an invented framework-level metric.
   */
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
    /** Cards is the primary view (CLAUDE.md §18); the table remains for dense comparison. */
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      cardsLabel: 'Visualização em cards',
      table: 'Tabela',
      tableLabel: 'Visualização em tabela',
    },
    /** `FrameworkCard`/`FrameworkCardGrid` — no quick-view side panel, so the card's own click targets navigate straight to `/compliance/{id}`. */
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
      /** Every field × direction `listFrameworks`'s own `sort` enum accepts — the full cartesian product, declared as data (mirrors `incidents.ts`'s/`assets.ts`'s own `results.sortOptions`). */
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

  /** Framework create/edit form. */
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

  /** `/compliance/[frameworkId]` — framework detail (US1). */
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

  /** Framework version create/edit form. */
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

  /** `/compliance/[frameworkId]/versions/[versionId]` — version detail (US1). */
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

  /** Requirement create/edit form (`RequirementInlineForm`) — permitted only while the parent version is `DRAFT` (FR-004). */
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

  /** `RequirementListSection` — the "Requisitos" tab of the version detail screen (US1/US3, operation 10). */
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

  /** `/compliance/[frameworkId]/versions/[versionId]/requirements/[requirementId]` — requirement detail (US2/US3). */
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

  /**
   * `RequirementControlsSection` — the requirement's own N:M mapping to
   * controls (US2, ADR-020). Link/unlink is permitted regardless of the
   * requirement's own version status or applicability declaration (FR-004
   * governs the clause's text, not its mappings) — this section is never
   * gated by `versionIsDraft` the way the requirement text form is.
   */
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
    /** 422: the referenced control does not exist, or lies outside the caller's organizational scope — deliberately indistinguishable (FR-022). */
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

  /**
   * `RequirementApplicabilitySection` (US3, FR-015/FR-016). A requirement
   * with no active declaration is applicable by default — that state is
   * shown as plainly as an active declaration, never left implicit.
   */
  applicability: {
    defaultNotice:
      'Esta cláusula é aplicável (padrão) — nenhuma declaração de não aplicabilidade está ativa.',
    activeNotice:
      'Esta cláusula foi declarada não aplicável e não entra no cálculo de conformidade da versão.',
    /** Shown alongside `activeNotice` when the requirement also carries a control link — the edge case the spec names explicitly: not a contradiction. */
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

  /** `ComplianceSummaryCard` — the version's calculated aggregate compliance state (US3, FR-020). */
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

  /**
   * `MappingMigrationPanel`/`MappingMigrationDialog` (US2, FR-012 to
   * FR-014). The compliance manager decides every correspondence by hand —
   * this screen never proposes one from matching `externalRef` or text
   * (research.md D-6), and a target left without a chosen source comes back
   * `PENDING_DECISION`, always shown as unfinished work, never as success.
   */
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
    // Deliberately not "Fechar": Radix's own dialog-close (X) button already
    // carries that exact accessible name via its sr-only text
    // (`common.dialog.closeLabel`) — a second control with the identical
    // name would be an accessible-name collision (the same class of defect
    // `risks/components/risk-controls-section.tsx`'s own `aria-label`
    // comment documents), not merely an inconvenience for this script's own
    // locators.
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

  /** `/compliance/[frameworkId]/versions/[versionId]/mapping-migrations/[migrationId]` — one migration's full per-requirement detail (SC-004). */
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

  /** Navigation entry (T063). */
  navigation: {
    label: 'Compliance',
  },
} as const;
