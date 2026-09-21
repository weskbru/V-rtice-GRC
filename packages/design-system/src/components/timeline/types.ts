/**
 * PharosGRC Design System — `ActivityHistory`/`AuditTimeline` shared types
 * (T169, US7).
 *
 * Generic, domain-agnostic timeline primitives: nothing here names "Risk",
 * an assessment, or any other business concept. Risk Management is only the
 * first caller (`risk-history-section.tsx`/`risk-audit-section.tsx`); a
 * future Problems/Incidents module's own history reuses these components
 * unchanged (CLAUDE.md §2, SC-011).
 *
 * Per D-10, every user-facing string is a required prop — never a default,
 * never hardcoded — exactly like `DataTableLabels`/`RiskMatrixLabels`/
 * `RiskScoreLabels`. `apps/web/src/lib/messages/risks.ts` is the one pt-BR
 * source for both `ActivityHistoryLabels` and `AuditTimelineLabels` today.
 */
import type { ErrorStateProblem } from '../error-state';
import type { StatusVariant } from '../status-badge';

// ---------------------------------------------------------------------
// ActivityHistory — a merged, chronological account of domain events
// (e.g. `GET /risks/{riskId}/history`'s `RiskHistoryEntry`).
// ---------------------------------------------------------------------

/**
 * One entry of a merged activity timeline. Every timestamp/value here
 * arrives PRE-FORMATTED for display (a plain string) — this package never
 * parses a date or assumes a locale, exactly like `AssessmentHistory`
 * calling `formatDateOnly()` before handing a value to a table cell.
 */
export interface ActivityHistoryEntry {
  /** Stable identity — used as the React key, never shown. */
  id: string;
  /**
   * The kind of event, already translated for display (e.g. "Avaliação",
   * "Transição de status"). This package has no opinion on what kinds
   * exist — the caller's own enum (`RiskHistoryEntryType` or a future
   * module's own) is entirely outside this component's knowledge.
   */
  kindLabel: string;
  /**
   * The instant the platform RECORDED this entry, already formatted for
   * display (e.g. "05/09/2026 14:32"). Every entry carries this, and the
   * caller is responsible for having already sorted `items` by it — this
   * component never reorders.
   */
  occurredAtLabel: string;
  /**
   * A DIFFERENT, asserter-supplied date this entry claims to reflect —
   * e.g. a backdateable assessment date — already formatted for display.
   * `null`/omitted when this entry carries no separate asserted date.
   *
   * Rendered as its own, separately labeled fact (`ActivityHistoryLabels
   * .assertedDateLabel`), NEVER merged into `occurredAtLabel` into one
   * ambiguous "date" — this is the whole point of the component existing
   * as two fields rather than one (F-9, `docs/deferred-findings.md`): a
   * reviewer must be able to tell "what the platform recorded" from "what
   * the author claims it reflects" without reading documentation.
   */
  assertedDateLabel?: string | null;
  actorName: string;
  /** Human-readable account of what changed, already composed by the caller (e.g. server-supplied `summary`). */
  summary: string;
  /** The value this entry superseded, already formatted for display. Rendered alongside `newValue` as a structured before/after pair — omit both together when there is nothing to compare (e.g. the first entry of its kind). */
  previousValue?: string | null;
  newValue?: string | null;
}

