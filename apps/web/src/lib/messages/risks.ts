/**
 * PharosGRC — Gestão de Riscos (pt-BR).
 *
 * First business-module message area (CLAUDE.md §9, §11.1). Field labels
 * mirror `specs/001-grc-platform-foundation/data-model.md` §8 and the
 * request/response schemas in `contracts/risks.openapi.yaml` — every label
 * here names a real `Risk`/`RiskStatement` field, never an invented one.
 *
 * `statusLabels` and the section titles under `detail.sections` are shared
 * vocabulary: any future screen that shows a risk's lifecycle status or its
 * detail sections (the register, the dashboard, a future audit view) should
 * import from here rather than re-declaring the same eight words.
 *
 * ## F-1 — enum-mirroring maps are typed against the union, not `string`
 *
 * `RISK_LEVEL_LABELS` and `statusLabels` below are typed `Record<RiskLevel,
 * string>` / `Record<RiskStatus, string>` — the app's own union types, not
 * `@prisma/client`'s (this file has no business depending on the ORM). A
 * `Record<string, string>` mirroring a closed union defeats the one
 * mechanism this catalog exists to provide: with the union type, adding a
 * value to `RiskStatus`/`RiskLevel` without adding its translation here is a
 * **compile error**, not a raw enum identifier silently shown to a Brazilian
 * user at runtime (`docs/deferred-findings.md` F-1). The `?? level` /
 * `?? status` fallbacks that used to paper over a missing key are removed
 * for the same reason — with an exhaustive `Record`, indexing by a valid
 * union member can never miss, so the fallback was defending against
 * exactly the failure mode F-1 says must not compile.
 */

import type {
  AuditOutcome,
  IncidentStatusRef,
  OrgUnitNode,
  ProblemStatusRef,
  ReferenceDataItem,
  RiskHistoryEntryType,
  RiskLevel,
  RiskStatus,
  TreatmentStrategy,
  UserRef,
} from '@/features/risks/types';
import type { StatusVariant } from '@pharos/design-system/components';

import { formatDateOnly } from '@/features/risks/date';

/**
 * Mirrors `enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }` (data-model.md
 * §8). Declared once here, outside the `risks` object literal, so both
 * `riskLevelLabels` (the register's filter checkboxes, which list the
 * levels as plain text) and `riskLevelBadge.levelName` (D-10 — the labels
 * prop consumed by `RiskLevelBadge`) resolve the same four words instead of
 * each carrying its own copy (CLAUDE.md §13.8).
 */
const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
};

/**
 * Mirrors `enum RiskStatus` (data-model.md §8, FR-079). Declared here,
 * outside the `risks` object literal, for the same reason `RISK_LEVEL_
 * LABELS` is: `AuditTimeline`'s value resolver (`buildAuditValueResolver`
 * below) needs the exact same status word the register/lifecycle screens
 * use, without a self-reference into the not-yet-finished `risks` object.
 */
const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  DRAFT: 'Rascunho',
  IDENTIFIED: 'Identificado',
  ASSESSED: 'Avaliado',
  UNDER_TREATMENT: 'Em tratamento',
  UNDER_REVIEW: 'Em revisão',
  ACCEPTED: 'Aceito',
  CLOSED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

