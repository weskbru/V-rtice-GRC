import type { ControlUserRef } from './control-assessment-repository.port';

export interface RegistryRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

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
  abstract findActiveLink(
    controlId: string,
    processId: string,
  ): Promise<ControlEntityLinkRecord | undefined>;
  abstract create(
    controlId: string,
    processId: string,
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
