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
