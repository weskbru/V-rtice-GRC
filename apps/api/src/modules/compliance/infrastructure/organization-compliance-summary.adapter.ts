/**
 * 009-indicators-reports, T021 — the sole implementation of
 * `ComplianceSummaryPort`
 * (`shared/grc-ports/compliance-summary.port.ts`). Self-contained,
 * Prisma-backed adapter mirroring `PrismaControlEffectivenessAdapter`'s own
 * shape (`modules/controls/infrastructure/control-effectiveness.adapter.ts`):
 * a fresh set of batched Prisma reads, plus the SAME pure domain calculator
 * `GetFrameworkVersionComplianceSummaryUseCase` uses
 * (`calculateRequirementComplianceState`,
 * `domain/requirement-compliance.service.ts`) — never a second compliance
 * rule.
 *
 * ## Why this does not inject `RequirementComplianceReaderService`/
 * `GetFrameworkVersionComplianceSummaryUseCase` directly
 *
 * Both are providers of `ComplianceModule` itself (not `@Global()`), and
 * `RequirementComplianceReaderService` additionally depends on
 * `AuditRecorder`/`TransactionRunnerPort`/
 * `RequirementComplianceAuditMarkRepositoryPort` — reusing them here would
 * require this port's own tiny `@Global()` wiring module
 * (`compliance-summary.module.ts`) to import the ENTIRE `ComplianceModule`,
 * exactly the "modules/indicators ends up importing ComplianceModule's own
 * controllers/use cases" shape `control-effectiveness.module.ts`'s header
 * documents avoiding. Every other cross-module boundary port in this
 * codebase (`PrismaControlEffectivenessAdapter`,
 * `PrismaIncidentDirectoryAdapter`, `IndicatorsModule`'s own new metrics
 * adapters, T020/T024/T025/T027/T028) makes the identical choice: a fresh,
 * self-contained Prisma-backed class over reusing another module's
 * already-wired application service.
 *
 * **Trade-off, reported rather than hidden**: research.md D-11 (of
 * `004-compliance-management`) records the requirement-level compliance
 * "observation audit mark" comparison as running on every read that
 * EXPOSES a requirement's `complianceState` — this aggregate read does
 * not trigger it, because it never goes through
 * `RequirementComplianceReaderService`. This organization-wide rollup
 * exposes only an aggregate PERCENTAGE, never a per-requirement
 * `complianceState` value, which is a materially weaker exposure than
 * `GET /requirements/{id}` or the per-version compliance summary — the
 * coordinator should confirm this is acceptable, or ask for this adapter
 * to route through the reader service instead (at the cost of the module
 * -import shape above).
 *
 * ## The three reads, one calculator
 *
 * 1. every `Requirement.id` whose `frameworkVersion.status = 'PUBLISHED'`;
 * 2. `RequirementApplicabilityDeclaration` rows still active
 *    (`revokedAt: null`) for those ids — the SAME predicate
 *    `RequirementRepository.findActiveApplicabilityMany` uses;
 * 3. `RequirementControlLink` rows still active (`unlinkedAt: null`) for
 *    those ids — the SAME predicate
 *    `RequirementRepository.findActiveLinkedControlIdsMany` uses.
 *
 * Every linked control's `isActive`/effectiveness is then resolved via the
 * SAME two cross-module ports `RequirementComplianceReaderService` itself
 * depends on (`ControlDirectoryPort`, `ControlEffectivenessPort`, both
 * `@Global()` already), and `calculateRequirementComplianceState` is
 * called once per requirement — identical inputs, identical function,
 * identical output to what the per-version summary would compute for the
 * same rows.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  ComplianceSummaryPort,
  type ComplianceStateBreakdown,
} from '../../../shared/grc-ports/compliance-summary.port';
import { ControlDirectoryPort } from '../../../shared/grc-ports/control-directory.port';
import { ControlEffectivenessPort } from '../../../shared/grc-ports/control-effectiveness.port';
import { calculateRequirementComplianceState } from '../domain/requirement-compliance.service';

import type { ControlDirectoryEntry } from '../../../shared/grc-ports/control-directory.port';
import type { ControlEffectivenessLevel } from '../../../shared/grc-ports/control-effectiveness.port';
import type { LinkedControlComplianceInput } from '../domain/requirement-compliance.service';
import type { RequirementComplianceState } from '@prisma/client';

/** Zero-filled skeleton for `ComplianceStateBreakdown.byState` — every
 * `RequirementComplianceState` value present, even when
 * `computeRequirementStates` below never produces one. */
