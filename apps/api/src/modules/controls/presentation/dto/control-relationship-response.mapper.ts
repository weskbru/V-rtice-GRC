import type { RiskControlLinkReadRecord } from '../../../../shared/grc-ports/risk-control-link-read.port';
import type { ControlEntityLinkRecord } from '../../domain/ports/control-relationship-repository.port';

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface EntityRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RiskRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ControlEntityLinkResponse {
  readonly id: string;
  readonly process?: EntityRefResponse;
  readonly asset?: EntityRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRefResponse | null;
  readonly unlinkedAt: string | null;
}

export interface ControlRiskLinkResponse {
  readonly id: string;
  readonly risk: RiskRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRefResponse | null;
  readonly unlinkedAt: string | null;
}

export function toControlProcessLinkResponse(
  record: ControlEntityLinkRecord,
): ControlEntityLinkResponse {
  return {
    id: record.id,
    process: record.entity,
    linkedBy: record.linkedBy,
    linkedAt: record.linkedAt.toISOString(),
    unlinkedBy: record.unlinkedBy ?? null,
    unlinkedAt: record.unlinkedAt?.toISOString() ?? null,
  };
}

export function toControlAssetLinkResponse(
  record: ControlEntityLinkRecord,
): ControlEntityLinkResponse {
  return {
    id: record.id,
    asset: record.entity,
    linkedBy: record.linkedBy,
    linkedAt: record.linkedAt.toISOString(),
    unlinkedBy: record.unlinkedBy ?? null,
    unlinkedAt: record.unlinkedAt?.toISOString() ?? null,
  };
}

export function toControlRiskLinkResponse(
  record: RiskControlLinkReadRecord,
): ControlRiskLinkResponse {
  return {
    id: record.id,
    risk: record.risk,
    linkedBy: record.linkedBy,
    linkedAt: record.linkedAt.toISOString(),
    unlinkedBy: record.unlinkedBy ?? null,
    unlinkedAt: record.unlinkedAt?.toISOString() ?? null,
  };
}
