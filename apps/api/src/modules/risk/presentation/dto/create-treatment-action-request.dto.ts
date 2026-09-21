/**
 * T143 — matches `contracts/risks.openapi.yaml`'s
 * `CreateRiskTreatmentActionRequest` exactly (`additionalProperties: false`).
 */
import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateRiskTreatmentActionRequestDto {
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.treatmentAction.title.length })
  title!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.description.isString })
  description?: string | null;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.treatmentAction.responsibleUserId.isUuid })
  responsibleUserId!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.treatmentAction.dueOn.isDateString })
  dueOn!: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.treatmentAction.treatmentDecisionId.isUuid })
  treatmentDecisionId?: string | null;
}
