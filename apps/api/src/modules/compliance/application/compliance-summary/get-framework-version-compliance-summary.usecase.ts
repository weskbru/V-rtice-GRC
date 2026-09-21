/**
 * T054/004-compliance-management, User Story 3 —
 * `GetFrameworkVersionComplianceSummaryUseCase`. `GET
 * /frameworks/{frameworkId}/versions/{versionId}/compliance-summary`
 * (`getFrameworkVersionComplianceSummary` operation, FR-020, research.md
 * D-8/D-10).
 *
 * ## One calculator, aggregated — never a second rule
 *
 * `RequirementComplianceReaderService.deriveForMany` (D-8's single
 * calculator, batched per D-10) computes every requirement's own
 * `complianceState` first; this use case does nothing but TALLY that
 * already-computed value into `counts`, plus the two headline numbers.
 * `counts.notApplicable` and the other four buckets are simply how many
 * requirements landed in each of the five states `calculateRequirementComplianceState`
 * can ever return — there is no extra "is this one applicable" filter
 * step, because `NOT_APPLICABLE` and the other four states are already
 * mutually exclusive by construction (D-8's own branches).
 *
 * `applicableRequirementCount = totalRequirements - counts.notApplicable`
 * and `compliancePercentage = counts.compliant / applicableRequirementCount
 * * 100`, `null` when that denominator is zero (FR-020's own "nada a
 * medir ainda" — never `0`, which would assert zero compliance, nor `100`).
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { FrameworkVersionRecord } from '../../domain/ports/framework-version-repository.port';
import type { RequirementComplianceState } from '@prisma/client';

export interface ComplianceSummaryCounts {
  readonly notApplicable: number;
  readonly notMet: number;
  readonly notProven: number;
  readonly partiallyMet: number;
  readonly compliant: number;
}

export interface ComplianceSummaryResult {
  readonly frameworkVersion: Pick<FrameworkVersionRecord, 'id' | 'label' | 'status'>;
  readonly totalRequirements: number;
  readonly applicableRequirementCount: number;
  readonly counts: ComplianceSummaryCounts;
  readonly compliancePercentage: number | undefined;
  readonly computedAt: Date;
}

const EMPTY_COUNTS: ComplianceSummaryCounts = {
  notApplicable: 0,
  notMet: 0,
  notProven: 0,
  partiallyMet: 0,
  compliant: 0,
};

const COUNT_KEY_BY_STATE: Record<RequirementComplianceState, keyof ComplianceSummaryCounts> = {
  NOT_APPLICABLE: 'notApplicable',
  NOT_MET: 'notMet',
  NOT_PROVEN: 'notProven',
  PARTIALLY_MET: 'partiallyMet',
  COMPLIANT: 'compliant',
};

export interface GetFrameworkVersionComplianceSummaryInput {
  readonly frameworkId: string;
  readonly versionId: string;
}

@Injectable()
export class GetFrameworkVersionComplianceSummaryUseCase {
  constructor(
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {}

  async execute(
    input: GetFrameworkVersionComplianceSummaryInput,
  ): Promise<ComplianceSummaryResult> {
    const version = await this.frameworkVersionRepository.findById(input.versionId);
    if (version?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }

    const rows = await this.requirementRepository.findAllByFrameworkVersion(input.versionId);
    const computedAt = new Date();

    const counts: Record<keyof ComplianceSummaryCounts, number> = { ...EMPTY_COUNTS };
    if (rows.length > 0) {
      const derived = await this.complianceReader.deriveForMany(rows, computedAt);
      for (const fields of derived.values()) {
        const key = COUNT_KEY_BY_STATE[fields.complianceState];
        counts[key] += 1;
      }
    }

    const totalRequirements = rows.length;
    const applicableRequirementCount = totalRequirements - counts.notApplicable;
    const compliancePercentage =
      applicableRequirementCount > 0
        ? (counts.compliant / applicableRequirementCount) * 100
        : undefined;

    return {
      frameworkVersion: { id: version.id, label: version.label, status: version.status },
      totalRequirements,
      applicableRequirementCount,
      counts,
      compliancePercentage,
      computedAt,
    };
  }
}
