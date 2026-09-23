import type { UserRefRecord } from './risk-repository.port';

export interface RegistryRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ControlLinkRecord {
  readonly id: string;
  readonly riskId: string;
  readonly control: RegistryRefRecord;
  readonly linkedBy: UserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedBy: UserRefRecord | null;
  readonly unlinkedAt: Date | null;
}

export interface EntityLinkRecord {
  readonly id: string;
  readonly riskId: string;
  readonly entity: RegistryRefRecord;
  readonly linkedBy: UserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedAt: Date | null;
}

export abstract class RiskControlLinkRepositoryPort {
  abstract findActiveLink(
    riskId: string,
    controlId: string,
  ): Promise<ControlLinkRecord | undefined>;
  abstract create(
    riskId: string,
    controlId: string,
    linkedByUserId: string,
  ): Promise<ControlLinkRecord>;
  abstract findById(riskId: string, linkId: string): Promise<ControlLinkRecord | undefined>;
  abstract unlink(linkId: string, unlinkedByUserId: string, unlinkedAt: Date): Promise<void>;
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
