/**
 * T166/US7 — `RiskHistoryQueryService`, the sole implementation of
 * `RiskHistoryQueryPort` (`domain/ports/risk-history-query.port.ts`).
 * Backs `GET /risks/{riskId}/history`
 * (`contracts/risks.openapi.yaml`'s `getRiskHistory` operation, ADR-006):
 * "a query over the append-only domain records and the relevant audit
 * entries ... not a stored table".
 *
 * ## F-9 — which timestamp orders the merged timeline, and why
 * (`docs/deferred-findings.md`)
 *
 * Every source this service merges carries a timestamp, but they are not
 * the same KIND of fact:
 *
 * - `RiskAssessment.assessedOn` is a `@db.Date` the ASSESSOR asserts and
 *   can backdate (F-9) — business data, not a record of when the platform
 *   did anything.
 * - `RiskTreatmentDecision.decidedAt`, `RiskLifecycleTransition
 *   .performedAt` and `Approval.requestedAt`/`decidedAt` are all written by
 *   the REPOSITORY as `new Date()` at write time (confirmed by reading
 *   `risk-treatment-decision.repository.ts`, `risk-lifecycle-transition
 *   .repository.ts`, `approval.repository.ts`) — genuine recorded
 *   instants, never user-supplied.
 * - Ownership changes have no dedicated table at all; they are read
 *   straight from `audit_event.occurredAt` (ADR-005's system of record for
 *   "when did this actually happen").
 *
 * **Decision: the merged timeline is ordered by the RECORDED instant,
 * never the asserted one.** For every source except assessments this is
 * already the only timestamp available, so there is nothing to decide. For
 * assessments specifically, this service does NOT sort by `assessedOn` —
 * it joins to the `audit_event` row `CreateAssessmentUseCase` writes in the
 * SAME transaction as the assessment (`action: 'risk.assessed'`,
 * `entityType: RISK_ASSESSMENT`, `entityId: assessment.id`) and orders by
 * THAT row's `occurredAt`. Sorting by an assertable, backdateable date
 * would let an assessor entered today with `assessedOn` set to last month
 * silently jump ahead of everything that happened in between — exactly the
 * "quiet dishonesty" the task brief warns a GRC audit trail cannot afford.
 *
 * **Visibility, not flattening (the task's explicit requirement)**: the
 * asserted date is never discarded — every `ASSESSMENT` entry carries BOTH
 * `occurredAt` (the recorded instant, used for ordering AND rendered as the
 * entry's timeline position) and a separate `assessedOn` field (the
 * asserted business date, `null` for every other entry type). A reader can
 * therefore always tell, for an assessment, "when the platform recorded
 * this" from "the date its author claims it reflects" — the two are never
 * merged into one ambiguous value. This extra field is additive to
 * `contracts/risks.openapi.yaml`'s `RiskHistoryEntry` schema (which sets no
 * `additionalProperties: false`), not a contract change.
 *
 * ## Stable ordering across pages
 *
 * Sort key: `(occurredAt DESC, id DESC)`. `id` is `uuid(7)` on every source
 * table (`schema.prisma`: `@default(uuid(7))`), which is time-ordered and,
 * being a fixed-width, fixed-format string, compares correctly with plain
 * lexicographic `<`/`>` — no parsing needed. Using it as the tiebreaker
 * means two entries that land on the exact same instant (measured
 * `Date.getTime()` millisecond resolution — realistic for, e.g., an
 * approval decision and the lifecycle transition it triggers, written by
 * the SAME request a few statements apart) still sort deterministically
 * and identically on every call, which is what makes offset pagination
 * safe: without a tiebreaker, two rows with an equal `occurredAt` could
 * swap order between the query serving page N and the query serving page
 * N+1, which either drops or duplicates a row at the boundary depending on
 * which way they swap. `test/integration/risk-history.spec.ts` proves this
 * directly with a synthetic tie.
 *
 * ## Why this is five small, indexed, per-risk queries merged in
 * TypeScript, not one big raw-SQL UNION (unlike `risk-query.service.ts`)
 *
 * `risk-query.service.ts`'s raw-SQL approach exists because THAT query
 * scans up to 50,000 register rows and needs the trigram index / a single
 * query plan. This service's five sources are each bounded by ONE risk's
 * own lifetime activity (assessments, decisions, transitions and approvals
 * a single risk accumulates — realistically dozens, not tens of
 * thousands), each already served by an existing, indexed, per-risk
 * repository method (`RiskAssessmentRepositoryPort.listByRisk`,
 * `RiskTreatmentDecisionRepositoryPort.listByRisk`,
 * `RiskLifecycleTransitionRepositoryPort.listByRisk` (added by this task —
 * no such method existed), `ApprovalRepositoryPort.listByEntity`) plus two
 * small `audit_event` reads keyed on its own `(entityType, entityId,
 * occurredAt DESC)` index. Merging small, already-correct, already-tested
 * sources in memory is less code and less risk than re-deriving every
 * join/actor-resolution these repositories already do, for a volume where
 * raw SQL buys no measurable performance (see the implementation report's
 * `EXPLAIN (ANALYZE, BUFFERS)` transcript). If a risk's history ever grows
 * large enough for this to matter, that is a `LIMIT`/pushdown optimization
 * to make then, not a reason to duplicate five repositories' logic now
 * (CLAUDE.md: "não criar abstrações prematuras").
 *
 * ## Scope
 *
 * No `ScopeFilter` parameter here (see `RiskHistoryQueryPort`'s own doc
 * comment) — `GetRiskHistoryUseCase` has already resolved and
 * scope-checked the parent risk via `RiskRepositoryPort.findById` before
 * this service is ever called, exactly like every other risk-child
 * repository in this module.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ApprovalRepositoryPort } from '../domain/ports/approval-repository.port';
import { RiskAssessmentRepositoryPort } from '../domain/ports/risk-assessment-repository.port';
import { RiskHistoryQueryPort } from '../domain/ports/risk-history-query.port';
import { RiskLifecycleTransitionRepositoryPort } from '../domain/ports/risk-lifecycle-transition-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';

import type { RiskLevelValue } from '../domain/methodology.schema';
import type { ApprovalRecord } from '../domain/ports/approval-repository.port';
import type { AssessmentRecord } from '../domain/ports/risk-assessment-repository.port';
import type {
  RiskHistoryEntryRecord,
  RiskHistoryPage,
  RiskHistoryQuery,
} from '../domain/ports/risk-history-query.port';
import type { LifecycleTransitionRecord } from '../domain/ports/risk-lifecycle-transition-repository.port';
import type { TreatmentDecisionRecord } from '../domain/ports/risk-treatment-decision-repository.port';
import type { RiskStatus } from '@prisma/client';

/** Comfortably exceeds any plausible single risk's lifetime total of
 * assessments/decisions (a human-cadenced review activity, not a
 * per-request one) while still bounding the query — see this file's header
 * for why an unpaginated-in-practice read of these two sources is safe. */
