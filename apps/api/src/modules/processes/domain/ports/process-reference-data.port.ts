/**
 * T019/006-assets-processes — the `Process` counterpart of
 * `modules/assets/domain/ports/asset-reference-data.port.ts`. Identical in
 * shape (FR-020) — see that file's header for the full account this one
 * does not repeat.
 */
export interface ProcessOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export abstract class ProcessReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<ProcessOrgUnitLookup | undefined>;
  abstract findUser(
    id: string,
  ): Promise<{ readonly id: string; readonly fullName: string } | undefined>;
}
