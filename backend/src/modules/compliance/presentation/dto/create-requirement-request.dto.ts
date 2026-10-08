import { IsString, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateRequirementRequestDto {
  @IsString({ message: USER_MESSAGES.dto.requirement.externalRef.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.requirement.externalRef.length })
  externalRef!: string;

  @IsString({ message: USER_MESSAGES.dto.requirement.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.requirement.title.length })
  title!: string;

  @IsString({ message: USER_MESSAGES.dto.requirement.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.requirement.description.minLength })
  description!: string;
}