const EMPTY_STATE_COUNTS: Readonly<Record<RequirementComplianceState, number>> = {
  NOT_APPLICABLE: 0,
  NOT_MET: 0,
  NOT_PROVEN: 0,
  PARTIALLY_MET: 0,
  COMPLIANT: 0,
};

@Injectable()
export class OrganizationComplianceSummaryAdapter implements ComplianceSummaryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly controlEffectiveness: ControlEffectivenessPort,
  ) {}

  async getOrganizationWideCompliancePercentage(): Promise<number | undefined> {
    const { states } = await this.computeRequirementStates();
    if (states.length === 0) {
      return undefined;
    }

    const applicableStates = states.filter((state) => state !== 'NOT_APPLICABLE');
    if (applicableStates.length === 0) {
      return undefined;
    }

    const compliantCount = applicableStates.filter((state) => state === 'COMPLIANT').length;
    return (compliantCount / applicableStates.length) * 100;
  }

  async getStateBreakdown(): Promise<ComplianceStateBreakdown> {
    const { states } = await this.computeRequirementStates();

    const byState: Record<RequirementComplianceState, number> = { ...EMPTY_STATE_COUNTS };
    for (const state of states) {
      byState[state] += 1;
    }

    return { requirementCount: states.length, byState };
  }

  /**
   * The single calculation both public methods above derive their own
   * answer from (CLAUDE.md §19.7) — one `RequirementComplianceState` per
   * requirement of a `PUBLISHED` `FrameworkVersion`, in no particular
   * order. Exactly the same three reads and the same
   * `calculateRequirementComplianceState` call this adapter always made;
   * only the RETURN shape changed (every state kept, not just a compliant
   * tally) so a second caller (`getStateBreakdown`) can derive its own
   * aggregate from the identical per-requirement result rather than
   * re-running the query with different inclusion rules.
   */
  private async computeRequirementStates(): Promise<{
    readonly states: readonly RequirementComplianceState[];
  }> {
    const requirements = await this.prisma.client.requirement.findMany({
      where: { frameworkVersion: { status: 'PUBLISHED' } },
      select: { id: true },
    });
    if (requirements.length === 0) {
      return { states: [] };
    }
    const requirementIds = requirements.map((row) => row.id);

    const [applicabilityRows, linkRows] = await Promise.all([
      this.prisma.client.requirementApplicabilityDeclaration.findMany({
        where: { requirementId: { in: requirementIds }, revokedAt: null },
        select: { requirementId: true },
      }),
      this.prisma.client.requirementControlLink.findMany({
        where: { requirementId: { in: requirementIds }, unlinkedAt: null },
        select: { requirementId: true, controlId: true },
      }),
    ]);

    const notApplicableIds = new Set(applicabilityRows.map((row) => row.requirementId));

    const controlIdsByRequirement = new Map<string, string[]>();
    for (const row of linkRows) {
      const bucket = controlIdsByRequirement.get(row.requirementId);
      if (bucket) {
        bucket.push(row.controlId);
      } else {
        controlIdsByRequirement.set(row.requirementId, [row.controlId]);
      }
    }

    const allControlIds = Array.from(new Set(linkRows.map((row) => row.controlId)));
    const referenceDate = new Date();
    let directoryEntries: readonly ControlDirectoryEntry[] = [];
    let effectivenessByControlId: ReadonlyMap<string, ControlEffectivenessLevel> = new Map();
    if (allControlIds.length > 0) {
      [directoryEntries, effectivenessByControlId] = await Promise.all([
        this.controlDirectory.findManyById(allControlIds),
        this.controlEffectiveness.getEffectivenessBatch(allControlIds, referenceDate),
      ]);
    }
    const directoryById = new Map(directoryEntries.map((entry) => [entry.id, entry]));

    const states: RequirementComplianceState[] = [];
    for (const requirementId of requirementIds) {
      if (notApplicableIds.has(requirementId)) {
        states.push('NOT_APPLICABLE');
        continue;
      }

      const controlIds = controlIdsByRequirement.get(requirementId) ?? [];
      const linkedControls: LinkedControlComplianceInput[] = controlIds.map((controlId) => ({
        isActive: directoryById.get(controlId)?.isActive ?? false,
        effectiveness: effectivenessByControlId.get(controlId) ?? 'NOT_ASSESSED',
      }));

      states.push(calculateRequirementComplianceState('APPLICABLE', linkedControls));
    }

    return { states };
  }
}
