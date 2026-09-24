import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateFrameworkVersionRequestDto {
  @IsString({ message: USER_MESSAGES.dto.frameworkVersion.label.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.frameworkVersion.label.length })
  label!: string;
}
