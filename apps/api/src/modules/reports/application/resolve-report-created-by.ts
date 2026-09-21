/**
 * 009-indicators-reports, Fase 7 (T054) — resolves a
 * `ReportDefinition.createdByUserId` into the `UserRef` shape
 * `contracts/reports.openapi.yaml`'s `ReportDefinition.createdBy` schema
 * declares. Mirrors
 * `modules/indicators/application/resolve-indicator-owner.ts` exactly — see
 * that file's header for the reasoning this one deliberately does not
 * repeat.
 *
 * Never returns `undefined`: `createdByUserId` is `onDelete: Restrict`
 * (schema.prisma's own `ReportDefinition.createdBy` relation), so a
 * persisted `ReportDefinition` can never outlive its creator user — a miss
 * here means the FK constraint itself was bypassed, not a legitimate "user
 * not found" case a caller should see as data.
 */
import type { ReportReferenceDataPort } from '../domain/ports/report-reference-data.port';

export interface ReportCreatedByRef {
  readonly id: string;
  readonly fullName: string;
}

export async function resolveReportCreatedByRef(
  referenceData: ReportReferenceDataPort,
  createdByUserId: string,
): Promise<ReportCreatedByRef> {
  const user = await referenceData.findUser(createdByUserId);
  if (!user) {
    throw new Error(
      `ReportDefinition record references createdByUserId ${createdByUserId}, but no such user ` +
        'exists. createdByUserId is onDelete: Restrict, so this is unreachable in correct data.',
    );
  }
  return { id: user.id, fullName: user.fullName };
}
