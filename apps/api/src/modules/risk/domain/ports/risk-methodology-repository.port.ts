import type { UserRefRecord } from './risk-repository.port';
import type { MethodologyConfiguration } from '../methodology.schema';

export interface MethodologyVersionRecord extends MethodologyConfiguration {
  readonly id: string;
  readonly methodologyId: string;
  readonly methodologyName: string;
  readonly versionNumber: number;
  readonly effectiveFrom: Date;
  readonly createdBy: UserRefRecord;
}

export interface CreateMethodologyVersionRecordInput {
  readonly methodologyId: string;
  readonly probabilityScale: MethodologyConfiguration['probabilityScale'];
  readonly impactScale: MethodologyConfiguration['impactScale'];
  readonly matrix: MethodologyConfiguration['matrix'];
  readonly levelBands: MethodologyConfiguration['levelBands'];
  readonly effectiveFrom: Date;
  readonly createdByUserId: string;
}

export interface MethodologyVersionPage {
  readonly items: readonly MethodologyVersionRecord[];
  readonly total: number;
}

export abstract class RiskMethodologyRepositoryPort {
  abstract findActiveMethodologyId(): Promise<string | undefined>;

  abstract findActiveVersion(): Promise<MethodologyVersionRecord | undefined>;

  abstract findVersionById(id: string): Promise<MethodologyVersionRecord | undefined>;

  abstract listVersions(page: number, pageSize: number): Promise<MethodologyVersionPage>;

  abstract createVersion(
    input: CreateMethodologyVersionRecordInput,
  ): Promise<MethodologyVersionRecord>;
}
