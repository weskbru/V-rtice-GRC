export interface IncidentRiskLinkRiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface IncidentRiskLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRiskLinkRecord {
  readonly id: string;
  readonly incidentId: string;
  readonly risk: IncidentRiskLinkRiskRef;
  readonly linkedBy: IncidentRiskLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: IncidentRiskLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