/** Shared by `riskLevelBadge.levelName` and the `RiskMatrix`/`RiskScore` labels props below, so every consumer of a `RiskLevel` resolves the exact same word (CLAUDE.md §13.8). */
function levelName(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

/**
 * Mirrors `enum TreatmentStrategy { MITIGATE, ACCEPT, TRANSFER, AVOID }`
 * (data-model.md §10, FR-071). Typed `Record<TreatmentStrategy, string>` —
 * not `string` — for the same F-1 reason `RISK_LEVEL_LABELS` is: adding a
 * strategy without adding its translation here must fail to compile, not
 * show a raw enum identifier to a Brazilian user at runtime.
 */
const TREATMENT_STRATEGY_LABELS: Record<TreatmentStrategy, string> = {
  MITIGATE: 'Mitigar',
  ACCEPT: 'Aceitar',
  TRANSFER: 'Transferir',
  AVOID: 'Evitar',
};

/**
 * Mirrors `RiskHistoryEntryType` (risks.openapi.yaml, FR-105). `RiskLevel`/
 * `TreatmentActionStatus`-style exhaustive `Record` (F-1): adding an entry
 * type the backend starts emitting without adding its translation here is a
 * compile error, never a raw identifier shown to a Brazilian reviewer.
 * `RiskHistorySection` uses this both as each entry's `kindLabel` and as
 * the `type` filter's option labels (T170's own decision to expose the
 * filter — see that component's doc comment).
 */
const RISK_HISTORY_ENTRY_TYPE_LABELS: Record<RiskHistoryEntryType, string> = {
  ASSESSMENT: 'Avaliação',
  LEVEL_CHANGE: 'Variação de nível',
  OWNERSHIP_CHANGE: 'Alteração de responsável',
  TREATMENT_DECISION: 'Decisão de tratamento',
  TREATMENT_ACTION: 'Ação de tratamento',
  CONTROL_LINK: 'Vínculo de controle',
  LIFECYCLE_TRANSITION: 'Transição de status',
  APPROVAL: 'Aprovação',
  FIELD_CHANGE: 'Alteração de campo',
};

/** Mirrors `AuditEvent.outcome` (risks.openapi.yaml, FR-037). Same F-1 exhaustiveness reasoning as `RISK_HISTORY_ENTRY_TYPE_LABELS`. */
const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = {
  SUCCESS: 'Sucesso',
  FAILURE: 'Falha',
  DENIED: 'Negado',
};

/** `AuditTimelineLabels.outcomeVariant` (`@pharos/design-system`, D-10) — the only place this catalog decides which `StatusBadge` colour an outcome deserves; `AuditTimeline` itself has no opinion (see that component's own doc comment). `DENIED`/`FAILURE` share `danger`: both are refusals-or-worse from a reviewer's perspective, and the outcome's own text label (never colour alone, FR-091) already tells them apart. */
function auditOutcomeVariant(outcome: string): StatusVariant {
  if (outcome === 'SUCCESS') return 'success';
  if (outcome === 'DENIED' || outcome === 'FAILURE') return 'danger';
  return 'neutral';
}

/** Mirrors `AuditEvent.outcome`'s `decision`-shaped sibling, `Approval.decision` (`RISK_TREATMENT_ACTION`/`APPROVAL` audit rows, `risk-audit-allowlist.ts`). Not `AUDIT_OUTCOME_LABELS` — a decision is "Aprovado"/"Rejeitado", never "Sucesso"/"Negado". */
const AUDIT_DECISION_LABELS: Record<'APPROVED' | 'REJECTED', string> = {
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

/**
 * pt-BR label for every field key this platform's audit allow-lists
 * currently register for a risk and its child records
 * (`apps/api/src/modules/risk/domain/risk-audit-allowlist.ts`, FR-035) — the
 * `AuditTimelineLabels.fieldLabel` this catalog hands to `AuditTimeline`
 * (D-10: the design system has no opinion on what "categoryId" means).
 *
 * A key registered on the API side but missing here (a field a future
 * allow-list adds, before this map is updated to match) is NOT an error:
 * `auditFieldLabel` below falls back to the raw key itself, and the row
 * still renders — a missing translation is a cosmetic gap; a hidden audit
 * entry would be a compliance one (this file's own task brief).
 */
const AUDIT_FIELD_LABELS: Record<string, string> = {
  // Risk itself (T089/T090) — the fields the product owner's bug report
  // named directly.
  title: 'Título',
  description: 'Descrição',
  categoryId: 'Categoria',
  typeId: 'Tipo',
  originId: 'Origem',
  orgUnitId: 'Unidade organizacional',
  ownerUserId: 'Gestor do risco',
  responsibleUserId: 'Responsável',
  identifiedOn: 'Data de identificação',
  nextReviewOn: 'Próxima revisão',
  // Causes/consequences (T093) — registered under the same `RISK` allow-list
  // as the fields above, one ordered array of descriptions per field (see
  // `risk-audit-allowlist.ts`'s own comment on that shape). Same pt-BR words
  // `causesConsequences.causesTitle`/`consequencesTitle` already use
  // elsewhere on this page, so the audit tab and the form section agree.
  causes: 'Causas',
  consequences: 'Consequências',
  // Assessment (T124/US4).
  riskId: 'Risco',
  methodologyVersionId: 'Versão da metodologia',
  assessedOn: 'Data da avaliação',
  inherentProbability: 'Probabilidade inerente',
  inherentImpact: 'Impacto inerente',
  inherentScore: 'Pontuação inerente',
  inherentLevel: 'Nível inerente',
  residualProbability: 'Probabilidade residual',
  residualImpact: 'Impacto residual',
  residualScore: 'Pontuação residual',
  residualLevel: 'Nível residual',
  controlsConsidered: 'Controles considerados',
  previousAssessmentId: 'Avaliação anterior',
  // Methodology version (T126/US4).
  methodologyId: 'Metodologia',
  versionNumber: 'Número da versão',
  effectiveFrom: 'Vigente a partir de',
  // Treatment decision (T139/US5).
  strategy: 'Estratégia',
  deadline: 'Prazo',
  previousTreatmentDecisionId: 'Decisão de tratamento anterior',
  // Treatment action (T140/US5).
  treatmentDecisionId: 'Decisão de tratamento',
  dueOn: 'Prazo',
  status: 'Situação',
  // Control/process/asset links (T142/US5).
  controlId: 'Controle',
  processId: 'Processo',
  assetId: 'Ativo',
  unlinkedAt: 'Desvinculado em',
  // Lifecycle transition (T156/US6).
  fromStatus: 'Status anterior',
  toStatus: 'Novo status',
  justification: 'Justificativa',
  approvalId: 'Aprovação',
  // Approval request/decision (T157/US6).
  requestedTransition: 'Transição solicitada',
  decision: 'Decisão',
};

/** `AuditTimelineLabels.fieldLabel` (`@pharos/design-system`, D-10). Falls back to the raw key — see `AUDIT_FIELD_LABELS`'s own doc comment for why that is the correct degradation, not an error. */
function auditFieldLabel(key: string): string {
  return AUDIT_FIELD_LABELS[key] ?? key;
}

/** Reference data already loaded elsewhere in the app (`RiskForm`'s own `ReferenceData`, `risksApi.listCategories`/`listTypes`/`listOrigins`/`listOrgUnits`/`listUsers`) — the exact id-to-name lookups `buildAuditValueResolver` needs. Supplied by `RiskAuditSection`, never fetched by this catalog itself (a messages file has no business making HTTP calls). */
export interface AuditReferenceData {
  categories: readonly ReferenceDataItem[];
  types: readonly ReferenceDataItem[];
  origins: readonly ReferenceDataItem[];
  orgUnits: readonly OrgUnitNode[];
  users: readonly UserRef[];
}

const AUDIT_DATE_ONLY_FIELDS = new Set([
  'identifiedOn',
  'nextReviewOn',
  'assessedOn',
  'dueOn',
  'deadline',
  'effectiveFrom',
]);

/** Timestamp (not date-only) allow-listed fields — formatted like `RiskAuditSection`'s own `occurredAtLabel`, never with `formatDateOnly` (which would misread a full instant as a date-only string, F-9's own off-by-one class of bug). */
const AUDIT_TIMESTAMP_FIELDS = new Set(['unlinkedAt']);

function buildIdNameMap(items: readonly { id: string; name: string }[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

/**
 * Builds `AuditTimelineLabels.resolveFieldValue` for the risk audit trail
 * (T171, FR-033 to FR-037, the product owner's UAT finding this task fixes).
 *
 * Resolution rules, applied in order:
 *   - `identifiedOn`/`nextReviewOn`/`assessedOn`/`dueOn`/`deadline`/
 *     `effectiveFrom` (date-only) and `unlinkedAt` (a timestamp) are
 *     formatted with this project's own locale-safe helpers, never a raw
 *     ISO string.
 *   - An allow-listed field whose value is an ARRAY — `controlsConsidered`,
 *     `causes`, `consequences` — never a boolean, whatever an earlier
 *     version of this comment claimed: confirmed directly against real
 *     `audit_event` rows (`jsonb_typeof(new_values -> key)`), every one of
 *     the three is `array`. `controlsConsidered` holds control ids;
 *     `causes`/`consequences` hold the risk's own free-text sentences. An
 *     empty array reads as `risks.audit.emptyCollectionLabel` ("Nenhum" —
 *     nothing is lost, the array genuinely holds nothing); a non-empty
 *     array joins its elements with "; ", each one re-run through this same
 *     per-key resolution so a `controlsConsidered` id gets whatever name
 *     lookup any other id field would get. Handled before the `typeof
 *     value !== 'string'` guard below, otherwise `AuditTimeline`'s own
 *     generic formatting — `JSON.stringify` — is what a reader sees, which
 *     is the raw `[]` the product owner's UAT finding reported.
 *   - `categoryId`/`typeId`/`originId`/`orgUnitId`/`ownerUserId`/
 *     `responsibleUserId` resolve to the SAME name the register/form/
 *     overview screens already show for that id — never a second,
 *     independently worded name for the same record. An id that IS one of
 *     these reference fields but is not found in the loaded reference data
 *     (a deleted category, a user outside the caller's current scope)
 *     resolves to `risks.audit.unresolvedReference(id)` rather than a blank
 *     cell or an unexplained raw UUID — the id itself stays visible (an
 *     audit trail never hides what it has), but the reader is told plainly
 *     that this platform could not name it.
 *   - `status`/`fromStatus`/`toStatus`, `strategy`, `inherentLevel`/
 *     `residualLevel` and `decision` resolve to the exact same pt-BR word
 *     this catalog already uses everywhere else that enum appears
 *     (`RISK_STATUS_LABELS`/`TREATMENT_STRATEGY_LABELS`/
 *     `RISK_LEVEL_LABELS`/`AUDIT_DECISION_LABELS`), so the audit tab and the
 *     rest of the interface never disagree about what "Alto" is called.
 *
 * Every other allow-listed field — free text (`title`, `description`,
 * `justification`, …), raw scoring numbers, and ids this catalog has no
 * reusable name lookup for (`riskId`, `controlId`, `processId`, `assetId`,
 * `approvalId`, `treatmentDecisionId`, `previousAssessmentId`,
 * `previousTreatmentDecisionId`, `methodologyId`, `methodologyVersionId`,
 * `requestedTransition`) — returns `undefined`, which per
 * `AuditTimelineLabels.resolveFieldValue`'s own contract falls back to
 * `AuditTimeline`'s generic formatting. Resolving those ids to a name would
 * need either a get-by-id endpoint this app's `risksApi` has no wrapper
 * for, or fetching an unbounded registry client-side merely to label an
 * audit row — out of scope for this presentation fix (reported, not
 * silently worked around).
 */
export function buildAuditValueResolver(
  referenceData: AuditReferenceData,
): (key: string, value: unknown) => string | undefined {
  const categoryNames = buildIdNameMap(referenceData.categories);
  const typeNames = buildIdNameMap(referenceData.types);
  const originNames = buildIdNameMap(referenceData.origins);
  const orgUnitNames = buildIdNameMap(referenceData.orgUnits);
  const userNames = new Map(referenceData.users.map((user) => [user.id, user.fullName]));

  function resolveReferenceId(map: Map<string, string>, id: string): string {
    return map.get(id) ?? risks.audit.unresolvedReference(id);
  }

  /** The `categoryId`/`status`/`strategy`/… switch, factored out so an array element (an item of `controlsConsidered`/`causes`/`consequences`) can go through the exact same per-key resolution a top-level string value would. Returns `undefined` on no match, same contract as the resolver itself. */
  function resolveScalarValue(key: string, value: string): string | undefined {
    switch (key) {
      case 'categoryId':
        return resolveReferenceId(categoryNames, value);
      case 'typeId':
        return resolveReferenceId(typeNames, value);
      case 'originId':
        return resolveReferenceId(originNames, value);
      case 'orgUnitId':
        return resolveReferenceId(orgUnitNames, value);
      case 'ownerUserId':
      case 'responsibleUserId':
        return resolveReferenceId(userNames, value);
      case 'status':
      case 'fromStatus':
      case 'toStatus':
        return RISK_STATUS_LABELS[value as RiskStatus] ?? value;
      case 'strategy':
        return TREATMENT_STRATEGY_LABELS[value as TreatmentStrategy] ?? value;
      case 'inherentLevel':
      case 'residualLevel':
        return RISK_LEVEL_LABELS[value as RiskLevel] ?? value;
      case 'decision':
        return AUDIT_DECISION_LABELS[value as 'APPROVED' | 'REJECTED'] ?? value;
      default:
        return undefined;
    }
  }

  /** An array element that isn't even a string (malformed payload, not a shape any current allow-listed array field produces) — never `String(item)`, which for a plain object prints the unreadable `[object Object]`. Mirrors `AuditTimeline`'s own `formatFieldValue` fallback. */
  function safeStringifyArrayItem(item: unknown): string {
    try {
      return JSON.stringify(item);
    } catch {
      return Object.prototype.toString.call(item);
    }
  }

  return (key: string, value: unknown): string | undefined => {
    if (typeof value === 'string' && AUDIT_DATE_ONLY_FIELDS.has(key)) {
      // The audit payload captures the entity's raw field value at write
      // time — for a Prisma `@db.Date` column that is a full UTC-midnight
      // ISO instant (e.g. `"2026-09-30T00:00:00.000Z"`), NOT the date-only
      // `"YYYY-MM-DD"` string the REST DTO mapper narrows it to elsewhere
      // (confirmed against a real `risk.updated` row while verifying this
      // fix, not assumed). `formatDateOnly` requires the latter shape — its
      // own `split('-')` would otherwise split the trailing
      // `"30T00:00:00.000Z"` chunk apart and produce `NaN`/"Invalid Date".
      // Slicing to the first 10 characters normalizes either shape to
      // `"YYYY-MM-DD"` before handing it to `formatDateOnly`, which then
      // parses it as a LOCAL calendar date — never `new Date(value)`
      // directly on the full ISO string, which in any timezone behind UTC
      // would render the day before (`date.ts`'s own documented off-by-one,
      // reproduced here for an audit value if skipped).
      return formatDateOnly(value.slice(0, 10));
    }
    if (typeof value === 'string' && AUDIT_TIMESTAMP_FIELDS.has(key)) {
      return new Date(value).toLocaleString('pt-BR');
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return risks.audit.emptyCollectionLabel;
      }
      return value
        .map((item) =>
          typeof item === 'string'
            ? (resolveScalarValue(key, item) ?? item)
            : safeStringifyArrayItem(item),
        )
        .join('; ');
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    return resolveScalarValue(key, value);
  };
}

/** Shared by `basisName` and the `RiskMatrix`/`RiskScore` labels props below — one place naming "Inerente"/"Residual" (ADR-006: a level or score is never shown without naming its basis). */
function basisNameFor(basis: 'inherent' | 'residual'): string {
  return basis === 'inherent' ? 'Inerente' : 'Residual';
}

/**
 * The single word naming an open approval condition on a risk (FR-029c).
 * Shared by `register.indicators.pendingApproval` (the register's status
 * column) and `lifecycle.pendingApprovalBadge.label` (`PendingApprovalBadge`,
 * T162) — both render the SAME literal `PendingApprovalBadge` component, and
 * both must therefore say the exact same word, not two independently
 * maintained copies (CLAUDE.md §13.8).
 */
const PENDING_APPROVAL_LABEL = 'Aguardando aprovação';

/** `RiskLevelBadge`'s labels prop (D-10). Declared standalone so `riskScoreLabels` below can embed it (a `RiskScoreLabels.riskLevelBadge` is forwarded straight through) without a self-reference into the not-yet-finished `risks` object literal. */
const riskLevelBadgeLabels = {
  levelName,
  basisPrefixedLevel: (basis: 'inherent' | 'residual', levelLabel: string): string =>
    `${basisNameFor(basis)}: ${levelLabel}`,
  accessibleLabel: (label: string): string => `Nível de risco: ${label}`,
};

/**
 * `RiskScore`'s labels prop (`@pharos/design-system`, D-10) — every call
 * site that renders a `RiskScore` passes this same object rather than each
 * re-declaring the score/level caption wording (T130's Assessment section,
 * `apps/web/src/components/design-system.test.tsx`'s own mount test).
 */
const riskScoreLabels = {
  basisName: basisNameFor,
  levelName,
  scoreCaption: ({
    basisLabel,
    score,
    levelLabel,
  }: {
    basisLabel: string;
    score: number;
    levelLabel: string;
  }): string => `Pontuação ${basisLabel.toLowerCase()}: ${score} (${levelLabel})`,
  notAssessedCaption: (basisLabel: string): string =>
    `Risco ${basisLabel.toLowerCase()} ainda não avaliado.`,
  riskLevelBadge: riskLevelBadgeLabels,
};

/**
 * `RiskMatrix`'s labels prop (`@pharos/design-system`, D-10), parameterized
 * only by `caption` — every other word (axis names, the corner header, the
 * per-cell accessible-name template, the "I"/"R" basis markers) is shared
 * vocabulary across every screen that renders a matrix (the assessment
 * form's single shared grid, T130's Assessment section). Building it once
 * here means those screens can never drift into two different phrasings of
 * the same sentence template.
 */
function buildRiskMatrixLabels(caption: string) {
  return {
    probabilityAxisLabel: 'Probabilidade',
    impactAxisLabel: 'Impacto',
    cornerCellLabel: 'Probabilidade \\ Impacto',
    levelName,
    basisName: basisNameFor,
    basisAbbreviation: (basis: 'inherent' | 'residual'): string =>
      basis === 'inherent' ? 'I' : 'R',
    cellAccessibleLabel: ({
      probabilityLabel,
      impactLabel,
      score,
      levelLabel,
    }: {
      probabilityLabel: string;
      impactLabel: string;
      score: number;
      levelLabel: string;
    }): string =>
      `Probabilidade ${probabilityLabel}, Impacto ${impactLabel}: pontuação ${score}, nível ${levelLabel}`,
    caption,
  };
}

export const risks = {
  /** See `RISK_STATUS_LABELS` above. */
  statusLabels: RISK_STATUS_LABELS,

  /** See `RISK_LEVEL_LABELS` above. */
  riskLevelLabels: RISK_LEVEL_LABELS,

  /**
   * `RiskLevelBadge`'s labels prop (`@pharos/design-system`, D-10) — every
   * call site in `apps/web` passes this same object rather than each
   * re-declaring the level names, the "Inerente"/"Residual" prefix or the
   * aria-label template.
   */
  riskLevelBadge: riskLevelBadgeLabels,

  /** Full basis name — shared by `RiskMatrixLabels.basisName` and `RiskScoreLabels.basisName` (both design-system labels props, D-10) so every screen names "Inerente"/"Residual" the same way. */
  basisName: basisNameFor,

  /** See `riskScoreLabels` above. */
  riskScoreLabels,

  /** See `buildRiskMatrixLabels` above — call with the caption naming this particular matrix's purpose. */
  riskMatrixLabels: buildRiskMatrixLabels,

  form: {
    createTitle: 'Novo risco',
    createDescription: 'Registre um novo risco. É possível salvar incompleto e concluir depois.',
    editTitle: 'Editar risco',
    editDescription: 'Altere os dados cadastrais do risco.',

    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que é este risco e como ele é classificado.',
      },
      ownership: {
        title: 'Responsabilidade e organização',
        description: 'Quem responde por este risco e em qual unidade organizacional.',
      },
      dates: {
        title: 'Datas',
        description: 'Quando o risco foi identificado e quando revisar novamente.',
      },
    },

    fields: {
      title: { label: 'Título' },
      description: { label: 'Descrição' },
      category: { label: 'Categoria', placeholder: 'Selecione uma categoria' },
      type: { label: 'Tipo', placeholder: 'Selecione um tipo' },
      origin: { label: 'Origem', placeholder: 'Selecione uma origem' },
      orgUnit: { label: 'Unidade organizacional', placeholder: 'Selecione uma unidade' },
      /**
       * The picker's list of selectable people is the ASSIGNMENT listing for
       * whichever organizational unit is currently selected in THIS form
       * (`risksApi.listUsers(orgUnitId)`), never the caller's own browse
       * scope — see that call's own doc comment for why the two differ. The
       * extra keys below cover every state that listing can be in, so this
       * required field is never silently empty and never enabled with
       * nothing meaningful to select (CLAUDE.md §18.11):
       *   - `selectOrgUnitFirst` — no organizational unit chosen yet in this
       *     form; the picker is disabled and says why, rather than showing
       *     an unexplained empty list.
       *   - `loading` — a fetch for the currently selected unit is in
       *     flight (initial load or a refetch after the unit changed).
       *   - `empty` — the fetch succeeded and genuinely found nobody
       *     assignable to that unit; a real, distinct outcome from a broken
       *     request, never conflated with `loadError`.
       *   - `loadError` — the fetch failed; paired in `RiskForm` with an
       *     explicit retry action, never a silent fallback to an empty list.
       *   - `clearedNotice` — shown once, visibly, exactly when `RiskForm`
       *     had to clear an already-selected owner because the newly
       *     selected unit's assignment set no longer includes that person —
       *     never a silent value change the user has to notice on their own.
       */
      owner: {
        label: 'Gestor do risco',
        placeholder: 'Selecione o gestor do risco',
        description: 'Responsável final por este risco perante a organização.',
        selectOrgUnitFirst:
          'Selecione a unidade organizacional para ver os gestores disponíveis para essa unidade.',
        loading: 'Carregando gestores disponíveis para esta unidade…',
        empty: 'Nenhum usuário disponível para ser gestor nesta unidade organizacional.',
        loadError: 'Não foi possível carregar os gestores disponíveis para esta unidade.',
        clearedNotice:
          'O gestor selecionado não está mais disponível para a unidade organizacional escolhida e foi removido. Selecione outro gestor.',
      },
      /** Same assignment-listing states as `owner` above, worded for this field. */
      responsible: {
        label: 'Responsável',
        // "(opcional)" is no longer baked into the placeholder — `RiskForm`
        // now renders it once, consistently, via `FormField`'s
        // `optionalIndicator` (common.formField.optionalIndicator), next to
        // every optional field's own label rather than inside this one
        // field's placeholder text.
        placeholder: 'Selecione o responsável',
        description: 'Responsável pelo dia a dia do risco, quando diferente do gestor.',
        selectOrgUnitFirst:
          'Selecione a unidade organizacional para ver os responsáveis disponíveis para essa unidade.',
        loading: 'Carregando responsáveis disponíveis para esta unidade…',
        empty: 'Nenhum usuário disponível para ser responsável nesta unidade organizacional.',
        loadError: 'Não foi possível carregar os responsáveis disponíveis para esta unidade.',
        clearedNotice:
          'O responsável selecionado não está mais disponível para a unidade organizacional escolhida e foi removido.',
        /** S-10 — the picker is now a `UserPicker` (server-side search), which has no built-in "none" row; this is the field's own explicit clear affordance, since responsible is optional. */
        clearAction: 'Remover responsável',
      },
      identifiedOn: { label: 'Data de identificação' },
      nextReviewOn: { label: 'Próxima revisão' },
    },

    unsavedNote:
      'Categoria, tipo, origem e responsável podem ser preenchidos depois — apenas título, descrição, unidade organizacional e gestor são exigidos para salvar como rascunho.',

    actions: {
      save: 'Salvar',
      saving: 'Salvando…',
      saveAndCreate: 'Criar risco',
      creating: 'Criando…',
    },

    loadingReferenceData: 'Carregando listas de apoio…',
    referenceDataError:
      'Não foi possível carregar as listas de categoria, tipo, unidade ou usuários.',

    createSuccess: 'Risco criado como rascunho.',
    updateSuccess: 'Alterações salvas.',
    genericError: 'Não foi possível salvar o risco. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',

    /**
     * FR-103 / ADR-013 — optimistic-locking conflict UX. The user's own
     * entered values are never discarded: see `risk-form.tsx`'s handling of
     * this state for the full explanation.
     */
    conflict: {
      title: 'Este risco foi alterado por outra pessoa',
      description:
        'Alguém salvou uma alteração neste risco enquanto você editava. Suas alterações abaixo NÃO foram perdidas e continuam preenchidas neste formulário, mas ainda não foram salvas — para não sobrescrever o que a outra pessoa fez, revise o que mudou antes de tentar salvar novamente.',
      modifiedBy: (name: string): string => `Alterado por: ${name}`,
      modifiedAt: (when: string): string => `Alterado em: ${when}`,
      reloadAction: 'Ver versão atual em nova aba',
      retryAction: 'Salvar mesmo assim com meus dados',
      dismissAction: 'Continuar editando',
    },
  },

  causesConsequences: {
    causesTitle: 'Causas',
    causesDescription: 'O que pode dar origem a este risco. Cada causa é um registro individual.',
    consequencesTitle: 'Consequências',
    consequencesDescription:
      'O que pode acontecer caso este risco se concretize. Cada consequência é um registro individual.',
    rowLabel: (kind: 'cause' | 'consequence', index: number): string =>
      kind === 'cause' ? `Causa ${index + 1}` : `Consequência ${index + 1}`,
    addCause: 'Adicionar causa',
    addConsequence: 'Adicionar consequência',
    removeCause: (index: number): string => `Remover causa ${index + 1}`,
    removeConsequence: (index: number): string => `Remover consequência ${index + 1}`,
    emptyCauses: 'Nenhuma causa registrada ainda.',
    emptyConsequences: 'Nenhuma consequência registrada ainda.',
    save: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Salvar causas' : 'Salvar consequências',
    saving: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Salvando causas…' : 'Salvando consequências…',
    saveSuccess: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Causas atualizadas.' : 'Consequências atualizadas.',
    saveError: 'Não foi possível salvar. Tente novamente.',
    rowRequired: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause'
        ? 'Descreva esta causa ou remova a linha.'
        : 'Descreva esta consequência ou remova a linha.',
    conflictError:
      'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de salvar.',

    /**
     * Read/edit-cycle chrome (Área 4, 2026-09-17) — a persisted item renders
     * as read-only content; "Editar"/confirm return it to that state. Only
     * ONE item (in EITHER list) is ever in edit/creation mode at a time —
     * `PUT .../causes|consequences` replaces the WHOLE collection
     * (`replace-risk-statements-request.dto.ts`), so confirming one dirty
     * item while a second, unrelated one sat dirty would silently persist
     * the second's half-typed text too. The lock is what keeps this a real
     * collective PUT instead of a simulated per-item save.
     */
    editAction: (kind: 'cause' | 'consequence', index: number): string =>
      kind === 'cause' ? `Editar causa ${index + 1}` : `Editar consequência ${index + 1}`,
    confirmAction: 'Confirmar',
    newBadge: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Nova causa' : 'Nova consequência',
    editingBadge: 'Editando',
    lockedHint: 'Confirme ou cancele a edição em andamento antes de iniciar outra.',
    removeConfirm: {
      title: (kind: 'cause' | 'consequence'): string =>
        kind === 'cause' ? 'Remover causa?' : 'Remover consequência?',
      description: (kind: 'cause' | 'consequence'): string =>
        kind === 'cause'
          ? 'Esta causa será removida da lista. A lista inteira é regravada ao confirmar.'
          : 'Esta consequência será removida da lista. A lista inteira é regravada ao confirmar.',
    },
    // No separate "view full list" label here — `assessment.
    // causesConsequencesSummary.viewAllAction` already says exactly this
    // ("Ver Causas e Consequências completas") for the one place that jumps
    // TO this section (the Análise summary); this section IS the
    // destination, so it never needed its own copy of that sentence
    // (reconciled 2026-09-17, one vocabulary for one link — CLAUDE.md
    // §13.8).
  },

  detail: {
    breadcrumbLabel: 'Riscos',
    loading: 'Carregando risco…',
    notFoundTitle: 'Risco não encontrado',
    notFoundDescription:
      'Este risco não existe ou você não tem acesso a ele dentro do seu escopo organizacional.',
    editAction: 'Editar',
    metadata: {
      owner: (name: string): string => `Gestor: ${name}`,
      responsible: (name: string): string => `Responsável: ${name}`,
      orgUnit: (name: string): string => `Unidade: ${name}`,
      identifiedOn: (date: string): string => `Identificado em ${date}`,
      /**
       * CLAUDE.md §18 ("establish hierarchy"): next review is one of the
       * facts the header must answer before any tab is read, alongside
       * owner/organization — shown only when set, exactly like
       * `responsible` above, since a risk without one has nothing honest
       * to report here (the Overview tab's own "Não definido" still covers
       * the explicit unset case).
       */
      nextReviewOn: (date: string): string => `Próxima revisão em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      assessment: 'Avaliação',
      causesConsequences: 'Causas e Consequências',
      controls: 'Controles',
      treatment: 'Tratamento',
      actionPlans: 'Planos de Ação',
      history: 'Histórico',
      audit: 'Auditoria',
      attachments: 'Anexos',
      comments: 'Comentários',
      /** 002-shared-grc-foundation, US1 — no new sidebar entry (R-009); the
       * evidence panel lives inside this same set of tabs, exactly like
       * Attachments/Comments above. */
      evidence: 'Evidência',
      /** 002-shared-grc-foundation, US3 — the ONE frontend surface Finding
       * gets in this phase (no new sidebar entry either); scoped by
       * organizational unit, see `FindingsPanel`'s own header. */
      findings: 'Achados',
      /** 013-incidents-problems-reverse-links — the reverse read of
       * `IncidentRiskLink`/`ProblemRiskLink`, surfaced from the Risk side
       * for the first time this phase. */
      incidents: 'Incidentes',
      problems: 'Problemas',
      /** 016-risk-detail-experience §4.4, R-6 — Processos and Ativos used to
       * render inside "Controles" (`risk-controls-section.tsx`); they now
       * have their own leaf under "Relacionamentos", same endpoints, same
       * permissions, same components — only the label/grouping is new. */
      processesAssets: 'Processos e Ativos',
    },

    /**
     * The five top-level groups of the two-level navigation
     * (016-risk-detail-experience §4.4) — level 1 of the `EntityTabs`/
     * `EntityTabs` nesting `RiskDetailView` builds. Leaf section labels stay
     * exactly `sections` above; nothing here duplicates them.
     */
    groups: {
      overview: 'Visão geral',
      analysis: 'Análise',
      response: 'Resposta',
      relationships: 'Relacionamentos',
      register: 'Registro',
    },
    groupsAriaLabel: 'Grupos de seções do risco',
    /** Accessible name for a group's own leaf-section `EntityTabs`, e.g. "Seções de Análise". */
    sectionsAriaLabel: (groupLabel: string): string => `Seções de ${groupLabel}`,
    /**
     * Accessible name for `DetailLayout`'s `asideLabel` — the sticky
     * `complementary` landmark holding Atenção/Ações rápidas/
     * Relacionamentos/Última atualização (corrected 2026-09-17: the column
     * existed but was not a landmark at all, so a screen reader user had no
     * way to jump to it or know it existed).
     */
    asideLabel: 'Contexto do risco',

    /**
     * The executive summary row — five `SummaryStatCard`s (§4.3). Every
     * value comes from the SAME `GET /risks/{riskId}` the page already
     * loaded — never a second request (§4.9) and never a duplicated
     * calculation of a figure some other part of this screen already shows
     * (CLAUDE.md §19.7): inherent/residual level are the same
     * `RiskScoringService` output the header's own badges show, and the
     * "planos de ação"/"revisão" figures are the exact fields the register
     * and `TreatmentActionsTable` already display.
     *
     * **Reverted to five cards, 2026-09-17** — an asymmetric four-block
     * "Exposição" composition was built and then explicitly rejected by the
     * user (not the coordinator's original ask): the five-card row, its
     * icons and its equal-width identity stay exactly as they were. What
     * genuinely needed fixing — absent values reading with too much visual
     * weight — is a typography/spacing correction inside `RiskSummaryRow`,
     * not a change to this catalog's shape or to `SummaryStatCard` itself.
     */
    summary: {
      regionLabel: 'Resumo executivo do risco',
      groups: {
        exposure: 'Exposição ao risco',
        response: 'Resposta',
        governance: 'Governança',
      },
      inherentLevel: {
        label: 'Nível inerente',
        hint: 'Antes dos controles',
        notAssessed: 'Não avaliado',
      },
      residualLevel: {
        label: 'Nível residual',
        hint: 'Após os controles',
        notAssessed: 'Não avaliado',
      },
      treatment: {
        label: 'Tratamento',
        // Reverted to the product's own real word (P5/V4/2026-09-16
        // correction): this card is the SAME screen as "Detalhes do risco",
        // which says "Não definido" for Categoria/Tipo/Origem a few
        // centimetres below — "Indefinido" here would be a second
        // vocabulary for the identical concept (§11.1). The wrap this value
        // can cause is now handled by layout (`RiskSummaryRow`'s own
        // `className="items-start"` on every `SummaryStatCard` in the row —
        // see that file's header comment), never by changing the word.
        notDefined: 'Não definido',
      },
      actionPlans: {
        label: 'Planos de ação',
        none: 'Não possui',
        hint: (open: number, overdue: number): string =>
          `${open} ${open === 1 ? 'aberto' : 'abertos'} · ${overdue} em atraso`,
      },
      review: {
        label: 'Revisão',
        // Same reversion as `treatment.notDefined` above, same reason.
        none: 'Não agendada',
        hintOnTime: 'Próxima revisão',
        hintOverdue: 'Em atraso',
      },
    },

    /**
     * The lifecycle spine visual (§4.6) — labels for the eight `RiskStatus`
     * positions come from `riskStatusLabel`/`statusLabels` above, the exact
     * same word the header's `StatusBadge` and every other screen use;
     * nothing here re-names a status.
     */
    lifecycleSpine: {
      title: 'Trajetória do ciclo de vida',
      mainAriaLabel: 'Posições principais do ciclo de vida',
      branchesAriaLabel: 'Ramos do ciclo de vida',
      branchesLabel: 'Ramos',
      stateLabels: {
        current: 'Atual',
        traversed: 'Concluído',
        available: 'Disponível',
        blocked: 'Bloqueado',
        unavailable: 'Indisponível',
      },
    },

    /**
     * The contextual aside's "Atenção" block (§4.7) — real pendencies only,
     * built from data the page already loaded (the lifecycle state and the
     * risk record itself); the whole block is omitted by its caller when
     * none of these apply, never rendered as an empty "tudo certo" panel.
     */
    attention: {
      heading: 'Atenção',
      pendingApproval: (transitionLabel: string): string =>
        `Aprovação pendente: ${transitionLabel}`,
      overdueReview: 'Revisão vencida.',
      /**
       * `risk.overdueTreatment` is `true` iff the risk has at least one
       * overdue TREATMENT ACTION (`risk-response.mapper.ts`:
       * `treatmentActionSummary.overdue > 0`) — independent of whether a
       * current treatment DECISION even exists. Corrected 2026-09-15 (P9):
       * the previous wording ("Tratamento vencido.") read as if the
       * decision itself had an overdue deadline, contradicting the summary
       * row's own "Tratamento: Não definido" whenever `currentTreatment`
       * was `null`. This sentence is now about the actions specifically,
       * which is what the underlying data actually says.
       */
      overdueTreatment: 'Há ações de tratamento em atraso.',
      /**
       * A SHORT summary — corrected 2026-09-15 (P1): this used to embed the
       * full precondition sentence, which already appears once inside
       * `RiskLifecycleActions` (under the blocked transition's own button).
       * This panel only names what is blocked; the reader follows it there
       * for the full explanation, never a second copy of the same sentence.
       */
      blockedTransition: (targetLabel: string): string =>
        `Transição para "${targetLabel}" bloqueada`,
    },

    /**
     * The contextual aside's "Ações rápidas" block (§4.7) — shortcuts to
     * surfaces that already exist on this same page, gated by exactly the
     * permission that already governs the destination action and nothing
     * else (corrected 2026-09-15: "Criar plano de ação" is NOT additionally
     * conditioned on a current treatment decision existing —
     * `treatment-actions-table.tsx` gates creation on `risk:treat` alone,
     * and `currentTreatmentId` is an optional association; narrowing the
     * shortcut beyond that permission would be shrinking a real capability
     * under cover of a visual reorganization, CLAUDE.md §18.9). Never
     * "Registrar incidente"/"Registrar problema" — the risk side of those
     * links is read-only (`risk-incident-problem-links-section.tsx`), and a
     * shortcut that cannot actually create the link would be a false
     * promise.
     */
    quickActions: {
      heading: 'Ações rápidas',
      recordAssessment: 'Registrar avaliação',
      recordTreatmentDecision: 'Registrar decisão de tratamento',
      createActionPlan: 'Criar plano de ação',
      linkControl: 'Vincular controle',
      addEvidence: 'Adicionar evidência',
      comment: 'Comentar',
    },

    /**
     * The contextual aside's "Relacionamentos" block (§4.7). Planos de
     * ação/Controles/Processos e Ativos show a number for free (R-7,
     * already on `RiskDetail`); Incidentes/Problemas/Evidências show a path
     * with no number — counting them costs a request each (R-8), which
     * §4.9 forbids on mount, so the number only ever appears once the
     * section itself is opened, where each already renders its own count.
     * Achados is deliberately labelled as the ORGANIZATIONAL UNIT's own
     * count, never "deste risco" — `FindingsPanel` is scoped by `orgUnitId`,
     * not by risk (R-5), and counting it here as if it belonged to this one
     * risk would be false.
     */
    relationshipsPanel: {
      heading: 'Relacionamentos',
      actionPlans: (count: number): string => `Planos de ação (${count})`,
      controls: (count: number): string => `Controles (${count})`,
      processesAssets: (count: number): string => `Processos e Ativos (${count})`,
      incidents: 'Incidentes',
      problems: 'Problemas',
      evidence: 'Evidências',
      findings: 'Achados (da unidade organizacional)',
      /** Trailing hint for a relationship whose count is not on this page's own payload (R-8) — distinguishes "not loaded yet" from an actual zero (P6, 2026-09-15). */
      viewHint: 'Ver',
    },

    lastUpdatedHeading: 'Última atualização',
  },

  overview: {
    cardTitle: 'Dados do risco',
    /**
     * CLAUDE.md §18 ("establish hierarchy"): the description is the
     * highest-value read for a risk manager and gets its own prominent
     * card. Classification (category/type/origin), ownership and dates are
     * merged into one "Detalhes do risco" card (016-risk-detail-experience
     * §4.5 — wave 4's original split into "Classificação"/"Responsabilidade
     * e datas" is gone, but the `muted` treatment that told them apart
     * survives inside the merged card, see `risk-overview.tsx`). No field
     * is removed and no data changes — only the card boundary moves.
     */
    descriptionCardTitle: 'Descrição',
    detailsCardTitle: 'Detalhes do risco',
    fields: {
      description: 'Descrição',
      category: 'Categoria',
      type: 'Tipo',
      origin: 'Origem',
      orgUnit: 'Unidade organizacional',
      owner: 'Gestor do risco',
      responsible: 'Responsável',
      identifiedOn: 'Data de identificação',
      lastAssessedOn: 'Última avaliação',
      nextReviewOn: 'Próxima revisão',
      status: 'Status',
    },
    notSet: 'Não definido',
    // Inherent/residual level cards, and the explanatory sentence that used
    // to sit under them, moved to the record's own executive summary row
    // (`RiskSummaryRow`, `components/detail/`) — 016-risk-detail-experience
    // §4.3. `RiskSummaryRow`'s own catalog entry (`detail.summary`) now owns
    // the "não avaliado" honesty guarantee SC-013 asks for.
  },

  /**
   * Risk register / inventory screen (T110–T113, US3, FR-086 to FR-092).
   * `columns.riskLevel` and `filters.riskLevelBasis` are kept as separate,
   * differently-worded labels on purpose — `basisLabel`
   * ("Base do nível exibido") never shares a prefix with `riskLevel`
   * ("Nível de risco"), and the column header itself grows a `(Residual)`/
   * `(Inerente)` suffix from `columnHeaderSuffix` — so no two accessible
   * names on this screen collide, and the two users reading the same page
   * never have to guess whether "nível" means residual or inherent
   * (ADR-006, CLAUDE.md's accessible-name-collision warning).
   */
  register: {
    pageTitle: 'Registro de riscos',
    pageDescription: 'Gerencie, filtre e acompanhe os riscos do seu escopo organizacional.',
    tableCaption: 'Registro de riscos',
    createAction: 'Novo risco',
    loadError: 'Não foi possível carregar o registro de riscos.',

    filters: {
      regionLabel: 'Filtros do registro de riscos',
      /** Small caption in front of the filter-controls row (`FilterBar.filtersLabel`) — purely a visual grouping cue distinguishing it from the search row above it. */
      groupLabel: 'Filtros',
      searchLabel: 'Buscar por código, título ou descrição',
      searchPlaceholder: 'Buscar riscos por código, título ou descrição…',
      statusLabel: 'Status',
      riskLevelLabel: 'Nível de risco',
      basisLabel: 'Base do nível exibido',
      /** Compact visible text for the toolbar's basis toggle — the control's accessible name stays the full `basisLabel` sentence via `aria-label`; this short word is what actually fits inline next to the selected value at the same height as every sibling filter button. */
      basisLabelShort: 'Base',
      basisOptions: {
        RESIDUAL: 'Residual',
        INHERENT: 'Inerente',
      },
      categoryLabel: 'Categoria',
      orgUnitLabel: 'Unidade organizacional',
      ownerLabel: 'Gestor do risco',
      overdueReviewLabel: 'Revisão vencida',
      overdueTreatmentLabel: 'Tratamento vencido',
      loadingOptions: 'Carregando opções de filtro…',
      optionsError: 'Não foi possível carregar as opções de filtro.',
      columnsMenuLabel: 'Colunas',
    },

    columns: {
      code: 'Código',
      title: 'Título',
      status: 'Status',
      category: 'Categoria',
      orgUnit: 'Unidade organizacional',
      owner: 'Gestor do risco',
      /** Appended to `filters.riskLevelLabel` to form the header text, e.g. "Nível de risco (residual)". */
      riskLevelBasisSuffix: {
        RESIDUAL: 'residual',
        INHERENT: 'inerente',
      },
      nextReviewOn: 'Próxima revisão',
      identifiedOn: 'Identificado em',
      lastAssessedOn: 'Última avaliação',
      updatedAt: 'Atualizado em',
      notSet: 'Não definido',
    },

    indicators: {
      overdueReview: 'Revisão vencida',
      overdueTreatment: 'Tratamento vencido',
      /** The quiet half of the "Tratamento vencido" column: the treatment is not overdue — never "Não definido", which claimed the deadline itself was unknown. */
      treatmentOnTime: 'Em dia',
      pendingApproval: PENDING_APPROVAL_LABEL,
    },

    /**
     * Compact indicator row above the toolbar.
     *
     * Every figure comes from `GET /dashboard`, never from a second count
     * computed on this screen: that endpoint resolves the caller's scope
     * through the same `ScopeResolverService.resolveScope` that `GET /risks`
     * itself uses, and computes each figure with the same rule as the
     * register filter the card links to — `itemsRequiringReview` is
     * literally `next_review_on IS NOT NULL AND next_review_on < today`, the
     * same condition as the register's own `overdueReview` filter fragment.
     * That parity is what lets each card be a link *into* the filtered
     * register without the number and the resulting list ever disagreeing; a
     * second, independent count computed here would be exactly the
     * duplicated derived rule CLAUDE.md §19.7 forbids.
     *
     * These four count the caller's WHOLE scope and are deliberately
     * unaffected by the filters below them — their job is "the general
     * situation, before you look at the list". `hint` therefore says out
     * loud what each one counts, so "Riscos críticos" is never silently
     * read as inherent while the toolbar happens to be showing inherent
     * levels: the dashboard figure is residual, always.
     */
    summary: {
      regionLabel: 'Situação geral dos riscos no seu escopo',
      total: {
        label: 'Total de riscos',
        hint: 'No seu escopo organizacional',
        linkLabel: 'Ver todos os riscos, sem filtros',
      },
      critical: {
        label: 'Riscos críticos',
        hint: 'Nível residual crítico',
        linkLabel: 'Filtrar o registro por nível residual crítico',
      },
      underTreatment: {
        label: 'Em tratamento',
        hint: 'Com tratamento em andamento',
        linkLabel: 'Filtrar o registro por status em tratamento',
      },
      overdueReview: {
        label: 'Revisão vencida',
        hint: 'Próxima revisão já no passado',
        linkLabel: 'Filtrar o registro por revisão vencida',
      },
      loading: 'Carregando indicadores…',
      /** The indicators are a summary on top of an otherwise working register — a failure here degrades to this one quiet line, never to an error state that hides the list. */
      error: 'Não foi possível carregar os indicadores.',
    },

    /** Cards ↔ Tabela segmented control. Cards is the primary view; the table stays for dense comparison of many records at once. */
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver os riscos em cards',
      tableLabel: 'Ver os riscos em tabela',
    },

    /**
     * The results bar between the toolbar and the results — result count on
     * the left, ordering on the right. Rendered in BOTH views: it is the
     * only sort control the card view has, and in table view it stays in
     * step with the sortable column headers because both read and write the
     * same URL state rather than a second copy of it.
     */
    results: {
      /** The toolbar states the size of the result set; the pagination footer states which slice of it is on screen ("1–50 de 861"). Between them the number appears once, in each of its two meanings. */
      count: (total: number): string =>
        total === 1 ? '1 risco' : `${total.toLocaleString('pt-BR')} riscos`,
      countLoading: 'Carregando riscos…',
      sortLabel: 'Ordenar por',
      /**
       * Named presets over the contract's own `sort` + `direction` pair —
       * `GET /risks` accepts exactly these fields (risks.openapi.yaml), so
       * the screen never offers an ordering the server would reject. The
       * default stays the contract's own (`code`/`asc`), NOT "Mais
       * recentes": which ordering a freshly-opened register uses is
       * behaviour, not decoration, and this screen's brief was visual.
       */
      sortOptions: {
        'code:asc': 'Código (crescente)',
        'updatedAt:desc': 'Mais recentes',
        'title:asc': 'Título (A–Z)',
        'riskLevel:desc': 'Maior nível de risco',
        'nextReviewOn:asc': 'Próxima revisão',
        'status:asc': 'Status',
        'owner:asc': 'Gestor do risco',
      },
      /**
       * The curated presets above cover the orderings worth offering by
       * name, but the sortable column headers in table view can produce any
       * field/direction pair — `Título` clicked twice is `title:desc`, which
       * is deliberately not a preset. Rather than let the control fall back
       * to showing nothing selected (a sort control that cannot state the
       * sort in force), the screen composes one extra option from these
       * parts for whatever combination is actually active. The control is
       * then always able to name the current ordering, whichever surface
       * set it.
       */
      sortFieldLabels: {
        code: 'Código',
        title: 'Título',
        riskLevel: 'Nível de risco',
        status: 'Status',
        owner: 'Gestor do risco',
        nextReviewOn: 'Próxima revisão',
        identifiedOn: 'Identificado em',
        updatedAt: 'Atualizado em',
      },
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      },
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} (${directionLabel})`,
    },

    /** The card itself. Field captions are visible in the metadata row, so a card read on its own is never a set of unlabelled values. */
    card: {
      regionLabel: 'Riscos',
      categoryLabel: 'Categoria',
      orgUnitLabel: 'Unidade',
      ownerLabel: 'Gestor',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      /**
       * The card's own click target now navigates straight to the full
       * record (quick view removed) — matches the "Abrir o X {code}:
       * {title}" convention every other module's card already uses
       * (`incidents.ts`'s own `card.selectLabel`, for one).
       */
      selectLabel: (code: string, title: string): string => `Abrir o risco ${code}: ${title}`,
      /** A risk with no assessment yet has no residual level — stated plainly, never rendered as a level that does not exist (SC-013). */
      noLevel: 'Sem avaliação',
    },

    /**
     * `FilterBar`'s active-filters chip row (`@pharos/design-system`, D-10)
     * — one chip per active filter *field*, built by
     * `risk-register-filters.tsx` from the same conditions
     * `useRegisterState`'s own `hasActiveFilters` checks, never a
     * re-derivation of them. `removeLabel` composes the chip's own
     * accessible name ("Remover filtro: Status (2)") — deliberately distinct
     * wording from `empty.noResults.clearAction` and the toolbar's own
     * `common.actions.clearFilters` so no two "clear/remove" controls on
     * this screen ever collide by accessible name (CLAUDE.md's own warning,
     * already paid for once — see `risk-register.spec.ts`'s doc comment).
     */
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (value: string): string => `Busca: "${value}"`,
      countChip: (label: string, count: number): string => `${label} (${count})`,
      valueChip: (label: string, value: string): string => `${label}: ${value}`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
    },

    empty: {
      /** No risk exists yet within the caller's scope — regardless of filters (US3 AS7). */
      noneYet: {
        title: 'Nenhum risco cadastrado ainda',
        description: 'Quando um risco for criado, ele aparecerá aqui.',
        createAction: 'Criar o primeiro risco',
      },
      /**
       * Risks exist, but no row matches the applied filters/search (US3
       * AS7). `clearAction`'s wording is deliberately distinct from
       * `FilterBar`'s own toolbar-level "Limpar filtros" control (both do
       * the same thing, but from different places on screen) — CLAUDE.md
       * warns this project has already broken an E2E test twice on an
       * accessible-name collision, and `getByRole('button', { name: 'Limpar
       * filtros' })` would otherwise match both this action and the
       * toolbar's at once.
       */
      noResults: {
        title: 'Nenhum risco encontrado para os filtros aplicados',
        description: 'Tente ajustar ou limpar os filtros e o termo de busca.',
        clearAction: 'Limpar todos os filtros',
      },
    },
  },

  /**
   * Assessment (T129–T132, US4, FR-061 to FR-070, ADR-006, ADR-007).
   *
   * `form.matrixLabels(activeBasis)` returns a full `RiskMatrixLabels`
   * object (`@pharos/design-system`, D-10) for the ONE shared matrix
   * `AssessmentForm` renders — `caption` names which basis is currently
   * being placed, so the table's own accessible name changes as the
   * assessor toggles between "Risco inerente"/"Risco residual". Both
   * selections, once made, stay visible together on that same grid via
   * `RiskMatrix`'s own `highlighted` mechanism (a solid-ring "I" marker and
   * a dashed-ring "R" marker — never colour alone), which is the actual
   * distinctness guarantee ADR-006 asks for; `form.selectionSummary` below
   * repeats both as plain text for a reader who prefers not to parse the
   * grid.
   */
  assessment: {
    form: {
      cardTitle: 'Nova avaliação',
      cardDescription:
        'Registre a probabilidade e o impacto inerentes e residuais. Pontuação e nível são calculados pela metodologia configurada — nunca digitados aqui.',
      loadingMethodology: 'Carregando metodologia de avaliação…',
      methodologyError: 'Não foi possível carregar a metodologia de avaliação de risco.',

      /** Toggle group choosing which basis `onCellSelect` currently writes to. */
      basisToggle: {
        groupLabel: 'Selecionando',
        inherentAction: 'Risco inerente',
        residualAction: 'Risco residual',
      },

      sections: {
        inherent: {
          title: 'Risco inerente',
          description: 'Probabilidade e impacto antes de considerar os controles em vigor.',
        },
        residual: {
          title: 'Risco residual',
          description: 'Probabilidade e impacto depois de considerar os controles em vigor.',
        },
      },

      matrixLabels: (activeBasis: 'inherent' | 'residual') =>
        buildRiskMatrixLabels(
          activeBasis === 'inherent'
            ? 'Matriz de risco — selecionando risco inerente'
            : 'Matriz de risco — selecionando risco residual',
        ),

      /** Plain-text readout of a basis's current selection, alongside the matrix's own visual markers — never the only way to know what was picked. */
      selectionSummary: (
        basisLabel: string,
        selection: { score: number; levelLabel: string } | null,
      ): string =>
        selection
          ? `${basisLabel}: pontuação ${selection.score}, nível ${selection.levelLabel}.`
          : `${basisLabel}: ainda não selecionado.`,

      fields: {
        rationale: {
          label: 'Justificativa',
          description: 'Explique o que embasou os valores escolhidos, se relevante.',
        },
      },

      validation: {
        inherentCellRequired: 'Selecione a probabilidade e o impacto do risco inerente.',
        residualCellRequired: 'Selecione a probabilidade e o impacto do risco residual.',
      },

      actions: {
        submit: 'Registrar avaliação',
        submitting: 'Registrando…',
      },

      submitSuccess: 'Avaliação registrada.',
      genericError: 'Não foi possível registrar a avaliação. Tente novamente.',

      /**
       * 422 with a `methodologyVersionId` field error (US4 AS5, FR-068): the
       * active methodology changed after this form loaded. The platform
       * never silently rescoped the submission onto the new version — the
       * assessor must explicitly reload and re-enter it against the version
       * now in force.
       */
      methodologyChanged: {
        title: 'A metodologia de avaliação foi atualizada',
        description:
          'A versão da metodologia usada neste formulário não é mais a vigente. Recarregue a metodologia abaixo e refaça as seleções antes de registrar a avaliação.',
        reloadAction: 'Recarregar metodologia vigente',
      },

      /** FR-103 / ADR-013 — same optimistic-locking shape as `risks.form.conflict`, worded for an assessment instead of a full risk edit. */
      conflict: {
        title: 'Este risco foi alterado por outra pessoa',
        description:
          'Alguém salvou uma alteração neste risco enquanto você preenchia esta avaliação. Sua avaliação abaixo NÃO foi perdida e continua preenchida neste formulário, mas ainda não foi registrada — revise o que mudou antes de tentar novamente.',
        modifiedBy: (name: string): string => `Alterado por: ${name}`,
        modifiedAt: (when: string): string => `Alterado em: ${when}`,
        reloadAction: 'Ver versão atual em nova aba',
        retryAction: 'Registrar mesmo assim com minha avaliação',
        dismissAction: 'Continuar editando',
      },
    },

    /**
     * The Causas/Consequências SUMMARY inside "Avaliação" (Área 2,
     * 2026-09-17) — progressive disclosure, not a duplicate: this shows the
     * first couple of items and a count, with a path to the real leaf
     * section (`causesConsequences`, unchanged, still the only place to
     * add/edit/remove one). Never a second copy of the full list.
     */
    causesConsequencesSummary: {
      causesHeading: 'Causas',
      consequencesHeading: 'Consequências',
      empty: 'Nenhuma registrada.',
      andMore: (count: number): string => `+ ${count} ${count === 1 ? 'outra' : 'outras'}`,
      viewAllAction: 'Ver Causas e Consequências completas',
    },

    /** Action triggers for the two forms this area used to keep permanently open (Área 2, 2026-09-17) — same "list/state first, action behind a button" pattern `treatment-actions-table.tsx` already established. */
    actions: {
      recordNew: 'Registrar nova avaliação',
      changeNextReview: 'Alterar próxima revisão',
    },

    section: {
      cardTitle: 'Avaliação atual',
      notAssessedTitle: 'Este risco ainda não foi avaliado',
      notAssessedDescription: 'Registre a primeira avaliação abaixo para calcular seus níveis.',
      inherentTitle: 'Risco inerente',
      residualTitle: 'Risco residual',
      assessedOn: (date: string): string => `Avaliado em ${date}`,
      assessedBy: (name: string): string => `Avaliado por ${name}`,
      methodologyVersion: (versionNumber: number): string => `Metodologia v${versionNumber}`,
      /**
       * Visually-hidden `<dt>` labels above `assessedOn`/`assessedBy`/
       * `methodologyVersion`'s own full-sentence `<dd>` values
       * (`risk-assessment-section.tsx`) — moved here from inline JSX
       * strings (assurance-audit Fix 4, §11.1: no user-facing text,
       * accessibility labels included, embedded directly in a component).
       */
      assessedOnFieldLabel: 'Avaliado em',
      assessedByFieldLabel: 'Avaliado por',
      methodologyFieldLabel: 'Metodologia',
      rationaleLabel: 'Justificativa',
      noRationale: 'Nenhuma justificativa registrada.',
      matrixCaption: 'Matriz de risco — avaliação atual em contexto',
      matrixLoading: 'Carregando matriz de risco…',
      matrixLoadError:
        'Não foi possível carregar a matriz de risco para exibir a avaliação em contexto.',
      /** The compact inherent/residual comparison beside the matrix (016-risk-detail-experience, Área 2, 2026-09-17) — probability/impact spelled out as TERMS (the methodology scale's own label for the assessed value), not just the numeric score, so the two bases are comparable at a glance. */
      comparison: {
        probabilityLabel: 'Probabilidade',
        impactLabel: 'Impacto',
      },
      /** "Contexto da avaliação" — deliberately subordinate weight to the matrix/comparison above it (Área 2). */
      contextHeading: 'Contexto da avaliação',
    },

    history: {
      cardTitle: 'Histórico de avaliações',
      cardDescription:
        'Cada avaliação é um registro permanente e individual; uma reavaliação nunca substitui ou apaga as anteriores.',
      loading: 'Carregando histórico de avaliações…',
      loadError: 'Não foi possível carregar o histórico de avaliações.',
      empty: 'Nenhuma avaliação registrada ainda.',
      columns: {
        assessedOn: 'Data',
        assessedBy: 'Avaliado por',
        inherent: 'Inerente',
        residual: 'Residual',
        change: 'Variação do nível residual',
        rationale: 'Justificativa',
      },
      change: {
        first: 'Primeira avaliação registrada — sem avaliação anterior para comparar.',
        increased: (previousLevel: string, currentLevel: string): string =>
          `Subiu de ${previousLevel} para ${currentLevel}.`,
        decreased: (previousLevel: string, currentLevel: string): string =>
          `Caiu de ${previousLevel} para ${currentLevel}.`,
        unchanged: (level: string): string => `Permaneceu em ${level}.`,
      },
      noRationale: 'Sem justificativa registrada.',
      loadMore: 'Carregar mais',
    },

    reviewSchedule: {
      cardTitle: 'Próxima revisão',
      currentLabel: 'Data agendada',
      notSet: 'Não definida',
      overdueLabel: 'Revisão vencida',
      fieldLabel: 'Nova data de próxima revisão',
      saveAction: 'Salvar',
      saving: 'Salvando…',
      saveSuccess: 'Próxima revisão atualizada.',
      saveError: 'Não foi possível atualizar a próxima revisão. Tente novamente.',
    },
  },

  /**
   * Treatment (T144-T145, US5, FR-071 to FR-075, FR-102). `strategyLabels`
   * is `TREATMENT_STRATEGY_LABELS` above, re-exported here so a component
   * imports everything treatment-related from `risks.treatment` alone,
   * mirroring how `riskLevelLabels` re-exports `RISK_LEVEL_LABELS`.
   *
   * `actionsTable`'s own status vocabulary was retired in favor of
   * `features/actions/status.ts`'s `actionStatusLabel`/
   * `actionStatusBadgeVariant` (themselves sourced from
   * `lib/messages/actions.ts`'s `statusLabels`) once `TreatmentActionsTable`
   * started reusing `Action`'s own shared lifecycle — CLAUDE.md §19.6: one
   * vocabulary for one lifecycle, never a second copy per module.
   */
  treatment: {
    strategyLabels: TREATMENT_STRATEGY_LABELS,

    section: {
      cardTitle: 'Tratamento atual',
      notTreatedTitle: 'Este risco ainda não possui uma decisão de tratamento',
      notTreatedDescription: 'Registre a estratégia de tratamento abaixo.',
      fields: {
        strategy: 'Estratégia',
        description: 'Descrição',
        deadline: 'Prazo',
        decidedBy: (name: string): string => `Decidido por ${name}`,
        decidedAt: (date: string): string => `Decidido em ${date}`,
      },
      noDeadline: 'Sem prazo definido.',
      deadlineOverdueLabel: 'Prazo vencido',
      recordNewAction: 'Registrar nova decisão',
    },

    /**
     * The record-new-decision form (FR-073). `supersessionWarning` is the
     * mechanism that makes supersession obvious BEFORE the user commits —
     * it only renders when a current decision already exists, is never
     * dismissible without acting, and names the exact strategy that will
     * be superseded so the user is never surprised after the fact.
     */
    form: {
      cardTitle: 'Registrar decisão de tratamento',
      cardDescription:
        'Defina a estratégia de tratamento deste risco. Se já existir uma decisão vigente, registrar uma nova decisão a substitui — a anterior permanece visível no histórico, mas deixa de ser a decisão vigente.',
      supersessionWarning: (currentStrategyLabel: string): string =>
        `Este risco já possui uma decisão vigente (${currentStrategyLabel}). Registrar esta nova decisão irá substituí-la como decisão vigente — a decisão atual NÃO será apagada e continuará visível no histórico abaixo.`,
      fields: {
        strategy: { label: 'Estratégia', placeholder: 'Selecione a estratégia de tratamento' },
        description: {
          label: 'Descrição',
          description: 'A justificativa para esta decisão de tratamento.',
        },
        deadline: { label: 'Prazo' },
      },
      validation: {
        strategyRequired: 'Selecione a estratégia de tratamento.',
        descriptionRequired: 'Descreva a justificativa desta decisão.',
      },
      actions: {
        submit: 'Registrar decisão',
        submitting: 'Registrando…',
        cancel: 'Cancelar',
      },
      submitSuccess: 'Decisão de tratamento registrada.',
      genericError: 'Não foi possível registrar a decisão de tratamento. Tente novamente.',
      conflict: {
        title: 'Este risco foi alterado por outra pessoa',
        description:
          'Alguém salvou uma alteração neste risco enquanto você preenchia esta decisão. Sua decisão abaixo NÃO foi perdida e continua preenchida neste formulário, mas ainda não foi registrada — revise o que mudou antes de tentar novamente.',
        modifiedBy: (name: string): string => `Alterado por: ${name}`,
        modifiedAt: (when: string): string => `Alterado em: ${when}`,
        reloadAction: 'Ver versão atual em nova aba',
        retryAction: 'Registrar mesmo assim com minha decisão',
        dismissAction: 'Continuar editando',
      },
    },

    /** History of every treatment decision, newest first, including superseded ones (FR-073) — an append-only record, mirroring `assessment.history`'s own convention. */
    history: {
      cardTitle: 'Histórico de decisões de tratamento',
      cardDescription:
        'Cada decisão é um registro permanente; registrar uma nova decisão nunca apaga ou substitui as anteriores no histórico.',
      loading: 'Carregando histórico de tratamento…',
      loadError: 'Não foi possível carregar o histórico de tratamento.',
      empty: 'Nenhuma decisão de tratamento registrada ainda.',
      columns: {
        strategy: 'Estratégia',
        description: 'Descrição',
        deadline: 'Prazo',
        decidedBy: 'Decidido por',
        decidedAt: 'Decidido em',
        status: 'Situação',
      },
      currentBadge: 'Vigente',
      supersededBadge: (date: string): string => `Substituída em ${date}`,
      loadMore: 'Carregar mais',
    },

    /**
     * The treatment actions table — now the "Planos de Ação" tab's own
     * content (`detail.sections.actionPlans`), moved there from "Tratamento"
     * once it grew a real lifecycle. It still reads/writes through the
     * RISK's own routes (`GET`/`POST /risks/{riskId}/treatment-actions`,
     * `PATCH .../treatment-actions/{actionId}`) — never the generic
     * `POST /actions` `IncidentCorrectiveActions`/`ProblemCorrectiveActions`
     * use — because `risk:treat` (`TreatmentController`'s own
     * `@RequirePermission`) is this module's own gate for creating AND
     * editing a treatment action. `risk:treat` is ALSO this table's own gate
     * for offering a lifecycle transition, unlike the incident/problem
     * sections' `action:edit`: a caller who can see the risk (`risk:view`)
     * but cannot treat it sees the list read-only, with neither the
     * "Adicionar ação" button nor any row-action menu.
     *
     * The lifecycle transition itself (start/complete/cancel/reopen) goes
     * through the ONE shared endpoint (`POST /actions/{actionId}/
     * transitions`) and reuses `features/actions`' own vocabulary
     * (`statusLabels`, `myActions.transitions.*`, `ReopenActionDialog`) —
     * never a second copy of that table here (CLAUDE.md §19.6). `overdue`
     * is always the server's answer (ADR-015), conveyed by text AND an icon,
     * never colour alone (SC-012).
     */
    actionsTable: {
      cardTitle: 'Plano de ação',
      cardDescription: 'Ações de tratamento que implementam a decisão de tratamento deste risco.',
      loading: 'Carregando plano de ação…',
      loadError: 'Não foi possível carregar o plano de ação.',
      empty: 'Nenhuma ação de tratamento registrada ainda.',
      columns: {
        title: 'Título',
        responsible: 'Responsável',
        dueOn: 'Prazo',
        status: 'Situação',
        rowActions: 'Ações',
      },
      overdueBadge: 'Vencida',
      addAction: 'Adicionar ação',
      editAction: 'Editar',
      loadMore: 'Carregar mais',
      transitionError: 'Não foi possível alterar a situação da ação. Tente novamente.',

      /** The plan-level summary shown atop the table — built entirely from
       * `RiskDetail.treatmentActionSummary`, already loaded with the risk;
       * never a dedicated new request. */
      summary: {
        total: (count: number): string => `${count} ${count === 1 ? 'ação' : 'ações'} no total`,
        overdue: (count: number): string =>
          count === 0 ? 'Nenhuma atrasada' : `${count} ${count === 1 ? 'atrasada' : 'atrasadas'}`,
      },

      form: {
        cardTitle: 'Nova ação de tratamento',
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
        submitSuccess: 'Ação de tratamento adicionada.',
        genericError: 'Não foi possível adicionar a ação de tratamento. Tente novamente.',
      },

      /** Edits title/description/responsible/due date only — status changes
       * always go through a lifecycle transition above, never this form. */
      editForm: {
        cardTitle: 'Editar ação de tratamento',
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
          submit: 'Salvar',
          submitting: 'Salvando…',
          cancel: 'Cancelar',
        },
        submitSuccess: 'Ação de tratamento atualizada.',
        genericError: 'Não foi possível atualizar a ação de tratamento. Tente novamente.',
      },

      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    /** Shown on the "Tratamento" tab, where the actions table used to live,
     * pointing to its new home so a caller who remembers it never reads its
     * absence as data loss. */
    actionsMovedNotice: 'As ações desta decisão de tratamento estão na aba "Planos de Ação".',
  },

  /**
   * Risk relationships — controls, processes and assets (T146, US5, FR-076
   * to FR-078, ADR-008). One shared vocabulary parameterized by
   * `kind`/`entityLabel` rather than three near-duplicate catalogs, since
   * the three sections follow the identical link/unlink pattern (see
   * `risk-controls-section.tsx`'s own doc comment for why all three live in
   * one component).
   */
  relationships: {
    controls: {
      sectionTitle: 'Controles',
      sectionDescription: 'Controles associados que influenciam o risco residual.',
      entityLabel: 'controle',
      pickerLabel: 'Vincular controle',
      pickerPlaceholder: 'Selecione um controle',
      pickerNoOptions: 'Nenhum controle disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar controle por nome ou código',
      pickerAriaLabel: 'Selecionar controle',
      empty: 'Nenhum controle vinculado a este risco.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Controle vinculado.',
      unlinkSuccess: 'Controle desvinculado.',
      linkError: 'Não foi possível vincular o controle. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o controle. Tente novamente.',
      alreadyLinkedError: 'Este controle já está vinculado a este risco.',
      unlinkConfirm: {
        title: 'Desvincular controle?',
        description: (name: string): string =>
          `O controle "${name}" será desvinculado deste risco. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção — apenas deixa de contar como um vínculo vigente.`,
      },
      columns: {
        name: 'Controle',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    processes: {
      sectionTitle: 'Processos',
      sectionDescription: 'Processos de negócio relacionados a este risco.',
      entityLabel: 'processo',
      pickerLabel: 'Vincular processo',
      pickerPlaceholder: 'Selecione um processo',
      pickerNoOptions: 'Nenhum processo disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar processo por nome ou código',
      pickerAriaLabel: 'Selecionar processo',
      empty: 'Nenhum processo vinculado a este risco.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Processo vinculado.',
      unlinkSuccess: 'Processo desvinculado.',
      linkError: 'Não foi possível vincular o processo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o processo. Tente novamente.',
      alreadyLinkedError: 'Este processo já está vinculado a este risco.',
      unlinkConfirm: {
        title: 'Desvincular processo?',
        description: (name: string): string =>
          `O processo "${name}" será desvinculado deste risco. O vínculo não é apagado: ele continua registrado no histórico — apenas deixa de contar como um vínculo vigente.`,
      },
      columns: {
        name: 'Processo',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    assets: {
      sectionTitle: 'Ativos',
      sectionDescription: 'Ativos relacionados a este risco.',
      entityLabel: 'ativo',
      pickerLabel: 'Vincular ativo',
      pickerPlaceholder: 'Selecione um ativo',
      pickerNoOptions: 'Nenhum ativo disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar ativo por nome ou código',
      pickerAriaLabel: 'Selecionar ativo',
      empty: 'Nenhum ativo vinculado a este risco.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Ativo vinculado.',
      unlinkSuccess: 'Ativo desvinculado.',
      linkError: 'Não foi possível vincular o ativo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o ativo. Tente novamente.',
      alreadyLinkedError: 'Este ativo já está vinculado a este risco.',
      unlinkConfirm: {
        title: 'Desvincular ativo?',
        description: (name: string): string =>
          `O ativo "${name}" será desvinculado deste risco. O vínculo não é apagado: ele continua registrado no histórico — apenas deixa de contar como um vínculo vigente.`,
      },
      columns: {
        name: 'Ativo',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    conflictError:
      'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    /**
     * 013-incidents-problems-reverse-links — READ-ONLY reverse of
     * `IncidentRiskLink` (`GET /risks/{riskId}/incidents`): `modules/risk`
     * never writes this table — `POST`/`DELETE /incidents/{incidentId}/risks`
     * on the Incident side owns that write path. Mirrors
     * `incidents.ts`'s own `relationships.problems` catalog shape exactly
     * (self-fetching, read-only, no picker/link/unlink strings at all).
     */
    incidents: {
      sectionTitle: 'Incidentes',
      sectionDescription:
        'Incidentes que referenciam este risco. Vincular ou desvincular acontece a partir do incidente.',
      empty: 'Nenhum incidente vinculado a este risco.',
      loading: 'Carregando incidentes vinculados…',
      loadError: 'Não foi possível carregar os incidentes vinculados a este risco.',
      statusLabels: {
        OPEN: 'Aberto',
        IN_PROGRESS: 'Em andamento',
        RESOLVED: 'Resolvido',
        CLOSED: 'Fechado',
        CANCELLED: 'Cancelado',
      } satisfies Record<IncidentStatusRef, string>,
      columns: {
        incident: 'Incidente',
        status: 'Status',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    /**
     * READ-ONLY reverse of `ProblemRiskLink` (`GET /risks/{riskId}/problems`):
     * `modules/risk` never writes this table —
     * `POST`/`DELETE /problems/{problemId}/risks` on the Problem side owns
     * that write path.
     */
    problems: {
      sectionTitle: 'Problemas',
      sectionDescription:
        'Problemas que referenciam este risco. Vincular ou desvincular acontece a partir do problema.',
      empty: 'Nenhum problema vinculado a este risco.',
      loading: 'Carregando problemas vinculados…',
      loadError: 'Não foi possível carregar os problemas vinculados a este risco.',
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
   * Risk lifecycle and approvals (T158-T162, US6, FR-029/FR-029a-d,
   * FR-079 to FR-085, ADR-006). `GET /risks/{riskId}/lifecycle` already
   * filters `availableTransitions` by the caller's own permissions and by
   * what is legal from the current state — this catalog only ever labels
   * what the server already decided to offer; no rule name here duplicates
   * the transition table itself (ADR-006's "guarantees drift" clause,
   * applied to the lifecycle exactly as it already is to risk scoring).
   */
  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Transições disponíveis a partir do status atual, para o seu perfil.',
    loading: 'Carregando transições disponíveis…',
    loadError: 'Não foi possível carregar as transições disponíveis.',
    noneAvailable: 'Nenhuma transição está disponível para o seu perfil neste momento.',
    unmetPreconditionsTitle: 'Pendências para esta transição:',

    /**
     * `apply`/`requestApproval` deliberately use two different verbs, never
     * the same verb with a different color — the wording itself is the
     * primary signal that one applies immediately and the other only
     * requests a decision from someone else (US6, FR-029c).
     */
    actions: {
      apply: (targetLabel: string): string => `Aplicar: ${targetLabel}`,
      requestApproval: (targetLabel: string): string => `Solicitar aprovação: ${targetLabel}`,
      /**
       * F-CV clarity pass (`risks-lifecycle-audit`): translates
       * `AvailableRiskTransition.requiredPermission` into business language
       * for display — never the raw `resource:action` identifier itself
       * (CLAUDE.md §11.1 — API identifiers are technical, not interface
       * text). One phrase per permission the lifecycle transition table
       * (`apps/api/.../risk-lifecycle.ts`) actually names as a
       * `requiredPermission`; an identifier this map does not recognize
       * falls back to a generic phrase instead of rendering blank or
       * leaking the identifier.
       */
      authorizedFor: (requiredPermission: string): string => {
        const phrases: Readonly<Record<string, string>> = {
          'risk:edit': 'Disponível para usuários autorizados a editar riscos neste escopo.',
          'risk:assess': 'Disponível para usuários autorizados a avaliar riscos neste escopo.',
          'risk:treat':
            'Disponível para usuários autorizados a definir o tratamento do risco neste escopo.',
          'risk:transition':
            'Disponível para usuários autorizados a conduzir o ciclo de vida do risco neste escopo.',
          'risk:administer': 'Disponível apenas para administradores da plataforma.',
        };
        return phrases[requiredPermission] ?? 'Disponível para usuários autorizados neste escopo.';
      },
      /** Shown for every `requiresApproval: true` transition, alongside the
       * "Solicitar aprovação" verb/icon distinction that already exists —
       * this is the explicit SENTENCE, not a third non-text signal. */
      requiresApprovalNotice: 'Esta transição exige aprovação por outro usuário autorizado.',
    },

    transitionDialog: {
      title: (targetLabel: string): string => `Aplicar transição para "${targetLabel}"`,
      description: (targetLabel: string): string =>
        `O risco mudará para "${targetLabel}" imediatamente ao confirmar. Esta transição é registrada no histórico do risco.`,
      justificationLabel: 'Justificativa',
      justificationDescription: 'Registrada junto com a transição, para referência futura.',
      confirmAction: 'Confirmar transição',
      confirmingAction: 'Aplicando…',
      cancelAction: 'Cancelar',
      submitSuccess: (targetLabel: string): string => `Risco transicionado para ${targetLabel}.`,
      genericError: 'Não foi possível aplicar a transição. Tente novamente.',
      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    /**
     * The pending-approval CONDITION shown on the lifecycle action bar
     * (full detail: who requested what, and — for an eligible decider —
     * the decide action). This is distinct from `PendingApprovalBadge`
     * (T162), which is only the compact yes/no indicator reused on the
     * register and next to the risk's status.
     */
    pendingApproval: {
      cardTitle: 'Aprovação pendente',
      requestedBy: (name: string): string => `Solicitado por ${name}`,
      requestedAt: (date: string): string => `em ${date}`,
      transitionLabel: (targetLabel: string): string => `Transição solicitada: para ${targetLabel}`,
      justificationLabel: 'Justificativa da solicitação',
      noJustification: 'Nenhuma justificativa informada.',
      /**
       * FR-029a — shown INSTEAD of the decide action when the signed-in
       * user is the requester, never as a disabled/inert button (the
       * decision would be refused server-side either way, but an inert
       * control with no explanation forces the user to guess why).
       */
      selfRequestNotice:
        'Você fez esta solicitação. Por segregação de funções, a decisão precisa ser tomada por outra pessoa com permissão para aprovar.',
      approveAction: 'Aprovar',
      rejectAction: 'Rejeitar',
    },

    requestApprovalDialog: {
      title: (targetLabel: string): string => `Solicitar aprovação para "${targetLabel}"`,
      description: (targetLabel: string): string =>
        `Esta transição exige a decisão de outra pessoa antes de ser aplicada. O risco permanece em seu status atual até que a solicitação seja aprovada ou rejeitada (para: ${targetLabel}).`,
      justificationLabel: 'Justificativa',
      justificationDescription: 'Explique por que esta transição deve ser aprovada.',
      confirmAction: 'Solicitar aprovação',
      confirmingAction: 'Enviando…',
      cancelAction: 'Cancelar',
      submitSuccess: 'Solicitação de aprovação enviada.',
      genericError: 'Não foi possível solicitar a aprovação. Tente novamente.',
      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    /**
     * The decision dialog is deliberately explicit about who requested
     * what and states plainly that the decision is permanent (US6) — a
     * governance record, not a button press.
     */
    decisionDialog: {
      title: {
        APPROVED: 'Aprovar transição',
        REJECTED: 'Rejeitar transição',
      },
      description: (params: {
        requestedByName: string;
        requestedAtLabel: string;
        transitionLabel: string;
      }): string =>
        `Solicitado por ${params.requestedByName} em ${params.requestedAtLabel}, para: ${params.transitionLabel}.`,
      permanentNotice: 'Esta decisão é registrada permanentemente e não poderá ser desfeita.',
      justificationLabel: {
        APPROVED: 'Justificativa',
        REJECTED: 'Justificativa',
      },
      justificationRequiredForRejection: 'Informe a justificativa da rejeição.',
      confirmAction: {
        APPROVED: 'Confirmar aprovação',
        REJECTED: 'Confirmar rejeição',
      },
      confirmingAction: 'Registrando…',
      cancelAction: 'Cancelar',
      submitSuccess: {
        APPROVED: 'Aprovação registrada. A transição foi aplicada.',
        REJECTED: 'Rejeição registrada.',
      },
      genericError: 'Não foi possível registrar a decisão. Tente novamente.',
      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    /** `PendingApprovalBadge`'s (T162) own label — see `PENDING_APPROVAL_LABEL` above for why this is not its own literal. */
    pendingApprovalBadge: {
      label: PENDING_APPROVAL_LABEL,
    },
  },

  /**
   * History (T170, US7, FR-105, ADR-007) — `GET /risks/{riskId}/history`'s
   * merged, chronological account of assessments, treatment decisions,
   * lifecycle transitions, approvals and ownership changes. Feeds
   * `ActivityHistory` (`@pharos/design-system`, T169), which every field
   * below is that component's `ActivityHistoryLabels` (D-10).
   *
   * `recordedAtLabel`/`assertedDateLabel` are the F-9 pair
   * (`docs/deferred-findings.md`) made visible: "Registrado em" names the
   * instant the platform recorded the entry (always present, and what the
   * server orders the timeline by); "Data informada" names the separate,
   * backdateable date an assessor asserts (present only on `ASSESSMENT`
   * entries). The two are never worded to look interchangeable.
   */
  history: {
    cardTitle: 'Histórico do risco',
    cardDescription:
      'Linha do tempo única com avaliações, decisões de tratamento, transições de status, aprovações e alterações de responsável — cada evento mostra quem agiu e quando.',
    caption: 'Histórico do risco',
    loading: 'Carregando histórico…',
    loadError: 'Não foi possível carregar o histórico do risco.',
    empty: 'Nenhum evento registrado ainda.',
    recordedAtLabel: 'Registrado em',
    assertedDateLabel: 'Data informada',
    previousValueLabel: 'Anterior',
    newValueLabel: 'Novo',
    loadMoreLabel: 'Carregar mais',
    loadingMoreLabel: 'Carregando mais…',
    /** Also the `type` filter's option labels — see `RISK_HISTORY_ENTRY_TYPE_LABELS` above. */
    typeLabels: RISK_HISTORY_ENTRY_TYPE_LABELS,
    filter: {
      /** `MultiSelectFilter`'s (`@pharos/design-system`) own trigger/panel accessible name for the `type` query parameter. */
      label: 'Tipo de evento',
    },
  },

  /**
   * Audit (T171, US7, FR-033 to FR-037). `GET /risks/{riskId}/audit-events`
   * — hidden entirely without `audit:view` (`RiskAuditSection`'s own doc
   * comment); `forbidden` below is shown only for the narrow case where a
   * caller's client-side permission snapshot is stale and the server
   * refuses with `403` anyway, never as the normal "you can't see this"
   * path (that path is the tab never rendering at all). Feeds
   * `AuditTimeline` (`@pharos/design-system`, T169) — every field below is
   * that component's `AuditTimelineLabels` (D-10).
   */
  audit: {
    cardTitle: 'Trilha de auditoria',
    cardDescription:
      'Registro completo e imutável de eventos deste risco — quem, quando, o quê e o resultado de cada ação. Nenhum evento pode ser alterado ou excluído.',
    caption: 'Trilha de auditoria',
    loading: 'Carregando trilha de auditoria…',
    loadError: 'Não foi possível carregar a trilha de auditoria.',
    empty: 'Nenhum evento de auditoria registrado ainda.',
    occurredAtLabel: 'Ocorrido em',
    actorLabel: 'Ator',
    entityLabel: 'Entidade',
    notRecordedLabel: 'Não registrado',
    /** An allow-listed array field (`controlsConsidered`/`causes`/`consequences`) that is genuinely empty — distinct from `notRecordedLabel`, which is for an absent value, not an empty collection. See `buildAuditValueResolver`. */
    emptyCollectionLabel: 'Nenhum',
    changedFieldsLabel: 'Campos alterados',
    ipAddressLabel: 'Endereço IP',
    userAgentLabel: 'Navegador/dispositivo',
    correlationIdLabel: 'ID de correlação',
    loadMoreLabel: 'Carregar mais',
    loadingMoreLabel: 'Carregando mais…',
    outcomeLabel: (outcome: string): string =>
      AUDIT_OUTCOME_LABELS[outcome as AuditOutcome] ?? outcome,
    outcomeVariant: auditOutcomeVariant,
    /** `AuditTimelineLabels.fieldLabel` (D-10) — see `auditFieldLabel` above. */
    fieldLabel: auditFieldLabel,
    /**
     * Shown by `buildAuditValueResolver` in place of a name for an id that
     * IS a known reference field (category/type/origin/org unit/user) but
     * is not found in the currently loaded reference data — e.g. a deleted
     * category, or a user outside the caller's current organizational
     * scope. The id itself is included so the raw fact is never hidden
     * from the audit trail, only explained.
     */
    unresolvedReference: (id: string): string => `Registro não encontrado (${id})`,
    /** `RiskAuditSection` calls this once its own reference-data fetch resolves, and passes the result as `AuditTimelineLabels.resolveFieldValue`. See `buildAuditValueResolver`'s own doc comment above. */
    buildValueResolver: buildAuditValueResolver,
    /**
     * Shown only when the section's own fetch comes back `403` despite the
     * tab having rendered (a stale client-side `audit:view` snapshot) —
     * never the normal unauthorized path, which is the tab not existing at
     * all (FR-030, `EntityTabs`'s own `visible` mechanism).
     */
    forbidden: {
      title: 'Sem permissão para ver a trilha de auditoria',
      detail:
        'Você pode ver este risco, mas não tem a permissão necessária para ver sua trilha de auditoria. Se isso não for esperado, procure um administrador.',
    },
  },

  /**
   * Comments (T195, US9, FR-095, FR-098, FR-100, FR-102). Feeds
   * `CommentThread` (`@pharos/design-system`, T194) — every field below is
   * that component's `CommentThreadLabels` (D-10). Withdrawing is audited,
   * never erased (FR-102) — `withdrawConfirm` states that plainly BEFORE
   * the action happens, mirroring `RiskControlsSection`'s own unlink
   * confirmation pattern.
   */
  comments: {
    cardTitle: 'Comentários',
    cardDescription:
      'Observações registradas por quem tem acesso a este risco. Um comentário removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Comentários do risco',
    loading: 'Carregando comentários…',
    loadError: 'Não foi possível carregar os comentários.',
    empty: 'Nenhum comentário registrado ainda.',
    composerLabel: 'Novo comentário',
    composerPlaceholder: 'Escreva um comentário sobre este risco…',
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
   * Attachments (T195, US9, FR-096 to FR-100, FR-102). Feeds `AttachmentList`
   * (`@pharos/design-system`, T194) — every field below is that component's
   * `AttachmentListLabels` (D-10). `allowedTypesHint` states the server's
   * allow-list and size limit (`.env.example`'s `ATTACHMENT_ALLOWED_MIME_TYPES`/
   * `ATTACHMENT_MAX_SIZE_BYTES` defaults, `magic-bytes.ts`) so a user learns
   * the constraint BEFORE attempting an upload, not only after a `422`/`413`
   * refusal (US9 AS3) — `uploadGenericError` is shown only for a failure with
   * no server `detail` at all (e.g. a network error); the server's own
   * pt-BR refusal reason is otherwise surfaced verbatim.
   */
  attachments: {
    cardTitle: 'Anexos',
    cardDescription:
      'Evidências e documentos anexados a este risco. Um anexo removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Anexos do risco',
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

  validation: {
    title: {
      required: 'Informe o título do risco.',
      tooLong: 'O título deve ter no máximo 300 caracteres.',
    },
    description: {
      required: 'Informe a descrição do risco.',
    },
    orgUnit: {
      required: 'Selecione a unidade organizacional.',
    },
    owner: {
      required: 'Selecione o gestor do risco.',
    },
  },
} as const;
