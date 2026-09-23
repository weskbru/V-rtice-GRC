import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkIncidentRiskRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkIncidentRisk.riskId.isUuid })
  riskId!: string;
}
