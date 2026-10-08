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
