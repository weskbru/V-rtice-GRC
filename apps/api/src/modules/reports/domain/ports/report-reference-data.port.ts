/**
 * 009-indicators-reports, Fase 7 (T051) — port for resolving the one
 * external record `CreateReportDefinitionUseCase` needs: the actor's own
 * user row (for `AuditRecorder`'s `actorLabel`, FR-024). Mirrors
 * `modules/indicators/domain/ports/indicator-reference-data.port.ts`
 * exactly — see that file's header for why this is its own small port per
 * module rather than a shared cross-module lookup. `ReportDefinition` has
 * no `ownerUserId`/`orgUnitId` of its own (data-model.md §1: `createdByUserId`
 * is the only user reference, and it is always the caller), so this port
 * carries only `findUser`, narrower even than `IndicatorReferenceDataPort`.
 *
 * `infrastructure/prisma-report-reference-data.repository.ts` is the only
 * implementation, wired in `reports.module.ts`.
 */

export interface ReportUserLookup {
  readonly id: string;
  readonly isActive: boolean;
  readonly fullName: string;
}

export abstract class ReportReferenceDataPort {
  abstract findUser(id: string): Promise<ReportUserLookup | undefined>;
}
