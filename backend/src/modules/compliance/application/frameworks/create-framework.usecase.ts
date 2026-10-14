import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { EntityCodeGeneratorPort } from '../../../../grc/shared/domain/ports/entity-code-generator.port';
import { UnauthorizedDomainError } from '../../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerComplianceAuditAllowlists } from '../../domain/compliance-audit-allowlist';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { FrameworkRepositoryPort } from '../../domain/ports/framework-repository.port';

import type { FrameworkRecord } from '../../domain/framework.entity';
import type { FrameworkOrigin } from '@prisma/client';

export interface CreateFrameworkInput {
  readonly actorUserId: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
}

@Injectable()
export class CreateFrameworkUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkRepository: FrameworkRepositoryPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: CreateFrameworkInput): Promise<FrameworkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('FMK', codeYear);

      const record = await this.frameworkRepository.create({
        code,
        name: input.name,
        description: input.description,
        origin: input.origin,
      });

      await this.auditRecorder.record({
        action: 'framework.created',
        entityType: AuditEntityType.FRAMEWORK,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          name: input.name,
          description: input.description,
          origin: input.origin,
        },
      });

      return record;
    });
  }
}
