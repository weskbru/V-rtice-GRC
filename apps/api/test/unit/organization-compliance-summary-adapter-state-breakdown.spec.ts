import { describe, expect, it, vi } from 'vitest';

import { OrganizationComplianceSummaryAdapter } from '../../src/modules/compliance/infrastructure/organization-compliance-summary.adapter';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { ControlDirectoryPort } from '../../src/shared/grc-ports/control-directory.port';
import type { ControlEffectivenessPort } from '../../src/shared/grc-ports/control-effectiveness.port';

function buildPrisma(options: {
  readonly requirementIds: readonly string[];
  readonly notApplicableIds: readonly string[];
  readonly linksByRequirement: Readonly<Record<string, readonly string[]>>;
}): PrismaService {
  const linkRows = Object.entries(options.linksByRequirement).flatMap(
    ([requirementId, controlIds]) => controlIds.map((controlId) => ({ requirementId, controlId })),
  );

  return {
    client: {
      requirement: {
        findMany: vi.fn().mockResolvedValue(options.requirementIds.map((id) => ({ id }))),
      },
      requirementApplicabilityDeclaration: {
        findMany: vi
          .fn()
          .mockResolvedValue(options.notApplicableIds.map((requirementId) => ({ requirementId }))),
      },
      requirementControlLink: {
        findMany: vi.fn().mockResolvedValue(linkRows),
      },
    },
  } as unknown as PrismaService;
}

describe('OrganizationComplianceSummaryAdapter', () => {
  it('getStateBreakdown zero-fills every RequirementComplianceState and byState sums to requirementCount, agreeing with getOrganizationWideCompliancePercentage over the same data', async () => {
    const prisma = buildPrisma({
      requirementIds: ['req-na', 'req-compliant', 'req-notmet'],
      notApplicableIds: ['req-na'],
      linksByRequirement: { 'req-compliant': ['ctl-1'] },
    });
    const controlDirectory = {
      findManyById: vi.fn().mockResolvedValue([{ id: 'ctl-1', isActive: true }]),
    } as unknown as ControlDirectoryPort;
    const controlEffectiveness = {
      getEffectivenessBatch: vi.fn().mockResolvedValue(new Map([['ctl-1', 'EFFECTIVE']])),
    } as unknown as ControlEffectivenessPort;

    const adapter = new OrganizationComplianceSummaryAdapter(
      prisma,
      controlDirectory,
      controlEffectiveness,
    );

    const breakdown = await adapter.getStateBreakdown();
    const percentage = await adapter.getOrganizationWideCompliancePercentage();

    expect(breakdown.requirementCount).toBe(3);
    expect(breakdown.byState).toEqual({
      NOT_APPLICABLE: 1,
      NOT_MET: 1,
      NOT_PROVEN: 0,
      PARTIALLY_MET: 0,
      COMPLIANT: 1,
    });
    const stateSum = Object.values(breakdown.byState).reduce((a, b) => a + b, 0);
    expect(stateSum).toBe(breakdown.requirementCount);

    expect(percentage).toBe(50);
  });

  it('getStateBreakdown returns a genuine all-zero breakdown — never undefined — when there are no PUBLISHED requirements at all, unlike the percentage method', async () => {
    const prisma = buildPrisma({
      requirementIds: [],
      notApplicableIds: [],
      linksByRequirement: {},
    });
    const controlDirectory = {
      findManyById: vi.fn(),
    } as unknown as ControlDirectoryPort;
    const controlEffectiveness = {
      getEffectivenessBatch: vi.fn(),
    } as unknown as ControlEffectivenessPort;

    const adapter = new OrganizationComplianceSummaryAdapter(
      prisma,
      controlDirectory,
      controlEffectiveness,
    );

    const breakdown = await adapter.getStateBreakdown();
    const percentage = await adapter.getOrganizationWideCompliancePercentage();

    expect(breakdown).toEqual({
      requirementCount: 0,
      byState: { NOT_APPLICABLE: 0, NOT_MET: 0, NOT_PROVEN: 0, PARTIALLY_MET: 0, COMPLIANT: 0 },
    });
    expect(percentage).toBeUndefined();
  });
});
