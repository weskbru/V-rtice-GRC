/**
 * T019/006-assets-processes — port for validating the one record `Asset`
 * refers to directly: the organizational unit it belongs to (Invariant A2).
 * Mirrors `modules/controls/domain/ports/control-reference-data.port.ts`'s
 * `OrgUnitLookup` shape exactly (see that file's header for why this is
 * each module's own small port rather than a shared cross-module lookup) —
 * narrowed to the one lookup Assets actually needs: unlike `Control`,
 * `Asset` has no owner field (research.md D-10 — "Dono... nenhum requisito
 * desta fase o usa").
 *
 * `infrastructure/prisma-asset-reference-data.repository.ts` is the only
 * implementation, wired by `assets.module.ts`.
 */
export interface AssetOrgUnitLookup {
  readonly id: string;
  readonly isActive: boolean;
}

export abstract class AssetReferenceDataPort {
  abstract findOrgUnit(id: string): Promise<AssetOrgUnitLookup | undefined>;
  abstract findUser(
    id: string,
  ): Promise<{ readonly id: string; readonly fullName: string } | undefined>;
}
