/**
 * T072/005-audit-findings, US3 — `CreateFindingRiskLinkRequest`
 * (`linkFindingToRisk`, FR-013).
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateFindingRiskLinkRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkFindingRisk.riskId.isUuid })
  riskId!: string;
}
