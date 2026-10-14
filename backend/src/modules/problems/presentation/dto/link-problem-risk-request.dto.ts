import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkProblemRiskRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkProblemRisk.riskId.isUuid })
  riskId!: string;
}
