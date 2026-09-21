/**
 * T036/003-controls-management, User Story 3 — ports for the two explicit
 * control relationship link tables (data-model.md §5, ADR-020 parts 1/2,
 * `contracts/controls.openapi.yaml`'s `/controls/{controlId}/processes|assets`).
 * Two distinct port classes, not one generic "link" port — mirrors
 * `modules/risk/domain/ports/risk-relationship-repository.port.ts`'s own
 * header for why this module treats "explicit per CLAUDE.md §10" as a
 * modeling decision distinct from "shared implementation is fine".
 *
 * Withdrawal (`unlink`) stamps `unlinkedAt`/`unlinkedByUserId` rather than
 * deleting the row (FR-023) — there is no delete method on either port.
 *
 * `infrastructure/control-process-link.repository.ts`/
 * `control-asset-link.repository.ts` are the only implementations.
 */
import type { ControlUserRef } from './control-assessment-repository.port';

export interface RegistryRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** `contracts/controls.openapi.yaml`'s `ControlProcessLink`/`ControlAssetLink`
 * — identical shape (the tables and Prisma models behind them remain
 * distinct, per this file's header). */
export interface ControlEntityLinkRecord {
  readonly id: string;
  readonly controlId: string;
  readonly entity: RegistryRefRecord;
  readonly linkedBy: ControlUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: ControlUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}

export abstract class ControlProcessLinkRepositoryPort {
  /** The currently-active link (`unlinkedAt IS NULL`) for `(controlId,
   * processId)`, or `undefined` — used to detect "already linked" (409)
   * BEFORE attempting the insert, though the partial unique index is the
   * real, race-free backstop (data-model.md §5). */
  abstract findActiveLink(
    controlId: string,
    processId: string,
  ): Promise<ControlEntityLinkRecord | undefined>;
  abstract create(
    controlId: string,
    processId: string,
    linkedByUserId: string,
  ): Promise<ControlEntityLinkRecord>;
  /** Single-row lookup by `(controlId, linkId)` — `undefined` if it does
   * not exist or belongs to a different control. */
  abstract findById(
    controlId: string,
    linkId: string,
  ): Promise<ControlEntityLinkRecord | undefined>;
  abstract unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void>;
  /** `includeWithdrawn`: `false` returns only active links, `true` also
   * returns withdrawn ones with who removed them and when (FR-023). */
  abstract listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ControlEntityLinkRecord[]>;
}

export abstract class ControlAssetLinkRepositoryPort {
  abstract findActiveLink(
    controlId: string,
    assetId: string,
  ): Promise<ControlEntityLinkRecord | undefined>;
  abstract create(
    controlId: string,
    assetId: string,
    linkedByUserId: string,
  ): Promise<ControlEntityLinkRecord>;
  abstract findById(
    controlId: string,
    linkId: string,
  ): Promise<ControlEntityLinkRecord | undefined>;
  abstract unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void>;
  abstract listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ControlEntityLinkRecord[]>;
}
