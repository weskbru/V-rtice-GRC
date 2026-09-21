/**
 * T142 — ports for the three explicit risk relationship link tables
 * (data-model.md §10, FR-076/FR-077, `contracts/risks.openapi.yaml`'s
 * `/risks/{riskId}/controls|processes|assets`). Three distinct port
 * classes, not one generic "link" port — CLAUDE.md §10 treats "explicit"
 * as a modeling decision distinct from "shared implementation is fine".
 * (The port that used to anchor this comment's cross-reference,
 * `registry-repository.port.ts`, was dead code with no production caller
 * and was removed outright by D-11/T009, 007-implementation-remediation.)
 *
 * Withdrawal (`unlink`) stamps `unlinkedAt`/`unlinkedByUserId` rather than
 * deleting the row (FR-076, FR-102) — there is no delete method on any of
 * these ports, matching `RiskAssessmentRepositoryPort`'s own "no update/no
 * delete path exists" convention applied to the mutation this table
 * actually forbids.
 *
 * `modules/risk/infrastructure/prisma-risk-relationship.repository.ts` is
 * the only implementation of all three, wired in `risk.module.ts`.
 */
import type { UserRefRecord } from './risk-repository.port';

export interface RegistryRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** `contracts/risks.openapi.yaml`'s `RiskControlLink` — exposes
 * `unlinkedBy` (unlike the process/asset shape below, which the contract's
 * `RiskEntityLink` does not). */
export interface ControlLinkRecord {
  readonly id: string;
  readonly riskId: string;
  readonly control: RegistryRefRecord;
  readonly linkedBy: UserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedBy: UserRefRecord | null;
  readonly unlinkedAt: Date | null;
}

/** `contracts/risks.openapi.yaml`'s `RiskEntityLink` — used for both
 * process and asset links (identical shape; the tables and Prisma models
 * behind them remain distinct, per this file's header). */
export interface EntityLinkRecord {
  readonly id: string;
  readonly riskId: string;
  readonly entity: RegistryRefRecord;
  readonly linkedBy: UserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedAt: Date | null;
}

export abstract class RiskControlLinkRepositoryPort {
  /** The currently-active link (`unlinkedAt IS NULL`) for `(riskId,
   * controlId)`, or `undefined` — used by the link use case to detect
   * "already linked" (FR-076, 409) BEFORE attempting the insert, though the
   * partial unique index is the real, race-free backstop (see the
   * migration's own comment). */
  abstract findActiveLink(
    riskId: string,
    controlId: string,
  ): Promise<ControlLinkRecord | undefined>;
  abstract create(
    riskId: string,
    controlId: string,
    linkedByUserId: string,
  ): Promise<ControlLinkRecord>;
  /** Single-row lookup by `(riskId, linkId)` — `undefined` if it does not
   * exist or belongs to a different risk. */
  abstract findById(riskId: string, linkId: string): Promise<ControlLinkRecord | undefined>;
  abstract unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void>;
  /** `includeWithdrawn`: `contracts/risks.openapi.yaml`'s
   * `listRiskControlLinks` — `false` returns only active links, `true`
   * also returns withdrawn ones with who removed them and when. */
  abstract listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ControlLinkRecord[]>;
}

export abstract class RiskProcessLinkRepositoryPort {
  abstract findActiveLink(riskId: string, processId: string): Promise<EntityLinkRecord | undefined>;
  abstract create(
    riskId: string,
    processId: string,
    linkedByUserId: string,
  ): Promise<EntityLinkRecord>;
  abstract findById(riskId: string, linkId: string): Promise<EntityLinkRecord | undefined>;
  abstract unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void>;
  abstract listByRisk(riskId: string): Promise<readonly EntityLinkRecord[]>;
}

export abstract class RiskAssetLinkRepositoryPort {
  abstract findActiveLink(riskId: string, assetId: string): Promise<EntityLinkRecord | undefined>;
  abstract create(
    riskId: string,
    assetId: string,
    linkedByUserId: string,
  ): Promise<EntityLinkRecord>;
  abstract findById(riskId: string, linkId: string): Promise<EntityLinkRecord | undefined>;
  abstract unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void>;
  abstract listByRisk(riskId: string): Promise<readonly EntityLinkRecord[]>;
}
