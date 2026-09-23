import type { EvidenceSubjectType } from '@prisma/client';

export interface EvidenceSubjectAccess {
  readonly organizationalUnitId: string;
  readonly label: string;
}

export interface EvidenceSubjectAccessor {
  resolveViewableSubject(actorUserId: string, subjectId: string): Promise<EvidenceSubjectAccess>;
}

export class EvidenceSubjectTypeNotRegisteredError extends Error {
  constructor(subjectType: string) {
    super(
      `No evidence-subject accessor is registered for "${subjectType}". Register one with ` +
        "registerEvidenceSubjectResolver(...) from the owning module's own composition root " +
        '(see grc/shared/domain/ports/evidence-subject-resolver.port.ts).',
    );
    this.name = 'EvidenceSubjectTypeNotRegisteredError';
  }
}

const registry = new Map<EvidenceSubjectType, EvidenceSubjectAccessor>();

export function registerEvidenceSubjectResolver(
  subjectType: EvidenceSubjectType,
  accessor: EvidenceSubjectAccessor,
): void {
  if (registry.has(subjectType)) {
    throw new Error(
      `Evidence subject type "${subjectType}" is already registered. Each subject type may be ` +
        'registered exactly once.',
    );
  }
  registry.set(subjectType, accessor);
}

export function getEvidenceSubjectAccessor(
  subjectType: EvidenceSubjectType,
): EvidenceSubjectAccessor {
  const accessor = registry.get(subjectType);
  if (!accessor) {
    throw new EvidenceSubjectTypeNotRegisteredError(subjectType);
  }
  return accessor;
}

export function __resetEvidenceSubjectRegistryForTests(): void {
  registry.clear();
}
