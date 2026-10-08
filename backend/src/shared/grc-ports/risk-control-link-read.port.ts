export interface RiskRefRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ControlUserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RiskControlLinkReadRecord {
  readonly id: string;
  readonly risk: RiskRefRecord;
  readonly linkedBy: ControlUserRefRecord;
  readonly linkedAt: Date;
  readonly unlinkedBy: ControlUserRefRecord | undefined;
  readonly unlinkedAt: Date | undefined;
}

export abstract class RiskControlLinkReadPort {
  abstract listByControl(
    controlId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly RiskControlLinkReadRecord[]>;
}
