import type { RequirementComplianceState } from '@prisma/client';

export type ComplianceAuditMarkObservation =
  | { readonly outcome: 'CREATED' }
  | { readonly outcome: 'UNCHANGED' }
  | { readonly outcome: 'CHANGED'; readonly previousState: RequirementComplianceState };
