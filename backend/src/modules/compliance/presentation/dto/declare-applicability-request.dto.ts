import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class DeclareApplicabilityRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.declareApplicability.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.declareApplicability.justification.length })
  justification?: string;
}
