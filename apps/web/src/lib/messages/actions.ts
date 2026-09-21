import type { AuditOutcome } from '@/features/actions/types';
import type { GrcFoundation } from '@pharos/api-types';
import type { StatusVariant } from '@pharos/design-system/components';

/**
 * PharosGRC — Ação (pt-BR), 002-shared-grc-foundation, T004.
 *
 * See `evidence.ts`'s header for the full explanation of the modular
 * convention and the hand-authored-union-type approach this file follows
 * identically — with ONE deliberate exception below.
 *
 * `ActionOriginType` used to be a hand-restated union here (`'RISK_TREATMENT'
 * | 'FINDING' | 'CONTROL_ASSESSMENT'`), the exact same shape as two other
 * independent copies on the server (`CreateActionRequestDto`'s `@IsIn` list
 * and `ListActionQueryDto`'s own) and the contract document itself — found,
 * 2026-09-11, missing `CONTROL_ASSESSMENT` reachability in one copy and
 * `INCIDENT`/`PROBLEM` in all of them, three independent restatements of
 * one enum that had already drifted from each other and from the database.
 * The three server-side copies are now derived or corrected; this is the
 * frontend's own copy, closed the same way: derived from the GENERATED
 * schema (`@pharos/api-types`'s `GrcFoundation` namespace, produced from
 * `grc-foundation.openapi.yaml`) rather than restated, so a future origin
 * added to the contract makes `originTypeLabels` below fail to compile
 * here until its label is added — never silently rendering blank the way
 * a hand-restated union that quietly excluded a value would. */
export type ActionOriginType = GrcFoundation.components['schemas']['ActionOriginType'];

/** Mirrors `enum ActionStatus` (data-model.md §4) — deliberately identical
 * in shape to `TreatmentActionStatus` (`features/risks/types.ts`) so the
 * R-003 convergence is a straightforward mapping, not a translation. */
export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Mirrors `AuditEvent.outcome` (`features/actions/types.ts`'s own copy of the platform-wide audit-event shape, ADR-007). Same F-1 exhaustiveness reasoning `risks.ts`'s own `AUDIT_OUTCOME_LABELS` documents. */
const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = {
  SUCCESS: 'Sucesso',
  FAILURE: 'Falha',
  DENIED: 'Negado',
};

/** `AuditTimelineLabels.outcomeVariant` (`@pharos/design-system`, D-10) — same colour convention `risks.ts`'s own `auditOutcomeVariant` establishes: `DENIED`/`FAILURE` share `danger` (the outcome's own text label already tells them apart, FR-091). */
function auditOutcomeVariant(outcome: string): StatusVariant {
  if (outcome === 'SUCCESS') return 'success';
  if (outcome === 'DENIED' || outcome === 'FAILURE') return 'danger';
  return 'neutral';
}

/**
 * pt-BR label for every field key this action's audit trail can carry: the
 * four `UpdateActionRequest` fields, the lifecycle's own `status`/`reason`,
 * and the two origin fields that only ever appear on the CREATION event
 * (`create-action.usecase.ts`'s own `newValues`). A key missing here is a
 * cosmetic gap, never a hidden audit entry — `actionAuditFieldLabel` falls
 * back to the raw key.
 *
 * `originType`/`originId` were exactly that gap until the audit tab was
 * looked at in a browser (CLAUDE.md §18.1): every edit event read in
 * Portuguese while the creation event, the first entry of every trail,
 * showed two English identifiers. Nothing failed; it was simply wrong on
 * screen, which is the only place it was ever visible.
 */
const ACTION_AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  responsibleUserId: 'Responsável',
  dueOn: 'Prazo',
  status: 'Status',
  reason: 'Motivo',
  originType: 'Tipo de origem',
  originId: 'Origem',
};

function actionAuditFieldLabel(key: string): string {
  return ACTION_AUDIT_FIELD_LABELS[key] ?? key;
}

