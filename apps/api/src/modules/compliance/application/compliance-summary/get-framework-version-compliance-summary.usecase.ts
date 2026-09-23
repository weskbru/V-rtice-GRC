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
