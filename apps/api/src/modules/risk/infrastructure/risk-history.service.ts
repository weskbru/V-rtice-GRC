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

function parseRequestedTransitionTarget(requestedTransition: string): RiskStatus {
  const [, toStatus] = requestedTransition.split('->');
  return toStatus as RiskStatus;
}

function compareEntriesNewestFirst(a: RiskHistoryEntryRecord, b: RiskHistoryEntryRecord): number {
  const byTime = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id > b.id ? -1 : 1;
}
