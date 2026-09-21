/**
 * PharosGRC — Gestão de Problemas (pt-BR), 008-incidents-problems.
 *
 * Extends the frontend-facing scaffold (coordinator instruction,
 * 2026-09-11) with the strings the register, create/edit form, detail
 * view, lifecycle actions and relationship sections actually need — see
 * `lib/messages/incidents.ts`'s own header comment for the shared
 * reasoning this file does not repeat.
 *
 * `statusLabels`/`severityLabels` are exhaustive `Record`s typed against
 * this app's own union types (F-1) — a new enum value with no translation
 * here is a compile error, never a raw identifier shown at runtime.
 *
 * `relationships.incidents` below is the WRITE side of the shared
 * Problem<->Incident many-to-many (research.md D-14) — full `pickerLabel`/
 * `linkAction`/`unlinkAction`, unlike `incidents.ts`'s own
 * `relationships.problems`, which is read-only from that side.
 */
import type { ProblemSeverity, ProblemStatus } from '@/features/problems/types';

/** Mirrors `ProblemStatus` (data-model.md, research.md D-5) — same shape as `IncidentStatus`, with `IN_ANALYSIS` in place of `IN_PROGRESS` because a problem's own work is investigative (finding the root cause), not an ongoing mitigation. */
const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  OPEN: 'Aberto',
  IN_ANALYSIS: 'Em análise',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

