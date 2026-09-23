import type {
  FindingControlLinkRecord,
  FindingControlLinkUserRef,
} from '../../domain/finding-control-link.entity';
import type {
  FindingRiskLinkRecord,
  FindingRiskLinkUserRef,
} from '../../domain/finding-risk-link.entity';

export interface ControlRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RiskRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface FindingControlLinkResponse {
  readonly id: string;
  readonly control: ControlRefResponse;
  readonly linkedAt: string;
  readonly linkedBy: UserRefResponse;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRefResponse | null;
}

export interface FindingRiskLinkResponse {
  readonly id: string;
  readonly risk: RiskRefResponse;
  readonly linkedAt: string;
  readonly linkedBy: UserRefResponse;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRefResponse | null;
}

function toUserRefResponse(
  user: FindingControlLinkUserRef | FindingRiskLinkUserRef,
): UserRefResponse {
  return { id: user.id, fullName: user.fullName };
}

export function toFindingControlLinkResponse(
  link: FindingControlLinkRecord,
): FindingControlLinkResponse {
  return {
    id: link.id,
    control: { id: link.control.id, code: link.control.code, name: link.control.name },
    linkedAt: link.linkedAt.toISOString(),
    linkedBy: toUserRefResponse(link.linkedBy),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
    unlinkedBy: link.unlinkedBy ? toUserRefResponse(link.unlinkedBy) : null,
  };
}

export function toFindingRiskLinkResponse(link: FindingRiskLinkRecord): FindingRiskLinkResponse {
  return {
    id: link.id,
    risk: { id: link.risk.id, code: link.risk.code, title: link.risk.title },
    linkedAt: link.linkedAt.toISOString(),
    linkedBy: toUserRefResponse(link.linkedBy),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
    unlinkedBy: link.unlinkedBy ? toUserRefResponse(link.unlinkedBy) : null,
  };
}