const ALL_ROWS_PAGE_SIZE = 10_000;

const LEVEL_LABELS = USER_MESSAGES.risk.history.levelLabels;
const STATUS_LABELS = USER_MESSAGES.risk.history.statusLabels;
const STRATEGY_LABELS = USER_MESSAGES.risk.history.treatmentStrategyLabels;
const APPROVAL_STATUS_LABELS = USER_MESSAGES.risk.history.approvalStatusLabels;

interface AssessmentAuditRow {
  readonly entity_id: string;
  readonly occurred_at: Date;
}

interface OwnershipChangeAuditRow {
  readonly id: string;
  readonly occurred_at: Date;
  readonly actor_user_id: string | null;
  readonly actor_label: string;
  readonly previous_owner_id: string | null;
  readonly new_owner_id: string;
}

interface UserNameRow {
  readonly id: string;
  readonly full_name: string;
}

@Injectable()
export class RiskHistoryQueryService implements RiskHistoryQueryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentRepository: RiskAssessmentRepositoryPort,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly transitionRepository: RiskLifecycleTransitionRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
  ) {}

  async getHistory(query: RiskHistoryQuery): Promise<RiskHistoryPage> {
    const [assessmentPage, decisionPage, transitions, approvals] = await Promise.all([
      this.assessmentRepository.listByRisk(query.riskId, 1, ALL_ROWS_PAGE_SIZE),
      this.treatmentDecisionRepository.listByRisk(query.riskId, 1, ALL_ROWS_PAGE_SIZE),
      this.transitionRepository.listByRisk(query.riskId),
      this.approvalRepository.listByEntity('RISK', query.riskId),
    ]);

    const [assessmentAuditTimestamps, ownershipEntries] = await Promise.all([
      this.loadAssessmentRecordedAt(assessmentPage.items.map((a) => a.id)),
      this.loadOwnershipChanges(query.riskId),
    ]);

    const entries: RiskHistoryEntryRecord[] = [];

    entries.push(...this.buildAssessmentEntries(assessmentPage.items, assessmentAuditTimestamps));
    entries.push(...decisionPage.items.map((decision) => this.buildDecisionEntry(decision)));
    entries.push(...transitions.map((transition) => this.buildTransitionEntry(transition)));
    for (const approval of approvals) {
      entries.push(this.buildApprovalRequestedEntry(approval));
      if (approval.status !== 'PENDING') {
        entries.push(this.buildApprovalDecidedEntry(approval));
      }
    }
    entries.push(...ownershipEntries);

    const filtered =
      query.types && query.types.length > 0
        ? entries.filter((entry) => query.types!.includes(entry.type))
        : entries;

    filtered.sort(compareEntriesNewestFirst);

    const total = filtered.length;
    const offset = (query.page - 1) * query.pageSize;
    const items = filtered.slice(offset, offset + query.pageSize);

    return { items, total };
  }

  private buildAssessmentEntries(
    assessments: readonly AssessmentRecord[],
    recordedAtByAssessmentId: ReadonlyMap<string, Date>,
  ): readonly RiskHistoryEntryRecord[] {
    const byId = new Map(assessments.map((a) => [a.id, a]));

    return assessments.map((assessment) => {
      const previous = assessment.previousAssessmentId
        ? byId.get(assessment.previousAssessmentId)
        : undefined;
      // Fallback to `assessedOn` only in the theoretical case the
      // transactionally-coupled `risk.assessed` audit row is somehow
      // missing (ADR-005 guarantees it never is) — never silently drop the
      // entry from the timeline.
      const recordedAt = recordedAtByAssessmentId.get(assessment.id) ?? assessment.assessedOn;

      return {
        id: assessment.id,
        type: 'ASSESSMENT',
        occurredAt: recordedAt,
        assessedOn: assessment.assessedOn,
        actor: { id: assessment.assessedBy.id, fullName: assessment.assessedBy.fullName },
        summary: USER_MESSAGES.risk.history.assessmentRecorded(
          levelLabel(assessment.residualLevel),
          levelLabel(assessment.inherentLevel),
        ),
        previousValue: previous ? levelLabel(previous.residualLevel) : null,
        newValue: levelLabel(assessment.residualLevel),
        referenceId: assessment.id,
      };
    });
  }

  private buildDecisionEntry(decision: TreatmentDecisionRecord): RiskHistoryEntryRecord {
    return {
      id: decision.id,
      type: 'TREATMENT_DECISION',
      occurredAt: decision.decidedAt,
      assessedOn: null,
      actor: { id: decision.decidedBy.id, fullName: decision.decidedBy.fullName },
      summary: USER_MESSAGES.risk.history.treatmentDecisionRecorded(
        STRATEGY_LABELS[decision.strategy],
      ),
      previousValue: null,
      newValue: STRATEGY_LABELS[decision.strategy],
      referenceId: decision.id,
    };
  }

  private buildTransitionEntry(transition: LifecycleTransitionRecord): RiskHistoryEntryRecord {
    return {
      id: transition.id,
      type: 'LIFECYCLE_TRANSITION',
      occurredAt: transition.performedAt,
      assessedOn: null,
      actor: { id: transition.performedBy.id, fullName: transition.performedBy.fullName },
      summary: USER_MESSAGES.risk.history.lifecycleTransitionOccurred(
        STATUS_LABELS[transition.fromStatus],
        STATUS_LABELS[transition.toStatus],
      ),
      previousValue: STATUS_LABELS[transition.fromStatus],
      newValue: STATUS_LABELS[transition.toStatus],
      referenceId: transition.id,
    };
  }

  private buildApprovalRequestedEntry(approval: ApprovalRecord): RiskHistoryEntryRecord {
    const toStatus = parseRequestedTransitionTarget(approval.requestedTransition);
    return {
      id: approval.id,
      type: 'APPROVAL',
      occurredAt: approval.requestedAt,
      assessedOn: null,
      actor: { id: approval.requestedBy.id, fullName: approval.requestedBy.fullName },
      summary: USER_MESSAGES.risk.history.approvalRequested(STATUS_LABELS[toStatus]),
      previousValue: APPROVAL_STATUS_LABELS.PENDING,
      newValue: STATUS_LABELS[toStatus],
      referenceId: approval.id,
    };
  }

  private buildApprovalDecidedEntry(approval: ApprovalRecord): RiskHistoryEntryRecord {
    const toStatus = parseRequestedTransitionTarget(approval.requestedTransition);
    const approved = approval.status === 'APPROVED';
    // `decidedBy`/`decidedAt` are non-null here — this is only ever called
    // for an approval whose `status !== 'PENDING'` (`getHistory` above),
    // and `ApprovalRepositoryPort.decide` always sets both together.
    return {
      id: approval.id,
      type: 'APPROVAL',
      occurredAt: approval.decidedAt!,
      assessedOn: null,
      actor: { id: approval.decidedBy!.id, fullName: approval.decidedBy!.fullName },
      summary: approved
        ? USER_MESSAGES.risk.history.approvalApproved(STATUS_LABELS[toStatus])
        : USER_MESSAGES.risk.history.approvalRejected,
      previousValue: APPROVAL_STATUS_LABELS.PENDING,
      newValue: APPROVAL_STATUS_LABELS[approval.status],
      referenceId: approval.id,
    };
  }

  private async loadAssessmentRecordedAt(
    assessmentIds: readonly string[],
  ): Promise<ReadonlyMap<string, Date>> {
    if (assessmentIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.client.$queryRaw<AssessmentAuditRow[]>(Prisma.sql`
      SELECT entity_id, occurred_at
      FROM audit_event
      WHERE entity_type = 'RISK_ASSESSMENT'::"AuditEntityType"
        AND action = 'risk.assessed'
        AND entity_id = ANY(${assessmentIds}::uuid[])
    `);

    return new Map(rows.map((row) => [row.entity_id, row.occurred_at]));
  }

  /** FR-105/ADR-006 — ownership changes have no dedicated table; read
   * straight from the allow-listed `ownerUserId` diff `UpdateRiskUseCase`
   * writes into `audit_event` (`risk-audit-allowlist.ts` allow-lists
   * `ownerUserId` for `AuditEntityType.RISK`). `new_values ? 'ownerUserId'`
   * (the JSONB "has key" operator) is exactly the predicate
   * `UpdateRiskUseCase` guarantees true iff the owner genuinely changed —
   * that use case only ever writes the key when
   * `input.ownerUserId !== current.owner.id`. */
  private async loadOwnershipChanges(riskId: string): Promise<readonly RiskHistoryEntryRecord[]> {
    const rows = await this.prisma.client.$queryRaw<OwnershipChangeAuditRow[]>(Prisma.sql`
      SELECT id, occurred_at, actor_user_id, actor_label,
             previous_values ->> 'ownerUserId' AS previous_owner_id,
             new_values ->> 'ownerUserId' AS new_owner_id
      FROM audit_event
      WHERE entity_type = 'RISK'::"AuditEntityType"
        AND entity_id = ${riskId}::uuid
        AND action = 'risk.updated'
        AND new_values ? 'ownerUserId'
    `);

    if (rows.length === 0) {
      return [];
    }

    const ownerIds = new Set<string>();
    for (const row of rows) {
      if (row.previous_owner_id) {
        ownerIds.add(row.previous_owner_id);
      }
      ownerIds.add(row.new_owner_id);
    }
    const namesById = await this.loadUserNames(Array.from(ownerIds));

    return rows.map((row) => {
      const previousName = row.previous_owner_id ? namesById.get(row.previous_owner_id) : undefined;
      const newName = namesById.get(row.new_owner_id) ?? row.new_owner_id;
      // `actor_user_id` is nullable in `audit_event` only for
      // pre-authentication events (data-model.md §5's own note); a
      // `risk.updated` action is always written by an authenticated actor
      // inside `UpdateRiskUseCase` — a null here would be a genuine data
      // anomaly worth surfacing loudly rather than papering over.
      if (!row.actor_user_id) {
        throw new Error(
          `audit_event ${row.id} (action risk.updated) has no actorUserId — invariant violated.`,
        );
      }

      return {
        id: row.id,
        type: 'OWNERSHIP_CHANGE',
        occurredAt: row.occurred_at,
        assessedOn: null,
        actor: { id: row.actor_user_id, fullName: row.actor_label },
        summary: previousName
          ? USER_MESSAGES.risk.history.ownershipChanged(previousName, newName)
          : USER_MESSAGES.risk.history.ownershipSet(newName),
        previousValue: previousName ?? null,
        newValue: newName,
        referenceId: null,
      } satisfies RiskHistoryEntryRecord;
    });
  }

  private async loadUserNames(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.client.$queryRaw<UserNameRow[]>(Prisma.sql`
      SELECT id, full_name FROM users WHERE id = ANY(${ids}::uuid[])
    `);
    return new Map(rows.map((row) => [row.id, row.full_name]));
  }
}

function levelLabel(level: RiskLevelValue): string {
  return LEVEL_LABELS[level];
}

/** `Approval.requestedTransition` is always written by
 * `RequestApprovalUseCase` as `${fromStatus}->${toStatus}` — the same
 * parsing `DecideApprovalUseCase` performs (see that file's own
 * `parseRequestedTransitionTarget`); duplicated here rather than imported
 * because that one is a private, unexported function of a different
 * use case, not a shared utility. */
function parseRequestedTransitionTarget(requestedTransition: string): RiskStatus {
  const [, toStatus] = requestedTransition.split('->');
  return toStatus as RiskStatus;
}

function compareEntriesNewestFirst(a: RiskHistoryEntryRecord, b: RiskHistoryEntryRecord): number {
  const byTime = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  // Stable tiebreak (this file's header, "Stable ordering across pages"):
  // `id` is `uuid(7)` on every source table, so plain string comparison is
  // both deterministic and (approximately) time-ordered.
  if (a.id === b.id) {
    return 0;
  }
  return a.id > b.id ? -1 : 1;
}
