export interface IncidentAssetLinkAssetRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface IncidentAssetLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentAssetLinkRecord {
  readonly id: string;
  readonly incidentId: string;
  readonly asset: IncidentAssetLinkAssetRef;
  readonly linkedBy: IncidentAssetLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: IncidentAssetLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