export const actions = {
  originTypeLabels: {
    RISK_TREATMENT: 'Tratamento de risco',
    FINDING: 'Achado',
    CONTROL_ASSESSMENT: 'Verificação de controle',
    // 008-incidents-problems — added alongside the two new domains'
    // `Action` origin registration (`ProblemActionOriginAccessor`/
    // `IncidentActionOriginAccessor`, both already live server-side).
    // `satisfies Record<ActionOriginType, string>` below is what makes
    // omitting either of these two a compile error, not a blank cell in
    // "Minhas ações".
    INCIDENT: 'Incidente',
    PROBLEM: 'Problema',
  } satisfies Record<ActionOriginType, string>,

  statusLabels: {
    OPEN: 'Aberta',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  } satisfies Record<ActionStatus, string>,

  /**
   * "Planos de Ação" screen (T056, US2, R-009 — the only new sidebar entry
   * 002-shared-grc-foundation added; reframed from "Minhas ações" once the
   * detail/edit/history surface below made it the platform's central Plano
   * de Ação surface rather than a personal work list). The `myActions`
   * key/object name is kept (CLAUDE.md §11.1 — technical identifiers stay
   * in English; only the displayed pt-BR text changes), as are every file
   * name and `id` this screen is built from (`my-actions-*`, `id:
   * 'my-actions'`).
   */
  myActions: {
    pageTitle: 'Planos de Ação',
    pageDescription:
      'Todas as ações de plano de ação do seu escopo de acesso, agregadas de qualquer origem — ' +
      'tratamento de risco, achado de auditoria, verificação de controle, incidente ou problema. ' +
      'Use "Somente minhas ações" para ver apenas o que está atribuído a você.',
    tableCaption: 'Lista de ações do plano de ação visíveis no seu escopo',

    columns: {
      code: 'Código',
      title: 'Título',
      origin: 'Origem',
      responsible: 'Responsável',
      dueOn: 'Prazo',
      status: 'Status',
      actions: 'Ações',
    },

    indicators: {
      overdue: 'Atrasada',
    },

    /**
     * Brought into the shared register family (CLAUDE.md §18.12) — the
     * collapsible `FilterBar` disposition `RiskRegisterFilters`/
     * `AuditEngagementRegisterFilters` already use. `GET /actions` accepts
     * exactly one value per filter field (`ListActionsQuery`), so the
     * controls stay single-value `Select`s (`MyActionsFilters`'s own
     * precedent, unlike the multi-select toolbars Risks/Controls offer) —
     * never a `MultiSelectFilter` that would silently keep only the first of
     * several checked boxes.
     */
    filters: {
      regionLabel: 'Filtros das ações',
      groupLabel: 'Filtros',
      onlyMine: 'Somente minhas ações',
      onlyOverdue: 'Somente atrasadas',
      statusLabel: 'Status',
      statusAll: 'Todos os status',
      originLabel: 'Origem',
      originAll: 'Todas as origens',
      clearFilters: 'Limpar filtros',
    },

    /**
     * `FilterBar`'s active-filters chip row (D-10), mirroring
     * `risks.register.activeFilters`'s own shape. `onlyMineOff` is this
     * screen's own kind of chip: unlike every other boolean filter in the
     * product, "somente minhas ações" starts TRUE (it is this screen's whole
     * reason to exist), so the chip appears when the caller has turned it
     * OFF — the divergence from default, not the presence of a value —
     * exactly mirroring how `riskLevelBasis` is treated as a display
     * decision rather than a filter in `use-register-state.ts`, applied here
     * to a checkbox instead of a toggle.
     */
    activeFilters: {
      regionLabel: 'Filtros ativos',
      valueChip: (field: string, value: string): string => `${field}: ${value}`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
      onlyMineOffLabel: 'Todas as ações (não somente as minhas)',
    },

    /**
     * Compact indicator row above the toolbar (CLAUDE.md §18.5, §19.7),
     * mirroring `risks.register.summary`'s own reasoning: every figure comes
     * from `GET /dashboard/summary`'s `breakdowns.actions` block — never a
     * second count computed on this screen — and is absent (no strip at all)
     * when the caller lacks `action:view` (the block itself is then absent
     * on the wire). Each figure is ORGANIZATION-SCOPED, not filtered by
     * "somente minhas ações" (this screen's own default), which is exactly
     * why every card's link sets `onlyMine=false` explicitly — so the number
     * shown and the list it opens into never disagree.
     */
    summary: {
      regionLabel: 'Situação geral das ações no seu escopo',
      open: {
        label: 'Abertas',
        hint: 'Ainda não iniciadas',
        linkLabel: 'Filtrar o registro por ações abertas',
      },
      inProgress: {
        label: 'Em andamento',
        hint: 'Trabalho já iniciado',
        linkLabel: 'Filtrar o registro por ações em andamento',
      },
      dueSoon: {
        label: 'Vencendo em breve',
        hint: (days: number): string => `Prazo nos próximos ${days} dias`,
        linkLabel: 'Ver todas as ações, sem filtro de origem ou status',
      },
      completed: {
        label: 'Concluídas',
        hint: 'Já finalizadas',
        linkLabel: 'Filtrar o registro por ações concluídas',
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
      cardsLabel: 'Ver as ações em cards',
      tableLabel: 'Ver as ações em tabela',
    },

    /** The results bar between the toolbar and the results — result count only; `GET /actions` has no `sort` parameter, so unlike every other register this bar offers no ordering control. */
    results: {
      count: (total: number): string =>
        total === 1 ? '1 ação' : `${total.toLocaleString('pt-BR')} ações`,
      countLoading: 'Carregando ações…',
    },

    /** The card itself (CLAUDE.md §18). Field captions are visible in the metadata row, so a card read on its own is never a set of unlabelled values. Whole-card stretched link to `/actions/{id}` — this register offers no quick view (mirrors `AuditEngagementCard`'s own precedent). */
    card: {
      regionLabel: 'Ações',
      originLabel: 'Origem',
      responsibleLabel: 'Responsável',
      dueOnLabel: 'Prazo',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      openLabel: (code: string, title: string): string => `Abrir a ação ${code}: ${title}`,
      rowActionsLabel: 'Ações',
    },

    empty: {
      noneYet: {
        title: 'Nenhuma ação atribuída a você',
        description:
          'Quando uma ação de remediação for atribuída a você — a partir de um tratamento de ' +
          'risco ou de outra origem — ela aparecerá aqui.',
      },
      noResults: {
        title: 'Nenhuma ação encontrada',
        description: 'Nenhuma ação corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },

    transitions: {
      confirmTitle: 'Confirmar transição',
      confirmDescription: (actionTitle: string, toLabel: string): string =>
        `A ação "${actionTitle}" será movida para o status "${toLabel}".`,
      reopenTitle: 'Reabrir ação',
      reopenDescription:
        'Reabrir uma ação concluída exige uma justificativa, registrada na trilha de auditoria.',
      reopenReasonLabel: 'Motivo da reabertura',
      reopenReasonPlaceholder: 'Descreva por que esta ação está sendo reaberta…',
      reopenReasonRequired: 'Informe o motivo da reabertura.',
      confirm: 'Confirmar',
      cancelDialog: 'Cancelar',
      transitionFailed: 'Não foi possível aplicar a transição.',
      transitionSuccess: (toLabel: string): string => `Ação movida para "${toLabel}".`,
      reopenSuccess: 'Ação reaberta.',
    },
  },

  /**
   * Action detail screen (`/actions/{id}`, `ActionDetailView`) — the
   * previously-missing surface this task adds: `getAction`/`updateAction`
   * had no caller anywhere in the frontend before this file's own commit
   * added one.
   */
  detail: {
    /** `EntityHeader`'s own breadcrumb (020-action-detail-experience, Fase
     * A) — mirrors `problems.detail.breadcrumbLabel`/`incidents.detail
     * .breadcrumbLabel`'s own convention: an independent catalog entry, not
     * a reuse of `myActions.pageTitle`, even though the text is identical
     * today — each module keeps its own detail-screen strings self
     * contained. */
    breadcrumbLabel: 'Planos de Ação',
    loading: 'Carregando ação…',
    notFoundTitle: 'Ação não encontrada',
    notFoundDescription:
      'Esta ação não existe ou está fora do seu escopo de acesso. Se você acredita que deveria ' +
      'vê-la, procure um administrador.',
    errorLoad: 'Não foi possível carregar a ação.',
    forbidden: {
      title: 'Sem permissão para ver esta ação',
      detail:
        'Você não tem a permissão necessária para ver ações. Se isso não for esperado, procure ' +
        'um administrador.',
    },
    editAction: 'Editar',

    metadata: {
      orgUnit: (name: string): string => `Unidade organizacional: ${name}`,
      responsible: (name: string): string => `Responsável: ${name}`,
      dueOn: (date: string): string => `Prazo: ${date}`,
    },

    sections: {
      overview: 'Visão geral',
      audit: 'Auditoria',
    },

    /**
     * The action's conditional lifecycle outcome facts — rendered inside
     * `ActionLifecycleSection`'s "Ciclo de vida" card
     * (020-action-detail-experience, Fase B), not inside `ActionOverview`
     * any more: each describes an OUTCOME OF THE LIFECYCLE (completing,
     * reopening), not a fact about the record's identity. Mirrors
     * `problems.detail.lifecycleOutcomes`'s own shape — `Action` has only
     * these two conditional facts (no resolution summary, no cancellation
     * reason field on this entity). Renders only when the underlying value
     * is actually present.
     */
    lifecycleOutcomes: {
      completedAtLabel: 'Concluída em',
      reopenedAtLabel: 'Reaberta em',
    },

    /**
     * The "Ciclo de vida" track visual (`ActionLifecycleTrackView`) —
     * labels for the three main-track `ActionStatus` positions come from
     * `actionStatusLabel`/`statusLabels` above, the exact same word the
     * header's own `StatusBadge` uses. `stateLabels` mirrors
     * `problems.detail.lifecycleTrack.stateLabels`'s own vocabulary exactly
     * (CLAUDE.md §18.12 — same concept, same word on every module's track).
     */
    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida da ação',
      cancelledAriaLabel: 'Ação cancelada',
      /**
       * Short context line under the `CANCELLED` node — this payload does
       * not record which of the two possible origins (`OPEN`/`IN_PROGRESS`)
       * the cancellation came from, so the node is presented as a terminal
       * of the WHOLE trajectory, never visually tied to a specific column
       * (mirrors `problems.detail.lifecycleTrack.cancelledContextLabel`'s
       * own reasoning).
       */
      cancelledContextLabel: 'Encerrada por cancelamento',
      stateLabels: {
        current: 'Atual',
        completed: 'Concluído',
        available: 'Disponível',
        unavailable: 'Indisponível',
      },
    },

    /** `ActionEditForm` (title/description/responsible/dueOn — the exact four `UpdateActionRequest` fields, nothing else). */
    form: {
      /** `ActionEditPanel`'s own overlay header (020-action-detail-experience, Fase C), mirroring `problems.form.editHeading`/`incidents.form.editDescription`'s exact wording pattern. */
      editHeading: 'Editar ação',
      editDescription: 'Altere os dados cadastrais da ação.',
      titleLabel: 'Título',
      descriptionLabel: 'Descrição',
      responsibleLabel: 'Responsável',
      responsiblePlaceholder: 'Selecione um responsável',
      dueOnLabel: 'Prazo',
      validation: {
        titleRequired: 'Informe o título.',
        responsibleRequired: 'Selecione um responsável.',
        dueOnRequired: 'Informe o prazo.',
      },
      submit: 'Salvar alterações',
      submitting: 'Salvando…',
      cancel: 'Cancelar',
      updateSuccess: 'Ação atualizada.',
      updateError: 'Não foi possível salvar as alterações.',
    },

    /**
     * Audit section (`ActionAuditSection`) — mirrors `risks.ts`'s own
     * `audit` block (`RiskAuditSection`'s doc comment has the full
     * reasoning for the shape and the `forbidden` case). No reference-data
     * value resolver here (unlike risk's category/type/origin lookups):
     * every field this action's own allow-list can carry (`title`,
     * `description`, `dueOn`, `status`) is either plain text or a date
     * string already readable as-is; `responsibleUserId` renders as the
     * raw id until a future iteration adds a resolver, the same honest
     * fallback `AuditTimeline` gives any id it has no name for.
     */
    audit: {
      cardTitle: 'Trilha de auditoria',
      cardDescription:
        'Registro completo e imutável de eventos desta ação — quem, quando, o quê e o resultado ' +
        'de cada ação. Nenhum evento pode ser alterado ou excluído.',
      caption: 'Trilha de auditoria',
      loading: 'Carregando trilha de auditoria…',
      loadError: 'Não foi possível carregar a trilha de auditoria.',
      empty: 'Nenhum evento de auditoria registrado ainda.',
      occurredAtLabel: 'Ocorrido em',
      actorLabel: 'Ator',
      entityLabel: 'Entidade',
      notRecordedLabel: 'Não registrado',
      changedFieldsLabel: 'Campos alterados',
      ipAddressLabel: 'Endereço IP',
      userAgentLabel: 'Navegador/dispositivo',
      correlationIdLabel: 'ID de correlação',
      loadMoreLabel: 'Carregar mais',
      loadingMoreLabel: 'Carregando mais…',
      outcomeLabel: (outcome: string): string =>
        AUDIT_OUTCOME_LABELS[outcome as AuditOutcome] ?? outcome,
      outcomeVariant: auditOutcomeVariant,
      fieldLabel: actionAuditFieldLabel,
      forbidden: {
        title: 'Sem permissão para ver a trilha de auditoria',
        detail:
          'Você pode ver esta ação, mas não tem a permissão necessária para ver sua trilha de ' +
          'auditoria. Se isso não for esperado, procure um administrador.',
      },
    },
  },

  /**
   * The overview section's cards — "Descrição", "Origem" and "Detalhes da
   * ação" (020-action-detail-experience, Fase B), mirroring
   * `problems.overview`'s own shape. The record's lifecycle outcome facts
   * are NOT here — see `detail.lifecycleOutcomes` above.
   */
  overview: {
    descriptionCardTitle: 'Descrição',
    descriptionEmpty: 'Nenhuma descrição registrada.',
    originCardTitle: 'Origem',
    detailsCardTitle: 'Detalhes da ação',
    fields: {
      orgUnit: 'Unidade organizacional',
      responsible: 'Responsável',
      dueOn: 'Prazo',
      createdAt: 'Criada em',
      updatedAt: 'Atualizada em',
    },
    notSet: 'Não definido',
  },

  /**
   * Legal moves per `ACTION_TRANSITIONS` (`status.ts`): `OPEN->IN_PROGRESS`,
   * `OPEN->CANCELLED`, `IN_PROGRESS->COMPLETED`, `IN_PROGRESS->CANCELLED`,
   * `COMPLETED->OPEN` (reopen, Invariant A2 — requires a reason).
   */
  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Trajetória e transições disponíveis para esta ação.',
  },

  /** UI-only mirror of the server's transition-legality table
   * (`status.ts`'s own header explains why this exists and why it is never
   * authoritative). */
  transitions: {
    start: 'Iniciar',
    complete: 'Concluir',
    cancel: 'Cancelar',
    reopen: 'Reabrir',
  },
} as const;
