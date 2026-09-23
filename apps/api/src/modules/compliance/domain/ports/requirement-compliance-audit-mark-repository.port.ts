import type { ComplianceAuditMarkObservation } from '../requirement-compliance-audit-mark.entity';
import type { RequirementComplianceState } from '@prisma/client';

export abstract class RequirementComplianceAuditMarkRepositoryPort {
  abstract recordObservation(
    requirementId: string,
    state: RequirementComplianceState,
    observedAt: Date,
  ): Promise<ComplianceAuditMarkObservation>;

  abstract recordObservations(
    entries: readonly {
      readonly requirementId: string;
      readonly state: RequirementComplianceState;
    }[],
    observedAt: Date,
  ): Promise<ReadonlyMap<string, ComplianceAuditMarkObservation>>;
}
