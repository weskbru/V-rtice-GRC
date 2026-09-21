/**
 * T027/T056/004-compliance-management — `ListRequirementsUseCase`: the
 * read side of `GET
 * /frameworks/{frameworkId}/versions/{versionId}/requirements`
 * (`listRequirements` operation). Wired to `RequirementController` by
 * T056 (Fase 5) — see `GetRequirementUseCase`'s own header for why it was
 * built ahead of that wiring.
 *
 * ## `complianceState` filter — compute-then-filter-then-paginate
 *
 * When `complianceStates` is supplied, the contract's own description
 * requires computing `complianceState` for EVERY requirement of the
 * version first (the same bounded, one-version batch the compliance
 * summary endpoint uses, research.md D-10), filtering over that complete
 * set, and only THEN paginating — never filtering within an
 * already-paginated page, which would silently under-report matches on
 * later pages. Absent the filter, this stays the cheap path: one
 * paginated repository read plus a batched derivation for just that page.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type {
  RequirementRecord,
  RequirementRow,
} from '../../domain/ports/requirement-repository.port';
import type { RequirementComplianceState } from '@prisma/client';

export interface ListRequirementsInput {
  readonly frameworkId: string;
  readonly versionId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly complianceStates?: readonly RequirementComplianceState[] | undefined;
}

export interface ListRequirementsResult {
  readonly items: readonly RequirementRecord[];
  readonly total: number;
}

@Injectable()
export class ListRequirementsUseCase {
  constructor(
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {}

  async execute(input: ListRequirementsInput): Promise<ListRequirementsResult> {
    const version = await this.frameworkVersionRepository.findById(input.versionId);
    if (version?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }

    const referenceDate = new Date();

    if (input.complianceStates && input.complianceStates.length > 0) {
      return this.executeFiltered(
        input.versionId,
        input.complianceStates,
        input.page,
        input.pageSize,
        referenceDate,
      );
    }

    const page = await this.requirementRepository.list(input.versionId, input.page, input.pageSize);
    const derivedByRequirementId = await this.complianceReader.deriveForMany(
      page.items,
      referenceDate,
    );

    return {
      items: page.items.map((row) => toRecord(row, derivedByRequirementId)),
      total: page.total,
    };
  }

  private async executeFiltered(
    versionId: string,
    complianceStates: readonly RequirementComplianceState[],
    page: number,
    pageSize: number,
    referenceDate: Date,
  ): Promise<ListRequirementsResult> {
    const allRows = await this.requirementRepository.findAllByFrameworkVersion(versionId);
    const derivedByRequirementId = await this.complianceReader.deriveForMany(
      allRows,
      referenceDate,
    );

    const allowedStates = new Set(complianceStates);
    const matching = allRows.filter((row) =>
      allowedStates.has(derivedByRequirementId.get(row.id)?.complianceState ?? 'NOT_MET'),
    );

    const offset = (page - 1) * pageSize;
    const pageRows = matching.slice(offset, offset + pageSize);

    return {
      items: pageRows.map((row) => toRecord(row, derivedByRequirementId)),
      total: matching.length,
    };
  }
}

function toRecord(
  row: RequirementRow,
  derivedByRequirementId: ReadonlyMap<
    string,
    {
      applicability: RequirementRecord['applicability'];
      complianceState: RequirementComplianceState;
    }
  >,
): RequirementRecord {
  return {
    ...row,
    // Defensive fallback only: `deriveForMany` derives one entry per row
    // it was given, so a missing key here would signal a bug in that
    // method, not a real runtime case.
    ...(derivedByRequirementId.get(row.id) ?? {
      applicability: undefined,
      complianceState: 'NOT_MET' as const,
    }),
  };
}
