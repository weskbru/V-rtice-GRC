/**
 * T093 — `ReplaceRiskStatementsUseCase`: `PUT /risks/{riskId}/causes` and
 * `PUT /risks/{riskId}/consequences` (FR-057, FR-025, FR-084, ADR-013). One
 * use case for both operations — `contracts/risks.openapi.yaml` declares
 * them with the SAME request/response schema and the SAME prose ("Same
 * replacement, locking and closed-state semantics as causes"), so a second,
 * near-identical class would be exactly the duplication CLAUDE.md §13.8
 * warns against. `kind` selects which risk-owned child table is replaced.
 *
 * ## Why `touchVersion`, not `updateWithVersion` (mirrors
 * `CreateTreatmentActionUseCase`)
 *
 * No column on `RiskCause`/`RiskConsequence` is a `Risk` column, so this
 * still bumps `Risk.version` via `RiskRepositoryPort.touchVersion` alone —
 * every risk-owned-child mutation must advance the shared aggregate-root
 * version (ADR-013, `touchVersion`'s own doc comment) or `If-Match` would
 * never detect two such writes racing each other.
 *
 * ## Replace-then-touch ordering
 *
 * The child rows are replaced FIRST, `touchVersion` second — identical
 * ordering to `CreateTreatmentActionUseCase` (create child, then touch). If
 * `touchVersion` reports `VERSION_CONFLICT`/`NOT_FOUND`, the whole
 * transaction (including the just-replaced child rows) rolls back, so a
 * failed optimistic-lock check never leaves the child table's replacement
 * applied against a version the caller never actually held.
 *
 * ## Audit shape
 *
 * FR-057/CLAUDE.md §8: "a replaced list is a change to the risk" — audited
 * against `AuditEntityType.RISK` (not a per-child-row event; the rows
 * themselves carry no independent identity worth auditing one at a time),
 * with `previousValues`/`newValues` each holding the ordered array of
 * descriptions under the `causes`/`consequences` key
 * (`domain/risk-audit-allowlist.ts` allow-lists both). Skipped entirely when
 * the supplied list is identical (same descriptions, same order) to what
 * was already stored — an idempotent PUT still succeeds (200) but leaves no
 * misleading "nothing changed" audit row, the same rule
 * `UpdateRiskUseCase` already applies to `PATCH`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../domain/risk.entity';

import type { RiskRecord, RiskStatementRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export type RiskStatementKind = 'causes' | 'consequences';

export interface ReplaceRiskStatementsInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly kind: RiskStatementKind;
  /** From the `If-Match` header (ADR-013). */
  readonly expectedVersion: number;
  /** The complete ordered replacement list; an empty array clears it. */
  readonly items: readonly string[];
}

export interface ReplaceRiskStatementsResult {
  readonly items: readonly RiskStatementRecord[];
  readonly risk: RiskRecord;
}

function descriptionsOf(statements: readonly RiskStatementRecord[]): readonly string[] {
  return statements.map((statement) => statement.description);
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

@Injectable()
export class ReplaceRiskStatementsUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: ReplaceRiskStatementsInput): Promise<ReplaceRiskStatementsResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // FR-025/FR-030: scoped read — a risk outside the caller's scope reads
    // as `undefined`, indistinguishable from "does not exist".
    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    // FR-084 — the domain rule, not a controller check. Causes/consequences
    // are business content (`risk.entity.ts`'s own doc comment names them
    // explicitly).
    assertBusinessContentEditable(current.status);

    const previousDescriptions = descriptionsOf(
      input.kind === 'causes' ? current.causes : current.consequences,
    );
    const newDescriptions = input.items;

    return this.transactionRunner.run(async () => {
      const items =
        input.kind === 'causes'
          ? await this.riskRepository.replaceCauses(input.riskId, input.items)
          : await this.riskRepository.replaceConsequences(input.riskId, input.items);

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }

      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      if (!arraysEqual(previousDescriptions, newDescriptions)) {
        await this.auditRecorder.record({
          action: input.kind === 'causes' ? 'risk.causes_replaced' : 'risk.consequences_replaced',
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          actorLabel: actor.fullName,
          previousValues: { [input.kind]: previousDescriptions },
          newValues: { [input.kind]: newDescriptions },
          organizationalUnitId: result.record.orgUnit.id,
        });
      }

      return { items, risk: result.record };
    });
  }
}
