/**
 * PharosGRC — Gestão de Incidentes (pt-BR), 008-incidents-problems.
 *
 * Frontend-facing scaffold only (coordinator instruction, 2026-09-11): the
 * backend and Prisma schema for this module are being built by a separate
 * front, so nothing here has been exercised against a running endpoint yet.
 * Field labels and lifecycle vocabulary mirror
 * `specs/008-incidents-problems/contracts/incidents.openapi.yaml` and
 * `data-model.md`/`research.md` (D-4, D-6) exactly — every label here names
 * a real `Incident` field or a real transition, never an invented one.
 * Presentation-specific copy that depends on a screen layout not yet
 * designed (card quick-view panels, sort-dropdown option strings, filter
 * chips) is deliberately NOT included here — that belongs to whichever
 * session builds the actual catalog/detail screens (tasks.md T028/T029),
 * the same way `controls.ts`'s own `register.card`/`register.results
 * .sortOptions` sections were written alongside the components that
 * consume them, not before.
 *
 * `statusLabels`/`severityLabels` below are exhaustive `Record`s typed
 * against this app's own union types (F-1, `risks.ts`'s own header
 * comment) — adding a value to an enum without adding its translation here
 * is a compile error, never a raw identifier shown to a Brazilian user at
 * runtime.
 *
 * The relationship to `Problem` is deliberately READ-ONLY in this catalog's
 * `relationships.problems` (no `pickerLabel`/`pickerPlaceholder`/link
 * action) — `problems.openapi.yaml` owns the write side of the shared
 * many-to-many (research.md D-14); `incidents.ts`'s own `relationships
 * .incidents` section is the write side, from the Problem catalog's point
 * of view.
 */
import type {
  IncidentSeverity,
  IncidentStatus,
  ProblemStatusRef,
} from '@/features/incidents/types';

/** Mirrors `IncidentStatus` (data-model.md, research.md D-4) — five states, each with an observable consequence; never merged with `ProblemStatus` even though three of the five names coincide (D-5's own reasoning for keeping the two enums separate). */
const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