export interface ActivityHistoryLabels {
  /** Visually hidden accessible name for the entry list, e.g. "Histórico do risco". */
  caption: string;
  loading: string;
  loadError: string;
  /** Shown when `items` is empty and there is no error/loading. */
  empty: string;
  /** Chrome label preceding `occurredAtLabel`, e.g. "Registrado em" — the recorded-instant half of the F-9 distinction. */
  recordedAtLabel: string;
  /** Chrome label preceding `assertedDateLabel`, e.g. "Data informada" — the asserted-date half of the F-9 distinction. Only ever shown next to `recordedAtLabel`, never alone, so the two are always read as a contrasting pair. */
  assertedDateLabel: string;
  previousValueLabel: string;
  newValueLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface ActivityHistoryProps {
  /** The current page's entries, in the order to render — already sorted by the caller/server (newest first, per every history endpoint in this project). */
  items: readonly ActivityHistoryEntry[];
  labels: ActivityHistoryLabels;
  isLoading?: boolean;
  /** Renders `ErrorState` instead of the list. */
  error?: ErrorStateProblem;
  /** Whether a further page exists — shows the "load more" control when true. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------
// AuditTimeline — the raw, append-only audit trail
// (e.g. `GET /risks/{riskId}/audit-events`'s `AuditEvent`).
// ---------------------------------------------------------------------

/**
 * One immutable audit entry. `action` and `entityType` are technical
 * identifiers (CLAUDE.md §11.1 — "identificadores de API... nomes de ação
 * de auditoria" stay in English even in a pt-BR interface) and are
 * rendered EXACTLY as given, never translated — an auditor reading this
 * view wants the precise machine-readable action name, not a paraphrase.
 */
export interface AuditTimelineEntry {
  id: string;
  /** Already formatted for display — see `ActivityHistoryEntry.occurredAtLabel`. */
  occurredAtLabel: string;
  /**
   * The acting user's display name as RECORDED at the time of the event
   * (the contract's own `AuditEvent.actorLabel` — "actor name as recorded,
   * so history reads correctly after a rename"), not the live user record.
   * Always a real string, including for a genuine pre-authentication event
   * (e.g. a failed sign-in) — the caller resolves whatever text belongs
   * there; this component never substitutes a fallback of its own.
   */
  actorLabel: string;
  /** Business action, e.g. `risk.accepted` — never a table name (contract's own wording). Shown verbatim. */
  action: string;
  /** Shown verbatim, alongside `entityId` when present. */
  entityType: string;
  entityId?: string | null;
  /** `'SUCCESS' | 'FAILURE' | 'DENIED'` in this project's contract, but left as `string` so a future module's own outcome vocabulary is not constrained by this one. */
  outcome: string;
  /** Allow-listed fields only (server-side guarantee, FR-035) — rendered as a plain field-by-field diff, never assumed to be safe to summarize into prose. */
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId: string;
}

export interface AuditTimelineLabels {
  caption: string;
  loading: string;
  loadError: string;
  empty: string;
  occurredAtLabel: string;
  actorLabel: string;
  entityLabel: string;
  /** Shown when `entityId`/an optional field is absent, e.g. "Não informado". */
  notRecordedLabel: string;
  outcomeLabel: (outcome: string) => string;
  outcomeVariant: (outcome: string) => StatusVariant;
  /** Heading over the previous/new values diff, shown only when at least one of `previousValues`/`newValues` carries a key. */
  changedFieldsLabel: string;
  /**
   * pt-BR label for one changed-field key (e.g. `"categoryId"` ->
   * `"Categoria"`). Required, and MUST always return a string — this
   * component has no notion of "no label for this key"; a key the caller
   * has no translation for is expected to fall back to the raw key itself
   * (the caller's decision, not this component's), so a field the audit
   * payload starts carrying tomorrow (it is `Record<string, unknown>` by
   * contract, FR-035) still renders a row today instead of vanishing.
   */
  fieldLabel: (key: string) => string;
  /**
   * Resolves one changed-field's raw value to a human-readable string for
   * display — e.g. a category id to its name, an enum value to the same
   * pt-BR word the rest of the interface uses for it, a date string to a
   * locale-formatted date. Never called for `null`/`undefined` (those
   * already resolve to `notRecordedLabel` before this is consulted).
   *
   * Optional, and may return `undefined` for any key/value it has no
   * opinion on — this component then falls back to its own generic
   * formatting (the value's own primitive string form, or `JSON.stringify`
   * for an object). That fallback is the mechanism that keeps an unmapped
   * field rendering something rather than nothing; this component has no
   * domain knowledge of what a "category" or a "risk level" is (D-10), so
   * every domain-specific resolution rule lives on the caller's side of
   * this function.
   */
  resolveFieldValue?: (key: string, value: unknown) => string | undefined;
  ipAddressLabel: string;
  userAgentLabel: string;
  correlationIdLabel: string;
  loadMoreLabel: string;
  loadingMoreLabel: string;
}

export interface AuditTimelineProps {
  items: readonly AuditTimelineEntry[];
  labels: AuditTimelineLabels;
  isLoading?: boolean;
  error?: ErrorStateProblem;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}
