/**
 * T027/004-compliance-management — `GetRequirementUseCase`: the read side
 * of `GET /requirements/{requirementId}` (`getRequirement` operation).
 *
 * Not yet wired to any controller in this workstream (Fase 3, User Story
 * 1) — the contract's `Requirement` schema requires `complianceState`, and
 * this operation's own description ties it to the observation-time audit
 * comparison (research.md D-11) that `RequirementComplianceAuditMark`
 * exists for, which is User Story 3's own scope (T049-T052). Building this
 * use case now, unwired, is exactly what T027 of tasks.md asks for
 * ("casos de uso de ... ler ... requisito"); `presentation/requirement
 * .controller.ts` (T056, Fase 5) is what will add the route and the
 * audit-mark side effect on top of it.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { RequirementRecord } from '../../domain/ports/requirement-repository.port';

@Injectable()
export class GetRequirementUseCase {
  constructor(
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {}

  async execute(requirementId: string): Promise<RequirementRecord> {
    const row = await this.requirementRepository.findById(requirementId);
    if (!row) {
      throw new NotFoundDomainError(USER_MESSAGES.compliance.requirementEntityLabel, requirementId);
    }

    const derived = await this.complianceReader.deriveForOne(row.id, new Date());
    return { ...row, ...derived };
  }
}