/** Mirrors `IncidentSeverity` — a domain-own enum (D-9), never shared with `ProblemSeverity` even though the four values read identically. */
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
      /** Every field × direction this contract's own `sort` enum accepts (research.md/`incidents.openapi.yaml`) — the full cartesian product, the same set this register has always offered, now declared instead of recomputed in the component. */
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

    /** Cards is the primary view (CLAUDE.md §18); the table remains for dense comparison — the same `ViewToggle` vocabulary every other register in this product already uses. */
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      cardsLabel: 'Visualização em cards',
      table: 'Tabela',
      tableLabel: 'Visualização em tabela',
    },

    /** `IncidentCard`/`IncidentCardGrid` — no quick-view side panel for this register (mirrors `AssetCard`'s/`AuditEngagementCard`'s own precedent), so the card's own click target navigates straight to `/incidents/{id}`. */
    card: {
      regionLabel: 'Incidentes',
      orgUnitLabel: 'Unidade',
      ownerLabel: 'Responsável',
      reportedOnLabel: 'Reportado em',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      updatedAtUnknown: 'Data de atualização não disponível',
      selectLabel: (code: string, title: string): string => `Abrir o incidente ${code}: ${title}`,
    },

    /**
     * `IncidentRegisterSummary` (CLAUDE.md §18.5, §19.7) — see that
     * component's own header comment for why its source is
     * `dashboardApi.getSummary()`'s `breakdowns.incidents`, not a second
     * `GET /incidents` calculator.
     */
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
    /** `IncidentEditPanel`'s own overlay header description (Fase 4), mirroring `risks.form.editDescription`'s exact wording pattern. */
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

    /**
     * The four top-level groups of the incident detail's two-level
     * navigation (018-incident-detail-experience, Fase 2+3) — level 1 of the
     * `EntityTabs`/`EntityTabs` nesting `IncidentDetailView` builds. Leaf
     * section labels stay exactly `sections` above; nothing here duplicates
     * them. Deliberately FOUR groups, not Risk's five: Incidents has no
     * "Análise" — copying Risk's own five-group shape verbatim was
     * explicitly ruled out.
     */
    groups: {
      overview: 'Visão geral',
      response: 'Resposta',
      relationships: 'Relacionamentos',
      register: 'Registro',
    },
    groupsAriaLabel: 'Grupos de seções do incidente',
    /** Accessible name for a group's own leaf-section `EntityTabs`, e.g. "Seções de Relacionamentos". */
    sectionsAriaLabel: (groupLabel: string): string => `Seções de ${groupLabel}`,
    /**
     * Accessible name for `DetailLayout`'s `asideLabel` — the sticky
     * `complementary` landmark holding Ações rápidas/Relacionamentos/Última
     * atualização (018-incident-detail-experience, Fase 4). Mirrors
     * `risks.detail.asideLabel`'s own naming exactly.
     */
    asideLabel: 'Contexto do incidente',

    /**
     * The contextual aside's "Ações rápidas" and "Relacionamentos" blocks
     * (`incident-context-aside.tsx`, Fase 4) — no "Atenção" block exists for
     * Incident (see that file's own header comment: there is no honest
     * pendency to report, unlike Risk's overdue review/treatment or pending
     * approval).
     */
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
      /** Trailing hint for every relationship row — `IncidentDetail` carries no counts for any of the four, mirroring `risks.detail.relationshipsPanel.viewHint`'s own reasoning: never a fabricated number, never a second request just to produce one (F-59). */
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',

    /**
     * The incident's conditional lifecycle outcome facts — rendered inside
     * `IncidentLifecycleSection`'s "Ciclo de vida" card
     * (018-incident-detail-experience, Fase 2+3), not inside `IncidentOverview`
     * any more: each describes an OUTCOME OF A TRANSITION (resolving,
     * closing, cancelling), not a fact about the record's identity. Every
     * field here renders only when the underlying value is actually present
     * — a brand-new `OPEN` incident shows none of them, exactly as before
     * this move.
     */
    lifecycleOutcomes: {
      resolutionSummaryLabel: 'Resumo da resolução',
      resolvedAtLabel: 'Resolvido em',
      resolvedByLabel: 'Resolvido por',
      closedAtLabel: 'Fechado em',
      closedByLabel: 'Fechado por',
      cancellationReasonLabel: 'Motivo do cancelamento',
    },

    /**
     * The "Ciclo de vida" track visual (`IncidentLifecycleTrackView`) —
     * labels for the four main-track `IncidentStatus` positions come from
     * `incidentStatusLabel`/`statusLabels` above, the exact same word the
     * header's own `StatusBadge` uses; nothing here re-names a status.
     * `stateLabels` mirrors Risk's own lifecycle-spine vocabulary
     * ("Concluído"/"Atual"/"Disponível"/"Indisponível") — the same concept
     * gets the same words across both screens (CLAUDE.md §18.12) — minus
     * "Bloqueado", which has no equivalent here: Incidents has no
     * precondition-evaluation endpoint to report a blocked transition from.
     */
    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida do incidente',
      cancelledAriaLabel: 'Incidente cancelado',
      /**
       * Short context line under the `CANCELLED` node (C2, Fase 2+3 review
       * correction) — this payload does not record which of the two
       * possible origins (`OPEN`/`IN_PROGRESS`) the cancellation came from,
       * so the node is presented as a terminal of the WHOLE trajectory,
       * never visually tied to a specific column. This sentence is the
       * honest substitute for the dashed connector that used to (wrongly)
       * suggest "cancelled from Aberto".
       */
      cancelledContextLabel: 'Encerrado por cancelamento',
      stateLabels: {
        current: 'Atual',
        completed: 'Concluído',
        available: 'Disponível',
        unavailable: 'Indisponível',
      },
    },
  },

  /**
   * The overview section's first two cards — "Descrição" and "Detalhes do
   * incidente" (018-incident-detail-experience, Fase 2+3), mirroring
   * `risks.ts`'s own top-level `overview` catalog exactly (same shape,
   * consumed the same way by the shared `DetailField`). The record's
   * lifecycle outcome facts are NOT here — see `detail.lifecycleOutcomes`
   * above.
   */
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

  /**
   * Legal moves per `incidents.openapi.yaml`'s own `transitionIncident`
   * description: `OPEN->IN_PROGRESS`, `OPEN->CANCELLED`,
   * `IN_PROGRESS->RESOLVED`, `IN_PROGRESS->CANCELLED`, `RESOLVED->CLOSED`,
   * `RESOLVED->IN_PROGRESS` (reopen). Closing an incident one resolved
   * oneself needs no second approver (D-6) — unlike `Problem`'s `CLOSED`
   * transition below, there is no segregation-of-duties copy here.
   */
  lifecycle: {
    /**
     * The "Ciclo de vida" card's own title/description
     * (`IncidentLifecycleSection`, 018-incident-detail-experience), mirroring
     * `risks.ts`'s `lifecycle.cardTitle`/`cardDescription` — the exact same
     * card CONCEPT on both screens, even though the trajectory visual and
     * the transition table underneath are each domain-specific.
     */
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

  /**
   * The incident detail's own "Ações corretivas" tab (008-incidents-problems
   * follow-up, 2026-09-11) — mirrors `problems.ts`'s own `correctiveActions`
   * exactly, minus its closing-precondition sentence (`Incident` has no
   * equivalent to Invariant P2: closing an incident never requires a
   * completed `Action`). Uses the shared `Action` capability directly
   * (`features/actions/api.ts`'s `actionsApi`, `originType: 'INCIDENT'`) —
   * see that file's own header comment for the full CLAUDE.md §19.6
   * reasoning this one does not repeat.
   */
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
    /**
     * Read-only from this side (research.md D-14): `problems.openapi.yaml`
     * owns `POST`/`DELETE /problems/{problemId}/incidents`. No
     * `pickerLabel`/`linkAction`/`unlinkAction` here — this section only
     * ever renders `GET /incidents/{incidentId}/problems`'s own list.
     */
    problems: {
      sectionTitle: 'Problemas',
      sectionDescription:
        'Problemas que apontam este incidente como contribuinte. Vincular ou desvincular acontece a partir do problema.',
      empty: 'Nenhum problema vinculado a este incidente.',
      loading: 'Carregando problemas vinculados…',
      loadError: 'Não foi possível carregar os problemas vinculados a este incidente.',
      /** `ProblemStatusRef` (`packages/api-types/src/generated/incidents.ts`)
       * — Problem's own status enum, read only from this side; never merged
       * with `incidents.statusLabels` above even though three of the five
       * names coincide (same reasoning as `problems.ts`'s own
       * `PROBLEM_STATUS_LABELS` header comment). */
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

  /**
   * Comments (CLAUDE.md §19.10 remediation — `CommentableEntityType.INCIDENT`
   * was registered on the backend with no reachable interface). Feeds
   * `CommentThread` (`@pharos/design-system`), exactly mirroring
   * `risks.ts`'s own `comments` catalog (D-10: every word supplied by the
   * consuming feature, never the generic component).
   */
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

  /**
   * Attachments (CLAUDE.md §19.10 remediation — `AttachableEntityType
   * .INCIDENT` was registered on the backend with no reachable interface).
   * Feeds `AttachmentList` (`@pharos/design-system`), mirroring `risks.ts`'s
   * own `attachments` catalog exactly.
   */
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