/** Mirrors `ProblemSeverity` — a domain-own enum (D-9), never shared with `IncidentSeverity` even though the four values read identically. */
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

    /**
     * Compact indicator row above the toolbar (CLAUDE.md §18.5, §19.7),
     * mirroring `risks.register.summary`'s own reasoning: every figure comes
     * from `GET /dashboard/summary`'s `breakdowns.problems` block — never a
     * second count computed on this screen — and the strip renders nothing
     * at all when the caller lacks `problem:view` (the block itself is then
     * absent on the wire).
     */
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
      /** The indicators are a summary on top of an otherwise working register — a failure here degrades to this one quiet line, never to an error state that hides the list. */
      error: 'Não foi possível carregar os indicadores.',
    },

    /** Cards ↔ Tabela segmented control (CLAUDE.md §18) — cards is the primary view, mirroring every other register in the product. */
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver os problemas em cards',
      tableLabel: 'Ver os problemas em tabela',
    },

    /** The card itself (CLAUDE.md §18, §18.12). No description row — `ProblemSummary` carries none (mirrors the Audit Engagements catalog's identical precedent). Whole-card stretched link to `/problems/{id}`; this register offers no quick view. */
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
    /** `ProblemEditPanel`'s own overlay header description (019-problem-detail-experience, Fase C), mirroring `incidents.form.editDescription`'s exact wording pattern. */
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

    /**
     * The four top-level groups of the problem detail's two-level
     * navigation (019-problem-detail-experience, Fase A) — level 1 of the
     * `EntityTabs`/`EntityTabs` nesting `ProblemDetailView` builds. Leaf
     * section labels stay exactly `sections` above; nothing here duplicates
     * them. Same four group ids/labels as `incidents.detail.groups`
     * (CLAUDE.md §18.12 — the same concept gets the same word on both
     * screens), each grouping Problem's own seven existing sections instead
     * of Incident's nine.
     */
    groups: {
      overview: 'Visão geral',
      response: 'Resposta',
      relationships: 'Relacionamentos',
      register: 'Registro',
    },
    groupsAriaLabel: 'Grupos de seções do problema',
    /** Accessible name for a group's own leaf-section `EntityTabs`, e.g. "Seções de Relacionamentos". */
    sectionsAriaLabel: (groupLabel: string): string => `Seções de ${groupLabel}`,
    /**
     * Accessible name for `DetailLayout`'s `asideLabel` — the sticky
     * `complementary` landmark holding Ações rápidas/Relacionamentos/Última
     * atualização (019-problem-detail-experience, Fase C). Mirrors
     * `incidents.detail.asideLabel`'s own naming exactly.
     */
    asideLabel: 'Contexto do problema',

    /**
     * The contextual aside's "Ações rápidas" and "Relacionamentos" blocks
     * (`problem-context-aside.tsx`, Fase C) — no "Atenção" block exists for
     * Problem (see that file's own header comment: there is no honest
     * pendency to report, unlike Risk's overdue review/treatment or pending
     * approval). Five quick actions, not Incident's six: Problem has only
     * two relationship sections of its own (Riscos, Incidentes — no Ativos/
     * Processos), so there is no "vincular ativo"/"vincular processo"
     * equivalent here.
     */
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
      /** Trailing hint for every relationship row — `ProblemDetail` carries no counts for either, mirroring `incidents.detail.relationshipsPanel.viewHint`'s own reasoning: never a fabricated number, never a second request just to produce one (F-59). */
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',

    /**
     * The problem's conditional lifecycle outcome facts — rendered inside
     * `ProblemLifecycleSection`'s "Ciclo de vida" card
     * (019-problem-detail-experience, Fase B), not inside `ProblemOverview`
     * any more: each describes an OUTCOME OF A TRANSITION (resolving,
     * closing, cancelling), not a fact about the record's identity. Mirrors
     * `incidents.detail.lifecycleOutcomes`'s own shape, minus a
     * `resolutionSummary` equivalent — `Problem` has no such field; its own
     * resolution fact is `rootCause`, which gets its OWN first-class card in
     * "Visão geral" instead (see `overview.rootCauseCardTitle` below), not a
     * lifecycle outcome. Every field here renders only when the underlying
     * value is actually present.
     */
    lifecycleOutcomes: {
      resolvedAtLabel: 'Resolvido em',
      resolvedByLabel: 'Resolvido por',
      closedAtLabel: 'Fechado em',
      closedByLabel: 'Fechado por',
      cancellationReasonLabel: 'Motivo do cancelamento',
    },

    /**
     * The "Ciclo de vida" track visual (`ProblemLifecycleTrackView`) —
     * labels for the four main-track `ProblemStatus` positions come from
     * `problemStatusLabel`/`statusLabels` above, the exact same word the
     * header's own `StatusBadge` uses. `stateLabels` mirrors
     * `incidents.detail.lifecycleTrack.stateLabels`'s own vocabulary exactly
     * (CLAUDE.md §18.12 — same concept, same word on both screens).
     */
    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida do problema',
      cancelledAriaLabel: 'Problema cancelado',
      /**
       * Short context line under the `CANCELLED` node — this payload does
       * not record which of the two possible origins (`OPEN`/`IN_ANALYSIS`)
       * the cancellation came from, so the node is presented as a terminal
       * of the WHOLE trajectory, never visually tied to a specific column
       * (mirrors `incidents.detail.lifecycleTrack.cancelledContextLabel`'s
       * own reasoning).
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
   * The overview section's cards — "Descrição", "Causa raiz" and "Detalhes
   * do problema" (019-problem-detail-experience, Fase B), mirroring
   * `incidents.overview`'s own shape. The record's lifecycle outcome facts
   * are NOT here — see `detail.lifecycleOutcomes` above.
   *
   * `rootCauseCardTitle`/`rootCauseEmptyDescription` exist because
   * `rootCause` is the point of registering a Problem at all (the
   * coordinator's own framing, 2026-09-17): a problem's own work is
   * investigative (`IN_ANALYSIS`, not `IN_PROGRESS`), and the identified
   * root cause is the result of that investigation — it gets a dedicated
   * card, directly after "Descrição", never a `<dl>` cell with the exact
   * same visual weight as "Registrado em". The empty-state sentence names
   * only what the data actually says (not yet identified) — never a
   * placeholder that reads like content.
   */
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

  /**
   * Legal moves per `problems.openapi.yaml`'s own `transitionProblem`
   * description: `OPEN->IN_ANALYSIS`, `OPEN->CANCELLED`,
   * `IN_ANALYSIS->RESOLVED`, `IN_ANALYSIS->CANCELLED`, `RESOLVED->CLOSED`,
   * `RESOLVED->IN_ANALYSIS` (reopen). `CLOSED` requires a completed
   * corrective `Action` AND a closer different from whoever completed it
   * (D-7, segregation of duties) — `closeConfirm` below names both
   * preconditions explicitly rather than leaving a generic "tem certeza?",
   * since a caller who does not yet know why a close attempt failed cannot
   * self-correct.
   */
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
    /** Accessible name for `ProblemCloseDialog`'s confirm button — the
     * visible label stays the short "Fechar" (`actions.close` above), but
     * the dialog's own native dismiss ("X") button ALSO carries the
     * accessible name "Fechar" (the shared `Dialog` component's own
     * localized close label) — found by running the rendered dialog
     * (CLAUDE.md §18.1): `getByRole('button', {name: 'Fechar'})` matched
     * BOTH buttons. A distinct `aria-label` on the confirm button removes
     * the ambiguity for assistive technology without changing the
     * domain's own short visible verb. */
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
    /** `422` whose specific cause is "no completed corrective Action yet" or "same user resolved and closed" (D-7) — surfaced honestly rather than folded into the generic `transitionError` above, since the caller needs to know WHICH precondition failed to act on it. */
    closeMissingActionError:
      'Este problema ainda não tem uma ação corretiva concluída — feche depois que a ação de origem for concluída.',
    closeSameUserError:
      'Quem fecha o problema precisa ser diferente de quem concluiu a ação corretiva.',
    /**
     * CLAUDE.md §18.11 — checked proactively when the close dialog opens
     * (a single `GET /actions?originType=PROBLEM&originId=&status=COMPLETED`
     * call, exactly as cheaply knowable as `FindingCloseDialog`'s own
     * evidence check), so the requirement is visible BEFORE any attempt,
     * not only as a `422` after one.
     */
    closeRequirement: {
      title: 'Ação corretiva concluída necessária',
      description:
        'O fechamento exige ao menos uma ação corretiva concluída, originada deste problema. Conclua a ação antes de tentar fechar.',
      checking: 'Verificando ação corretiva…',
    },
  },

  /**
   * The problem detail's own "Ações corretivas" tab (008-incidents-problems
   * follow-up, 2026-09-11) — the ONLY affordance in the product that lets a
   * caller create the completed `Action` `lifecycle.confirm.close`
   * above requires (data-model.md Invariant P2). Uses the shared `Action`
   * capability directly (`features/actions/api.ts`'s `actionsApi`,
   * `originType: 'PROBLEM'`) — CLAUDE.md §19.6: Action is a core capability
   * consumed by every domain that needs corrective work, never a
   * domain-specific task table. Status changes (start/complete/cancel/
   * reopen) reuse `features/actions/status.ts`'s own transition table and
   * `ReopenActionDialog` rather than restating the five-edge lifecycle a
   * third time in this module.
   */
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
    /** Shared across both subsections below — mirrors `findingLinks`'s own top-level placement in `lib/messages/audit-engagements.ts`. */
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
    /**
     * WRITE side of the shared many-to-many (research.md D-14) — full
     * picker/link/unlink, unlike `incidents.ts`'s own `relationships
     * .problems`, which only ever renders a list.
     */
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
        // Deliberately says nothing about either record's status — a
        // Brazilian user reads only what desvincular does, never a
        // citation to research.md D-15 (no internal identifier belongs in
        // user-facing text — `no-internal-identifiers.test.ts`'s own
        // guard). The "unlink never touches either lifecycle" decision
        // that citation names lives in the code comment above
        // `relationships.incidents`, not in this string.
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

  /**
   * Comments (CLAUDE.md §19.10 remediation — `CommentableEntityType.PROBLEM`
   * was registered on the backend with no reachable interface). Feeds
   * `CommentThread` (`@pharos/design-system`), exactly mirroring
   * `risks.ts`'s own `comments` catalog (D-10: every word supplied by the
   * consuming feature, never the generic component).
   */
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

  /**
   * Attachments (CLAUDE.md §19.10 remediation — `AttachableEntityType
   * .PROBLEM` was registered on the backend with no reachable interface).
   * Feeds `AttachmentList` (`@pharos/design-system`), mirroring `risks.ts`'s
   * own `attachments` catalog exactly.
   */
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
