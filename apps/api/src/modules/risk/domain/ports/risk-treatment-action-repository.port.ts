export interface TreatmentActionLinkRecord {
  readonly id: string;
  readonly riskId: string;
  readonly treatmentDecisionId: string | null;
  readonly actionId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTreatmentActionLinkInput {
  readonly riskId: string;
  readonly treatmentDecisionId: string | null;
  readonly actionId: string;
}

export abstract class RiskTreatmentActionRepositoryPort {
  abstract createLink(input: CreateTreatmentActionLinkInput): Promise<TreatmentActionLinkRecord>;

  abstract findLink(
    riskId: string,
    actionId: string,
  ): Promise<TreatmentActionLinkRecord | undefined>;

  abstract findTreatmentDecisionIdsByActionIds(
    actionIds: readonly string[],
  ): Promise<ReadonlyMap<string, string | null>>;

  abstract upsertTreatmentDecisionLink(
    riskId: string,
    actionId: string,
    treatmentDecisionId: string | null,
  ): Promise<TreatmentActionLinkRecord>;

  abstract findDecisionIdsWithOutstandingActions(
    decisionIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
}
